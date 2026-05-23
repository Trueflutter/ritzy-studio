import assert from "node:assert/strict";

import { mapMeasurementLayoutSeedToFutureRows } from "./measurement-layout-seed-row-adapter";
import {
  type MeasurementLayoutSeedDataset,
  syntheticMeasurementLayoutSeedExample
} from "./measurement-layout-seed";

const syntheticSeed = cloneDataset(syntheticMeasurementLayoutSeedExample);
const mapped = mapMeasurementLayoutSeedToFutureRows(syntheticSeed);

assert.equal(mapped.success, true);
assert.equal(mapped.rows.property_communities.length, 1);
assert.deepEqual(mapped.rows.property_communities[0], {
  slug: "synthetic-dubai-garden-district",
  name: "Synthetic Dubai Garden District",
  city: "Dubai",
  country: "AE",
  status: "draft",
  metadata_json: {}
});

assert.deepEqual(mapped.rows.property_developments[0], {
  community_slug: "synthetic-dubai-garden-district",
  slug: "synthetic-garden-townhouses",
  name: "Synthetic Garden Townhouses",
  developer_name: "Internal Synthetic Developer",
  phase_name: "Phase 1",
  status: "draft",
  metadata_json: {}
});

assert.deepEqual(mapped.rows.property_layouts[0], {
  community_slug: "synthetic-dubai-garden-district",
  development_slug: "synthetic-garden-townhouses",
  slug: "synthetic-dubai-garden-townhouse-4br-end",
  name: "SYN-TH-4E",
  property_type: "townhouse",
  type_code: "SYN-TH-4E",
  bedroom_count: 4,
  bathroom_count: null,
  floor_count: null,
  bua_sqft: null,
  plot_sqft: null,
  mirror_of_layout_slug: null,
  layout_confidence: "prefill",
  source_rights_status: "rights_cleared_internal",
  status: "draft",
  notes: "Safe synthetic townhouse-style layout for proving repo-managed seed shape.",
  disclaimer: "This layout is synthetic and should never be presented as a real Dubai developer plan.",
  metadata_json: {}
});

assert.ok(
  mapped.rows.property_layout_aliases.some(
    (alias) =>
      alias.layout_slug === "synthetic-dubai-garden-townhouse-4br-end" &&
      alias.alias === "SYN-TH-4E" &&
      alias.normalized_alias === "syn th 4 e" &&
      alias.alias_kind === "layout_code"
  ),
  "unit type code should map to a normalized layout alias row"
);

assert.ok(
  mapped.rows.property_layout_aliases.some(
    (alias) =>
      alias.community_slug === "synthetic-dubai-garden-district" &&
      alias.alias === "Example Garden District" &&
      alias.normalized_alias === "example garden district"
  ),
  "community aliases should target the community row shape"
);

assert.ok(
  mapped.rows.property_layout_aliases.some(
    (alias) =>
      alias.development_ref === "synthetic-dubai-garden-district/synthetic-garden-townhouses" &&
      alias.alias === "Garden Townhouses Phase 1" &&
      alias.normalized_alias === "garden townhouse phase 1"
  ),
  "development aliases should target the stable community/development reference"
);

assert.deepEqual(mapped.rows.property_layout_sources[0], {
  layout_slug: "synthetic-dubai-garden-townhouse-4br-end",
  source_slug: "internal-synthetic-example",
  source_kind: "synthetic_example",
  rights_status: "rights_cleared_internal",
  source_label: "Internal synthetic seed shape example",
  source_url: null,
  publisher_name: null,
  retrieved_at: null,
  reviewed_by: null,
  reviewed_at: null,
  disclaimer: "Synthetic data for schema validation only. Not a real property or floor plan.",
  raw_asset_id: null,
  metadata_json: {}
});

assert.deepEqual(mapped.rows.property_layout_rooms[0], {
  layout_slug: "synthetic-dubai-garden-townhouse-4br-end",
  source_slug: "internal-synthetic-example",
  room_slug: "first-primary-bedroom",
  name: "Primary Bedroom",
  room_type: "bedroom",
  floor_label: "first",
  floor_index: 1,
  wall_length_cm: 420,
  room_depth_cm: 390,
  ceiling_height_cm: null,
  area_sqft: null,
  geometry_json: null,
  doors_json: null,
  windows_json: null,
  measurement_confidence: "prefill",
  notes: null,
  disclaimer: "Synthetic dimensions for seed-format validation only.",
  metadata_json: {}
});

const reviewed = mapMeasurementLayoutSeedToFutureRows(syntheticSeed, { status: "reviewed" });
assert.equal(reviewed.success, true);
assert.equal(reviewed.rows.property_communities[0].status, "reviewed");
assert.equal(reviewed.rows.property_layouts[0].status, "reviewed");

const missingUnitType = cloneDataset(syntheticSeed);
missingUnitType.layouts[0].unitTypeCode = null;
const missingUnitTypeResult = mapMeasurementLayoutSeedToFutureRows(missingUnitType);
assert.equal(missingUnitTypeResult.success, false);
assert.ok(
  missingUnitTypeResult.issues.some((issue) => issue.code === "missing_unit_type_code"),
  "adapter should reject missing unit labels before future row mapping"
);

const missingRoomSource = cloneDataset(syntheticSeed);
missingRoomSource.layouts[0].rooms[0].sourceId = "missing-source";
const missingRoomSourceResult = mapMeasurementLayoutSeedToFutureRows(missingRoomSource);
assert.equal(missingRoomSourceResult.success, false);
assert.ok(
  missingRoomSourceResult.issues.some((issue) => issue.path === "layouts.0.rooms.0.sourceId"),
  "adapter should report room source provenance problems"
);

const missingRoomConfidence = cloneDataset(syntheticSeed) as unknown as Record<string, unknown>;
delete (((missingRoomConfidence.layouts as Array<Record<string, unknown>>)[0].rooms as Array<Record<string, unknown>>)[0]
  .measurementConfidence);
const missingRoomConfidenceResult = mapMeasurementLayoutSeedToFutureRows(missingRoomConfidence);
assert.equal(missingRoomConfidenceResult.success, false);
assert.ok(
  missingRoomConfidenceResult.issues.some(
    (issue) => issue.code === "seed_schema_invalid" && issue.path === "layouts.0.rooms.0.measurementConfidence"
  ),
  "missing room confidence should surface as a deterministic schema issue"
);

const badDimensions = cloneDataset(syntheticSeed) as unknown as Record<string, unknown>;
(((badDimensions.layouts as Array<Record<string, unknown>>)[0].rooms as Array<Record<string, unknown>>)[0].lengthCm) = -1;
const badDimensionsResult = mapMeasurementLayoutSeedToFutureRows(badDimensions);
assert.equal(badDimensionsResult.success, false);
assert.ok(
  badDimensionsResult.issues.some(
    (issue) => issue.code === "seed_schema_invalid" && issue.path === "layouts.0.rooms.0.lengthCm"
  ),
  "invalid room measurement units should be rejected before row mapping"
);

function cloneDataset(dataset: MeasurementLayoutSeedDataset): MeasurementLayoutSeedDataset {
  return JSON.parse(JSON.stringify(dataset)) as MeasurementLayoutSeedDataset;
}
