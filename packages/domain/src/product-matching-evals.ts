import {
  buildProductSourcingRuntimePlan,
  type ProductMatchCandidate,
  type ProductRoleAttributeScore,
  type ProductSourcingRuntimePlan,
  type RoleScopedCandidatePool,
  type RoomProductRoleSpec
} from "./product-matching";

const evalCheckedAt = "2026-05-22T00:00:00.000Z";

const baseEvalCandidate: ProductMatchCandidate = {
  id: "10000000-0000-4000-8000-000000000000",
  name: "Eval Product",
  retailerName: "Eval Retailer",
  canonicalUrl: "https://example.com/eval-product",
  categoryNormalized: null,
  priceAed: 1000,
  salePriceAed: null,
  availability: "in stock",
  primaryImageUrl: "https://example.com/eval-product.jpg",
  color: null,
  material: null,
  styleTags: [],
  colorTags: [],
  materialTags: [],
  roomTags: [],
  lastCheckedAt: evalCheckedAt,
  dimensions: null
};

export type ProductMatchingEvalExpectations = {
  requiredRoleLabels: string[];
  allowedMissingRequiredRoleLabels?: string[];
  expectedTopCandidateIdByRole?: Record<string, string>;
  allowedTopCandidateIdsByRole?: Record<string, string[]>;
  disallowedCandidateIdsByRole?: Record<string, string[]>;
  minCandidateCountByRole?: Record<string, number>;
  expectedRejectedReasonsByRole?: Record<string, Record<string, number>>;
  expectedQuantityByRole?: Record<string, number>;
};

export type ProductMatchingEvalScenario = {
  name: string;
  roomType: string;
  conceptText: string;
  budgetMaxAed?: number | null;
  avoidColorTags?: string[];
  roles: RoomProductRoleSpec[];
  candidates: ProductMatchCandidate[];
  expectations: ProductMatchingEvalExpectations;
};

export type ProductMatchingEvalRoleResult = {
  roleLabel: string;
  rolePriority: "required" | "supporting";
  roleQuantity: number;
  expectedQuantity: number;
  candidateCount: number;
  rejectedCount: number;
  rejectionReasons: Record<string, number>;
  weaknessReasons: string[];
  topCandidateId: string | null;
  topCandidateName: string | null;
  topAttributeScore: ProductRoleAttributeScore | null;
  expectedTopPassed: boolean;
  allowedTopPassed: boolean;
  disallowedCandidateIdsPresent: string[];
  minCandidateCountPassed: boolean;
  expectedRejectedReasonsPassed: boolean;
  quantityPassed: boolean;
};

export type ProductMatchingEvalScorecard = {
  categoryCorrectness: number;
  colorFidelity: number;
  materialFidelity: number;
  quantityCorrectness: number;
  priceStockTrust: number;
  roleCoverage: number;
  overallTrust: number;
  deferredDimensions: string[];
};

export type ProductMatchingEvalResult = {
  scenarioName: string;
  passed: boolean;
  plan: ProductSourcingRuntimePlan;
  roleResults: ProductMatchingEvalRoleResult[];
  scorecard: ProductMatchingEvalScorecard;
  failures: string[];
};

export type ProductMatchingEvalSuiteSummary = {
  scenarioCount: number;
  passedScenarioCount: number;
  failedScenarioCount: number;
  failedScenarioNames: string[];
  averageScorecard: Omit<ProductMatchingEvalScorecard, "deferredDimensions">;
  minimumOverallTrust: number | null;
};

export function evalCandidate(
  id: string,
  name: string,
  overrides: Partial<Omit<ProductMatchCandidate, "id" | "name">> = {}
): ProductMatchCandidate {
  return {
    ...baseEvalCandidate,
    ...overrides,
    id,
    name
  };
}

