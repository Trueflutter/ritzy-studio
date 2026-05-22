import assert from "node:assert/strict";

import {
  dubaiMeasurementLayoutFixtures,
  fitConfidenceUsePolicy,
  measurementCanSupportProductFit,
  measurementCanSupportTightClearance,
  measurementSourceRequiresConfirmation,
  normalizeLayoutAlias,
  rankLayoutCandidates
} from "./measurement-intelligence";

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

assert.equal(normalizeLayoutAlias("  DAMAC Hills 2!! "), "damac hills 2");
assert.equal(normalizeLayoutAlias("TH12-4E"), "th 12 4 e");
assert.equal(normalizeLayoutAlias("TH12 4E"), "th 12 4 e");
assert.equal(normalizeLayoutAlias("4 bedroom end unit"), "4 bed end unit");
assert.equal(normalizeLayoutAlias("Murooj Al-Furjan 4-bed corner"), "murooj al furjan 4 bed corner");

const damacMatches = rankLayoutCandidates(
  {
    community: "Akoya Oxygen",
    layout: "th12 4e",
    bedroomCount: 4,
    propertyType: "townhouse"
  },
  dubaiMeasurementLayoutFixtures
);
assert.equal(damacMatches[0].layout.id, "damac-hills-2-th12-4e");
assert.ok(damacMatches[0].matchedAliases.includes("akoya oxygen"));
assert.ok(damacMatches[0].matchedAliases.includes("th 12 4 e"));

const furjanMatches = rankLayoutCandidates(
  {
    development: "murooj al furjan",
    layout: "Murooj Al Furjan 4 bedroom corner",
    bedroomCount: 4,
    propertyType: "villa"
  },
  dubaiMeasurementLayoutFixtures
);
assert.equal(furjanMatches[0].layout.id, "murooj-al-furjan-4-bed-corner");

const ranchesMatches = rankLayoutCandidates(
  {
    community: "arabian ranches",
    layout: "4 bed villa",
    bedroomCount: 4,
    propertyType: "villa"
  },
  dubaiMeasurementLayoutFixtures
);
assert.equal(ranchesMatches[0].layout.id, "arabian-ranches-4-bed-villa");
