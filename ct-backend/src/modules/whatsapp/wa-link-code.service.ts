import { createHash, randomBytes } from "node:crypto";

import { getSupabaseAdmin } from "../../lib/supabase.js";
import { ensureLeadHousehold } from "../household/household.service.js";

const CODE_TTL_MS = 10 * 60 * 1000;
const LINK_PATTERN = /^(?:LINK|TAUTKAN)\s+([A-Z0-9]{8})$/i;

function hashCode(code: string): string {
  return createHash("sha256").update(code.toUpperCase()).digest("hex");
}

function generateCode(): string {
  return randomBytes(6)
    .toString("base64url")
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .padEnd(8, "X")
    .slice(0, 8);
}

function supabase() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

export function parseWhatsAppLinkCode(message: string | null): string | null {
  const match = message?.trim().match(LINK_PATTERN);
  return match?.[1]?.toUpperCase() ?? null;
}

export async function createWhatsAppLinkCode(userId: string) {
  await ensureLeadHousehold(userId);

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  const { error } = await supabase().from("whatsapp_link_codes").upsert(
    {
      user_id: userId,
      code_hash: hashCode(code),
      expires_at: expiresAt.toISOString(),
      used_at: null,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;

  return { code, expiresAt: expiresAt.toISOString() };
}

export async function claimWhatsAppLinkCode(code: string, phone: string) {
  const { data, error } = await supabase().rpc("claim_whatsapp_link_code", {
    p_code_hash: hashCode(code),
    p_phone_number: phone,
  });
  if (error) throw error;
  return typeof data === "string" ? data : null;
}
