import type { CategoryRow } from "../../modules/config/config.repository.js";

export type ParseIntent = "expense" | "unknown";

export interface ParsedExpense {
  intent: ParseIntent;
  item: string;
  amount: number;
  category: string;
  note?: string;
}

export interface ReceiptLineItem {
  item: string;
  amount: number;
  category: string;
}

export interface ParsedReceiptExpense {
  intent: "expense";
  merchant?: string;
  total: number;
  items: ReceiptLineItem[];
  note?: string;
}

export interface LlmParser {
  parseExpense(text: string, categories: CategoryRow[]): Promise<ParsedExpense | null>;
  parseExpenseFromReceipt(
    imageBase64: string,
    mimeType: string,
    categories: CategoryRow[],
  ): Promise<ParsedReceiptExpense | null>;
}

export type ParserMode = "hybrid" | "rule" | "llm";
export type LlmProvider = "openai" | "gemini";
