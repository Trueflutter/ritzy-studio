// The product-sourcing support helpers (S1 extraction, cut down in S3): the
// catalogue readers, candidate shaping, avoid-colour cues, the refill
// alternates, and the user-facing catalogue messages. The catalogue-first
// apparatus that used to live here (anchors, local-SKU fidelity ranking, the
// preview gate, the text fallback) was retired when sourcing moved to the
// confirmed spec. Pure helpers plus client-parameterized readers; no auth,
// redirects, or revalidation here.

import type { Database } from "@ritzy-studio/db";
import {
  buildRoleScopedCandidatePools,
  normalizeProductMatchRoleResultCategory,
  type ProductMatchCandidate,
  type RankedProductMatch,
  type RoomProductRoleSpec
} from "@ritzy-studio/domain";

import type { ServiceSupabaseClient } from "@/lib/services/supabase-clients";
import { fetchRemoteImage, visionImageDataUrl } from "@/lib/render-images";

type StructuredBriefJson = Record<string, unknown> & {
  visualPreferences?: unknown;
  measurements?: unknown;
  inspirationAnalysis?: unknown;
  spatialIntent?: unknown;
};

export function structuredBriefJson(value: unknown): StructuredBriefJson {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as Record<string, unknown>) } as StructuredBriefJson)
    : {};
}

// The service-side guard sits just above the provider call's own deadline
// (PRODUCT_SOURCING_TIMEOUT_MS in @ritzy-studio/ai), so the SDK's timeout is
// the one that normally fires and this only backstops a hung socket.
export const PRODUCT_SOURCING_AI_TIMEOUT_MS = 160_000;
export const PRODUCT_MATCHING_CATALOG_LIMIT = 1500;

// Downscaled data URLs for the candidate images an AI sourcing call will see.
// Fetched app-side (with retry) so the vision provider never has to download
// from rate-limited retailer CDNs or non-public storage hosts.
export async function sourcingCandidateImageDataUrls(
  candidates: Array<{ id: string; primaryImageUrl?: string | null }>,
  limit: number
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    candidates.slice(0, limit).map(async (candidate) => {
      if (!candidate.primaryImageUrl) {
        return null;
      }
      const image = await fetchRemoteImage(candidate.primaryImageUrl);
      if (!image) {
        return null;
      }
      return [candidate.id, await visionImageDataUrl(image.bytes, image.mimeType)] as const;
    })
  );
  return Object.fromEntries(entries.filter((entry): entry is [string, string] => Boolean(entry)));
}

// Product ids the user has already kept in OTHER rooms. Matching demotes (not
// excludes) them so the same anchor pieces stop reappearing across projects
// while thin pools can still fall back to them.
export async function recentlyUsedProductIdsForUser({
  serviceSupabase,
  userId,
  excludeRoomId
}: {
  serviceSupabase: ServiceSupabaseClient;
  userId: string;
  excludeRoomId: string;
}): Promise<string[]> {
  const { data, error } = await serviceSupabase
    .from("shopping_list_items")
    .select(
      "product_id, shopping_list:shopping_lists!inner(room_id, room:rooms!inner(project:projects!inner(owner_user_id)))"
    )
    .eq("shopping_list.room.project.owner_user_id", userId)
    .neq("shopping_list.room_id", excludeRoomId)
    .eq("status", "selected")
    .limit(600);

  if (error || !data) {
    return [];
  }

  return Array.from(new Set(data.map((row) => row.product_id).filter(Boolean)));
}

export function likedStyleSlugsFromStructuredBrief(value: unknown) {
  const structuredJson = structuredBriefJson(value);
  const visualPreferences = structuredJson.visualPreferences;

  if (!visualPreferences || typeof visualPreferences !== "object" || Array.isArray(visualPreferences)) {
    return [];
  }

  const likedStyleSlugs = (visualPreferences as { likedStyleSlugs?: unknown }).likedStyleSlugs;
  return Array.isArray(likedStyleSlugs)
    ? likedStyleSlugs.filter((slug): slug is string => typeof slug === "string")
    : [];
}

export type ProductRow = Database["public"]["Tables"]["products"]["Row"] & {
  retailer: { name: string; status?: string | null } | null;
  dimensions:
    | Array<{
        width_cm: number | null;
        depth_cm: number | null;
        height_cm: number | null;
        source_text: string | null;
      }>
    | null;
};





export function shoppingListRoleSpecFromRow(row: {
  category: string | null;
  role_label?: string | null;
  role_visual_brief?: string | null;
  role_priority?: string | null;
  role_quantity?: number | null;
}): RoomProductRoleSpec {
  const label = row.role_label || row.category || "product option";
  return {
    category: normalizeSourcingCategory(row.category ?? "", label),
    label,
    visualBrief: row.role_visual_brief ?? null,
    quantity: Math.max(1, row.role_quantity ?? 1),
    priority: row.role_priority === "required" ? "required" : "supporting"
  };
}

export function roleScopedShoppingAlternates({
  roomType,
  conceptText,
  budgetMaxAed,
  roomMeasurements,
  role,
  candidates,
  excludeProductIds,
  limit
}: {
  roomType: string;
  conceptText: string;
  budgetMaxAed: number | null;
  roomMeasurements: {
    wallLengthCm: number | null;
    roomDepthCm: number | null;
  } | null;
  role: RoomProductRoleSpec;
  candidates: ProductMatchCandidate[];
  excludeProductIds: Set<string>;
  limit: number;
}): RankedProductMatch[] {
  const pool = buildRoleScopedCandidatePools({
    roomType,
    conceptText,
    roles: [role],
    candidates,
    budgetMaxAed,
    roomMeasurements,
    candidatesPerRole: Math.max(limit * 4, limit)
  }).pools[0];

  return (pool?.candidates ?? [])
    .filter((candidate) => !excludeProductIds.has(candidate.id))
    .slice(0, Math.max(1, limit));
}


