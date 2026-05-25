import assert from "node:assert/strict";

import {
  buildProductMatchQaStopRuleStatus,
  buildProductMatchQaWarningReport,
  buildProductMatchConfidenceSummary,
  normalizeProductMatchRoleResultCategory,
  productMatchConfidenceOutputSummary,
  productMatchQaStopRuleOutputSummary,
  productMatchRequiredRoleDescriptor,
  productMatchRoleKey,
  type ProductMatchRoleConfidence
} from "./product-matching-confidence";
import { buildRoleScopedCandidatePools, type ProductMatchCandidate, type RoomProductRoleSpec } from "./product-matching";

const base: ProductMatchCandidate = {
  id: "20000000-0000-4000-8000-000000000000",
  name: "Catalog Product",
  retailerName: "Retailer",
  canonicalUrl: "https://example.com/product",
  categoryNormalized: null,
  priceAed: 1000,
  salePriceAed: null,
  availability: "in stock",
  primaryImageUrl: "https://example.com/product.jpg",
  color: null,
  material: null,
  styleTags: [],
  colorTags: [],
  materialTags: [],
  roomTags: [],
  lastCheckedAt: "2026-05-22T00:00:00.000Z",
  dimensions: null
};
const nowMs = Date.parse("2026-05-22T12:00:00.000Z");

const sofaRole: RoomProductRoleSpec = {
  category: "sofas",
  label: "anchor seating",
  visualBrief: "beige linen sofa",
  quantity: 1,
  priority: "required"
};

const chairRole: RoomProductRoleSpec = {
  category: "chairs",
  label: "dining chairs",
  visualBrief: "slim upholstered dining chairs",
  quantity: 6,
  priority: "required"
};

assert.equal(productMatchRoleKey("TV Media Console", "Low Console"), "tv_media_console::low_console");
assert.equal(
  normalizeProductMatchRoleResultCategory("side_tables", "bedside tables"),
  "side_tables"
);
assert.equal(
  normalizeProductMatchRoleResultCategory("bedside table", "bedside table"),
  "side_tables"
);
assert.equal(normalizeProductMatchRoleResultCategory("nightstand", "nightstand"), "side_tables");
assert.equal(normalizeProductMatchRoleResultCategory("bed", "bed"), "beds");
assert.equal(normalizeProductMatchRoleResultCategory("headboard", "headboard"), "headboards");
assert.equal(normalizeProductMatchRoleResultCategory("dining chairs", "dining chairs"), "chairs");
assert.equal(normalizeProductMatchRoleResultCategory("lighting", "bedside lighting"), "lighting");
assert.equal(normalizeProductMatchRoleResultCategory("rugs", "bedroom rug"), "rugs");

const strongPools = buildRoleScopedCandidatePools({
  roomType: "living room",
  conceptText: "beige linen sofa",
  roles: [sofaRole],
  candidates: [
    {
      ...base,
      id: "20000000-0000-4000-8000-000000000001",
      name: "Cream Linen Sofa",
      categoryNormalized: "sofas",
      primaryImageUrl: "https://example.com/cream-sofa.jpg",
      styleTags: ["modern"],
      colorTags: ["cream", "beige"],
      materialTags: ["linen"],
      roomTags: ["living_room"],
      dimensions: {
        widthCm: 220,
        depthCm: 95,
        heightCm: 80,
        sourceText: "220 x 95 x 80 cm"
      }
    }
  ]
});
const strongSummary = buildProductMatchConfidenceSummary({
  pools: strongPools.pools,
  roleResults: [
    {
      category: "sofas",
      roleLabel: "anchor seating",
      status: "strong_match",
      productId: "20000000-0000-4000-8000-000000000001",
      reason: "The product matches the beige linen sofa role."
    }
  ],
  nowMs,
  roomMeasurements: {
    wallLengthCm: 320,
    roomDepthCm: 420
  }
});
assert.equal(strongSummary[0].confidenceTier, "strong");
assert.equal(strongSummary[0].selectedProductId, "20000000-0000-4000-8000-000000000001");
assert.equal(strongSummary[0].candidateCount, 1);
assert.equal(strongSummary[0].hasColorMismatch, false);
assert.equal(strongSummary[0].hasWeakMaterialMatch, false);
assert.equal(strongSummary[0].selectedProductDimensionFit?.status, "fits_room");
assert.equal(strongSummary[0].selectedProductEvidenceCompleteness?.status, "complete");
assert.equal(strongSummary[0].selectedProductFreshness?.catalogFreshnessStatus, "fresh");

