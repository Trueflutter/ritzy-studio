import { textTimeoutMs } from "@ritzy-studio/ai";

// Lease semantics for spec extraction (PR #332 review fix).
//
// The paid vision call runs in a detached after() task, so a `running` ai_jobs
// row is a LEASE, not a promise: it is trustworthy only for as long as an honest
// run can possibly take. Past that, the run is provably dead (its function
// either reported a terminal state or was torn down), and the next reader
// reclaims the row instead of reporting "already running" for a quarter of an
// hour. The window is derived from the provider deadline, never guessed.
//
// SPEC_EXTRACTION_ROUTE_MAX_DURATION_S mirrors the literal `maxDuration`
// exported by every route that schedules an extraction (/spec, /concepts).
// Segment config must be a literal, so the number lives in two places; the
// test beside this file reads both routes and pins their literal to this
// number, and pins the default lease inside it.
export const SPEC_EXTRACTION_ROUTE_MAX_DURATION_S = 300;

// Storage download, schema parse, the persistence writes, and the gap between
// the response finishing and the after() task starting.
export const SPEC_EXTRACTION_OVERHEAD_MS = 30_000;

export function specExtractionLeaseMs(
  env: { RITZY_TEXT_TIMEOUT_MS?: string } = { RITZY_TEXT_TIMEOUT_MS: process.env.RITZY_TEXT_TIMEOUT_MS }
): number {
  const routeBudgetMs = SPEC_EXTRACTION_ROUTE_MAX_DURATION_S * 1000;
  // A provider deadline longer than the route budget cannot be honoured (the
  // function dies first), so the lease is bounded by whichever ends sooner.
  return Math.min(textTimeoutMs(env), routeBudgetMs) + SPEC_EXTRACTION_OVERHEAD_MS;
}

// A live-looking job whose lease has run out. A start time that cannot be read
// counts as expired: liveness that cannot be proven is not a reason to lock the
// user out (created_at is NOT NULL in the schema, so this is defensive only).
export function isSpecExtractionStalled(
  status: string | null | undefined,
  createdAt: string | null | undefined,
  now: number,
  leaseMs: number
): boolean {
  if (status !== "running" && status !== "queued") {
    return false;
  }
  if (!createdAt) {
    return true;
  }
  const startedAt = Date.parse(createdAt);
  return !Number.isFinite(startedAt) || now - startedAt > leaseMs;
}
