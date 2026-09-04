import assert from "node:assert/strict";

import {
  finalRenderProductFidelityLanguage,
  globalPhotorealismLanguage,
  roomBlueprintDefaultsLanguage,
  roomDesignLanguage,
  roomSpatialPlacementGuardrailLanguage,
  sourceRoomPreservationLanguage,
  spatialLayoutLanguage,
  styleDesignLanguage,
  styleDesignModules
} from ".";

assert.equal(styleDesignModules.length, 13);
assert.deepEqual(
  styleDesignModules.map((style) => style.slug),
  [
    "warm-contemporary-gallery",
    "quiet-luxury-residential",
    "soft-modern-mediterranean",
    "japandi-atelier",
    "parisian-contemporary",
    "new-classic-dubai",
    "organic-modern",
    "contemporary-hotel-residence",
    "sculptural-minimal",
    "textured-neutral",
    "collected-eclectic",
    "refined-coastal",
    "modern-arabic-luxury"
  ]
);

assert.match(roomDesignLanguage("living room"), /arranged for conversation/);
assert.match(roomDesignLanguage("living room"), /primary seating must be placed on a different wall or zone/);
assert.match(roomDesignLanguage("living room"), /TV\/media wall and primary sofa must not be on the same wall/);
assert.match(roomDesignLanguage("living room"), /sofa seat\/front should face the TV\/media wall or declared focal point/);
assert.match(roomDesignLanguage("living room"), /primary sofa should remain parallel to the focal wall/);
assert.match(roomDesignLanguage("living room"), /Do not cant or angle the primary sofa diagonally/);
assert.match(roomDesignLanguage("living room"), /sectional or L-shaped sofa, its long run should be parallel to the focal wall/);
assert.match(roomDesignLanguage("living room"), /Accent chairs should angle inward toward the sofa\/focal-point axis/);
for (const combinedAlias of ["Living & Dining", "Living / Dining", "living dining hall"]) {
  const combinedDesignLanguage = roomDesignLanguage(combinedAlias);
  assert.match(combinedDesignLanguage, /one open-plan Living & Dining hall/);
  assert.match(combinedDesignLanguage, /living zone/);
  assert.match(combinedDesignLanguage, /dining zone/);
  assert.match(combinedDesignLanguage, /Preserve clear circulation between the living and dining zones/);
  assert.match(combinedDesignLanguage, /resolve the open-plan hall as a living zone anchored to the TV\/media focal wall/);
  assert.match(combinedDesignLanguage, /do not run the sofa down the long axis of the hall/);
  assert.match(combinedDesignLanguage, /opposite side of the sofa from the TV \(behind the sofa back\)/);
  assert.match(combinedDesignLanguage, /Mark the boundary with a divider behind the sofa/);
  assert.match(combinedDesignLanguage, /primary seating must be placed on a different wall or zone/);
  assert.match(combinedDesignLanguage, /TV\/media wall and primary sofa must not be on the same wall/);
  assert.match(combinedDesignLanguage, /primary sofa should remain parallel to the focal wall/);
  assert.match(combinedDesignLanguage, /dining table/);
  assert.match(combinedDesignLanguage, /dining chairs/);
  assert.match(combinedDesignLanguage, /over-table lighting/);
}
assert.match(roomDesignLanguage("family lounge"), /generously sized rug/);
assert.match(roomDesignLanguage("dining room"), /chair spacing and pull-out clearance/);
assert.match(roomDesignLanguage("primary bedroom"), /credible bed wall/);
assert.match(roomDesignLanguage("ensuite bathroom"), /fixed fixtures/);
assert.match(roomDesignLanguage("study"), /proper desk placement/);
assert.match(roomDesignLanguage("entry hall"), /high-end editorial residential interior photography/);

