import assert from "node:assert/strict";

import {
  createMeasurementLayoutSeedDryRun,
  formatMeasurementLayoutSeedDryRunIssues,
  validateMeasurementLayoutSeedDryRunDataset
} from "./measurement-layout-seed-dry-run";
import {
  type MeasurementLayoutSeedDataset,
  syntheticMeasurementLayoutSeedExample
} from "./measurement-layout-seed";

const validSeed = cloneDataset(syntheticMeasurementLayoutSeedExample);

const validDryRun = createMeasurementLayoutSeedDryRun({
  proposed: validSeed,
  proposedLabel: "synthetic-example.json"
});
assert.equal(validDryRun.proposed.success, true);
assert.match(validDryRun.report, /Measurement Layout Seed Dry Run/);
assert.match(validDryRun.report, /Current: empty baseline \(0 layouts\)/);
assert.match(validDryRun.report, /Proposed: synthetic-example\.json \(1 layouts\)/);
assert.match(validDryRun.report, /- Layouts: \+1 -0 ~0 =0/);
assert.match(validDryRun.report, /- ADDED synthetic-dubai-garden-townhouse-4br-end/);

const invalidSeed = validateMeasurementLayoutSeedDryRunDataset({
  version: 1,
  description: "Invalid dry-run seed.",
  layouts: []
});
assert.equal(invalidSeed.success, false);
assert.ok(
  invalidSeed.issues.some((issue) => issue.path === "layouts" && issue.code === "schema_invalid"),
  "invalid seed files should surface schema issues"
);

const duplicateAliasSeed = cloneDataset(validSeed);
duplicateAliasSeed.layouts[0].aliases.push({
  value: "SYN-TH-4E",
  kind: "layout_code"
});
const duplicateAliasResult = validateMeasurementLayoutSeedDryRunDataset(duplicateAliasSeed);
assert.equal(duplicateAliasResult.success, false);
assert.ok(
  duplicateAliasResult.issues.some((issue) => issue.code === "duplicate_alias"),
  "dry-run validation should reject duplicate normalized aliases"
);

const duplicateRoomSeed = cloneDataset(validSeed);
duplicateRoomSeed.layouts[0].rooms.push({
  ...duplicateRoomSeed.layouts[0].rooms[0],
  name: "Living / Dining Copy"
});
const duplicateRoomResult = validateMeasurementLayoutSeedDryRunDataset(duplicateRoomSeed);
assert.equal(duplicateRoomResult.success, false);
assert.ok(
  duplicateRoomResult.issues.some((issue) => issue.code === "duplicate_room_id"),
  "dry-run validation should reject duplicate room ids"
);

const missingConfidenceSeed = cloneDataset(validSeed) as unknown as Record<string, unknown>;
delete (((missingConfidenceSeed.layouts as Array<Record<string, unknown>>)[0].rooms as Array<Record<string, unknown>>)[0]
  .measurementConfidence);
const missingConfidenceResult = validateMeasurementLayoutSeedDryRunDataset(missingConfidenceSeed);
assert.equal(missingConfidenceResult.success, false);
assert.ok(
  missingConfidenceResult.issues.some((issue) => issue.path === "layouts.0.rooms.0.measurementConfidence"),
  "room measurements must keep explicit confidence metadata"
);

const missingSourceSeed = cloneDataset(validSeed);
missingSourceSeed.layouts[0].rooms[0].sourceId = "missing-source";
const missingSourceResult = validateMeasurementLayoutSeedDryRunDataset(missingSourceSeed);
assert.equal(missingSourceResult.success, false);
assert.ok(
  missingSourceResult.issues.some((issue) => issue.path === "layouts.0.rooms.0.sourceId"),
  "room measurements must keep source provenance"
);

const changedSeed = cloneDataset(validSeed);
changedSeed.layouts[0].aliases.push({
  value: "Synthetic 4 bed corner",
  kind: "user_phrase"
});
changedSeed.layouts[0].rooms[0].widthCm = 440;
changedSeed.layouts[0].rooms.push({
  id: "ground-majlis",
  name: "Majlis",
  normalizedRoomType: "majlis",
  floorLevel: "ground",
  sourceId: "internal-synthetic-example",
  measurementConfidence: "prefill",
  lengthCm: 360,
  widthCm: 330,
  disclaimer: "Synthetic dimensions for dry-run diff validation only."
});

const changedDryRun = createMeasurementLayoutSeedDryRun({
  current: validSeed,
  proposed: changedSeed,
  currentLabel: "current.json",
  proposedLabel: "proposed.json"
});
assert.equal(changedDryRun.proposed.success, true);
assert.equal(
  changedDryRun.report,
  [
    "Measurement Layout Seed Dry Run",
    "Current: current.json (1 layouts)",
    "Proposed: proposed.json (1 layouts)",
    "",
    "Validation:",
    "- current: ok (0 errors, 0 warnings)",
    "- proposed: ok (0 errors, 0 warnings)",
    "",
    "Summary:",
    "- Layouts: +0 -0 ~1 =0",
    "- Aliases: +1 -0",
    "- Rooms: +1 -0 ~1",
    "- Sources: +0 -0 ~0",
    "",
    "Layout changes:",
    "- CHANGED synthetic-dubai-garden-townhouse-4br-end",
    "  aliases: +synthetic 4 bed corner",
    "  rooms: +ground-majlis, ~ground-living-dining"
  ].join("\n")
);

const failedDryRun = createMeasurementLayoutSeedDryRun({
  proposed: duplicateAliasSeed
});
assert.equal(failedDryRun.proposed.success, false);
assert.match(failedDryRun.report, /Dry run stopped because validation failed/);
assert.match(formatMeasurementLayoutSeedDryRunIssues(failedDryRun.proposed.issues), /duplicate_alias/);

function cloneDataset(dataset: MeasurementLayoutSeedDataset): MeasurementLayoutSeedDataset {
  return JSON.parse(JSON.stringify(dataset)) as MeasurementLayoutSeedDataset;
}
