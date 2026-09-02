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

// --- review findings on the contract module (6b3e959): compound role
// keys, placement phrases, seat ranges, size vocabulary, marketing copy
{
  const { parseSeatRange, placementStrippedText } = await import("./spec-sourcing");
  const compound = sourcingRolesFromDesignSpec(
    {
      objects: [
        { role: "desk_lamp", label: "brass desk lamp", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "bedside_lamp", label: "pair of ceramic bedside lamps", quantity: 2, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "desk_chair", label: "leather desk chair", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "bed_throw", label: "mohair bed throw", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "coffee_table_books", label: "stack of coffee table books", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "accessories", label: "decorative accessories", quantity: 3, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "floor_lamp", label: "arc floor lamp hanging over the sofa", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "wall_art", label: "large abstract artwork above the fireplace", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "sconces", label: "pair of wall sconces flanking the fireplace", quantity: 2, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "sofa", label: "long four-seat sofa", quantity: 1, sizeDescriptor: null, capacity: "seats 4", paletteMaterials: [] }
      ]
    },
    "Bedroom"
  );
  assert.deepEqual(
    compound.roles.map((role) => [role.specRole, role.category, role.contract.fixtureClass ?? null]),
    [
      ["desk_lamp", "lighting", "floor_or_table"],
      ["bedside_lamp", "lighting", "floor_or_table"],
      ["desk_chair", "office_chairs", null],
      ["bed_throw", "decor", null],
      ["coffee_table_books", "decor", null],
      ["accessories", "decor", null],
      ["floor_lamp", "lighting", "floor_or_table"],
      ["wall_art", "wall_art", null],
      ["sconces", "lighting", "wall"],
      ["sofa", "sofas", null]
    ]
  );
  assert.deepEqual(compound.unsourceable, [], "placement phrases never make a purchasable piece built-in");
  assert.equal(compound.roles[9].sizeClass, "standard", "a straight four-seater is standard, like the scorer says");
  const fourSeater: ProductMatchCandidate = {
    ...base,
    name: "Milo 4 Seater Sofa",
    categoryNormalized: "sofas",
    dimensions: { widthCm: 260, depthCm: 95, heightCm: 80, sourceText: "260x95x80" }
  };
  assert.deepEqual(checkCandidateAgainstSpecRole(fourSeater, compound.roles[9]), { ok: true });
  const stripped = placementStrippedText("large abstract artwork above the fireplace");
  assert.equal(stripped, "large abstract artwork");

  assert.deepEqual(parseSeatRange("12 seater"), { min: 12, max: 12 });
  assert.deepEqual(parseSeatRange("seats 12"), { min: 12, max: 12 });
  assert.deepEqual(parseSeatRange("seats 6-8"), { min: 6, max: 8 });
  assert.deepEqual(parseSeatRange("seats 6 to 8"), { min: 6, max: 8 });
  assert.deepEqual(parseSeatRange("seats up to 8"), { min: 1, max: 8 });
  assert.deepEqual(parseSeatRange("2-3 seater"), { min: 2, max: 3 });
  assert.deepEqual(parseSeatRange("three-seat"), { min: 3, max: 3 });
  assert.equal(parseSeatRange("around 240 cm"), null);
  const twelveSeatTable: ProductMatchCandidate = { ...base, name: "Grand 12 Seater Dining Table", categoryNormalized: "dining_tables" };
  const twelveRole = sourcingRolesFromDesignSpec(
    { objects: [{ role: "dining_table", label: "long dining table", quantity: 1, sizeDescriptor: null, capacity: "seats 12", paletteMaterials: [] }] },
    "Dining Room"
  ).roles[0];
  assert.deepEqual(checkCandidateAgainstSpecRole(twelveSeatTable, twelveRole), { ok: true });

  // marketing copy never rejects; an unqualified "lamp" proves nothing
  const chattySofa: ProductMatchCandidate = { ...base, name: "Milo 3 Seater Sofa", categoryNormalized: "sofas", description: "Perfect for hanging out with friends." };
  assert.deepEqual(checkCandidateAgainstSpecRole(chattySofa, byRole("sofa")), { ok: true });
  const dropLamp: ProductMatchCandidate = { ...base, name: "Nordic Glass Drop Lamp" };
  assert.deepEqual(checkCandidateAgainstSpecRole(dropLamp, byRole("floor_lamp")), { ok: true });
  assert.deepEqual(checkCandidateAgainstSpecRole(dropLamp, byRole("pendant")), { ok: true });

  // partially malformed column keeps the valid entries
  assert.equal(
    parseMissingRoles([
      { specKey: "1:x", kind: "missing", label: "x", category: "rugs", quantity: 1, reason: "r", guidance: "g" },
      { nope: true }
    ]).length,
    1
  );
}