export function runProductMatchingEvalScenario(scenario: ProductMatchingEvalScenario): ProductMatchingEvalResult {
  const plan = buildProductSourcingRuntimePlan({
    engineEnabled: true,
    roomType: scenario.roomType,
    conceptText: scenario.conceptText,
    budgetMaxAed: scenario.budgetMaxAed ?? null,
    avoidColorTags: scenario.avoidColorTags,
    roles: scenario.roles,
    candidates: scenario.candidates,
    candidatesPerRole: 4
  });

  const poolsByLabel = new Map(plan.roleScopedPools.map((pool) => [pool.role.label, pool]));
  const roleResults = scenario.roles.map((role) =>
    summarizeRoleResult(role, poolsByLabel.get(role.label), scenario.expectations)
  );
  const failures = failureMessages(roleResults, scenario.expectations);
  const scorecard = buildEvalScorecard(roleResults);

  return {
    scenarioName: scenario.name,
    passed: failures.length === 0,
    plan,
    roleResults,
    scorecard,
    failures
  };
}

export function summarizeProductMatchingEvalResults(
  results: ProductMatchingEvalResult[]
): ProductMatchingEvalSuiteSummary {
  const failedScenarioNames = results.filter((result) => !result.passed).map((result) => result.scenarioName);
  const scorecards = results.map((result) => result.scorecard);

  return {
    scenarioCount: results.length,
    passedScenarioCount: results.length - failedScenarioNames.length,
    failedScenarioCount: failedScenarioNames.length,
    failedScenarioNames,
    averageScorecard: {
      categoryCorrectness: averageScore(scorecards.map((scorecard) => scorecard.categoryCorrectness)),
      colorFidelity: averageScore(scorecards.map((scorecard) => scorecard.colorFidelity)),
      materialFidelity: averageScore(scorecards.map((scorecard) => scorecard.materialFidelity)),
      quantityCorrectness: averageScore(scorecards.map((scorecard) => scorecard.quantityCorrectness)),
      priceStockTrust: averageScore(scorecards.map((scorecard) => scorecard.priceStockTrust)),
      roleCoverage: averageScore(scorecards.map((scorecard) => scorecard.roleCoverage)),
      overallTrust: averageScore(scorecards.map((scorecard) => scorecard.overallTrust))
    },
    minimumOverallTrust:
      scorecards.length > 0 ? Math.min(...scorecards.map((scorecard) => scorecard.overallTrust)) : null
  };
}

function summarizeRoleResult(
  role: RoomProductRoleSpec,
  pool: RoleScopedCandidatePool | undefined,
  expectations: ProductMatchingEvalExpectations
): ProductMatchingEvalRoleResult {
  const candidates = pool?.candidates ?? [];
  const topCandidate = candidates[0] ?? null;
  const expectedTopCandidateId = expectations.expectedTopCandidateIdByRole?.[role.label];
  const allowedTopCandidateIds = expectations.allowedTopCandidateIdsByRole?.[role.label];
  const disallowedCandidateIds = expectations.disallowedCandidateIdsByRole?.[role.label] ?? [];
  const minCandidateCount = expectations.minCandidateCountByRole?.[role.label] ?? 0;
  const expectedRejectedReasons = expectations.expectedRejectedReasonsByRole?.[role.label] ?? {};
  const expectedQuantity = expectations.expectedQuantityByRole?.[role.label] ?? role.quantity;
  const topCandidateId = topCandidate?.id ?? null;

  return {
    roleLabel: role.label,
    rolePriority: role.priority,
    roleQuantity: role.quantity,
    expectedQuantity,
    candidateCount: pool?.candidateCount ?? 0,
    rejectedCount: pool?.rejectedCount ?? 0,
    rejectionReasons: pool?.rejectionReasons ?? {},
    weaknessReasons: pool?.weaknessReasons ?? [],
    topCandidateId,
    topCandidateName: topCandidate?.name ?? null,
    topAttributeScore: topCandidate?.attributeScore ?? null,
    expectedTopPassed: !expectedTopCandidateId || topCandidateId === expectedTopCandidateId,
    allowedTopPassed: !allowedTopCandidateIds || Boolean(topCandidateId && allowedTopCandidateIds.includes(topCandidateId)),
    disallowedCandidateIdsPresent: candidates
      .map((candidate) => candidate.id)
      .filter((candidateId) => disallowedCandidateIds.includes(candidateId)),
    minCandidateCountPassed: candidates.length >= minCandidateCount,
    expectedRejectedReasonsPassed: Object.entries(expectedRejectedReasons).every(
      ([reason, count]) => (pool?.rejectionReasons[reason] ?? 0) >= count
    ),
    quantityPassed: role.quantity === expectedQuantity
  };
}

