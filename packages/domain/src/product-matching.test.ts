import assert from "node:assert/strict";

import {
  buildShoppingListItemRows,
  composeRoomProductOptions,
  composeRoomProductSet,
  enhancedProductRolesForRoom,
  filterSubstitutionCandidates,
  groupShoppingItemsByRole,
  quantityForProductCategory,
  rankProductMatches,
  renderReferencePriorityForProduct,
  selectedItemsTotalAed,
  sortProductsForRenderReferences,
  type ProductMatchCandidate,
  type RoomProductRoleSpec
} from "./product-matching";

const now = new Date().toISOString();
const base: ProductMatchCandidate = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Catalog Product",
  retailerName: "Retailer",
  canonicalUrl: "https://example.com/product",
  categoryNormalized: null,
  priceAed: null,
  salePriceAed: null,
  availability: null,
  primaryImageUrl: null,
  color: null,
  material: null,
  styleTags: [],
  colorTags: [],
  materialTags: [],
  roomTags: [],
  lastCheckedAt: now,
  dimensions: null
};

const ranked = rankProductMatches({
  roomType: "living room",
  conceptText: "warm ivory contemporary living room with textured fabric",
  budgetMaxAed: 5000,
  roomMeasurements: {
    wallLengthCm: 300,
    roomDepthCm: 360
  },
  candidates: [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000002",
      name: "Ivory Fabric Sofa",
      categoryNormalized: "sofas",
      priceAed: 4200,
      availability: "in stock",
      primaryImageUrl: "https://example.com/sofa.jpg",
      colorTags: ["ivory"],
      materialTags: ["fabric"],
      styleTags: ["contemporary"],
      dimensions: {
        widthCm: 240,
        depthCm: 100,
        heightCm: 80,
        sourceText: "W 240 x D 100 x H 80 cm"
      }
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000003",
      name: "Dining Table",
      categoryNormalized: "dining_tables",
      priceAed: 6200,
      availability: "out of stock"
    }
  ]
});

assert.equal(ranked[0].name, "Ivory Fabric Sofa");
assert.ok(ranked[0].selectionReason.includes("category fits"));
assert.equal(ranked[0].dimensionFitNote, "estimated fit against entered room measurements; designer review required.");
assert.equal(ranked.length, 1);

const alternatives = filterSubstitutionCandidates({
  current: ranked[0],
  candidates: [
    ranked[0],
    {
      ...ranked[0],
      id: "00000000-0000-4000-8000-000000000004",
      name: "Cheaper Sofa",
      priceAed: 3000
    },
    {
      ...ranked[0],
      id: "00000000-0000-4000-8000-000000000005",
      name: "Already Selected Sofa",
      priceAed: 2800
    },
    {
      ...ranked[0],
      id: "00000000-0000-4000-8000-000000000006",
      name: "Wrong Category",
      categoryNormalized: "rugs",
      priceAed: 1000
    }
  ],
  mode: "cheaper",
  selectedProductIds: ["00000000-0000-4000-8000-000000000005"]
});

assert.deepEqual(
  alternatives.map((candidate) => candidate.name),
  ["Cheaper Sofa"]
);

