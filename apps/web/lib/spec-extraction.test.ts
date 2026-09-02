import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  SPEC_EXTRACTION_OVERHEAD_MS,
  SPEC_EXTRACTION_ROUTE_MAX_DURATION_S,
  isSpecExtractionStalled,
  specExtractionLeaseMs
} from "./spec-extraction";

const now = 1_000_000_000_000;
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
const routeBudgetMs = SPEC_EXTRACTION_ROUTE_MAX_DURATION_S * 1000;

// The lease follows the configured provider deadline plus the fixed overhead.
assert.equal(specExtractionLeaseMs({}), 90_000 + SPEC_EXTRACTION_OVERHEAD_MS, "default text deadline is 90s");
assert.equal(specExtractionLeaseMs({ RITZY_TEXT_TIMEOUT_MS: "3000" }), 3_000 + SPEC_EXTRACTION_OVERHEAD_MS);
assert.equal(specExtractionLeaseMs({ RITZY_TEXT_TIMEOUT_MS: "garbage" }), 90_000 + SPEC_EXTRACTION_OVERHEAD_MS);

// The route budget (the literal maxDuration on /spec and /concepts) must
// outlast the lease at the default deadline, or the function would be torn
// down before the provider deadline it is waiting on.
assert.ok(specExtractionLeaseMs({}) < routeBudgetMs, "default lease must fit inside the route budget");

// Segment config cannot be imported, so the routes that schedule the after()
// runner carry a literal that MUST mirror the constant the lease is derived
// from: a lowered or dropped maxDuration would tear the runner down before the
// provider deadline while the lease still promised the run was alive.
for (const route of [
  "../app/projects/[projectId]/rooms/[roomId]/spec/page.tsx",
  "../app/projects/[projectId]/rooms/[roomId]/concepts/page.tsx"
]) {
  const source = readFileSync(path.resolve(__dirname, route), "utf8");
  const declared = source.match(/^export const maxDuration = (\d+);$/m);
  assert.ok(declared, `${route} must export a literal maxDuration`);
  assert.equal(
    Number(declared[1]),
    SPEC_EXTRACTION_ROUTE_MAX_DURATION_S,
    `${route} maxDuration must mirror SPEC_EXTRACTION_ROUTE_MAX_DURATION_S`
  );
}

// The lease never exceeds the route budget: the function dies at the budget,
// so a run cannot be alive past it, whatever RITZY_TEXT_TIMEOUT_MS says. The
// cap applies after the overhead (a deadline just under the budget still
// yields exactly the budget, never budget + overhead).
assert.equal(specExtractionLeaseMs({ RITZY_TEXT_TIMEOUT_MS: String(routeBudgetMs * 10) }), routeBudgetMs);
assert.equal(specExtractionLeaseMs({ RITZY_TEXT_TIMEOUT_MS: String(routeBudgetMs) }), routeBudgetMs);
assert.equal(
  specExtractionLeaseMs({ RITZY_TEXT_TIMEOUT_MS: String(routeBudgetMs - SPEC_EXTRACTION_OVERHEAD_MS) }),
  routeBudgetMs
);
assert.equal(
  specExtractionLeaseMs({ RITZY_TEXT_TIMEOUT_MS: String(routeBudgetMs - SPEC_EXTRACTION_OVERHEAD_MS - 1_000) }),
  routeBudgetMs - 1_000
);
for (const configured of ["1", "3000", "90000", "250000", "299999", "300000", "600000", "garbage"]) {
  assert.ok(
    specExtractionLeaseMs({ RITZY_TEXT_TIMEOUT_MS: configured }) <= routeBudgetMs,
    `lease for RITZY_TEXT_TIMEOUT_MS=${configured} must not exceed the route budget`
  );
}

const lease = 120_000;

// Terminal or absent states are never stalled.
assert.equal(isSpecExtractionStalled("succeeded", iso(lease * 2), now, lease), false);
assert.equal(isSpecExtractionStalled("failed", iso(lease * 2), now, lease), false);
assert.equal(isSpecExtractionStalled("cancelled", iso(lease * 2), now, lease), false);
assert.equal(isSpecExtractionStalled(null, iso(lease * 2), now, lease), false);

// Live within the lease.
assert.equal(isSpecExtractionStalled("running", iso(lease - 1), now, lease), false);
assert.equal(isSpecExtractionStalled("queued", iso(1_000), now, lease), false);
assert.equal(isSpecExtractionStalled("running", iso(lease), now, lease), false, "the boundary is still live");

// Past the lease: stalled and reclaimable.
assert.equal(isSpecExtractionStalled("running", iso(lease + 1), now, lease), true);
assert.equal(isSpecExtractionStalled("queued", iso(lease + 1), now, lease), true);

// An unreadable start time cannot prove liveness, so it never locks the user out.
assert.equal(isSpecExtractionStalled("running", null, now, lease), true);
assert.equal(isSpecExtractionStalled("running", "not-a-date", now, lease), true);

console.log("spec-extraction.test.ts: all assertions passed");