function failureMessages(
  roleResults: ProductMatchingEvalRoleResult[],
  expectations: ProductMatchingEvalExpectations
) {
  const failures: string[] = [];
  const resultsByLabel = new Map(roleResults.map((result) => [result.roleLabel, result]));
  const allowedMissingRequiredRoles = new Set(expectations.allowedMissingRequiredRoleLabels ?? []);

  for (const roleLabel of expectations.requiredRoleLabels) {
    const result = resultsByLabel.get(roleLabel);
    if ((!result || result.candidateCount === 0) && !allowedMissingRequiredRoles.has(roleLabel)) {
      failures.push(`${roleLabel}: required role has no candidates`);
    }
  }

  for (const result of roleResults) {
    if (!result.expectedTopPassed) {
      failures.push(`${result.roleLabel}: expected top candidate was not selected`);
    }
    if (!result.allowedTopPassed) {
      failures.push(`${result.roleLabel}: top candidate is outside allowed candidate set`);
    }
    if (result.disallowedCandidateIdsPresent.length > 0) {
      failures.push(`${result.roleLabel}: disallowed candidates present ${result.disallowedCandidateIdsPresent.join(", ")}`);
    }
    if (!result.minCandidateCountPassed) {
      failures.push(`${result.roleLabel}: candidate count below expected minimum`);
    }
    if (!result.expectedRejectedReasonsPassed) {
      failures.push(`${result.roleLabel}: expected rejection reasons were not present`);
    }
    if (!result.quantityPassed) {
      failures.push(`${result.roleLabel}: quantity expectation was not met`);
    }
  }

  return failures;
}

function buildEvalScorecard(roleResults: ProductMatchingEvalRoleResult[]): ProductMatchingEvalScorecard {
  const requiredRoles = roleResults.filter((result) => result.rolePriority === "required");
  const coveredRequiredRoles = requiredRoles.filter((result) => result.candidateCount > 0);
  const topScores = roleResults.flatMap((result) => (result.topAttributeScore ? [result.topAttributeScore] : []));
  const allTopAvailable = roleResults.every((result) => result.candidateCount === 0 || result.topCandidateId);
  const noUnexpectedRejections = roleResults.every((result) => result.expectedRejectedReasonsPassed);

  const categoryCorrectness = averageScore(topScores.map((score) => dimensionScore(score.category)));
  const colorFidelity = averageScore(topScores.map((score) => optionalDimensionScore(score.color)));
  const materialFidelity = averageScore(topScores.map((score) => optionalDimensionScore(score.material)));
  const quantityCorrectness = roleResults.every((result) => result.quantityPassed) ? 5 : 1;
  const priceStockTrust = allTopAvailable && noUnexpectedRejections ? 5 : 3;
  const roleCoverage =
    requiredRoles.length === 0 || coveredRequiredRoles.length === requiredRoles.length
      ? 5
      : coveredRequiredRoles.length > 0
        ? 3
        : 1;
  const overallTrust = Math.round(
    averageScore([categoryCorrectness, colorFidelity, materialFidelity, quantityCorrectness, priceStockTrust, roleCoverage])
  );

  return {
    categoryCorrectness,
    colorFidelity,
    materialFidelity,
    quantityCorrectness,
    priceStockTrust,
    roleCoverage,
    overallTrust,
    deferredDimensions: ["style/silhouette visual fidelity", "AI explanation quality", "manual product image inspection"]
  };
}

