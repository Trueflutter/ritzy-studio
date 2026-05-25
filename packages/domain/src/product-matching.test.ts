import assert from "node:assert/strict";

import {
  buildRoleScopedCandidatePools,
  buildProductSourcingRuntimePlan,
  buildShoppingListItemRows,
  composeRoomProductOptions,
  composeRoomProductSet,
  enhancedProductRolesForRoom,
  filterSubstitutionCandidates,
  groupShoppingItemsByRole,
  quantityForProductCategory,
  rankProductMatches,
  renderReferencePriorityForProduct,
  scoreProductCandidateForRole,
  selectedItemsTotalAed,
  sortProductsForRenderReferences,
  type ProductMatchCandidate,
  type RoomProductRoleSpec
} from "./product-matching";
import {
  productMatchingEvalScenarios,
  runProductMatchingEvalScenario,
  summarizeProductMatchingEvalResults
} from "./product-matching-evals";

const now = new Date().toISOString();
const base: ProductMatchCandidate = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Catalog Product",
  retailerName: "Retailer",
  canonicalUrl: "https://example.com/product",
  categoryNormalized: null,
  priceAed: null,
  salePriceAed: null,
  availability: null,
  primaryImageUrl: null,
  color: null,
  material: null,
  styleTags: [],
  colorTags: [],
  materialTags: [],
  roomTags: [],
  lastCheckedAt: now,
  dimensions: null
};

const ranked = rankProductMatches({
  roomType: "living room",
  conceptText: "warm ivory contemporary living room with textured fabric",
  budgetMaxAed: 5000,
  roomMeasurements: {
    wallLengthCm: 300,
    roomDepthCm: 360
  },
  candidates: [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000002",
      name: "Ivory Fabric Sofa",
      categoryNormalized: "sofas",
      priceAed: 4200,
      availability: "in stock",
      primaryImageUrl: "https://example.com/sofa.jpg",
      colorTags: ["ivory"],
      materialTags: ["fabric"],
      styleTags: ["contemporary"],
      dimensions: {
        widthCm: 240,
        depthCm: 100,
        heightCm: 80,
        sourceText: "W 240 x D 100 x H 80 cm"
      }
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000003",
      name: "Dining Table",
      categoryNormalized: "dining_tables",
      priceAed: 6200,
      availability: "out of stock"
    }
  ]
});

assert.equal(ranked[0].name, "Ivory Fabric Sofa");
assert.ok(ranked[0].selectionReason.includes("category fits"));
assert.equal(ranked[0].dimensionFitNote, "estimated fit against entered room measurements; designer review required.");
assert.equal(ranked.length, 1);

const alternatives = filterSubstitutionCandidates({
  current: ranked[0],
  candidates: [
    ranked[0],
    {
      ...ranked[0],
      id: "00000000-0000-4000-8000-000000000004",
      name: "Cheaper Sofa",
      priceAed: 3000
    },
    {
      ...ranked[0],
      id: "00000000-0000-4000-8000-000000000005",
      name: "Already Selected Sofa",
      priceAed: 2800
    },
    {
      ...ranked[0],
      id: "00000000-0000-4000-8000-000000000006",
      name: "Wrong Category",
      categoryNormalized: "rugs",
      priceAed: 1000
    }
  ],
  mode: "cheaper",
  selectedProductIds: ["00000000-0000-4000-8000-000000000005"]
});

assert.deepEqual(
  alternatives.map((candidate) => candidate.name),
  ["Cheaper Sofa"]
);