const closestPools = buildRoleScopedCandidatePools({
  roomType: "living room",
  conceptText: "beige linen sofa",
  roles: [sofaRole],
  candidates: [
    {
      ...base,
      id: "20000000-0000-4000-8000-000000000002",
      name: "Olive Velvet Sofa",
      categoryNormalized: "sofas",
      primaryImageUrl: "https://example.com/olive-sofa.jpg",
      colorTags: ["olive", "green"],
      materialTags: ["velvet"]
    }
  ]
});
const closestSummary = buildProductMatchConfidenceSummary({
  pools: closestPools.pools,
  roleResults: [
    {
      category: "sofas",
      roleLabel: "anchor seating",
      status: "closest_available",
      productId: "20000000-0000-4000-8000-000000000002",
      reason: "Only a weak sofa substitute was available."
    }
  ],
  nowMs
});
assert.equal(closestSummary[0].confidenceTier, "weak");
assert.equal(closestSummary[0].hasColorMismatch, true);
assert.equal(closestSummary[0].hasWeakMaterialMatch, true);
assert.ok(closestSummary[0].weaknessReasons.includes("color family conflicts with role brief"));
assert.ok(closestSummary[0].weaknessReasons.includes("material family is weak for role brief"));

const missingPools = buildRoleScopedCandidatePools({
  roomType: "dining room",
  conceptText: "dining chairs",
  roles: [chairRole],
  candidates: [
    {
      ...base,
      id: "20000000-0000-4000-8000-000000000003",
      name: "Bulky Lounge Armchair",
      categoryNormalized: "armchairs",
      primaryImageUrl: "https://example.com/armchair.jpg"
    }
  ]
});
const missingSummary = buildProductMatchConfidenceSummary({
  pools: missingPools.pools,
  roleResults: [
    {
      category: "chairs",
      roleLabel: "dining chairs",
      status: "missing_required",
      productId: null,
      reason: "No dining chair candidate was suitable."
    }
  ]
});
assert.equal(missingSummary[0].confidenceTier, "missing");
assert.equal(missingSummary[0].selectedProductId, null);
assert.equal(missingSummary[0].rejectionReasons.category_mismatch, 1);

const invalidSelectionSummary = buildProductMatchConfidenceSummary({
  pools: strongPools.pools,
  roleResults: [
    {
      category: "sofas",
      roleLabel: "anchor seating",
      status: "acceptable_match",
      productId: "20000000-0000-4000-8000-000000009999",
      reason: "Wrong role pool product."
    }
  ],
  nowMs
});
assert.equal(invalidSelectionSummary[0].confidenceTier, "invalid_selection");
assert.equal(invalidSelectionSummary[0].selectedProductId, null);
assert.equal(invalidSelectionSummary[0].selectedProductDimensionFit, null);
assert.equal(invalidSelectionSummary[0].selectedProductEvidenceCompleteness, null);
assert.equal(invalidSelectionSummary[0].selectedProductFreshness, null);
assert.ok(
  invalidSelectionSummary[0].weaknessReasons.includes(
    "selected product 20000000-0000-4000-8000-000000009999 is outside this role pool"
  )
);

const notEvaluatedSummary = buildProductMatchConfidenceSummary({ pools: strongPools.pools });
assert.equal(notEvaluatedSummary[0].status, "not_evaluated");
assert.equal(notEvaluatedSummary[0].confidenceTier, "missing");

const outputSummary = productMatchConfidenceOutputSummary({
  pools: strongPools.pools,
  roleResults: [
    {
      category: "sofas",
      roleLabel: "anchor seating",
      status: "acceptable_match",
      productId: "20000000-0000-4000-8000-000000000001",
      reason: "Good fit."
    }
  ],
  nowMs,
  roomMeasurements: {
    wallLengthCm: 320,
    roomDepthCm: 420
  }
});
assert.deepEqual(Object.keys(outputSummary[0]).sort(), [
  "candidateCount",
  "category",
  "confidenceTier",
  "hasColorMismatch",
  "hasWeakMaterialMatch",
  "reasons",
  "rejectedCount",
  "rejectionReasons",
  "roleKey",
  "roleLabel",
  "selectedProductDimensionFit",
  "selectedProductEvidenceCompleteness",
  "selectedProductId",
  "selectedProductFreshness",
  "status",
  "weaknessReasons"
].sort());
assert.equal(outputSummary[0].roleKey, "sofas::anchor_seating");
assert.equal(outputSummary[0].selectedProductDimensionFit?.status, "fits_room");
assert.equal(outputSummary[0].selectedProductEvidenceCompleteness?.status, "complete");
assert.equal(outputSummary[0].selectedProductFreshness?.catalogFreshnessStatus, "fresh");

