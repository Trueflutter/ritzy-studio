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

const roomCategoryHints: Record<string, string[]> = {
  living: ["sofas", "armchairs", "coffee_tables", "side_tables", "rugs", "lighting"],
  bedroom: ["beds", "side_tables", "rugs", "lighting"],
  dining: ["dining_tables", "chairs", "lighting", "rugs"],
  bathroom: ["mirrors", "lighting"],
  default: ["sofas", "armchairs", "coffee_tables", "side_tables", "rugs", "lighting"]
};

export function rankProductMatches(request: ProductMatchRequest): RankedProductMatch[] {
  const parsed = productMatchRequestSchema.parse(request);
  const conceptTokens = tokensFor(`${parsed.roomType} ${parsed.conceptText}`);
  const preferredCategories = categoriesForRoom(parsed.roomType);

  return parsed.candidates
    .map((candidate) => scoreCandidate(candidate, conceptTokens, preferredCategories, parsed))
    .sort((left, right) => right.score - left.score)
    .map((match, index) => ({ ...match, score: Number((match.score - index * 0.001).toFixed(3)) }));
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
    return "verified against entered room measurements";
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
