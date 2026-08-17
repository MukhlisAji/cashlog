import Fastify from "fastify";
import cors from "@fastify/cors";

import type { Env } from "./config/env.js";
import { initSupabase } from "./lib/supabase.js";
import {
  assertProductionSecurity,
  registerSecurityPlugins,
} from "./lib/security.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { categoriesRoutes } from "./modules/config/categories.routes.js";
import { budgetsRoutes } from "./modules/config/budgets.routes.js";
import { subscriptionRoutes } from "./modules/subscription/subscription.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { sheetsRoutes } from "./modules/sheets/sheets.routes.js";
import { handleMetaIncomingMessage } from "./modules/whatsapp/meta-inbound.service.js";
import { initMetaOutbound } from "./modules/whatsapp/meta-outbound.service.js";
import { householdRoutes } from "./modules/household/household.routes.js";
import { whatsappRoutes } from "./modules/whatsapp/whatsapp.routes.js";
import { metaWebhookRoutes } from "./modules/whatsapp/meta-webhook.routes.js";

export async function buildApp(env: Env) {
  assertProductionSecurity(env);

  const app = Fastify({
    trustProxy: env.TRUST_PROXY,
    logger: {
      level: env.NODE_ENV === "development" ? "info" : "warn",
    },
  });

  initSupabase(env);
  initMetaOutbound(env);

  await registerSecurityPlugins(app, env);

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // #region debug-point A:budgets-cors-report-helper
  const reportBudgetsCorsDebug = async (
    hypothesisId: string,
    location: string,
    msg: string,
    data: Record<string, unknown>,
  ) => {
    let debugServerUrl = "http://127.0.0.1:7777/event";
    let debugSessionId = "budgets-cors-error";
    try {
      const { readFileSync } = await import("node:fs");
      const envText = readFileSync(".dbg/budgets-cors-error.env", "utf8");
      debugServerUrl =
        envText.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() ?? debugServerUrl;
      debugSessionId =
        envText.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() ?? debugSessionId;
    } catch {
      // ignore debug reporting setup errors
    }

    void fetch(debugServerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: debugSessionId,
        runId: "pre-fix",
        hypothesisId,
        location,
        msg: `[DEBUG] ${msg}`,
        data,
        ts: Date.now(),
      }),
    }).catch(() => {});
  };
  // #endregion

  app.addHook("onRequest", async (request) => {
    if (!request.url.startsWith("/api/budgets")) return;
    // #region debug-point A:budgets-request
    await reportBudgetsCorsDebug(
      "A",
      "src/app.ts:onRequest",
      "budgets request received",
      {
        method: request.method,
        url: request.url,
        origin: request.headers.origin ?? null,
        accessControlRequestMethod:
          request.headers["access-control-request-method"] ?? null,
        accessControlRequestHeaders:
          request.headers["access-control-request-headers"] ?? null,
        hasAuthorization: !!request.headers.authorization,
      },
    );
    // #endregion
  });

  app.addHook("onResponse", async (request, reply) => {
    if (!request.url.startsWith("/api/budgets")) return;
    // #region debug-point B:budgets-response
    await reportBudgetsCorsDebug(
      "B",
      "src/app.ts:onResponse",
      "budgets response sent",
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        origin: request.headers.origin ?? null,
        allowOrigin: reply.getHeader("access-control-allow-origin") ?? null,
        allowCredentials:
          reply.getHeader("access-control-allow-credentials") ?? null,
        allowMethods: reply.getHeader("access-control-allow-methods") ?? null,
        allowHeaders: reply.getHeader("access-control-allow-headers") ?? null,
      },
    );
    // #endregion
  });

  await app.register(healthRoutes, { prefix: "/api" });
  // Meta WhatsApp Cloud API webhook. Intentionally OUTSIDE the /api prefix
  // so it never collides with the authed /api/* routes and can be
  // addressed directly at /meta/webhook from Meta's dashboard.
  await app.register(
    async (instance) =>
      metaWebhookRoutes(instance, {
        env,
        onMessage: (msg) => handleMetaIncomingMessage(env, msg),
      }),
    {
      prefix: "/meta",
    },
  );
  await app.register(async (instance) => authRoutes(instance, env), {
    prefix: "/api",
  });
  await app.register(async (instance) => householdRoutes(instance, env), {
    prefix: "/api",
  });
  await app.register(async (instance) => whatsappRoutes(instance, env), {
    prefix: "/api",
  });
  await app.register(async (instance) => sheetsRoutes(instance, env), {
    prefix: "/api",
  });
  await app.register(async (instance) => dashboardRoutes(instance, env), {
    prefix: "/api",
  });
  await app.register(async (instance) => subscriptionRoutes(instance, env), {
    prefix: "/api",
  });
  await app.register(async (instance) => categoriesRoutes(instance), {
    prefix: "/api",
  });
  await app.register(async (instance) => budgetsRoutes(instance), {
    prefix: "/api",
  });

  return app;
}
