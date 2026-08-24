import { getSupabaseAdmin } from "./supabase.js";

const memoryLocks = new Set<string>();

/**
 * Claim a one-shot job key (e.g. `evening-reminder:2026-08-23`).
 * Survives process restart via `scheduler_job_runs`.
 */
export async function claimSchedulerJob(jobKey: string): Promise<boolean> {
  if (memoryLocks.has(jobKey)) return false;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    memoryLocks.add(jobKey);
    return true;
  }

  const { error } = await supabase
    .from("scheduler_job_runs")
    .insert({ job_key: jobKey });

  if (error?.code === "23505") return false;
  if (error) {
    console.error("[scheduler-lock] claim failed", jobKey, error.message);
    return false;
  }

  memoryLocks.add(jobKey);
  return true;
}

/** Release after a failed batch so the next tick can retry. */
export async function releaseSchedulerJob(jobKey: string): Promise<void> {
  memoryLocks.delete(jobKey);
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { error } = await supabase
    .from("scheduler_job_runs")
    .delete()
    .eq("job_key", jobKey);
  if (error) {
    console.error("[scheduler-lock] release failed", jobKey, error.message);
  }
}
