// The /product-matching request is one function invocation. Palette
// extraction, the catalogue read and the candidate image fetch all run before
// the visual pass, so the pass gets what is LEFT of the run budget after a
// reserve for persistence, never a fixed slice that assumes nothing ran
// before it. A hard kill by the platform runs no catch path and would leave
// the paid job "running" with no cost recorded; the arithmetic here is what
// keeps a run inside the route's maxDuration (pinned by the test).

// Under the route's 300 s maxDuration, with headroom for the response.
export const PRODUCT_SOURCING_RUN_BUDGET_MS = 285_000;
// Writing the list, closing the job, and the redirect.
export const PRODUCT_SOURCING_PERSIST_RESERVE_MS = 20_000;
// The service guard around the pass when the whole budget is available.
export const PRODUCT_SOURCING_PASS_MAX_MS = 160_000;
// Below this the pass cannot finish; ranking is more honest than a timeout.
export const PRODUCT_SOURCING_PASS_FLOOR_MS = 30_000;
// The provider deadline sits under the service guard so the SDK aborts first
// and the guard is only a backstop.
export const PRODUCT_SOURCING_PROVIDER_HEADROOM_MS = 10_000;

// The service guard for the visual pass given when the run started, or null
// when too little of the run budget is left for the pass to finish.
export function visualPassTimeoutMs({
  startedAt,
  now,
  runBudgetMs = PRODUCT_SOURCING_RUN_BUDGET_MS,
  persistReserveMs = PRODUCT_SOURCING_PERSIST_RESERVE_MS,
  passMaxMs = PRODUCT_SOURCING_PASS_MAX_MS,
  passFloorMs = PRODUCT_SOURCING_PASS_FLOOR_MS
}: {
  startedAt: number;
  now: number;
  runBudgetMs?: number;
  persistReserveMs?: number;
  passMaxMs?: number;
  passFloorMs?: number;
}): number | null {
  const remaining = runBudgetMs - Math.max(0, now - startedAt) - persistReserveMs;
  const timeout = Math.min(passMaxMs, remaining);
  return timeout >= passFloorMs ? timeout : null;
}

// The provider deadline for a pass guarded at passTimeoutMs.
export function providerTimeoutMs(passTimeoutMs: number): number {
  return Math.max(1_000, passTimeoutMs - PRODUCT_SOURCING_PROVIDER_HEADROOM_MS);
}
