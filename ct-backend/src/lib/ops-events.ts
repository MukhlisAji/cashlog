import { getSupabaseAdmin } from "./supabase.js";

export async function recordOpsEvent(input: {
  kind: string;
  ok: boolean;
  userId?: string | null;
  message?: string | null;
}): Promise<void> {
  try {
    const client = getSupabaseAdmin();
    if (!client) return;
    await client.from("ops_events").insert({
      kind: input.kind,
      ok: input.ok,
      user_id: input.userId ?? null,
      message: input.message?.slice(0, 500) ?? null,
    });
  } catch {
    // Never block product flows on metrics.
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
