import assert from "node:assert/strict";

import {
  fitConfidenceUsePolicy,
  measurementCanSupportProductFit,
  measurementCanSupportTightClearance,
  measurementSourceRequiresConfirmation
} from "./measurement-confidence";

assert.equal(measurementSourceRequiresConfirmation("known_developer_layout", "prefill"), true);
assert.deepEqual(fitConfidenceUsePolicy("known_developer_layout", "prefill"), {
  source: "known_developer_layout",
  confidence: "prefill",
  requiresConfirmation: true,
  canSupportProductFit: false,
  canSupportTightClearance: false
});

assert.equal(measurementCanSupportProductFit("manual", "verified"), true);
assert.equal(measurementCanSupportProductFit("user_measured", "verified"), true);
assert.equal(measurementSourceRequiresConfirmation("manual", "verified"), false);
assert.equal(measurementCanSupportProductFit("manual", "unknown"), false);
assert.equal(measurementCanSupportProductFit("native_room_scan", "unknown"), false);
assert.equal(measurementCanSupportProductFit("third_party_scan_import", "unknown"), false);
assert.equal(measurementCanSupportProductFit("known_developer_layout", "user_confirmed"), true);

assert.equal(measurementCanSupportTightClearance("designer_verified", "designer_verified"), true);
assert.equal(measurementCanSupportProductFit("designer_verified", "designer_verified"), true);

assert.equal(measurementCanSupportTightClearance("estimated", "estimated"), false);
assert.equal(measurementCanSupportProductFit("estimated", "estimated"), false);
assert.equal(measurementSourceRequiresConfirmation("estimated", "estimated"), true);

console.log("measurement-confidence tests passed");
