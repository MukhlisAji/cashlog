import type { Env } from "../../config/env.js";
import { BRAND_NAME } from "../../config/brand.js";
import { getNowJakarta } from "../../lib/datetime-jakarta.js";
import { checkSubscription } from "../../lib/subscription.js";
import {
  categoriesRepository,
  googleConnectionRepository,
  userConfigRepository,
} from "../config/config.repository.js";
import { fetchAnalyticsData } from "../sheets/sheet-data.service.js";
import { householdRepository } from "../household/household.repository.js";
import { sendDocumentToHousehold } from "../whatsapp/meta-outbound.service.js";
import { recordOpsEvent, errorMessage } from "../../lib/ops-events.js";
import { formatMonthLabel } from "../whatsapp/wa-sheet-queries.js";
import { computeAnalyticsInsights } from "./analytics-insights.js";
import { buildCategoryColorMap } from "./analytics-colors.js";
import { buildAnalyticsReportHtml, type ReportKind } from "./report-html.js";
import { htmlToPdfBuffer } from "./report-pdf.js";

export interface ReportTarget {
  kind: ReportKind;
  month: string;
  reportKey: string;
  asOfDate?: string;
}

export function resolveWeeklyReportTarget(jakartaDate: string): ReportTarget {
  const month = jakartaDate.slice(0, 7);
  return {
    kind: "weekly",
    month,
    reportKey: `weekly:${jakartaDate}`,
    asOfDate: jakartaDate,
  };
}

/** Previous calendar month (for sending on the 1st). */
export function resolveMonthlyReportTarget(jakartaDate: string): ReportTarget {
  const year = Number(jakartaDate.slice(0, 4));
  const monthNum = Number(jakartaDate.slice(5, 7));
  const prev = new Date(Date.UTC(year, monthNum - 2, 1));
  const month = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    kind: "monthly",
    month,
    reportKey: `monthly:${month}`,
  };
}

function buildReportCaption(kind: ReportKind, month: string): string {
  const label = formatMonthLabel(month);
  if (kind === "monthly") {
    return [
      `📊 *Laporan Analitik ${BRAND_NAME}* — ${label}`,
      "",
      "Ringkasan bulan penuh: angka, chart, budget, dan rekomendasi keuangan keluarga ada di PDF.",
      "",
      BRAND_NAME,
    ].join("\n");
  }

  if (kind === "weekly") {
    return [
      `📊 *Laporan Mingguan ${BRAND_NAME}* — ${label}`,
      "",
      "Ringkasan keuangan minggu ini: angka, chart, budget, dan rekomendasi ada di PDF.",
      "",
      BRAND_NAME,
    ].join("\n");
  }

  return [
    `📊 *Laporan Analitik ${BRAND_NAME}* — ${label}`,
    "",
    "Progress pertengahan bulan: burn rate, proyeksi, dan insight keuangan keluarga ada di PDF.",
    "",
    "cashlog.id",
  ].join("\n");
}

function buildReportFilename(kind: ReportKind, month: string, reportKey: string): string {
  const slug = month.replace("-", "");
  if (kind === "monthly") return `cashlog-analitik-${slug}-bulanan.pdf`;
  if (kind === "weekly") {
    const day = reportKey.replace("weekly:", "").replace(/-/g, "");
    return `cashlog-analitik-${day || slug}-mingguan.pdf`;
  }
  return `cashlog-analitik-${slug}-progress.pdf`;
}

