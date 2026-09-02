import assert from "node:assert/strict";

import type { ProductMatchCandidate } from "./product-matching";
import {
  checkCandidateAgainstSpecRole,
  missingRolesSchema,
  parseMissingRoles,
  sourcingRolesFromDesignSpec,
  type SpecSourcingRole
} from "./spec-sourcing";

// S3: the confirmed design spec is the sourcing contract. These pin the
// spec-object to role/category mapping and the HARD contracts (category,
// class, fixture class, silhouette, capacity, size) that reject the Phase 0
// failures: a chandelier chosen for a floor-lamp role and a swing/rocking
// chair chosen for a lounge-chair role (replayed here as fixtures from the
// live catalogue rows).

const base: ProductMatchCandidate = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Product",
  retailerName: "Home Centre",
  canonicalUrl: "https://example.com/p",
  description: null,
  categoryNormalized: "lighting",
  priceAed: 100,
  salePriceAed: null,
  availability: "in stock",
  primaryImageUrl: "https://example.com/p.jpg",
  color: null,
  material: null,
  styleTags: [],
  colorTags: [],
  materialTags: [],
  roomTags: [],
  lastCheckedAt: null,
  dimensions: null
};

// Phase 0 failure 1: the sourcing stage picked this for a "floor or table light" role.
const chandelier: ProductMatchCandidate = {
  ...base,
  id: "4862b5f4-4d18-4ace-bb57-deecaffd7a2b",
  name: "Emis 12-Lights Faux Alabaster Chandelier",
  retailerName: "2XL Home",
  description: "Buy Emis 12-Lights Faux Alabaster Chandelier online from 2XL Home with free delivery."
};
const floorLamp: ProductMatchCandidate = { ...base, name: "Arc Floor Lamp with Linen Shade" };
const tableLamp: ProductMatchCandidate = { ...base, name: "Nara Ceramic Table Lamp" };
const sconce: ProductMatchCandidate = { ...base, name: "Bolt Brass Wall Sconce" };
const unknownLight: ProductMatchCandidate = { ...base, name: "Lumi Light" };

// Phase 0 failure 2: a literal swing/rocking chair auto-selected over the armchair in the render.
const swingChair: ProductMatchCandidate = {
  ...base,
  id: "ca1ada0d-6c52-495c-b30a-a0d296c43f8e",
  name: "Armchair Swing Ritmo Vintage Econo",
  retailerName: "Chattels & More",
  categoryNormalized: "armchairs",
  description:
    "A favourite as a reading chair and for relaxing in all living rooms. This rocking chair is particularly suitable for the living room.",
  color: "Brown",
  material: "Frame: Birch",
  dimensions: { widthCm: null, depthCm: 76, heightCm: 83, sourceText: "?x76x83" }
};
const stilo: ProductMatchCandidate = {
  ...base,
  id: "8dc0bd91-44e8-483d-8a93-0ea3278f275e",
  name: "Stilo Armchair in Savoy Cognac Brown Leather with Metal Legs",
  retailerName: "Chattels & More",
  categoryNormalized: "armchairs",
  description: "Experience casual comfort with the Stilo Armchair in Savoy Cognac Brown Leather.",
  color: "Brown",
  material: "Leather, Solid Wood, Metal, Foam",
  dimensions: { widthCm: 80, depthCm: 88, heightCm: 89, sourceText: "80x88x89" }
};
const officeArmchair: ProductMatchCandidate = {
  ...base,
  name: "Executive Office Armchair",
  categoryNormalized: "armchairs"
};
const stool: ProductMatchCandidate = { ...base, name: "Oak Counter Stool", categoryNormalized: "stools" };

const twoSeater: ProductMatchCandidate = {
  ...base,
  name: "Milo 2 Seater Sofa",
  categoryNormalized: "sofas",
  dimensions: { widthCm: 160, depthCm: 90, heightCm: 80, sourceText: "160x90x80" }
};
const threeSeater: ProductMatchCandidate = {
  ...base,
  name: "Milo 3 Seater Sofa",
  categoryNormalized: "sofas",
  dimensions: { widthCm: 220, depthCm: 95, heightCm: 80, sourceText: "220x95x80" }
};
const silentSofa: ProductMatchCandidate = { ...base, name: "Amalfi Sofa", categoryNormalized: "sofas" };
const wideSilentSofa: ProductMatchCandidate = {
  ...base,
  name: "Amalfi Sofa",
  categoryNormalized: "sofas",
  dimensions: { widthCm: 240, depthCm: 95, heightCm: 80, sourceText: "240x95x80" }
};
const sectional: ProductMatchCandidate = { ...base, name: "Corner Sectional Sofa", categoryNormalized: "sofas" };

