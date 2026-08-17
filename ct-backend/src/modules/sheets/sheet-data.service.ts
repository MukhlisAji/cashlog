import type { Env } from "../../config/env.js";
import { normalizeSheetCellDateTime } from "../../lib/datetime-jakarta.js";
import {
  budgetsRepository,
  categoriesRepository,
  userConfigRepository,
} from "../config/config.repository.js";
import { getSheetsClient } from "./google-client.js";
import { TRANSACTION_HEADERS } from "./sheets.constants.js";
import { ensureYearTab } from "./sheet-template.service.js";

export interface TransactionRow {
  date: string;
  time: string;
  item: string;
  amount: number;
  category: string;
  source: string;
  note: string;
  recorder?: string;
}

export async function appendTransaction(
  env: Env,
  userId: string,
  spreadsheetId: string,
  row: TransactionRow,
) {
  const sheets = await getSheetsClient(env, userId);
  const year = row.date.slice(0, 4);

  await ensureYearTab(sheets, spreadsheetId, year);

  // Google Sheets `values.append` follows the first contiguous "table".
  // After a corrupted write (data starting at G), append keeps writing at G.
  // Always write A{n}:H{n} explicitly, and restore the header on row 1.
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${year}!A:H`,
    majorDimension: "ROWS",
  });
  const rows = existing.data.values ?? [];

  const header = [...TRANSACTION_HEADERS];
  const headerBroken =
    rows.length === 0 ||
    header.some((label, i) => String(rows[0]?.[i] ?? "").trim() !== label);

  if (headerBroken) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${year}!A1:H1`,
      valueInputOption: "RAW",
      requestBody: { values: [header] },
    });
  }

  let nextRow = 2;
  for (let i = 1; i < rows.length; i++) {
    const hasAny = (rows[i] ?? []).some((cell) => String(cell ?? "").trim());
    if (hasAny) nextRow = i + 2;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${year}!A${nextRow}:H${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          row.date,
          row.item,
          row.amount,
          row.category,
          row.source,
          row.note,
          row.time,
          row.recorder ?? "",
        ],
      ],
    },
  });
}

export interface DashboardSummary {
  activeMonth: string;
  totalExpense: number;
  transactionCount: number;
  averagePerTransaction: number;
  yearTotal: number;
  topCategory: string;
}

export interface DashboardTransaction {
  date: string;
  time: string | null;
  item: string;
  amount: number;
  category: string;
  source: string;
}

