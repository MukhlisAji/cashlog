/** TTL for bot-sent message IDs (skip re-processing our own replies in self-chat) */
const OUTBOUND_TTL_MS = 60_000;

/** TTL for recently handled inbound IDs (reconnect / duplicate upsert) */
const PROCESSED_TTL_MS = 30_000;

/**
 * Tracks outbound bot messages and recently processed inbound IDs per user.
 * Prevents infinite loops in self-chat where user and bot messages both have fromMe=true.
 */
class WaMessageDedup {
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

  /** Returns false if this inbound message was already handled. */
  markProcessed(userId: string, messageId: string | undefined | null): boolean {
    if (!messageId) return true;

    const set = this.processed.get(userId) ?? new Set<string>();
    if (set.has(messageId)) return false;

    this.addWithTtl(this.processed, userId, messageId, PROCESSED_TTL_MS);
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

export const waMessageDedup = new WaMessageDedup();
