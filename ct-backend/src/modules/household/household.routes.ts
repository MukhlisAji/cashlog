import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { Env } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../lib/auth.middleware.js";
import { authWithSubscription, authOnly } from "../../lib/prehandlers.js";
import { createSlotsSnapCheckout, isMidtransConfigured } from "../../lib/midtrans.js";
import { getUserProfile } from "../../lib/subscription.js";
import { householdRepository } from "./household.repository.js";
import type { HouseholdMemberRow } from "./household.types.js";
import {
  addWhitelistedMember,
  ensureLeadHousehold,
  getHouseholdSummary,
  purchaseMemberSlots,
} from "./household.service.js";
import { parseIndonesianPhone } from "../whatsapp/whatsapp.utils.js";

const addMemberSchema = z.object({
  displayName: z.string().min(2).max(64),
  phone: z.string().min(1).max(20),
});

const slotsSchema = z.object({
  slots: z.number().int().min(0).max(5),
});

async function assertLeadMember(
  userId: string,
  memberId: string,
): Promise<HouseholdMemberRow | null> {
  const household = await ensureLeadHousehold(userId);
  const member = await householdRepository.getMemberById(memberId);

  if (
    !member ||
    member.household_id !== household.id ||
    member.role !== "member" ||
    member.status === "revoked"
  ) {
    return null;
  }

  return member;
}

export async function householdRoutes(app: FastifyInstance, env: Env) {
  app.get(
    "/household",
    { preHandler: authOnly },
    async (request) => {
      const { userId } = request as AuthenticatedRequest;
      const summary = await getHouseholdSummary(userId, env);
      return { success: true, data: summary };
    },
  );

  app.post(
    "/household/members",
    { preHandler: authWithSubscription },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      const parsed = addMemberSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: "Nama dan nomor WhatsApp anggota wajib diisi.",
        });
      }

      const phoneResult = parseIndonesianPhone(parsed.data.phone);
      if (!phoneResult.ok) {
        return reply.code(400).send({
          success: false,
          error: phoneResult.error,
        });
      }

      const result = await addWhitelistedMember(
        env,
        userId,
        parsed.data.displayName,
        phoneResult.data.phone,
      );

      if (!result.ok) {
        return reply.code(400).send({ success: false, error: result.error });
      }

      return { success: true, data: result.data };
    },
  );

  app.delete(
    "/household/members/:memberId",
    { preHandler: authWithSubscription },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      const { memberId } = request.params as { memberId: string };

      const member = await assertLeadMember(userId, memberId);
      if (!member) {
        return reply.code(404).send({
          success: false,
          error: "Anggota tidak ditemukan.",
        });
      }

      await householdRepository.revokeMember(memberId);
      return { success: true };
    },
  );

  app.post(
    "/household/slots/checkout",
    { preHandler: authOnly },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      const parsed = slotsSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: "Jumlah slot tidak valid.",
        });
      }

      const slots = parsed.data.slots;

      if (!isMidtransConfigured(env)) {
        if (env.NODE_ENV === "development") {
          const result = await purchaseMemberSlots(userId, slots, env);
          if (!result.ok) {
            return reply.code(400).send({
              success: false,
              error: result.error,
            });
          }
          return {
            success: true,
            data: { ...result.data, devActivated: true },
            message: `${slots} slot anggota diaktifkan (dev mode).`,
          };
        }

        return reply.code(503).send({
          success: false,
          error: "Payment gateway belum dikonfigurasi.",
        });
      }

      const amount = slots * env.HOUSEHOLD_MEMBER_PRICE;
      if (amount <= 0) {
        const result = await purchaseMemberSlots(userId, 0, env);
        if (!result.ok) {
          return reply.code(400).send({
            success: false,
            error: result.error,
          });
        }
        return { success: true, data: result.data };
      }

      const profile = await getUserProfile(userId);

      try {
        const snap = await createSlotsSnapCheckout(env, {
          userId,
          slots,
          customerEmail: profile?.email,
          customerName: profile?.full_name,
        });

        return {
          success: true,
          data: {
            checkoutUrl: snap.checkoutUrl,
            invoiceId: snap.orderId,
            amount: snap.amount,
            slots,
            mode: "snap",
          },
        };
      } catch (error) {
        request.log.error(
          { error, userId, slots },
          "Household slots checkout failed",
        );
        return reply.code(502).send({
          success: false,
          error: "Gagal membuat pembayaran slot.",
        });
      }
    },
  );
}
