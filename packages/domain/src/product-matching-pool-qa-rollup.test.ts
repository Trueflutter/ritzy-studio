import assert from "node:assert/strict";

import { summarizePoolQaRollup } from "./product-matching-pool-qa-rollup";
import type { ProductMatchRolePoolDiversity } from "./product-matching-pool-diversity";
import type { ProductMatchRolePoolQuality } from "./product-matching-pool-quality";

const qualitySummaries: ProductMatchRolePoolQuality[] = [
  quality({
    roleKey: "sofas::anchor_seating",
    priority: "required",
    poolQualityStatus: "empty",
    candidateCount: 0
  }),
  quality({
    roleKey: "storage::tv_media_console",
    roleLabel: "TV media console",
    priority: "required",
    poolQualityStatus: "weak",
    candidateCount: 4
  }),
  quality({
    roleKey: "decor::vase",
    category: "decor",
    roleLabel: "vase",
    priority: "supporting",
    poolQualityStatus: "weak",
    candidateCount: 3
  }),
  quality({
    roleKey: "lighting::floor_lamp",
    category: "lighting",
    roleLabel: "floor lamp",
    priority: "supporting",
    poolQualityStatus: "thin",
    candidateCount: 2
  })
];
const diversitySummaries: ProductMatchRolePoolDiversity[] = [
  diversity({
    roleKey: "sofas::anchor_seating",
    priority: "required",
    poolDiversityStatus: "scattered"
  }),
  diversity({
    roleKey: "storage::tv_media_console",
    roleLabel: "TV media console",
    priority: "required",
    poolDiversityStatus: "balanced"
  }),
  diversity({
    roleKey: "decor::vase",
    category: "decor",
    roleLabel: "vase",
    priority: "supporting",
    poolDiversityStatus: "scattered"
  }),
  diversity({
    roleKey: "lighting::floor_lamp",
    category: "lighting",
    roleLabel: "floor lamp",
    priority: "supporting",
    poolDiversityStatus: "narrow"
  })
];
const beforeQuality = JSON.stringify(qualitySummaries);
const beforeDiversity = JSON.stringify(diversitySummaries);

assert.deepEqual(
  summarizePoolQaRollup({
    rolePoolQuality: qualitySummaries,
    rolePoolDiversity: diversitySummaries
  }),
  {
    totalRoleCount: 4,
    requiredRoleCount: 2,
    emptyPoolCount: 1,
    thinPoolCount: 1,
    weakPoolCount: 2,
    narrowPoolCount: 1,
    scatteredPoolCount: 2,
    requiredEmptyPoolCount: 1,
    requiredWeakPoolCount: 1,
    requiredScatteredPoolCount: 1,
    manualReviewSuggested: true
  }
);
assert.equal(JSON.stringify(qualitySummaries), beforeQuality);
assert.equal(JSON.stringify(diversitySummaries), beforeDiversity);

const supportingOnlyRollup = summarizePoolQaRollup({
  rolePoolQuality: [
    quality({
      roleKey: "decor::vase",
      category: "decor",
      roleLabel: "vase",
      priority: "supporting",
      poolQualityStatus: "weak"
    })
  ],
  rolePoolDiversity: [
    diversity({
      roleKey: "decor::vase",
      category: "decor",
      roleLabel: "vase",
      priority: "supporting",
      poolDiversityStatus: "scattered"
    })
  ]
});
assert.equal(supportingOnlyRollup.requiredRoleCount, 0);
assert.equal(supportingOnlyRollup.weakPoolCount, 1);
assert.equal(supportingOnlyRollup.scatteredPoolCount, 1);
assert.equal(supportingOnlyRollup.requiredWeakPoolCount, 0);
assert.equal(supportingOnlyRollup.requiredScatteredPoolCount, 0);
assert.equal(supportingOnlyRollup.manualReviewSuggested, false);

console.log("product matching pool QA rollup tests passed");

function quality(overrides: Partial<ProductMatchRolePoolQuality> = {}): ProductMatchRolePoolQuality {
  return {
    category: "sofas",
    roleLabel: "anchor seating",
    roleKey: "sofas::anchor_seating",
    priority: "required",
    poolQualityStatus: "healthy",
    candidateCount: 3,
    rejectedCount: 0,
    rejectionReasons: {},
    weaknessReasons: [],
    topCandidateId: "60000000-0000-4000-8000-000000000001",
    topScore: 100,
    topAttributeTotal: 80,
    reasons: [],
    ...overrides
  };
}

function diversity(overrides: Partial<ProductMatchRolePoolDiversity> = {}): ProductMatchRolePoolDiversity {
  return {
    category: "sofas",
    roleLabel: "anchor seating",
    roleKey: "sofas::anchor_seating",
    priority: "required",
    poolDiversityStatus: "balanced",
    candidateCount: 3,
    uniqueRetailerCount: 2,
    uniqueColorSignalCount: 2,
    uniqueMaterialSignalCount: 2,
    duplicateNameTokenCount: 0,
    repeatedNameTokens: [],
    reasons: [],
    ...overrides
  };
}
