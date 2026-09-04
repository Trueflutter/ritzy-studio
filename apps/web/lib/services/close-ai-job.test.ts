import assert from "node:assert/strict";

import { closeAiJob } from "./close-ai-job";
import { fakeSupabase, type RecordedCall } from "./supabase-test-double";

// Every paid call opens an ai_jobs row before it and closes it after. A close
// that failed silently left the row `running`, which the dedupe on each of
// these paths reads as a live generation: the user is refused a retry until the
// window expires, and the spend on that row is never recorded, so no per-room
// total can see it.

async function main() {
  // The ordinary case writes once.
  {
    const { client, calls } = fakeSupabase(() => ({ data: null }));
    const result = await closeAiJob(client, "job-1", { status: "succeeded" }, "anchor set pass");
    assert.deepEqual(result, { closed: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].table, "ai_jobs");
    assert.deepEqual(calls[0].filters, [["id", "job-1"]]);
  }

  // A transient failure is retried once and then succeeds.
  {
    let attempts = 0;
    const { client } = fakeSupabase(() => {
      attempts += 1;
      return attempts === 1 ? { error: { message: "connection reset" } } : { data: null };
    });
    assert.deepEqual(await closeAiJob(client, "job-1", { status: "succeeded" }, "anchor set pass"), { closed: true });
    assert.equal(attempts, 2);
  }

  // A persistent failure stops after the retry and REPORTS it, rather than
  // leaving the caller believing the row is closed.
  {
    const { client, calls } = fakeSupabase(() => ({ error: { message: "db down" } }));
    const result = await closeAiJob(client, "job-1", { status: "failed" }, "anchor set pass");
    assert.deepEqual(result, { closed: false });
    assert.equal(calls.filter((call: RecordedCall) => call.op === "update").length, 2, "bounded, not a loop");
  }
}

main()
  .then(() => console.log("close-ai-job tests passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
