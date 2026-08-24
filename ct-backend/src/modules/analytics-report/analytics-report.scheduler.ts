import type { Env } from "../../config/env.js";
import {
  claimSchedulerJob,
  releaseSchedulerJob,
} from "../../lib/scheduler-lock.js";
import {
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
    const { hour, minute, weekday } = getJakartaDateTime();
    if (hour !== REPORT_HOUR_JAKARTA || minute !== 0) return;
    if (weekday !== "Mon") return;

    const target = getReportTargetForToday();
    if (!target) return;

    const jobKey = `analytics-report:${target.reportKey}`;
    void (async () => {
      const claimed = await claimSchedulerJob(jobKey);
      if (!claimed) return;
      try {
        await runScheduledAnalyticsReports(env, target);
      } catch (error) {
        console.error({ error, target }, "[analytics-report] batch failed");
        await releaseSchedulerJob(jobKey);
      }
    })();
  }, TICK_MS);

  console.info(
    `[analytics-report] Scheduled every Monday at ${REPORT_HOUR_JAKARTA}:00 WIB (WA PDF, Pro only)`,
  );
}
