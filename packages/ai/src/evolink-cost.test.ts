import assert from "node:assert/strict";

import { evolinkCreditsToUsd } from "./index";

// 68 credits per USD (from Evolink's public USD/credit pricing pairs), rounded to the
// numeric(10, 4) precision of ai_jobs.cost_estimate_usd.
assert.equal(evolinkCreditsToUsd(68), 1);
assert.equal(evolinkCreditsToUsd(4.5773), 0.0673);
assert.equal(evolinkCreditsToUsd(0), 0);

// Unknown spend stays unknown — never coerced to 0.
assert.equal(evolinkCreditsToUsd(null), null);
assert.equal(evolinkCreditsToUsd(undefined), null);
assert.equal(evolinkCreditsToUsd(Number.NaN), null);

// Env override reprices without a deploy.
process.env.EVOLINK_CREDITS_PER_USD = "100";
assert.equal(evolinkCreditsToUsd(50), 0.5);
process.env.EVOLINK_CREDITS_PER_USD = "not-a-number";
assert.equal(evolinkCreditsToUsd(68), 1);
delete process.env.EVOLINK_CREDITS_PER_USD;

console.log("evolink cost conversion tests passed");
