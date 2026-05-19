import { z } from "zod";

export const productMatchCandidateSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  retailerName: z.string().min(1),
  canonicalUrl: z.url(),
  categoryNormalized: z.string().nullable(),
  priceAed: z.number().nonnegative().nullable(),
  salePriceAed: z.number().nonnegative().nullable(),
  availability: z.string().nullable(),
  primaryImageUrl: z.url().nullable(),
  color: z.string().nullable(),
  material: z.string().nullable(),
  styleTags: z.array(z.string()),
  colorTags: z.array(z.string()),
  materialTags: z.array(z.string()),
  roomTags: z.array(z.string()),
  lastCheckedAt: z.string().nullable(),
  dimensions: z
    .object({
      widthCm: z.number().positive().nullable(),
      depthCm: z.number().positive().nullable(),
      heightCm: z.number().positive().nullable(),
      sourceText: z.string().nullable()
    })
    .nullable()
});

export const productMatchRequestSchema = z.object({
  roomType: z.string().min(1),
  conceptText: z.string().min(1),
  budgetMaxAed: z.number().nonnegative().nullable().optional(),
  roomMeasurements: z
    .object({
      wallLengthCm: z.number().positive().nullable(),
      roomDepthCm: z.number().positive().nullable()
    })
    .nullable()
    .optional(),
  candidates: z.array(productMatchCandidateSchema)
});

export type ProductMatchCandidate = z.infer<typeof productMatchCandidateSchema>;
export type ProductMatchRequest = z.infer<typeof productMatchRequestSchema>;

export type RankedProductMatch = ProductMatchCandidate & {
  score: number;
  selectionReason: string;
  dimensionFitNote: string | null;
  warnings: string[];
};

export type RoomProductRole = {
  category: string;
  label: string;
  quantity: number;
  required: boolean;
  visualBrief?: string;
};

export const substitutionModeSchema = z.enum(["cheaper", "closer_style", "same_retailer", "in_stock"]);
export type SubstitutionMode = z.infer<typeof substitutionModeSchema>;

const roomCategoryHints: Record<string, string[]> = {
  living: ["sofas", "armchairs", "coffee_tables", "side_tables", "rugs", "lighting", "wall_art", "decor"],
  bedroom: ["beds", "side_tables", "rugs", "lighting", "wall_art", "decor"],
  dining: ["dining_tables", "chairs", "side_tables", "rugs", "lighting", "wall_art", "decor"],
  bathroom: ["mirrors", "lighting", "decor"],
  default: ["sofas", "armchairs", "coffee_tables", "side_tables", "rugs", "lighting", "wall_art", "decor"]
};

const roomProductRoles: Record<string, RoomProductRole[]> = {
  living: [
    { category: "sofas", label: "anchor seating", quantity: 1, required: true },
    { category: "armchairs", label: "accent chairs", quantity: 2, required: true },
    { category: "coffee_tables", label: "coffee table", quantity: 1, required: true },
    { category: "side_tables", label: "side table", quantity: 1, required: false },
    { category: "rugs", label: "rug", quantity: 1, required: true },
    { category: "lighting", label: "lighting", quantity: 1, required: false },
    { category: "wall_art", label: "wall art", quantity: 1, required: false },
    { category: "decor", label: "decor accent", quantity: 2, required: false }
  ],
  bedroom: [
    { category: "beds", label: "bed", quantity: 1, required: true },
    { category: "side_tables", label: "bedside tables", quantity: 2, required: true },
    { category: "rugs", label: "rug", quantity: 1, required: false },
    { category: "lighting", label: "bedside lighting", quantity: 2, required: false },
    { category: "wall_art", label: "wall art", quantity: 1, required: false },
    { category: "decor", label: "decor accent", quantity: 2, required: false }
  ],
  dining: [
    { category: "dining_tables", label: "dining table", quantity: 1, required: true },
    { category: "chairs", label: "dining chairs", quantity: 6, required: true },
    { category: "rugs", label: "rug", quantity: 1, required: false },
    { category: "lighting", label: "pendant lighting", quantity: 1, required: false },
    { category: "wall_art", label: "wall art", quantity: 1, required: false },
    { category: "decor", label: "table decor", quantity: 2, required: false }
  ],
  default: [
    { category: "sofas", label: "anchor seating", quantity: 1, required: true },
    { category: "armchairs", label: "accent chairs", quantity: 2, required: false },
    { category: "coffee_tables", label: "coffee table", quantity: 1, required: false },
    { category: "rugs", label: "rug", quantity: 1, required: false },
    { category: "lighting", label: "lighting", quantity: 1, required: false },
    { category: "decor", label: "decor accent", quantity: 2, required: false }
  ]
};

