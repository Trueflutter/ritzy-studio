import assert from "node:assert/strict";

import {
  composeRoomProductSet,
  filterSubstitutionCandidates,
  quantityForProductCategory,
  rankProductMatches,
  type ProductMatchCandidate
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

console.log("product matching tests passed");
