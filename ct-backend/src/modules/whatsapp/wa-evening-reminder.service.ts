import type { Env } from "../../config/env.js";
import { getTodayJakarta } from "../../lib/datetime-jakarta.js";
import { errorMessage, recordOpsEvent } from "../../lib/ops-events.js";
import {
  claimSchedulerJob,
  releaseSchedulerJob,
} from "../../lib/scheduler-lock.js";
import { checkSubscription } from "../../lib/subscription.js";
import {
  googleConnectionRepository,
  userConfigRepository,
} from "../config/config.repository.js";
import { householdRepository } from "../household/household.repository.js";
import { getMetaService } from "./meta-outbound.service.js";
import { isMetaSessionWindowClosed } from "./meta-cloud.service.js";
import { buildEveningReminderMessage, getVisibleHabitStreak } from "./wa-habit-streak.js";
import { DAILY_REMINDER_TEMPLATE_NAME } from "./wa-daily-reminder.js";
import {
  bumpReminderTemplateStreak,
  canSendReminderTemplate,
} from "./wa-reminder-streak.js";
import {
  fetchYearTransactions,
  filterTransactionsByDate,
} from "./wa-sheet-queries.js";

const REMINDER_HOUR_JAKARTA = 21;
const TICK_MS = 30_000;

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

async function sendEveningReminderToUser(
  env: Env,
  userId: string,
): Promise<void> {
  const sub = await checkSubscription(userId);
  if (!sub.allowed) return;

  const alreadySent = await userConfigRepository.getLastEveningReminderDate(userId);
  const { date } = getTodayJakarta();
  if (alreadySent === date) return;

  const connection = await googleConnectionRepository.getByUserId(userId);
  if (!connection?.spreadsheet_id) return;

  let todayCount = 0;
  let todayTotal = 0;

  try {
    const all = await fetchYearTransactions(
      env,
      userId,
      connection.spreadsheet_id,
    );
    const todayRows = filterTransactionsByDate(all, date);
    todayCount = todayRows.length;
    todayTotal = todayRows.reduce((s, t) => s + t.amount, 0);
  } catch {
    return;
  }

  const habitStreak = await getVisibleHabitStreak(userId);
  const text = buildEveningReminderMessage(
    todayCount,
    todayTotal,
    habitStreak,
    `${userId}:${date}`,
  );
  const household = await householdRepository.getByLeadUserId(userId);
  const includeMembers = household?.notify_members_reminder !== false;
  const lead = await householdRepository.getLeadPhone(userId);
  if (!lead) return;

  const phones = [lead];
  if (includeMembers) {
    for (const phone of await householdRepository.listActiveMemberPhones(userId)) {
      if (!phones.includes(phone)) phones.push(phone);
    }
  }

  let anyOk = false;
  for (const phone of phones) {
    const ok = await sendReminderToPhone(env, phone, text, todayCount, date);
    if (ok) anyOk = true;
  }

  if (anyOk) {
    await userConfigRepository.setLastEveningReminderDate(userId, date);
  }
}

async function sendReminderToPhone(
  env: Env,
  phone: string,
  text: string,
  todayCount: number,
  today: string,
): Promise<boolean> {
  try {
    await getMetaService().sendWhatsAppMessage(phone, text);
    return true;
  } catch (error) {
    if (!isMetaSessionWindowClosed(error)) {
      console.error({ phone, error }, "[wa-reminder] session send failed");
      void recordOpsEvent({
        kind: "reminder",
        ok: false,
        message: errorMessage(error),
      });
      return false;
    }
  }

  if (todayCount > 0) return false;
  if (!(await canSendReminderTemplate(phone, today))) return false;

  try {
    await getMetaService().sendWhatsAppTemplate({
      to: phone.replace(/\D/g, ""),
      templateName: env.META_WA_DAILY_REMINDER_TEMPLATE,
      languageCode: env.META_WA_ONBOARDING_TEMPLATE_LANG,
    });
    await bumpReminderTemplateStreak(phone, today);
    return true;
  } catch (error) {
    console.error(
      { phone, error, template: DAILY_REMINDER_TEMPLATE_NAME },
      "[wa-reminder] daily_reminder_v1 failed",
    );
    void recordOpsEvent({
      kind: "reminder",
      ok: false,
      message: errorMessage(error),
    });
    return false;
  }
}

async function runEveningReminders(env: Env): Promise<void> {
  const userIds = await householdRepository.listLeadUserIdsWithPhone();
  for (const userId of userIds) {
    try {
      await sendEveningReminderToUser(env, userId);
    } catch (error) {
      console.error({ userId, error }, "[wa-reminder] failed for user");
      void recordOpsEvent({
        kind: "reminder",
        ok: false,
        userId,
        message: errorMessage(error),
      });
    }
  }
}

export function startEveningReminderScheduler(env: Env): void {
  setInterval(() => {
    const { date, hour, minute } = getJakartaDateTime();
    if (hour !== REMINDER_HOUR_JAKARTA || minute !== 0) return;
    const jobKey = `evening-reminder:${date}`;
    void (async () => {
      const claimed = await claimSchedulerJob(jobKey);
      if (!claimed) return;
      try {
        await runEveningReminders(env);
      } catch (error) {
        console.error({ error }, "[wa-reminder] batch failed");
        await releaseSchedulerJob(jobKey);
      }
    })();
  }, TICK_MS);

  console.info(
    `[wa-reminder] Evening reminder scheduled daily at ${REMINDER_HOUR_JAKARTA}:00 WIB`,
  );
}
