import type { ProductMatchCandidate } from "./product-matching";

export type ProductMatchEvidenceCompletenessStatus = "complete" | "partial" | "weak";

export type ProductMatchEvidenceCompleteness = {
  status: ProductMatchEvidenceCompletenessStatus;
  presentCount: number;
  missingCount: number;
  checks: {
    hasCanonicalUrl: boolean;
    hasPrimaryImage: boolean;
    hasPrice: boolean;
    hasAvailability: boolean;
    hasColorSignal: boolean;
    hasMaterialSignal: boolean;
    hasStyleOrRoomSignal: boolean;
    hasDimensions: boolean;
  };
  warnings: string[];
};

export function classifyProductMatchEvidenceCompleteness(
  candidate: Pick<
    ProductMatchCandidate,
    | "canonicalUrl"
    | "primaryImageUrl"
    | "priceAed"
    | "salePriceAed"
    | "availability"
    | "color"
    | "colorTags"
    | "material"
    | "materialTags"
    | "styleTags"
    | "roomTags"
    | "dimensions"
  >
): ProductMatchEvidenceCompleteness {
  const checks = {
    hasCanonicalUrl: hasText(candidate.canonicalUrl),
    hasPrimaryImage: hasText(candidate.primaryImageUrl),
    hasPrice: candidate.priceAed !== null || candidate.salePriceAed !== null,
    hasAvailability: hasText(candidate.availability),
    hasColorSignal: hasText(candidate.color) || candidate.colorTags.length > 0,
    hasMaterialSignal: hasText(candidate.material) || candidate.materialTags.length > 0,
    hasStyleOrRoomSignal: candidate.styleTags.length > 0 || candidate.roomTags.length > 0,
    hasDimensions: Boolean(candidate.dimensions?.widthCm && candidate.dimensions?.depthCm)
  };
  const missing = Object.entries(checks)
    .filter(([, present]) => !present)
    .map(([key]) => key);
  const presentCount = Object.keys(checks).length - missing.length;

  return {
    status: evidenceStatus(presentCount),
    presentCount,
    missingCount: missing.length,
    checks,
    warnings: missing.map((key) => evidenceWarningFor(key))
  };
}

function evidenceStatus(presentCount: number): ProductMatchEvidenceCompletenessStatus {
  if (presentCount === 8) {
    return "complete";
  }

  if (presentCount >= 6) {
    return "partial";
  }

  return "weak";
}

function hasText(value: string | null) {
  return Boolean(value?.trim());
}

function evidenceWarningFor(key: string) {
  const warnings: Record<string, string> = {
    hasCanonicalUrl: "Canonical retailer URL is missing.",
    hasPrimaryImage: "Primary image URL is missing.",
    hasPrice: "Price is missing.",
    hasAvailability: "Availability text is missing.",
    hasColorSignal: "Color evidence is missing.",
    hasMaterialSignal: "Material evidence is missing.",
    hasStyleOrRoomSignal: "Style or room evidence is missing.",
    hasDimensions: "Dimension evidence is missing."
  };

  return warnings[key] ?? `${key} evidence is missing.`;
}
