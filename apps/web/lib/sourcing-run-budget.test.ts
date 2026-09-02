import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PRODUCT_SOURCING_TIMEOUT_MS } from "@ritzy-studio/ai";

import {
  PRODUCT_SOURCING_PASS_FLOOR_MS,
  PRODUCT_SOURCING_PASS_MAX_MS,
  PRODUCT_SOURCING_PERSIST_RESERVE_MS,
  PRODUCT_SOURCING_RUN_BUDGET_MS,
  providerTimeoutMs,
  visualPassTimeoutMs
} from "./sourcing-run-budget";

// The pass gets the whole guard when nothing ran before it.
assert.equal(visualPassTimeoutMs({ startedAt: 0, now: 0 }), PRODUCT_SOURCING_PASS_MAX_MS);
assert.equal(visualPassTimeoutMs({ startedAt: 1_000, now: 900 }), PRODUCT_SOURCING_PASS_MAX_MS, "a clock step backwards never widens the guard");

// After a slow palette extraction and image fetch, the pass gets what is
// left after the persistence reserve.
const elapsed = 150_000;
assert.equal(
  visualPassTimeoutMs({ startedAt: 0, now: elapsed }),
  PRODUCT_SOURCING_RUN_BUDGET_MS - elapsed - PRODUCT_SOURCING_PERSIST_RESERVE_MS
);

// Below the floor the pass is skipped: ranking beats a timeout.
const late = PRODUCT_SOURCING_RUN_BUDGET_MS - PRODUCT_SOURCING_PERSIST_RESERVE_MS - PRODUCT_SOURCING_PASS_FLOOR_MS + 1;
assert.equal(visualPassTimeoutMs({ startedAt: 0, now: late }), null);
assert.equal(visualPassTimeoutMs({ startedAt: 0, now: late - 1 }), PRODUCT_SOURCING_PASS_FLOOR_MS);

// The provider deadline for a full guard is the ai package's own default, so
// the two never drift; it stays under the guard for any shorter pass.
assert.equal(providerTimeoutMs(PRODUCT_SOURCING_PASS_MAX_MS), PRODUCT_SOURCING_TIMEOUT_MS);
assert.ok(providerTimeoutMs(PRODUCT_SOURCING_PASS_FLOOR_MS) < PRODUCT_SOURCING_PASS_FLOOR_MS);

// The whole run (budget plus reserve is the budget itself) sits inside the
// route's declared maxDuration, read from the page so a change to either
// side fails here.
const page = readFileSync(
  path.join(process.cwd(), "app/projects/[projectId]/rooms/[roomId]/product-matching/page.tsx"),
  "utf8"
);
const maxDuration = page.match(/export const maxDuration = (\d+);/);
assert.ok(maxDuration, "the product-matching page declares maxDuration");
assert.ok(
  PRODUCT_SOURCING_RUN_BUDGET_MS < Number(maxDuration?.[1]) * 1000,
  "the run budget must sit under the route's maxDuration"
);
assert.ok(
  PRODUCT_SOURCING_PASS_MAX_MS + PRODUCT_SOURCING_PERSIST_RESERVE_MS < PRODUCT_SOURCING_RUN_BUDGET_MS,
  "a full pass plus persistence fits the run budget"
);

console.log("sourcing-run-budget tests passed");
