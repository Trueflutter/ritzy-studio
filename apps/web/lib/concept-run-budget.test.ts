import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ANCHOR_SET_FLOOR_MS,
  ANCHOR_SET_MAX_MS,
  anchorPrepTimeoutMs,
  anchorProviderTimeoutMs,
  anchorSetTimeoutMs,
  CONCEPT_PERSIST_RESERVE_MS,
  CONCEPT_RENDER_RESERVE_MS,
  CONCEPT_RUN_BUDGET_MS
} from "./concept-run-budget";

// S3b put a paid call in front of the render, so the two now share a deadline.
// A run the platform kills has no catch path: its job row stays "running", the
// dedupe reads that as a live generation, and the shopper is locked out of a
// retry for fifteen minutes. This is the arithmetic that keeps that from
// happening, so it is asserted rather than trusted.

// The whole run sits inside the concepts route's declared maxDuration, read
// from the page itself so the two cannot drift apart silently.
const page = readFileSync(
  new URL("../app/projects/[projectId]/rooms/[roomId]/concepts/page.tsx", import.meta.url),
  "utf8"
);
const maxDuration = page.match(/export const maxDuration = (\d+);/);
assert.ok(maxDuration, "the concepts page declares maxDuration");
assert.ok(
  CONCEPT_RUN_BUDGET_MS < Number(maxDuration?.[1]) * 1000,
  "the run budget sits under the route's maxDuration"
);

// The render and the persistence are reserved before anything anchoring gets
// a share: a render that cannot finish is the product failing, while an anchor
// pass that cannot finish costs only the pass.
assert.ok(
  CONCEPT_RENDER_RESERVE_MS + CONCEPT_PERSIST_RESERVE_MS + ANCHOR_SET_MAX_MS < CONCEPT_RUN_BUDGET_MS,
  "the render, the persistence and a full-length anchor pass all fit"
);

// At the top of the run both guards give their ceiling.
assert.equal(anchorPrepTimeoutMs({ startedAt: 0, now: 0 }), 30_000);
assert.equal(anchorSetTimeoutMs({ startedAt: 0, now: 0 }), ANCHOR_SET_MAX_MS);

// Prep is refused before it starts once the render's reserve is at stake, so
// the catalogue is not even read on a run that cannot afford to use it.
assert.equal(anchorPrepTimeoutMs({ startedAt: 0, now: 30_000 }), null);
assert.equal(anchorPrepTimeoutMs({ startedAt: 0, now: 280_000 }), null);

// The pass keeps its floor while the render's reserve is intact, and is
// refused the moment it is not: a call started under the floor cannot return,
// so it would spend tokens and record nothing.
assert.equal(anchorSetTimeoutMs({ startedAt: 0, now: 65_000 }), ANCHOR_SET_FLOOR_MS);
assert.equal(anchorSetTimeoutMs({ startedAt: 0, now: 65_001 }), null);

// Whatever a guard allows, the render's reserve survives it.
for (const now of [0, 10_000, 30_000, 65_000]) {
  const guard = anchorSetTimeoutMs({ startedAt: 0, now });
  if (guard !== null) {
    assert.ok(
      CONCEPT_RUN_BUDGET_MS - now - guard - CONCEPT_PERSIST_RESERVE_MS >= CONCEPT_RENDER_RESERVE_MS,
      `the render keeps its reserve at ${now}ms`
    );
  }
}

// The provider aborts before the service guard does, so the guard is only ever
// a backstop and never the thing that leaves a call's spend unrecorded.
assert.ok(anchorProviderTimeoutMs(ANCHOR_SET_MAX_MS) < ANCHOR_SET_MAX_MS);
assert.ok(anchorProviderTimeoutMs(1_000) >= 1_000);

console.log("concept-run-budget tests passed");
