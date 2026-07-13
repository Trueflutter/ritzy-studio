import assert from "node:assert/strict";

import { catalogFirstRolesForRoom, type RoomBundleRole } from "./catalog-first-room-generation";
import {
  deriveSpatialDesignerWarnings,
  evaluateHardCheckableSpatialRules,
  evaluateSpatialRule,
  hardCheckableSpatialRuleIds,
  parseSpatialIntent,
  spatialDesignRules,
  spatialLayoutModeForRoomType,
  type SpatialRoomFacts
} from "./spatial-design-rules";

assert.equal(spatialLayoutModeForRoomType("Living & Dining"), "living_plus_dining");
assert.equal(spatialLayoutModeForRoomType("Living Room"), "living_only");
assert.equal(spatialLayoutModeForRoomType("Dining Room"), "dining_only");
assert.equal(spatialLayoutModeForRoomType("Bedroom"), "bedroom");
assert.equal(spatialLayoutModeForRoomType("Home Office"), "home_office");

const capturedIntent = parseSpatialIntent(
  {
    spatialIntent: {
      focalPoint: "view_window",
      seatingPriority: "conversation",
      diningSeatCount: 8,
      mustKeepClear: "balcony door"
    }
  },
  "Living & Dining"
);
assert.equal(capturedIntent.layoutMode, "living_plus_dining");
assert.equal(capturedIntent.focalPoint, "view_window");
assert.equal(capturedIntent.focalPointConfidence, "user_selected");
assert.equal(capturedIntent.diningSeatCount, 8);
assert.deepEqual(capturedIntent.mustKeepClear, ["balcony door"]);
assert.equal(capturedIntent.assumptions?.length, 0);

const assumedIntent = parseSpatialIntent({}, "Living Room");
assert.equal(assumedIntent.layoutMode, "living_only");
assert.equal(assumedIntent.focalPoint, "unknown");
assert.equal(assumedIntent.focalPointConfidence, "assumed");
assert.ok((assumedIntent.assumptions ?? []).some((entry) => entry.includes("TV/media wall")));

const combinedAssumed = parseSpatialIntent({ spatialIntent: { focalPoint: "not_a_value" } }, "Living & Dining");
assert.equal(combinedAssumed.focalPoint, "unknown");
assert.ok((combinedAssumed.assumptions ?? []).some((entry) => entry.includes("six")));

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

// Oversized free-text mustKeepClear is bounded at the parse boundary: entries capped at 6,
// each collapsed and truncated, so downstream image prompts cannot be blown past their
// provider token caps by a hostile or accidental brief value.
const hostileIntent = parseSpatialIntent(
  {
    spatialIntent: {
      mustKeepClear: [
        "x".repeat(20_000),
        ...Array.from({ length: 10 }, (_, index) => `zone ${index}`)
      ]
    }
  },
  "Living Room"
);
if (hostileIntent.mustKeepClear.length > 6) {
  throw new Error("mustKeepClear entry count not capped");
}
for (const entry of hostileIntent.mustKeepClear) {
  if (entry.length > 160) {
    throw new Error("mustKeepClear entry length not capped");
  }
}

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
