import { getSupabaseAdmin } from "../../lib/supabase.js";

const OUTBOUND_TTL_MS = 60_000;
/** Meta retries the same wamid for hours; 10m was shorter than their retry gap. */
const PROCESSED_TTL_MS = 24 * 60 * 60 * 1000;

class WaMessageDedupMemory {
  private outbound = new Map<string, Set<string>>();
  private processed = new Map<string, Set<string>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  trackOutbound(userId: string, messageId: string | undefined | null): void {
    if (!messageId) return;
    this.addWithTtl(this.outbound, userId, messageId, OUTBOUND_TTL_MS);
  }

  isBotOutbound(userId: string, messageId: string | undefined | null): boolean {
    if (!messageId) return false;
    return this.outbound.get(userId)?.has(messageId) ?? false;
  }

  markProcessedLocal(scope: string, messageId: string): boolean {
    const set = this.processed.get(scope) ?? new Set<string>();
    if (set.has(messageId)) return false;
    this.addWithTtl(this.processed, scope, messageId, PROCESSED_TTL_MS);
    return true;
  }

  private addWithTtl(
    store: Map<string, Set<string>>,
    userId: string,
    messageId: string,
    ttlMs: number,
  ): void {
    let set = store.get(userId);
    if (!set) {
      set = new Set();
      store.set(userId, set);
    }
    set.add(messageId);

    const timerKey = `${userId}:${messageId}`;
    const existing = this.timers.get(timerKey);
    if (existing) clearTimeout(existing);

    this.timers.set(
      timerKey,
      setTimeout(() => {
        store.get(userId)?.delete(messageId);
        this.timers.delete(timerKey);
      }, ttlMs),
    );
  }
}

export const waMessageDedup = new WaMessageDedupMemory();

/**
 * Claim an inbound WhatsApp message id. Returns false if already processed
 * (Meta retry / process restart). Persists to `processed_wa_messages`.
 */
export async function claimInboundWaMessage(
  messageId: string | undefined | null,
): Promise<boolean> {
  if (!messageId) return true;
  if (!waMessageDedup.markProcessedLocal("in", messageId)) return false;

  const supabase = getSupabaseAdmin();
  if (!supabase) return true;

  const { error } = await supabase
    .from("processed_wa_messages")
    .insert({ message_id: messageId });

  if (error?.code === "23505") return false;
  if (error) {
    console.error("[wa-dedup] persist failed", error.message);
    // Local claim already held for PROCESSED_TTL_MS so Meta retries still skip.
    return true;
  }
  return true;
}

function jakartaHourBucket(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}`;
}

/** At most one "nomor belum terdaftar" reply per WA number per Jakarta hour. */
export async function claimUnregisteredNotice(waId: string): Promise<boolean> {
  const phone = waId.replace(/\D/g, "");
  if (!phone) return false;
  return claimInboundWaMessage(`unreg:${phone}:${jakartaHourBucket()}`);
}
