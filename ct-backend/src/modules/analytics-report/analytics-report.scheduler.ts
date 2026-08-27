import type { Env } from "../../config/env.js";
import {
  claimSchedulerJob,
  releaseSchedulerJob,
} from "../../lib/scheduler-lock.js";
import {
  getMonthlyReportTargetForToday,
  getReportTargetForToday,
  runScheduledAnalyticsReports,
} from "./analytics-report.service.js";

const REPORT_HOUR_JAKARTA = 8;
const TICK_MS = 30_000;

function getJakartaDateTime(): {
  date: string;
  hour: number;
  minute: number;
  weekday: string;
} {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";

  const month = get("month").padStart(2, "0");
  const day = get("day").padStart(2, "0");

  return {
    date: `${get("year")}-${month}-${day}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: get("weekday"),
  };
}

export function startAnalyticsReportScheduler(env: Env): void {
  setInterval(() => {
    const { date, hour, minute, weekday } = getJakartaDateTime();
    if (hour !== REPORT_HOUR_JAKARTA || minute !== 0) return;

    if (weekday === "Mon") {
      const weekly = getReportTargetForToday();
      if (weekly) {
        const jobKey = `analytics-report:${weekly.reportKey}`;
        void (async () => {
          const claimed = await claimSchedulerJob(jobKey);
          if (!claimed) return;
          try {
            await runScheduledAnalyticsReports(env, weekly);
          } catch (error) {
            console.error({ error, target: weekly }, "[analytics-report] weekly batch failed");
            await releaseSchedulerJob(jobKey);
          }
        })();
      }
    }

    if (date.endsWith("-01")) {
      const monthly = getMonthlyReportTargetForToday();
      if (monthly) {
        const jobKey = `analytics-report:${monthly.reportKey}`;
        void (async () => {
          const claimed = await claimSchedulerJob(jobKey);
          if (!claimed) return;
          try {
            await runScheduledAnalyticsReports(env, monthly);
          } catch (error) {
            console.error({ error, target: monthly }, "[analytics-report] monthly batch failed");
            await releaseSchedulerJob(jobKey);
          }
        })();
      }
    }
  }, TICK_MS);

  console.info(
    `[analytics-report] Monday 08:00 WIB weekly PDF · 1st 08:00 WIB monthly PDF (Pro, WA)`,
  );
}