const requiredSofa = productMatchRequiredRoleDescriptor({
  category: "sofas",
  roleLabel: "anchor seating"
});
const requiredChair = productMatchRequiredRoleDescriptor({
  category: "chairs",
  roleLabel: "dining chairs"
});
assert.deepEqual(requiredSofa, {
  category: "sofas",
  roleLabel: "anchor seating",
  roleKey: "sofas::anchor_seating"
});

const passingGate = buildProductMatchQaStopRuleStatus({
  roleConfidence: strongSummary,
  requiredRoles: [requiredSofa]
});
assert.equal(passingGate.passesQaStopRules, true);
assert.equal(passingGate.blockers.length, 0);
assert.equal(passingGate.counts.blockerCount, 0);

const closestRequiredGate = buildProductMatchQaStopRuleStatus({
  roleConfidence: closestSummary,
  requiredRoles: [requiredSofa]
});
assert.equal(closestRequiredGate.passesQaStopRules, false);
assert.ok(closestRequiredGate.blockers.some((issue) => issue.code === "required_closest_available"));
assert.ok(closestRequiredGate.blockers.some((issue) => issue.code === "required_color_mismatch"));
assert.ok(closestRequiredGate.warnings.some((issue) => issue.code === "weak_material_match"));
assert.equal(closestRequiredGate.counts.weakMaterialRequiredCount, 1);

const missingRequiredGate = buildProductMatchQaStopRuleStatus({
  roleConfidence: missingSummary,
  requiredRoles: [requiredChair]
});
assert.equal(missingRequiredGate.passesQaStopRules, false);
assert.ok(missingRequiredGate.blockers.some((issue) => issue.code === "required_pool_empty"));
assert.ok(missingRequiredGate.blockers.some((issue) => issue.code === "required_role_missing"));

const invalidSelectionGate = buildProductMatchQaStopRuleStatus({
  roleConfidence: invalidSelectionSummary,
  requiredRoles: [requiredSofa]
});
assert.equal(invalidSelectionGate.passesQaStopRules, false);
assert.ok(invalidSelectionGate.blockers.some((issue) => issue.code === "invalid_selection"));
assert.equal(invalidSelectionGate.counts.invalidSelectionCount, 1);

const wrongRoleGlobalProductPools = buildRoleScopedCandidatePools({
  roomType: "living room",
  conceptText: "beige sofa with walnut media console",
  roles: [
    sofaRole,
    {
      category: "storage",
      label: "TV media console",
      visualBrief: "walnut media console",
      quantity: 1,
      priority: "required"
    }
  ],
  candidates: [
    {
      ...base,
      id: "20000000-0000-4000-8000-000000000011",
      name: "Cream Linen Sofa",
      categoryNormalized: "sofas",
      primaryImageUrl: "https://example.com/wrong-role-sofa.jpg",
      colorTags: ["cream", "beige"],
      materialTags: ["linen"]
    },
    {
      ...base,
      id: "20000000-0000-4000-8000-000000000012",
      name: "Walnut Media Console",
      categoryNormalized: "storage",
      primaryImageUrl: "https://example.com/walnut-media-console.jpg",
      colorTags: ["brown", "walnut"],
      materialTags: ["wood"],
      styleTags: ["modern"],
      roomTags: ["living_room"],
      dimensions: {
        widthCm: 180,
        depthCm: 45,
        heightCm: 55,
        sourceText: "180 x 45 x 55 cm"
      }
    }
  ]
});
const wrongRoleGlobalProductSummary = buildProductMatchConfidenceSummary({
  pools: wrongRoleGlobalProductPools.pools,
  roleResults: [
    {
      category: "sofas",
      roleLabel: "anchor seating",
      status: "acceptable_match",
      productId: "20000000-0000-4000-8000-000000000012",
      reason: "Model returned the media console ID for the sofa role."
    }
  ],
  nowMs
});
const wrongRoleSofaSummary = wrongRoleGlobalProductSummary.find((summary) => summary.roleKey === requiredSofa.roleKey);
assert.ok(wrongRoleSofaSummary);
assert.equal(wrongRoleSofaSummary.confidenceTier, "invalid_selection");
assert.equal(wrongRoleSofaSummary.selectedProductId, null);
assert.equal(wrongRoleSofaSummary.selectedProductEvidenceCompleteness, null);
const wrongRoleGlobalProductGate = buildProductMatchQaStopRuleStatus({
  roleConfidence: wrongRoleGlobalProductSummary,
  requiredRoles: [requiredSofa]
});
assert.equal(wrongRoleGlobalProductGate.passesQaStopRules, false);
assert.ok(wrongRoleGlobalProductGate.blockers.some((issue) => issue.code === "invalid_selection"));

