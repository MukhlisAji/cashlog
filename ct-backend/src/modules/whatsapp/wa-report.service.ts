import { getNowJakarta } from "../../lib/datetime-jakarta.js";
import { getSupabaseAdmin } from "../../lib/supabase.js";

export interface LedgerTransaction {
  id: string;
  type: "expense" | "income";
  amount: number;
  category: string;
  description: string;
  transaction_date: string;
  created_at: string;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID").format(amount);
}

function monthBoundsJakarta(): { start: string; endExclusive: string } {
  const { month } = getNowJakarta();
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthNum = Number(monthRaw);
  const start = `${month}-01`;
  const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
  const nextYear = monthNum === 12 ? year + 1 : year;
  const endExclusive = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start, endExclusive };
}

function mapRow(row: Record<string, unknown>): LedgerTransaction {
  return {
    id: String(row.id ?? ""),
    type: row.type === "income" ? "income" : "expense",
    amount: Number(row.amount ?? 0),
    category: String(row.category ?? "Lainnya"),
    description: String(row.description ?? ""),
    transaction_date: String(row.transaction_date ?? "").slice(0, 10),
    created_at: String(row.created_at ?? ""),
  };
}

export async function fetchLastTransactions(
  userId: string,
  limit = 5,
): Promise<LedgerTransaction[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("transactions")
    .select(
      "id, type, amount, category, description, transaction_date, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row) => mapRow(row as Record<string, unknown>));
}

export async function fetchTransactionsOnDate(
  userId: string,
  date: string,
): Promise<LedgerTransaction[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("transactions")
    .select(
      "id, type, amount, category, description, transaction_date, created_at",
    )
    .eq("user_id", userId)
    .eq("transaction_date", date)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => mapRow(row as Record<string, unknown>));
}

export async function fetchTransactionsThisMonth(
  userId: string,
): Promise<LedgerTransaction[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { start, endExclusive } = monthBoundsJakarta();
  const { data, error } = await sb
    .from("transactions")
    .select(
      "id, type, amount, category, description, transaction_date, created_at",
    )
    .eq("user_id", userId)
    .gte("transaction_date", start)
    .lt("transaction_date", endExclusive)
    .order("transaction_date", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => mapRow(row as Record<string, unknown>));
}

function sums(rows: LedgerTransaction[]): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const row of rows) {
    if (row.type === "income") income += row.amount;
    else expense += row.amount;
  }
  return { income, expense };
}

function formatItemLine(row: LedgerTransaction): string {
  const sign = row.type === "income" ? "+" : "-";
  return `${sign} ${row.description} · Rp ${formatRupiah(row.amount)} · ${row.category}`;
}

export function formatLastFiveReport(rows: LedgerTransaction[]): string {
  if (rows.length === 0) return "Belum ada transaksi tercatat.";
  const lines = rows.map((row, i) => {
    const date = row.transaction_date;
    return `${i + 1}. ${date} · ${row.description} · Rp ${formatRupiah(row.amount)} · ${row.category}`;
  });
  return [
    "🧾 *5 transaksi terakhir*",
    ...lines,
    "",
    "Hapus: *hapus terakhir* atau *hapus 1* … *hapus 5*.",
  ].join("\n");
}

export function formatTodayReport(
  date: string,
  rows: LedgerTransaction[],
): string {
  if (rows.length === 0) {
    return [
      "📅 *Hari ini* belum ada catatan.",
      'Kirim: "Beli kopi 20rb" atau foto struk.',
    ].join("\n");
  }
  const { income, expense } = sums(rows);
  return [
    `📅 *Hari ini* (${date})`,
    `Pemasukan: Rp ${formatRupiah(income)}`,
    `Pengeluaran: Rp ${formatRupiah(expense)}`,
    "",
    ...rows.map(formatItemLine),
  ].join("\n");
}

export function formatMonthReport(rows: LedgerTransaction[], month: string): string {
  const { income, expense } = sums(rows);
  const net = income - expense;
  const byCategory = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== "expense") continue;
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount);
  }
  const categoryLines = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => `• ${category}: Rp ${formatRupiah(amount)}`);

  return [
    `📊 *Ringkasan ${month}*`,
    `Pemasukan: Rp ${formatRupiah(income)}`,
    `Pengeluaran: Rp ${formatRupiah(expense)}`,
    `Saldo: Rp ${formatRupiah(net)}`,
    categoryLines.length ? "*Pengeluaran per kategori*" : "",
    ...categoryLines,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
