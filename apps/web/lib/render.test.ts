import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  FINAL_RENDER_ATTEMPT_BUDGET_MS,
  FINAL_RENDER_ATTEMPT_RESERVE_MS,
  FINAL_RENDER_INLINE_BUDGET_MS,
  FINAL_RENDER_STALE_MS,
  FINAL_RENDER_VIEWS_WINDOW_MS,
  finalRenderAttemptBudgetMs,
  finalRenderRetryHonoured,
  finalRenderStaleMs,
  isRenderJobStalled,
  isWithinFinalRenderViewsWindow
} from "./render";

const now = 1_000_000_000_000;
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

// Not stalled: terminal or absent states.
assert.equal(isRenderJobStalled("succeeded", iso(FINAL_RENDER_STALE_MS * 2), now), false);
assert.equal(isRenderJobStalled("failed", iso(FINAL_RENDER_STALE_MS * 2), now), false);
assert.equal(isRenderJobStalled(null, iso(FINAL_RENDER_STALE_MS * 2), now), false);
assert.equal(isRenderJobStalled("running", null, now), false);
assert.equal(isRenderJobStalled("running", "not-a-date", now), false);

// Running/queued but young: still legitimately in progress.
assert.equal(isRenderJobStalled("running", iso(FINAL_RENDER_STALE_MS - 1_000), now), false);
assert.equal(isRenderJobStalled("queued", iso(60_000), now), false);

// Running/queued past the threshold: stalled.
assert.equal(isRenderJobStalled("running", iso(FINAL_RENDER_STALE_MS + 1_000), now), true);
assert.equal(isRenderJobStalled("queued", iso(FINAL_RENDER_STALE_MS + 1_000), now), true);

// Views window: poll for the extra angles only while the render is recent.
assert.equal(isWithinFinalRenderViewsWindow(iso(60_000), now), true);
assert.equal(isWithinFinalRenderViewsWindow(iso(FINAL_RENDER_VIEWS_WINDOW_MS - 1_000), now), true);
assert.equal(isWithinFinalRenderViewsWindow(iso(FINAL_RENDER_VIEWS_WINDOW_MS + 1_000), now), false);
assert.equal(isWithinFinalRenderViewsWindow(null, now), false);
assert.equal(isWithinFinalRenderViewsWindow("not-a-date", now), false);

// S4 (AC 14, time half): one absolute attempt budget per execution mode, pinned
// under the route that runs it; the app's own stale threshold pinned above the
// budget so it can never reclaim a live attempt; the views window covering the
// whole attempt.
{
  const literal = (route: string) => {
    const source = readFileSync(path.resolve(__dirname, route), "utf8");
    const declared = source.match(/^export const maxDuration = (\d+);$/m);
    assert.ok(declared, `${route} must export a literal maxDuration`);
    return Number(declared[1]) * 1000;
  };

  const queueRoute = literal("../app/api/queues/final-render/route.ts");
  assert.ok(
    FINAL_RENDER_ATTEMPT_BUDGET_MS + FINAL_RENDER_ATTEMPT_RESERVE_MS <= queueRoute,
    "the queue attempt budget plus its reserve sits inside the consumer route"
  );
  for (const route of [
    "../app/projects/[projectId]/rooms/[roomId]/product-matching/page.tsx",
    "../app/projects/[projectId]/rooms/[roomId]/shopping-list/page.tsx",
    "../app/projects/[projectId]/rooms/[roomId]/presentation/page.tsx"
  ]) {
    assert.ok(
      FINAL_RENDER_INLINE_BUDGET_MS + FINAL_RENDER_ATTEMPT_RESERVE_MS <= literal(route),
      `the inline attempt budget plus its reserve sits inside ${route}`
    );
  }
  assert.equal(finalRenderAttemptBudgetMs("queue"), FINAL_RENDER_ATTEMPT_BUDGET_MS);
  assert.equal(finalRenderAttemptBudgetMs("inline"), FINAL_RENDER_INLINE_BUDGET_MS);
  assert.equal(finalRenderAttemptBudgetMs("inline-fallback"), FINAL_RENDER_INLINE_BUDGET_MS);
  assert.equal(finalRenderAttemptBudgetMs(undefined), FINAL_RENDER_ATTEMPT_BUDGET_MS, "unknown reads as the longer budget");

  // The stale threshold follows the execution path: a queue attempt is live
  // for its whole budget plus a minute; an inline attempt for its own.
  assert.ok(finalRenderStaleMs("queue") >= FINAL_RENDER_ATTEMPT_BUDGET_MS + 60_000);
  assert.ok(finalRenderStaleMs("inline") >= FINAL_RENDER_INLINE_BUDGET_MS + 60_000);
  assert.ok(finalRenderStaleMs("inline") < finalRenderStaleMs("queue"));
  assert.equal(finalRenderStaleMs(undefined), finalRenderStaleMs("queue"), "unknown reads as the longer threshold");
  assert.equal(FINAL_RENDER_STALE_MS, finalRenderStaleMs("queue"));
  assert.ok(FINAL_RENDER_VIEWS_WINDOW_MS >= FINAL_RENDER_ATTEMPT_BUDGET_MS, "the views window covers the whole attempt");

  // isRenderJobStalled honours the execution path.
  assert.equal(isRenderJobStalled("running", iso(FINAL_RENDER_INLINE_BUDGET_MS + 61_000), now, "inline"), true);
  assert.equal(isRenderJobStalled("running", iso(FINAL_RENDER_INLINE_BUDGET_MS + 61_000), now, "queue"), false);
}

// S4 (AC 11): the retry branch of the render action, as a rule the double
// cannot host ("use server" module): honoured only for the named job, only
// when its review ended unresolved or could not run.
{
  const job = (outcome: string | null, status = "succeeded") => ({ id: "job-1", status, input_summary: outcome ? { spatialQaOutcome: outcome } : {} });
  assert.equal(finalRenderRetryHonoured("job-1", job("unresolved")), true);
  assert.equal(finalRenderRetryHonoured("job-1", job("unreviewed")), true);
  assert.equal(finalRenderRetryHonoured("job-1", job("passed")), false, "a passed render is not re-rendered by resubmitting");
  assert.equal(finalRenderRetryHonoured("job-1", job("resolved_after_regeneration")), false);
  assert.equal(finalRenderRetryHonoured("job-1", job(null)), false);
  assert.equal(finalRenderRetryHonoured("job-2", job("unresolved")), false, "only the job the reveal named");
  assert.equal(finalRenderRetryHonoured(null, job("unresolved")), false);
  assert.equal(finalRenderRetryHonoured("job-1", job("unresolved", "failed")), false);
  assert.equal(finalRenderRetryHonoured("job-1", null), false);
}

console.log("render.test.ts: all assertions passed");
