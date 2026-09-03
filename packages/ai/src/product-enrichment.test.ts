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
        similarity: 0.8,
        reason: "Incorrectly selected a globally valid sofa for dining chairs."
      }
    ],
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
assert.equal(validatedSourcing.selectedProducts.length, 0);

const repairedBedroomSourcing = validateProductSourcingRoleContract(
  {
    selectedProducts: [
      {
        productId: "10000000-0000-4000-8000-000000000020",
        category: "beds",
        roleLabel: "bedside tables",
        quantity: 2,
        matchStatus: "strong_match",
        visualMatchReason: "Walnut side table selected for the bedside table role.",
        mismatchNote: null
      }
    ],
    roleResults: [
      {
        category: "beds",
        roleLabel: "bedside tables",
        status: "strong_match",
        productId: "10000000-0000-4000-8000-000000000020",
        similarity: 0.8,
        reason: "Correct product, malformed category."
      }
    ],
  },
  [
    {
      category: "beds",
      roleLabel: "bed or bed frame",
      visualBrief: "ivory upholstered bed",
      quantity: 1,
      priority: "required",
      candidateIds: ["10000000-0000-4000-8000-000000000010"]
    },
    {
      category: "side_tables",
      roleLabel: "bedside tables",
      visualBrief: "pair of walnut bedside tables",
      quantity: 2,
      priority: "required",
      candidateIds: ["10000000-0000-4000-8000-000000000020"]
    }
  ],
  new Set(["10000000-0000-4000-8000-000000000010", "10000000-0000-4000-8000-000000000020"])
);
const repairedBedsideRoleResult = repairedBedroomSourcing.roleResults.find(
  (result) => result.category === "side_tables" && result.roleLabel === "bedside tables"
);
assert.ok(repairedBedsideRoleResult);
assert.equal(repairedBedsideRoleResult.status, "strong_match");
assert.equal(repairedBedsideRoleResult.productId, "10000000-0000-4000-8000-000000000020");
assert.equal(repairedBedroomSourcing.selectedProducts[0]?.category, "side_tables");
assert.equal(repairedBedroomSourcing.selectedProducts[0]?.roleLabel, "bedside tables");
assert.equal(repairedBedroomSourcing.selectedProducts[0]?.quantity, 2);

const repairedMissingBedsideRoleResult = validateProductSourcingRoleContract(
  {
    selectedProducts: [
      {
        productId: "10000000-0000-4000-8000-000000000020",
        category: "side_tables",
        roleLabel: "bedside tables",
        quantity: 2,
        matchStatus: "strong_match",
        visualMatchReason: "Walnut side table selected for the bedside table role.",
        mismatchNote: null
      }
    ],
    roleResults: [
      {
        category: "beds",
        roleLabel: "bedside tables",
        status: "missing_required",
        productId: null,
        similarity: 0.8,
        reason: "The model marked the required bedside table role missing."
      }
    ],
  },
  [
    {
      category: "beds",
      roleLabel: "bed or bed frame",
      visualBrief: "ivory upholstered bed",
      quantity: 1,
      priority: "required",
      candidateIds: ["10000000-0000-4000-8000-000000000010"]
    },
    {
      category: "side_tables",
      roleLabel: "bedside tables",
      visualBrief: "pair of walnut bedside tables",
      quantity: 2,
      priority: "required",
      candidateIds: ["10000000-0000-4000-8000-000000000020"]
    }
  ],
  new Set(["10000000-0000-4000-8000-000000000010", "10000000-0000-4000-8000-000000000020"])
);
const repairedMissingBedsideResult = repairedMissingBedsideRoleResult.roleResults.find(
  (result) => result.category === "side_tables" && result.roleLabel === "bedside tables"
);
assert.ok(repairedMissingBedsideResult);
assert.equal(repairedMissingBedsideResult.status, "strong_match");
assert.equal(repairedMissingBedsideResult.productId, "10000000-0000-4000-8000-000000000020");

const trueMissingBedsideRole = validateProductSourcingRoleContract(
  {
    selectedProducts: [],
    roleResults: [
      {
        category: "side_tables",
        roleLabel: "bedside tables",
        status: "missing_required",
        productId: null,
        similarity: 0.8,
        reason: "No bedside table was suitable."
      }
    ],
  },
  [
    {
      category: "side_tables",
      roleLabel: "bedside tables",
      visualBrief: "pair of walnut bedside tables",
      quantity: 2,
      priority: "required",
      candidateIds: ["10000000-0000-4000-8000-000000000020"]
    }
  ],
  new Set(["10000000-0000-4000-8000-000000000020"])
);
const trueMissingBedsideResult = trueMissingBedsideRole.roleResults.find(
  (result) => result.category === "side_tables" && result.roleLabel === "bedside tables"
);
assert.ok(trueMissingBedsideResult);
assert.equal(trueMissingBedsideResult.status, "missing_required");
assert.equal(trueMissingBedsideResult.productId, null);

