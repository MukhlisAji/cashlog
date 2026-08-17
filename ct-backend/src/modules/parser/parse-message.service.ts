import type { CategoryRow } from "../config/config.repository.js";
import {
  getNowJakarta as getNowJakartaDateTime,
  getTodayJakarta as getTodayFromJakarta,
} from "../../lib/datetime-jakarta.js";

export interface ParsedTransaction {
  item: string;
  amount: number;
  category: string;
}

const AMOUNT_PATTERNS = [
  /(\d+(?:[.,]\d+)*)\s*(jt|juta)/i,
  /(\d+(?:[.,]\d+)*)\s*(rb|ribu|k)/i,
  /(\d+(?:[.,]\d{3})*(?:[.,]\d+)?)/,
];

function parseAmount(raw: string): number | null {
  const text = raw.trim().toLowerCase();

  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;

    let num = match[1].replace(/\./g, "").replace(",", ".");
    const value = parseFloat(num);
    if (!Number.isFinite(value)) continue;

    const suffix = match[2]?.toLowerCase();
    if (suffix === "jt" || suffix === "juta") return Math.round(value * 1_000_000);
    if (suffix === "rb" || suffix === "ribu" || suffix === "k")
      return Math.round(value * 1_000);

    return Math.round(value);
  }

  return null;
}

function detectCategory(text: string, categories: CategoryRow[]): string {
  const lower = text.toLowerCase();

  for (const cat of categories) {
    if (!cat.keywords) continue;
    const keywords = cat.keywords.split(",").map((k) => k.trim().toLowerCase());
    if (keywords.some((kw) => kw && lower.includes(kw))) {
      return cat.name;
    }
  }

  return categories.find((c) => c.name === "Lainnya")?.name ?? "Lainnya";
}

function extractItem(text: string, amountMatch: string): string {
  let item = text
    .replace(amountMatch, "")
    .replace(/\b(beli|bayar|byr|co|checkout|pembayaran)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!item) item = "Pengeluaran";
  return item.charAt(0).toUpperCase() + item.slice(1);
}

export function parseExpenseMessage(
  text: string,
  categories: CategoryRow[],
): ParsedTransaction | null {
  const cleaned = text.trim();
  if (!cleaned || cleaned.length < 3) return null;

  let amount: number | null = null;
  let amountMatch = "";

  for (const pattern of AMOUNT_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      amountMatch = match[0];
      amount = parseAmount(match[0]);
      if (amount && amount > 0) break;
    }
  }

  if (!amount || amount <= 0) return null;

  const category = detectCategory(cleaned, categories);
  const item = extractItem(cleaned, amountMatch);

  return { item, amount, category };
}

export function getTodayJakarta(): { date: string; month: string } {
  return getTodayFromJakarta();
}

export { getNowJakartaDateTime as getNowJakarta };
