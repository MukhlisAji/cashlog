import { createBrowserClient } from "@supabase/ssr";

import { isDemoMode } from "@/lib/demo";

import { getSupabaseCredentials, isSupabaseConfigured } from "./config";

export function createClient() {
  const { url, anonKey } = getSupabaseCredentials();
  return createBrowserClient(url, anonKey);
}

export function canUseSupabaseAuth(): boolean {
  return isSupabaseConfigured() && !isDemoMode();
}
