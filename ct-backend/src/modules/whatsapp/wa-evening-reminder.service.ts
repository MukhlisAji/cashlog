import type { Env } from "../../config/env.js";
import { getTodayJakarta } from "../../lib/datetime-jakarta.js";
import { checkSubscription } from "../../lib/subscription.js";
import {
  googleConnectionRepository,
  userConfigRepository,
} from "../config/config.repository.js";
import { householdRepository } from "../household/household.repository.js";
import { sendTextToLeadUser } from "./meta-outbound.service.js";
import { buildEveningReminderMessage } from "./wa-command.service.js";
import {
  fetchYearTransactions,
  filterTransactionsByDate,
} from "./wa-sheet-queries.js";

const REMINDER_HOUR_JAKARTA = 21;
const TICK_MS = 30_000;

let lastGlobalReminderDate: string | null = null;

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

  const text = buildEveningReminderMessage(todayCount, todayTotal);
  const sent = await sendTextToLeadUser(userId, text);
  if (sent) {
    await userConfigRepository.setLastEveningReminderDate(userId, date);
  }
}

async function runEveningReminders(env: Env): Promise<void> {
  const userIds = await householdRepository.listLeadUserIdsWithPhone();
  for (const userId of userIds) {
    try {
      await sendEveningReminderToUser(env, userId);
    } catch (error) {
      console.error({ userId, error }, "[wa-reminder] failed for user");
    }
  }
}

export function startEveningReminderScheduler(env: Env): void {
  setInterval(() => {
    const { date, hour, minute } = getJakartaDateTime();
    if (hour !== REMINDER_HOUR_JAKARTA || minute !== 0) return;
    if (lastGlobalReminderDate === date) return;

    lastGlobalReminderDate = date;
    void runEveningReminders(env).catch((error) => {
      console.error({ error }, "[wa-reminder] batch failed");
      lastGlobalReminderDate = null;
    });
  }, TICK_MS);

  console.info(
    `[wa-reminder] Evening reminder scheduled daily at ${REMINDER_HOUR_JAKARTA}:00 WIB`,
  );
}
