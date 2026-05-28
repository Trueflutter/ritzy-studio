import assert from "node:assert/strict";

import type { RankedProductMatch, RoomProductRoleSpec } from "@ritzy-studio/domain";

import { buildProductSourcingTextFallbackResult } from "./product-sourcing-text-fallback";

const rankedProduct = ({
  id,
  name,
  categoryNormalized,
  score,
  priceAed = 1000,
  color = "ivory",
  material = "linen",
  description = `${name} catalogue item.`
}: {
  id: string;
  name: string;
  categoryNormalized: string;
  score: number;
  priceAed?: number;
  color?: string;
  material?: string;
  description?: string;
}): RankedProductMatch => ({
  id,
  name,
  retailerName: "Fallback Retailer",
  canonicalUrl: `https://retailer.example/${id}`,
  categoryNormalized,
  priceAed,
  salePriceAed: null,
  availability: "In stock",
  primaryImageUrl: `https://retailer.example/${id}.jpg`,
  color,
  material,
  description,
  styleTags: ["modern"],
  colorTags: [color],
  materialTags: [material],
  roomTags: ["living room"],
  lastCheckedAt: "2026-05-26T00:00:00.000Z",
  dimensions: null,
  score,
  selectionReason: `${name} is a strong text-ranked catalog candidate.`,
  dimensionFitNote: null,
  warnings: []
});

const roles: RoomProductRoleSpec[] = [
  {
    category: "sofas",
    label: "main sofa",
    visualBrief: "low-profile ivory sofa",
    quantity: 1,
    priority: "required"
  },
  {
    category: "coffee_tables",
    label: "coffee table",
    visualBrief: "rounded stone coffee table",
    quantity: 1,
    priority: "required"
  },
  {
    category: "side_tables",
    label: "side table",
    visualBrief: "slim accent side table",
    quantity: 1,
    priority: "supporting"
  },
  {
    category: "wall_art",
    label: "wall art",
    visualBrief: "quiet framed landscape art",
    quantity: 1,
    priority: "supporting"
  },
  {
    category: "decor",
    label: "restrained decor",
    visualBrief: "ceramic tray or vessel",
    quantity: 1,
    priority: "supporting"
  },
  {
    category: "lighting",
    label: "floor or table lighting",
    visualBrief: "warm brass lamp with linen shade",
    quantity: 1,
    priority: "supporting"
  },
  {
    category: "mirrors",
    label: "mirror",
    visualBrief: "warm brass or wood mirror for a soft neutral room",
    quantity: 1,
    priority: "supporting"
  },
  {
    category: "storage",
    label: "TV media console",
    visualBrief: "light oak or white TV media console for a soft neutral room",
    quantity: 1,
    priority: "supporting"
  },
  {
    category: "curtains",
    label: "curtains or textile layer",
    visualBrief: "ivory linen sheer curtains",
    quantity: 1,
    priority: "supporting"
  }
];

