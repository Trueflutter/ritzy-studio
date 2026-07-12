import assert from "node:assert/strict";

import { sumOutcomeCredits } from "./ai-cost";

// Sums only successful outcomes that actually reported credits.
assert.equal(
  sumOutcomeCredits([
    { ok: true, creditsUsed: 2.5 },
    { ok: true, creditsUsed: 3 },
    { ok: false, creditsUsed: 99 }
  ]),
  5.5
);

// No reported credits (non-Evolink providers) must stay null, not 0.
assert.equal(sumOutcomeCredits([]), null);
assert.equal(sumOutcomeCredits([{ ok: true }, { ok: true, creditsUsed: null }]), null);

// A partial report still sums what is known.
assert.equal(sumOutcomeCredits([{ ok: true, creditsUsed: 4 }, { ok: true }]), 4);

console.log("ai-cost tests passed");
