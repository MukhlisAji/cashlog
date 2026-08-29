import type { FastifyInstance } from "fastify";

import type { Env } from "../../config/env.js";
import type { AuthenticatedRequest } from "../../lib/auth.middleware.js";
import { authOnly, authWithSubscription } from "../../lib/prehandlers.js";
import {
  budgetsRepository,
  categoriesRepository,
  userConfigRepository,
} from "../config/config.repository.js";
import { fetchAnalyticsData, fetchDashboardData } from "../sheets/sheet-data.service.js";
import { getSheetStatus } from "../sheets/sheets-setup.service.js";
import { householdRepository } from "../household/household.repository.js";
import { ensureLeadHousehold } from "../household/household.service.js";
import { checkSubscription } from "../../lib/subscription.js";
import { recordOpsEvent } from "../../lib/ops-events.js";
import {
  generateAnalyticsReportPdf,
  type ReportTarget,
} from "../analytics-report/analytics-report.service.js";

export async function dashboardRoutes(app: FastifyInstance, env: Env) {
  app.get(
    "/dashboard",
    { preHandler: authOnly },
    async (request) => {
      const { userId } = request as AuthenticatedRequest;

      await ensureLeadHousehold(userId);
      const [sheetStatus, leadPhone, activeMonth] = await Promise.all([
        getSheetStatus(userId),
        householdRepository.getLeadPhone(userId),
        userConfigRepository.getActiveMonth(userId),
      ]);

      let summary = null;
      let recentTransactions: Awaited<
        ReturnType<typeof fetchDashboardData>
      >["recentTransactions"] = [];
      let categoryTotals: Awaited<
        ReturnType<typeof fetchDashboardData>
      >["categoryTotals"] = [];

      if (sheetStatus.spreadsheetId) {
        try {
          const data = await fetchDashboardData(
            env,
            userId,
            sheetStatus.spreadsheetId,
          );
          summary = data.summary;
          recentTransactions = data.recentTransactions;
          categoryTotals = data.categoryTotals;
        } catch (error) {
          request.log.error(error);
        }
      }

      const [allBudgets, activeCategories] = await Promise.all([
        budgetsRepository.listByMonth(userId, activeMonth),
        categoriesRepository.listByUser(userId),
      ]);
      const activeNames = new Set(activeCategories.map((c) => c.name));
      const budgets = allBudgets.filter((b) => activeNames.has(b.category));

      return {
        success: true,
        data: {
          sheet: sheetStatus,
          whatsapp: {
            connected: Boolean(leadPhone),
            phone: leadPhone,
            status: leadPhone ? "connected" : "idle",
          },
          summary,
          recentTransactions,
          categoryTotals,
          budgets,
          hasTransactions: recentTransactions.length > 0,
        },
      };
    },
  );

  app.get(
    "/dashboard/analytics",
    { preHandler: authWithSubscription },
    async (request) => {
      const { userId } = request as AuthenticatedRequest;
      const month =
        (request.query as { month?: string }).month ?? undefined;

      const sheetStatus = await getSheetStatus(userId);

      if (!sheetStatus.spreadsheetId) {
        return {
          success: true,
          data: null,
        };
      }

      try {
        const data = await fetchAnalyticsData(
          env,
          userId,
          sheetStatus.spreadsheetId,
          month,
        );

        const sub = await checkSubscription(userId);
        if (!sub.canAccessAnalytics) {
          return {
            success: false,
            error: "Analitik Pro diperlukan",
            code: "PRO_REQUIRED",
          };
        }

        return { success: true, data };
      } catch (error) {
        request.log.error(error);
        return {
          success: false,
          error: "Gagal memuat data analitik",
        };
      }
    },
  );

  app.get(
    "/dashboard/analytics/export",
    { preHandler: authWithSubscription },
    async (request, reply) => {
      const { userId } = request as AuthenticatedRequest;
      const month =
        (request.query as { month?: string }).month ?? undefined;

      const sub = await checkSubscription(userId);
      if (!sub.canAccessAnalytics) {
        return reply.status(403).send({
          success: false,
          error: "Analitik Pro diperlukan",
          code: "PRO_REQUIRED",
        });
      }

      const sheetStatus = await getSheetStatus(userId);
      if (!sheetStatus.spreadsheetId) {
        return reply.status(400).send({
          success: false,
          error: "Google Sheet belum terhubung",
        });
      }

      const targetMonth =
        month ?? (await userConfigRepository.getActiveMonth(userId));

      const target: ReportTarget = {
        kind: "monthly",
        month: targetMonth,
        reportKey: `export:${targetMonth}`,
      };

      try {
        const pdf = await generateAnalyticsReportPdf(env, userId, target);
        if (!pdf) {
          void recordOpsEvent({
            kind: "pdf.export",
            ok: false,
            userId,
            message: "empty",
          });
          return reply.status(404).send({
            success: false,
            error: "Belum ada transaksi untuk bulan ini",
          });
        }

        void recordOpsEvent({
          kind: "pdf.export",
          ok: true,
          userId,
          message: targetMonth,
        });

        const filename = `cashlog-analitik-${targetMonth.replace("-", "")}-bulanan.pdf`;
        return reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .send(pdf);
      } catch (error) {
        request.log.error(error);
        void recordOpsEvent({
          kind: "pdf.export",
          ok: false,
          userId,
          message: error instanceof Error ? error.message : String(error),
        });
        return reply.status(500).send({
          success: false,
          error: "Gagal membuat PDF",
        });
      }
    },
  );
}
