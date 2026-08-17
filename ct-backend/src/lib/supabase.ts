import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Env } from "../config/env.js";
import { isSupabaseConfigured } from "../config/env.js";

let supabaseAdmin: SupabaseClient | null = null;

export function initSupabase(env: Env): SupabaseClient | null {
  if (!isSupabaseConfigured(env)) {
    return null;
  }

  supabaseAdmin = createClient(
    env.SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  return supabaseAdmin;
}

export function getSupabaseAdmin(): SupabaseClient | null {
  return supabaseAdmin;
}
