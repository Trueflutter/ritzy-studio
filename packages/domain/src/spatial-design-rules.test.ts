import assert from "node:assert/strict";

import { catalogFirstRolesForRoom, type RoomBundleRole } from "./catalog-first-room-generation";
import {
  deriveSpatialDesignerWarnings,
  evaluateHardCheckableSpatialRules,
  evaluateSpatialRule,
  hardCheckableSpatialRuleIds,
  spatialDesignRules,
  type SpatialRoomFacts
} from "./spatial-design-rules";

assert.deepEqual(
  [...hardCheckableSpatialRuleIds].sort(),
  ["B2", "C1", "C6", "D1", "D2", "L10", "O2"].sort()
);

assert.equal(spatialDesignRules.find((rule) => rule.id === "L1")?.checkability, "vision-QA-only");
assert.equal(spatialDesignRules.find((rule) => rule.id === "L10")?.checkability, "hard-checkable");
assert.equal(spatialDesignRules.find((rule) => rule.id === "C4")?.checkability, "prompt-checkable");

assert.equal(
  evaluateSpatialRule("C1", {
    roomType: "living_room",
    intent: {}
  }).status,
  "fail"
);

assert.equal(
  evaluateSpatialRule("C1", {
    roomType: "living_room",
    intent: { layoutMode: "living_plus_dining" }
  }).status,
  "pass"
);

assert.deepEqual(
  deriveSpatialDesignerWarnings({
    roomType: "living_room",
    intent: { focalPoint: "unknown" },
    measurements: {
      wallLengthCm: 400,
      roomDepthCm: 350,
      source: "estimated",
      confidence: "estimated"
    }
  }).map((warning) => warning.code),
  ["spatial_layout_mode_missing", "spatial_focal_point_assumed", "spatial_measurement_confidence_low", "spatial_geometry_missing"]
);

assert.equal(
  evaluateSpatialRule("L10", {
    roomType: "living_room",
    intent: { layoutMode: "living_only" },
    measurements: verifiedMeasurements(420, 360),
    footprintsByRoleId: {
      sofa: { widthCm: 240, depthCm: 95 }
    }
  }).status,
  "pass"
);

assert.equal(
  evaluateSpatialRule("L10", {
    roomType: "living_room",
    intent: { layoutMode: "living_only" },
    measurements: verifiedMeasurements(260, 210),
    footprintsByRoleId: {
      sofa: { widthCm: 260, depthCm: 110 }
    }
  }).status,
  "fail"
);

assert.equal(
  evaluateSpatialRule("L10", {
    roomType: "living_room",
    intent: { layoutMode: "living_only" },
    measurements: {
      wallLengthCm: 420,
      roomDepthCm: 360,
      source: "estimated",
      confidence: "estimated"
    },
    footprintsByRoleId: {
      sofa: { widthCm: 240, depthCm: 95 }
    }
  }).status,
  "needs_measurement"
);

const combinedRoles = [
  ...catalogFirstRolesForRoom("living_room"),
  ...catalogFirstRolesForRoom("dining_room")
] as readonly RoomBundleRole[];

assert.equal(
  evaluateSpatialRule("C6", {
    roomType: "living_room",
    intent: { layoutMode: "living_plus_dining", diningSeatCount: 4 },
    measurements: verifiedMeasurements(600, 420),
    roles: combinedRoles
  }).status,
  "pass"
);

assert.equal(
  evaluateSpatialRule("C6", {
    roomType: "living_room",
    intent: { layoutMode: "living_plus_dining", diningSeatCount: 6 },
    measurements: verifiedMeasurements(420, 360),
    roles: combinedRoles
  }).status,
  "fail"
);

assert.equal(
  evaluateSpatialRule("D1", {
    roomType: "dining_room",
    measurements: designerVerifiedMeasurements(420, 420),
    footprintsByRoleId: {
      dining_table: { widthCm: 180, depthCm: 95 }
    }
  }).status,
  "pass"
);

assert.equal(
  evaluateSpatialRule("D1", {
    roomType: "dining_room",
    measurements: verifiedMeasurements(420, 420),
    footprintsByRoleId: {
      dining_table: { widthCm: 180, depthCm: 95 }
    }
  }).status,
  "needs_measurement",
  "tight clearance checks should require designer-verified measurements"
);

assert.equal(
  evaluateSpatialRule("D2", {
    roomType: "dining_room",
    intent: { diningSeatCount: 4 },
    measurements: verifiedMeasurements(420, 420),
    roles: [
      {
        id: "dining_chairs",
        roomType: "dining_room",
        label: "dining chairs",
        category: "chairs",
        acceptedCategories: ["chairs"],
        quantity: 6,
        required: true,
        importance: "anchor",
        includeWhen: "always"
      }
    ]
  }).status,
  "fail"
);

assert.equal(
  evaluateSpatialRule("B2", {
    roomType: "bedroom",
    measurements: designerVerifiedMeasurements(390, 420),
    footprintsByRoleId: {
      bed: { widthCm: 180, depthCm: 200 }
    }
  }).status,
  "pass"
);

assert.equal(
  evaluateSpatialRule("O2", {
    roomType: "home_office",
    measurements: designerVerifiedMeasurements(260, 220),
    footprintsByRoleId: {
      desk: { widthCm: 140, depthCm: 75 }
    }
  }).status,
  "pass"
);

assert.equal(
  evaluateSpatialRule("L1", {
    roomType: "living_room"
  }).status,
  "not_applicable",
  "vision-only rules should not pretend to be hard checks"
);

const hardVerdicts = evaluateHardCheckableSpatialRules({
  roomType: "living_room",
  intent: { layoutMode: "living_only", focalPoint: "tv_media_wall", focalPointConfidence: "user_selected" },
  measurements: verifiedMeasurements(420, 360),
  footprintsByRoleId: {
    sofa: { widthCm: 240, depthCm: 95 }
  }
});

assert.equal(hardVerdicts.length, hardCheckableSpatialRuleIds.length);
assert.equal(hardVerdicts.find((verdict) => verdict.ruleId === "C1")?.status, "pass");
assert.equal(hardVerdicts.find((verdict) => verdict.ruleId === "L10")?.status, "pass");

console.log("spatial design rule tests passed");

function verifiedMeasurements(wallLengthCm: number, roomDepthCm: number): SpatialRoomFacts["measurements"] {
  return {
    wallLengthCm,
    roomDepthCm,
    ceilingHeightCm: 280,
    source: "manual",
    confidence: "verified"
  };
}

function designerVerifiedMeasurements(wallLengthCm: number, roomDepthCm: number): SpatialRoomFacts["measurements"] {
  return {
    wallLengthCm,
    roomDepthCm,
    ceilingHeightCm: 280,
    source: "designer_verified",
    confidence: "designer_verified"
  };
}
