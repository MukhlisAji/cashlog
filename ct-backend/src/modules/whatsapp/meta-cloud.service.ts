import type { Env } from "../../config/env.js";
import { isMetaWhatsAppConfigured } from "../../config/env.js";

/**
 * Minimum viable subset of the Meta WhatsApp Cloud API payloads.
 *
 * These types intentionally mirror the official `messages` and `webhooks`
 * JSON shapes documented at
 * https://developers.facebook.com/docs/whatsapp/cloud-api/ so we can
 * deserialize/serialize safely without pulling `zod` parsing into the
 * hot path.
 *
 * Only the fields that are used in this foundational layer are typed.
 */

export type MetaMessageType = "text" | "reaction" | "image" | "interactive";

export interface MetaTextMessage {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: {
    preview_url?: boolean;
    body: string;
  };
}

export interface MetaSendMessageResponse {
  messaging_product: "whatsapp";
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

export interface MetaWebhookEntryChangeValueMessageText {
  body: string;
}

export interface MetaWebhookEntryChangeValueMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: MetaWebhookEntryChangeValueMessageText;
  type: string;
  [extra: string]: unknown;
}

export interface MetaWebhookEntryChangeValueStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  [extra: string]: unknown;
}

export interface MetaWebhookEntryChangeValue {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    wa_id: string;
    profile?: { name: string };
  }>;
  messages?: MetaWebhookEntryChangeValueMessage[];
  statuses?: MetaWebhookEntryChangeValueStatus[];
  [extra: string]: unknown;
}

export interface MetaWebhookEntryChange {
  field: string;
  value: MetaWebhookEntryChangeValue;
}

export interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookEntryChange[];
}

export interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

export interface MetaIncomingMessageEnvelope {
  waId: string;
  messageId: string;
  timestamp: string;
  body: string | null;
  type: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  profileName: string | null;
  raw: MetaWebhookEntryChangeValueMessage;
}

export interface MetaStatusEnvelope {
  messageId: string;
  status: string;
  timestamp: string;
  recipientId: string;
  phoneNumberId: string;
  raw: MetaWebhookEntryChangeValueStatus;
}

export interface MetaParsedWebhook {
  messages: MetaIncomingMessageEnvelope[];
  statuses: MetaStatusEnvelope[];
}

const META_GRAPH_BASE = "https://graph.facebook.com";

export function buildMessagesEndpoint(env: Env): string {
  const version = env.META_API_VERSION ?? "v20.0";
  const phoneNumberId = env.META_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error(
      "META_PHONE_NUMBER_ID is required to call the Meta messages API",
    );
  }
  return `${META_GRAPH_BASE}/${version}/${phoneNumberId}/messages`;
}

export class MetaService {
  readonly #env: Env;

  constructor(env: Env) {
    this.#env = env;
  }