const fourSeatTable: ProductMatchCandidate = {
  ...base,
  name: "Prado 4 Seater Dining Table",
  categoryNormalized: "dining_tables"
};
const sixSeatTable: ProductMatchCandidate = {
  ...base,
  name: "Prado 6 Seater Dining Table",
  categoryNormalized: "dining_tables"
};

const SPEC = {
  objects: [
    { role: "sofa", label: "curved three-seat sofa", quantity: 1, sizeDescriptor: "around 240 cm", capacity: "seats 3", paletteMaterials: ["ivory boucle"] },
    { role: "lounge_chair", label: "sculptural cognac leather lounge chair", quantity: 1, sizeDescriptor: null, capacity: "seats 1", paletteMaterials: ["cognac leather"] },
    { role: "coffee_table", label: "rounded walnut coffee table", quantity: 1, sizeDescriptor: "around 110 cm", capacity: null, paletteMaterials: ["walnut"] },
    { role: "floor_lamp", label: "tall tripod floor lamp with linen shade", quantity: 1, sizeDescriptor: "tall", capacity: null, paletteMaterials: ["brass", "linen"] },
    { role: "lighting", label: "recessed downlights", quantity: 8, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
    { role: "dining_table", label: "oval oak dining table", quantity: 1, sizeDescriptor: "around 200 cm", capacity: "seats 6", paletteMaterials: ["oak"] },
    { role: "dining_chair", label: "upholstered dining chairs", quantity: 6, sizeDescriptor: null, capacity: null, paletteMaterials: ["taupe fabric"] },
    { role: "pendant", label: "linen drum pendant over the dining table", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: ["linen"] },
    { role: "rug", label: "large flatweave rug", quantity: 1, sizeDescriptor: "around 300 x 200 cm", capacity: null, paletteMaterials: ["wool"] },
    { role: "bedside_table", label: "walnut bedside tables", quantity: 2, sizeDescriptor: null, capacity: null, paletteMaterials: ["walnut"] },
    { role: "wall_art", label: "large abstract canvas", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
    { role: "cushions", label: "textured cushions", quantity: 4, sizeDescriptor: null, capacity: null, paletteMaterials: ["boucle"] },
    { role: "aquarium", label: "wall-mounted aquarium", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] }
  ]
};

const { roles, unsourceable } = sourcingRolesFromDesignSpec(SPEC, "Living Room");
const byRole = (role: string) => roles.find((entry) => entry.specRole === role) as SpecSourcingRole;

// --- mapping: every purchasable spec object becomes a role with a canonical category
assert.deepEqual(
  roles.map((role) => [role.specRole, role.category]),
  [
    ["sofa", "sofas"],
    ["lounge_chair", "armchairs"],
    ["coffee_table", "coffee_tables"],
    ["floor_lamp", "lighting"],
    ["dining_table", "dining_tables"],
    ["dining_chair", "chairs"],
    ["pendant", "lighting"],
    ["rug", "rugs"],
    ["bedside_table", "side_tables"],
    ["wall_art", "wall_art"],
    ["cushions", "decor"]
  ]
);
assert.equal(byRole("dining_chair").quantity, 6);
assert.equal(byRole("bedside_table").quantity, 2, "bedside tables map to side tables, never to beds");
assert.equal(byRole("sofa").priority, "required");
assert.equal(byRole("cushions").priority, "supporting");
assert.equal(byRole("sofa").contract.minSeats, 3, "capacity is parsed into a seat contract");
assert.equal(byRole("dining_table").contract.minSeats, 6);
assert.equal(byRole("floor_lamp").contract.fixtureClass, "floor_or_table");
assert.equal(byRole("pendant").contract.fixtureClass, "ceiling");
assert.equal(byRole("sofa").sizeClass, "standard");
assert.ok(byRole("sofa").visualBrief?.includes("ivory boucle"), "palette/materials reach the visual brief");
assert.ok(byRole("sofa").specKey.length > 0);
assert.equal(new Set(roles.map((role) => role.specKey)).size, roles.length, "spec keys are unique");

// --- unsourceable objects are reported, never silently dropped
assert.deepEqual(
  unsourceable.map((entry) => [entry.label, entry.kind]),
  [
    ["recessed downlights", "built_in"],
    ["wall-mounted aquarium", "no_catalogue_category"]
  ]
);

// --- Phase 0 failure 1: a chandelier can never fill a floor-lamp role
assert.deepEqual(checkCandidateAgainstSpecRole(chandelier, byRole("floor_lamp")), {
  ok: false,
  reason: "lighting_fixture_class_mismatch"
});
assert.deepEqual(checkCandidateAgainstSpecRole(sconce, byRole("floor_lamp")), {
  ok: false,
  reason: "lighting_fixture_class_mismatch"
});
assert.deepEqual(checkCandidateAgainstSpecRole(floorLamp, byRole("floor_lamp")), { ok: true });
assert.deepEqual(checkCandidateAgainstSpecRole(tableLamp, byRole("floor_lamp")), { ok: true });
assert.deepEqual(checkCandidateAgainstSpecRole(chandelier, byRole("pendant")), { ok: true });
assert.deepEqual(checkCandidateAgainstSpecRole(floorLamp, byRole("pendant")), {
  ok: false,
  reason: "lighting_fixture_class_mismatch"
});
// An unclassifiable fixture cannot be proven wrong; it stays eligible.
assert.deepEqual(checkCandidateAgainstSpecRole(unknownLight, byRole("floor_lamp")), { ok: true });

// --- Phase 0 failure 2: a swing/rocking chair can never fill a lounge-chair role
assert.deepEqual(checkCandidateAgainstSpecRole(swingChair, byRole("lounge_chair")), {
  ok: false,
  reason: "silhouette_excluded"
});
assert.deepEqual(checkCandidateAgainstSpecRole(stilo, byRole("lounge_chair")), { ok: true });
assert.deepEqual(checkCandidateAgainstSpecRole(officeArmchair, byRole("lounge_chair")), {
  ok: false,
  reason: "class_tag_conflict"
});
assert.deepEqual(checkCandidateAgainstSpecRole(stool, byRole("lounge_chair")), {
  ok: false,
  reason: "category_mismatch"
});

// --- capacity: a two-seater cannot fill a three-seat sofa; silence is not proof
assert.deepEqual(checkCandidateAgainstSpecRole(twoSeater, byRole("sofa")), { ok: false, reason: "capacity_mismatch" });
assert.deepEqual(checkCandidateAgainstSpecRole(threeSeater, byRole("sofa")), { ok: true });
assert.deepEqual(checkCandidateAgainstSpecRole(silentSofa, byRole("sofa")), { ok: true });
assert.deepEqual(checkCandidateAgainstSpecRole(wideSilentSofa, byRole("sofa")), { ok: true });
assert.deepEqual(checkCandidateAgainstSpecRole(sectional, byRole("sofa")), {
  ok: false,
  reason: "size_class_mismatch"
});
assert.deepEqual(checkCandidateAgainstSpecRole(fourSeatTable, byRole("dining_table")), {
  ok: false,
  reason: "capacity_mismatch"
});
assert.deepEqual(checkCandidateAgainstSpecRole(sixSeatTable, byRole("dining_table")), { ok: true });

// --- the missing-roles column contract
const entries = missingRolesSchema.parse([
  {
    specKey: "3:floor_lamp",
    kind: "missing",
    label: "tall tripod floor lamp with linen shade",
    category: "lighting",
    quantity: 1,
    reason: "Every lighting candidate in the catalogue was a ceiling fixture; the design asks for a floor lamp.",
    guidance: "Try Refresh matches after the nightly catalogue update, or source this piece directly."
  },
  {
    specKey: "4:lighting",
    kind: "built_in",
    label: "recessed downlights",
    category: null,
    quantity: 8,
    reason: "Built into the room; not a purchasable piece.",
    guidance: "Nothing to buy for this one."
  }
]);
assert.equal(entries.length, 2);
assert.deepEqual(parseMissingRoles("garbage"), []);
assert.deepEqual(parseMissingRoles([{ nope: true }]), []);
assert.equal(parseMissingRoles(entries).length, 2);

console.log("spec-sourcing tests passed");
