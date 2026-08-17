import type { CategoryRow } from "../../modules/config/config.repository.js";

import type { LlmParser, ParsedExpense, ParsedReceiptExpense } from "./llm.types.js";
import { buildSystemPrompt, buildUserPrompt, buildReceiptVisionPrompt } from "./parse-expense.prompt.js";
import {
  validateParsedExpense,
  validateParsedReceiptExpense,
} from "./validate-parse-result.js";

export class OpenAiParser implements LlmParser {
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async parseExpense(
    text: string,
    categories: CategoryRow[],
  ): Promise<ParsedExpense | null> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt(categories) },
          { role: "user", content: buildUserPrompt(text) },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${err.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = json.choices?.[0]?.message?.content;
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
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt(categories) },
          {
            role: "user",
            content: [
              { type: "text", text: buildReceiptVisionPrompt() },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${err.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    try {
      const parsed = JSON.parse(content) as unknown;
      return validateParsedReceiptExpense(parsed, categories);
    } catch {
      return null;
    }
  }
}
