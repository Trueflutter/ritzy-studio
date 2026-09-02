// The /product-matching request is one function invocation and it makes TWO
// paid vision calls: the sourcing pass proposes a product per role, and the
// design check judges those proposals against the render. Both have to fit,
// with the catalogue read, the palette extraction, the image fetches and the
// persistence, inside the route's maxDuration. A hard kill by the platform
// runs no catch path and would leave the paid job "running" with no cost
// recorded, so the budget is partitioned here rather than left to whichever
// call happens to run first.

// Under the route's 300 s maxDuration, with headroom for the response.
export const PRODUCT_SOURCING_RUN_BUDGET_MS = 285_000;
// Writing the list, closing the job, and the redirect.
export const PRODUCT_SOURCING_PERSIST_RESERVE_MS = 20_000;
// The sourcing pass's own ceiling when the whole budget is available. Sized
// so the check still gets its full deadline after up to 45 s of pre-work
// (palette extraction, the catalogue read, the candidate image fetch), and at
// least its floor after up to 90 s of it.
export const PRODUCT_SOURCING_PASS_MAX_MS = 130_000;
// The design check's ceiling, and what the pass must leave behind for it. It
// matches the deadline the check declares for itself in the ai package: the
// budget must be sized by what the call needs, not by whatever is left after
// the pass. Measured on the five harness rooms the check returns in well
// under this for 3 to 16 proposals; the headroom is for a slow provider.
export const PRODUCT_SOURCING_CHECK_MAX_MS = 90_000;
// Below these, the call cannot finish; skipping it beats starting something
// that will time out, which costs the tokens and records no usage.
export const PRODUCT_SOURCING_PASS_FLOOR_MS = 30_000;
export const PRODUCT_SOURCING_CHECK_FLOOR_MS = 45_000;
// The provider deadline sits under the service guard so the SDK aborts first
// and the guard is only a backstop.
export const PRODUCT_SOURCING_PROVIDER_HEADROOM_MS = 10_000;

function remainingMs(startedAt: number, now: number, runBudgetMs: number) {
  return runBudgetMs - Math.max(0, now - startedAt);
}

// The service guard for the sourcing pass. It reserves the design check's
// ceiling as well as the persistence reserve: a pass that consumed everything
// would starve the check that has to judge its own proposals, and every role
// would open on a run that paid for a successful pass.
export function sourcingPassTimeoutMs({
  startedAt,
  now,
  runBudgetMs = PRODUCT_SOURCING_RUN_BUDGET_MS
}: {
  startedAt: number;
  now: number;
  runBudgetMs?: number;
}): number | null {
  const available =
    remainingMs(startedAt, now, runBudgetMs) - PRODUCT_SOURCING_PERSIST_RESERVE_MS - PRODUCT_SOURCING_CHECK_MAX_MS;
  const timeout = Math.min(PRODUCT_SOURCING_PASS_MAX_MS, available);
  return timeout >= PRODUCT_SOURCING_PASS_FLOOR_MS ? timeout : null;
}

// The service guard for the design check, taken after the pass and after the
// check's own image fetch, so both are inside the budget rather than added to
// it.
export function designCheckTimeoutMs({
  startedAt,
  now,
  runBudgetMs = PRODUCT_SOURCING_RUN_BUDGET_MS
}: {
  startedAt: number;
  now: number;
  runBudgetMs?: number;
}): number | null {
  const available = remainingMs(startedAt, now, runBudgetMs) - PRODUCT_SOURCING_PERSIST_RESERVE_MS;
  const timeout = Math.min(PRODUCT_SOURCING_CHECK_MAX_MS, available);
  return timeout >= PRODUCT_SOURCING_CHECK_FLOOR_MS ? timeout : null;
}

// The provider deadline for a call guarded at guardMs.
export function providerTimeoutMs(guardMs: number): number {
  return Math.max(1_000, guardMs - PRODUCT_SOURCING_PROVIDER_HEADROOM_MS);
}
