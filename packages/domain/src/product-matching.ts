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

export type ProductRoleImportance = "anchor" | "supporting" | "styling";
export type ProductRoleInclusion = "always" | "space_allows" | "catalog_supports" | "brief_mentions";

export type EnhancedRoomProductRole = RoomProductRole & {
  importance: ProductRoleImportance;
  includeWhen: ProductRoleInclusion;
};

export type ProductRenderReferenceCandidate = {
  category: string | null;
  roleLabel?: string | null;
  role_label?: string | null;
  selectionReason?: string | null;
  selection_reason?: string | null;
};

export const substitutionModeSchema = z.enum(["cheaper", "closer_style", "same_retailer", "in_stock"]);
export type SubstitutionMode = z.infer<typeof substitutionModeSchema>;

const colorFamilies: Record<string, string[]> = {
  black: ["black", "charcoal", "graphite", "onyx"],
  blue: ["blue", "navy", "indigo", "denim"],
  brown: ["brown", "cognac", "tan", "camel", "chocolate", "walnut", "espresso"],
  cream: ["cream", "ivory", "beige", "linen", "oatmeal", "sand", "taupe", "ecru"],
  green: ["green", "olive", "sage", "moss", "forest", "khaki"],
  grey: ["grey", "gray", "charcoal", "slate"],
  red: ["red", "burgundy", "terracotta", "rust"],
  white: ["white", "ivory", "cream"]
};

const materialFamilies: Record<string, string[]> = {
  boucle: ["boucle", "teddy"],
  brass: ["brass", "gold"],
  fabric: ["fabric", "upholstered", "textile", "chenille"],
  glass: ["glass"],
  leather: ["leather", "suede"],
  linen: ["linen"],
  marble: ["marble", "stone", "travertine"],
  metal: ["metal", "steel", "iron"],
  velvet: ["velvet", "velour"],
  wood: ["wood", "walnut", "oak", "ash", "teak"]
};

const ignoredMatchTokens = new Set([
  "and",
  "are",
  "for",
  "from",
  "has",
  "that",
  "the",
  "this",
  "use",
  "with"
]);