const missingMetadataGate = buildProductMatchQaStopRuleStatus({
  roleConfidence: [],
  requiredRoles: [requiredSofa]
});
assert.equal(missingMetadataGate.passesQaStopRules, false);
assert.ok(missingMetadataGate.blockers.some((issue) => issue.code === "required_role_not_reported"));

const supportingGate = buildProductMatchQaStopRuleStatus({
  roleConfidence: closestSummary.map((summary) => ({
    ...summary,
    roleKey: productMatchRoleKey("sofas", "supporting sofa"),
    roleLabel: "supporting sofa"
  })),
  requiredRoles: []
});
assert.equal(supportingGate.passesQaStopRules, true);
assert.equal(supportingGate.blockers.length, 0);
assert.ok(supportingGate.warnings.some((issue) => issue.code === "supporting_role_issue"));
assert.ok(supportingGate.warnings.some((issue) => issue.code === "weak_material_match"));
assert.ok(
  supportingGate.warnings.some(
    (issue) =>
      issue.code === "supporting_role_issue" &&
      issue.message === "Supporting role needs manual QA review: selected product is only closest available."
  )
);

const gateOutput = productMatchQaStopRuleOutputSummary({
  roleConfidence: strongSummary,
  requiredRoles: [requiredSofa]
});
assert.deepEqual(Object.keys(gateOutput).sort(), ["blockers", "counts", "passesQaStopRules", "warnings"].sort());
assert.equal(gateOutput.passesQaStopRules, true);

const staleFreshnessSummary = buildProductMatchConfidenceSummary({
  pools: buildRoleScopedCandidatePools({
    roomType: "living room",
    conceptText: "beige linen sofa",
    roles: [sofaRole],
    candidates: [
      {
        ...base,
        id: "20000000-0000-4000-8000-000000000004",
        name: "Stale Cream Sofa",
        categoryNormalized: "sofas",
        primaryImageUrl: "https://example.com/stale-sofa.jpg",
        colorTags: ["cream", "beige"],
        materialTags: ["linen"],
        lastCheckedAt: "2026-05-15T11:59:59.000Z"
      }
    ]
  }).pools,
  roleResults: [
    {
      category: "sofas",
      roleLabel: "anchor seating",
      status: "acceptable_match",
      productId: "20000000-0000-4000-8000-000000000004",
      reason: "Good fit, but catalog timestamp is old."
    }
  ],
  nowMs
});
const staleGate = buildProductMatchQaStopRuleStatus({
  roleConfidence: staleFreshnessSummary,
  requiredRoles: [requiredSofa]
});
assert.equal(staleFreshnessSummary[0].selectedProductFreshness?.catalogFreshnessStatus, "stale");
assert.equal(staleGate.passesQaStopRules, true);
assert.ok(staleGate.warnings.some((issue) => issue.code === "required_freshness_stale"));
assert.ok(
  staleGate.warnings.some(
    (issue) =>
      issue.code === "required_freshness_stale" &&
      issue.message.includes("7 days old, threshold 7 days")
  )
);
assert.equal(staleGate.counts.staleRequiredFreshnessCount, 1);