const ambiguousRoleProduct = validateProductSourcingRoleContract(
  {
    selectedProducts: [
      {
        productId: "20000000-0000-4000-8000-000000000030",
        category: "furniture",
        roleLabel: "storage piece",
        quantity: 1,
        matchStatus: "acceptable_match",
        visualMatchReason: "Ambiguous shared product.",
        mismatchNote: null
      }
    ],
    roleResults: [
      {
        category: "furniture",
        roleLabel: "storage piece",
        status: "acceptable_match",
        productId: "20000000-0000-4000-8000-000000000030",
        similarity: 0.8,
        reason: "Product appears in multiple role pools."
      }
    ],
  },
  [
    {
      category: "storage",
      roleLabel: "media console",
      visualBrief: "low media console",
      quantity: 1,
      priority: "supporting",
      candidateIds: ["20000000-0000-4000-8000-000000000030"]
    },
    {
      category: "side_tables",
      roleLabel: "side table",
      visualBrief: "compact side table",
      quantity: 1,
      priority: "supporting",
      candidateIds: ["20000000-0000-4000-8000-000000000030"]
    }
  ],
  new Set(["20000000-0000-4000-8000-000000000030"])
);
assert.equal(ambiguousRoleProduct.selectedProducts.length, 0);
assert.ok(
  ambiguousRoleProduct.roleResults.some(
    (result) => result.category === "storage" && result.roleLabel === "media console" && result.productId === null
  )
);
assert.ok(
  ambiguousRoleProduct.roleResults.some(
    (result) => result.category === "side_tables" && result.roleLabel === "side table" && result.productId === null
  )
);

const exactRoleAmbiguousProduct = validateProductSourcingRoleContract(
  {
    selectedProducts: [
      {
        productId: "20000000-0000-4000-8000-000000000030",
        category: "storage",
        roleLabel: "media console",
        quantity: 1,
        matchStatus: "acceptable_match",
        visualMatchReason: "Exact role label but product is shared across pools.",
        mismatchNote: null
      }
    ],
    roleResults: [
      {
        category: "storage",
        roleLabel: "media console",
        status: "acceptable_match",
        productId: "20000000-0000-4000-8000-000000000030",
        similarity: 0.8,
        reason: "Exact role label should not rescue an ambiguous product."
      }
    ],
  },
  [
    {
      category: "storage",
      roleLabel: "media console",
      visualBrief: "low media console",
      quantity: 1,
      priority: "supporting",
      candidateIds: ["20000000-0000-4000-8000-000000000030"]
    },
    {
      category: "side_tables",
      roleLabel: "side table",
      visualBrief: "compact side table",
      quantity: 1,
      priority: "supporting",
      candidateIds: ["20000000-0000-4000-8000-000000000030"]
    }
  ],
  new Set(["20000000-0000-4000-8000-000000000030"])
);
assert.equal(exactRoleAmbiguousProduct.selectedProducts.length, 0);
assert.ok(
  exactRoleAmbiguousProduct.roleResults.some(
    (result) => result.category === "storage" && result.roleLabel === "media console" && result.productId === null
  )
);