// --- review findings on the plan increment (251f34a): same-label objects
// merge, the pass reconciles by echo key with a normalized category
{
  const { resolveSpecRoleOutcomes, buildSpecSourcingPlan } = await import("./spec-sourcing");
  const mergedRoles = sourcingRolesFromDesignSpec(
    {
      objects: [
        { role: "table_lamp", label: "ceramic table lamp", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: ["ceramic"] },
        { role: "table_lamp", label: "Ceramic  table lamp", quantity: 1, sizeDescriptor: "small", capacity: null, paletteMaterials: ["brass"] },
        { role: "floor_lamp", label: "arc floor lamp", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] }
      ]
    },
    "Living Room"
  ).roles;
  assert.equal(mergedRoles.length, 2, "same-label objects in one category are one role");
  assert.equal(mergedRoles[0].quantity, 2, "with the summed quantity");
  assert.deepEqual(mergedRoles[0].specPaletteMaterials, ["ceramic", "brass"]);
  assert.equal(mergedRoles[0].specSizeDescriptor, "small");
  assert.deepEqual(mergedRoles.map((role) => role.echoKey), ["role-1", "role-2"]);

  const lampPlan = buildSpecSourcingPlan({
    roles: mergedRoles,
    unsourceable: [],
    candidates: [
      { ...tableLamp, id: "00000000-0000-4000-8000-000000000041" },
      { ...floorLamp, id: "00000000-0000-4000-8000-000000000042" }
    ],
    roomType: "Living Room",
    conceptText: "warm lounge"
  });
  const echoed = resolveSpecRoleOutcomes({
    pools: lampPlan.pools,
    roleResults: [
      { category: "Lighting", roleLabel: "role-1", status: "acceptable_match", productId: "00000000-0000-4000-8000-000000000041", reason: "Ceramic lamp fits." },
      { category: "lighting", roleLabel: "ROLE-2", status: "strong_match", productId: "00000000-0000-4000-8000-000000000042", reason: "Arc lamp matches." }
    ],
    selections: []
  });
  assert.deepEqual(
    echoed.map((outcome) => outcome.kind),
    ["selected", "selected"],
    "a normalized category and the echo key reconcile the pass, whatever the label length"
  );
}