const missingFreshnessSummary = buildProductMatchConfidenceSummary({
  pools: buildRoleScopedCandidatePools({
    roomType: "living room",
    conceptText: "beige linen sofa",
    roles: [sofaRole],
    candidates: [
      {
        ...base,
        id: "20000000-0000-4000-8000-000000000005",
        name: "Missing Timestamp Sofa",
        categoryNormalized: "sofas",
        primaryImageUrl: "https://example.com/missing-timestamp-sofa.jpg",
        colorTags: ["cream", "beige"],
        materialTags: ["linen"],
        lastCheckedAt: null
      }
    ]
  }).pools,
  roleResults: [
    {
      category: "sofas",
      roleLabel: "anchor seating",
      status: "acceptable_match",
      productId: "20000000-0000-4000-8000-000000000005",
      reason: "Good fit, but catalog timestamp is missing."
    }
  ],
  nowMs
});
const missingFreshnessGate = buildProductMatchQaStopRuleStatus({
  roleConfidence: missingFreshnessSummary,
  requiredRoles: [requiredSofa]
});
assert.equal(missingFreshnessSummary[0].selectedProductFreshness?.catalogFreshnessStatus, "missing");
assert.ok(missingFreshnessGate.warnings.some((issue) => issue.code === "required_freshness_missing"));
assert.ok(
  missingFreshnessGate.warnings.some(
    (issue) =>
      issue.code === "required_freshness_missing" &&
      issue.message === "Required role selected product catalog timestamp is missing."
  )
);

const invalidFreshnessSummary = buildProductMatchConfidenceSummary({
  pools: buildRoleScopedCandidatePools({
    roomType: "living room",
    conceptText: "beige linen sofa",
    roles: [sofaRole],
    candidates: [
      {
        ...base,
        id: "20000000-0000-4000-8000-000000000006",
        name: "Invalid Timestamp Sofa",
        categoryNormalized: "sofas",
        primaryImageUrl: "https://example.com/invalid-timestamp-sofa.jpg",
        colorTags: ["cream", "beige"],
        materialTags: ["linen"],
        lastCheckedAt: "not-a-date"
      }
    ]
  }).pools,
  roleResults: [
    {
      category: "sofas",
      roleLabel: "anchor seating",
      status: "acceptable_match",
      productId: "20000000-0000-4000-8000-000000000006",
      reason: "Good fit, but catalog timestamp is invalid."
    }
  ],
  nowMs
});
const invalidFreshnessGate = buildProductMatchQaStopRuleStatus({
  roleConfidence: invalidFreshnessSummary,
  requiredRoles: [requiredSofa]
});
assert.equal(invalidFreshnessSummary[0].selectedProductFreshness?.catalogFreshnessStatus, "invalid");
assert.ok(invalidFreshnessGate.warnings.some((issue) => issue.code === "required_freshness_invalid"));
assert.ok(
  invalidFreshnessGate.warnings.some(
    (issue) =>
      issue.code === "required_freshness_invalid" &&
      issue.message === "Required role selected product catalog timestamp is invalid: not-a-date."
  )
);

const oversizedDimensionSummary = buildProductMatchConfidenceSummary({
  pools: buildRoleScopedCandidatePools({
    roomType: "living room",
    conceptText: "beige linen sofa",
    roles: [sofaRole],
    roomMeasurements: {
      wallLengthCm: 320,
      roomDepthCm: 420
    },
    candidates: [
      {
        ...base,
        id: "20000000-0000-4000-8000-000000000007",
        name: "Oversized Cream Sofa",
        categoryNormalized: "sofas",
        primaryImageUrl: "https://example.com/oversized-sofa.jpg",
        colorTags: ["cream", "beige"],
        materialTags: ["linen"],
        dimensions: {
          widthCm: 360,
          depthCm: 95,
          heightCm: 80,
          sourceText: "360 x 95 x 80 cm"
        }
      }
    ]
  }).pools,
  roleResults: [
    {
      category: "sofas",
      roleLabel: "anchor seating",
      status: "acceptable_match",
      productId: "20000000-0000-4000-8000-000000000007",
      reason: "Good visual match, but dimensions need review."
    }
  ],
  roomMeasurements: {
    wallLengthCm: 320,
    roomDepthCm: 420
  },
  nowMs
});
const oversizedDimensionGate = buildProductMatchQaStopRuleStatus({
  roleConfidence: oversizedDimensionSummary,
  requiredRoles: [requiredSofa]
});
assert.equal(oversizedDimensionSummary[0].selectedProductDimensionFit?.status, "oversized_width");
assert.equal(oversizedDimensionGate.passesQaStopRules, true);
assert.ok(oversizedDimensionGate.warnings.some((issue) => issue.code === "required_dimension_oversized"));
assert.ok(
  oversizedDimensionGate.warnings.some(
    (issue) =>
      issue.code === "required_dimension_oversized" &&
      issue.message.endsWith("Product width exceeds entered room wall length.")
  )
);
assert.equal(oversizedDimensionGate.counts.oversizedRequiredDimensionCount, 1);