const homeOfficeContractFixture = validateProductSourcingRoleContract(
  {
    selectedProducts: [
      {
        productId: "30000000-0000-4000-8000-000000000010",
        category: "furniture",
        roleLabel: "work surface",
        quantity: 1,
        matchStatus: "strong_match",
        visualMatchReason: "Desk returned with a malformed role label.",
        mismatchNote: null
      },
      {
        productId: "30000000-0000-4000-8000-000000000020",
        category: "chairs",
        roleLabel: "task seating",
        quantity: 1,
        matchStatus: "acceptable_match",
        visualMatchReason: "Task chair returned with a generic category.",
        mismatchNote: null
      },
      {
        productId: "30000000-0000-4000-8000-000000000030",
        category: "bookcases",
        roleLabel: "office storage",
        quantity: 1,
        matchStatus: "acceptable_match",
        visualMatchReason: "Storage returned with a retailer category.",
        mismatchNote: null
      },
      {
        productId: "30000000-0000-4000-8000-000000000040",
        category: "lamps",
        roleLabel: "desk lamp",
        quantity: 1,
        matchStatus: "strong_match",
        visualMatchReason: "Lamp returned with a retailer category.",
        mismatchNote: null
      }
    ],
    roleResults: [
      {
        category: "furniture",
        roleLabel: "work surface",
        status: "strong_match",
        productId: "30000000-0000-4000-8000-000000000010",
        similarity: 0.8,
        reason: "Desk product is correct."
      },
      {
        category: "chairs",
        roleLabel: "task seating",
        status: "acceptable_match",
        productId: "30000000-0000-4000-8000-000000000020",
        similarity: 0.8,
        reason: "Office chair product is correct."
      },
      {
        category: "bookcases",
        roleLabel: "office storage",
        status: "acceptable_match",
        productId: "30000000-0000-4000-8000-000000000030",
        similarity: 0.8,
        reason: "Storage product is correct."
      },
      {
        category: "lamps",
        roleLabel: "desk lamp",
        status: "strong_match",
        productId: "30000000-0000-4000-8000-000000000040",
        similarity: 0.8,
        reason: "Task lamp product is correct."
      }
    ],
  },
  [
    {
      category: "desks",
      roleLabel: "desk",
      visualBrief: "warm oak desk",
      quantity: 1,
      priority: "required",
      candidateIds: ["30000000-0000-4000-8000-000000000010"]
    },
    {
      category: "office_chairs",
      roleLabel: "ergonomic task chair",
      visualBrief: "tailored task chair",
      quantity: 1,
      priority: "required",
      candidateIds: ["30000000-0000-4000-8000-000000000020"]
    },
    {
      category: "storage",
      roleLabel: "storage, shelving, or credenza",
      visualBrief: "office storage credenza",
      quantity: 1,
      priority: "supporting",
      candidateIds: ["30000000-0000-4000-8000-000000000030"]
    },
    {
      category: "lighting",
      roleLabel: "task lamp or layered lighting",
      visualBrief: "task lamp",
      quantity: 1,
      priority: "supporting",
      candidateIds: ["30000000-0000-4000-8000-000000000040"]
    }
  ],
  new Set([
    "30000000-0000-4000-8000-000000000010",
    "30000000-0000-4000-8000-000000000020",
    "30000000-0000-4000-8000-000000000030",
    "30000000-0000-4000-8000-000000000040"
  ])
);
assert.deepEqual(
  homeOfficeContractFixture.roleResults.map((result) => `${result.category}:${result.roleLabel}:${result.productId}`),
  [
    "desks:desk:30000000-0000-4000-8000-000000000010",
    "office_chairs:ergonomic task chair:30000000-0000-4000-8000-000000000020",
    "storage:storage, shelving, or credenza:30000000-0000-4000-8000-000000000030",
    "lighting:task lamp or layered lighting:30000000-0000-4000-8000-000000000040"
  ]
);
assert.deepEqual(
  homeOfficeContractFixture.selectedProducts.map((selection) => `${selection.category}:${selection.roleLabel}`),
  [
    "desks:desk",
    "office_chairs:ergonomic task chair",
    "storage:storage, shelving, or credenza",
    "lighting:task lamp or layered lighting"
  ]
);

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


// The validator marks entries it INVENTED. The domain layer reads that flag to
// leave a role open with its options rather than telling the shopper the
// catalogue holds nothing for it, so it is a cross-package contract: losing it
// turns every role the model omitted into a false "could not be sourced".
{
  const { validateProductSourcingRoleContract } = await import("./index");
  const pool = {
    category: "sofas",
    roleLabel: "role-1",
    visualBrief: null,
    quantity: 1,
    priority: "required" as const,
    candidateIds: ["30000000-0000-4000-8000-000000000010"]
  };
  const omitted = validateProductSourcingRoleContract(
    { selectedProducts: [], roleResults: [] } as never,
    [pool],
    new Set(["30000000-0000-4000-8000-000000000010"])
  );
  assert.equal(omitted.roleResults.length, 1, "a role the model skipped still gets an entry");
  assert.equal(omitted.roleResults[0].synthesized, true, "flagged as the validator's, not the model's");
  assert.equal(omitted.roleResults[0].similarity, 0, "and unscored, so it can never clear the bar");

  const outsidePool = validateProductSourcingRoleContract(
    {
      selectedProducts: [],
      roleResults: [
        {
          category: "sofas",
          roleLabel: "role-1",
          status: "strong_match",
          productId: "30000000-0000-4000-8000-000000000099",
          similarity: 0.95,
          reason: "a product from another pool"
        }
      ]
    } as never,
    [pool],
    new Set(["30000000-0000-4000-8000-000000000010"])
  );
  assert.equal(outsidePool.roleResults[0].synthesized, true, "a pick outside the pool is replaced by the validator's own entry");

  console.log("validator synthesized-flag tests passed");
}

console.log("product enrichment ai tests passed");
