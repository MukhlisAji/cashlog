import type { Env } from "../../config/env.js";
import {
  getReportTargetForToday,
  runScheduledAnalyticsReports,
  shouldRunReportToday,
} from "./analytics-report.service.js";

const REPORT_HOUR_JAKARTA = 8;
const TICK_MS = 30_000;

let lastGlobalReportKey: string | null = null;

function getJakartaDateTime(): { date: string; hour: number; minute: number; day: number } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";

  const date = `${get("year")}-${get("month")}-${get("day")}`;

  return {
    date,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    day: Number(get("day")),
  };
}

export function startAnalyticsReportScheduler(env: Env): void {
  setInterval(() => {
    const { hour, minute, day } = getJakartaDateTime();
    if (hour !== REPORT_HOUR_JAKARTA || minute !== 0) return;
    if (!shouldRunReportToday(day)) return;

    const target = getReportTargetForToday();
    if (!target) return;
    if (lastGlobalReportKey === target.reportKey) return;

    lastGlobalReportKey = target.reportKey;
    void runScheduledAnalyticsReports(env, target).catch((error) => {
      console.error({ error, target }, "[analytics-report] batch failed");
      lastGlobalReportKey = null;
    });
  }, TICK_MS);

  console.info(
    `[analytics-report] Scheduled on tgl 1 & 15 at ${REPORT_HOUR_JAKARTA}:00 WIB (WA PDF, Pro only)`,
  );
}
