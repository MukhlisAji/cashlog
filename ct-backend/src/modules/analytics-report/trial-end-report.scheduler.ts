import type { Env } from "../../config/env.js";
import { runTrialEndReports } from "./trial-end-report.service.js";

const REPORT_HOUR_JAKARTA = 8;
const TICK_MS = 30_000;

let lastGlobalTrialReportDate: string | null = null;

function getJakartaDateTime(): { date: string; hour: number; minute: number } {
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

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

export function startTrialEndReportScheduler(env: Env): void {
  setInterval(() => {
    const { date, hour, minute } = getJakartaDateTime();
    if (hour !== REPORT_HOUR_JAKARTA || minute !== 0) return;
    if (lastGlobalTrialReportDate === date) return;

    lastGlobalTrialReportDate = date;
    void runTrialEndReports(env).catch((error) => {
      console.error({ error }, "[trial-report] batch failed");
      lastGlobalTrialReportDate = null;
    });
  }, TICK_MS);

  console.info(
    `[trial-report] Trial day-7 PDF + upgrade nudge scheduled daily at ${REPORT_HOUR_JAKARTA}:00 WIB`,
  );
}
