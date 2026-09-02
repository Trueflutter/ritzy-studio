import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PRODUCT_VERIFICATION_TIMEOUT_MS } from "@ritzy-studio/ai";

import {
  PRODUCT_SOURCING_CHECK_FLOOR_MS,
  PRODUCT_SOURCING_CHECK_MAX_MS,
  PRODUCT_SOURCING_PASS_FLOOR_MS,
  PRODUCT_SOURCING_PASS_MAX_MS,
  PRODUCT_SOURCING_PERSIST_RESERVE_MS,
  PRODUCT_SOURCING_RUN_BUDGET_MS,
  designCheckTimeoutMs,
  providerTimeoutMs,
  sourcingPassTimeoutMs
} from "./sourcing-run-budget";

// Both paid calls plus persistence must fit one request. This is the
// arithmetic that keeps a run inside the route's maxDuration; past it a
// platform kill runs no catch path and the paid job is left running.
assert.ok(
  PRODUCT_SOURCING_PASS_MAX_MS + PRODUCT_SOURCING_CHECK_MAX_MS + PRODUCT_SOURCING_PERSIST_RESERVE_MS <=
    PRODUCT_SOURCING_RUN_BUDGET_MS,
  "a full pass, a full design check and persistence fit the run budget"
);

// A fresh run gives the pass its ceiling, and the pass can never take the
// check's reserve with it.
assert.equal(sourcingPassTimeoutMs({ startedAt: 0, now: 0 }), PRODUCT_SOURCING_PASS_MAX_MS);
assert.equal(sourcingPassTimeoutMs({ startedAt: 1_000, now: 900 }), PRODUCT_SOURCING_PASS_MAX_MS, "a clock step backwards never widens a guard");
const slowPreWork = 120_000;
assert.equal(
  sourcingPassTimeoutMs({ startedAt: 0, now: slowPreWork }),
  PRODUCT_SOURCING_RUN_BUDGET_MS - slowPreWork - PRODUCT_SOURCING_PERSIST_RESERVE_MS - PRODUCT_SOURCING_CHECK_MAX_MS
);

// After typical pre-work and a pass that ran to its ceiling, the check still
// gets its full deadline; after slow pre-work it still clears its floor. A
// check that starts without time to finish burns tokens and records nothing.
assert.equal(
  designCheckTimeoutMs({ startedAt: 0, now: 45_000 + PRODUCT_SOURCING_PASS_MAX_MS }),
  PRODUCT_SOURCING_CHECK_MAX_MS,
  "45s of pre-work still leaves the check its full deadline"
);
assert.ok(
  (designCheckTimeoutMs({ startedAt: 0, now: 90_000 + PRODUCT_SOURCING_PASS_MAX_MS }) ?? 0) >= PRODUCT_SOURCING_CHECK_FLOOR_MS,
  "even 90s of pre-work leaves the check its floor"
);

// Below the floors each call is skipped rather than started.
const lateForPass =
  PRODUCT_SOURCING_RUN_BUDGET_MS -
  PRODUCT_SOURCING_PERSIST_RESERVE_MS -
  PRODUCT_SOURCING_CHECK_MAX_MS -
  PRODUCT_SOURCING_PASS_FLOOR_MS;
assert.equal(sourcingPassTimeoutMs({ startedAt: 0, now: lateForPass }), PRODUCT_SOURCING_PASS_FLOOR_MS);
assert.equal(sourcingPassTimeoutMs({ startedAt: 0, now: lateForPass + 1 }), null);
const lateForCheck = PRODUCT_SOURCING_RUN_BUDGET_MS - PRODUCT_SOURCING_PERSIST_RESERVE_MS - PRODUCT_SOURCING_CHECK_FLOOR_MS;
assert.equal(designCheckTimeoutMs({ startedAt: 0, now: lateForCheck }), PRODUCT_SOURCING_CHECK_FLOOR_MS);
assert.equal(designCheckTimeoutMs({ startedAt: 0, now: lateForCheck + 1 }), null);

// The check's ceiling is what the call itself declares it needs, not the
// leftovers: a guard below the call's own deadline would abort a check that
// was going to succeed, billing its tokens with no usage to record.
assert.equal(PRODUCT_SOURCING_CHECK_MAX_MS, PRODUCT_VERIFICATION_TIMEOUT_MS);
assert.ok(
  providerTimeoutMs(PRODUCT_SOURCING_CHECK_FLOOR_MS) >= 30_000,
  "the floor leaves a started check a realistic deadline rather than one it cannot meet"
);

// The provider deadline always sits under its guard.
assert.ok(providerTimeoutMs(PRODUCT_SOURCING_PASS_MAX_MS) < PRODUCT_SOURCING_PASS_MAX_MS);
assert.ok(providerTimeoutMs(PRODUCT_SOURCING_CHECK_FLOOR_MS) < PRODUCT_SOURCING_CHECK_FLOOR_MS);

// The whole run sits inside the route's declared maxDuration, read from the
// page so a change to either side fails here.
const page = readFileSync(
  path.join(process.cwd(), "app/projects/[projectId]/rooms/[roomId]/product-matching/page.tsx"),
  "utf8"
);
const maxDuration = page.match(/export const maxDuration = (\d+);/);
assert.ok(maxDuration, "the product-matching page declares maxDuration");
assert.ok(PRODUCT_SOURCING_RUN_BUDGET_MS < Number(maxDuration?.[1]) * 1000, "the run budget sits under the route's maxDuration");

console.log("sourcing-run-budget tests passed");
