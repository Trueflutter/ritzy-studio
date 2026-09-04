import type { Database } from "@ritzy-studio/db";

import type { ServiceSupabaseClient } from "./supabase-clients";

// Every paid call opens an ai_jobs row before it and closes it after. A close
// that fails silently leaves the row `running`, which is worse than a lost log
// line: the dedupe on each of these paths reads a running row as a live
// generation and refuses the user a retry until its window expires, and the
// spend on that row is never recorded, so no per-room total can see it.
//
// One bounded retry, then a loud line naming the job and the status it was
// meant to reach. Not a lease or a CAS: these rows are closed by the same
// invocation that opened them, and each caller's dedupe window bounds how long
// a genuinely stuck row can block a retry. What this removes is the silent case.
export async function closeAiJob(
  serviceSupabase: ServiceSupabaseClient,
  jobId: string,
  payload: Database["public"]["Tables"]["ai_jobs"]["Update"],
  label: string
): Promise<{ closed: boolean }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await serviceSupabase.from("ai_jobs").update(payload).eq("id", jobId);
    if (!error) {
      return { closed: true };
    }
    if (attempt === 1) {
      console.error(`Could not close ${label} job ${jobId} (${payload.status}): ${error.message}`);
      return { closed: false };
    }
  }
  return { closed: false };
}