// --- second review round on the contract module (1d75476)
{
  const { parseSeatRange, placementStrippedText } = await import("./spec-sourcing");
  // 1 + 4: placement clauses need an article; compound descriptors survive
  assert.equal(placementStrippedText("curved sofa facing the fireplace"), "curved sofa");
  assert.equal(placementStrippedText("pair of armchairs near the fireplace"), "pair of armchairs");
  assert.equal(placementStrippedText("wool rug at the fireplace"), "wool rug");
  assert.equal(placementStrippedText("sofa in the corner"), "sofa");
  assert.equal(placementStrippedText("wrap around sectional sofa"), "wrap around sectional sofa");
  assert.equal(placementStrippedText("slim under bed storage drawers"), "slim under bed storage drawers");
  const placed = sourcingRolesFromDesignSpec(
    {
      objects: [
        { role: "sofa", label: "curved sofa facing the fireplace", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "sofa", label: "wrap-around sectional sofa", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "sofa", label: "curved sofa opposite the six seater dining table", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "sofa", label: "long low sofa", quantity: 1, sizeDescriptor: null, capacity: "seats 6", paletteMaterials: [] }
      ]
    },
    "Living Room"
  );
  assert.equal(placed.unsourceable.length, 0, "a sofa facing the fireplace is still a sofa");
  assert.equal(placed.roles[0].category, "sofas");
  assert.equal(placed.roles[1].sizeClass, "large", "wrap-around sectional keeps its shape");
  assert.equal(placed.roles[2].contract.minSeats, undefined, "the dining table's seats never become the sofa's");
  assert.equal(placed.roles[3].sizeClass, "any", "six seats with no shape word constrains by capacity only");
  assert.deepEqual(checkCandidateAgainstSpecRole(sectional, placed.roles[3]), { ok: true });

  // 2: generic lighting/decor tokens never outrank furniture
  const ordered = sourcingRolesFromDesignSpec(
    {
      objects: [
        { role: "lamp_table", label: "walnut lamp table", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "seating", label: "light grey three-seat sofa", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "table", label: "light oak dining table", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "bowl_chair", label: "rattan bowl chair", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
        { role: "desk_lamp", label: "brass desk lamp", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] }
      ]
    },
    "Living Room"
  );
  assert.deepEqual(
    ordered.roles.map((role) => [role.specRole, role.category]),
    [
      ["lamp_table", "side_tables"],
      ["seating", "sofas"],
      ["table", "dining_tables"],
      ["bowl_chair", "armchairs"],
      ["desk_lamp", "lighting"]
    ]
  );

  // 5: a trailing number is noise, a real range needs its separator
  assert.deepEqual(parseSeatRange("Seats 4. 10 year guarantee."), { min: 4, max: 4 });
  assert.deepEqual(parseSeatRange("seats 6-8"), { min: 6, max: 8 });
  assert.deepEqual(parseSeatRange("seats 6 \u2013 8"), { min: 6, max: 8 });
  assert.deepEqual(parseSeatRange("seats 6 to 8"), { min: 6, max: 8 });
  assert.deepEqual(parseSeatRange("2-3 seater"), { min: 2, max: 3 });
  assert.deepEqual(parseSeatRange("12 seater"), { min: 12, max: 12 });
  assert.deepEqual(parseSeatRange("seats up to 8"), { min: 1, max: 8 });

  // 7: an uplighter that "washes light across the ceiling" is still a floor lamp
  const uplighter: ProductMatchCandidate = {
    ...base,
    name: "Arc Floor Lamp",
    description: "The uplighter washes light across the ceiling; ideal for rooms with high ceilings."
  };
  assert.deepEqual(checkCandidateAgainstSpecRole(uplighter, byRole("floor_lamp")), { ok: true });
  const hangingLabel = sourcingRolesFromDesignSpec(
    { objects: [{ role: "lighting", label: "arc floor lamp hanging over the sofa", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] }] },
    "Living Room"
  ).roles[0];
  assert.equal(hangingLabel.contract.fixtureClass, "floor_or_table");

  // 8: an unambiguous silhouette in the description is still proof
  const rar: ProductMatchCandidate = {
    ...base,
    name: "Eames Style RAR Chair",
    categoryNormalized: "armchairs",
    description: "This rocking chair is a mid-century classic."
  };
  assert.deepEqual(checkCandidateAgainstSpecRole(rar, byRole("lounge_chair")), { ok: false, reason: "silhouette_excluded" });
  const gardenPalette: ProductMatchCandidate = {
    ...base,
    name: "Stilo Armchair",
    categoryNormalized: "armchairs",
    description: "A garden-inspired palette for hanging out indoors."
  };
  assert.deepEqual(checkCandidateAgainstSpecRole(gardenPalette, byRole("lounge_chair")), { ok: true });
}

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

