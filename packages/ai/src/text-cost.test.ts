import assert from "node:assert/strict";

import { estimateTextCostUsd, sumImagePlusTextUsd, sumUsdCosts, sumUsdCostsStrict } from "./text-cost";

// Known models price by published per-1M token rates.
// gpt-5-mini: $0.25 input / $2.00 output per 1M.
assert.equal(
  estimateTextCostUsd("gpt-5-mini", { input_tokens: 1_000_000, output_tokens: 0 }),
  0.25
);
assert.equal(
  estimateTextCostUsd("gpt-5-mini", { input_tokens: 0, output_tokens: 500_000 }),
  1.0
);
// gpt-5.1: $1.25 / $10.00 per 1M (the legacy Evolink-routed model, still priced for
// historical rows and any deliberate per-stage upgrade).
assert.equal(
  estimateTextCostUsd("gpt-5.1", { input_tokens: 100_000, output_tokens: 10_000 }),
  0.225
);
// Small real-world shaped usage rounds sanely instead of collapsing to zero.
const small = estimateTextCostUsd("gpt-5-mini", { input_tokens: 12_000, output_tokens: 2_500 });
assert.ok(small !== null && small > 0 && small < 0.02, `unexpected small cost ${small}`);

// Unknown models record null, never a fabricated number.
assert.equal(estimateTextCostUsd("some-future-model", { input_tokens: 1000, output_tokens: 10 }), null);
// Missing usage records null.
assert.equal(estimateTextCostUsd("gpt-5-mini", undefined), null);
assert.equal(estimateTextCostUsd("gpt-5-mini", null), null);

// sumUsdCosts adds only the numbers present; all-null stays null (unknown, not zero).
assert.equal(sumUsdCosts(0.05, null, 0.01), 0.06);
assert.equal(sumUsdCosts(null, undefined), null);
assert.equal(sumUsdCosts(0.1), 0.1);
assert.equal(sumUsdCosts(), null);

// Strict sums: any unknown component makes the total unknown (a fallback image with
// unrecorded credits cannot masquerade as a cheap text-only run).
assert.equal(sumUsdCostsStrict(null, 0.01), null);
assert.equal(sumUsdCostsStrict(0.05, 0.01), 0.06);
assert.equal(sumUsdCostsStrict(undefined), null);

// A present-but-empty usage object is unknown, not free.
assert.equal(estimateTextCostUsd("gpt-5-mini", {}), null);

// Image+text totals: unknown image nulls the total; unknown text keeps known image.
assert.equal(sumImagePlusTextUsd(null, 0.01), null);
assert.equal(sumImagePlusTextUsd(0.07, null), 0.07);
assert.equal(sumImagePlusTextUsd(0.07, 0.005), 0.075);
assert.equal(sumImagePlusTextUsd(undefined, undefined), null);

console.log("text-cost tests passed");

// --- A caller's image deadline is honoured, floored and capped (S3b).
{
  const { imageCallTimeoutMs } = await import("./index");
  // No deadline: the module's own ceiling stands.
  assert.equal(imageCallTimeoutMs(undefined, 0), 240_000);
  // With one: what is left of it, never more than the ceiling.
  assert.equal(imageCallTimeoutMs(170_000, 0, 0), 170_000);
  assert.equal(imageCallTimeoutMs(170_000, 0, 100_000), 70_000);
  assert.equal(imageCallTimeoutMs(400_000, 0, 0), 240_000, "a caller cannot extend the provider ceiling");
  // Floored: a fallback started with no time cannot return anything, but the
  // floor is what makes the attempt honest rather than a guaranteed failure.
  assert.equal(imageCallTimeoutMs(170_000, 0, 169_000), 20_000);
  console.log("image deadline tests passed");
}
