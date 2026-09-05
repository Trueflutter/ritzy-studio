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

// One malformed id must not cost a room every verified pick it earned.
// Observed 2026-09-05: the model returned a non-UUID productId, the whole
// response failed to parse, and product-sourcing's only answer to a parse error
// is to discard the visual pass and fall back to ranking. The room went from
// five chosen pieces to three. Longer candidate lists make this MORE likely, so
// it gets worse as the catalogue grows, not better.
{
  const good = {
    productId: "00000000-0000-4000-8000-000000000001",
    category: "sofas",
    roleLabel: "anchor seating",
    quantity: 1,
    matchStatus: "strong_match",
    visualMatchReason: "Matches the boucle sofa in the render.",
    mismatchNote: null
  };
  const parsed = conceptProductSourcingResponseSchema.parse({
    selectedProducts: [good, { ...good, productId: "not-a-uuid" }, { ...good, productId: "00000000-0000-4000-8000-000000000002" }],
    roleResults: [{ category: "sofas", roleLabel: "anchor seating", status: "strong_match", productId: good.productId, note: null }]
  });
  assert.equal(parsed.selectedProducts.length, 2, "the two valid selections survive the one that did not");
  assert.deepEqual(
    parsed.selectedProducts.map((selection) => selection.productId),
    ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"]
  );

  // The element schema is unchanged: a bad entry is DROPPED, never repaired,
  // and a field that must be present still has to be.
  const missingReason = conceptProductSourcingResponseSchema.parse({
    selectedProducts: [{ ...good, visualMatchReason: "short" }],
    roleResults: [{ category: "sofas", roleLabel: "anchor seating", status: "strong_match", productId: good.productId, note: null }]
  });
  assert.equal(missingReason.selectedProducts.length, 0);
}