const kitRanked = rankProductMatches({
  roomType: "living room",
  conceptText: "warm living room with brown arm chairs, coffee table, rug, wall art and lamps",
  budgetMaxAed: 10000,
  candidates: [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000010",
      name: "Best Sofa",
      categoryNormalized: "sofas",
      priceAed: 4000,
      primaryImageUrl: "https://example.com/best-sofa.jpg",
      availability: "in stock"
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000011",
      name: "Second Sofa",
      categoryNormalized: "sofas",
      priceAed: 3900,
      primaryImageUrl: "https://example.com/second-sofa.jpg",
      availability: "in stock"
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000012",
      name: "Brown Armchair",
      categoryNormalized: "armchairs",
      priceAed: 1200,
      primaryImageUrl: "https://example.com/armchair.jpg",
      availability: "in stock",
      colorTags: ["brown"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000013",
      name: "Round Coffee Table",
      categoryNormalized: "coffee_tables",
      priceAed: 900,
      primaryImageUrl: "https://example.com/coffee-table.jpg",
      availability: "in stock"
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000014",
      name: "Textured Rug",
      categoryNormalized: "rugs",
      priceAed: 1600,
      primaryImageUrl: "https://example.com/rug.jpg",
      availability: "in stock"
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000015",
      name: "Wall Art",
      categoryNormalized: "wall_art",
      priceAed: 600,
      primaryImageUrl: "https://example.com/wall-art.jpg",
      availability: "in stock"
    }
  ]
});

const roomKit = composeRoomProductSet({ ranked: kitRanked, roomType: "living room", limit: 6 });
assert.deepEqual(
  roomKit.map((candidate) => candidate.categoryNormalized),
  ["sofas", "armchairs", "coffee_tables", "rugs", "wall_art", "sofas"]
);
assert.equal(quantityForProductCategory("living room", "armchairs"), 2);

// --- PR B: role option pools ----------------------------------------------

const sofaRanked = rankProductMatches({
  roomType: "living room",
  conceptText: "contemporary living room with a soft fabric sofa",
  budgetMaxAed: 10000,
  candidates: [1, 2, 3, 4].map((n) => ({
    ...base,
    id: `00000000-0000-4000-8000-00000000010${n}`,
    name: `Sofa ${n}`,
    categoryNormalized: "sofas",
    priceAed: 4000 + n * 100,
    availability: "in stock",
    primaryImageUrl: `https://example.com/sofa-${n}.jpg`
  }))
});

const sofaRole: RoomProductRoleSpec = {
  category: "sofas",
  label: "anchor seating",
  visualBrief: "a soft contemporary sofa",
  quantity: 1,
  priority: "required"
};

// multiple options per role
const sofaOptions = composeRoomProductOptions({
  ranked: sofaRanked,
  roles: [sofaRole],
  optionsPerRole: 3
});
assert.equal(sofaOptions.length, 1);
assert.equal(sofaOptions[0].category, "sofas");
assert.equal(sofaOptions[0].options.length, 3);

const colorSensitiveSofaOptions = composeRoomProductOptions({
  ranked: rankProductMatches({
    roomType: "living room",
    conceptText: "living room with an anchor sofa",
    budgetMaxAed: 10000,
    candidates: [
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000301",
        name: "Beige Fabric Sofa",
        categoryNormalized: "sofas",
        priceAed: 2600,
        availability: "in stock",
        primaryImageUrl: "https://example.com/beige-sofa.jpg",
        colorTags: ["beige"],
        materialTags: ["fabric"]
      },
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000302",
        name: "Olive Velvet Sofa",
        categoryNormalized: "sofas",
        priceAed: 3200,
        availability: "in stock",
        primaryImageUrl: "https://example.com/olive-sofa.jpg",
        colorTags: ["olive", "green"],
        materialTags: ["velvet"]
      }
    ]
  }),
  roles: [
    {
      category: "sofas",
      label: "anchor seating",
      visualBrief: "olive green velvet sofa with a low residential silhouette",
      quantity: 1,
      priority: "required"
    }
  ],
  optionsPerRole: 2
});
assert.equal(colorSensitiveSofaOptions[0].options[0].name, "Olive Velvet Sofa");

// selected estimate uses selected rows only
assert.equal(
  selectedItemsTotalAed([
    { status: "selected", unit_price_aed: 1000, quantity: 1 },
    { status: "option", unit_price_aed: 9999, quantity: 1 },
    { status: "rejected", unit_price_aed: 9999, quantity: 1 }
  ]),
  1000
);

