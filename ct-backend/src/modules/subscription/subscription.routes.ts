import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { Env } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../lib/auth.middleware.js";
import {
  createMidtransSubscription,
  createSubscriptionSnapCheckout,
  disableMidtransSubscription,
  getMidtransTransactionStatus,
  isMidtransConfigured,
  skipPayments,
  isMidtransPaymentSuccess,
  isRecurringChargeSuccess,
  parseMidtransOrderContext,
  parseRecurringWebhookMetadata,
  verifyMidtransSignature,
} from "../../lib/midtrans.js";
import { authOnly } from "../../lib/prehandlers.js";
import { WEBHOOK_RATE_LIMIT } from "../../lib/security.js";
import {
  activateSubscription,
  checkSubscription,
  clearMidtransSubscription,
  getUserIdByMidtransSubscriptionId,
  getUserProfile,
  startTrialForUser,
  updateMidtransSubscriptionId,
} from "../../lib/subscription.js";
import type { SubscriptionTier } from "../../lib/subscription.constants.js";
import { purchaseMemberSlots } from "../household/household.service.js";
import { sendSubscriptionActivatedEmail } from "../../lib/email/email.service.js";

const checkoutSchema = z.object({
  tier: z.literal("pro").default("pro"),
});

const confirmPaymentSchema = z.object({
  orderId: z.string().min(1).max(50),
});

interface MidtransPaymentNotification {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  custom_field1?: string;
  custom_field2?: string;
  custom_field3?: string;
  saved_token?: string;
  payment_type?: string;
  transaction_id?: string;
}

interface MidtransRecurringNotification {
  event_name?: string;
  subscription?: {
    id?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  };
  transaction?: {
    status_code?: string;
    transaction_status?: string;
  };
}

async function handleSuccessfulSubscriptionPayment(
  app: FastifyInstance,
  env: Env,
  userId: string,
  tier: SubscriptionTier,
  options?: {
    savedToken?: string;
    paymentType?: string;
    setupRecurring?: boolean;
  },
): Promise<void> {
  const profile = await getUserProfile(userId);
  const wasPaidActive =
    profile?.subscription_status === "active" &&
    profile.subscription_tier === tier;

  const result = await activateSubscription(userId, tier);
  if (!result.ok) {
    throw new Error("Activation failed");
  }

  if (
    options?.setupRecurring &&
    options.savedToken &&
    (options.paymentType === "credit_card" || options.paymentType === "gopay")
  ) {
    if (profile?.midtrans_subscription_id) {
      await disableMidtransSubscription(env, profile.midtrans_subscription_id);
      await clearMidtransSubscription(userId);
    }

    const subscription = await createMidtransSubscription(env, {
      userId,
      tier,
      token: options.savedToken,
      paymentType: options.paymentType,
      customerEmail: profile?.email,
      customerName: profile?.full_name,
    });

    await updateMidtransSubscriptionId(userId, subscription.id);
    app.log.info(
      { userId, tier, subscriptionId: subscription.id },
      "Midtrans recurring subscription created",
    );
  }

  app.log.info({ userId, tier }, "Subscription activated via Midtrans");

  if (!wasPaidActive) {
    void sendSubscriptionActivatedEmail(env, userId, tier).catch((error) => {
      app.log.error({ error, userId }, "Subscription email failed");
    });
  }
}

