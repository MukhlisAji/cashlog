import { normalizePhone } from "./whatsapp.utils.js";

/** Extract plain text from a Baileys message object */
export function extractMessageText(message: unknown): string | null {
  const msg = message as Record<string, Record<string, unknown>> | null;
  if (!msg?.message) return null;

  const m = msg.message;

  if (typeof m.conversation === "string" && m.conversation.trim()) {
    return m.conversation.trim();
  }

  const ext = m.extendedTextMessage as { text?: string } | undefined;
  if (ext?.text?.trim()) return ext.text.trim();

  const image = m.imageMessage as { caption?: string } | undefined;
  if (image?.caption?.trim()) return image.caption.trim();

  const video = m.videoMessage as { caption?: string } | undefined;
  if (video?.caption?.trim()) return video.caption.trim();

  return null;
}

/** True if message contains an image (with or without caption) */
export function hasImageMessage(message: unknown): boolean {
  const msg = message as { message?: { imageMessage?: unknown } } | null;
  return !!msg?.message?.imageMessage;
}

function jidToPhone(jid: string): string {
  return jid.split("@")[0].split(":")[0].replace(/\D/g, "");
}

function isSelfChatJid(remoteJid: string, userPhone: string): boolean {
  const jidPhone = jidToPhone(remoteJid);
  const normalized = normalizePhone(userPhone);
  return jidPhone === normalized;
}

export interface WaMessageKeyInfo {
  id?: string | null;
  remoteJid?: string | null;
  remoteJidAlt?: string | null;
  participant?: string | null;
  fromMe?: boolean;
}

export function extractMessageKeyInfo(message: unknown): WaMessageKeyInfo {
  const msg = message as { key?: WaMessageKeyInfo } | null;
  return msg?.key ?? {};
}

export type WaMessageSkipReason =
  | "no_remote_jid"
  | "group"
  | "newsletter"
  | "status_broadcast"
  | "incoming_dm"
  | "not_self_chat";

export interface WaSelfChatIdentity {
  phone: string;
  waUserId?: string | null;
  waLid?: string | null;
}

/**
 * Returns null when the message should be processed.
 */
export function getWhatsAppMessageSkipReason(
  message: unknown,
  identity: WaSelfChatIdentity,
): WaMessageSkipReason | null {
  const key = extractMessageKeyInfo(message);
  const remoteJid = key.remoteJid;
  if (!remoteJid) return "no_remote_jid";

  if (remoteJid.endsWith("@g.us")) return "group";
  if (remoteJid.endsWith("@newsletter")) return "newsletter";
  if (remoteJid === "status@broadcast") return "status_broadcast";

  const fromMe = key.fromMe ?? false;

  // Ignore all incoming DMs from other numbers
  if (!fromMe) return "incoming_dm";

  if (isSelfChatJid(remoteJid, identity.phone)) return null;

  if (identity.waUserId && remoteJid === identity.waUserId) return null;
  if (identity.waLid && remoteJid === identity.waLid) return null;

  const alt = key.remoteJidAlt;
  if (alt && isSelfChatJid(alt, identity.phone)) return null;
  if (alt && identity.waUserId && alt === identity.waUserId) return null;

  return "not_self_chat";
}

/**
 * Process self-chat only (user → nomor WA sendiri).
 * Skips groups, status, newsletters, and all DMs from other numbers.
 *
 * Note: bot replies in self-chat also have fromMe=true — those are filtered
 * separately via waMessageDedup (outbound message ID tracking).
 */
export function shouldProcessWhatsAppMessage(
  message: unknown,
  userPhone: string,
  identity?: Partial<WaSelfChatIdentity>,
): boolean {
  return (
    getWhatsAppMessageSkipReason(message, {
      phone: userPhone,
      waUserId: identity?.waUserId,
      waLid: identity?.waLid,
    }) === null
  );
}
