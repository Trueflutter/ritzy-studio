import assert from "node:assert/strict";

import { sumOutcomeCredits } from "./ai-cost";

// Sums every outcome that reported credits — including failed outcomes, whose generation
// still consumed them before the failure.
assert.equal(
  sumOutcomeCredits([{ creditsUsed: 2.5 }, { creditsUsed: 3 }, { creditsUsed: 4.5 }]),
  10
);

// No reported credits (non-Evolink providers) must stay null, not 0.
assert.equal(sumOutcomeCredits([]), null);
assert.equal(sumOutcomeCredits([{}, { creditsUsed: null }]), null);

// A partial report still sums what is known.
assert.equal(sumOutcomeCredits([{ creditsUsed: 4 }, {}]), 4);

console.log("ai-cost tests passed");
