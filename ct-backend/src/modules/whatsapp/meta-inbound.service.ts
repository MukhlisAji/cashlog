import type { Env } from "../../config/env.js";
import { errorMessage, recordOpsEvent } from "../../lib/ops-events.js";
import type { MetaIncomingMessageEnvelope } from "./meta-cloud.service.js";
import { getMetaService } from "./meta-outbound.service.js";
import { claimInboundWaMessage } from "./wa-message-dedup.js";
import { routeIncomingWhatsAppMessage } from "./wa-router.service.js";

export async function handleMetaIncomingMessage(
  env: Env,
  msg: MetaIncomingMessageEnvelope,
): Promise<void> {
  const claimed = await claimInboundWaMessage(msg.messageId);
  if (!claimed) {
    console.warn("[wa-inbound] duplicate skipped", msg.messageId);
    return;
  }

  console.warn(
    "[wa-inbound]",
    msg.waId,
    msg.type,
    msg.messageId,
    (msg.body ?? "").slice(0, 80),
  );
  try {
    await routeIncomingWhatsAppMessage(env, getMetaService(), msg);
  } catch (error) {
    console.error("[wa-inbound] router failed", error);
    void recordOpsEvent({
      kind: "inbound",
      ok: false,
      message: errorMessage(error),
    });
  }
}
