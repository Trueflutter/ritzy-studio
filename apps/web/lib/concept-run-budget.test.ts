import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ANCHOR_PREP_MAX_MS,
  ANCHOR_SET_FLOOR_MS,
  ANCHOR_SET_MAX_MS,
  anchorPrepTimeoutMs,
  anchorProviderTimeoutMs,
  anchorSetTimeoutMs,
  conceptRenderTimeoutMs,
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
assert.equal(anchorPrepTimeoutMs({ startedAt: 0, now: 0 }), ANCHOR_PREP_MAX_MS);
assert.equal(anchorSetTimeoutMs({ startedAt: 0, now: 0 }), ANCHOR_SET_MAX_MS);

// Prep is refused before it starts once the render's reserve is at stake, so
// the catalogue is not even read on a run that cannot afford to use it.
assert.equal(anchorPrepTimeoutMs({ startedAt: 0, now: 25_000 }), null);
assert.equal(anchorPrepTimeoutMs({ startedAt: 0, now: 280_000 }), null);

// The pass keeps its floor while the render's reserve is intact, and is
// refused the moment it is not: a call started under the floor cannot return,
// so it would spend tokens and record nothing.
assert.equal(anchorSetTimeoutMs({ startedAt: 0, now: 40_000 }), ANCHOR_SET_FLOOR_MS);
assert.equal(anchorSetTimeoutMs({ startedAt: 0, now: 40_001 }), null);

// Whatever a guard allows, the render's reserve survives it.
for (const now of [0, 10_000, 20_000, 40_000]) {
  const guard = anchorSetTimeoutMs({ startedAt: 0, now });
  if (guard !== null) {
    assert.ok(
      CONCEPT_RUN_BUDGET_MS - now - guard - CONCEPT_PERSIST_RESERVE_MS >= CONCEPT_RENDER_RESERVE_MS,
      `the render keeps its reserve at ${now}ms`
    );
  }
}

// The render is HELD to the reserve the anchor guards hold back for it, rather
// than trusted to honour it. Without this the reserve is arithmetic nobody
// enforces: the image providers' own ceilings are 300 s of polling and a 240 s
// call, both longer than the route.
assert.equal(conceptRenderTimeoutMs({ startedAt: 0, now: 0 }), CONCEPT_RENDER_RESERVE_MS);
assert.equal(
  conceptRenderTimeoutMs({ startedAt: 0, now: ANCHOR_PREP_MAX_MS + ANCHOR_SET_MAX_MS }),
  CONCEPT_RENDER_RESERVE_MS,
  "a run that spent its whole anchor allowance still leaves the render its full reserve"
);
// Past that, the render gets what is actually left, never more.
for (const now of [120_000, 200_000, 240_000]) {
  const render = conceptRenderTimeoutMs({ startedAt: 0, now });
  assert.ok(
    now + render + CONCEPT_PERSIST_RESERVE_MS <= CONCEPT_RUN_BUDGET_MS || render === 30_000,
    `the render cannot overrun the run at ${now}ms (got ${render})`
  );
}
// A render started with seconds left still tries: no concept at all is worse
// for the shopper than a render that may not finish.
assert.equal(conceptRenderTimeoutMs({ startedAt: 0, now: 284_000 }), 30_000);

// The provider aborts before the service guard does, so the guard is only ever
// a backstop and never the thing that leaves a call's spend unrecorded.
assert.ok(anchorProviderTimeoutMs(ANCHOR_SET_MAX_MS) < ANCHOR_SET_MAX_MS);
assert.ok(anchorProviderTimeoutMs(1_000) >= 1_000);

console.log("concept-run-budget tests passed");
