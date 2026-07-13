import assert from "node:assert/strict";

import { renderExecutionMode } from "./index";

// Explicit override wins everywhere.
assert.equal(renderExecutionMode({ RITZY_RENDER_EXECUTION: "inline", VERCEL: "1" }), "inline");
assert.equal(renderExecutionMode({ RITZY_RENDER_EXECUTION: "queue" }), "queue");

// Without an override: queue on Vercel infra, inline elsewhere (local dev, harness).
assert.equal(renderExecutionMode({ VERCEL: "1" }), "queue");
assert.equal(renderExecutionMode({}), "inline");

// A malformed override falls back to the platform default rather than throwing.
assert.equal(renderExecutionMode({ RITZY_RENDER_EXECUTION: "bogus", VERCEL: "1" }), "queue");
assert.equal(renderExecutionMode({ RITZY_RENDER_EXECUTION: "bogus" }), "inline");

console.log("render-execution-mode tests passed");
