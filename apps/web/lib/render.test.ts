import assert from "node:assert/strict";

import {
  FINAL_RENDER_STALE_MS,
  FINAL_RENDER_VIEWS_WINDOW_MS,
  isRenderJobStalled,
  isWithinFinalRenderViewsWindow
} from "./render";

const now = 1_000_000_000_000;
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

// Not stalled: terminal or absent states.
assert.equal(isRenderJobStalled("succeeded", iso(FINAL_RENDER_STALE_MS * 2), now), false);
assert.equal(isRenderJobStalled("failed", iso(FINAL_RENDER_STALE_MS * 2), now), false);
assert.equal(isRenderJobStalled(null, iso(FINAL_RENDER_STALE_MS * 2), now), false);
assert.equal(isRenderJobStalled("running", null, now), false);
assert.equal(isRenderJobStalled("running", "not-a-date", now), false);

// Running/queued but young: still legitimately in progress.
assert.equal(isRenderJobStalled("running", iso(FINAL_RENDER_STALE_MS - 1_000), now), false);
assert.equal(isRenderJobStalled("queued", iso(60_000), now), false);

// Running/queued past the threshold: stalled.
assert.equal(isRenderJobStalled("running", iso(FINAL_RENDER_STALE_MS + 1_000), now), true);
assert.equal(isRenderJobStalled("queued", iso(FINAL_RENDER_STALE_MS + 1_000), now), true);

// Views window: poll for the extra angles only while the render is recent.
assert.equal(isWithinFinalRenderViewsWindow(iso(60_000), now), true);
assert.equal(isWithinFinalRenderViewsWindow(iso(FINAL_RENDER_VIEWS_WINDOW_MS - 1_000), now), true);
assert.equal(isWithinFinalRenderViewsWindow(iso(FINAL_RENDER_VIEWS_WINDOW_MS + 1_000), now), false);
assert.equal(isWithinFinalRenderViewsWindow(null, now), false);
assert.equal(isWithinFinalRenderViewsWindow("not-a-date", now), false);

console.log("render.test.ts: all assertions passed");
