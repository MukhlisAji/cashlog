import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuthenticatedRequest } from "./auth.middleware.js";
import { checkSubscription } from "./subscription.js";

export async function requireActiveSubscription(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { userId } = request as AuthenticatedRequest;
  const sub = await checkSubscription(userId);

  if (!sub.allowed) {
    return reply.code(403).send({
      success: false,
      error: "Langganan telah berakhir. Perpanjang untuk melanjutkan.",
      code: "SUBSCRIPTION_EXPIRED",
      data: sub,
    });
  }
}
