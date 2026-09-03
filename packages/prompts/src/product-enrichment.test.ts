import assert from "node:assert/strict";

import {
  conceptProductSelectionSchema,
  conceptProductSourcingJsonSchema,
  specProductSourcingPrompt,
  conceptProductSourcingResponseSchema,
  productMetadataEnrichmentJsonSchema,
  productMetadataEnrichmentPrompt
} from ".";

assert.equal(productMetadataEnrichmentPrompt.key, "catalog.product_metadata_enrichment");
assert.ok(productMetadataEnrichmentPrompt.system.includes("Never invent or alter factual product data"));
assert.equal(productMetadataEnrichmentJsonSchema.additionalProperties, false);
assert.deepEqual(productMetadataEnrichmentJsonSchema.properties.derivedBy.enum, ["model-enriched"]);
assert.equal("price" in productMetadataEnrichmentJsonSchema.properties, false);
assert.equal("availability" in productMetadataEnrichmentJsonSchema.properties, false);
assert.equal("dimensions" in productMetadataEnrichmentJsonSchema.properties, false);

assert.equal(specProductSourcingPrompt.version, "2026-09-02.3");
// The bar the app pre-selects at is stated to the model, and the score is
// required on every role result, so an unscored pick can never clear it.
assert.ok(specProductSourcingPrompt.system.includes("similarity 0.6 or above"));
assert.ok(specProductSourcingPrompt.system.includes("Never inflate a score"));
// The pass may echo any confirmed spec role: per-item caps are the spec's own,
// single-sourced from DESIGN_SPEC_LIMITS on the role result the app reads.
{
  const longLabel = "x".repeat(120);
  const roleItems = (
    conceptProductSourcingJsonSchema as unknown as {
      properties: { roleResults: { items: { properties: { roleLabel: { maxLength: number } } } } };
    }
  ).properties.roleResults.items.properties;
  assert.equal(roleItems.roleLabel.maxLength, 120);
  assert.equal(
    conceptProductSelectionSchema.safeParse({
      productId: "00000000-0000-4000-8000-000000000001",
      category: "sofas",
      roleLabel: longLabel,
      quantity: 24,
      matchStatus: "strong_match",
      visualMatchReason: "cream linen sofa",
      mismatchNote: null
    }).success,
    true
  );
  assert.equal(
    conceptProductSelectionSchema.safeParse({
      productId: "00000000-0000-4000-8000-000000000001",
      category: "sofas",
      roleLabel: `${longLabel}y`,
      quantity: 24,
      matchStatus: "strong_match",
      visualMatchReason: "cream linen sofa",
      mismatchNote: null
    }).success,
    false
  );
}
assert.ok(specProductSourcingPrompt.system.includes("one result per role"));
assert.ok(specProductSourcingPrompt.system.includes("Return exactly one roleResults entry per supplied role"));
assert.ok(specProductSourcingPrompt.system.includes("an honest gap is better than a wrong piece"));
{
  const roleItems = (conceptProductSourcingJsonSchema as unknown as { properties: { roleResults: { items: { required: readonly string[] } } } }).properties
    .roleResults.items;
  assert.ok(roleItems.required.includes("similarity"), "the response schema requires a score for every role");
}
assert.equal("roleResults" in conceptProductSourcingJsonSchema.properties, true);
// The response carries the answer and nothing else: a `needs` list restating
// the app's own input, and a `missingRoles` list restating statuses already in
// roleResults, cost output tokens on every paid run and were read by nothing.
assert.deepEqual(conceptProductSourcingJsonSchema.required, ["selectedProducts", "roleResults"]);
assert.equal("needs" in conceptProductSourcingJsonSchema.properties, false);
assert.equal("missingRoles" in conceptProductSourcingJsonSchema.properties, false);
assert.equal(
  conceptProductSourcingResponseSchema.parse({
    selectedProducts: [
      {
        productId: "00000000-0000-4000-8000-000000000001",
        category: "sofas",
        roleLabel: "anchor seating",
        quantity: 1,
        matchStatus: "strong_match",
        visualMatchReason: "Cream linen sofa matches the concept anchor seating.",
        mismatchNote: null
      }
    ],
    roleResults: [
      {
        category: "sofas",
        roleLabel: "anchor seating",
        status: "strong_match",
        productId: "00000000-0000-4000-8000-000000000001",
        similarity: 0.82,
        reason: "Selected cream linen sofa from the sofa role pool."
      }
    ],
  }).roleResults[0].status,
  "strong_match"
);

console.log("product enrichment prompt tests passed");