function dimensionScore(score: number) {
  if (score > 0) {
    return 5;
  }
  if (score === 0) {
    return 3;
  }
  return 1;
}

function optionalDimensionScore(score: number) {
  if (score > 0) {
    return 5;
  }
  if (score === 0) {
    return 4;
  }
  return 1;
}

function averageScore(scores: number[]) {
  if (scores.length === 0) {
    return 3;
  }

  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);
}

export const productMatchingEvalScenarios: ProductMatchingEvalScenario[] = [
  {
    name: "living room beige sofa prefers cream linen over olive velvet",
    roomType: "living room",
    conceptText: "quiet living room with a beige linen sofa",
    roles: [
      {
        category: "sofas",
        label: "anchor seating",
        visualBrief: "beige or cream linen sofa",
        quantity: 1,
        priority: "required"
      }
    ],
    candidates: [
      evalCandidate("10000000-0000-4000-8000-000000000001", "Olive Velvet Sofa", {
        categoryNormalized: "sofas",
        primaryImageUrl: "https://example.com/eval-olive-sofa.jpg",
        colorTags: ["olive", "green"],
        materialTags: ["velvet"]
      }),
      evalCandidate("10000000-0000-4000-8000-000000000002", "Cream Linen Sofa", {
        categoryNormalized: "sofas",
        primaryImageUrl: "https://example.com/eval-cream-sofa.jpg",
        colorTags: ["cream", "beige"],
        materialTags: ["linen"]
      })
    ],
    expectations: {
      requiredRoleLabels: ["anchor seating"],
      expectedTopCandidateIdByRole: {
        "anchor seating": "10000000-0000-4000-8000-000000000002"
      },
      minCandidateCountByRole: {
        "anchor seating": 2
      }
    }
  },
  {
    name: "living room media console ranks media storage above bookcase",
    roomType: "living room",
    conceptText: "low walnut TV media console below a wall mounted television",
    roles: [
      {
        category: "storage",
        label: "TV media console",
        visualBrief: "low walnut media console",
        quantity: 1,
        priority: "supporting"
      }
    ],
    candidates: [
      evalCandidate("10000000-0000-4000-8000-000000000011", "Tall Walnut Bookcase", {
        categoryNormalized: "storage",
        primaryImageUrl: "https://example.com/eval-bookcase.jpg",
        materialTags: ["walnut", "wood"]
      }),
      evalCandidate("10000000-0000-4000-8000-000000000012", "Low Walnut Media Console", {
        categoryNormalized: "storage",
        primaryImageUrl: "https://example.com/eval-media-console.jpg",
        materialTags: ["walnut", "wood"]
      })
    ],
    expectations: {
      requiredRoleLabels: [],
      expectedTopCandidateIdByRole: {
        "TV media console": "10000000-0000-4000-8000-000000000012"
      },
      allowedTopCandidateIdsByRole: {
        "TV media console": ["10000000-0000-4000-8000-000000000012"]
      }
    }
  },
  {
    name: "dining room chairs reject bulky lounge armchairs",
    roomType: "dining room",
    conceptText: "walnut dining room with six slim upholstered dining chairs",
    roles: [
      {
        category: "chairs",
        label: "dining chairs",
        visualBrief: "slim upholstered dining chairs",
        quantity: 6,
        priority: "required"
      }
    ],
    candidates: [
      evalCandidate("10000000-0000-4000-8000-000000000021", "Bulky Lounge Armchair", {
        categoryNormalized: "armchairs",
        primaryImageUrl: "https://example.com/eval-armchair.jpg",
        styleTags: ["oversized"],
        materialTags: ["upholstered"]
      }),
      evalCandidate("10000000-0000-4000-8000-000000000022", "Cream Upholstered Dining Chair", {
        categoryNormalized: "chairs",
        primaryImageUrl: "https://example.com/eval-dining-chair.jpg",
        colorTags: ["cream"],
        materialTags: ["upholstered", "fabric"]
      })
    ],
    expectations: {
      requiredRoleLabels: ["dining chairs"],
      expectedTopCandidateIdByRole: {
        "dining chairs": "10000000-0000-4000-8000-000000000022"
      },
      disallowedCandidateIdsByRole: {
        "dining chairs": ["10000000-0000-4000-8000-000000000021"]
      },
      expectedRejectedReasonsByRole: {
        "dining chairs": {
          category_mismatch: 1
        }
      },
      expectedQuantityByRole: {
        "dining chairs": 6
      }
    }
  },
  {
    name: "dining room sideboard prefers credenza over generic shelving",
    roomType: "dining room",
    conceptText: "cream upholstered dining chairs with a walnut sideboard and over-table lighting",
    roles: [
      {
        category: "storage",
        label: "sideboard, credenza, or dining console",
        visualBrief: "walnut sideboard credenza",
        quantity: 1,
        priority: "supporting"
      }
    ],
    candidates: [
      evalCandidate("10000000-0000-4000-8000-000000000031", "Walnut Storage Shelving", {
        categoryNormalized: "storage",
        primaryImageUrl: "https://example.com/eval-storage-shelving.jpg",
        materialTags: ["walnut", "wood"]
      }),
      evalCandidate("10000000-0000-4000-8000-000000000032", "Walnut Sideboard Credenza", {
        categoryNormalized: "storage",
        primaryImageUrl: "https://example.com/eval-sideboard.jpg",
        materialTags: ["walnut", "wood"]
      })
    ],
    expectations: {
      requiredRoleLabels: [],
      allowedTopCandidateIdsByRole: {
        "sideboard, credenza, or dining console": ["10000000-0000-4000-8000-000000000032"]
      }
    }
  },
  {
    name: "bedroom required roles cover bed and bedside tables",
    roomType: "bedroom",
    conceptText: "ivory upholstered bed with walnut bedside tables and warm bedside lighting",
    roles: [
      {
        category: "beds",
        label: "bed or bed frame",
        visualBrief: "ivory upholstered bed",
        quantity: 1,
        priority: "required"
      },
      {
        category: "side_tables",
        label: "bedside tables",
        visualBrief: "pair of walnut bedside tables",
        quantity: 2,
        priority: "required"
      }
    ],
    candidates: [
      evalCandidate("10000000-0000-4000-8000-000000000041", "Ivory Upholstered Bed", {
        categoryNormalized: "beds",
        primaryImageUrl: "https://example.com/eval-bed.jpg",
        colorTags: ["ivory"],
        materialTags: ["upholstered", "fabric"]
      }),
      evalCandidate("10000000-0000-4000-8000-000000000042", "Walnut Bedside Table", {
        categoryNormalized: "side_tables",
        primaryImageUrl: "https://example.com/eval-bedside-table.jpg",
        materialTags: ["walnut", "wood"]
      })
    ],
    expectations: {
      requiredRoleLabels: ["bed or bed frame", "bedside tables"],
      allowedTopCandidateIdsByRole: {
        "bed or bed frame": ["10000000-0000-4000-8000-000000000041"],
        "bedside tables": ["10000000-0000-4000-8000-000000000042"]
      },
      expectedQuantityByRole: {
        "bedside tables": 2
      }
    }
  },
  {
    name: "bedroom missing required bedside role is explicit",
    roomType: "bedroom",
    conceptText: "ivory upholstered bed with walnut bedside tables",
    roles: [
      {
        category: "side_tables",
        label: "bedside tables",
        visualBrief: "pair of walnut bedside tables",
        quantity: 2,
        priority: "required"
      }
    ],
    candidates: [
      evalCandidate("10000000-0000-4000-8000-000000000051", "Walnut Console Table", {
        categoryNormalized: "coffee_tables",
        primaryImageUrl: "https://example.com/eval-console-table.jpg",
        materialTags: ["walnut", "wood"]
      })
    ],
    expectations: {
      requiredRoleLabels: ["bedside tables"],
      allowedMissingRequiredRoleLabels: ["bedside tables"],
      minCandidateCountByRole: {
        "bedside tables": 0
      },
      expectedRejectedReasonsByRole: {
        "bedside tables": {
          category_mismatch: 1
        }
      },
      expectedQuantityByRole: {
        "bedside tables": 2
      }
    }
  },
  {
    name: "home office covers desk chair storage and task lighting",
    roomType: "home office",
    conceptText: "oak desk, ergonomic office chair, bookcase storage, and adjustable task lamp",
    roles: [
      {
        category: "desks",
        label: "desk",
        visualBrief: "oak writing desk",
        quantity: 1,
        priority: "required"
      },
      {
        category: "office_chairs",
        label: "office chair",
        visualBrief: "ergonomic task chair",
        quantity: 1,
        priority: "required"
      },
      {
        category: "storage",
        label: "storage or shelving",
        visualBrief: "oak bookcase shelving",
        quantity: 1,
        priority: "supporting"
      },
      {
        category: "lighting",
        label: "task lighting",
        visualBrief: "adjustable task lamp",
        quantity: 1,
        priority: "supporting"
      }
    ],
    candidates: [
      evalCandidate("10000000-0000-4000-8000-000000000061", "Oak Writing Desk", {
        categoryNormalized: "desks",
        primaryImageUrl: "https://example.com/eval-desk.jpg",
        materialTags: ["oak", "wood"]
      }),
      evalCandidate("10000000-0000-4000-8000-000000000062", "Ergonomic Task Office Chair", {
        categoryNormalized: "office_chairs",
        primaryImageUrl: "https://example.com/eval-office-chair.jpg"
      }),
      evalCandidate("10000000-0000-4000-8000-000000000063", "Oak Bookcase Shelving", {
        categoryNormalized: "storage",
        primaryImageUrl: "https://example.com/eval-office-storage.jpg",
        materialTags: ["oak", "wood"]
      }),
      evalCandidate("10000000-0000-4000-8000-000000000064", "Adjustable Task Lamp", {
        categoryNormalized: "lighting",
        primaryImageUrl: "https://example.com/eval-task-lamp.jpg"
      })
    ],
    expectations: {
      requiredRoleLabels: ["desk", "office chair"],
      allowedTopCandidateIdsByRole: {
        desk: ["10000000-0000-4000-8000-000000000061"],
        "office chair": ["10000000-0000-4000-8000-000000000062"],
        "storage or shelving": ["10000000-0000-4000-8000-000000000063"],
        "task lighting": ["10000000-0000-4000-8000-000000000064"]
      }
    }
  },
  {
    name: "living room paired seating keeps accent chair quantity",
    roomType: "living room",
    conceptText: "cream sofa with two boucle lounge chairs and a generous neutral rug",
    roles: [
      {
        category: "armchairs",
        label: "secondary seating",
        visualBrief: "two boucle lounge chairs",
        quantity: 2,
        priority: "supporting"
      }
    ],
    candidates: [
      evalCandidate("10000000-0000-4000-8000-000000000071", "Boucle Lounge Armchair", {
        categoryNormalized: "armchairs",
        primaryImageUrl: "https://example.com/eval-boucle-chair.jpg",
        materialTags: ["boucle"]
      })
    ],
    expectations: {
      requiredRoleLabels: [],
      allowedTopCandidateIdsByRole: {
        "secondary seating": ["10000000-0000-4000-8000-000000000071"]
      },
      expectedQuantityByRole: {
        "secondary seating": 2
      }
    }
  },
  {
    name: "sofa eligibility gates reject unavailable missing image and over budget",
    roomType: "living room",
    conceptText: "beige linen sofa within budget",
    budgetMaxAed: 5000,
    roles: [
      {
        category: "sofas",
        label: "anchor seating",
        visualBrief: "beige linen sofa",
        quantity: 1,
        priority: "required"
      }
    ],
    candidates: [
      evalCandidate("10000000-0000-4000-8000-000000000081", "Sold Out Beige Linen Sofa", {
        categoryNormalized: "sofas",
        availability: "out of stock",
        primaryImageUrl: "https://example.com/eval-sold-out-sofa.jpg",
        colorTags: ["beige"],
        materialTags: ["linen"]
      }),
      evalCandidate("10000000-0000-4000-8000-000000000082", "No Image Beige Linen Sofa", {
        categoryNormalized: "sofas",
        primaryImageUrl: null,
        colorTags: ["beige"],
        materialTags: ["linen"]
      }),
      evalCandidate("10000000-0000-4000-8000-000000000083", "Expensive Beige Linen Sofa", {
        categoryNormalized: "sofas",
        priceAed: 8000,
        primaryImageUrl: "https://example.com/eval-expensive-sofa.jpg",
        colorTags: ["beige"],
        materialTags: ["linen"]
      }),
      evalCandidate("10000000-0000-4000-8000-000000000084", "Budget Beige Linen Sofa", {
        categoryNormalized: "sofas",
        priceAed: 4200,
        primaryImageUrl: "https://example.com/eval-budget-sofa.jpg",
        colorTags: ["beige"],
        materialTags: ["linen"]
      })
    ],
    expectations: {
      requiredRoleLabels: ["anchor seating"],
      expectedTopCandidateIdByRole: {
        "anchor seating": "10000000-0000-4000-8000-000000000084"
      },
      disallowedCandidateIdsByRole: {
        "anchor seating": [
          "10000000-0000-4000-8000-000000000081",
          "10000000-0000-4000-8000-000000000082",
          "10000000-0000-4000-8000-000000000083"
        ]
      },
      expectedRejectedReasonsByRole: {
        "anchor seating": {
          unavailable: 1,
          missing_image: 1,
          over_budget: 1
        }
      }
    }
  },
  {
    name: "quantity-aware budget gate rejects a role line total over budget",
    roomType: "living room",
    conceptText: "cognac leather accent armchair, pair",
    budgetMaxAed: 40000,
    roles: [
      {
        category: "chairs",
        label: "accent seating",
        visualBrief: "cognac leather accent armchair",
        quantity: 2,
        priority: "supporting"
      }
    ],
    candidates: [
      // Unit price fits the budget (22,059 < 40,000) but the LINE total at qty 2
      // is 44,118 — over budget. Must be gated out, not selected.
      evalCandidate("10000000-0000-4000-8000-000000000091", "Stilo Cognac Leather Armchair", {
        categoryNormalized: "chairs",
        priceAed: 22059,
        primaryImageUrl: "https://example.com/eval-stilo-armchair.jpg",
        colorTags: ["cognac", "brown"],
        materialTags: ["leather"]
      }),
      // Line total 30,000 < 40,000 — the affordable pair, should win.
      evalCandidate("10000000-0000-4000-8000-000000000092", "Budget Cognac Leather Armchair", {
        categoryNormalized: "chairs",
        priceAed: 15000,
        primaryImageUrl: "https://example.com/eval-budget-armchair.jpg",
        colorTags: ["cognac", "brown"],
        materialTags: ["leather"]
      })
    ],
    expectations: {
      requiredRoleLabels: ["accent seating"],
      expectedTopCandidateIdByRole: {
        "accent seating": "10000000-0000-4000-8000-000000000092"
      },
      disallowedCandidateIdsByRole: {
        "accent seating": ["10000000-0000-4000-8000-000000000091"]
      },
      expectedRejectedReasonsByRole: {
        "accent seating": {
          over_budget: 1
        }
      },
      expectedQuantityByRole: {
        "accent seating": 2
      }
    }
  },
  {
    name: "avoid-color candidates are excluded from the option pool not just demoted",
    roomType: "living room",
    conceptText: "cognac leather accent armchair",
    avoidColorTags: ["red"],
    roles: [
      {
        category: "chairs",
        label: "accent seating",
        visualBrief: "cognac leather accent armchair",
        quantity: 1,
        priority: "supporting"
      }
    ],
    candidates: [
      // Brief says avoid red: this must NOT survive as an alternate, even though it is a valid
      // chair. Previously the -24 avoidColorTags penalty only demoted it.
      evalCandidate("10000000-0000-4000-8000-000000000101", "Cigar Lounge Armchair Red", {
        categoryNormalized: "chairs",
        priceAed: 4200,
        primaryImageUrl: "https://example.com/eval-red-armchair.jpg",
        color: "red",
        colorTags: ["red"],
        materialTags: ["leather"]
      }),
      evalCandidate("10000000-0000-4000-8000-000000000102", "Cognac Leather Armchair", {
        categoryNormalized: "chairs",
        priceAed: 4400,
        primaryImageUrl: "https://example.com/eval-cognac-armchair.jpg",
        color: "cognac",
        colorTags: ["cognac", "brown"],
        materialTags: ["leather"]
      }),
      evalCandidate("10000000-0000-4000-8000-000000000103", "Camel Boucle Armchair", {
        categoryNormalized: "chairs",
        priceAed: 4600,
        primaryImageUrl: "https://example.com/eval-camel-armchair.jpg",
        color: "camel",
        colorTags: ["camel", "tan"],
        materialTags: ["boucle"]
      })
    ],
    expectations: {
      requiredRoleLabels: [],
      allowedTopCandidateIdsByRole: {
        "accent seating": [
          "10000000-0000-4000-8000-000000000102",
          "10000000-0000-4000-8000-000000000103"
        ]
      },
      disallowedCandidateIdsByRole: {
        "accent seating": ["10000000-0000-4000-8000-000000000101"]
      },
      expectedRejectedReasonsByRole: {
        "accent seating": {
          avoid_color: 1
        }
      }
    }
  },
  {
    name: "dining room full anchor set covers table chairs and lighting",
    roomType: "dining room",
    conceptText: "walnut dining table with six cream upholstered dining chairs and slim brass pendant lighting",
    roles: [
      {
        category: "dining_tables",
        label: "dining table",
        visualBrief: "walnut dining table",
        quantity: 1,
        priority: "required"
      },
      {
        category: "chairs",
        label: "dining chairs",
        visualBrief: "cream upholstered dining chairs",
        quantity: 6,
        priority: "required"
      },
      {
        category: "lighting",
        label: "over-table lighting",
        visualBrief: "slim brass pendant lighting",
        quantity: 1,
        priority: "supporting"
      }
    ],
    candidates: [
      evalCandidate("10000000-0000-4000-8000-000000000091", "Walnut Dining Table", {
        categoryNormalized: "dining_tables",
        primaryImageUrl: "https://example.com/eval-dining-table.jpg",
        materialTags: ["walnut", "wood"]
      }),
      evalCandidate("10000000-0000-4000-8000-000000000092", "Cream Upholstered Dining Chair", {
        categoryNormalized: "chairs",
        primaryImageUrl: "https://example.com/eval-cream-chair.jpg",
        colorTags: ["cream"],
        materialTags: ["upholstered", "fabric"]
      }),
      evalCandidate("10000000-0000-4000-8000-000000000093", "Slim Brass Pendant Light", {
        categoryNormalized: "lighting",
        primaryImageUrl: "https://example.com/eval-brass-pendant.jpg",
        materialTags: ["brass", "metal"]
      })
    ],
    expectations: {
      requiredRoleLabels: ["dining table", "dining chairs"],
      allowedTopCandidateIdsByRole: {
        "dining table": ["10000000-0000-4000-8000-000000000091"],
        "dining chairs": ["10000000-0000-4000-8000-000000000092"],
        "over-table lighting": ["10000000-0000-4000-8000-000000000093"]
      },
      expectedQuantityByRole: {
        "dining chairs": 6
      }
    }
  }
];
