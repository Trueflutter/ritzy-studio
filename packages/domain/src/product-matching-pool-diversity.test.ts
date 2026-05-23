import assert from "node:assert/strict";

import { summarizeRolePoolDiversity } from "./product-matching-pool-diversity";
import type { ProductRoleAttributeScore, RoleScopedCandidatePool, RoleScopedRankedProductMatch } from "./product-matching";

const baseScore: ProductRoleAttributeScore = {
  category: 25,
  color: 28,
  material: 18,
  style: 6,
  silhouette: 0,
  roleFit: 12,
  total: 89,
  reasons: [],
  weaknessReasons: [],
  requestedColorFamilies: ["cream"],
  candidateColorFamilies: ["cream"],
  requestedMaterialFamilies: ["linen"],
  candidateMaterialFamilies: ["linen"]
};

const emptySummary = summarizeRolePoolDiversity([pool({ candidates: [], candidateCount: 0 })]);
assert.equal(emptySummary[0].poolDiversityStatus, "empty");
assert.equal(emptySummary[0].uniqueRetailerCount, 0);
assert.ok(emptySummary[0].reasons.includes("role pool has no candidates to compare"));

const narrowSummary = summarizeRolePoolDiversity([
  pool({
    candidates: [
      candidate({ id: "50000000-0000-4000-8000-000000000001", name: "Cream Linen Sofa One" }),
      candidate({ id: "50000000-0000-4000-8000-000000000002", name: "Cream Linen Sofa Two" }),
      candidate({ id: "50000000-0000-4000-8000-000000000003", name: "Cream Linen Sofa Three" })
    ],
    candidateCount: 3
  })
]);
assert.equal(narrowSummary[0].poolDiversityStatus, "narrow");
assert.equal(narrowSummary[0].uniqueColorSignalCount, 1);
assert.equal(narrowSummary[0].uniqueMaterialSignalCount, 1);
assert.ok(narrowSummary[0].repeatedNameTokens.includes("cream"));
assert.ok(narrowSummary[0].reasons.includes("role pool has very similar color and material signals"));

const balancedSummary = summarizeRolePoolDiversity([
  pool({
    candidates: [
      candidate({ id: "50000000-0000-4000-8000-000000000004", name: "Cream Linen Sofa" }),
      candidate({
        id: "50000000-0000-4000-8000-000000000005",
        name: "Ivory Boucle Sofa",
        color: "ivory",
        colorTags: ["ivory"],
        material: "boucle",
        materialTags: ["boucle"],
        attributeScore: {
          ...baseScore,
          candidateColorFamilies: ["cream"],
          candidateMaterialFamilies: ["boucle"]
        }
      }),
      candidate({
        id: "50000000-0000-4000-8000-000000000006",
        name: "Taupe Linen Sofa",
        color: "taupe",
        colorTags: ["taupe"],
        attributeScore: {
          ...baseScore,
          candidateColorFamilies: ["cream"],
          candidateMaterialFamilies: ["linen"]
        }
      })
    ],
    candidateCount: 3
  })
]);
assert.equal(balancedSummary[0].poolDiversityStatus, "balanced");
assert.equal(balancedSummary[0].uniqueColorSignalCount, 3);
assert.equal(balancedSummary[0].uniqueMaterialSignalCount, 2);

const scatteredSummary = summarizeRolePoolDiversity([
  pool({
    candidates: [
      candidate({ id: "50000000-0000-4000-8000-000000000007", name: "Cream Linen Sofa" }),
      candidate({
        id: "50000000-0000-4000-8000-000000000008",
        name: "Olive Velvet Sofa",
        color: "olive",
        colorTags: ["olive"],
        material: "velvet",
        materialTags: ["velvet"],
        attributeScore: {
          ...baseScore,
          candidateColorFamilies: ["green"],
          candidateMaterialFamilies: ["velvet"]
        }
      }),
      candidate({
        id: "50000000-0000-4000-8000-000000000009",
        name: "Black Leather Sofa",
        color: "black",
        colorTags: ["black"],
        material: "leather",
        materialTags: ["leather"],
        attributeScore: {
          ...baseScore,
          candidateColorFamilies: ["black"],
          candidateMaterialFamilies: ["leather"]
        }
      }),
      candidate({
        id: "50000000-0000-4000-8000-000000000010",
        name: "Blue Cotton Sofa",
        color: "blue",
        colorTags: ["blue"],
        material: "cotton",
        materialTags: ["cotton"],
        attributeScore: {
          ...baseScore,
          candidateColorFamilies: ["blue"],
          candidateMaterialFamilies: ["cotton"]
        }
      })
    ],
    candidateCount: 4
  })
]);
assert.equal(scatteredSummary[0].poolDiversityStatus, "scattered");
assert.ok(scatteredSummary[0].reasons.includes("role pool has broad color or material signal spread"));

const mutationCandidates = [
  candidate({ id: "50000000-0000-4000-8000-000000000011", name: "Cream Linen Sofa" }),
  candidate({ id: "50000000-0000-4000-8000-000000000012", name: "Cream Linen Sofa Petite" })
];
const before = JSON.stringify(mutationCandidates);
summarizeRolePoolDiversity([pool({ candidates: mutationCandidates, candidateCount: mutationCandidates.length })]);
assert.equal(JSON.stringify(mutationCandidates), before);
assert.deepEqual(
  mutationCandidates.map((candidate) => candidate.id),
  ["50000000-0000-4000-8000-000000000011", "50000000-0000-4000-8000-000000000012"]
);

console.log("product matching pool diversity tests passed");

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
    attributeScore: baseScore,
    ...rest
  };
}
