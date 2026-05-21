import assert from "node:assert/strict";

import {
  finalRenderProductFidelityLanguage,
  globalPhotorealismLanguage,
  productRoleLanguage,
  roomDesignLanguage,
  sourceRoomPreservationLanguage,
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
assert.match(roomDesignLanguage("family lounge"), /generously sized rug/);
assert.match(roomDesignLanguage("dining room"), /chair spacing and pull-out clearance/);
assert.match(roomDesignLanguage("primary bedroom"), /credible bed wall/);
assert.match(roomDesignLanguage("ensuite bathroom"), /fixed fixtures/);
assert.match(roomDesignLanguage("study"), /high-end editorial residential interior photography/);

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

assert.match(productRoleLanguage("living room"), /anchor seating/);
assert.match(productRoleLanguage("dining room"), /over-table lighting/);
assert.match(productRoleLanguage("bedroom"), /bedside tables/);
assert.match(productRoleLanguage("bathroom"), /without moving plumbing/);
assert.match(productRoleLanguage("office"), /Do not force every layer/);

console.log("interior design language tests passed");
