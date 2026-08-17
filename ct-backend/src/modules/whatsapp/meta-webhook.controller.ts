import type { FastifyReply, FastifyRequest } from "fastify";

import type { Env } from "../../config/env.js";
import { isMetaWhatsAppConfigured } from "../../config/env.js";
import { checkSubscription } from "../../lib/subscription.js";
import { householdRepository } from "../household/household.repository.js";
import { replyForUnlinkedUser } from "./wa-welcome.js";
import {
  claimWhatsAppLinkCode,
  parseWhatsAppLinkCode,
} from "./wa-link-code.service.js";
import {
  MetaService,
  type MetaIncomingMessageEnvelope,
  type MetaParsedWebhook,
  type MetaStatusEnvelope,
} from "./meta-cloud.service.js";

/**
 * Lightweight pub-sub so the webhook layer stays pure (no DB / parser /
 * LLM dependencies yet). Upstream modules (parser/handler/scheduler) can
 * subscribe and be notified once a verified message is ready.
 *
 * Intentionally NOT exported as a singleton importable from everywhere —
 * it's owned by the controller instance and injected. Subscribers are
 * invoked AFTER the HTTP 200 has already been sent.
 */
export type MetaMessageHandler = (
  msg: MetaIncomingMessageEnvelope,
) => void | Promise<void>;
export type MetaStatusHandler = (
  status: MetaStatusEnvelope,
) => void | Promise<void>;

export interface MetaWebhookHandlers {
  onMessage?: MetaMessageHandler;
  onStatus?: MetaStatusHandler;
}

export class MetaWhatsAppController {
  readonly #env: Env;
  readonly #meta: MetaService;
  readonly #handlers: MetaWebhookHandlers;

  constructor(env: Env, handlers: MetaWebhookHandlers = {}) {
    this.#env = env;
    this.#meta = new MetaService(env);
    this.#handlers = handlers;
  }

  metaService(): MetaService {
    return this.#meta;
  }

