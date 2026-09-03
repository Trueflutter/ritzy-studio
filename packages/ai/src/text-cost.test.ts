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
  // NOT floored. Flooring it made the primary and the fallback together
  // overrun the caller: at the render's own 30 s floor the primary takes 19.8 s
  // and a 20 s floor on the fallback totals 39.8 s against a 30 s allowance.
  // The caller skips the fallback below the minimum instead.
  assert.equal(imageCallTimeoutMs(170_000, 0, 169_000), 1_000);
  assert.equal(imageCallTimeoutMs(170_000, 0, 200_000), 0);

  // The primary's share, and the two together inside the caller's deadline.
  const { evolinkPollWindowMs, IMAGE_FALLBACK_MIN_MS } = await import("./index");
  assert.equal(evolinkPollWindowMs(undefined), undefined, "no deadline, the provider's own ceiling stands");
  const { IMAGE_FALLBACK_RESERVE_MS } = await import("./index");
  // The primary keeps everything except what the fallback would need, rather
  // than a fixed fraction: two thirds of a 195 s budget left the fallback 66 s
  // against a provider needing well over twice that, so a stalled primary
  // produced no concept at all where the un-deadlined code produced a slow one.
  assert.equal(evolinkPollWindowMs(195_000), 195_000 - IMAGE_FALLBACK_RESERVE_MS);
  assert.ok(evolinkPollWindowMs(1_000)! >= 6_000, "never below a poll round trip");

  // A budget too small to split leaves the primary whole and skips the fallback.
  assert.equal(evolinkPollWindowMs(90_000), 90_000, "no room for two providers, so one gets it all");

  for (const deadline of [60_000, 90_000, 120_000, 195_000]) {
    const primary = evolinkPollWindowMs(deadline)!;
    const fallback = imageCallTimeoutMs(deadline, 0, primary);
    assert.ok(
      primary + (fallback >= IMAGE_FALLBACK_MIN_MS ? fallback : 0) <= deadline,
      `both providers fit ${deadline}ms (primary ${primary}, fallback ${fallback})`
    );
    if (fallback >= IMAGE_FALLBACK_MIN_MS) {
      assert.ok(fallback >= IMAGE_FALLBACK_MIN_MS, "a started fallback has a window it can land in");
    }
  }
  // At the render's full reserve the fallback gets a real window.
  assert.ok(imageCallTimeoutMs(195_000, 0, evolinkPollWindowMs(195_000)!) >= IMAGE_FALLBACK_MIN_MS);
  // Near the render's floor there is not room for both, so the primary keeps
  // the deadline and the fallback is skipped rather than started and abandoned.
  assert.equal(evolinkPollWindowMs(30_000), 30_000);
  assert.ok(evolinkPollWindowMs(195_000)! >= Math.floor(195_000 / 2), "and never cut below half the budget to buy one");
  assert.ok(imageCallTimeoutMs(30_000, 0, evolinkPollWindowMs(30_000)!) < IMAGE_FALLBACK_MIN_MS);

  console.log("image deadline tests passed");
}
