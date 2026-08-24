import type { FastifyReply, FastifyRequest } from "fastify";

import type { Env } from "../../config/env.js";
import { isMetaWhatsAppConfigured } from "../../config/env.js";
import { verifyMetaWebhookSignature } from "../../lib/meta-webhook-signature.js";
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
   *   1. We validate X-Hub-Signature-256 when META_APP_SECRET is set.
   *   2. We FLUSH the HTTP 200 OK response FIRST before any async work.
   *      If we delay even by a few 100ms too much, Meta retries and we
   *      double-process messages (dedup lives in the parser layer).
   *   3. Then, and ONLY then, we publish parsed messages to subscribers.
   *
   * Subscribers are invoked via `void handler(...).catch(...)` — if one
   * of them throws, the webhook itself is unaffected. We already sent 200.
   */
  receiveWebhook(request: FastifyRequest, reply: FastifyReply): FastifyReply {
    const appSecret = this.#env.META_APP_SECRET;
    const requireSignature =
      this.#env.NODE_ENV === "production" || Boolean(appSecret);

    if (requireSignature) {
      if (!appSecret) {
        request.log.error(
          "[meta-webhook] META_APP_SECRET missing; rejecting POST",
        );
        return reply.code(503).send({ error: "Webhook signature not configured" });
      }
      const rawBody = request.rawBody ?? "";
      const signature = request.headers["x-hub-signature-256"];
      if (!verifyMetaWebhookSignature(appSecret, rawBody, signature)) {
        request.log.warn("[meta-webhook] invalid X-Hub-Signature-256");
        return reply.code(403).send({ error: "Invalid webhook signature" });
      }
    } else {
      request.log.warn(
        "[meta-webhook] META_APP_SECRET unset; skipping signature check (dev only)",
      );
    }

    if (!isMetaWhatsAppConfigured(this.#env)) {
      request.log.warn(
        "[meta-webhook] Meta not configured; dropping POST webhook",
      );
      // ACK so Meta does not retry at us until the operator fixes env.
      return reply.code(200).send();
    }

    request.log.warn(
      { url: request.url, contentType: request.headers["content-type"] },
      "[meta-webhook] POST received",
    );

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
      request.log.warn(
        "[meta-webhook] payload parsed — no actionable messages/statuses",
      );
      return;
    }

    request.log.warn(
      { messages: messagesCount, statuses: statusesCount },
      "[meta-webhook] dispatching parsed events",
    );

    const onMsg = this.#handlers.onMessage;
    if (onMsg) {
      for (const msg of parsed.messages) {
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