export function rankProductMatches(request: ProductMatchRequest): RankedProductMatch[] {
  const parsed = productMatchRequestSchema.parse(request);
  const conceptTokens = tokensFor(`${parsed.roomType} ${parsed.conceptText}`);
  const preferredCategories = categoriesForRoom(parsed.roomType);

  return parsed.candidates
    .filter((candidate) => isEligibleCandidate(candidate, preferredCategories, parsed))
    .map((candidate) => scoreCandidate(candidate, conceptTokens, preferredCategories, parsed))
    .sort((left, right) => right.score - left.score)
    .map((match, index) => ({ ...match, score: Number((match.score - index * 0.001).toFixed(3)) }));
}

function isEligibleCandidate(
  candidate: ProductMatchCandidate,
  preferredCategories: string[],
  request: ProductMatchRequest
) {
  if (!candidate.primaryImageUrl) {
    return false;
  }

  if (!candidate.categoryNormalized || !preferredCategories.includes(candidate.categoryNormalized)) {
    return false;
  }

  const availability = candidate.availability?.toLowerCase() ?? "";
  if (
    availability.includes("out of stock") ||
    availability.includes("sold out") ||
    availability.includes("unavailable")
  ) {
    return false;
  }

  const effectivePrice = candidate.salePriceAed ?? candidate.priceAed;
  if (effectivePrice !== null && request.budgetMaxAed && effectivePrice > request.budgetMaxAed) {
    return false;
  }

  return true;
}