function parseAmount(value: unknown): number {
  if (typeof value === "number") return value;
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export async function fetchDashboardData(
  env: Env,
  userId: string,
  spreadsheetId: string,
): Promise<{
  summary: DashboardSummary;
  recentTransactions: DashboardTransaction[];
  categoryTotals: { category: string; amount: number }[];
}> {
  const sheets = await getSheetsClient(env, userId);
  const year = String(new Date().getFullYear());
  const activeMonth = await userConfigRepository.getActiveMonth(userId);

  await ensureYearTab(sheets, spreadsheetId, year);

  // Column layout (no more "bulan" standalone column):
  //   A = tanggal (ISO or serial date, optionally with fractional time-of-day)
  //   B = item
  //   C = nominal
  //   D = kategori
  //   E = sumber
  //   F = catatan
  //   G = waktu  (optional, if A doesn't carry time)
  //   H = pencatat
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${year}!A2:H2000`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const rows = (res.data.values ?? []).filter((r) => r[0] && r[1]);

  const parsed = rows.map((r) => {
    const { date, time, month } = normalizeSheetCellDateTime(r[0], r[6]);
    return {
      raw: r,
      date,
      time,
      month,
      item: String(r[1] ?? ""),
      amount: parseAmount(r[2]),
      category: String(r[3] ?? ""),
      source: String(r[4] ?? "whatsapp"),
    };
  });

  const allTransactions: DashboardTransaction[] = parsed.map((p) => ({
    date: p.date,
    item: p.item,
    amount: p.amount,
    category: p.category,
    source: p.source,
    time: p.time,
  }));

  const monthRows = parsed.filter((r) => r.month === activeMonth);

  const totalExpense = monthRows.reduce((sum, r) => sum + r.amount, 0);
  const transactionCount = monthRows.length;

  const categoryTotals = new Map<string, number>();
  for (const r of monthRows) {
    const cat = r.category || "Lainnya";
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + r.amount);
  }

  let topCategory = "-";
  let topAmount = 0;
  for (const [cat, amt] of categoryTotals) {
    if (amt > topAmount) {
      topAmount = amt;
      topCategory = cat;
    }
  }

  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const yearTotal = rows.reduce((sum, r) => sum + parseAmount(r[2]), 0);

  const recentTransactions = allTransactions.slice(-10).reverse();

  return {
    summary: {
      activeMonth,
      totalExpense,
      transactionCount,
      averagePerTransaction:
        transactionCount > 0
          ? Math.round(totalExpense / transactionCount)
          : 0,
      yearTotal,
      topCategory,
    },
    categoryTotals: categoryBreakdown,
    recentTransactions,
  };
}

export interface AnalyticsTransaction {
  date: string;
  time: string | null;
  month: string;
  item: string;
  amount: number;
  category: string;
}

export interface AnalyticsData {
  activeMonth: string;
  availableMonths: string[];
  /** All rows from the year sheet — used for multi-month trend & MoM */
  allTransactions: AnalyticsTransaction[];
  transactions: AnalyticsTransaction[];
  categoryTotals: { category: string; amount: number }[];
  dailyTotals: { date: string; amount: number; count: number }[];
  budgets: { category: string; amount: number }[];
  summary: {
    totalExpense: number;
    transactionCount: number;
    averagePerTransaction: number;
    topCategory: string;
  };
}

export async function fetchAnalyticsData(
  env: Env,
  userId: string,
  spreadsheetId: string,
  month?: string,
): Promise<AnalyticsData> {
  const sheets = await getSheetsClient(env, userId);
  const activeMonth =
    month ?? (await userConfigRepository.getActiveMonth(userId));
  const year = activeMonth.slice(0, 4);

  await ensureYearTab(sheets, spreadsheetId, year);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${year}!A2:H2000`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const rows = (res.data.values ?? []).filter((r) => r[0] && r[1]);

  const allTransactions: AnalyticsTransaction[] = rows.map((r) => {
    const { date, time, month: monthOfRow } = normalizeSheetCellDateTime(
      r[0],
      r[6],
    );
    return {
      date,
      time,
      month: monthOfRow,
      item: String(r[1] ?? ""),
      amount: parseAmount(r[2]),
      category: String(r[3] ?? "Lainnya"),
    };
  });

  const monthSet = new Set(
    allTransactions.map((t) => t.month).filter(Boolean),
  );
  const availableMonths = Array.from(monthSet).sort().reverse();
  if (!availableMonths.includes(activeMonth)) {
    availableMonths.unshift(activeMonth);
  }

  const monthRows = allTransactions.filter((t) => t.month === activeMonth);

  const categoryMap = new Map<string, number>();
  for (const t of monthRows) {
    categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + t.amount);
  }
  const categoryTotals = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const dailyMap = new Map<string, { amount: number; count: number }>();
  for (const t of monthRows) {
    const existing = dailyMap.get(t.date) ?? { amount: 0, count: 0 };
    dailyMap.set(t.date, {
      amount: existing.amount + t.amount,
      count: existing.count + 1,
    });
  }
  const dailyTotals = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalExpense = monthRows.reduce((s, t) => s + t.amount, 0);
  const transactionCount = monthRows.length;
  const topCategory = categoryTotals[0]?.category ?? "-";

  const [allBudgets, activeCategories] = await Promise.all([
    budgetsRepository.listByMonth(userId, activeMonth),
    categoriesRepository.listByUser(userId),
  ]);
  const activeNames = new Set(activeCategories.map((c) => c.name));
  const budgets = allBudgets.filter((b) => activeNames.has(b.category));

  return {
    activeMonth,
    availableMonths,
    allTransactions,
    transactions: monthRows,
    categoryTotals,
    dailyTotals,
    budgets,
    summary: {
      totalExpense,
      transactionCount,
      averagePerTransaction:
        transactionCount > 0
          ? Math.round(totalExpense / transactionCount)
          : 0,
      topCategory,
    },
  };
}
