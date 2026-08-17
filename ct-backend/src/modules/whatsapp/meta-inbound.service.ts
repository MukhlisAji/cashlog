import type { Env } from "../../config/env.js";
import { checkSubscription } from "../../lib/subscription.js";
import { householdRepository } from "../household/household.repository.js";
import { processWhatsAppMessage } from "../parser/message-handler.service.js";
import type { MetaIncomingMessageEnvelope } from "./meta-cloud.service.js";
import { getMetaService } from "./meta-outbound.service.js";

function toParserMessage(msg: MetaIncomingMessageEnvelope): unknown {
  const image = msg.raw.image as { id?: string; caption?: string } | undefined;
  if (msg.type === "image" && image?.id) {
    return {
      message: {
        imageMessage: {
          id: image.id,
          caption: image.caption ?? msg.body ?? "",
        },
      },
    };
  }

  return {
    message: {
      conversation: msg.body ?? "",
    },
  };
}

export async function handleMetaIncomingMessage(
  env: Env,
  msg: MetaIncomingMessageEnvelope,
): Promise<void> {
  const ctx = await householdRepository.getActiveByPhone(msg.waId);
  if (!ctx) return;

  const sub = await checkSubscription(ctx.leadUserId);
  if (!sub.allowed) {
    await getMetaService().sendWhatsAppMessage(
      msg.waId,
      "⚠️ Akun kamu tidak aktif. Buka dashboard cashlog.id untuk info langganan.",
    );
    return;
  }

  const meta = getMetaService();
  const result = await processWhatsAppMessage(
    env,
    ctx,
    toParserMessage(msg),
    async (message) => {
      const parsed = message as {
        message?: { imageMessage?: { id?: string } };
      };
      const mediaId = parsed.message?.imageMessage?.id;
      if (!mediaId) return null;
      return meta.downloadMedia(mediaId);
    },
  );

  if (result.reply) {
    await meta.sendWhatsAppMessage(msg.waId, result.reply);
  }
}
