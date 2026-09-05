// The final render's time contract (S4). One absolute attempt budget per
// execution mode, pinned by test under the route that runs it; the app's own
// stale threshold pinned above the budget so a live attempt is never reclaimed
// by the retry affordance; and the views window covering the whole attempt.
//
// Queue mode (production): the consumer route declares an 800 s maxDuration;
// the attempt gets 700 s and every paid call receives what is left of it, the
// rest being the reserve for persistence and revalidation. Inline mode (local
// dev, and the production fallback when enqueueing fails) runs inside whichever
// page route posted the action, each of which declares 300 s.
//
// Worst case at every provider maximum (a 240 s image call, 90 s text calls) a
// single delivery cannot hold the hero, a hero retry, two views and their
// checks; the hero retry takes priority because the hero commits once while
// views are repairable by redelivery, and a view the budget could not start is
// left for the next delivery. At the primary provider's observed 20 to 60 s per
// image the whole set completes in one delivery.

export const FINAL_RENDER_ATTEMPT_BUDGET_MS = 700_000;
export const FINAL_RENDER_INLINE_BUDGET_MS = 255_000;
// Persistence, asset writes and revalidation after the last paid call.
export const FINAL_RENDER_ATTEMPT_RESERVE_MS = 40_000;

export type FinalRenderExecutionPath = "queue" | "inline" | "inline-fallback";

export function finalRenderAttemptBudgetMs(executionPath: string | null | undefined): number {
  return executionPath === "inline" || executionPath === "inline-fallback"
    ? FINAL_RENDER_INLINE_BUDGET_MS
    : FINAL_RENDER_ATTEMPT_BUDGET_MS;
}

// How long a final-render job may sit in `running`/`queued` before it is treated as stalled.
//
// A job whose attempt never completes (the in-request task was abandoned, the function was
// torn down, or a provider call hung past the function's budget) stays `running` with no
// recovery. This threshold bounds that: generateFinalRenderAction fails a stalled job on the
// next attempt instead of reporting "already running", and the presentation page drops out of
// its progress spinner into a retry affordance.
//
// It sits ABOVE the attempt budget for the job's execution path: an attempt still inside its
// budget is live by definition, and reclaiming it would fail a render that is about to commit
// (the success write then matches zero rows and discards the paid image). In queue mode a
// dead delivery is redelivered by the queue after 60 s, so this is only the inline backstop.
export function finalRenderStaleMs(executionPath: string | null | undefined): number {
  return finalRenderAttemptBudgetMs(executionPath) + 60_000;
}

export const FINAL_RENDER_STALE_MS = finalRenderStaleMs("queue");

export function isRenderJobStalled(
  status: string | null | undefined,
  createdAt: string | null | undefined,
  now: number = Date.now(),
  executionPath: string | null | undefined = undefined
): boolean {
  if (status !== "running" && status !== "queued") {
    return false;
  }
  if (!createdAt) {
    return false;
  }
  const startedAt = Date.parse(createdAt);
  return Number.isFinite(startedAt) && now - startedAt > finalRenderStaleMs(executionPath);
}

// How long after a hero render the presentation keeps polling for the planned views. The
// views generate in the same attempt right after the hero commits, so the window is the
// attempt budget; if they have not appeared by then the attempt did not produce them, and
// a redelivery (queue mode) shows up through the views job's status instead.
export const FINAL_RENDER_VIEWS_WINDOW_MS = FINAL_RENDER_ATTEMPT_BUDGET_MS;

// S4 (AC 11): "render again" on a succeeded render is honoured only for the
// job the reveal named, and only when its placement review ended unresolved
// or could not run. A render that passed review keeps the "Final render is
// ready" redirect, so resubmitting the form cannot re-render a good room for
// free; the paid re-render path is unchanged.
export function finalRenderRetryHonoured(
  retryOf: string | null | undefined,
  latestJob: { id: string; status: string | null; input_summary: unknown } | null | undefined
): boolean {
  if (!retryOf || !latestJob || latestJob.id !== retryOf || latestJob.status !== "succeeded") {
    return false;
  }
  const summary =
    latestJob.input_summary && typeof latestJob.input_summary === "object"
      ? (latestJob.input_summary as { spatialQaOutcome?: unknown })
      : {};
  return summary.spatialQaOutcome === "unresolved" || summary.spatialQaOutcome === "unreviewed";
}

export function isWithinFinalRenderViewsWindow(
  createdAt: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!createdAt) {
    return false;
  }
  const startedAt = Date.parse(createdAt);
  return Number.isFinite(startedAt) && now - startedAt < FINAL_RENDER_VIEWS_WINDOW_MS;
}
