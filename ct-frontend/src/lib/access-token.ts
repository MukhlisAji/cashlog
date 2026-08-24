import { createClient } from "@/lib/supabase/client";

/**
 * Access token validated with Supabase Auth.
 * getSession() alone can return a JWT after auth.users was wiped → API 401.
 */
export async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    await supabase.auth.signOut();
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