const AVOID_CUE_COLOR_TOKENS = [
  "beige", "black", "blue", "brown", "burgundy", "charcoal", "cream", "gold", "green", "grey",
  "gray", "ivory", "navy", "orange", "pink", "purple", "red", "rust", "sage", "taupe",
  "terracotta", "white", "yellow"
];

// Splits "avoid X" style clauses out of free-text cues. The named colors become
// structural avoid tags; the clauses are removed so their tokens stop scoring
// as positive matches.
export function splitAvoidColorCues(text: string): { cueText: string; avoidColorTags: string[] } {
  const avoidColorTags = new Set<string>();
  const cleanedLines = text.split("\n").map((line) => {
    // Capture from each avoid-marker to the end of the clause (sentence/segment).
    return line.replace(
      /\b(?:avoid(?:ing)?|no|not|without|nothing)\b([^.;\n]*)/gi,
      (clause, tail: string) => {
        const tailTokens = tail.toLowerCase().split(/[^a-z]+/);
        const named = AVOID_CUE_COLOR_TOKENS.filter((color) => tailTokens.includes(color));
        for (const color of named) {
          avoidColorTags.add(color);
        }
        // Only strip the clause when it actually named colors; other avoid
        // notes (materials, styles) keep flowing to the model as text.
        return named.length > 0 ? "" : clause;
      }
    );
  });

  return {
    cueText: cleanedLines.join("\n").replace(/[ \t]{2,}/g, " ").trim(),
    avoidColorTags: Array.from(avoidColorTags)
  };
}





export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function productToMatchCandidate(product: ProductRow): ProductMatchCandidate | null {
  if (!product.primary_image_url) {
    return null;
  }

  if (product.retailer?.status && product.retailer.status !== "active") {
    return null;
  }

  const availability = product.availability?.toLowerCase() ?? "";
  if (
    availability.includes("out of stock") ||
    availability.includes("sold out") ||
    availability.includes("unavailable")
  ) {
    return null;
  }

  return {
    id: product.id,
    name: product.name,
    retailerName: product.retailer?.name ?? "Retailer",
    canonicalUrl: product.canonical_url,
    description: product.description,
    categoryNormalized: product.category_normalized,
    priceAed: product.price_aed,
    salePriceAed: product.sale_price_aed,
    availability: product.availability,
    primaryImageUrl: product.primary_image_url,
    color: product.color,
    material: product.material,
    styleTags: product.style_tags,
    colorTags: product.color_tags,
    materialTags: product.material_tags,
    roomTags: product.room_tags,
    lastCheckedAt: product.last_checked_at,
    dimensions: product.dimensions?.[0]
      ? {
          widthCm: product.dimensions[0].width_cm,
          depthCm: product.dimensions[0].depth_cm,
          heightCm: product.dimensions[0].height_cm,
          sourceText: product.dimensions[0].source_text
        }
      : null
  };
}

export function catalogUnavailableMessage(products: ProductRow[]) {
  if (products.length === 0) {
    return "The shopping catalog is refreshing. Please try matching products again in a minute.";
  }

  const activeRetailerProducts = products.filter((product) => product.retailer?.status === "active");
  if (activeRetailerProducts.length === 0) {
    return "The shopping catalog is waiting for an approved retailer. Please try again shortly.";
  }

  const inStockProducts = activeRetailerProducts.filter((product) => {
    const availability = product.availability?.toLowerCase() ?? "";
    return !(
      availability.includes("out of stock") ||
      availability.includes("sold out") ||
      availability.includes("unavailable")
    );
  });

  if (inStockProducts.length === 0) {
    return "The approved catalog is refreshing current availability. Please try again shortly.";
  }

  return "The shopping catalog is refreshing eligible products. Please try again shortly.";
}




































export function matchToSourcingCandidate(match: RankedProductMatch) {
  return {
    id: match.id,
    name: match.name,
    retailerName: match.retailerName,
    category: match.categoryNormalized,
    description: match.description,
    priceAed: match.priceAed,
    salePriceAed: match.salePriceAed,
    availability: match.availability,
    color: match.color,
    material: match.material,
    primaryImageUrl: match.primaryImageUrl,
    dimensions: match.dimensions?.sourceText ?? null,
    searchTags: [
      match.categoryNormalized,
      match.color,
      match.material,
      ...match.styleTags,
      ...match.colorTags,
      ...match.materialTags,
      ...match.roomTags
    ].filter((tag): tag is string => Boolean(tag))
  };
}

export function normalizeSourcingCategory(category: string, roleLabel: string) {
  return normalizeProductMatchRoleResultCategory(category, roleLabel);
}

export function missingLocalSkuFidelityRenderRoles({
  roomType,
  selectedCategories
}: {
  roomType: string;
  selectedCategories: string[];
}) {
  if (!roomType.toLowerCase().includes("living")) {
    return [];
  }

  const selected = new Set(selectedCategories.map((category) => normalizeSourcingCategory(category, category)));
  const minimumVisibleSupportRoles = [
    { category: "storage", label: "TV/media console" },
    { category: "lighting", label: "lighting" },
    { category: "side_tables", label: "side/end table" },
    { category: "decor", label: "decor" }
  ];

  return minimumVisibleSupportRoles
    .filter((role) => !selected.has(role.category))
    .map((role) => role.label);
}
