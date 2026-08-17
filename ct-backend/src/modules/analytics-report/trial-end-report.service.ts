import type { Env } from "../../config/env.js";
import { BRAND_NAME } from "../../config/brand.js";
import { getNowJakarta } from "../../lib/datetime-jakarta.js";
import { listTrialUserIdsOnLastDay } from "../../lib/subscription.js";
import { userConfigRepository } from "../config/config.repository.js";
import { householdRepository } from "../household/household.repository.js";
import { formatMonthLabel } from "../whatsapp/wa-sheet-queries.js";
import { sendDocumentToLeadUser } from "../whatsapp/meta-outbound.service.js";
import {
  generateAnalyticsReportPdf,
  type ReportTarget,
} from "./analytics-report.service.js";

const TRIAL_END_REPORT_KEY = "trial-end";

function buildTrialEndCaption(env: Env, month: string): string {
  const label = formatMonthLabel(month);
  const settingsUrl = `${env.FRONTEND_URL}/settings`;

  return [
    `📊 *Laporan Trial ${BRAND_NAME}* — ${label}`,
    "",
    "Hari terakhir trial kamu besok. PDF ini ringkasan analitik yang kamu nikmati selama trial.",
    "",
    "✨ *Lanjut berlangganan* untuk scan struk, analitik mendalam, laporan rutin, dan kategori custom:",
    settingsUrl,
    "",
    "Berlangganan agar insight dan laporan rutin tetap aktif. 😉",
    "",
    BRAND_NAME,
  ].join("\n");
}

function buildTrialEndFilename(month: string): string {
  return `cashlog-trial-analitik-${month.replace("-", "")}.pdf`;
}

export async function sendTrialEndReportToUser(
  env: Env,
  userId: string,
): Promise<boolean> {
  const alreadySent = await userConfigRepository.getLastTrialEndReportKey(userId);
  if (alreadySent === TRIAL_END_REPORT_KEY) return false;

  const phone = await householdRepository.getLeadPhone(userId);
  if (!phone) return false;

  const { month, date } = getNowJakarta();
  const target: ReportTarget = {
    kind: "midmonth",
    month,
    reportKey: `trial-end:${month}`,
    asOfDate: date,
  };

  let pdf: Buffer | null;
  try {
    pdf = await generateAnalyticsReportPdf(env, userId, target);
  } catch (error) {
    console.error({ userId, error }, "[trial-report] PDF generation failed");
    return false;
  }

  if (!pdf) return false;

  const caption = buildTrialEndCaption(env, month);
  const filename = buildTrialEndFilename(month);

  const sent = await sendDocumentToLeadUser(userId, pdf, filename, caption);
  if (sent) {
    await userConfigRepository.setLastTrialEndReportKey(userId, TRIAL_END_REPORT_KEY);
  }
  return sent;
}

export async function runTrialEndReports(env: Env): Promise<void> {
  const userIds = await listTrialUserIdsOnLastDay();

  for (const userId of userIds) {
    try {
      await sendTrialEndReportToUser(env, userId);
    } catch (error) {
      console.error({ userId, error }, "[trial-report] failed for user");
    }
  }
}
