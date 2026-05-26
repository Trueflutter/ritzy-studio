import assert from "node:assert/strict";

import type { RankedProductMatch, RoomProductRoleSpec } from "@ritzy-studio/domain";

import { buildProductSourcingTextFallbackResult } from "./product-sourcing-text-fallback";

const rankedProduct = ({
  id,
  name,
  categoryNormalized,
  score
}: {
  id: string;
  name: string;
  categoryNormalized: string;
  score: number;
}): RankedProductMatch => ({
  id,
  name,
  retailerName: "Fallback Retailer",
  canonicalUrl: `https://retailer.example/${id}`,
  categoryNormalized,
  priceAed: 1000,
  salePriceAed: null,
  availability: "In stock",
  primaryImageUrl: `https://retailer.example/${id}.jpg`,
  color: "ivory",
  material: "linen",
  styleTags: ["modern"],
  colorTags: ["ivory"],
  materialTags: ["linen"],
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
    })
  ],
  model: "gpt-5-mini"
});

assert.equal(fallback.promptKey, "product_sourcing_text_fallback");
assert.equal(fallback.promptVersion, "2026-05-26.1");
assert.equal(fallback.model, "gpt-5-mini");
assert.deepEqual(
  fallback.needs.map((need) => `${need.category}:${need.roleLabel}:${need.priority}`),
  ["sofas:main sofa:required", "coffee_tables:coffee table:required", "side_tables:side table:supporting"]
);
assert.deepEqual(
  fallback.selectedProducts.map((selection) => `${selection.category}:${selection.productId}:${selection.matchStatus}`),
  [
    "sofas:22222222-2222-4222-8222-222222222222:closest_available",
    "coffee_tables:33333333-3333-4333-8333-333333333333:closest_available"
  ]
);
assert.deepEqual(
  fallback.roleResults.map((result) => `${result.category}:${result.status}:${result.productId ?? "missing"}`),
  [
    "sofas:closest_available:22222222-2222-4222-8222-222222222222",
    "coffee_tables:closest_available:33333333-3333-4333-8333-333333333333",
    "side_tables:missing_supporting:missing"
  ]
);
assert.deepEqual(fallback.missingRoles, ["side_tables side table"]);
assert.match(fallback.selectedProducts[0]?.visualMatchReason ?? "", /deterministic text fallback/);
assert.match(fallback.selectedProducts[0]?.mismatchNote ?? "", /without provider visual reasoning/);
