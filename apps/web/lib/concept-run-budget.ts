// Concept generation is one function invocation, and slice S3b adds a paid
// call to the front of it. The anchor set pass now runs BEFORE the render, so
// the two share a deadline that a hard platform kill would end with no catch
// path, no cost recorded, and a job stuck "running". The partition lives here
// rather than in whichever call happens to start first.

// Under the concepts route's 300 s maxDuration, with headroom for the response.
export const CONCEPT_RUN_BUDGET_MS = 285_000;

// Writing the concept row, uploading the render, linking the asset, and
// recording the anchors. The concept views are deferred and outside this.
export const CONCEPT_PERSIST_RESERVE_MS = 25_000;

// What the render itself must always keep: the direction call and the image
// generation. Measured on the anchored prototype at roughly 90 s end to end on
// the primary provider; the reserve is nearly double that, because a render
// that cannot finish is the whole product failing, while an anchor pass that
// cannot finish costs only the pass.
export const CONCEPT_RENDER_RESERVE_MS = 170_000;

// Reading the catalogue, building the shortlists and fetching the candidate
// photographs. No paid call, but it is the pass's own pre-work and has to be
// inside the budget rather than added to it.
export const ANCHOR_PREP_MAX_MS = 30_000;

// The aesthetic set pass's ceiling when the whole budget is available, and the
// point below which starting it would only burn tokens on a call that cannot
// return. Under the floor the room falls back to the ranked shortlist, which
// is the same path a room takes when the pass is unavailable entirely.
export const ANCHOR_SET_MAX_MS = 60_000;
export const ANCHOR_SET_FLOOR_MS = 25_000;

// The provider deadline sits under the service guard so the SDK aborts first
// and the guard is only a backstop.
export const ANCHOR_PROVIDER_HEADROOM_MS = 8_000;

function remainingMs(startedAt: number, now: number, runBudgetMs: number) {
  return runBudgetMs - Math.max(0, now - startedAt);
}

// The guard for the anchor pre-work. It reserves the render and persistence,
// so a slow catalogue read or a stalled retailer CDN cannot be the reason a
// room gets no concept at all.
export function anchorPrepTimeoutMs({
  startedAt,
  now,
  runBudgetMs = CONCEPT_RUN_BUDGET_MS
}: {
  startedAt: number;
  now: number;
  runBudgetMs?: number;
}): number | null {
  const available =
    remainingMs(startedAt, now, runBudgetMs) - CONCEPT_PERSIST_RESERVE_MS - CONCEPT_RENDER_RESERVE_MS - ANCHOR_SET_MAX_MS;
  const timeout = Math.min(ANCHOR_PREP_MAX_MS, available);
  return timeout > 0 ? timeout : null;
}

// The guard for the pass itself, taken after the pre-work, so the fetches are
// inside the budget rather than added to it.
export function anchorSetTimeoutMs({
  startedAt,
  now,
  runBudgetMs = CONCEPT_RUN_BUDGET_MS
}: {
  startedAt: number;
  now: number;
  runBudgetMs?: number;
}): number | null {
  const available =
    remainingMs(startedAt, now, runBudgetMs) - CONCEPT_PERSIST_RESERVE_MS - CONCEPT_RENDER_RESERVE_MS;
  const timeout = Math.min(ANCHOR_SET_MAX_MS, available);
  return timeout >= ANCHOR_SET_FLOOR_MS ? timeout : null;
}

export function anchorProviderTimeoutMs(guardMs: number): number {
  return Math.max(1_000, guardMs - ANCHOR_PROVIDER_HEADROOM_MS);
}
