import type { Env } from "../../config/env.js";
import { getNowJakarta, normalizeSheetCellDateTime } from "../../lib/datetime-jakarta.js";
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

function toSheetValues(row: TransactionRow): (string | number)[] {
  return [
    row.date,
    row.item,
    row.amount,
    row.category,
    row.source,
    row.note,
    row.time,
    row.recorder ?? "",
  ];
}

export async function appendTransaction(
  env: Env,
  userId: string,
  spreadsheetId: string,
  row: TransactionRow,
) {
  await appendTransactions(env, userId, spreadsheetId, [row]);
}

export async function appendTransactions(
  env: Env,
  userId: string,
  spreadsheetId: string,
  items: TransactionRow[],
) {
  if (items.length === 0) return;

  const byYear = new Map<string, TransactionRow[]>();
  for (const row of items) {
    const year = row.date.slice(0, 4);
    const list = byYear.get(year) ?? [];
    list.push(row);
    byYear.set(year, list);
  }

  const sheets = await getSheetsClient(env, userId);

  for (const [year, yearRows] of byYear) {
    await ensureYearTab(sheets, spreadsheetId, year);

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

    const lastRow = nextRow + yearRows.length - 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${year}!A${nextRow}:H${lastRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: yearRows.map(toSheetValues) },
    });
  }
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
  const expenseRows = monthRows.filter(
    (r) => String(r.raw[5] ?? "").trim().toLowerCase() !== "income",
  );

  const totalExpense = expenseRows.reduce((sum, r) => sum + r.amount, 0);
  const transactionCount = expenseRows.length;

  const categoryTotals = new Map<string, number>();
  for (const r of expenseRows) {
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

  const yearTotal = parsed
    .filter((r) => String(r.raw[5] ?? "").trim().toLowerCase() !== "income")
    .reduce((sum, r) => sum + r.amount, 0);

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

export type DeletableSheetRow = {
  year: string;
  sheetRow: number;
  date: string;
  item: string;
  amount: number;
  category: string;
  type: "expense" | "income";
};

/** Newest first. `sheetRow` is 1-based (header is row 1). */
export async function listRecentDeletableRows(
  env: Env,
  userId: string,
  spreadsheetId: string,
  limit = 5,
): Promise<DeletableSheetRow[]> {
  const sheets = await getSheetsClient(env, userId);
  const year = getNowJakarta().date.slice(0, 4);
  await ensureYearTab(sheets, spreadsheetId, year);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${year}!A2:H2000`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const values = res.data.values ?? [];
  const found: DeletableSheetRow[] = [];
  for (let i = 0; i < values.length; i++) {
    const raw = values[i] ?? [];
    if (!raw[0] || !raw[1]) continue;
    const { date } = normalizeSheetCellDateTime(raw[0], raw[6]);
    const note = String(raw[5] ?? "").trim().toLowerCase();
    found.push({
      year,
      sheetRow: i + 2,
      date,
      item: String(raw[1] ?? ""),
      amount: parseAmount(raw[2]),
      category: String(raw[3] ?? "Lainnya"),
      type: note === "income" ? "income" : "expense",
    });
  }
  return found.slice(-limit).reverse();
}

export async function deleteSheetRow(
  env: Env,
  userId: string,
  spreadsheetId: string,
  year: string,
  sheetRow: number,
): Promise<void> {
  if (sheetRow < 2) throw new Error("Invalid sheet row");
  const sheets = await getSheetsClient(env, userId);
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const sheetId = meta.data.sheets?.find((s) => s.properties?.title === year)
    ?.properties?.sheetId;
  if (sheetId == null) throw new Error("Year tab not found");

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: sheetRow - 1,
              endIndex: sheetRow,
            },
          },
        },
      ],
    },
  });
}
