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
  // Same handler under /api for reverse proxies that only forward /api/*.
  await app.register(
    async (instance) =>
      metaWebhookRoutes(instance, {
        env,
        onMessage: (msg) => handleMetaIncomingMessage(env, msg),
      }),
    {
      prefix: "/api/meta",
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