export function composeRoomProductSet({
  ranked,
  roomType,
  desiredRoles,
  limit = 12
}: {
  ranked: RankedProductMatch[];
  roomType: string;
  desiredRoles?: RoomProductRole[];
  limit?: number;
}) {
  const roles = normalizeDesiredRoles(desiredRoles).concat(
    productRolesForRoom(roomType).filter(
      (role) => !normalizeDesiredRoles(desiredRoles).some((desired) => desired.category === role.category)
    )
  );
  const allowedCategories = new Set(categoriesForRoom(roomType));
  const selected: RankedProductMatch[] = [];
  const selectedIds = new Set<string>();

  for (const role of roles) {
    const match = ranked.find(
      (candidate) => candidate.categoryNormalized === role.category && !selectedIds.has(candidate.id)
    );

    if (!match) {
      continue;
    }

    selected.push({
      ...match,
      selectionReason: [
        `room role: ${role.label}`,
        role.visualBrief ? `concept cue: ${role.visualBrief}` : null,
        match.selectionReason
      ]
        .filter(Boolean)
        .join("; ")
    });
    selectedIds.add(match.id);

    if (selected.length >= limit) {
      return selected;
    }
  }

  const categoryCounts = new Map<string, number>();
  for (const match of selected) {
    categoryCounts.set(match.categoryNormalized ?? "uncategorized", 1);
  }

  for (const match of ranked) {
    if (selectedIds.has(match.id)) {
      continue;
    }

    const category = match.categoryNormalized ?? "uncategorized";
    if (!allowedCategories.has(category)) {
      continue;
    }

    const existingCount = categoryCounts.get(category) ?? 0;
    if (existingCount >= 2) {
      continue;
    }

    selected.push(match);
    selectedIds.add(match.id);
    categoryCounts.set(category, existingCount + 1);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

function normalizeDesiredRoles(roles: RoomProductRole[] | undefined) {
  return (roles ?? [])
    .filter((role) => role.category && role.label)
    .map((role) => ({
      ...role,
      quantity: Math.max(1, Math.min(role.quantity || 1, 12))
    }));
}

export function productRolesForRoom(roomType: string) {
  const lower = roomType.toLowerCase();
  const match = Object.entries(roomProductRoles).find(([key]) => lower.includes(key));
  return match?.[1] ?? roomProductRoles.default;
}

export function quantityForProductCategory(roomType: string, category: string | null) {
  if (!category) {
    return 1;
  }

  return productRolesForRoom(roomType).find((role) => role.category === category)?.quantity ?? 1;
}

export function filterSubstitutionCandidates({
  current,
  candidates,
  mode,
  selectedProductIds = []
}: {
  current: ProductMatchCandidate;
  candidates: ProductMatchCandidate[];
  mode: SubstitutionMode;
  selectedProductIds?: string[];
}) {
  const selected = new Set(selectedProductIds.filter((id) => id !== current.id));
  const currentPrice = current.salePriceAed ?? current.priceAed;

  return candidates.filter((candidate) => {
    if (candidate.id === current.id || selected.has(candidate.id)) {
      return false;
    }

    if (candidate.categoryNormalized !== current.categoryNormalized) {
      return false;
    }

    if (mode === "cheaper") {
      const candidatePrice = candidate.salePriceAed ?? candidate.priceAed;
      return currentPrice !== null && candidatePrice !== null && candidatePrice < currentPrice;
    }

    if (mode === "same_retailer") {
      return candidate.retailerName === current.retailerName;
    }

    if (mode === "in_stock") {
      return Boolean(candidate.availability?.toLowerCase().includes("in stock"));
    }

    return true;
  });
}

function scoreCandidate(
  candidate: ProductMatchCandidate,
  conceptTokens: Set<string>,
  preferredCategories: string[],
  request: ProductMatchRequest
): RankedProductMatch {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (candidate.categoryNormalized && preferredCategories.includes(candidate.categoryNormalized)) {
    score += 28;
    reasons.push(`category fits ${request.roomType}`);
  }

  const tagMatches = allTags(candidate).filter((tag) => conceptTokens.has(tag));
  if (tagMatches.length > 0) {
    score += Math.min(tagMatches.length * 8, 32);
    reasons.push(`matches ${tagMatches.slice(0, 3).join(", ")}`);
  }

  if (candidate.primaryImageUrl) {
    score += 8;
  } else {
    warnings.push("Product image missing.");
  }

  const effectivePrice = candidate.salePriceAed ?? candidate.priceAed;
  if (effectivePrice !== null && request.budgetMaxAed) {
    if (effectivePrice <= request.budgetMaxAed) {
      score += 12;
      reasons.push("within stated budget");
    } else {
      score -= 12;
      warnings.push("Above the stated project budget.");
    }
  }

  if (candidate.availability?.toLowerCase().includes("in stock")) {
    score += 8;
  } else if (candidate.availability) {
    warnings.push(`Availability: ${candidate.availability}.`);
  } else {
    warnings.push("Availability not available.");
  }

  const dimensionFitNote = dimensionNote(candidate, request);
  if (dimensionFitNote?.startsWith("verified")) {
    score += 8;
  } else if (dimensionFitNote) {
    warnings.push(dimensionFitNote);
  }

  if (isStale(candidate.lastCheckedAt)) {
    warnings.push("Price or stock may be stale; recheck retailer page before client delivery.");
  }

  return {
    ...candidate,
    score,
    selectionReason: reasons.length > 0 ? reasons.join("; ") : "Closest available catalog match.",
    dimensionFitNote,
    warnings
  };
}

function categoriesForRoom(roomType: string) {
  const lower = roomType.toLowerCase();
  const match = Object.entries(roomCategoryHints).find(([key]) => lower.includes(key));
  return match?.[1] ?? roomCategoryHints.default;
}

function allTags(candidate: ProductMatchCandidate) {
  return [
    candidate.categoryNormalized,
    candidate.color,
    candidate.material,
    ...candidate.styleTags,
    ...candidate.colorTags,
    ...candidate.materialTags,
    ...candidate.roomTags
  ]
    .filter(Boolean)
    .flatMap((value) => Array.from(tokensFor(String(value))));
}

function tokensFor(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3)
  );
}

function dimensionNote(candidate: ProductMatchCandidate, request: ProductMatchRequest) {
  if (!candidate.dimensions?.widthCm && !candidate.dimensions?.depthCm) {
    return "Dimensions missing; fit is assumed until checked.";
  }

  const measurements = request.roomMeasurements;
  if (!measurements?.wallLengthCm && !measurements?.roomDepthCm) {
    return "Product dimensions available, but room measurements are missing.";
  }

  const widthFits =
    !candidate.dimensions.widthCm ||
    !measurements.wallLengthCm ||
    candidate.dimensions.widthCm <= measurements.wallLengthCm;
  const depthFits =
    !candidate.dimensions.depthCm ||
    !measurements.roomDepthCm ||
    candidate.dimensions.depthCm <= measurements.roomDepthCm;

  if (widthFits && depthFits) {
    return "estimated fit against entered room measurements; designer review required.";
  }

  return "May not fit entered room measurements; designer review required.";
}

function isStale(value: string | null) {
  if (!value) {
    return true;
  }

  const checkedAt = new Date(value).getTime();
  if (!Number.isFinite(checkedAt)) {
    return true;
  }

  return Date.now() - checkedAt > 1000 * 60 * 60 * 24 * 7;
}
