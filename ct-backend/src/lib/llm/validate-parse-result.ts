import type { CategoryRow } from "../../modules/config/config.repository.js";

import type {
  ParsedExpense,
  ParsedReceiptExpense,
  ReceiptLineItem,
} from "./llm.types.js";

const MAX_AMOUNT = 5_000_000_000;
const MAX_ITEM_LENGTH = 120;
const MAX_RECEIPT_ITEMS = 25;

export function validateParsedExpense(
  raw: unknown,
  categories: CategoryRow[],
): ParsedExpense | null {
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;
  const intent = data.intent === "expense" ? "expense" : "unknown";

  if (intent !== "expense") return null;

  const amount =
    typeof data.amount === "number"
      ? data.amount
      : typeof data.amount === "string"
        ? parseInt(data.amount.replace(/\D/g, ""), 10)
        : NaN;

  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return null;
  }

  let item = typeof data.item === "string" ? data.item.trim() : "";
  if (!item) item = "Pengeluaran";
  item = item.slice(0, MAX_ITEM_LENGTH);
  item = item.charAt(0).toUpperCase() + item.slice(1);

  const categoryNames = categories.map((c) => c.name);
  let category =
    typeof data.category === "string" ? data.category.trim() : "";

  if (!categoryNames.includes(category)) {
    const lower = category.toLowerCase();
    const match = categories.find((c) => c.name.toLowerCase() === lower);
    category = match?.name ?? "Lainnya";
  }

  const note =
    typeof data.note === "string" && data.note.trim()
      ? data.note.trim().slice(0, 200)
      : undefined;

  return {
    intent: "expense",
    item,
    amount: Math.round(amount),
    category,
    note,
  };
}

function normalizeCategory(
  raw: unknown,
  categories: CategoryRow[],
): string {
  const categoryNames = categories.map((c) => c.name);
  let category = typeof raw === "string" ? raw.trim() : "";

  if (!categoryNames.includes(category)) {
    const lower = category.toLowerCase();
    const match = categories.find((c) => c.name.toLowerCase() === lower);
    category = match?.name ?? "Lainnya";
  }

  return category;
}

function normalizeLineItem(
  raw: unknown,
  categories: CategoryRow[],
): ReceiptLineItem | null {
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;
  const amount =
    typeof data.amount === "number"
      ? data.amount
      : typeof data.amount === "string"
        ? parseInt(data.amount.replace(/\D/g, ""), 10)
        : NaN;

  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return null;
  }

  let item = typeof data.item === "string" ? data.item.trim() : "";
  if (!item) item = "Pengeluaran";
  item = item.slice(0, MAX_ITEM_LENGTH);
  item = item.charAt(0).toUpperCase() + item.slice(1);

  return {
    item,
    amount: Math.round(amount),
    category: normalizeCategory(data.category, categories),
  };
}

export function validateParsedReceiptExpense(
  raw: unknown,
  categories: CategoryRow[],
): ParsedReceiptExpense | null {
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;
  if (data.intent !== "expense") return null;

  const merchant =
    typeof data.merchant === "string" && data.merchant.trim()
      ? data.merchant.trim().slice(0, MAX_ITEM_LENGTH)
      : undefined;

  const note =
    typeof data.note === "string" && data.note.trim()
      ? data.note.trim().slice(0, 200)
      : undefined;

  let items: ReceiptLineItem[] = [];

  if (Array.isArray(data.items)) {
    for (const entry of data.items.slice(0, MAX_RECEIPT_ITEMS)) {
      const line = normalizeLineItem(entry, categories);
      if (line) items.push(line);
    }
  }

  // Fallback: legacy single-line receipt response
  if (items.length === 0) {
    const single = validateParsedExpense(raw, categories);
    if (!single) return null;
    items = [
      {
        item: single.item,
        amount: single.amount,
        category: single.category,
      },
    ];
  }

  const itemsTotal = items.reduce((sum, line) => sum + line.amount, 0);
  const totalRaw =
    typeof data.total === "number"
      ? data.total
      : typeof data.total === "string"
        ? parseInt(data.total.replace(/\D/g, ""), 10)
        : NaN;

  const total =
    Number.isFinite(totalRaw) && totalRaw > 0
      ? Math.round(totalRaw)
      : itemsTotal;

  return {
    intent: "expense",
    merchant,
    total,
    items,
    note,
  };
}