const fallback = buildProductSourcingTextFallbackResult({
  roomType: "living room",
  conceptTitle: "Soft Gallery Living",
  conceptDescription: "Ivory upholstery, stone accents, and polished brass.",
  roles,
  rankedCandidates: [
    rankedProduct({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Second Sofa",
      categoryNormalized: "sofas",
      score: 90
    }),
    rankedProduct({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Top Sofa",
      categoryNormalized: "sofas",
      score: 98
    }),
    rankedProduct({
      id: "33333333-3333-4333-8333-333333333333",
      name: "Stone Coffee Table",
      categoryNormalized: "coffee_tables",
      score: 92
    }),
    rankedProduct({
      id: "3a3a3a3a-3333-4333-8333-333333333333",
      name: "Black Bedside Nightstand",
      categoryNormalized: "side_tables",
      score: 120,
      color: "black",
      material: "metal"
    }),
    rankedProduct({
      id: "3b3b3b3b-3333-4333-8333-333333333333",
      name: "Oak Accent Side Table",
      categoryNormalized: "side_tables",
      score: 78,
      color: "oak",
      material: "wood"
    }),
    rankedProduct({
      id: "44444444-4444-4444-8444-444444444444",
      name: "Wall Hook Mail Rack",
      categoryNormalized: "wall_art",
      score: 120,
      description: "Wall mounted hook holder with mail rack shelf."
    }),
    rankedProduct({
      id: "55555555-5555-4555-8555-555555555555",
      name: "Framed Landscape Art Print",
      categoryNormalized: "wall_art",
      score: 82,
      description: "Framed art print with a quiet landscape palette."
    }),
    rankedProduct({
      id: "66666666-6666-4666-8666-666666666666",
      name: "Decor Bench",
      categoryNormalized: "decor",
      score: 118,
      description: "Small bench table for entryway styling."
    }),
    rankedProduct({
      id: "6a6a6a6a-6666-4666-8666-666666666666",
      name: "Black Metal Decor Object",
      categoryNormalized: "decor",
      score: 130,
      color: "black",
      material: "metal",
      description: "Black metal decorative object."
    }),
    rankedProduct({
      id: "6b6b6b6b-6666-4666-8666-666666666666",
      name: "Ivory Ceramic Tray",
      categoryNormalized: "decor",
      score: 70,
      color: "ivory",
      material: "ceramic",
      description: "Ivory ceramic tray for restrained styling."
    }),
    rankedProduct({
      id: "77777777-7777-4777-8777-777777777777",
      name: "Spiral LED Chrome Lamp",
      categoryNormalized: "lighting",
      score: 116,
      priceAed: 99,
      description: "Novelty spiral LED chrome lamp."
    }),
    rankedProduct({
      id: "88888888-8888-4888-8888-888888888888",
      name: "Aged Brass Table Lamp With Linen Shade",
      categoryNormalized: "lighting",
      score: 78,
      priceAed: 650,
      material: "brass",
      description: "Warm aged brass table lamp with linen shade."
    }),
    rankedProduct({
      id: "99999999-9999-4999-8999-999999999999",
      name: "Black Metal Floor Mirror",
      categoryNormalized: "mirrors",
      score: 120,
      color: "black",
      material: "metal",
      description: "Black metal floor mirror."
    }),
    rankedProduct({
      id: "aaaaaaaa-9999-4999-8999-999999999999",
      name: "Warm Brass Arched Mirror",
      categoryNormalized: "mirrors",
      score: 76,
      color: "gold",
      material: "brass",
      description: "Warm brass arched mirror."
    }),
    rankedProduct({
      id: "abababab-9999-4999-8999-999999999999",
      name: "Black Metal TV Rack",
      categoryNormalized: "storage",
      score: 124,
      color: "black",
      material: "metal",
      description: "Black metal TV rack shelf."
    }),
    rankedProduct({
      id: "acacacac-9999-4999-8999-999999999999",
      name: "Light Oak TV Media Console",
      categoryNormalized: "storage",
      score: 74,
      color: "oak",
      material: "wood",
      description: "Light oak TV media console with closed storage."
    }),
    rankedProduct({
      id: "bbbbbbbb-9999-4999-8999-999999999999",
      name: "Black Vinyl Shower Curtain",
      categoryNormalized: "curtains",
      score: 112,
      color: "black",
      material: "vinyl",
      description: "Black shower curtain."
    }),
    rankedProduct({
      id: "cccccccc-9999-4999-8999-999999999999",
      name: "Ivory Linen Sheer Curtains",
      categoryNormalized: "curtains",
      score: 68,
      color: "ivory",
      material: "linen",
      description: "Ivory linen sheer curtains."
    })
  ],
  model: "gpt-5-mini"
});

assert.equal(fallback.promptKey, "product_sourcing_text_fallback");
assert.equal(fallback.promptVersion, "2026-05-28.1");
assert.equal(fallback.model, "gpt-5-mini");
assert.deepEqual(
  fallback.needs.map((need) => `${need.category}:${need.roleLabel}:${need.priority}`),
  [
    "sofas:main sofa:required",
    "coffee_tables:coffee table:required",
    "side_tables:side table:supporting",
    "wall_art:wall art:supporting",
    "decor:restrained decor:supporting",
    "lighting:floor or table lighting:supporting",
    "mirrors:mirror:supporting",
    "storage:TV media console:supporting",
    "curtains:curtains or textile layer:supporting"
  ]
);
assert.deepEqual(
  fallback.selectedProducts.map((selection) => `${selection.category}:${selection.productId}:${selection.matchStatus}`),
  [
    "sofas:22222222-2222-4222-8222-222222222222:closest_available",
    "coffee_tables:33333333-3333-4333-8333-333333333333:closest_available",
    "side_tables:3b3b3b3b-3333-4333-8333-333333333333:closest_available",
    "wall_art:55555555-5555-4555-8555-555555555555:closest_available",
    "decor:6b6b6b6b-6666-4666-8666-666666666666:closest_available",
    "lighting:88888888-8888-4888-8888-888888888888:closest_available",
    "mirrors:aaaaaaaa-9999-4999-8999-999999999999:closest_available",
    "storage:acacacac-9999-4999-8999-999999999999:closest_available",
    "curtains:cccccccc-9999-4999-8999-999999999999:closest_available"
  ]
);
assert.deepEqual(
  fallback.roleResults.map((result) => `${result.category}:${result.status}:${result.productId ?? "missing"}`),
  [
    "sofas:closest_available:22222222-2222-4222-8222-222222222222",
    "coffee_tables:closest_available:33333333-3333-4333-8333-333333333333",
    "side_tables:closest_available:3b3b3b3b-3333-4333-8333-333333333333",
    "wall_art:closest_available:55555555-5555-4555-8555-555555555555",
    "decor:closest_available:6b6b6b6b-6666-4666-8666-666666666666",
    "lighting:closest_available:88888888-8888-4888-8888-888888888888",
    "mirrors:closest_available:aaaaaaaa-9999-4999-8999-999999999999",
    "storage:closest_available:acacacac-9999-4999-8999-999999999999",
    "curtains:closest_available:cccccccc-9999-4999-8999-999999999999"
  ]
);
assert.deepEqual(fallback.missingRoles, []);
assert.match(fallback.selectedProducts[0]?.visualMatchReason ?? "", /deterministic text fallback/);
assert.match(fallback.selectedProducts[0]?.mismatchNote ?? "", /without provider visual reasoning/);
