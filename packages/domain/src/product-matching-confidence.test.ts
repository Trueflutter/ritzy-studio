import assert from "node:assert/strict";

import {
  buildProductMatchQaStopRuleStatus,
  buildProductMatchConfidenceSummary,
  productMatchConfidenceOutputSummary,
  productMatchQaStopRuleOutputSummary,
  productMatchRequiredRoleDescriptor,
  productMatchRoleKey
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
      colorTags: ["cream", "beige"],
      materialTags: ["linen"]
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
  ]
});
assert.equal(strongSummary[0].confidenceTier, "strong");
assert.equal(strongSummary[0].selectedProductId, "20000000-0000-4000-8000-000000000001");
assert.equal(strongSummary[0].candidateCount, 1);
assert.equal(strongSummary[0].hasColorMismatch, false);
assert.equal(strongSummary[0].hasWeakMaterialMatch, false);

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
  ]
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
  ]
});
assert.equal(invalidSelectionSummary[0].confidenceTier, "invalid_selection");
assert.equal(invalidSelectionSummary[0].selectedProductId, null);
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
  ]
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
  "selectedProductId",
  "status",
  "weaknessReasons"
].sort());
assert.equal(outputSummary[0].roleKey, "sofas::anchor_seating");

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

const gateOutput = productMatchQaStopRuleOutputSummary({
  roleConfidence: strongSummary,
  requiredRoles: [requiredSofa]
});
assert.deepEqual(Object.keys(gateOutput).sort(), ["blockers", "counts", "passesQaStopRules", "warnings"].sort());
assert.equal(gateOutput.passesQaStopRules, true);

console.log("product matching confidence tests passed");
