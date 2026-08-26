import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { Env } from "../../config/env.js";
import { isGoogleConfigured } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../lib/auth.middleware.js";
import { authOnly, authWithSubscription } from "../../lib/prehandlers.js";
import {
  ensureLeadHousehold,
  setLeadWhatsAppPhone,
} from "../household/household.service.js";
import { householdRepository } from "../household/household.repository.js";
import {
  GOOGLE_SCOPE_MISSING,
  GOOGLE_SCOPE_MISSING_MESSAGE,
  GoogleScopeMissingError,
  isGoogleInsufficientScopeError,
} from "../sheets/google-scope.js";
import {
  getSheetStatus,
  setupGoogleSheet,
} from "../sheets/sheets-setup.service.js";
import { createWhatsAppLinkCode } from "./wa-link-code.service.js";
import { sendOnboardingTemplateToLeadIfReady } from "./wa-onboarding-template.service.js";
import { parseIndonesianPhone } from "./whatsapp.utils.js";

const registerPhoneSchema = z.object({
  phone: z.string().min(1).max(20),
});

export async function whatsappRoutes(app: FastifyInstance, env: Env) {
  app.post(
    "/whatsapp/phone",
    { preHandler: authWithSubscription },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      const parsed = registerPhoneSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: "Nomor WhatsApp tidak valid",
        });
      }

      const phoneResult = parseIndonesianPhone(parsed.data.phone);
      if (!phoneResult.ok) {
        return reply.code(400).send({
          success: false,
          error: phoneResult.error,
        });
      }

      const sheet = await getSheetStatus(userId);
      if (!sheet.connected && !isGoogleConfigured(env)) {
        return reply.code(503).send({
          success: false,
          error: "Google OAuth belum dikonfigurasi di server.",
        });
      }

      const result = await setLeadWhatsAppPhone(userId, phoneResult.data.phone);
      if (!result.ok) {
        return reply.code(400).send({ success: false, error: result.error });
      }

      const consentPath = "/auth/connect-sheets?redirect=/settings";

      if (!sheet.connected) {
        return {
          success: true,
          data: {
            phone: result.data.phone,
            status: "connected",
            requiresGoogleAuth: true,
            consentPath,
          },
        };
      }

      try {
        const spreadsheet = await setupGoogleSheet(env, userId);
        void sendOnboardingTemplateToLeadIfReady(env, userId);
        return {
          success: true,
          data: {
            phone: result.data.phone,
            status: "connected",
            requiresGoogleAuth: false,
            spreadsheetUrl: spreadsheet.spreadsheetUrl,
          },
        };
      } catch (error) {
        if (
          error instanceof GoogleScopeMissingError ||
          isGoogleInsufficientScopeError(error)
        ) {
          return reply.code(409).send({
            success: false,
            code: GOOGLE_SCOPE_MISSING,
            error: GOOGLE_SCOPE_MISSING_MESSAGE,
            data: {
              phone: result.data.phone,
              requiresGoogleAuth: true,
              consentPath,
            },
          });
        }
        request.log.error(error);
        return reply.code(500).send({
          success: false,
          error: "Gagal membuat Google Sheet.",
        });
      }
    },
  );

  app.post(
    "/whatsapp/link-code",
    { preHandler: authWithSubscription },
    async (request) => {
      const { userId } = request as AuthenticatedRequest;
      const data = await createWhatsAppLinkCode(userId);
      return { success: true, data: { ...data, requiresGoogleAuth: false } };
    },
  );

  app.get(
    "/whatsapp/status",
    { preHandler: authOnly },
    async (request) => {
      const { userId } = request as AuthenticatedRequest;
      await ensureLeadHousehold(userId);
      const phone = await householdRepository.getLeadPhone(userId);

      return {
        success: true,
        data: {
          memberId: userId,
          phone: phone ?? "",
          status: phone ? "connected" : "idle",
        },
      };
    },
  );
}
