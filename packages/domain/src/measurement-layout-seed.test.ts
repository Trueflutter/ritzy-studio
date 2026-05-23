import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { normalizeLayoutAlias } from "./measurement-intelligence";
import {
  measurementLayoutSeedDatasetSchema,
  measurementLayoutSeedLayoutSchema,
  normalizedMeasurementLayoutSeedAliases,
  parseMeasurementLayoutSeedDataset,
  syntheticMeasurementLayoutSeedExample
} from "./measurement-layout-seed";

const parsedSynthetic = parseMeasurementLayoutSeedDataset(syntheticMeasurementLayoutSeedExample);
assert.equal(parsedSynthetic.layouts.length, 1);
assert.equal(parsedSynthetic.layouts[0].sourceRightsStatus, "rights_cleared_internal");
assert.equal(parsedSynthetic.layouts[0].rooms[0].normalizedRoomType, "living_room");

const aliases = normalizedMeasurementLayoutSeedAliases(parsedSynthetic.layouts[0]);
assert.ok(aliases.some((alias) => alias.normalized === normalizeLayoutAlias("SYN-TH-4E")));
assert.ok(aliases.some((alias) => alias.normalized === "4 bed synthetic end unit"));

const missingRequiredFields = measurementLayoutSeedLayoutSchema.safeParse({
  id: "missing-required-fields"
});
assert.equal(missingRequiredFields.success, false);

const unknownRights = measurementLayoutSeedLayoutSchema.safeParse({
  ...parsedSynthetic.layouts[0],
  sourceRightsStatus: "unknown"
});
assert.equal(unknownRights.success, false);
assert.ok(
  unknownRights.error.issues.some((issue) => issue.path.join(".") === "sourceRightsStatus"),
  "source rights status must be explicit"
);

const unknownSourceRights = measurementLayoutSeedLayoutSchema.safeParse({
  ...parsedSynthetic.layouts[0],
  sources: [
    {
      ...parsedSynthetic.layouts[0].sources[0],
      rightsStatus: "unknown"
    }
  ]
});
assert.equal(unknownSourceRights.success, false);
assert.ok(
  unknownSourceRights.error.issues.some((issue) => issue.path.join(".") === "sources.0.rightsStatus"),
  "each source rights status must be explicit"
);

const missingRoomSource = measurementLayoutSeedLayoutSchema.safeParse({
  ...parsedSynthetic.layouts[0],
  rooms: [
    {
      ...parsedSynthetic.layouts[0].rooms[0],
      sourceId: "missing-source"
    }
  ]
});
assert.equal(missingRoomSource.success, false);
assert.ok(
  missingRoomSource.error.issues.some((issue) => issue.path.join(".") === "rooms.0.sourceId"),
  "trusted or prefill measurements must keep source provenance"
);

const missingRoomConfidence = measurementLayoutSeedLayoutSchema.safeParse({
  ...parsedSynthetic.layouts[0],
  rooms: [
    {
      ...parsedSynthetic.layouts[0].rooms[0],
      measurementConfidence: undefined
    }
  ]
});
assert.equal(missingRoomConfidence.success, false);
assert.ok(
  missingRoomConfidence.error.issues.some((issue) => issue.path.join(".") === "rooms.0.measurementConfidence"),
  "room measurements must keep explicit confidence"
);

const negativeDimension = measurementLayoutSeedLayoutSchema.safeParse({
  ...parsedSynthetic.layouts[0],
  rooms: [
    {
      ...parsedSynthetic.layouts[0].rooms[0],
      lengthCm: -1
    }
  ]
});
assert.equal(negativeDimension.success, false);
assert.ok(
  negativeDimension.error.issues.some((issue) => issue.path.join(".") === "rooms.0.lengthCm"),
  "room dimensions must be positive where provided"
);

const exampleJson = JSON.parse(
  readFileSync(new URL("../../../docs/Tracks/v2-commercial/measurement-layout-seed.example.json", import.meta.url), "utf8")
) as unknown;
const parsedJsonExample = measurementLayoutSeedDatasetSchema.parse(exampleJson);
assert.equal(parsedJsonExample.layouts[0].id, "synthetic-dubai-garden-townhouse-4br-end");
assert.deepEqual(parsedJsonExample, syntheticMeasurementLayoutSeedExample);
