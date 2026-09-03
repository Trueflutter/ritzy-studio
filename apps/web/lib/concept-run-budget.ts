import { providerDeadlineMs, remainingMs, stageGuardMs } from "@/lib/run-budget";

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
// generation. Ten live runs put the whole render at 40 to 60 s on the primary
// provider, and the reserve is more than triple that because it also has to
// hold the fallback's own window: the fallback needs well over a minute, and a
// share too small for it to return is not a slow attempt but a guaranteed
// abort. A render that cannot finish is the whole product failing, while an
// anchor pass that cannot finish costs only the pass.
export const CONCEPT_RENDER_RESERVE_MS = 195_000;

// What the render must keep no matter what, as opposed to what it is aimed at.
// The reserve above is the target; this is the point below which anchoring is
// not attempted at all. The distinction matters because everything BEFORE the
// anchor stage — eight database round trips, up to three room photos and six
// inspiration images through storage and sharp — is real time that has to come
// out of somewhere. Charging it to the anchor allowance made anchoring switch
// itself off on a room with a lot of images, silently, with the run falling
// back to search matching: the one-in-eight in-stock hit rate this slice
// exists to replace. It comes out of the render's headroom instead.
export const CONCEPT_RENDER_FLOOR_MS = 90_000;

// Reading the catalogue, building the shortlists and fetching the candidate
// photographs. No paid call, but it is the pass's own pre-work and has to be
// inside the budget rather than added to it.
// Measured across ten live runs: the catalogue read and twenty photograph
// fetches land well inside this. The ceiling is what a degraded dependency is
// allowed to take, not what the work needs.
export const ANCHOR_PREP_MAX_MS = 20_000;
// Below this the catalogue read cannot land, so issuing it only spends the
// budget the render needs and then abandons the connection.
export const ANCHOR_PREP_FLOOR_MS = 5_000;

// The aesthetic set pass's ceiling when the whole budget is available, and the
// point below which starting it would only burn tokens on a call that cannot
// return. Under the floor the room falls back to the ranked shortlist, which
// is the same path a room takes when the pass is unavailable entirely.
export const ANCHOR_SET_MAX_MS = 45_000;
export const ANCHOR_SET_FLOOR_MS = 25_000;

// The provider deadline sits under the service guard so the SDK aborts first
// and the guard is only a backstop.
export const ANCHOR_PROVIDER_HEADROOM_MS = 8_000;

// The guard for the anchor pre-work. It reserves the render and persistence,
// so a slow catalogue read or a stalled retailer CDN cannot be the reason a
// room gets no concept at all.
export function anchorPrepTimeoutMs({
  startedAt,
  stageStartedAt,
  now,
  runBudgetMs = CONCEPT_RUN_BUDGET_MS
}: {
  startedAt: number;
  // When the anchor stage itself began. Its allowance is measured from here,
  // not from the top of the request, so work done before it is charged to the
  // render's headroom rather than to the anchor budget.
  stageStartedAt: number;
  now: number;
  runBudgetMs?: number;
}): number | null {
  return stageGuardMs({
    availableMs: Math.min(
      remainingMs(startedAt, now, runBudgetMs) - CONCEPT_PERSIST_RESERVE_MS - CONCEPT_RENDER_FLOOR_MS - ANCHOR_SET_MAX_MS,
      ANCHOR_PREP_MAX_MS - Math.max(0, now - stageStartedAt)
    ),
    maxMs: ANCHOR_PREP_MAX_MS,
    floorMs: ANCHOR_PREP_FLOOR_MS
  });
}

// The guard for the pass itself, taken after the pre-work, so the fetches are
// inside the budget rather than added to it.
export function anchorSetTimeoutMs({
  startedAt,
  stageStartedAt,
  now,
  runBudgetMs = CONCEPT_RUN_BUDGET_MS
}: {
  startedAt: number;
  stageStartedAt: number;
  now: number;
  runBudgetMs?: number;
}): number | null {
  return stageGuardMs({
    availableMs: Math.min(
      remainingMs(startedAt, now, runBudgetMs) - CONCEPT_PERSIST_RESERVE_MS - CONCEPT_RENDER_FLOOR_MS,
      ANCHOR_PREP_MAX_MS + ANCHOR_SET_MAX_MS - Math.max(0, now - stageStartedAt)
    ),
    maxMs: ANCHOR_SET_MAX_MS,
    floorMs: ANCHOR_SET_FLOOR_MS
  });
}

export function anchorProviderTimeoutMs(guardMs: number): number {
  return providerDeadlineMs(guardMs, ANCHOR_PROVIDER_HEADROOM_MS);
}

// What the render may still take, once the anchor work has spent its share.
// The reserve above is what the anchor guards hold back FOR the render; this is
// what the render is actually held to, and the two have to be the same number
// or the reserve is an assumption rather than a budget. The image providers'
// own ceilings (300 s of polling, a 240 s call) outlast this route, so nothing
// else bounds them.
export function conceptRenderTimeoutMs({
  startedAt,
  now,
  runBudgetMs = CONCEPT_RUN_BUDGET_MS
}: {
  startedAt: number;
  now: number;
  runBudgetMs?: number;
}): number {
  const available = remainingMs(startedAt, now, runBudgetMs) - CONCEPT_PERSIST_RESERVE_MS;
  // Never below a floor: a render started with seconds left cannot succeed, but
  // refusing to render at all is worse than trying, because the room then has
  // no concept while the shopper waited for one.
  return Math.max(30_000, Math.min(CONCEPT_RENDER_RESERVE_MS, available));
}