const kitRanked = rankProductMatches({
  roomType: "living room",
  conceptText: "warm living room with brown arm chairs, coffee table, rug, wall art and lamps",
  budgetMaxAed: 10000,
  candidates: [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000010",
      name: "Best Sofa",
      categoryNormalized: "sofas",
      priceAed: 4000,
      primaryImageUrl: "https://example.com/best-sofa.jpg",
      availability: "in stock"
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000011",
      name: "Second Sofa",
      categoryNormalized: "sofas",
      priceAed: 3900,
      primaryImageUrl: "https://example.com/second-sofa.jpg",
      availability: "in stock"
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000012",
      name: "Brown Armchair",
      categoryNormalized: "armchairs",
      priceAed: 1200,
      primaryImageUrl: "https://example.com/armchair.jpg",
      availability: "in stock",
      colorTags: ["brown"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000013",
      name: "Round Coffee Table",
      categoryNormalized: "coffee_tables",
      priceAed: 900,
      primaryImageUrl: "https://example.com/coffee-table.jpg",
      availability: "in stock"
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000014",
      name: "Textured Rug",
      categoryNormalized: "rugs",
      priceAed: 1600,
      primaryImageUrl: "https://example.com/rug.jpg",
      availability: "in stock"
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000015",
      name: "Wall Art",
      categoryNormalized: "wall_art",
      priceAed: 600,
      primaryImageUrl: "https://example.com/wall-art.jpg",
      availability: "in stock"
    }
  ]
});

const roomKit = composeRoomProductSet({ ranked: kitRanked, roomType: "living room", limit: 6 });
assert.deepEqual(
  roomKit.map((candidate) => candidate.categoryNormalized),
  ["sofas", "armchairs", "coffee_tables", "rugs", "wall_art", "sofas"]
);
assert.equal(quantityForProductCategory("living room", "armchairs"), 2);

// --- PR B: role option pools ----------------------------------------------

const sofaRanked = rankProductMatches({
  roomType: "living room",
  conceptText: "contemporary living room with a soft fabric sofa",
  budgetMaxAed: 10000,
  candidates: [1, 2, 3, 4].map((n) => ({
    ...base,
    id: `00000000-0000-4000-8000-00000000010${n}`,
    name: `Sofa ${n}`,
    categoryNormalized: "sofas",
    priceAed: 4000 + n * 100,
    availability: "in stock",
    primaryImageUrl: `https://example.com/sofa-${n}.jpg`
  }))
});

const sofaRole: RoomProductRoleSpec = {
  category: "sofas",
  label: "anchor seating",
  visualBrief: "a soft contemporary sofa",
  quantity: 1,
  priority: "required"
};

// multiple options per role
const sofaOptions = composeRoomProductOptions({
  ranked: sofaRanked,
  roles: [sofaRole],
  optionsPerRole: 3
});
assert.equal(sofaOptions.length, 1);
assert.equal(sofaOptions[0].category, "sofas");
assert.equal(sofaOptions[0].options.length, 3);

const colorSensitiveSofaOptions = composeRoomProductOptions({
  ranked: rankProductMatches({
    roomType: "living room",
    conceptText: "living room with an anchor sofa",
    budgetMaxAed: 10000,
    candidates: [
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000301",
        name: "Beige Fabric Sofa",
        categoryNormalized: "sofas",
        priceAed: 2600,
        availability: "in stock",
        primaryImageUrl: "https://example.com/beige-sofa.jpg",
        colorTags: ["beige"],
        materialTags: ["fabric"]
      },
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000302",
        name: "Olive Velvet Sofa",
        categoryNormalized: "sofas",
        priceAed: 3200,
        availability: "in stock",
        primaryImageUrl: "https://example.com/olive-sofa.jpg",
        colorTags: ["olive", "green"],
        materialTags: ["velvet"]
      }
    ]
  }),
  roles: [
    {
      category: "sofas",
      label: "anchor seating",
      visualBrief: "olive green velvet sofa with a low residential silhouette",
      quantity: 1,
      priority: "required"
    }
  ],
  optionsPerRole: 2
});
assert.equal(colorSensitiveSofaOptions[0].options[0].name, "Olive Velvet Sofa");

