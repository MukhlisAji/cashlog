import type { Env } from "../../config/env.js";
import { getSheetsClient } from "../sheets/google-client.js";
import { ensureYearTab } from "../sheets/sheet-template.service.js";
import { normalizeSheetCellDateTime } from "../../lib/datetime-jakarta.js";

export interface SheetTransaction {
  date: string;
  time: string | null;
  month: string;
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

export async function fetchYearTransactions(
  env: Env,
  userId: string,
  spreadsheetId: string,
  year?: string,
): Promise<SheetTransaction[]> {
  const sheets = await getSheetsClient(env, userId);
  const y = year ?? String(new Date().getFullYear());

  await ensureYearTab(sheets, spreadsheetId, y);

  // Column layout (post-month-unification):
  //   A = tanggal (ISO or serial, time optional inside)
  //   B = item
  //   C = nominal
  //   D = kategori
  //   E = sumber
  //   F = catatan
  //   G = waktu (optional explicit)
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${y}!A2:G2000`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const rows = (res.data.values ?? []).filter((r) => r[0] && r[1]);

  return rows.map((r) => {
    const { date, month, time } = normalizeSheetCellDateTime(r[0], r[6]);
    return {
      date,
      month,
      time,
      item: String(r[1] ?? ""),
      amount: parseAmount(r[2]),
      category: String(r[3] ?? "Lainnya"),
      source: String(r[4] ?? "whatsapp"),
    };
  });
}

export function filterTransactionsByDate(
  transactions: SheetTransaction[],
  date: string,
): SheetTransaction[] {
  return transactions.filter((t) => t.date === date);
}

export function filterTransactionsByMonth(
  transactions: SheetTransaction[],
  month: string,
): SheetTransaction[] {
  return transactions.filter((t) => t.month === month);
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID").format(amount);
}

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const names = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  const idx = Number(m) - 1;
  return `${names[idx] ?? m} ${year}`;
}
