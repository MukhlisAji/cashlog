import type { FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

import type { Env } from "../config/env.js";
import { isMetaWhatsAppConfigured } from "../config/env.js";

export const PUBLIC_JOIN_RATE_LIMIT = {
  max: 20,
  timeWindow: "1 minute" as const,
};

export const WEBHOOK_RATE_LIMIT = {
  max: 120,
  timeWindow: "1 minute" as const,
};

export async function registerSecurityPlugins(
  app: FastifyInstance,
  env: Env,
): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    ban: env.NODE_ENV === "production" ? 3 : 0,
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
    errorResponseBuilder: (_request, context) => ({
      success: false,
      error: "Terlalu banyak permintaan. Coba lagi sebentar.",
      code: "RATE_LIMITED",
      retryAfter: context.after,
    }),
  });
}

export function assertProductionSecurity(env: Env): void {
  if (env.NODE_ENV !== "production") return;

  const issues: string[] = [];

  if (
    env.CORS_ORIGIN.includes("localhost") ||
    env.FRONTEND_URL.includes("localhost")
  ) {
    issues.push("CORS_ORIGIN / FRONTEND_URL masih localhost di production");
  }

  if (!env.OAUTH_STATE_SECRET || env.OAUTH_STATE_SECRET.length < 32) {
    issues.push("OAUTH_STATE_SECRET wajib minimal 32 karakter di production");
  }

  if (isMetaWhatsAppConfigured(env) && !env.META_APP_SECRET) {
    issues.push(
      "META_APP_SECRET wajib di production untuk verifikasi webhook Meta",
    );
  }

  if (issues.length > 0) {
    throw new Error(
      `Production security check failed:\n- ${issues.join("\n- ")}`,
    );
  }
}
