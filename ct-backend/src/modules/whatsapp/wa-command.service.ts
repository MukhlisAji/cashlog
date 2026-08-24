import type { Env } from "../../config/env.js";
import type { SubscriptionCheck } from "../../lib/subscription.js";
import { getNowJakarta } from "../../lib/datetime-jakarta.js";
import { googleConnectionRepository } from "../config/config.repository.js";
import {
  formatLastFiveReport,
  formatMonthReport,
  formatRupiah,
  formatTodayReport,
  type LedgerTransaction,
} from "./wa-report.service.js";
import {
  fetchYearTransactions,
  filterTransactionsByDate,
  filterTransactionsByMonth,
  formatMonthLabel,
  type SheetTransaction,
} from "./wa-sheet-queries.js";

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

const HARI_INI_ALIASES = new Set(["hari ini", "today", "hariini"]);

const TERAKHIR_ALIASES = new Set([
  "terakhir",
  "last",
  "riwayat",
  "transaksi terakhir",
]);

function normalizeInput(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function toLedger(row: SheetTransaction, index: number): LedgerTransaction {
  return {
    id: String(index),
    type: row.type,
    amount: row.amount,
    category: row.category,
    description: row.item,
    transaction_date: row.date,
    created_at: `${row.date}T${row.time ?? "00:00:00"}`,
  };
}

function helpText(sub: SubscriptionCheck): string {
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
    lines.push("", "📷 Kirim foto struk untuk dicatat otomatis");
  }

  return lines.join("\n");
}

function resolveCommand(
  normalized: string,
): "help" | "ringkasan" | "hari_ini" | "terakhir" | null {
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

  if (command === "help") return helpText(sub);

  const connection = await googleConnectionRepository.getByUserId(userId);
  if (!connection?.spreadsheet_id) {
    return "⚠️ Google Sheet belum terhubung. Setup dulu di dashboard cashlog.id";
  }

  const all = await fetchYearTransactions(env, userId, connection.spreadsheet_id);
  const { date, month } = getNowJakarta();

  if (command === "terakhir") {
    const recent = all.slice(-5).reverse().map(toLedger);
    return formatLastFiveReport(recent);
  }

  if (command === "hari_ini") {
    const rows = filterTransactionsByDate(all, date).map(toLedger);
    return formatTodayReport(date, rows);
  }

  const rows = filterTransactionsByMonth(all, month).map(toLedger);
  return formatMonthReport(rows, formatMonthLabel(month));
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
