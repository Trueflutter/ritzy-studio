import assert from "node:assert/strict";

import { summarizeRolePoolQuality } from "./product-matching-pool-quality";
import type { ProductRoleAttributeScore, RoleScopedCandidatePool, RoleScopedRankedProductMatch } from "./product-matching";

const healthyScore: ProductRoleAttributeScore = {
  category: 25,
  color: 28,
  material: 18,
  style: 6,
  silhouette: 0,
  roleFit: 12,
  total: 89,
  reasons: ["category matches role", "color family matches role brief"],
  weaknessReasons: [],
  requestedColorFamilies: ["cream"],
  candidateColorFamilies: ["cream"],
  requestedMaterialFamilies: ["linen"],
  candidateMaterialFamilies: ["linen"]
};

const healthyCandidate = candidate({
  id: "40000000-0000-4000-8000-000000000001",
  score: 120,
  attributeScore: healthyScore
});

const emptySummary = summarizeRolePoolQuality([
  pool({
    candidates: [],
    candidateCount: 0,
    rejectedCount: 4,
    rejectionReasons: { category_mismatch: 4 }
  })
]);
assert.equal(emptySummary[0].poolQualityStatus, "empty");
assert.equal(emptySummary[0].topCandidateId, null);
assert.equal(emptySummary[0].topScore, null);
assert.equal(emptySummary[0].topAttributeTotal, null);
assert.ok(emptySummary[0].reasons.includes("role pool has no eligible candidates"));

const thinSummary = summarizeRolePoolQuality([
  pool({
    candidates: [healthyCandidate, candidate({ id: "40000000-0000-4000-8000-000000000002" })],
    candidateCount: 2
  })
]);
assert.equal(thinSummary[0].poolQualityStatus, "thin");
assert.equal(thinSummary[0].topCandidateId, "40000000-0000-4000-8000-000000000001");
assert.ok(thinSummary[0].reasons.includes("role pool has fewer than 3 candidates"));

const weakSummary = summarizeRolePoolQuality([
  pool({
    candidates: [
      candidate({
        id: "40000000-0000-4000-8000-000000000003",
        attributeScore: {
          ...healthyScore,
          color: -24,
          material: -12,
          total: 20,
          weaknessReasons: ["color family conflicts with role brief", "material family is weak for role brief"]
        }
      }),
      candidate({ id: "40000000-0000-4000-8000-000000000004" }),
      candidate({ id: "40000000-0000-4000-8000-000000000005" })
    ],
    candidateCount: 3
  })
]);
assert.equal(weakSummary[0].poolQualityStatus, "weak");
assert.equal(weakSummary[0].topAttributeTotal, 20);
assert.ok(weakSummary[0].reasons.includes("top candidate attribute score is weak"));
assert.ok(weakSummary[0].reasons.includes("color family conflicts with role brief"));

const healthySummary = summarizeRolePoolQuality([
  pool({
    candidates: [
      healthyCandidate,
      candidate({ id: "40000000-0000-4000-8000-000000000006" }),
      candidate({ id: "40000000-0000-4000-8000-000000000007" })
    ],
    candidateCount: 3
  })
]);
assert.equal(healthySummary[0].poolQualityStatus, "healthy");
assert.equal(healthySummary[0].roleKey, "sofas::anchor_seating");
assert.equal(healthySummary[0].priority, "required");
assert.deepEqual(healthySummary[0].reasons, []);

console.log("product matching pool quality tests passed");

function pool(overrides: Partial<RoleScopedCandidatePool> = {}): RoleScopedCandidatePool {
  return {
    role: {
      category: "sofas",
      label: "anchor seating",
      visualBrief: "cream linen sofa",
      quantity: 1,
      priority: "required"
    },
    candidates: [],
    candidateCount: 0,
    rejectedCount: 0,
    rejectionReasons: {},
    weaknessReasons: [],
    ...overrides
  };
}

function candidate(
  overrides: Partial<RoleScopedRankedProductMatch> & Pick<RoleScopedRankedProductMatch, "id">
): RoleScopedRankedProductMatch {
  const { id, ...rest } = overrides;

  return {
    id,
    name: "Cream Linen Sofa",
    retailerName: "Retailer",
    canonicalUrl: "https://example.com/product",
    categoryNormalized: "sofas",
    priceAed: 1000,
    salePriceAed: null,
    availability: "in stock",
    primaryImageUrl: "https://example.com/product.jpg",
    color: "cream",
    material: "linen",
    styleTags: [],
    colorTags: ["cream"],
    materialTags: ["linen"],
    roomTags: ["living_room"],
    lastCheckedAt: "2026-05-22T00:00:00.000Z",
    dimensions: null,
    score: 100,
    selectionReason: "Closest available catalog match.",
    dimensionFitNote: null,
    warnings: [],
    attributeScore: healthyScore,
    ...rest
  };
}
