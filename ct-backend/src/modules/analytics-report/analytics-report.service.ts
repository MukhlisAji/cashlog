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
import { sendDocumentToLeadUser } from "../whatsapp/meta-outbound.service.js";
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

export function resolveReportTarget(
  dayOfMonth: number,
  jakartaDate: string,
): ReportTarget | null {
  const currentMonth = jakartaDate.slice(0, 7);

  if (dayOfMonth === 1) {
    const [y, m] = currentMonth.split("-").map(Number);
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    return {
      kind: "monthly",
      month: prev,
      reportKey: `monthly:${prev}`,
    };
  }

  if (dayOfMonth === 15) {
    return {
      kind: "midmonth",
      month: currentMonth,
      reportKey: `midmonth:${currentMonth}`,
      asOfDate: jakartaDate,
    };
  }

  return null;
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

  return [
    `📊 *Laporan Analitik ${BRAND_NAME}* — ${label}`,
    "",
    "Progress pertengahan bulan: burn rate, proyeksi, dan insight keuangan keluarga ada di PDF.",
    "",
    "cashlog.id",
  ].join("\n");
}

function buildReportFilename(kind: ReportKind, month: string): string {
  const slug = month.replace("-", "");
  return kind === "monthly"
    ? `cashlog-analitik-${slug}-bulanan.pdf`
    : `cashlog-analitik-${slug}-progress.pdf`;
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

  const alreadySent = await userConfigRepository.getLastAnalyticsReportKey(userId);
  if (alreadySent === target.reportKey) return false;

  let pdf: Buffer | null;
  try {
    pdf = await generateAnalyticsReportPdf(env, userId, target);
  } catch (error) {
    console.error({ userId, error, target }, "[analytics-report] PDF generation failed");
    return false;
  }

  if (!pdf) return false;

  const caption = buildReportCaption(target.kind, target.month);
  const filename = buildReportFilename(target.kind, target.month);

  const sent = await sendDocumentToLeadUser(userId, pdf, filename, caption);
  if (sent) {
    await userConfigRepository.setLastAnalyticsReportKey(userId, target.reportKey);
  }
  return sent;
}

export async function runScheduledAnalyticsReports(
  env: Env,
  target: ReportTarget,
): Promise<void> {
  const { householdRepository } = await import("../household/household.repository.js");
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

export function shouldRunReportToday(dayOfMonth: number): boolean {
  return dayOfMonth === 1 || dayOfMonth === 15;
}

export function getReportTargetForToday(): ReportTarget | null {
  const { date } = getNowJakarta();
  const day = Number(date.slice(8, 10));
  return resolveReportTarget(day, date);
}
