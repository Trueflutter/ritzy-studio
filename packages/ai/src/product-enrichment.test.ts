import assert from "node:assert/strict";

import { buildProductSearchText, productEnrichmentResponseSchema } from "@ritzy-studio/domain";

import { createProductEnrichmentSourceHash, formatPgVector, validateProductSourcingRoleContract } from ".";

const input = {
  name: "Narissa 3-Seater Fabric Sofa",
  retailerName: "Home Centre",
  description: "Ivory fabric sofa",
  categoryRaw: "Furniture > Sofas",
  categoryNormalized: "sofas",
  color: "Ivory",
  material: null,
  priceAed: 3299,
  availability: "in stock"
};

const sameInputDifferentOrder = {
  availability: "in stock",
  priceAed: 3299,
  material: null,
  color: "Ivory",
  categoryNormalized: "sofas",
  categoryRaw: "Furniture > Sofas",
  description: "Ivory fabric sofa",
  retailerName: "Home Centre",
  name: "Narissa 3-Seater Fabric Sofa"
};

assert.equal(createProductEnrichmentSourceHash(input), createProductEnrichmentSourceHash(sameInputDifferentOrder));
assert.equal(
  createProductEnrichmentSourceHash(input),
  createProductEnrichmentSourceHash({ ...input, priceAed: 2999 })
);
assert.notEqual(
  createProductEnrichmentSourceHash(input),
  createProductEnrichmentSourceHash({ ...input, description: "Blue velvet sofa" })
);
assert.equal(formatPgVector([0.1, -2, 3.25]), "[0.1,-2,3.25]");

const validatedSourcing = validateProductSourcingRoleContract(
  {
    needs: [
      {
        category: "sofas",
        roleLabel: "anchor seating",
        visualBrief: "cream linen sofa",
        quantity: 1,
        priority: "required"
      },
      {
        category: "chairs",
        roleLabel: "dining chairs",
        visualBrief: "slim dining chair",
        quantity: 6,
        priority: "required"
      }
    ],
    selectedProducts: [
      {
        productId: "00000000-0000-4000-8000-000000000010",
        category: "chairs",
        roleLabel: "dining chairs",
        quantity: 6,
        matchStatus: "acceptable_match",
        visualMatchReason: "The sofa was incorrectly returned for the chair role.",
        mismatchNote: null
      }
    ],
    roleResults: [
      {
        category: "chairs",
        roleLabel: "dining chairs",
        status: "acceptable_match",
        productId: "00000000-0000-4000-8000-000000000010",
        reason: "Incorrectly selected a globally valid sofa for dining chairs."
      }
    ],
    missingRoles: []
  },
  [
    {
      category: "sofas",
      roleLabel: "anchor seating",
      visualBrief: "cream linen sofa",
      quantity: 1,
      priority: "required",
      candidateIds: ["00000000-0000-4000-8000-000000000010"]
    },
    {
      category: "chairs",
      roleLabel: "dining chairs",
      visualBrief: "slim dining chair",
      quantity: 6,
      priority: "required",
      candidateIds: ["00000000-0000-4000-8000-000000000020"]
    }
  ],
  new Set(["00000000-0000-4000-8000-000000000010", "00000000-0000-4000-8000-000000000020"])
);
const diningChairRoleResult = validatedSourcing.roleResults.find(
  (result) => result.category === "chairs" && result.roleLabel === "dining chairs"
);
assert.ok(diningChairRoleResult);
assert.equal(diningChairRoleResult.status, "missing_required");
assert.equal(diningChairRoleResult.productId, null);
assert.ok(validatedSourcing.missingRoles.includes("chairs dining chairs"));
assert.equal(validatedSourcing.selectedProducts.length, 0);

const enrichment = productEnrichmentResponseSchema.parse({
  normalizedCategory: "sofas",
  styleTags: ["contemporary"],
  colorTags: ["ivory"],
  materialTags: [],
  roomTags: ["living_room"],
  sourceConfidence: "estimated",
  warnings: [],
  derivedBy: "model-enriched"
});

const searchText = buildProductSearchText(input, enrichment);
assert.ok(searchText.includes("model color tags: ivory"));
assert.equal(searchText.includes("stock"), false);

console.log("product enrichment ai tests passed");
