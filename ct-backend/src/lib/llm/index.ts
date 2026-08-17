import type { Env } from "../../config/env.js";

import { GeminiParser } from "./gemini.parser.js";
import type { LlmParser } from "./llm.types.js";
import { OpenAiParser } from "./openai.parser.js";

export type { LlmParser, ParsedExpense, ParseIntent } from "./llm.types.js";

export function isLlmConfigured(env: Env): boolean {
  if (env.LLM_PROVIDER === "gemini") {
    return !!env.GEMINI_API_KEY;
  }
  return !!env.OPENAI_API_KEY;
}

export function createLlmParser(env: Env): LlmParser | null {
  if (env.LLM_PROVIDER === "gemini") {
    if (!env.GEMINI_API_KEY) return null;
    return new GeminiParser(env.GEMINI_API_KEY, env.GEMINI_MODEL);
  }

  if (!env.OPENAI_API_KEY) return null;
  return new OpenAiParser(env.OPENAI_API_KEY, env.OPENAI_MODEL);
}