assert.match(roomBlueprintDefaultsLanguage("living room"), /primary sofa or sectional placed on a separate opposite wall\/zone/);
assert.match(roomBlueprintDefaultsLanguage("living room"), /must not be on the same wall/);
assert.match(roomBlueprintDefaultsLanguage("living room"), /avoid sofa-under-TV placement/);
assert.match(roomBlueprintDefaultsLanguage("living room"), /staying square to the room grid/);
assert.match(roomBlueprintDefaultsLanguage("Living & Dining"), /two coordinated zones/);
assert.match(roomBlueprintDefaultsLanguage("Living & Dining"), /protected circulation spine/);
assert.match(roomBlueprintDefaultsLanguage("Living & Dining"), /sofa should face the focal wall/);
assert.match(roomBlueprintDefaultsLanguage("Living & Dining"), /dining chairs/);
assert.match(roomBlueprintDefaultsLanguage("Living & Dining"), /centered over-table pendant or chandelier/);
assert.match(roomDesignLanguage("Living & Dining"), /do not run the sofa down the long axis of the hall/);
assert.match(roomDesignLanguage("Living & Dining"), /opposite side of the sofa from the TV \(behind the sofa back\)/);
assert.match(roomDesignLanguage("Living & Dining"), /Mark the boundary with a divider behind the sofa/);
assert.match(roomSpatialPlacementGuardrailLanguage("living room") ?? "", /different wall or zone/);
assert.match(roomSpatialPlacementGuardrailLanguage("living room") ?? "", /parallel to the focal wall/);
assert.match(roomSpatialPlacementGuardrailLanguage("living room") ?? "", /Do not cant or angle the primary sofa diagonally/);
assert.match(roomSpatialPlacementGuardrailLanguage("living room") ?? "", /sectional or L-shaped sofa, its long run should be parallel to the focal wall/);
assert.match(roomSpatialPlacementGuardrailLanguage("Living & Dining") ?? "", /different wall or zone/);
assert.match(roomSpatialPlacementGuardrailLanguage("Living & Dining") ?? "", /parallel to the focal wall/);
assert.equal(roomSpatialPlacementGuardrailLanguage("dining room"), null);

assert.match(sourceRoomPreservationLanguage("living room"), /Preserve the uploaded source room/);
assert.doesNotMatch(sourceRoomPreservationLanguage("living room"), /plumbing locations/);
assert.match(sourceRoomPreservationLanguage("powder room"), /preserve toilet, basin\/vanity location/);
assert.doesNotMatch(sourceRoomPreservationLanguage("powder room"), /shower\/tub footprint/);
assert.match(sourceRoomPreservationLanguage("ensuite bathroom"), /shower\/tub footprint, basin\/vanity location/);

assert.match(globalPhotorealismLanguage(), /corrected verticals/);
assert.match(globalPhotorealismLanguage(), /roughness variation/);
assert.match(globalPhotorealismLanguage(), /Avoid fisheye distortion/);

assert.equal(
  styleDesignLanguage(["quiet-luxury-residential", "new-classic-dubai"]),
  [
    "Quiet Luxury Residential: quiet luxury residential style: tailored proportions, warm neutrals, honed stone, walnut, linen, wool, brushed bronze, layered warm lighting, custom-looking joinery, restrained styling.",
    "New Classic Dubai: New Classic Dubai style with warm neutrals, limestone/travertine, walnut joinery, tailored upholstery, brushed bronze, soft paneling, integrated cove lighting, and calm villa-scale luxury."
  ].join("\n")
);
assert.match(styleDesignLanguage(["modern"]) ?? "", /Sculptural Minimal/);
assert.match(styleDesignLanguage(["modern"]) ?? "", /Warm Contemporary Gallery/);
assert.match(styleDesignLanguage(["traditional"]) ?? "", /Parisian Contemporary/);
assert.match(styleDesignLanguage(["traditional"]) ?? "", /New Classic Dubai/);
assert.equal(styleDesignLanguage(["unknown-style"]), null);

assert.match(finalRenderProductFidelityLanguage(), /commerce-critical visual references/);
assert.match(finalRenderProductFidelityLanguage(), /Do not substitute/);
assert.match(finalRenderProductFidelityLanguage(), /do not imply exact product accuracy/);


// Spatial layout language: intent-conditional fragments are additive and only
// appear when the user actually answered.
assert.equal(spatialLayoutLanguage("living room", null), null);
assert.equal(spatialLayoutLanguage("living room", { focalPoint: "unknown" }), null);
const viewFocal = spatialLayoutLanguage("living room", {
  focalPoint: "view_window",
  seatingPriority: "conversation"
});
assert.match(viewFocal ?? "", /window view is the primary focal point/);
assert.match(viewFocal ?? "", /entertaining and conversation/i);
assert.match(
  spatialLayoutLanguage("Living & Dining", { diningSeatCount: 8 }) ?? "",
  /seat 8 with realistic chair spacing/
);
assert.match(
  spatialLayoutLanguage("living room", { mustKeepClear: ["balcony door"] }) ?? "",
  /balcony door/
);
assert.match(
  spatialLayoutLanguage("living room", { seatingPriority: "majlis_hosting" }) ?? "",
  /majlis/i
);

console.log("interior design language tests passed");

// The hall zoning rule ships once, not twice. roomDesignLanguage and
// roomBlueprintDefaultsLanguage are both assembled into the same image prompt,
// so a rule repeated in both burns ~2,800 characters of a 17,000 character
// budget to tell the model the same thing twice.
assert.match(roomDesignLanguage("Living & Dining"), /Hall zoning rule/);
assert.doesNotMatch(roomBlueprintDefaultsLanguage("Living & Dining"), /Hall zoning rule/);