// quantity > 1 is preserved through to row totals
const accentChairOptions = composeRoomProductOptions({
  ranked: rankProductMatches({
    roomType: "living room",
    conceptText: "living room with two matching accent chairs",
    budgetMaxAed: 10000,
    candidates: [1, 2].map((n) => ({
      ...base,
      id: `00000000-0000-4000-8000-00000000020${n}`,
      name: `Accent Chair ${n}`,
      categoryNormalized: "armchairs",
      priceAed: 1500,
      availability: "in stock",
      primaryImageUrl: `https://example.com/chair-${n}.jpg`
    }))
  }),
  roles: [
    { category: "armchairs", label: "accent chairs", visualBrief: null, quantity: 2, priority: "required" }
  ]
});
const chairTopId = accentChairOptions[0].options[0].id;
const chairRows = buildShoppingListItemRows({
  roleOptions: accentChairOptions,
  selectedProductIdByRole: new Map([["armchairs", chairTopId]])
});
const chairSelected = chairRows.find((row) => row.status === "selected");
assert.ok(chairSelected);
assert.equal(chairSelected.quantity, 2);
assert.equal(chairSelected.role_quantity, 2);
assert.equal(chairSelected.line_total_aed, chairSelected.unit_price_aed * 2);
assert.equal(selectedItemsTotalAed(chairRows), chairSelected.unit_price_aed * 2);

// existing one-row-per-product lists still group and render after migration
const legacyGroups = groupShoppingItemsByRole([
  {
    id: "legacy-1",
    status: "selected",
    category: "sofas",
    role_label: "sofas",
    role_priority: "supporting",
    role_quantity: 1,
    option_rank: 0
  },
  {
    id: "legacy-2",
    status: "selected",
    category: "rugs",
    role_label: "rugs",
    role_priority: "supporting",
    role_quantity: 1,
    option_rank: 3
  }
]);
assert.equal(legacyGroups.length, 2);
assert.equal(legacyGroups[0].options.length, 1);
assert.equal(legacyGroups[0].selectedId, "legacy-1");
assert.equal(legacyGroups[1].selectedId, "legacy-2");

const enhancedLivingRoles = enhancedProductRolesForRoom("living room");
assert.deepEqual(
  enhancedLivingRoles
    .filter((role) => role.importance === "anchor")
    .map((role) => role.category),
  ["sofas", "armchairs", "coffee_tables", "rugs"]
);
assert.ok(enhancedLivingRoles.some((role) => role.category === "curtains" && role.includeWhen === "catalog_supports"));

const enhancedBathroomRoles = enhancedProductRolesForRoom("powder room");
assert.deepEqual(
  enhancedBathroomRoles.map((role) => role.category),
  ["mirrors", "lighting", "towels", "decor", "stools"]
);

const unorderedRenderRefs = [
  { id: "decor", category: "decor", role_label: "decor accent" },
  { id: "lamp", category: "lighting", role_label: "supporting lighting" },
  { id: "sofa", category: "sofas", role_label: "anchor seating" },
  { id: "rug", category: "rugs", role_label: "required rug" },
  { id: "art", category: "wall_art", role_label: "wall art" }
];
const orderedRenderRefs = sortProductsForRenderReferences(unorderedRenderRefs, "living room");
assert.deepEqual(
  orderedRenderRefs.map((item) => item.id),
  ["sofa", "rug", "lamp", "art", "decor"]
);
assert.ok(
  renderReferencePriorityForProduct({ category: "sofas", roleLabel: "anchor seating" }, "living room") <
    renderReferencePriorityForProduct({ category: "decor", roleLabel: "decor accent" }, "living room")
);
assert.deepEqual(
  sortProductsForRenderReferences(
    [
      { id: "first", category: "lighting", role_label: "table lamp" },
      { id: "second", category: "lighting", role_label: "floor lamp" }
    ],
    "living room"
  ).map((item) => item.id),
  ["first", "second"]
);

console.log("product matching tests passed");