const diningChairFallbackOptions = composeRoomProductOptions({
  ranked: rankProductMatches({
    roomType: "dining room",
    conceptText: "dining room with a dining table and six upholstered dining chairs",
    budgetMaxAed: 10000,
    candidates: [
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000311",
        name: "Walnut Dining Table",
        categoryNormalized: "dining_tables",
        priceAed: 4500,
        availability: "in stock",
        primaryImageUrl: "https://example.com/dining-table.jpg"
      },
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000312",
        name: "Upholstered Chair",
        categoryNormalized: "armchairs",
        priceAed: 700,
        availability: "in stock",
        primaryImageUrl: "https://example.com/chair.jpg",
        materialTags: ["upholstered", "fabric"]
      }
    ]
  }),
  roles: [
    {
      category: "chairs",
      label: "dining chairs",
      visualBrief: "six upholstered dining chairs",
      quantity: 6,
      priority: "required"
    }
  ],
  optionsPerRole: 2
});
assert.equal(diningChairFallbackOptions[0].category, "chairs");
assert.equal(diningChairFallbackOptions[0].options[0].name, "Upholstered Chair");

// pure retrieval API builds compact pools per room role without changing runtime callers
const livingPools = buildRoleScopedCandidatePools({
  roomType: "living room",
  conceptText: "beige sofa, lounge chairs, generous rug, walnut TV media console, and warm lamp",
  candidates: [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000501",
      name: "Cream Linen Sofa",
      categoryNormalized: "sofas",
      availability: "in stock",
      primaryImageUrl: "https://example.com/cream-linen-sofa.jpg",
      colorTags: ["cream", "beige"],
      materialTags: ["linen", "fabric"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000502",
      name: "Boucle Lounge Armchair",
      categoryNormalized: "armchairs",
      availability: "in stock",
      primaryImageUrl: "https://example.com/lounge-armchair.jpg",
      materialTags: ["boucle"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000503",
      name: "Wool Area Rug",
      categoryNormalized: "rugs",
      availability: "in stock",
      primaryImageUrl: "https://example.com/wool-rug.jpg"
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000504",
      name: "Walnut TV Media Console",
      categoryNormalized: "storage",
      availability: "in stock",
      primaryImageUrl: "https://example.com/media-console.jpg",
      materialTags: ["wood", "walnut"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000505",
      name: "Brass Floor Lamp",
      categoryNormalized: "lighting",
      availability: "in stock",
      primaryImageUrl: "https://example.com/floor-lamp.jpg",
      materialTags: ["brass"]
    }
  ],
  candidatesPerRole: 4
});
assert.ok(livingPools.pools.find((pool) => pool.role.category === "sofas")?.candidateCount);
assert.ok(livingPools.pools.find((pool) => pool.role.category === "armchairs")?.candidateCount);
assert.ok(livingPools.pools.find((pool) => pool.role.category === "rugs")?.candidateCount);
assert.ok(livingPools.pools.find((pool) => pool.role.label.includes("TV media"))?.candidateCount);
assert.ok(livingPools.pools.find((pool) => pool.role.category === "lighting")?.candidateCount);

const diningPools = buildRoleScopedCandidatePools({
  roomType: "dining room",
  conceptText: "walnut dining table with cream upholstered dining chairs, sideboard, and pendant lighting",
  candidates: [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000511",
      name: "Walnut Dining Table",
      categoryNormalized: "dining_tables",
      availability: "in stock",
      primaryImageUrl: "https://example.com/walnut-dining-table.jpg",
      materialTags: ["walnut", "wood"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000512",
      name: "Cream Upholstered Dining Chair",
      categoryNormalized: "chairs",
      availability: "in stock",
      primaryImageUrl: "https://example.com/dining-chair.jpg",
      colorTags: ["cream"],
      materialTags: ["upholstered", "fabric"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000513",
      name: "Walnut Sideboard Credenza",
      categoryNormalized: "storage",
      availability: "in stock",
      primaryImageUrl: "https://example.com/sideboard.jpg",
      materialTags: ["walnut", "wood"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000514",
      name: "Slim Pendant Lighting",
      categoryNormalized: "lighting",
      availability: "in stock",
      primaryImageUrl: "https://example.com/pendant.jpg"
    }
  ]
});
assert.ok(diningPools.pools.find((pool) => pool.role.category === "dining_tables")?.candidateCount);
assert.ok(diningPools.pools.find((pool) => pool.role.category === "chairs")?.candidateCount);
assert.ok(diningPools.pools.find((pool) => pool.role.label.includes("sideboard"))?.candidateCount);
assert.ok(diningPools.pools.find((pool) => pool.role.category === "lighting")?.candidateCount);

const bedroomPools = buildRoleScopedCandidatePools({
  roomType: "bedroom",
  conceptText: "ivory upholstered bed, walnut bedside tables, soft bedroom rug, and bedside lighting",
  candidates: [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000521",
      name: "Ivory Upholstered Bed",
      categoryNormalized: "beds",
      availability: "in stock",
      primaryImageUrl: "https://example.com/ivory-bed.jpg",
      colorTags: ["ivory"],
      materialTags: ["upholstered", "fabric"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000522",
      name: "Walnut Bedside Table",
      categoryNormalized: "side_tables",
      availability: "in stock",
      primaryImageUrl: "https://example.com/bedside-table.jpg",
      materialTags: ["walnut", "wood"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000523",
      name: "Neutral Bedroom Rug",
      categoryNormalized: "rugs",
      availability: "in stock",
      primaryImageUrl: "https://example.com/bedroom-rug.jpg"
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000524",
      name: "Bedside Table Lamp",
      categoryNormalized: "lighting",
      availability: "in stock",
      primaryImageUrl: "https://example.com/table-lamp.jpg"
    }
  ]
});
assert.ok(bedroomPools.pools.find((pool) => pool.role.category === "beds")?.candidateCount);
assert.ok(bedroomPools.pools.find((pool) => pool.role.category === "side_tables")?.candidateCount);
assert.ok(bedroomPools.pools.find((pool) => pool.role.category === "lighting")?.candidateCount);
assert.ok(bedroomPools.pools.find((pool) => pool.role.category === "rugs")?.candidateCount);

const officePools = buildRoleScopedCandidatePools({
  roomType: "home office",
  conceptText: "wood desk, ergonomic office chair, bookcase storage, and task lamp",
  candidates: [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000531",
      name: "Oak Writing Desk",
      categoryNormalized: "desks",
      availability: "in stock",
      primaryImageUrl: "https://example.com/oak-desk.jpg",
      materialTags: ["oak", "wood"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000532",
      name: "Ergonomic Task Office Chair",
      categoryNormalized: "office_chairs",
      availability: "in stock",
      primaryImageUrl: "https://example.com/task-chair.jpg"
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000533",
      name: "Oak Bookcase Shelving",
      categoryNormalized: "storage",
      availability: "in stock",
      primaryImageUrl: "https://example.com/bookcase.jpg",
      materialTags: ["oak", "wood"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000534",
      name: "Adjustable Task Lamp",
      categoryNormalized: "lighting",
      availability: "in stock",
      primaryImageUrl: "https://example.com/task-lamp.jpg"
    }
  ]
});
assert.ok(officePools.pools.find((pool) => pool.role.category === "desks")?.candidateCount);
assert.ok(officePools.pools.find((pool) => pool.role.category === "office_chairs")?.candidateCount);
assert.ok(officePools.pools.find((pool) => pool.role.category === "storage")?.candidateCount);
assert.ok(officePools.pools.find((pool) => pool.role.category === "lighting")?.candidateCount);

const woodDeskPools = buildRoleScopedCandidatePools({
  roomType: "home office",
  conceptText: "warm oak writing desk with slim black legs",
  roles: [{ category: "desks", label: "desk", visualBrief: null, quantity: 1, priority: "required" }],
  candidates: [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000535",
      name: "Smart Black Metal Office Desk",
      categoryNormalized: "desks",
      availability: "in stock",
      primaryImageUrl: "https://example.com/black-metal-desk.jpg",
      colorTags: ["black"],
      materialTags: ["metal"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000536",
      name: "Oak Writing Desk",
      categoryNormalized: "desks",
      availability: "in stock",
      primaryImageUrl: "https://example.com/oak-writing-desk.jpg",
      materialTags: ["oak", "wood"]
    }
  ]
});
assert.equal(woodDeskPools.pools[0].candidates[0].name, "Oak Writing Desk");
assert.ok(
  woodDeskPools.pools[0].candidates[1].attributeScore.weaknessReasons.includes(
    "metal or glass desk is weak for requested wood desk role"
  )
);

const beigeSofaPool = buildRoleScopedCandidatePools({
  roomType: "living room",
  conceptText: "quiet contemporary living room with a beige linen sofa",
  roles: [{ category: "sofas", label: "anchor seating", visualBrief: "beige or cream linen sofa", quantity: 1, priority: "required" }],
  candidates: [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000541",
      name: "Olive Velvet Sofa",
      categoryNormalized: "sofas",
      availability: "in stock",
      primaryImageUrl: "https://example.com/olive-velvet-sofa.jpg",
      colorTags: ["olive", "green"],
      materialTags: ["velvet"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000542",
      name: "Cream Linen Sofa",
      categoryNormalized: "sofas",
      availability: "in stock",
      primaryImageUrl: "https://example.com/cream-linen-sofa-2.jpg",
      colorTags: ["cream", "beige"],
      materialTags: ["linen"]
    }
  ]
});
assert.equal(beigeSofaPool.pools[0].candidates[0].name, "Cream Linen Sofa");

const diningChairPool = buildRoleScopedCandidatePools({
  roomType: "dining room",
  conceptText: "six cream upholstered dining chairs around a walnut table",
  roles: [{ category: "chairs", label: "dining chairs", visualBrief: "slim upholstered dining chairs", quantity: 6, priority: "required" }],
  candidates: [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000551",
      name: "Bulky Lounge Armchair",
      categoryNormalized: "armchairs",
      availability: "in stock",
      primaryImageUrl: "https://example.com/bulky-armchair.jpg",
      materialTags: ["upholstered"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000552",
      name: "Cream Upholstered Dining Chair",
      categoryNormalized: "chairs",
      availability: "in stock",
      primaryImageUrl: "https://example.com/cream-dining-chair.jpg",
      colorTags: ["cream"],
      materialTags: ["upholstered", "fabric"]
    }
  ]
});
assert.deepEqual(
  diningChairPool.pools[0].candidates.map((candidate) => candidate.name),
  ["Cream Upholstered Dining Chair"]
);
assert.equal(diningChairPool.pools[0].rejectionReasons.category_mismatch, 1);

const mediaConsolePool = buildRoleScopedCandidatePools({
  roomType: "living room",
  conceptText: "walnut TV media console below the wall-mounted television",
  roles: [{ category: "storage", label: "TV media console", visualBrief: "low walnut media console", quantity: 1, priority: "supporting" }],
  candidates: [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000561",
      name: "Tall Walnut Bookcase",
      categoryNormalized: "storage",
      availability: "in stock",
      primaryImageUrl: "https://example.com/walnut-bookcase.jpg",
      materialTags: ["walnut", "wood"]
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000562",
      name: "Low Walnut Media Console",
      categoryNormalized: "storage",
      availability: "in stock",
      primaryImageUrl: "https://example.com/walnut-media-console.jpg",
      materialTags: ["walnut", "wood"]
    }
  ]
});
assert.equal(mediaConsolePool.pools[0].candidates[0].name, "Low Walnut Media Console");

const beigeSofaAttributeScore = scoreProductCandidateForRole({
  candidate: beigeSofaPool.pools[0].candidates[0],
  role: {
    category: "sofas",
    label: "anchor seating",
    visualBrief: "beige or cream linen sofa",
    quantity: 1,
    priority: "required"
  },
  conceptText: "quiet contemporary living room"
});
assert.ok(beigeSofaAttributeScore.category > 0);
assert.ok(beigeSofaAttributeScore.color > 0);
assert.ok(beigeSofaAttributeScore.material > 0);
assert.ok(beigeSofaAttributeScore.requestedColorFamilies.includes("cream"));
assert.ok(beigeSofaAttributeScore.candidateColorFamilies.includes("cream"));

const oliveSofaAttributeScore = scoreProductCandidateForRole({
  candidate: {
    ...base,
    id: "00000000-0000-4000-8000-000000000571",
    name: "Olive Velvet Sofa",
    categoryNormalized: "sofas",
    availability: "in stock",
    primaryImageUrl: "https://example.com/olive-sofa-score.jpg",
    colorTags: ["olive", "green"],
    materialTags: ["velvet"]
  },
  role: {
    category: "sofas",
    label: "anchor seating",
    visualBrief: "beige or cream linen sofa",
    quantity: 1,
    priority: "required"
  },
  conceptText: "quiet contemporary living room"
});
assert.ok(oliveSofaAttributeScore.color < 0);
assert.ok(oliveSofaAttributeScore.material < 0);
assert.ok(oliveSofaAttributeScore.weaknessReasons.includes("color family conflicts with role brief"));

const bulkyDiningChairAttributeScore = scoreProductCandidateForRole({
  candidate: {
    ...base,
    id: "00000000-0000-4000-8000-000000000572",
    name: "Bulky Lounge Armchair",
    categoryNormalized: "armchairs",
    availability: "in stock",
    primaryImageUrl: "https://example.com/bulky-armchair-score.jpg",
    styleTags: ["oversized"],
    materialTags: ["upholstered"]
  },
  role: {
    category: "chairs",
    label: "dining chairs",
    visualBrief: "slim upholstered dining chairs",
    quantity: 6,
    priority: "required"
  },
  conceptText: "cream dining room"
});
assert.ok(bulkyDiningChairAttributeScore.category < 0);
assert.ok(bulkyDiningChairAttributeScore.roleFit < 0);
assert.ok(
  bulkyDiningChairAttributeScore.weaknessReasons.includes("bulky lounge seating is weak for dining chair role")
);

const mediaConsoleAttributeScore = scoreProductCandidateForRole({
  candidate: mediaConsolePool.pools[0].candidates[0],
  role: {
    category: "storage",
    label: "TV media console",
    visualBrief: "low walnut media console",
    quantity: 1,
    priority: "supporting"
  },
  conceptText: "living room"
});
assert.ok(mediaConsoleAttributeScore.roleFit > 0);
assert.ok(mediaConsoleAttributeScore.material > 0);

const evalResults = productMatchingEvalScenarios.map((scenario) => runProductMatchingEvalScenario(scenario));
for (const result of evalResults) {
  assert.deepEqual(result.failures, [], result.scenarioName);
  assert.equal(result.passed, true, result.scenarioName);
  assert.equal(result.scorecard.roleCoverage >= 1 && result.scorecard.roleCoverage <= 5, true, result.scenarioName);
  assert.equal(result.scorecard.overallTrust >= 1 && result.scorecard.overallTrust <= 5, true, result.scenarioName);
}
const evalSummary = summarizeProductMatchingEvalResults(evalResults);
assert.equal(evalSummary.scenarioCount, productMatchingEvalScenarios.length);
assert.equal(evalSummary.passedScenarioCount, productMatchingEvalScenarios.length);
assert.equal(evalSummary.failedScenarioCount, 0);
assert.deepEqual(evalSummary.failedScenarioNames, []);
assert.equal(evalSummary.minimumOverallTrust !== null && evalSummary.minimumOverallTrust >= 1, true);

const failedEvalSummary = summarizeProductMatchingEvalResults([
  {
    ...evalResults[0],
    scenarioName: "synthetic failed eval",
    passed: false,
    failures: ["synthetic failure"],
    scorecard: {
      ...evalResults[0].scorecard,
      overallTrust: 2
    }
  },
  evalResults[1]
]);
assert.equal(failedEvalSummary.scenarioCount, 2);
assert.equal(failedEvalSummary.passedScenarioCount, 1);
assert.equal(failedEvalSummary.failedScenarioCount, 1);
assert.deepEqual(failedEvalSummary.failedScenarioNames, ["synthetic failed eval"]);
assert.equal(failedEvalSummary.minimumOverallTrust, 2);

const runtimePlanRoles: RoomProductRoleSpec[] = [
  { category: "sofas", label: "anchor seating", visualBrief: "cream linen sofa", quantity: 1, priority: "required" },
  { category: "storage", label: "TV media console", visualBrief: "low walnut media console", quantity: 1, priority: "supporting" }
];
const runtimePlanCandidates: ProductMatchCandidate[] = [
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000581",
    name: "Cream Linen Sofa",
    categoryNormalized: "sofas",
    availability: "in stock",
    primaryImageUrl: "https://example.com/runtime-sofa.jpg",
    colorTags: ["cream"],
    materialTags: ["linen"]
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000582",
    name: "Low Walnut Media Console",
    categoryNormalized: "storage",
    availability: "in stock",
    primaryImageUrl: "https://example.com/runtime-media-console.jpg",
    materialTags: ["walnut", "wood"]
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000583",
    name: "Tall Walnut Bookcase",
    categoryNormalized: "storage",
    availability: "in stock",
    primaryImageUrl: "https://example.com/runtime-bookcase.jpg",
    materialTags: ["walnut", "wood"]
  }
];
const runtimePlanOff = buildProductSourcingRuntimePlan({
  engineEnabled: false,
  roomType: "living room",
  conceptText: "cream linen sofa and low walnut TV media console",
  roles: runtimePlanRoles,
  candidates: runtimePlanCandidates
});
assert.equal(runtimePlanOff.engineEnabled, false);
assert.equal(runtimePlanOff.roleScopedPools.length, 0);
assert.equal("attributeScore" in runtimePlanOff.candidates[0], false);

const runtimePlanOn = buildProductSourcingRuntimePlan({
  engineEnabled: true,
  roomType: "living room",
  conceptText: "cream linen sofa and low walnut TV media console",
  roles: runtimePlanRoles,
  candidates: runtimePlanCandidates,
  candidatesPerRole: 2
});
assert.equal(runtimePlanOn.engineEnabled, true);
assert.equal(runtimePlanOn.roleScopedPools.length, 2);
assert.ok(runtimePlanOn.roleScopedPools.every((pool) => pool.candidateCount > 0));
assert.equal("attributeScore" in runtimePlanOn.candidates[0], true);

// selected estimate uses selected rows only
assert.equal(
  selectedItemsTotalAed([
    { status: "selected", unit_price_aed: 1000, quantity: 1 },
    { status: "option", unit_price_aed: 9999, quantity: 1 },
    { status: "rejected", unit_price_aed: 9999, quantity: 1 }
  ]),
  1000
);

// quantity > 1 is preserved through to row totals
const accentChairOptions = composeRoomProductOptions({
  ranked: rankProductMatches({
    roomType: "living room",
    conceptText: "living room with two matching accent chairs",
    budgetMaxAed: 10000,
    candidates: [1, 2].map((n) => ({
      ...base,
      id: `00000000-0000-4000-8000-00000000020${n}`,
      name: `Accent Chair ${n}`,
      categoryNormalized: "armchairs",
      priceAed: 1500,
      availability: "in stock",
      primaryImageUrl: `https://example.com/chair-${n}.jpg`
    }))
  }),
  roles: [
    { category: "armchairs", label: "accent chairs", visualBrief: null, quantity: 2, priority: "required" }
  ]
});
const chairTopId = accentChairOptions[0].options[0].id;
const chairRows = buildShoppingListItemRows({
  roleOptions: accentChairOptions,
  selectedProductIdByRole: new Map([["armchairs", chairTopId]])
});
const chairSelected = chairRows.find((row) => row.status === "selected");
assert.ok(chairSelected);
assert.equal(chairSelected.quantity, 2);
assert.equal(chairSelected.role_quantity, 2);
assert.equal(chairSelected.line_total_aed, chairSelected.unit_price_aed * 2);
assert.equal(selectedItemsTotalAed(chairRows), chairSelected.unit_price_aed * 2);

// existing one-row-per-product lists still group and render after migration
const legacyGroups = groupShoppingItemsByRole([
  {
    id: "legacy-1",
    status: "selected",
    category: "sofas",
    role_label: "sofas",
    role_priority: "supporting",
    role_quantity: 1,
    option_rank: 0
  },
  {
    id: "legacy-2",
    status: "selected",
    category: "rugs",
    role_label: "rugs",
    role_priority: "supporting",
    role_quantity: 1,
    option_rank: 3
  }
]);
assert.equal(legacyGroups.length, 2);
assert.equal(legacyGroups[0].options.length, 1);
assert.equal(legacyGroups[0].selectedId, "legacy-1");
assert.equal(legacyGroups[1].selectedId, "legacy-2");

const enhancedLivingRoles = enhancedProductRolesForRoom("living room");
assert.deepEqual(
  enhancedLivingRoles
    .filter((role) => role.importance === "anchor")
    .map((role) => role.category),
  ["sofas", "armchairs", "coffee_tables", "rugs"]
);
assert.ok(enhancedLivingRoles.some((role) => role.category === "curtains" && role.includeWhen === "catalog_supports"));
assert.ok(enhancedLivingRoles.some((role) => role.category === "storage" && role.label.includes("TV media")));

const enhancedDiningRoles = enhancedProductRolesForRoom("dining room");
assert.ok(
  enhancedDiningRoles.some((role) => role.category === "storage" && role.label.includes("sideboard"))
);

const enhancedBathroomRoles = enhancedProductRolesForRoom("powder room");
assert.deepEqual(
  enhancedBathroomRoles.map((role) => role.category),
  ["mirrors", "lighting", "towels", "decor", "stools"]
);

const enhancedOfficeRoles = enhancedProductRolesForRoom("Home Office");
assert.ok(enhancedOfficeRoles.some((role) => role.category === "desks"));
assert.ok(enhancedOfficeRoles.some((role) => role.category === "office_chairs"));
assert.ok(!enhancedOfficeRoles.some((role) => role.category === "sofas"));

const unorderedRenderRefs = [
  { id: "decor", category: "decor", role_label: "decor accent" },
  { id: "lamp", category: "lighting", role_label: "supporting lighting" },
  { id: "sofa", category: "sofas", role_label: "anchor seating" },
  { id: "rug", category: "rugs", role_label: "required rug" },
  { id: "art", category: "wall_art", role_label: "wall art" }
];
const orderedRenderRefs = sortProductsForRenderReferences(unorderedRenderRefs, "living room");
assert.deepEqual(
  orderedRenderRefs.map((item) => item.id),
  ["sofa", "rug", "lamp", "art", "decor"]
);
assert.ok(
  renderReferencePriorityForProduct({ category: "sofas", roleLabel: "anchor seating" }, "living room") <
    renderReferencePriorityForProduct({ category: "decor", roleLabel: "decor accent" }, "living room")
);
assert.deepEqual(
  sortProductsForRenderReferences(
    [
      { id: "first", category: "lighting", role_label: "table lamp" },
      { id: "second", category: "lighting", role_label: "floor lamp" }
    ],
    "living room"
  ).map((item) => item.id),
  ["first", "second"]
);

const diverseSofaOptions = composeRoomProductOptions({
  ranked: rankProductMatches({
    roomType: "living room",
    conceptText: "living room with a sofa",
    budgetMaxAed: 10000,
    candidates: [
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000401",
        name: "Cream Fabric Sofa 1",
        categoryNormalized: "sofas",
        priceAed: 2500,
        availability: "in stock",
        primaryImageUrl: "https://example.com/cream-sofa-1.jpg",
        colorTags: ["cream"],
        materialTags: ["fabric"]
      },
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000402",
        name: "Cream Fabric Sofa 2",
        categoryNormalized: "sofas",
        priceAed: 2600,
        availability: "in stock",
        primaryImageUrl: "https://example.com/cream-sofa-2.jpg",
        colorTags: ["cream"],
        materialTags: ["fabric"]
      },
      {
        ...base,
        id: "00000000-0000-4000-8000-000000000403",
        name: "Green Velvet Sofa",
        categoryNormalized: "sofas",
        priceAed: 4200,
        availability: "in stock",
        primaryImageUrl: "https://example.com/green-sofa.jpg",
        colorTags: ["green"],
        materialTags: ["velvet"]
      }
    ]
  }),
  roles: [{ category: "sofas", label: "anchor seating", visualBrief: null, quantity: 1, priority: "required" }],
  optionsPerRole: 3
});
assert.deepEqual(
  diverseSofaOptions[0].options.map((option) => option.name),
  ["Cream Fabric Sofa 1", "Green Velvet Sofa", "Cream Fabric Sofa 2"]
);

console.log("product matching tests passed");
