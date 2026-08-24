import type { FastifyInstance } from "fastify";

import type { Env } from "../../config/env.js";
import type {
  MetaMessageHandler,
  MetaWebhookHandlers,
} from "./meta-webhook.controller.js";
import { MetaWhatsAppController } from "./meta-webhook.controller.js";

export interface MetaWebhookRoutesOptions extends MetaWebhookHandlers {
  env: Env;
  /**
   * Optional override for the webhook path. Defaults to
   * `env.META_WEBHOOK_PATH ?? "webhook"`.
   */
  webhookPath?: string;
}

/**
 * Registers the Meta WhatsApp Cloud API webhook endpoints with the
 * Fastify application.
 *
 * The route prefix in `app.register` MUST be something that does NOT go
 * through the authOnly / subscription middleware in this codebase — Meta
 * POSTs `X-Hub-Signature-256` plus JSON body (deliveries).
 *
 * Usage:
 *
 *    await app.register(
 *      async (instance) =>
 *        metaWebhookRoutes(instance, {
 *          env,
 *          onMessage: async (msg) => {
 *            // msg.waId, msg.body, msg.messageId ... plug in parser
 *          },
 *          onStatus: async (st) => {
 *            // delivered / read / failed receipts
 *          },
 *        }),
 *      { prefix: "/meta" },     //  =>  GET/POST /meta/webhook
 *    );
 */
export async function metaWebhookRoutes(
  app: FastifyInstance,
  options: MetaWebhookRoutesOptions,
): Promise<void> {
  const { env, onMessage, onStatus } = options;
  const handlers: Required<Pick<MetaMessageHandler, never>> &
    MetaWebhookHandlers = {};
  if (onMessage) handlers.onMessage = onMessage;
  if (onStatus) handlers.onStatus = onStatus;

  const controller = new MetaWhatsAppController(env, handlers);

  const webhookPath = options.webhookPath ?? env.META_WEBHOOK_PATH ?? "webhook";

  // Disable request size limit since webhook payloads from Meta occasionally
  // contain base64 media previews and the default limits can bite. 1 MB is
  // ample — anything larger is an attack signal.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string", bodyLimit: 1 * 1024 * 1024 },
    (req, body: string | Uint8Array, done) => {
      let text: string;
      if (typeof body === "string") {
        text = body;
      } else if (body instanceof Uint8Array) {
        text = new TextDecoder("utf-8").decode(body);
      } else {
        text = String(body);
      }
      req.rawBody = text;
      try {
        done(null, text ? JSON.parse(text) : {});
      } catch (err) {
        done(err as Error);
      }
    },
  );

  // GET /<prefix>/webhook  — verification handshake
  app.get(
    `/${webhookPath}`,
    {
      config: { rateLimit: false },
    },
    (request, reply) => controller.verifyWebhook(request, reply),
  );

  // POST /<prefix>/webhook — deliveries (incoming messages + statuses)
  app.post(
    `/${webhookPath}`,
    {
      config: { rateLimit: false },
    },
    (request, reply) => controller.receiveWebhook(request, reply),
  );

  // Expose the MetaService instance via Fastify's decorator for modules
  // that want to send outbound messages (e.g. pairing/onboarding/reminder
  // flows). Usage: `app.metaWhatsApp.sendWhatsAppMessage(to, msg)`.
  if (!app.hasDecorator("metaWhatsApp")) {
    app.decorate("metaWhatsApp", controller.metaService());
  }
}

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }
  interface FastifyInstance {
    metaWhatsApp?: ReturnType<MetaWhatsAppController["metaService"]>;
  }
}