// ------------------------------------------------------------- plan tests
{
  const {
    buildSpecSourcingPlan,
    imageCandidateIdsForPools,
    resolveSpecRoleOutcomes,
    resolveSpecRoleOutcomesByRanking,
    roleOptionsFromOutcomes
  } = await import("./spec-sourcing");
  const { groupShoppingItemsByRole, buildShoppingListItemRows, fitSelectionToBudget, roleOptionKey } = await import(
    "./product-matching"
  );

  const withId = (candidate: ProductMatchCandidate, id: string) => ({ ...candidate, id });
  const catalogue: ProductMatchCandidate[] = [
    withId(twoSeater, "00000000-0000-4000-8000-000000000011"),
    withId(threeSeater, "00000000-0000-4000-8000-000000000012"),
    withId(sectional, "00000000-0000-4000-8000-000000000013"),
    withId(chandelier, "00000000-0000-4000-8000-000000000021"),
    withId(sconce, "00000000-0000-4000-8000-000000000022"),
    withId(stilo, "00000000-0000-4000-8000-000000000031"),
    withId(swingChair, "00000000-0000-4000-8000-000000000032")
  ];
  const planSpec = {
    objects: [
      SPEC.objects[0], // sofa, seats 3
      SPEC.objects[1], // lounge chair
      SPEC.objects[3], // floor lamp
      SPEC.objects[4] // recessed downlights (built in)
    ]
  };
  const mapped = sourcingRolesFromDesignSpec(planSpec, "Living Room");
  const plan = buildSpecSourcingPlan({
    roles: mapped.roles,
    unsourceable: mapped.unsourceable,
    candidates: catalogue,
    roomType: "Living Room",
    conceptText: "Warm contemporary lounge; ivory boucle sofa, cognac leather chair, brass floor lamp"
  });

  // --- the contract filters BEFORE the scorer's top-N: only contract-clean
  // candidates reach a pool, and the rejections are counted
  const sofaPool = plan.pools.find((pool) => pool.role.specRole === "sofa");
  assert.ok(sofaPool, "the sofa role has a pool");
  assert.deepEqual(
    sofaPool?.candidates.map((candidate) => candidate.name),
    ["Milo 3 Seater Sofa"],
    "the two-seater and the sectional never reach the pool"
  );
  assert.equal(sofaPool?.rejectionReasons.capacity_mismatch, 1);
  assert.equal(sofaPool?.rejectionReasons.size_class_mismatch, 1);
  const chairPool = plan.pools.find((pool) => pool.role.specRole === "lounge_chair");
  assert.deepEqual(
    chairPool?.candidates.map((candidate) => candidate.name),
    ["Stilo Armchair in Savoy Cognac Brown Leather with Metal Legs"],
    "the swing chair never reaches the lounge-chair pool"
  );
  assert.equal(chairPool?.rejectionReasons.silhouette_excluded, 1);

  // --- a role with no contract-clean candidate is reported missing with the
  // reason the rejections tell, beside the built-in fixture
  assert.equal(plan.pools.some((pool) => pool.role.specRole === "floor_lamp"), false);
  const missingLamp = plan.missing.find((entry) => entry.specKey.endsWith(":floor_lamp"));
  assert.equal(missingLamp?.kind, "missing");
  assert.equal(missingLamp?.category, "lighting");
  assert.match(missingLamp?.reason ?? "", /wrong kind of fixture.*floor or table lamp/);
  assert.equal(missingLamp?.guidance, "Try Refresh matches after the nightly catalogue update, or source this piece directly from a retailer.");
  const builtIn = plan.missing.find((entry) => entry.kind === "built_in");
  assert.equal(builtIn?.label, "recessed downlights");
  assert.equal(builtIn?.quantity, 8);

  // --- image budget: top of every pool first, only candidates with an image
  const ids = imageCandidateIdsForPools(plan.pools, { perRole: 2, total: 8 });
  assert.deepEqual(ids, ["00000000-0000-4000-8000-000000000012", "00000000-0000-4000-8000-000000000031"]);
  assert.deepEqual(imageCandidateIdsForPools(plan.pools, { perRole: 2, total: 1 }), ["00000000-0000-4000-8000-000000000012"]);

  // --- outcomes: the visual pass's pick inside the pool wins; a role it
  // judged unmatched stays missing with its reason; a pick outside the pool
  // never lands
  const outcomes = resolveSpecRoleOutcomes({
    pools: plan.pools,
    roleResults: [
      { category: "sofas", roleLabel: "curved three-seat sofa", status: "strong_match", productId: "00000000-0000-4000-8000-000000000012", reason: "Curved ivory boucle three-seater matches the render." },
      { category: "armchairs", roleLabel: "sculptural cognac leather lounge chair", status: "missing_required", productId: null, reason: "No cognac leather lounge chair with a sculptural shell in the pool." }
    ],
    selections: [
      { productId: "00000000-0000-4000-8000-000000000012", category: "sofas", roleLabel: "curved three-seat sofa", matchStatus: "strong_match", visualMatchReason: "Curved ivory boucle three-seater matches the render.", mismatchNote: null }
    ]
  });
  assert.equal(outcomes.length, 2);
  assert.equal(outcomes[0].kind, "selected");
  assert.equal(outcomes[0].kind === "selected" && outcomes[0].selectedProductId, "00000000-0000-4000-8000-000000000012");
  assert.equal(outcomes[1].kind, "missing");
  assert.match(outcomes[1].kind === "missing" ? outcomes[1].entry.reason : "", /visual pass found no catalogue piece.*cognac leather/);

  const outsidePool = resolveSpecRoleOutcomes({
    pools: plan.pools,
    roleResults: [
      { category: "sofas", roleLabel: "curved three-seat sofa", status: "strong_match", productId: "00000000-0000-4000-8000-000000000011", reason: "two seater" }
    ],
    selections: []
  });
  assert.equal(outsidePool[0].kind, "missing", "a pick outside the contract-clean pool is never accepted");

  // --- ranking fallback: honest closest-available, never a visual claim
  const ranked = resolveSpecRoleOutcomesByRanking(plan.pools, "The visual pass timed out.");
  assert.ok(ranked.every((outcome) => outcome.kind === "selected" && outcome.matchStatus === "closest_available"));

  // --- role options + item rows keyed by the spec role key, two roles in one
  // category stay distinct end to end
  const twoLightingRoles = sourcingRolesFromDesignSpec(
    { objects: [SPEC.objects[3], SPEC.objects[7]] },
    "Living Room"
  ).roles;
  assert.notEqual(roleOptionKey(twoLightingRoles[0]), roleOptionKey(twoLightingRoles[1]));
  const { roleOptions, selectedProductIdByRole, missing } = roleOptionsFromOutcomes(outcomes);
  assert.equal(roleOptions.length, 1);
  assert.equal(missing.length, 1);
  assert.equal(selectedProductIdByRole.get(roleOptionKey(roleOptions[0])), "00000000-0000-4000-8000-000000000012");
  const rows = buildShoppingListItemRows({ roleOptions, selectedProductIdByRole });
  assert.equal(rows[0].status, "selected");
  assert.equal(rows[0].role_label, "curved three-seat sofa");
  const fit = fitSelectionToBudget({ roleOptions, selectedProductIdByRole, budgetMaxAed: null });
  assert.equal(fit.selectedProductIdByRole.get(roleOptionKey(roleOptions[0])), "00000000-0000-4000-8000-000000000012");

  const groups = groupShoppingItemsByRole([
    { id: "a", status: "selected", category: "lighting", role_label: "tall tripod floor lamp", role_priority: "required", role_quantity: 1, option_rank: 0 },
    { id: "b", status: "option", category: "lighting", role_label: "linen drum pendant", role_priority: "required", role_quantity: 1, option_rank: 0 },
    { id: "c", status: "option", category: "lighting", role_label: "tall tripod floor lamp", role_priority: "required", role_quantity: 1, option_rank: 1 }
  ]);
  assert.equal(groups.length, 2, "two lighting roles never merge into one group");
  assert.deepEqual(groups.map((group) => group.roleKey), ["lighting::tall tripod floor lamp", "lighting::linen drum pendant"]);
  assert.deepEqual(groups[0].options.map((option) => option.id), ["a", "c"]);
  console.log("spec-sourcing plan tests passed");
}

// --- blueprint fallback roles carry the same contracts
{
  const { sourcingRolesFromBlueprint } = await import("./spec-sourcing");
  const roles = sourcingRolesFromBlueprint(
    [
      { category: "sofas", label: "living-zone sofa or sectional", visualBrief: "generous seating", quantity: 1, required: true },
      { category: "lighting", label: "floor/table lighting", visualBrief: null, quantity: 1, required: false },
      { category: "chairs", label: "dining chairs", visualBrief: null, quantity: 6, required: true }
    ],
    "Living & Dining"
  );
  assert.deepEqual(
    roles.map((role) => [role.category, role.priority, role.quantity, role.contract.fixtureClass ?? null]),
    [
      ["sofas", "required", 1, null],
      ["lighting", "supporting", 1, "floor_or_table"],
      ["chairs", "required", 6, null]
    ]
  );
  assert.equal(roles[0].specKey, "blueprint:0:sofas");
  assert.equal(roles[0].sizeClass, "large", "a blueprint label naming a sectional keeps the scorer's large class");
  assert.deepEqual(checkCandidateAgainstSpecRole(chandelier, roles[1]), { ok: false, reason: "lighting_fixture_class_mismatch" });
  console.log("spec-sourcing blueprint tests passed");
}