function formatGeneratedAt(): string {
  const now = new Date();
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

export async function generateAnalyticsReportPdf(
  env: Env,
  userId: string,
  target: ReportTarget,
): Promise<Buffer | null> {
  const connection = await googleConnectionRepository.getByUserId(userId);
  if (!connection?.spreadsheet_id) return null;

  const data = await fetchAnalyticsData(
    env,
    userId,
    connection.spreadsheet_id,
    target.month,
  );

  if (data.summary.transactionCount === 0) return null;

  const categories = await categoriesRepository.listByUser(userId);
  const activeNames = new Set(categories.map((c) => c.name));
  const colorMap = buildCategoryColorMap(categories);

  const filteredData = {
    ...data,
    categoryTotals: data.categoryTotals.filter((row) => row.amount > 0),
    budgets: data.budgets.filter((b) => activeNames.has(b.category)),
  };

  const insights = computeAnalyticsInsights(
    filteredData,
    data.allTransactions,
    { asOfDate: target.asOfDate },
  );

  const html = buildAnalyticsReportHtml({
    data: filteredData,
    insights,
    colorMap,
    kind: target.kind,
    generatedAt: formatGeneratedAt(),
  });

  return htmlToPdfBuffer(html);
}

export async function sendAnalyticsReportToUser(
  env: Env,
  userId: string,
  target: ReportTarget,
): Promise<boolean> {
  const sub = await checkSubscription(userId);
  if (!sub.canAccessAnalytics) return false;

  const isMonthly = target.kind === "monthly";
  const alreadySent = isMonthly
    ? await userConfigRepository.getLastMonthlyReportKey(userId)
    : await userConfigRepository.getLastAnalyticsReportKey(userId);
  if (alreadySent === target.reportKey) return false;

  let pdf: Buffer | null;
  try {
    pdf = await generateAnalyticsReportPdf(env, userId, target);
  } catch (error) {
    console.error({ userId, error, target }, "[analytics-report] PDF generation failed");
    void recordOpsEvent({
      kind: "pdf.generate",
      ok: false,
      userId,
      message: errorMessage(error),
    });
    return false;
  }

  if (!pdf) {
    void recordOpsEvent({
      kind: "pdf.generate",
      ok: false,
      userId,
      message: "empty (no sheet or no transactions)",
    });
    return false;
  }

  void recordOpsEvent({
    kind: "pdf.generate",
    ok: true,
    userId,
    message: target.kind,
  });

  const household = await householdRepository.getByLeadUserId(userId);
  const includeMembers = isMonthly
    ? household?.notify_members_monthly === true
    : household?.notify_members_weekly === true;

  const caption = buildReportCaption(target.kind, target.month);
  const filename = buildReportFilename(target.kind, target.month, target.reportKey);

  const sent = await sendDocumentToHousehold(
    userId,
    pdf,
    filename,
    caption,
    includeMembers,
  );
  if (sent) {
    if (isMonthly) {
      await userConfigRepository.setLastMonthlyReportKey(userId, target.reportKey);
    } else {
      await userConfigRepository.setLastAnalyticsReportKey(userId, target.reportKey);
    }
    void recordOpsEvent({
      kind: "pdf.send",
      ok: true,
      userId,
      message: target.kind,
    });
  } else {
    void recordOpsEvent({
      kind: "pdf.send",
      ok: false,
      userId,
      message: target.kind,
    });
  }
  return sent;
}

export async function runScheduledAnalyticsReports(
  env: Env,
  target: ReportTarget,
): Promise<void> {
  const userIds = await householdRepository.listLeadUserIdsWithPhone();

  for (const userId of userIds) {
    try {
      await sendAnalyticsReportToUser(env, userId, target);
    } catch (error) {
      console.error(
        { userId, error, target },
        "[analytics-report] failed for user",
      );
    }
  }
}

export function isMondayJakarta(weekday: string): boolean {
  return weekday === "Mon" || weekday.startsWith("Mon");
}

export function getReportTargetForToday(): ReportTarget | null {
  const { date } = getNowJakarta();
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
  }).format(new Date());
  if (!isMondayJakarta(weekday)) return null;
  return resolveWeeklyReportTarget(date);
}

export function getMonthlyReportTargetForToday(): ReportTarget | null {
  const { date } = getNowJakarta();
  if (!date.endsWith("-01")) return null;
  return resolveMonthlyReportTarget(date);
}
