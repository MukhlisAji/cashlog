import type { Env } from "../../config/env.js";
import type { SubscriptionCheck } from "../../lib/subscription.js";
import {
  formatTransactionLineMeta,
  getTodayJakarta,
} from "../../lib/datetime-jakarta.js";
import {
  categoriesRepository,
  googleConnectionRepository,
  userConfigRepository,
} from "../config/config.repository.js";
import {
  fetchYearTransactions,
  filterTransactionsByDate,
  filterTransactionsByMonth,
  formatMonthLabel,
  formatRupiah,
  type SheetTransaction,
} from "./wa-sheet-queries.js";

type CommandHandler = (
  env: Env,
  userId: string,
  spreadsheetId: string,
  sub: SubscriptionCheck,
) => Promise<string>;

const HELP_ALIASES = new Set([
  "help",
  "bantuan",
  "menu",
  "?",
  "/help",
  "/bantuan",
]);

const RINGKASAN_ALIASES = new Set([
  "ringkasan",
  "summary",
  "total",
  "total bulan ini",
]);

const HARI_INI_ALIASES = new Set([
  "hari ini",
  "today",
  "hariini",
]);

const TERAKHIR_ALIASES = new Set([
  "terakhir",
  "last",
  "riwayat",
  "transaksi terakhir",
]);

function normalizeInput(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function topCategory(transactions: SheetTransaction[]): string {
  const map = new Map<string, number>();
  for (const t of transactions) {
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  let best = "-";
  let bestAmt = 0;
  for (const [cat, amt] of map) {
    if (amt > bestAmt) {
      bestAmt = amt;
      best = cat;
    }
  }
  return best;
}

const handlers: Record<string, CommandHandler> = {
  help: async (_env, _userId, _sheetId, sub) => {
    const lines = [
      "📋 *Menu cashlog.id*",
      "",
      "📝 *Catat transaksi:*",
      'Ketik: "Beli kopi 20rb" atau "Grab 35 ribu"',
      "",
      "🔍 *Perintah:*",
      "• *bantuan* — menu ini",
      "• *hari ini* — total catatan hari ini",
      "• *ringkasan* — total bulan ini",
      "• *terakhir* — 5 transaksi terbaru",
    ];

    if (sub.canUseReceiptOcr) {
      lines.push("", "📷 *Pro:* kirim foto struk (tanpa caption)");
    } else {
      lines.push("", "⭐ Upgrade Pro untuk scan struk & analitik di dashboard");
    }

    return lines.join("\n");
  },

  ringkasan: async (env, userId, spreadsheetId) => {
    const activeMonth = await userConfigRepository.getActiveMonth(userId);
    const all = await fetchYearTransactions(env, userId, spreadsheetId);
    const monthRows = filterTransactionsByMonth(all, activeMonth);
    const total = monthRows.reduce((s, t) => s + t.amount, 0);
    const label = formatMonthLabel(activeMonth);
    const top = topCategory(monthRows);

    return [
      `📊 *Ringkasan ${label}*`,
      `Total: Rp ${formatRupiah(total)}`,
      `Transaksi: ${monthRows.length}`,
      top !== "-" ? `Terbesar: ${top}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  },

  hari_ini: async (env, userId, spreadsheetId) => {
    const { date } = getTodayJakarta();
    const all = await fetchYearTransactions(env, userId, spreadsheetId);
    const todayRows = filterTransactionsByDate(all, date);
    const total = todayRows.reduce((s, t) => s + t.amount, 0);

    if (todayRows.length === 0) {
      return [
        "📅 *Hari ini* belum ada catatan.",
        'Kirim: "Beli kopi 20rb" ☕',
      ].join("\n");
    }

    return [
      `📅 *Hari ini* (${todayRows.length} transaksi)`,
      `Total: Rp ${formatRupiah(total)}`,
      "Mantap, keep it up! 💪",
    ].join("\n");
  },

  terakhir: async (env, userId, spreadsheetId) => {
    const all = await fetchYearTransactions(env, userId, spreadsheetId);
    const recent = all.slice(-5).reverse();

    if (recent.length === 0) {
      return "Belum ada transaksi tercatat.";
    }

    const lines = recent.map(
      (t, i) =>
        `${i + 1}. ${t.item} — Rp ${formatRupiah(t.amount)} (${t.category})\n   ${formatTransactionLineMeta(t.date, t.time)}`,
    );

    return ["🧾 *5 transaksi terakhir*", ...lines].join("\n");
  },
};

function resolveCommand(normalized: string): keyof typeof handlers | null {
  if (HELP_ALIASES.has(normalized)) return "help";
  if (RINGKASAN_ALIASES.has(normalized)) return "ringkasan";
  if (HARI_INI_ALIASES.has(normalized)) return "hari_ini";
  if (TERAKHIR_ALIASES.has(normalized)) return "terakhir";
  return null;
}

/** Returns reply text if message is a bot command, otherwise null */
export async function tryHandleWaCommand(
  env: Env,
  userId: string,
  text: string,
  sub: SubscriptionCheck,
): Promise<string | null> {
  const normalized = normalizeInput(text);
  const command = resolveCommand(normalized);
  if (!command) return null;

  if (command === "help") {
    return handlers.help(env, userId, "", sub);
  }

  const connection = await googleConnectionRepository.getByUserId(userId);
  if (!connection?.spreadsheet_id) {
    return "⚠️ Google Sheet belum terhubung. Setup dulu di dashboard cashlog.id";
  }

  await categoriesRepository.listByUser(userId);

  return handlers[command](env, userId, connection.spreadsheet_id, sub);
}

export function buildEveningReminderMessage(
  todayCount: number,
  todayTotal: number,
): string {
  if (todayCount > 0) {
    return [
      "🌙 *Reminder cashlog.id*",
      "",
      `Hari ini kamu sudah catat ${todayCount} transaksi — total Rp ${formatRupiah(todayTotal)}.`,
      "Good job! Besok lanjut ya 💪",
    ].join("\n");
  }

  return [
    "🌙 *Reminder cashlog.id*",
    "",
    "Hari ini belum ada catatan pengeluaran.",
    'Kirim aja singkat: "Beli kopi 20rb" ☕',
    "Ketik *bantuan* untuk menu.",
  ].join("\n");
}