const missingDimensionSummary = buildProductMatchConfidenceSummary({
  pools: buildRoleScopedCandidatePools({
    roomType: "living room",
    conceptText: "beige linen sofa",
    roles: [sofaRole],
    candidates: [
      {
        ...base,
        id: "20000000-0000-4000-8000-000000000008",
        name: "Dimensionless Cream Sofa",
        categoryNormalized: "sofas",
        primaryImageUrl: "https://example.com/dimensionless-sofa.jpg",
        colorTags: ["cream", "beige"],
        materialTags: ["linen"]
      }
    ]
  }).pools,
  roleResults: [
    {
      category: "sofas",
      roleLabel: "anchor seating",
      status: "acceptable_match",
      productId: "20000000-0000-4000-8000-000000000008",
      reason: "Good visual match, but dimensions are missing."
    }
  ],
  roomMeasurements: {
    wallLengthCm: 320,
    roomDepthCm: 420
  },
  nowMs
});
const missingDimensionGate = buildProductMatchQaStopRuleStatus({
  roleConfidence: missingDimensionSummary,
  requiredRoles: [requiredSofa]
});
assert.equal(missingDimensionSummary[0].selectedProductDimensionFit?.status, "missing_product_dimensions");
assert.equal(missingDimensionGate.passesQaStopRules, true);
assert.ok(missingDimensionGate.warnings.some((issue) => issue.code === "required_dimension_missing"));
assert.ok(
  missingDimensionGate.warnings.some(
    (issue) =>
      issue.code === "required_dimension_missing" &&
      issue.message.endsWith("Product dimensions are missing; fit requires designer review.")
  )
);
assert.equal(missingDimensionGate.counts.missingRequiredDimensionCount, 1);

const partialEvidenceSummary = buildProductMatchConfidenceSummary({
  pools: buildRoleScopedCandidatePools({
    roomType: "living room",
    conceptText: "beige linen sofa",
    roles: [sofaRole],
    candidates: [
      {
        ...base,
        id: "20000000-0000-4000-8000-000000000009",
        name: "Partial Evidence Cream Sofa",
        categoryNormalized: "sofas",
        primaryImageUrl: "https://example.com/partial-evidence-sofa.jpg",
        colorTags: ["cream", "beige"],
        dimensions: {
          widthCm: 220,
          depthCm: 95,
          heightCm: 80,
          sourceText: "220 x 95 x 80 cm"
        }
      }
    ]
  }).pools,
  roleResults: [
    {
      category: "sofas",
      roleLabel: "anchor seating",
      status: "acceptable_match",
      productId: "20000000-0000-4000-8000-000000000009",
      reason: "Usable match with partial catalog evidence."
    }
  ],
  nowMs
});
const partialEvidenceGate = buildProductMatchQaStopRuleStatus({
  roleConfidence: partialEvidenceSummary,
  requiredRoles: [requiredSofa]
});
assert.equal(partialEvidenceSummary[0].selectedProductEvidenceCompleteness?.status, "partial");
assert.equal(partialEvidenceGate.passesQaStopRules, true);
assert.ok(partialEvidenceGate.warnings.some((issue) => issue.code === "required_evidence_partial"));
assert.ok(
  partialEvidenceGate.warnings.some(
    (issue) =>
      issue.code === "required_evidence_partial" &&
      issue.message.includes("Material evidence is missing.")
  )
);
assert.equal(partialEvidenceGate.counts.partialRequiredEvidenceCount, 1);

const weakEvidenceSummary = buildProductMatchConfidenceSummary({
  pools: buildRoleScopedCandidatePools({
    roomType: "living room",
    conceptText: "beige linen sofa",
    roles: [sofaRole],
    candidates: [
      {
        ...base,
        id: "20000000-0000-4000-8000-000000000010",
        name: "Weak Evidence Cream Sofa",
        categoryNormalized: "sofas",
        priceAed: null,
        availability: null,
        primaryImageUrl: "https://example.com/weak-evidence-sofa.jpg",
        colorTags: ["cream", "beige"]
      }
    ]
  }).pools,
  roleResults: [
    {
      category: "sofas",
      roleLabel: "anchor seating",
      status: "acceptable_match",
      productId: "20000000-0000-4000-8000-000000000010",
      reason: "Usable match with weak catalog evidence."
    }
  ],
  nowMs
});
const weakEvidenceGate = buildProductMatchQaStopRuleStatus({
  roleConfidence: weakEvidenceSummary,
  requiredRoles: [requiredSofa]
});
assert.equal(weakEvidenceSummary[0].selectedProductEvidenceCompleteness?.status, "weak");
assert.equal(weakEvidenceGate.passesQaStopRules, true);
assert.ok(weakEvidenceGate.warnings.some((issue) => issue.code === "required_evidence_weak"));
assert.ok(
  weakEvidenceGate.warnings.some(
    (issue) =>
      issue.code === "required_evidence_weak" &&
      issue.message.includes("Price is missing.") &&
      issue.message.includes("Availability text is missing.") &&
      issue.message.includes("Dimension evidence is missing.")
  )
);
assert.equal(weakEvidenceGate.counts.weakRequiredEvidenceCount, 1);

