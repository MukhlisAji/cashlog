import type { FastifyInstance } from "fastify";

import type { Env } from "../../config/env.js";
import { isGoogleConfigured, getOAuthStateSecret } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../lib/auth.middleware.js";
import { authOnly } from "../../lib/prehandlers.js";
import { signOAuthState, verifyOAuthState, sanitizeOAuthReturnTo } from "../../lib/oauth-state.js";
import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
} from "./google-client.js";
import { saveGoogleTokens } from "./sheets-connection.service.js";
import { setupGoogleSheet, getSheetStatus } from "./sheets-setup.service.js";
import {
  GOOGLE_SCOPE_MISSING,
  GOOGLE_SCOPE_MISSING_MESSAGE,
  GoogleScopeMissingError,
  isGoogleInsufficientScopeError,
} from "./google-scope.js";
import { sendOnboardingTemplateToLeadIfReady } from "../whatsapp/wa-onboarding-template.service.js";
import { errorMessage, recordOpsEvent } from "../../lib/ops-events.js";

export async function sheetsRoutes(app: FastifyInstance, env: Env) {
  app.get(
    "/sheets/oauth/url",
    { preHandler: authOnly },
    async (request, reply) => {
      if (!isGoogleConfigured(env)) {
        return reply.code(503).send({
          success: false,
          error: "Google belum dikonfigurasi di server. Hubungi support.",
        });
      }

      const { userId } = request as AuthenticatedRequest;
      const returnTo = sanitizeOAuthReturnTo(
        (request.query as { returnTo?: string }).returnTo,
        "/ringkasan",
      );
      const state = signOAuthState(userId, getOAuthStateSecret(env), returnTo);

      return {
        success: true,
        data: { url: getGoogleAuthUrl(env, state) },
      };
    },
  );

  app.get("/sheets/oauth/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };

    if (query.error || !query.code || !query.state) {
      return reply.redirect(
        `${env.FRONTEND_URL}/ringkasan?sheet_error=oauth_denied`,
      );
    }

    const stateData = verifyOAuthState(query.state, getOAuthStateSecret(env));
    if (!stateData) {
      return reply.redirect(
        `${env.FRONTEND_URL}/ringkasan?sheet_error=invalid_state`,
      );
    }

    const userId = stateData.userId;
    const returnBase = sanitizeOAuthReturnTo(
      stateData.returnTo,
      "/ringkasan",
    );
    const successRedirect = `${env.FRONTEND_URL}${returnBase}${returnBase.includes("?") ? "&" : "?"}sheet=authorized`;
    const errorRedirect = (code: string) =>
      `${env.FRONTEND_URL}${returnBase}${returnBase.includes("?") ? "&" : "?"}sheet_error=${code}`;

    try {
      const tokens = await exchangeGoogleCode(env, query.code);
      if (!tokens.refresh_token) {
        return reply.redirect(errorRedirect("no_refresh_token"));
      }

      await saveGoogleTokens(userId, {
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token ?? undefined,
        expiry_date: tokens.expiry_date ?? undefined,
      });
      await setupGoogleSheet(env, userId);
      void sendOnboardingTemplateToLeadIfReady(env, userId);

      return reply.redirect(successRedirect.replace("sheet=authorized", "sheet=connected"));
    } catch (error) {
      request.log.error(error);
      void recordOpsEvent({
        kind: "sheet.setup",
        ok: false,
        userId,
        message: errorMessage(error),
      });
      if (
        error instanceof GoogleScopeMissingError ||
        isGoogleInsufficientScopeError(error)
      ) {
        return reply.redirect(
          `${env.FRONTEND_URL}/auth/connect-sheets?redirect=${encodeURIComponent(returnBase)}&scope=missing`,
        );
      }
      return reply.redirect(errorRedirect("setup_failed"));
    }
  });

  app.post(
    "/sheets/connect-token",
    { preHandler: authOnly },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      const body = request.body as {
        refresh_token?: string;
        access_token?: string;
        expires_at?: number;
      };

      if (!body.refresh_token?.trim()) {
        return reply.code(400).send({
          success: false,
          error: "Sesi Google tidak lengkap. Masuk ulang dengan Google.",
        });
      }

      try {
        await saveGoogleTokens(userId, {
          refresh_token: body.refresh_token.trim(),
          access_token: body.access_token,
          expiry_date: body.expires_at,
        });

        const status = await getSheetStatus(userId);
        return { success: true, data: status };
      } catch (error) {
        request.log.error(error);
        return reply.code(400).send({
          success: false,
          error: "Gagal menyimpan akun Google. Coba hubungkan ulang.",
        });
      }
    },
  );

  app.get(
    "/sheets/status",
    { preHandler: authOnly },
    async (request) => {
      const { userId } = request as AuthenticatedRequest;
      const status = await getSheetStatus(userId);
      return { success: true, data: status };
    },
  );

  app.post(
    "/sheets/setup",
    { preHandler: authOnly },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;

      try {
        const result = await setupGoogleSheet(env, userId);
        void sendOnboardingTemplateToLeadIfReady(env, userId);
        return { success: true, data: result };
      } catch (error) {
        request.log.error(error);
        void recordOpsEvent({
          kind: "sheet.setup",
          ok: false,
          userId,
          message: errorMessage(error),
        });
        if (
          error instanceof GoogleScopeMissingError ||
          isGoogleInsufficientScopeError(error)
        ) {
          return reply.code(409).send({
            success: false,
            code: GOOGLE_SCOPE_MISSING,
            error: GOOGLE_SCOPE_MISSING_MESSAGE,
          });
        }
        return reply.code(400).send({
          success: false,
          error: "Gagal membuat Google Sheet. Coba lagi.",
        });
      }
    },
  );
}
