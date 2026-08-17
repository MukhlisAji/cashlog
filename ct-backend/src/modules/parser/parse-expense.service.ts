import type { Env } from "../../config/env.js";
import { createLlmParser, isLlmConfigured } from "../../lib/llm/index.js";
import type { ReceiptLineItem } from "../../lib/llm/llm.types.js";
import type { CategoryRow } from "../config/config.repository.js";

import { parseExpenseMessage } from "./parse-message.service.js";

export interface ExpenseParseResult {
  item: string;
  amount: number;
  category: string;
  note?: string;
  source: "rule" | "llm";
}

export interface ReceiptParseResult {
  merchant?: string;
  total: number;
  items: ReceiptLineItem[];
  note?: string;
  source: "llm";
}

export async function parseExpense(
  env: Env,
  text: string,
  categories: CategoryRow[],
): Promise<ExpenseParseResult | null> {
  const cleaned = text.trim();
  if (!cleaned || cleaned.length < 2) return null;

  const mode = env.PARSER_MODE;

  if (mode !== "llm") {
    const ruleResult = parseExpenseMessage(cleaned, categories);
    if (ruleResult) {
      return { ...ruleResult, source: "rule" };
    }
  }

  if (mode === "rule" || !isLlmConfigured(env)) {
    return null;
  }

  const llm = createLlmParser(env);
  if (!llm) return null;

  try {
    const llmResult = await llm.parseExpense(cleaned, categories);
    if (!llmResult || llmResult.intent !== "expense") return null;

    return {
      item: llmResult.item,
      amount: llmResult.amount,
      category: llmResult.category,
      note: llmResult.note,
      source: "llm",
    };
  } catch (error) {
    console.error("[parse-expense] LLM failed:", error);
    return null;
  }
}

export async function parseExpenseFromReceipt(
  env: Env,
  imageBuffer: Buffer,
  mimeType: string,
  categories: CategoryRow[],
): Promise<ReceiptParseResult | null> {
  if (!isLlmConfigured(env)) return null;

  const llm = createLlmParser(env);
  if (!llm) return null;

  const base64 = imageBuffer.toString("base64");

  try {
    const llmResult = await llm.parseExpenseFromReceipt(
      base64,
      mimeType,
      categories,
    );
    if (!llmResult || llmResult.intent !== "expense") return null;
    if (llmResult.items.length === 0) return null;

    return {
      merchant: llmResult.merchant,
      total: llmResult.total,
      items: llmResult.items,
      note: llmResult.note,
      source: "llm",
    };
  } catch (error) {
    console.error("[parse-expense] Receipt vision failed:", error);
    return null;
  }
}

export function formatReceiptSaveReply(parsed: ReceiptParseResult): string {
  const formatRp = (n: number) => new Intl.NumberFormat("id-ID").format(n);
  const count = parsed.items.length;
  const merchantLabel = parsed.merchant ? ` (${parsed.merchant})` : "";

  if (count === 1) {
    const line = parsed.items[0]!;
    return `✅ Tercatat dari struk${merchantLabel}: ${line.item} — Rp ${formatRp(line.amount)} (${line.category})`;
  }

  const lines = parsed.items.slice(0, 5).map(
    (line, i) =>
      `${i + 1}. ${line.item} — Rp ${formatRp(line.amount)} (${line.category})`,
  );

  if (count > 5) {
    lines.push(`… +${count - 5} item lagi`);
  }

  return [
    `✅ Tercatat dari struk${merchantLabel} — ${count} item, total Rp ${formatRp(parsed.total)}`,
    "",
    ...lines,
  ].join("\n");
}