const pr142ShapedWarningFixture: ProductMatchRoleConfidence[] = [
  {
    category: "sofas",
    roleLabel: "anchor seating",
    roleKey: productMatchRoleKey("sofas", "anchor seating"),
    status: "strong_match",
    selectedProductId: "living-sofa",
    candidateCount: 6,
    rejectedCount: 0,
    rejectionReasons: {},
    confidenceTier: "strong",
    reasons: ["visual status: beige modular sofa matches the anchor role"],
    weaknessReasons: [],
    hasColorMismatch: false,
    hasWeakMaterialMatch: false,
    selectedProductDimensionFit: {
      status: "missing_product_dimensions",
      productWidthCm: null,
      productDepthCm: null,
      roomWallLengthCm: 420,
      roomDepthCm: 520,
      sourceText: null,
      warnings: ["Product dimensions are missing; fit requires designer review."]
    },
    selectedProductEvidenceCompleteness: {
      status: "partial",
      presentCount: 6,
      missingCount: 2,
      checks: {
        hasCanonicalUrl: true,
        hasPrimaryImage: true,
        hasPrice: true,
        hasAvailability: true,
        hasColorSignal: true,
        hasMaterialSignal: false,
        hasStyleOrRoomSignal: true,
        hasDimensions: false
      },
      warnings: ["Material evidence is missing.", "Dimension evidence is missing."]
    },
    selectedProductFreshness: {
      catalogFreshnessStatus: "fresh",
      checkedAt: "2026-05-25T00:00:00.000Z",
      ageDays: 0.5,
      thresholdDays: 7
    }
  },
  {
    category: "rugs",
    roleLabel: "generous rug",
    roleKey: productMatchRoleKey("rugs", "generous rug"),
    status: "strong_match",
    selectedProductId: "living-rug",
    candidateCount: 5,
    rejectedCount: 0,
    rejectionReasons: {},
    confidenceTier: "strong",
    reasons: ["visual status: large greige rug fits the plan"],
    weaknessReasons: [],
    hasColorMismatch: false,
    hasWeakMaterialMatch: false,
    selectedProductDimensionFit: {
      status: "missing_product_dimensions",
      productWidthCm: null,
      productDepthCm: null,
      roomWallLengthCm: 420,
      roomDepthCm: 520,
      sourceText: "300X400 cm",
      warnings: ["Product dimensions are missing; fit requires designer review."]
    },
    selectedProductEvidenceCompleteness: {
      status: "weak",
      presentCount: 5,
      missingCount: 3,
      checks: {
        hasCanonicalUrl: true,
        hasPrimaryImage: true,
        hasPrice: true,
        hasAvailability: true,
        hasColorSignal: false,
        hasMaterialSignal: false,
        hasStyleOrRoomSignal: false,
        hasDimensions: true
      },
      warnings: [
        "Color evidence is missing.",
        "Material evidence is missing.",
        "Style or room evidence is missing."
      ]
    },
    selectedProductFreshness: {
      catalogFreshnessStatus: "fresh",
      checkedAt: "2026-05-25T00:00:00.000Z",
      ageDays: 0.5,
      thresholdDays: 7
    }
  },
  {
    category: "chairs",
    roleLabel: "dining chairs",
    roleKey: productMatchRoleKey("chairs", "dining chairs"),
    status: "acceptable_match",
    selectedProductId: "dining-chair",
    candidateCount: 4,
    rejectedCount: 0,
    rejectionReasons: {},
    confidenceTier: "acceptable",
    reasons: ["visual status: cream upholstered arm chair fits broadly"],
    weaknessReasons: [],
    hasColorMismatch: false,
    hasWeakMaterialMatch: false,
    selectedProductDimensionFit: {
      status: "missing_room_measurements",
      productWidthCm: 55,
      productDepthCm: 60,
      roomWallLengthCm: null,
      roomDepthCm: null,
      sourceText: "55 x 60 x 80 cm",
      warnings: ["Room measurements are missing; product fit cannot be checked."]
    },
    selectedProductEvidenceCompleteness: {
      status: "weak",
      presentCount: 5,
      missingCount: 3,
      checks: {
        hasCanonicalUrl: true,
        hasPrimaryImage: true,
        hasPrice: true,
        hasAvailability: true,
        hasColorSignal: false,
        hasMaterialSignal: false,
        hasStyleOrRoomSignal: false,
        hasDimensions: true
      },
      warnings: [
        "Color evidence is missing.",
        "Material evidence is missing.",
        "Style or room evidence is missing."
      ]
    },
    selectedProductFreshness: {
      catalogFreshnessStatus: "fresh",
      checkedAt: "2026-05-25T00:00:00.000Z",
      ageDays: 0.5,
      thresholdDays: 7
    }
  },
  {
    category: "decor",
    roleLabel: "restrained table decor",
    roleKey: productMatchRoleKey("decor", "restrained table decor"),
    status: "missing_supporting",
    selectedProductId: null,
    candidateCount: 3,
    rejectedCount: 0,
    rejectionReasons: {},
    confidenceTier: "missing",
    reasons: ["visual status: no supporting product selected"],
    weaknessReasons: [],
    hasColorMismatch: false,
    hasWeakMaterialMatch: false,
    selectedProductDimensionFit: null,
    selectedProductEvidenceCompleteness: null,
    selectedProductFreshness: null
  }
];
const pr142WarningReport = buildProductMatchQaWarningReport({
  roleConfidence: pr142ShapedWarningFixture,
  requiredRoles: [
    productMatchRequiredRoleDescriptor({ category: "sofas", roleLabel: "anchor seating" }),
    productMatchRequiredRoleDescriptor({ category: "rugs", roleLabel: "generous rug" }),
    productMatchRequiredRoleDescriptor({ category: "chairs", roleLabel: "dining chairs" })
  ]
});
assert.equal(pr142WarningReport.passesQaStopRules, true);
assert.equal(pr142WarningReport.severityCounts.blocker, 0);
assert.equal(pr142WarningReport.severityCounts.warning, 7);
assert.equal(pr142WarningReport.issueCodeCounts.required_dimension_missing, 3);
assert.equal(pr142WarningReport.issueCodeCounts.required_evidence_partial, 1);
assert.equal(pr142WarningReport.issueCodeCounts.required_evidence_weak, 2);
assert.equal(pr142WarningReport.issueCodeCounts.supporting_role_issue, 1);
assert.equal(pr142WarningReport.dimensionGroupCounts.missing_structured_dimensions, 1);
assert.equal(pr142WarningReport.dimensionGroupCounts.title_derived_dimensions_present, 1);
assert.equal(pr142WarningReport.dimensionGroupCounts.missing_room_measurements, 1);
assert.equal(pr142WarningReport.dimensionGroupCounts.not_applicable, 1);
assert.equal(pr142WarningReport.missingEvidenceFieldCounts.color, 2);
assert.equal(pr142WarningReport.missingEvidenceFieldCounts.material, 3);
assert.equal(pr142WarningReport.missingEvidenceFieldCounts.style_room, 2);
assert.equal(pr142WarningReport.missingEvidenceFieldCounts.dimension, 1);
assert.equal(pr142WarningReport.freshnessStatusCounts.fresh, 3);
assert.equal(pr142WarningReport.freshnessStatusCounts.not_checked, 1);
assert.equal(pr142WarningReport.productIssueCounts["living-sofa"], 2);
assert.equal(pr142WarningReport.productIssueCounts["living-rug"], 2);
assert.equal(pr142WarningReport.productIssueCounts["dining-chair"], 2);
assert.equal(pr142WarningReport.productIssueCounts.none, 1);
assert.deepEqual(
  pr142WarningReport.roles.find((role) => role.roleLabel === "generous rug")?.missingEvidenceFields,
  ["color", "material", "style_room"]
);
assert.equal(
  pr142WarningReport.issues.find((issue) => issue.roleLabel === "restrained table decor")?.rolePriority,
  "supporting"
);

console.log("product matching confidence tests passed");
