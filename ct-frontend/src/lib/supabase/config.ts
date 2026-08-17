export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Valid-looking placeholders so @supabase/ssr client ctor does not throw */
export const SUPABASE_PLACEHOLDER = {
  url: "https://placeholder.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDB9.demo",
} as const;

export function getSupabaseCredentials(): {
  url: string;
  anonKey: string;
} {
  if (isSupabaseConfigured()) {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    };
  }
  return SUPABASE_PLACEHOLDER;
}
