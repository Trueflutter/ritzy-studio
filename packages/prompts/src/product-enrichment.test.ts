import assert from "node:assert/strict";

import {
  conceptProductNeedSchema,
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

assert.equal(specProductSourcingPrompt.version, "2026-09-02.2");
// The bar the app pre-selects at is stated to the model, and the score is
// required on every role result, so an unscored pick can never clear it.
assert.ok(specProductSourcingPrompt.system.includes("similarity 0.6 or above"));
assert.ok(specProductSourcingPrompt.system.includes("Never inflate a score"));
// The pass may echo any confirmed spec role: per-item caps are the spec's own.
{
  const longLabel = "x".repeat(120);
  assert.equal(conceptProductNeedSchema.safeParse({ category: "sofas", roleLabel: longLabel, visualBrief: "a long low sofa", quantity: 24, priority: "required" }).success, true);
  assert.equal(conceptProductNeedSchema.safeParse({ category: "sofas", roleLabel: `${longLabel}y`, visualBrief: "a long low sofa", quantity: 24, priority: "required" }).success, false);
  assert.equal(conceptProductNeedSchema.safeParse({ category: "sofas", roleLabel: "sofa", visualBrief: "a long low sofa", quantity: 25, priority: "required" }).success, false);
  const needItems = (conceptProductSourcingJsonSchema as { properties: { needs: { items: { properties: { roleLabel: { maxLength: number }; quantity: { maximum: number } } } } } }).properties.needs.items.properties;
  assert.equal(needItems.roleLabel.maxLength, 120);
  assert.equal(needItems.quantity.maximum, 24);
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
assert.deepEqual(conceptProductSourcingJsonSchema.required, [
  "needs",
  "selectedProducts",
  "roleResults",
  "missingRoles"
]);
assert.equal(
  conceptProductSourcingResponseSchema.parse({
    needs: [
      {
        category: "sofas",
        roleLabel: "anchor seating",
        visualBrief: "cream linen sofa",
        quantity: 1,
        priority: "required"
      }
    ],
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
    missingRoles: []
  }).roleResults[0].status,
  "strong_match"
);

console.log("product enrichment prompt tests passed");