export async function subscriptionRoutes(app: FastifyInstance, env: Env) {
  app.get(
    "/subscription/status",
    { preHandler: authOnly },
    async (request) => {
      const { userId } = request as AuthenticatedRequest;
      const sub = await checkSubscription(userId);
      const profile = await getUserProfile(userId);

      return {
        success: true,
        data: {
          ...sub,
          autoRenewal: !!profile?.midtrans_subscription_id,
        },
      };
    },
  );

  app.post(
    "/subscription/start-trial",
    { preHandler: authOnly },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      const result = await startTrialForUser(userId);
      if (!result.ok) {
        const alreadyUsed = result.errorCode === "TRIAL_ALREADY_USED";
        return reply.code(alreadyUsed ? 409 : 400).send({
          success: false,
          error: result.errorMessage ?? "Gagal mengaktifkan trial.",
          code: result.errorCode ?? "TRIAL_FAILED",
        });
      }
      const sub = await checkSubscription(userId);
      return {
        success: true,
        data: sub,
        message: "Trial Pro aktif.",
      };
    },
  );

  app.post(
    "/subscription/checkout",
    { preHandler: authOnly },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      const parsed = checkoutSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: "Paket tidak valid.",
        });
      }

      const tier = parsed.data.tier as SubscriptionTier;

      if (skipPayments(env)) {
        const result = await activateSubscription(userId, tier);
        if (!result.ok) {
          return reply.code(500).send({
            success: false,
            error: "Gagal mengaktifkan langganan.",
          });
        }
        const sub = await checkSubscription(userId);
        return {
          success: true,
          data: { ...sub, devActivated: true },
          message: `Langganan ${tier} diaktifkan (tanpa pembayaran).`,
        };
      }

      if (!isMidtransConfigured(env)) {
        return reply.code(503).send({
          success: false,
          error: "Payment gateway belum dikonfigurasi. Hubungi support.",
        });
      }

      const profile = await getUserProfile(userId);

      try {
        const recurring = env.MIDTRANS_CHECKOUT_MODE === "recurring";

        if (recurring && profile?.midtrans_subscription_id) {
          await disableMidtransSubscription(
            env,
            profile.midtrans_subscription_id,
          );
          await clearMidtransSubscription(userId);
        }

        const snap = await createSubscriptionSnapCheckout(env, {
          userId,
          tier,
          customerEmail: profile?.email,
          customerName: profile?.full_name,
          recurring,
        });

        return {
          success: true,
          data: {
            checkoutUrl: snap.checkoutUrl,
            invoiceUrl: snap.checkoutUrl,
            invoiceId: snap.orderId,
            amount: snap.amount,
            tier,
            mode: recurring ? "recurring" : "snap",
          },
        };
      } catch (error) {
        app.log.error({ error, userId, tier }, "Midtrans checkout failed");
        return reply.code(502).send({
          success: false,
          error: "Gagal membuat pembayaran. Coba lagi.",
        });
      }
    },
  );

  app.post(
    "/subscription/confirm-payment",
    { preHandler: authOnly },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      const parsed = confirmPaymentSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: "orderId tidak valid",
        });
      }

      if (!isMidtransConfigured(env)) {
        return reply.code(503).send({
          success: false,
          error: "Payment gateway belum dikonfigurasi.",
        });
      }

      const { orderId } = parsed.data;
      const tx = await getMidtransTransactionStatus(env, orderId);

      if (!tx) {
        return reply.code(404).send({
          success: false,
          error: "Transaksi tidak ditemukan.",
        });
      }

      const context = parseMidtransOrderContext(tx);
      if (!context || context.userId !== userId) {
        return reply.code(403).send({
          success: false,
          error: "Transaksi tidak valid untuk akun ini.",
        });
      }

      if (!isMidtransPaymentSuccess(tx)) {
        const sub = await checkSubscription(userId);
        return {
          success: true,
          data: {
            ...sub,
            paymentPending: true,
            transactionStatus: tx.transaction_status ?? null,
          },
        };
      }

      try {
        if (context.kind === "slots") {
          const slotsResult = await purchaseMemberSlots(
            context.userId,
            context.slots ?? 0,
            env,
          );
          if (!slotsResult.ok) {
            return reply.code(500).send({
              success: false,
              error: "Gagal mengaktifkan slot anggota.",
            });
          }
        } else if (context.tier) {
          await handleSuccessfulSubscriptionPayment(
            app,
            env,
            context.userId,
            context.tier,
            {
              savedToken: tx.saved_token,
              paymentType: tx.payment_type,
              setupRecurring: env.MIDTRANS_CHECKOUT_MODE === "recurring",
            },
          );
        }
      } catch (error) {
        request.log.error({ error, orderId, userId }, "confirm-payment failed");
        return reply.code(500).send({
          success: false,
          error: "Gagal mengaktifkan langganan.",
        });
      }

      const sub = await checkSubscription(userId);
      return {
        success: true,
        data: sub,
        message: "Langganan diaktifkan.",
      };
    },
  );

  app.post(
    "/subscription/cancel-renewal",
    { preHandler: authOnly },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      const profile = await getUserProfile(userId);

      if (!profile?.midtrans_subscription_id) {
        return reply.code(400).send({
          success: false,
          error: "Tidak ada langganan otomatis aktif.",
        });
      }

      if (!isMidtransConfigured(env)) {
        return reply.code(503).send({
          success: false,
          error: "Payment gateway belum dikonfigurasi.",
        });
      }

      const ok = await disableMidtransSubscription(
        env,
        profile.midtrans_subscription_id,
      );

      if (!ok) {
        return reply.code(502).send({
          success: false,
          error: "Gagal membatalkan perpanjangan otomatis.",
        });
      }

      await clearMidtransSubscription(userId);

      return {
        success: true,
        message:
          "Perpanjangan otomatis dibatalkan. Akses tetap aktif sampai tanggal berakhir langganan.",
      };
    },
  );

  app.post(
    "/subscription/upgrade",
    { preHandler: authOnly },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      const current = await checkSubscription(userId);

      if (current.isPro && !current.isTrial) {
        return {
          success: true,
          data: current,
          message: "Pro sudah aktif",
        };
      }

      if (skipPayments(env)) {
        const result = await activateSubscription(userId, "pro");
        if (!result.ok) {
          return reply.code(500).send({
            success: false,
            error: "Gagal mengaktifkan Pro.",
          });
        }

        const sub = await checkSubscription(userId);
        return {
          success: true,
          data: { ...sub, devActivated: true },
          message: "Pro berhasil diaktifkan (tanpa pembayaran).",
        };
      }

      if (isMidtransConfigured(env)) {
        return reply.code(400).send({
          success: false,
          error: "Gunakan checkout untuk berlangganan.",
          code: "USE_CHECKOUT",
        });
      }

      return reply.code(503).send({
        success: false,
        error: "Payment gateway belum tersedia.",
      });
    },
  );

  app.post(
    "/webhooks/midtrans",
    { config: { rateLimit: WEBHOOK_RATE_LIMIT } },
    async (request, reply) => {
      const body = request.body as MidtransPaymentNotification;

      if (!verifyMidtransSignature(env, body)) {
        return reply.code(401).send({ error: "Invalid signature" });
      }

      if (!isMidtransPaymentSuccess(body)) {
        return { received: true };
      }

      const context = parseMidtransOrderContext(body);
      if (!context) {
        app.log.warn({ orderId: body.order_id }, "Unrecognized Midtrans order");
        return { received: true };
      }

      try {
        if (context.kind === "slots") {
          const slotsResult = await purchaseMemberSlots(
            context.userId,
            context.slots ?? 0,
            env,
          );
          if (!slotsResult.ok) {
            app.log.error(
              { userId: context.userId, slots: context.slots },
              "Failed to activate household slots after Midtrans payment",
            );
            return reply.code(500).send({ error: "Slots activation failed" });
          }
          app.log.info(
            { userId: context.userId, slots: context.slots },
            "Household member slots activated via Midtrans",
          );
          return { received: true };
        }

        if (!context.tier) {
          return { received: true };
        }

        await handleSuccessfulSubscriptionPayment(
          app,
          env,
          context.userId,
          context.tier,
          {
            savedToken: body.saved_token,
            paymentType: body.payment_type,
            setupRecurring: env.MIDTRANS_CHECKOUT_MODE === "recurring",
          },
        );
      } catch (error) {
        app.log.error({ error, body }, "Midtrans payment webhook failed");
        return reply.code(500).send({ error: "Webhook handler failed" });
      }

      return { received: true };
    },
  );

  app.post(
    "/webhooks/midtrans/recurring",
    { config: { rateLimit: WEBHOOK_RATE_LIMIT } },
    async (request, reply) => {
      const body = request.body as MidtransRecurringNotification;

      if (!isRecurringChargeSuccess(body)) {
        return { received: true };
      }

      const subscriptionId = body.subscription?.id;
      let parsed = parseRecurringWebhookMetadata(body.subscription?.metadata);

      if (!parsed && subscriptionId) {
        const userId = await getUserIdByMidtransSubscriptionId(subscriptionId);
        if (userId) {
          const profile = await getUserProfile(userId);
          const legacyTier = profile?.subscription_tier as string | null;
          if (legacyTier === "basic" || legacyTier === "pro") {
            parsed = { userId, tier: "pro" };
          }
        }
      }

      if (!parsed) {
        app.log.warn({ body }, "Unrecognized Midtrans recurring webhook");
        return { received: true };
      }

      try {
        const result = await activateSubscription(parsed.userId, parsed.tier);
        if (!result.ok) {
          return reply.code(500).send({ error: "Activation failed" });
        }

        if (subscriptionId) {
          await updateMidtransSubscriptionId(parsed.userId, subscriptionId);
        }

        app.log.info(
          { userId: parsed.userId, tier: parsed.tier, subscriptionId },
          "Subscription extended via Midtrans recurring charge",
        );
      } catch (error) {
        app.log.error({ error, body }, "Midtrans recurring webhook failed");
        return reply.code(500).send({ error: "Webhook handler failed" });
      }

      return { received: true };
    },
  );
}