const roomCategoryHints: Record<string, string[]> = {
  living: [
    "sofas",
    "armchairs",
    "coffee_tables",
    "side_tables",
    "rugs",
    "storage",
    "lighting",
    "wall_art",
    "mirrors",
    "decor"
  ],
  bedroom: ["beds", "side_tables", "rugs", "lighting", "wall_art", "decor"],
  dining: [
    "dining_tables",
    "chairs",
    "armchairs",
    "storage",
    "rugs",
    "lighting",
    "wall_art",
    "mirrors",
    "decor"
  ],
  bathroom: ["mirrors", "lighting", "decor"],
  office: ["desks", "office_chairs", "chairs", "storage", "lighting", "rugs", "wall_art", "decor"],
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

const enhancedRoomProductRoles: Record<string, EnhancedRoomProductRole[]> = {
  living: [
    { category: "sofas", label: "anchor seating", quantity: 1, required: true, importance: "anchor", includeWhen: "always" },
    { category: "armchairs", label: "secondary seating", quantity: 2, required: false, importance: "anchor", includeWhen: "space_allows" },
    { category: "coffee_tables", label: "coffee table", quantity: 1, required: true, importance: "anchor", includeWhen: "always" },
    { category: "rugs", label: "generous rug", quantity: 1, required: true, importance: "anchor", includeWhen: "always" },
    { category: "side_tables", label: "side or end tables", quantity: 1, required: false, importance: "supporting", includeWhen: "space_allows" },
    { category: "lighting", label: "floor or table lighting", quantity: 1, required: false, importance: "supporting", includeWhen: "catalog_supports" },
    { category: "wall_art", label: "wall art or focal wall", quantity: 1, required: false, importance: "supporting", includeWhen: "catalog_supports" },
    { category: "mirrors", label: "mirror", quantity: 1, required: false, importance: "supporting", includeWhen: "brief_mentions" },
    { category: "curtains", label: "curtains or textile layer", quantity: 1, required: false, importance: "styling", includeWhen: "catalog_supports" },
    { category: "decor", label: "cushions, tray, ceramics, and decor", quantity: 2, required: false, importance: "styling", includeWhen: "catalog_supports" },
    { category: "storage", label: "TV media console or built-in media unit", quantity: 1, required: false, importance: "supporting", includeWhen: "catalog_supports" }
  ],
  dining: [
    { category: "dining_tables", label: "dining table", quantity: 1, required: true, importance: "anchor", includeWhen: "always" },
    { category: "chairs", label: "dining chairs", quantity: 6, required: true, importance: "anchor", includeWhen: "always" },
    { category: "lighting", label: "over-table lighting", quantity: 1, required: false, importance: "anchor", includeWhen: "catalog_supports" },
    { category: "storage", label: "sideboard, credenza, or dining console", quantity: 1, required: false, importance: "supporting", includeWhen: "catalog_supports" },
    { category: "rugs", label: "dining rug", quantity: 1, required: false, importance: "supporting", includeWhen: "space_allows" },
    { category: "wall_art", label: "art or mirror", quantity: 1, required: false, importance: "supporting", includeWhen: "catalog_supports" },
    { category: "mirrors", label: "mirror", quantity: 1, required: false, importance: "supporting", includeWhen: "catalog_supports" },
    { category: "decor", label: "restrained table decor", quantity: 2, required: false, importance: "styling", includeWhen: "catalog_supports" },
    { category: "curtains", label: "curtains or textile layer", quantity: 1, required: false, importance: "styling", includeWhen: "catalog_supports" }
  ],
  bedroom: [
    { category: "beds", label: "bed or bed frame", quantity: 1, required: true, importance: "anchor", includeWhen: "always" },
    { category: "headboards", label: "headboard", quantity: 1, required: false, importance: "anchor", includeWhen: "catalog_supports" },
    { category: "side_tables", label: "bedside tables", quantity: 2, required: true, importance: "anchor", includeWhen: "always" },
    { category: "lighting", label: "bedside lighting", quantity: 2, required: false, importance: "supporting", includeWhen: "catalog_supports" },
    { category: "rugs", label: "bedroom rug", quantity: 1, required: false, importance: "supporting", includeWhen: "space_allows" },
    { category: "bedding", label: "bedding and textile layer", quantity: 1, required: false, importance: "styling", includeWhen: "catalog_supports" },
    { category: "curtains", label: "curtains or window treatment", quantity: 1, required: false, importance: "styling", includeWhen: "catalog_supports" },
    { category: "wall_art", label: "wall art or mirror", quantity: 1, required: false, importance: "supporting", includeWhen: "catalog_supports" },
    { category: "decor", label: "books, ceramics, and restrained decor", quantity: 2, required: false, importance: "styling", includeWhen: "catalog_supports" }
  ],
  bathroom: [
    { category: "mirrors", label: "mirror or medicine cabinet", quantity: 1, required: true, importance: "anchor", includeWhen: "always" },
    { category: "lighting", label: "vanity lighting or sconces", quantity: 1, required: false, importance: "supporting", includeWhen: "catalog_supports" },
    { category: "towels", label: "towels or bath mat", quantity: 2, required: false, importance: "styling", includeWhen: "catalog_supports" },
    { category: "decor", label: "tray, vessel, plant, or decor", quantity: 1, required: false, importance: "styling", includeWhen: "catalog_supports" },
    { category: "stools", label: "stool or bench", quantity: 1, required: false, importance: "supporting", includeWhen: "space_allows" }
  ],
  office: [
    { category: "desks", label: "desk", quantity: 1, required: true, importance: "anchor", includeWhen: "always" },
    { category: "office_chairs", label: "ergonomic task chair", quantity: 1, required: true, importance: "anchor", includeWhen: "always" },
    { category: "storage", label: "storage, shelving, or credenza", quantity: 1, required: false, importance: "supporting", includeWhen: "catalog_supports" },
    { category: "lighting", label: "task lamp or layered lighting", quantity: 1, required: false, importance: "supporting", includeWhen: "catalog_supports" },
    { category: "rugs", label: "rug or textile layer", quantity: 1, required: false, importance: "supporting", includeWhen: "space_allows" },
    { category: "wall_art", label: "art, pinboard, or styled background", quantity: 1, required: false, importance: "supporting", includeWhen: "catalog_supports" },
    { category: "decor", label: "organized desk decor", quantity: 1, required: false, importance: "styling", includeWhen: "catalog_supports" }
  ],
  default: [
    { category: "sofas", label: "anchor furniture", quantity: 1, required: true, importance: "anchor", includeWhen: "always" },
    { category: "rugs", label: "rug or textile foundation", quantity: 1, required: false, importance: "supporting", includeWhen: "space_allows" },
    { category: "lighting", label: "lighting", quantity: 1, required: false, importance: "supporting", includeWhen: "catalog_supports" },
    { category: "wall_art", label: "art or mirror", quantity: 1, required: false, importance: "supporting", includeWhen: "catalog_supports" },
    { category: "decor", label: "restrained decor", quantity: 2, required: false, importance: "styling", includeWhen: "catalog_supports" }
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

export function enhancedProductRolesForRoom(roomType: string) {
  const match = enhancedRoomProductRoles[enhancedRoomRoleKey(roomType)];
  return match ?? enhancedRoomProductRoles.default;
}

export function renderReferencePriorityForProduct(
  product: ProductRenderReferenceCandidate,
  roomType: string
) {
  const category = product.category ?? "";
  const roleText = `${product.roleLabel ?? product.role_label ?? ""} ${
    product.selectionReason ?? product.selection_reason ?? ""
  }`.toLowerCase();
  const enhancedRole = enhancedProductRolesForRoom(roomType).find((role) => role.category === category);

  let priority =
    enhancedRole?.importance === "anchor" ? 0 : enhancedRole?.importance === "supporting" ? 20 : 40;

  if (roleText.includes("anchor") || roleText.includes("required")) {
    priority -= 5;
  }

  if (roleText.includes("decor") || roleText.includes("styling")) {
    priority += 8;
  }

  return Math.max(0, priority + categoryPriority(category));
}

export function sortProductsForRenderReferences<T extends ProductRenderReferenceCandidate>(
  products: ReadonlyArray<T>,
  roomType: string
): T[] {
  return products
    .map((product, index) => ({
      product,
      index,
      priority: renderReferencePriorityForProduct(product, roomType)
    }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ product }) => product);
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

function categoryPriority(category: string) {
  const priorityByCategory: Record<string, number> = {
    sofas: 0,
    beds: 0,
    dining_tables: 0,
    coffee_tables: 2,
    chairs: 2,
    armchairs: 2,
    rugs: 4,
    side_tables: 6,
    headboards: 6,
    mirrors: 8,
    storage: 8,
    lighting: 10,
    wall_art: 12,
    curtains: 14,
    bedding: 14,
    towels: 16,
    stools: 16,
    decor: 20
  };

  return priorityByCategory[category] ?? 30;
}

function enhancedRoomRoleKey(roomType: string) {
  const lower = roomType.toLowerCase();

  if (lower.includes("living") || lower.includes("lounge") || lower.includes("family")) {
    return "living";
  }

  if (lower.includes("dining")) {
    return "dining";
  }

  if (lower.includes("bed") || lower.includes("primary suite")) {
    return "bedroom";
  }

  if (lower.includes("office") || lower.includes("study") || lower.includes("workspace")) {
    return "office";
  }

  if (
    lower.includes("bath") ||
    lower.includes("powder") ||
    lower.includes("ensuite") ||
    lower.includes("washroom") ||
    lower.includes("wc")
  ) {
    return "bathroom";
  }

  return "default";
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

function familiesInText(tokens: Set<string>, families: Record<string, string[]>) {
  return Object.entries(families)
    .filter(([, terms]) => terms.some((term) => tokens.has(term)))
    .map(([family]) => family);
}

function roleVisualAffinity(candidate: ProductMatchCandidate, visualBrief: string | null | undefined) {
  if (!visualBrief) {
    return 0;
  }

  const roleTokens = tokensFor(visualBrief);
  const candidateTokens = new Set(allTags(candidate));
  const tagMatches = Array.from(candidateTokens).filter((tag) => roleTokens.has(tag));
  let score = Math.min(tagMatches.length * 6, 30);

  const requestedColorFamilies = familiesInText(roleTokens, colorFamilies);
  if (requestedColorFamilies.length > 0) {
    const candidateColorFamilies = familiesInText(candidateTokens, colorFamilies);
    const hasColorMatch = candidateColorFamilies.some((family) => requestedColorFamilies.includes(family));

    if (hasColorMatch) {
      score += 28;
    } else if (candidateColorFamilies.length > 0) {
      score -= 24;
    }
  }

  const requestedMaterialFamilies = familiesInText(roleTokens, materialFamilies);
  if (requestedMaterialFamilies.length > 0) {
    const candidateMaterialFamilies = familiesInText(candidateTokens, materialFamilies);
    const hasMaterialMatch = candidateMaterialFamilies.some((family) =>
      requestedMaterialFamilies.includes(family)
    );

    if (hasMaterialMatch) {
      score += 18;
    } else if (candidateMaterialFamilies.length > 0) {
      score -= 12;
    }
  }

  return score;
}

function tokensFor(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !ignoredMatchTokens.has(token))
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

// --- Room roles as option pools -------------------------------------------
// A sourced shopping list is a pool of ranked options grouped by room role.
// Each role offers a few candidates; one is the selected pick.

export type RoomProductRoleSpec = {
  category: string;
  label: string;
  visualBrief: string | null;
  quantity: number;
  priority: "required" | "supporting";
};

export type RoleProductOptions = RoomProductRoleSpec & {
  options: RankedProductMatch[];
};

export type ProductRoleAttributeScore = {
  category: number;
  color: number;
  material: number;
  style: number;
  silhouette: number;
  roleFit: number;
  total: number;
  reasons: string[];
  weaknessReasons: string[];
  requestedColorFamilies: string[];
  candidateColorFamilies: string[];
  requestedMaterialFamilies: string[];
  candidateMaterialFamilies: string[];
};

export type RoleScopedRankedProductMatch = RankedProductMatch & {
  attributeScore: ProductRoleAttributeScore;
};

export type RoleScopedCandidatePool = {
  role: RoomProductRoleSpec;
  candidates: RoleScopedRankedProductMatch[];
  candidateCount: number;
  rejectedCount: number;
  rejectionReasons: Record<string, number>;
  weaknessReasons: string[];
};

export type RoleScopedRetrievalResult = {
  roomType: string;
  pools: RoleScopedCandidatePool[];
  totalCandidateCount: number;
};

export type ProductSourcingRuntimePlan = {
  engineEnabled: boolean;
  candidates: RankedProductMatch[] | RoleScopedRankedProductMatch[];
  roleScopedPools: RoleScopedCandidatePool[];
};

export type ShoppingListItemStatus = "option" | "selected" | "rejected";

export type ShoppingListItemDraft = {
  product_id: string;
  category: string;
  status: ShoppingListItemStatus;
  role_label: string;
  role_visual_brief: string | null;
  role_priority: "required" | "supporting";
  role_quantity: number;
  option_rank: number;
  quantity: number;
  unit_price_aed: number;
  line_total_aed: number;
  selection_reason: string;
  dimension_fit_note: string | null;
  sort_order: number;
};

export type ShoppingItemRoleFields = {
  id: string;
  status: string;
  category: string;
  role_label: string;
  role_priority: string;
  role_quantity: number;
  option_rank: number;
};

export type ShoppingRoleGroup<T> = {
  category: string;
  label: string;
  priority: "required" | "supporting";
  quantity: number;
  selectedId: string | null;
  options: T[];
};

// Take the top `optionsPerRole` ranked candidates for each role's category.
// A product is offered under one role only, so distinct roles never collide.
export function composeRoomProductOptions({
  ranked,
  roles,
  optionsPerRole = 3
}: {
  ranked: RankedProductMatch[];
  roles: RoomProductRoleSpec[];
  optionsPerRole?: number;
}): RoleProductOptions[] {
  const perRole = Math.max(1, optionsPerRole);
  const used = new Set<string>();
  const result: RoleProductOptions[] = [];

  for (const role of roles) {
    const options: RankedProductMatch[] = [];
    const acceptedCategories = categoriesForRole(role.category);
    const categoryMatches = ranked
      .map((match, index) => ({
        match,
        index,
        affinity:
          roleVisualAffinity(match, role.visualBrief) +
          (match.categoryNormalized === role.category ? 0 : -18)
      }))
      .filter(({ match }) => Boolean(match.categoryNormalized && acceptedCategories.has(match.categoryNormalized)))
      .sort(
        (left, right) =>
          right.match.score + right.affinity - (left.match.score + left.affinity) ||
          left.index - right.index
      );

    for (const { affinity, match } of diverseRoleMatches(categoryMatches, perRole)) {
      if (used.has(match.id) || !match.categoryNormalized || !acceptedCategories.has(match.categoryNormalized)) {
        continue;
      }
      options.push(
        affinity === 0
          ? match
          : {
              ...match,
              score: Number((match.score + affinity).toFixed(3)),
              selectionReason: [
                match.selectionReason,
                affinity > 0
                  ? `closer to role brief: ${role.visualBrief}`
                  : `role brief mismatch: ${role.visualBrief}`
              ].join("; ")
            }
      );
      used.add(match.id);
      if (options.length >= perRole) {
        break;
      }
    }
    if (options.length > 0) {
      result.push({ ...role, options });
    }
  }

  return result;
}

export function buildRoleScopedCandidatePools({
  roomType,
  conceptText,
  roles,
  candidates,
  budgetMaxAed = null,
  roomMeasurements = null,
  candidatesPerRole = 8
}: {
  roomType: string;
  conceptText: string;
  roles?: RoomProductRoleSpec[];
  candidates: ProductMatchCandidate[];
  budgetMaxAed?: number | null;
  roomMeasurements?: ProductMatchRequest["roomMeasurements"];
  candidatesPerRole?: number;
}): RoleScopedRetrievalResult {
  const parsed = productMatchRequestSchema.parse({
    roomType,
    conceptText,
    budgetMaxAed,
    roomMeasurements,
    candidates
  });
  const scopedRoles = roles ?? defaultRoleSpecsForRoom(parsed.roomType);
  const preferredCategories = categoriesForRoom(parsed.roomType);
  const limit = Math.max(1, candidatesPerRole);

  return {
    roomType: parsed.roomType,
    totalCandidateCount: parsed.candidates.length,
    pools: scopedRoles.map((role) =>
      buildRolePool({
        role,
        request: parsed,
        preferredCategories,
        candidatesPerRole: limit
      })
    )
  };
}

export function buildProductSourcingRuntimePlan({
  engineEnabled,
  roomType,
  conceptText,
  roles,
  candidates,
  budgetMaxAed = null,
  roomMeasurements = null,
  candidatesPerRole = 6,
  flatCandidateLimit = 36
}: {
  engineEnabled: boolean;
  roomType: string;
  conceptText: string;
  roles: RoomProductRoleSpec[];
  candidates: ProductMatchCandidate[];
  budgetMaxAed?: number | null;
  roomMeasurements?: ProductMatchRequest["roomMeasurements"];
  candidatesPerRole?: number;
  flatCandidateLimit?: number;
}): ProductSourcingRuntimePlan {
  if (engineEnabled) {
    const roleScopedPools = buildRoleScopedCandidatePools({
      roomType,
      conceptText,
      roles,
      candidates,
      budgetMaxAed,
      roomMeasurements,
      candidatesPerRole
    }).pools;

    return {
      engineEnabled: true,
      candidates: roleScopedCandidatesForPlan(roleScopedPools, flatCandidateLimit),
      roleScopedPools
    };
  }

  const ranked = rankProductMatches({
    roomType,
    conceptText,
    budgetMaxAed,
    roomMeasurements,
    candidates
  });

  return {
    engineEnabled: false,
    candidates: flatSourcingCandidates(ranked, roles, flatCandidateLimit),
    roleScopedPools: []
  };
}

function roleScopedCandidatesForPlan(pools: RoleScopedCandidatePool[], limit: number) {
  const selectedIds = new Set<string>();
  const selected: RoleScopedRankedProductMatch[] = [];

  for (const pool of pools) {
    for (const match of pool.candidates) {
      if (selectedIds.has(match.id)) {
        continue;
      }
      selected.push(match);
      selectedIds.add(match.id);
    }
  }

  return selected.slice(0, limit);
}

function flatSourcingCandidates(ranked: RankedProductMatch[], roles: RoomProductRoleSpec[], limit: number) {
  const byCategory = new Map<string, RankedProductMatch[]>();
  const selectedIds = new Set<string>();
  const selected: RankedProductMatch[] = [];

  for (const match of ranked) {
    const category = match.categoryNormalized ?? "uncategorized";
    const categoryMatches = byCategory.get(category) ?? [];
    if (categoryMatches.length < 6) {
      categoryMatches.push(match);
      byCategory.set(category, categoryMatches);
    }
  }

  for (const role of roles) {
    const categoryMatches = byCategory.get(role.category) ?? [];
    const take = role.priority === "required" ? 4 : 2;
    for (const match of categoryMatches.slice(0, take)) {
      if (selectedIds.has(match.id)) {
        continue;
      }
      selected.push(match);
      selectedIds.add(match.id);
    }
  }

  const fill = Array.from(byCategory.values())
    .flat()
    .sort((left, right) => right.score - left.score)
    .filter((match) => !selectedIds.has(match.id));

  return [...selected, ...fill].slice(0, limit);
}

function buildRolePool({
  role,
  request,
  preferredCategories,
  candidatesPerRole
}: {
  role: RoomProductRoleSpec;
  request: ProductMatchRequest;
  preferredCategories: string[];
  candidatesPerRole: number;
}): RoleScopedCandidatePool {
  const scored: Array<{ match: RoleScopedRankedProductMatch; roleScore: number; weaknesses: string[] }> = [];
  const rejectionReasons: Record<string, number> = {};

  for (const candidate of request.candidates) {
    const rejectionReason = roleGateRejectionReason(candidate, role, request);
    if (rejectionReason) {
      rejectionReasons[rejectionReason] = (rejectionReasons[rejectionReason] ?? 0) + 1;
      continue;
    }

    const baseMatch = scoreCandidate(candidate, tokensFor(`${request.roomType} ${request.conceptText}`), preferredCategories, request);
    const fit = scoreProductCandidateForRole({ candidate, role, conceptText: request.conceptText });
    scored.push({
      match: {
        ...baseMatch,
        score: Number((baseMatch.score + fit.total).toFixed(3)),
        selectionReason: [baseMatch.selectionReason, ...fit.reasons].join("; "),
        attributeScore: fit
      },
      roleScore: fit.total,
      weaknesses: fit.weaknessReasons
    });
  }

  const candidates = scored
    .sort((left, right) => right.match.score - left.match.score || right.roleScore - left.roleScore)
    .slice(0, candidatesPerRole)
    .map(({ match }, index) => ({ ...match, score: Number((match.score - index * 0.001).toFixed(3)) }));

  return {
    role,
    candidates,
    candidateCount: candidates.length,
    rejectedCount: Object.values(rejectionReasons).reduce((total, count) => total + count, 0),
    rejectionReasons,
    weaknessReasons: Array.from(new Set(scored.flatMap(({ weaknesses }) => weaknesses)))
  };
}

function defaultRoleSpecsForRoom(roomType: string): RoomProductRoleSpec[] {
  return enhancedProductRolesForRoom(roomType).map((role) => ({
    category: role.category,
    label: role.label,
    visualBrief: role.visualBrief ?? null,
    quantity: role.quantity,
    priority: role.required ? "required" : "supporting"
  }));
}

function roleGateRejectionReason(
  candidate: ProductMatchCandidate,
  role: RoomProductRoleSpec,
  request: ProductMatchRequest
) {
  if (!candidate.primaryImageUrl) {
    return "missing_image";
  }

  if (!candidate.categoryNormalized || !categoriesForScopedRole(role).has(candidate.categoryNormalized)) {
    return "category_mismatch";
  }

  const availability = candidate.availability?.toLowerCase() ?? "";
  if (
    availability.includes("out of stock") ||
    availability.includes("sold out") ||
    availability.includes("unavailable")
  ) {
    return "unavailable";
  }

  const effectivePrice = candidate.salePriceAed ?? candidate.priceAed;
  if (effectivePrice !== null && request.budgetMaxAed && effectivePrice > request.budgetMaxAed) {
    return "over_budget";
  }

  return null;
}

export function scoreProductCandidateForRole({
  candidate,
  role,
  conceptText = ""
}: {
  candidate: ProductMatchCandidate;
  role: RoomProductRoleSpec;
  conceptText?: string;
}): ProductRoleAttributeScore {
  const roleTokens = tokensFor(attributeCueText(role, conceptText));
  const candidateTokens = candidateSearchTokens(candidate);
  const reasons: string[] = [];
  const weaknessReasons: string[] = [];
  let category = 0;
  let color = 0;
  let material = 0;
  let style = 0;
  let silhouette = 0;
  let roleFit = 0;

  if (candidate.categoryNormalized === role.category) {
    category = 48;
    reasons.push(`category matches role: ${role.label}`);
  } else if (candidate.categoryNormalized && categoriesForScopedRole(role).has(candidate.categoryNormalized)) {
    category = 12;
    weaknessReasons.push(`uses compatible fallback category ${candidate.categoryNormalized} for ${role.category}`);
  } else {
    category = -48;
    weaknessReasons.push(`category ${candidate.categoryNormalized ?? "uncategorized"} does not fit ${role.category}`);
  }

  const requestedColorFamilies = familiesInText(roleTokens, colorFamilies);
  const candidateColorFamilies = familiesInText(candidateTokens, colorFamilies);
  if (requestedColorFamilies.length > 0) {
    if (candidateColorFamilies.some((family) => requestedColorFamilies.includes(family))) {
      color = 34;
      reasons.push("color family matches role brief");
    } else if (candidateColorFamilies.length > 0) {
      color = -30;
      weaknessReasons.push("color family conflicts with role brief");
    }
  }

  const requestedMaterialFamilies = familiesInText(roleTokens, materialFamilies);
  const candidateMaterialFamilies = familiesInText(candidateTokens, materialFamilies);
  if (requestedMaterialFamilies.length > 0) {
    if (candidateMaterialFamilies.some((family) => requestedMaterialFamilies.includes(family))) {
      material = 20;
      reasons.push("material family matches role brief");
    } else if (candidateMaterialFamilies.length > 0) {
      material = -12;
      weaknessReasons.push("material family is weak for role brief");
    }
  }

  const styleMatches = candidate.styleTags
    .flatMap((tag) => Array.from(tokensFor(tag)))
    .filter((tag) => roleTokens.has(tag));
  if (styleMatches.length > 0) {
    style = Math.min(styleMatches.length * 8, 24);
    reasons.push(`style matches ${styleMatches.slice(0, 3).join(", ")}`);
  }

  const silhouetteScore = silhouetteAttributeScore(roleTokens, candidateTokens);
  silhouette = silhouetteScore.score;
  reasons.push(...silhouetteScore.reasons);
  weaknessReasons.push(...silhouetteScore.weaknessReasons);

  const roleKeywordScore = roleSpecificKeywordScore(role, candidateTokens);
  roleFit = roleKeywordScore.score;
  reasons.push(...roleKeywordScore.reasons);
  if (roleKeywordScore.weakness) {
    weaknessReasons.push(roleKeywordScore.weakness);
  }

  const total = category + color + material + style + silhouette + roleFit;

  return {
    category,
    color,
    material,
    style,
    silhouette,
    roleFit,
    total,
    reasons,
    weaknessReasons: Array.from(new Set(weaknessReasons)),
    requestedColorFamilies,
    candidateColorFamilies,
    requestedMaterialFamilies,
    candidateMaterialFamilies
  };
}

function roleSpecificKeywordScore(role: RoomProductRoleSpec, candidateTokens: Set<string>) {
  const roleText = `${role.category} ${role.label} ${role.visualBrief ?? ""}`.toLowerCase();
  const reasons: string[] = [];
  let score = 0;
  let weakness: string | null = null;

  if (role.category === "chairs" && roleText.includes("dining")) {
    if (hasAnyToken(candidateTokens, ["dining", "chair", "chairs"])) {
      score += 24;
      reasons.push("dining chair language matches role");
    }
    if (hasAnyToken(candidateTokens, ["armchair", "lounge", "recliner", "oversized", "bulky"])) {
      score -= 34;
      weakness = "bulky lounge seating is weak for dining chair role";
    }
  }

  if (role.category === "storage" && hasAnyToken(tokensFor(roleText), ["media", "console", "credenza", "sideboard", "shelving"])) {
    if (hasAnyToken(tokensFor(roleText), ["media", "console", "television"]) || roleText.includes("tv")) {
      if (hasAnyToken(candidateTokens, ["media", "console", "television"]) || candidateTokens.has("tv")) {
        score += 30;
        reasons.push("media storage language matches role");
      } else if (hasAnyToken(candidateTokens, ["bookcase", "bookcases", "bookshelf", "shelf", "shelving"])) {
        score -= 26;
        weakness = "generic shelving is weak for TV media role";
      }
    } else if (hasAnyToken(tokensFor(roleText), ["sideboard", "credenza"])) {
      if (hasAnyToken(candidateTokens, ["sideboard", "credenza", "console"])) {
        score += 24;
        reasons.push("dining storage language matches role");
      }
    } else if (hasAnyToken(tokensFor(roleText), ["shelving"])) {
      if (hasAnyToken(candidateTokens, ["shelf", "shelving", "bookcase", "storage", "credenza"])) {
        score += 18;
        reasons.push("office storage language matches role");
      }
    }
  }

  return { score, reasons, weakness };
}

function attributeCueText(role: RoomProductRoleSpec, conceptText: string) {
  const roleSpecificCue = [role.label, role.visualBrief].filter(Boolean).join(" ");
  return role.visualBrief ? roleSpecificCue : [conceptText, roleSpecificCue].filter(Boolean).join(" ");
}

function silhouetteAttributeScore(roleTokens: Set<string>, candidateTokens: Set<string>) {
  const silhouetteFamilies: Record<string, string[]> = {
    bulky: ["bulky", "oversized", "chunky", "deep"],
    low: ["low", "lowline", "lowprofile"],
    round: ["round", "curved", "oval"],
    slim: ["slim", "slender", "thin", "narrow"],
    tall: ["tall", "high", "bookcase", "shelving"],
    upholstered: ["upholstered", "padded", "tufted"]
  };
  const requested = familiesInText(roleTokens, silhouetteFamilies);
  const candidate = familiesInText(candidateTokens, silhouetteFamilies);
  const reasons: string[] = [];
  const weaknessReasons: string[] = [];

  if (requested.length === 0) {
    return { score: 0, reasons, weaknessReasons };
  }

  if (candidate.some((family) => requested.includes(family))) {
    reasons.push("silhouette language matches role brief");
    return { score: 14, reasons, weaknessReasons };
  }

  if (candidate.length > 0) {
    weaknessReasons.push("silhouette language conflicts with role brief");
    return { score: -10, reasons, weaknessReasons };
  }

  return { score: 0, reasons, weaknessReasons };
}

function candidateSearchTokens(candidate: ProductMatchCandidate) {
  return tokensFor(
    [
      candidate.name,
      candidate.categoryNormalized,
      candidate.color,
      candidate.material,
      ...candidate.styleTags,
      ...candidate.colorTags,
      ...candidate.materialTags,
      ...candidate.roomTags
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function hasAnyToken(tokens: Set<string>, values: string[]) {
  return values.some((value) => tokens.has(value));
}

function diverseRoleMatches(
  matches: Array<{ match: RankedProductMatch; index: number; affinity: number }>,
  limit: number
) {
  const selected: Array<{ match: RankedProductMatch; index: number; affinity: number }> = [];
  const seenSignatures = new Set<string>();
  const shortlist = matches.slice(0, Math.max(limit * 4, limit));

  for (const candidate of shortlist) {
    if (selected.length === 0) {
      selected.push(candidate);
      seenSignatures.add(diversitySignature(candidate.match));
      continue;
    }

    const signature = diversitySignature(candidate.match);
    if (seenSignatures.has(signature) && selected.length < Math.min(limit, 3)) {
      continue;
    }

    selected.push(candidate);
    seenSignatures.add(signature);

    if (selected.length >= limit) {
      return selected;
    }
  }

  for (const candidate of matches) {
    if (selected.some(({ match }) => match.id === candidate.match.id)) {
      continue;
    }

    selected.push(candidate);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

function diversitySignature(match: RankedProductMatch) {
  const price = match.salePriceAed ?? match.priceAed ?? 0;
  const priceBand = price < 1000 ? "low" : price < 3000 ? "mid" : "high";
  const color = match.colorTags[0] ?? match.color ?? "unknown-color";
  const material = match.materialTags[0] ?? match.material ?? "unknown-material";

  return `${match.categoryNormalized ?? "uncategorized"}:${priceBand}:${color}:${material}`;
}

function categoriesForRole(category: string) {
  const categories = new Set([category]);

  if (category === "chairs") {
    categories.add("armchairs");
  }

  if (category === "office_chairs") {
    categories.add("chairs");
    categories.add("armchairs");
  }

  return categories;
}

function categoriesForScopedRole(role: RoomProductRoleSpec) {
  const categories = new Set([role.category]);
  const roleText = `${role.category} ${role.label} ${role.visualBrief ?? ""}`.toLowerCase();

  if (role.category === "chairs" && !roleText.includes("dining")) {
    categories.add("armchairs");
  }

  if (role.category === "office_chairs") {
    categories.add("chairs");
    categories.add("armchairs");
  }

  return categories;
}

// Flatten role option pools into shopping_list_item rows. The chosen product
// per role is `selected`; the rest are `option`. Purchase quantity carries the
// role quantity so a "2 accent chairs" role totals at price x 2.
export function buildShoppingListItemRows({
  roleOptions,
  selectedProductIdByRole,
  reasonFor
}: {
  roleOptions: RoleProductOptions[];
  selectedProductIdByRole: Map<string, string>;
  reasonFor?: (match: RankedProductMatch) => string;
}): ShoppingListItemDraft[] {
  const rows: ShoppingListItemDraft[] = [];
  let sortOrder = 0;

  for (const role of roleOptions) {
    const selectedId = selectedProductIdByRole.get(role.category) ?? null;
    role.options.forEach((match, rank) => {
      const unitPrice = match.salePriceAed ?? match.priceAed ?? 0;
      rows.push({
        product_id: match.id,
        category: role.category,
        status: match.id === selectedId ? "selected" : "option",
        role_label: role.label,
        role_visual_brief: role.visualBrief,
        role_priority: role.priority,
        role_quantity: role.quantity,
        option_rank: rank,
        quantity: role.quantity,
        unit_price_aed: unitPrice,
        line_total_aed: unitPrice * role.quantity,
        selection_reason: reasonFor ? reasonFor(match) : match.selectionReason,
        dimension_fit_note: match.dimensionFitNote,
        sort_order: sortOrder
      });
      sortOrder += 1;
    });
  }

  return rows;
}

// The room estimate is the sum of selected rows only, multiplied by quantity.
export function selectedItemsTotalAed(
  items: ReadonlyArray<{
    status: string;
    unit_price_aed: number | null;
    quantity: number | null;
  }>
): number {
  return items
    .filter((item) => item.status === "selected")
    .reduce((total, item) => total + (item.unit_price_aed ?? 0) * (item.quantity ?? 1), 0);
}

// Group sourced items back into role groups for the picker. Rejected items are
// dropped; options are ordered best-first; the selected option seeds the pick.
// Legacy one-row-per-product lists group cleanly too — each row is its category.
export function groupShoppingItemsByRole<T extends ShoppingItemRoleFields>(
  items: ReadonlyArray<T>
): ShoppingRoleGroup<T>[] {
  const byCategory = new Map<string, T[]>();
  const order: string[] = [];

  for (const item of items) {
    if (item.status === "rejected") {
      continue;
    }
    const existing = byCategory.get(item.category);
    if (existing) {
      existing.push(item);
    } else {
      byCategory.set(item.category, [item]);
      order.push(item.category);
    }
  }

  return order.map((category) => {
    const options = byCategory
      .get(category)!
      .slice()
      .sort((left, right) => left.option_rank - right.option_rank);
    const first = options[0];
    const selected = options.find((item) => item.status === "selected") ?? null;
    return {
      category,
      label: first.role_label || category.replace(/_/g, " "),
      priority: first.role_priority === "required" ? "required" : "supporting",
      quantity: Math.max(1, first.role_quantity),
      selectedId: selected ? selected.id : null,
      options
    };
  });
}
