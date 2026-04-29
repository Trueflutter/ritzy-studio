import assert from "node:assert/strict";

import { productMetadataEnrichmentJsonSchema, productMetadataEnrichmentPrompt } from ".";

assert.equal(productMetadataEnrichmentPrompt.key, "catalog.product_metadata_enrichment");
assert.ok(productMetadataEnrichmentPrompt.system.includes("Never invent or alter factual product data"));
assert.equal(productMetadataEnrichmentJsonSchema.additionalProperties, false);
assert.deepEqual(productMetadataEnrichmentJsonSchema.properties.derivedBy.enum, ["model-enriched"]);
assert.equal("price" in productMetadataEnrichmentJsonSchema.properties, false);
assert.equal("availability" in productMetadataEnrichmentJsonSchema.properties, false);
assert.equal("dimensions" in productMetadataEnrichmentJsonSchema.properties, false);

console.log("product enrichment prompt tests passed");
