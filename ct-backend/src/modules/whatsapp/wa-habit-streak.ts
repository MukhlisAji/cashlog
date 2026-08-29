import { getNowJakarta, previousJakartaDate } from "../../lib/datetime-jakarta.js";
import { householdRepository } from "../household/household.repository.js";

const SUCCESS_GREETINGS = [
  "Oke, udah kecatat.",
  "Masuk ya.",
  "Siap.",
  "Kecatat.",
  "Oke, masuk.",
] as const;

const DONE_REMINDER_LINES = [
  "Good job! Besok lanjut ya.",
  "Udah lengkap hari ini.",
  "Streak aman. Besok lagi.",
  "Cukup untuk hari ini.",
  "Oke, besok catat lagi.",
] as const;

const ROBOT_GREETINGS = new Set([
  "siap, udah masuk catatan!",
  "siap, udah masuk catatan",
  "siap udah masuk catatan",
]);

function pickVariant(seed: string, variants: readonly string[]): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % variants.length;
  return variants[index] ?? variants[0]!;
}

export function pickSuccessGreeting(aiGreeting: string | undefined, seed: string): string {
  const trimmed = aiGreeting?.trim() ?? "";
  if (trimmed && !ROBOT_GREETINGS.has(trimmed.toLowerCase())) {
    return trimmed;
  }
  return pickVariant(seed, SUCCESS_GREETINGS);
}

export function buildEveningReminderMessage(
  todayCount: number,
  todayTotal: number,
  habitStreak: number,
  seed: string,
): string {
  const header =
    habitStreak > 0
      ? `Reminder cashlog.id | 🔥 Streak ${habitStreak}`
      : "Reminder cashlog.id";

  if (todayCount > 0) {
    const total = new Intl.NumberFormat("id-ID").format(todayTotal);
    return [
      header,
      "",
      `Hari ini kamu sudah catat ${todayCount} transaksi — total Rp ${total}.`,
      pickVariant(seed, DONE_REMINDER_LINES),
    ].join("\n");
  }

  return [
    header,
    "",
    "Hari ini belum ada catatan pengeluaran.",
    'Kirim aja singkat: "Beli kopi 20rb"',
  ].join("\n");
}

export function streakLine(streak: number): string | null {
  if (streak <= 0) return null;
  return `🔥 Streak ${streak}`;
}

export async function recordHabitDay(leadUserId: string): Promise<{
  streak: number;
  firstOfDay: boolean;
}> {
  const today = getNowJakarta().date;
  const household = await householdRepository.ensureHousehold(leadUserId);
  const last = household.habit_last_date;
  const current = household.habit_streak;

  if (last === today) {
    return { streak: current, firstOfDay: false };
  }

  const yesterday = previousJakartaDate(today);
  const next = last === yesterday ? current + 1 : 1;
  await householdRepository.setHabitStreak(household.id, next, today);
  return { streak: next, firstOfDay: true };
}

export async function getVisibleHabitStreak(leadUserId: string): Promise<number> {
  try {
    const today = getNowJakarta().date;
    const household = await householdRepository.getByLeadUserId(leadUserId);
    if (!household) return 0;
    const last = household.habit_last_date;
    if (!last || household.habit_streak <= 0) return 0;
    if (last === today || last === previousJakartaDate(today)) {
      return household.habit_streak;
    }
    return 0;
  } catch {
    return 0;
  }
}
