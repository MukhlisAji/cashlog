import type { CategoryRow } from "../../modules/config/config.repository.js";

import type { LlmParser, ParsedExpense, ParsedReceiptExpense } from "./llm.types.js";
import { buildSystemPrompt, buildUserPrompt, buildReceiptVisionPrompt } from "./parse-expense.prompt.js";
import {
  validateParsedExpense,
  validateParsedReceiptExpense,
} from "./validate-parse-result.js";

export class GeminiParser implements LlmParser {
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async parseExpense(
    text: string,
    categories: CategoryRow[],
  ): Promise<ParsedExpense | null> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemPrompt(categories) }],
        },
        contents: [{ role: "user", parts: [{ text: buildUserPrompt(text) }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${err.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return null;

    try {
      const parsed = JSON.parse(content) as unknown;
      return validateParsedExpense(parsed, categories);
    } catch {
      return null;
    }
  }

  async parseExpenseFromReceipt(
    imageBase64: string,
    mimeType: string,
    categories: CategoryRow[],
  ): Promise<ParsedReceiptExpense | null> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemPrompt(categories) }],
        },
        contents: [
          {
            role: "user",
            parts: [
              { text: buildReceiptVisionPrompt() },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${err.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return null;

    try {
      const parsed = JSON.parse(content) as unknown;
      return validateParsedReceiptExpense(parsed, categories);
    } catch {
      return null;
    }
  }
}
