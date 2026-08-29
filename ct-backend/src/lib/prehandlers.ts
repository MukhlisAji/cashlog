import { authenticate } from "./auth.middleware.js";
import type { AuthenticatedRequest } from "./auth.middleware.js";
import { requireActiveSubscription } from "./subscription.middleware.js";
import type { FastifyReply, FastifyRequest } from "fastify";

import { isAdminEmail, type Env } from "../config/env.js";

/** Authenticated + active subscription required */
export const authWithSubscription = [authenticate, requireActiveSubscription];

/** Authenticated only (e.g. subscription status for expired users) */
export const authOnly = [authenticate];

export function requireAdmin(env: Env) {
  return async function adminGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const email = (request as AuthenticatedRequest).userEmail;
    if (!isAdminEmail(env, email)) {
      return reply.code(403).send({
        success: false,
        error: "Halaman ini hanya untuk admin.",
        code: "FORBIDDEN",
      });
    }
  };
}

export function authAdmin(env: Env) {
  return [authenticate, requireAdmin(env)];
}