  /**
   * Build a `text` type message body. Exported separately so tests /
   * higher level services can pre-build and extend with other fields
   * (context, reaction, etc.) before calling `sendRaw`.
   */
  buildTextMessage(to: string, body: string): MetaTextMessage {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: true, body },
    };
  }

  /**
   * Low level sender — does not apply defaults. Assumes `payload` is a
   * well formed Meta Cloud API message object, and returns the raw
   * successful JSON.
   */
  async sendRaw<T = MetaSendMessageResponse>(payload: unknown): Promise<T> {
    if (!isMetaWhatsAppConfigured(this.#env)) {
      throw new Error(
        "Meta WhatsApp Cloud API is not configured. Set META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, and META_VERIFY_TOKEN.",
      );
    }

    const endpoint = buildMessagesEndpoint(this.#env);
    const token = this.#env.META_ACCESS_TOKEN!;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let json: unknown;
    try {
      json = rawText ? (JSON.parse(rawText) as unknown) : null;
    } catch {
      json = null;
    }

    if (!response.ok) {
      const err = new Error(
        `Meta messages API returned ${response.status}: ${rawText || "no body"}`,
      );
      // Surface structured details for upstream error loggers / Sentry.
      (err as Error & { statusCode?: number; response?: unknown }).statusCode =
        response.status;
      (err as Error & { statusCode?: number; response?: unknown }).response =
        json;
      throw err;
    }

    return json as T;
  }

  /**
   * Production ready helper for the most common 90% case: sending a plain
   * text message to a WhatsApp user (`wa_id`).
   *
   * @param to        Recipient in Meta format (E.164 without leading '+',
   *                  e.g. "6282299112814"). Pass-through: the string is
   *                  forwarded to Meta as-is.
   * @param message   Plain text body (UTF-8, up to 4096 chars per Meta
   *                  limit — not enforced here; Meta will error above it).
   */
  async sendWhatsAppMessage(to: string, message: string): Promise<string> {
    const payload = this.buildTextMessage(to, message);
    const result = await this.sendRaw<MetaSendMessageResponse>(payload);
    const messageId = result.messages?.[0]?.id;
    if (!messageId) {
      throw new Error(
        `Meta messages API response did not include a message id: ${JSON.stringify(result)}`,
      );
    }
    return messageId;
  }

  async uploadMedia(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<string> {
    if (!isMetaWhatsAppConfigured(this.#env)) {
      throw new Error("Meta WhatsApp Cloud API is not configured.");
    }

    const version = this.#env.META_API_VERSION ?? "v20.0";
    const phoneNumberId = this.#env.META_PHONE_NUMBER_ID!;
    const endpoint = `${META_GRAPH_BASE}/${version}/${phoneNumberId}/media`;
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mimeType);
    form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.#env.META_ACCESS_TOKEN}` },
      body: form,
    });
    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`Meta media upload failed ${response.status}: ${rawText}`);
    }
    const json = JSON.parse(rawText) as { id?: string };
    if (!json.id) {
      throw new Error(`Meta media upload missing id: ${rawText}`);
    }
    return json.id;
  }

  async sendDocument(
    to: string,
    buffer: Buffer,
    filename: string,
    caption: string,
  ): Promise<string> {
    const mediaId = await this.uploadMedia(buffer, filename, "application/pdf");
    const result = await this.sendRaw<MetaSendMessageResponse>({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "document",
      document: { id: mediaId, filename, caption },
    });
    const messageId = result.messages?.[0]?.id;
    if (!messageId) {
      throw new Error("Meta document send missing message id");
    }
    return messageId;
  }

  async downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mimetype: string } | null> {
    if (!isMetaWhatsAppConfigured(this.#env)) return null;
    const version = this.#env.META_API_VERSION ?? "v20.0";
    const metaRes = await fetch(`${META_GRAPH_BASE}/${version}/${mediaId}`, {
      headers: { Authorization: `Bearer ${this.#env.META_ACCESS_TOKEN}` },
    });
    if (!metaRes.ok) return null;
    const metaJson = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!metaJson.url) return null;

    const fileRes = await fetch(metaJson.url, {
      headers: { Authorization: `Bearer ${this.#env.META_ACCESS_TOKEN}` },
    });
    if (!fileRes.ok) return null;
    const arrayBuffer = await fileRes.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimetype: metaJson.mime_type ?? "image/jpeg",
    };
  }

  /**
   * Safely dig through the deeply nested Meta webhook JSON envelope and
   * emit flat `messages[]` + `statuses[]` collections.
   *
   * Uses optional chaining everywhere. If an entry is malformed, it is
   * simply skipped rather than throwing — we never want a single rogue
   * payload to crash the webhook.
   */
  parseWebhookPayload(body: unknown): MetaParsedWebhook {
    const messages: MetaIncomingMessageEnvelope[] = [];
    const statuses: MetaStatusEnvelope[] = [];

    const payload = body as MetaWebhookPayload | null | undefined;
    if (!payload || !Array.isArray(payload?.entry)) {
      return { messages, statuses };
    }

    for (const entry of payload.entry) {
      if (!Array.isArray(entry?.changes)) continue;

      for (const change of entry.changes) {
        if (change?.field !== "messages") continue;
        const value = change?.value;
        if (!value) continue;

        const phoneNumberId = value.metadata?.phone_number_id ?? "";
        const displayPhoneNumber = value.metadata?.display_phone_number ?? "";
        const profileName =
          value.contacts?.[0]?.profile?.name ??
          value.contacts?.[0]?.wa_id ??
          null;

        if (Array.isArray(value.messages)) {
          for (const rawMessage of value.messages) {
            const waId = rawMessage?.from;
            const messageId = rawMessage?.id;
            const timestamp = rawMessage?.timestamp;
            const type = rawMessage?.type ?? "unknown";
            if (!waId || !messageId) continue;
            messages.push({
              waId,
              messageId,
              timestamp: timestamp ?? "0",
              body:
              rawMessage.text?.body ??
              (typeof (rawMessage as { image?: { caption?: string } }).image
                ?.caption === "string"
                ? (rawMessage as { image?: { caption?: string } }).image
                    ?.caption ?? null
                : null),
              type,
              phoneNumberId,
              displayPhoneNumber,
              profileName,
              raw: rawMessage,
            });
          }
        }

        if (Array.isArray(value.statuses)) {
          for (const rawStatus of value.statuses) {
            const messageId = rawStatus?.id;
            if (!messageId) continue;
            statuses.push({
              messageId,
              status: rawStatus.status ?? "unknown",
              timestamp: rawStatus.timestamp ?? "0",
              recipientId: rawStatus.recipient_id ?? "",
              phoneNumberId,
              raw: rawStatus,
            });
          }
        }
      }
    }

    return { messages, statuses };
  }
}