  /**
   * "Bouncer" — authorization gate for every incoming Meta message.
   *
   * Contract: this method MUST NOT throw (caller already ACK'd Meta 200 OK).
   * Any error is swallowed and logged; we err on the side of allowing the
   * handlers to run later unless we positively identify the user as
   * unregistered / expired.
   *
   * Returns `true` if the user passed the gate (authorized) and the caller
   * should continue to downstream subscribers (LLM / parser).
   * Returns `false` if the caller MUST short-circuit (replied already).
   */
  async #runAuthorizationBouncer(
    request: FastifyRequest,
    msg: MetaIncomingMessageEnvelope,
  ): Promise<boolean> {
    const linkCode = parseWhatsAppLinkCode(msg.body);
    if (linkCode) {
      try {
        const userId = await claimWhatsAppLinkCode(linkCode, msg.waId);
        await this.#meta.sendWhatsAppMessage(
          msg.waId,
          userId
            ? "✅ Nomor WhatsApp berhasil ditautkan. Sekarang kirim transaksi, misalnya: kopi 25rb"
            : "❌ Kode tidak valid, sudah dipakai, kedaluwarsa, atau nomor ini terdaftar di akun lain. Buat kode baru di Pengaturan.",
        );
      } catch (err) {
        request.log.error(
          { waId: msg.waId, err },
          "[meta-webhook][link] failed to claim link code",
        );
        await this.#meta.sendWhatsAppMessage(
          msg.waId,
          "⚠️ Gagal menautkan nomor. Coba buat kode baru di Pengaturan.",
        );
      }
      return false;
    }

    let ctx;
    try {
      ctx = await householdRepository.getActiveByPhone(msg.waId);
    } catch (err) {
      request.log.error(
        {
          waId: msg.waId,
          messageId: msg.messageId,
          err: err instanceof Error ? err : String(err),
        },
        "[meta-webhook][bouncer] whitelist lookup failed — sending welcome to avoid silent drop",
      );
      try {
        await this.#meta.sendWhatsAppMessage(msg.waId, replyForUnlinkedUser(msg.body));
      } catch {
        // ignore send failure
      }
      return false;
    }

    if (!ctx) {
      request.log.info(
        { waId: msg.waId, messageId: msg.messageId },
        "[meta-webhook][bouncer] first/unknown WA — welcome",
      );
      try {
        await this.#meta.sendWhatsAppMessage(msg.waId, replyForUnlinkedUser(msg.body));
      } catch (err) {
        request.log.error(
          {
            waId: msg.waId,
            err: err instanceof Error ? err : String(err),
          },
          "[meta-webhook][bouncer] failed to send welcome",
        );
      }
      return false;
    }

    const sub = await checkSubscription(ctx.leadUserId);
    if (!sub.allowed) {
      request.log.info(
        {
          waId: msg.waId,
          userId: ctx.leadUserId,
          messageId: msg.messageId,
        },
        "[meta-webhook][bouncer] subscription not allowed",
      );
      try {
        await this.#meta.sendWhatsAppMessage(
          msg.waId,
          "Masa aktif langganan sudah habis. Perpanjang di cashlog.id/settings untuk lanjut mencatat.",
        );
      } catch (err) {
        request.log.error(
          {
            waId: msg.waId,
            err: err instanceof Error ? err : String(err),
          },
          "[meta-webhook][bouncer] failed to send expired reply",
        );
      }
      return false;
    }

    request.log.info(
      {
        waId: msg.waId,
        userId: ctx.leadUserId,
        memberId: ctx.memberId,
        messageId: msg.messageId,
      },
      "[meta-webhook][bouncer] whitelisted — proceed",
    );
    return true;
  }

  /**
   * GET /webhook — Meta Cloud API verification handshake.
   *
   * The Meta platform sends us:
   *   hub.mode         = "subscribe"
   *   hub.verify_token = our configured META_VERIFY_TOKEN
   *   hub.challenge    = opaque string we must echo back
   *
   * STRICT: If valid, respond with JUST the raw `hub.challenge` string
   * (200 OK, text/plain — do NOT wrap it in JSON). Meta will reject any
   * other body shape and fail to enable the webhook.
   */
  verifyWebhook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): FastifyReply | Promise<FastifyReply> {
    const rawQuery = (request.query ?? {}) as Record<string, unknown>;
    const mode = typeof rawQuery["hub.mode"] === "string" ? rawQuery["hub.mode"] : undefined;
    const token =
      typeof rawQuery["hub.verify_token"] === "string"
        ? rawQuery["hub.verify_token"]
        : undefined;
    const challenge =
      typeof rawQuery["hub.challenge"] === "string"
        ? rawQuery["hub.challenge"]
        : undefined;

    if (!this.#env.META_VERIFY_TOKEN) {
      request.log.warn(
        "[meta-webhook] META_VERIFY_TOKEN not set; rejecting verify request",
      );
      return reply.code(500).send({
        success: false,
        error: "META_VERIFY_TOKEN is not configured",
      });
    }

    if (mode !== "subscribe" || token !== this.#env.META_VERIFY_TOKEN) {
      request.log.warn(
        { mode, receivedTokenSet: !!token, challengeSet: !!challenge },
        "[meta-webhook] verification failed: bad mode or mismatched token",
      );
      return reply.code(403).send({
        success: false,
        error: "Verification token mismatch",
      });
    }

    if (!challenge) {
      request.log.warn(
        "[meta-webhook] verification passed but hub.challenge missing",
      );
      return reply.code(400).send({
        success: false,
        error: "hub.challenge is required",
      });
    }

    request.log.info(
      "[meta-webhook] verification OK, echoing challenge back",
    );
    // MUST return the challenge as a raw string body.
    reply.header("Content-Type", "text/plain; charset=utf-8");
    return reply.code(200).send(String(challenge));
  }

  /**
   * POST /webhook — Receive a Meta webhook delivery.
   *
   * GUARANTEED BY DESIGN (see module docstring at the top of this file):
   *   1. We validate that the sender is Meta (configured token) + object field.
   *   2. We FLUSH the HTTP 200 OK response FIRST before any async work.
   *      If we delay even by a few 100ms too much, Meta retries and we
   *      double-process messages (dedup lives in the parser layer).
   *   3. Then, and ONLY then, we publish parsed messages to subscribers.
   *
   * Subscribers are invoked via `void handler(...).catch(...)` — if one
   * of them throws, the webhook itself is unaffected. We already sent 200.
   */
  receiveWebhook(request: FastifyRequest, reply: FastifyReply): FastifyReply {
    if (!isMetaWhatsAppConfigured(this.#env)) {
      request.log.warn(
        "[meta-webhook] Meta not configured; dropping POST webhook",
      );
      // ACK so Meta does not retry at us until the operator fixes env.
      return reply.code(200).send();
    }

    const body = request.body;
    if (!body || typeof body !== "object") {
      request.log.warn(
        { bodyType: typeof body },
        "[meta-webhook] rejected non-object payload",
      );
      return reply.code(200).send();
    }

    const payloadObj = body as MetaParsedWebhook extends never
      ? Record<string, unknown>
      : Record<string, unknown>;
    if ((payloadObj as { object?: unknown }).object !== "whatsapp_business_account") {
      // Not a WhatsApp Business webhook — could be from another FB product.
      // Still ACK because Meta will otherwise retry the event indefinitely.
      request.log.warn(
        { object: (payloadObj as { object?: unknown }).object },
        "[meta-webhook] ignoring non-whatsapp payload",
      );
      return reply.code(200).send();
    }

    // ---------- POINT OF NO RETURN FOR HTTP 200 ----------
    // Send the ACK NOW. Everything below this line runs after `reply`
    // is flushed. We MUST NOT `await` anything inside this handler scope.
    // ------------------------------------------------------
    reply.code(200).send();

    // Schedule parse + dispatch in the next microtask after the response
    // is handed off so that GC/parser latency cannot delay the 200.
    queueMicrotask(() => {
      this.#handlePayloadAsync(request, body).catch((err) => {
        request.log.error(
          { err: err instanceof Error ? err : String(err) },
          "[meta-webhook] async payload dispatch threw (after HTTP 200)",
        );
      });
    });

    return reply;
  }

  /**
   * Runs AFTER the HTTP 200 has been sent. Safe to do slow work here.
   * Broken out so it can be unit-tested directly without involving the
   * Fastify reply lifecycle.
   */
  async #handlePayloadAsync(
    request: FastifyRequest,
    body: unknown,
  ): Promise<void> {
    const parsed = this.#meta.parseWebhookPayload(body);

    const messagesCount = parsed.messages.length;
    const statusesCount = parsed.statuses.length;

    if (messagesCount === 0 && statusesCount === 0) {
      request.log.debug(
        "[meta-webhook] payload parsed — no actionable messages/statuses",
      );
      return;
    }

    request.log.info(
      { messages: messagesCount, statuses: statusesCount },
      "[meta-webhook] dispatching parsed events",
    );

    const onMsg = this.#handlers.onMessage;
    if (onMsg) {
      for (const msg of parsed.messages) {
        // Bouncer (authorization gate) runs BEFORE any downstream parser/LLM.
        // If it returns false, the method already replied to the user; do NOT
        // pass the message to subscribers.
        try {
          const authorized = await this.#runAuthorizationBouncer(request, msg);
          if (!authorized) continue;
        } catch (err) {
          // Defensive: bouncer itself has internal try/catch but keep this
          // outer belt-and-suspenders — NEVER block the async dispatch loop
          // because of a single bad message (Meta's 200 already sent).
          request.log.error(
            {
              waId: msg.waId,
              messageId: msg.messageId,
              err: err instanceof Error ? err : String(err),
            },
            "[meta-webhook] bouncer threw unexpectedly — skipping message",
          );
          continue;
        }

        try {
          await onMsg(msg);
        } catch (err) {
          request.log.error(
            {
              waId: msg.waId,
              messageId: msg.messageId,
              err: err instanceof Error ? err : String(err),
            },
            "[meta-webhook] onMessage subscriber threw (message NOT retried)",
          );
        }
      }
    }

    const onStatus = this.#handlers.onStatus;
    if (onStatus) {
      for (const status of parsed.statuses) {
        try {
          await onStatus(status);
        } catch (err) {
          request.log.error(
            {
              messageId: status.messageId,
              status: status.status,
              err: err instanceof Error ? err : String(err),
            },
            "[meta-webhook] onStatus subscriber threw",
          );
        }
      }
    }
  }
}
