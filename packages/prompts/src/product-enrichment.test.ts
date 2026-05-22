import assert from "node:assert/strict";

import {
  conceptProductSourcingJsonSchema,
  conceptProductSourcingPrompt,
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

assert.equal(conceptProductSourcingPrompt.version, "2026-05-22.1");
assert.ok(conceptProductSourcingPrompt.system.includes("candidates grouped by role"));
assert.ok(conceptProductSourcingPrompt.system.includes("return exactly one roleResults entry"));
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
        reason: "Selected cream linen sofa from the sofa role pool."
      }
    ],
    missingRoles: []
  }).roleResults[0].status,
  "strong_match"
);

console.log("product enrichment prompt tests passed");
