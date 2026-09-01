// The product-sourcing support cloud extracted verbatim from app/actions.ts (S1
// step 5): catalogue-grounding plan assembly, local-SKU fidelity ranking, cue and
// palette heuristics, and the sourcing data-window fetchers. Pure helpers plus
// client-parameterized readers; no auth, redirects, or revalidation here.

import type { Database } from "@ritzy-studio/db";
import {
  assessAestheticFitForRole,
  buildProductMatchVisualSourcingEvidence,
  buildProductSourcingRuntimePlan,
  buildRoleScopedCandidatePools,
  enhancedProductRolesForRoom,
  normalizeProductMatchRoleResultCategory,
  productMatchConfidenceOutputSummary,
  productMatchQaStopRuleOutputSummary,
  productMatchRequiredRoleDescriptor,
  rankProductMatches,
  renderReferencePriorityForProduct,
  scopedCategoriesForProductRole,
  visualStyleSummary,
  type ProductMatchCandidate,
  type ProductRefreshDiversityHistory,
  type RankedProductMatch,
  type RoleProductOptions,
  type RoleScopedCandidatePool,
  type RoomProductRoleSpec
} from "@ritzy-studio/domain";

import type { ServiceSupabaseClient } from "@/lib/services/supabase-clients";
import { localSkuFidelityModeEnabled } from "@/lib/render-flags";
import { fetchRemoteImage, visionImageDataUrl, type CatalogueReferenceImage } from "@/lib/render-images";
import {
  classifyProductSourcingFailure,
  productSourcingGenericFailureMessage,
  productSourcingTimeoutMessage
} from "@/lib/product-sourcing-failure";
import { buildProductSourcingTimeoutDiagnostics } from "@/lib/product-sourcing-timeout-diagnostics";

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

export const PRODUCT_SOURCING_AI_TIMEOUT_MS = 45_000;
export const PRODUCT_MATCHING_CATALOG_LIMIT = 1500;
// Header-only (Range: bytes=0-0) reachability check per candidate image. At 2.5s a slow retailer
// CDN's TLS + TTFB could time out otherwise-valid images; when the AI-product-image gate is on
// (PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED) that would block sourcing for a required role the
// same way the 2.5s grounding fetch blocked concepts pre-#313. Generous per-image ceiling, bounded
// overall by PRODUCT_SOURCING_IMAGE_PREFLIGHT_BUDGET_MS so a batch of dead URLs can't stall.
export const PRODUCT_SOURCING_IMAGE_PREFLIGHT_TIMEOUT_MS = 8_000;
// Overall wall-clock budget for a whole preflight batch. Once spent, remaining candidates are
// passed through optimistically (never rejected), so slow CDNs degrade to latency, not a block.
export const PRODUCT_SOURCING_IMAGE_PREFLIGHT_BUDGET_MS = 20_000;
export const PRODUCT_SOURCING_AI_CONCEPT_IMAGE_DETAIL = "low" as const;
export const PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT = 0;
export const PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_DETAIL = "low" as const;
export const PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED = PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT > 0;
const CATALOGUE_GROUNDED_CONCEPT_ANCHOR_LIMIT = 6;
const CATALOGUE_GROUNDED_CONCEPT_PRODUCTS_PER_CATEGORY = 300;
const CATALOGUE_GROUNDED_CONCEPT_CANDIDATES_PER_ROLE = 12;
const CATALOGUE_GROUNDED_CONCEPT_FLAT_CANDIDATE_LIMIT = 48;
const CATALOGUE_GROUNDED_CONCEPT_MIN_ATTRIBUTE_TOTAL = 35;
// Per-image timeout is generous (large catalogue images), so bound the WHOLE grounding: without a
// ceiling, a role whose top candidates all have unfetchable images would fetch each sequentially
// (~24.75s incl. retry) and could stall the synchronous concept action for minutes. Once this
// wall-clock budget is spent, stop evaluating further candidates and block fast instead. The happy
// path (first candidate resolves in a few seconds) never approaches it.
const CATALOGUE_GROUNDED_CONCEPT_IMAGE_FETCH_BUDGET_MS = 90_000;
export const CATALOGUE_GROUNDED_CONCEPT_USER_SAFE_BLOCK_MESSAGE =
  "We need a little more catalogue evidence before building this room direction. Try broadening the style or colour notes, then generate again.";
export const CATALOGUE_GROUNDED_CONCEPT_REFERENCE_IMAGE_BLOCK_MESSAGE =
  "We found catalogue pieces for this room, but their reference images are not ready yet. Try again in a moment.";
export const LOCAL_SKU_FIDELITY_CANDIDATES_PER_ROLE = 18;

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
type DesignBriefRow = Database["public"]["Tables"]["design_briefs"]["Row"];
type AnsweredQuestionRow = {
  question: string;
  answer: string | null;
};
type CatalogueGroundingProduct = {
  role: RoomProductRoleSpec;
  match: RankedProductMatch & {
    attributeScore: {
      total: number;
      color: number;
      material: number;
      style: number;
      silhouette: number;
      weaknessReasons: string[];
    };
  };
  referenceImage: CatalogueReferenceImage;
};
type CatalogueGroundingAnchor = {
  productId: string;
  category: string;
  roleLabel: string;
  priority: "required" | "supporting";
  selectionReason: string;
};
type CatalogueCueRequirements = {
  color: boolean;
  material: boolean;
  shape: boolean;
  style: boolean;
};

async function fetchCatalogueGroundingProductWindow({
  serviceSupabase,
  roles
}: {
  serviceSupabase: ServiceSupabaseClient;
  roles: RoomProductRoleSpec[];
}) {
  const categories = Array.from(new Set(roles.flatMap((role) => Array.from(scopedCategoriesForProductRole(role)))));
  const productsById = new Map<string, ProductRow>();

  for (const category of categories) {
    const { data: products = [], error } = await serviceSupabase
      .from("products")
      .select(
        `
        *,
        retailer:retailers(name, status),
        dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
      `
      )
      .eq("category_normalized", category)
      .not("price_aed", "is", null)
      .not("primary_image_url", "is", null)
      .order("last_checked_at", { ascending: false, nullsFirst: false })
      .limit(CATALOGUE_GROUNDED_CONCEPT_PRODUCTS_PER_CATEGORY);

    if (error) {
      throw new Error(error.message);
    }

    for (const product of products ?? []) {
      productsById.set(product.id, product as ProductRow);
    }
  }

  return Array.from(productsById.values());
}

export async function fetchProductsById({
  serviceSupabase,
  productIds
}: {
  serviceSupabase: ServiceSupabaseClient;
  productIds: string[];
}) {
  if (productIds.length === 0) {
    return [];
  }

  const { data: products = [], error } = await serviceSupabase
    .from("products")
    .select(
      `
      *,
      retailer:retailers(name, status),
      dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
    `
    )
    .in("id", productIds);

  if (error) {
    throw new Error(error.message);
  }

  return (products ?? []) as ProductRow[];
}

export async function fetchLocalSkuFidelityRoleWindowCandidates({
  serviceSupabase,
  roomType,
  roles,
  conceptText
}: {
  serviceSupabase: ServiceSupabaseClient;
  roomType: string;
  roles: RoomProductRoleSpec[];
  conceptText: string;
}) {
  const productsById = new Map<string, ProductRow>();

  for (const role of roles) {
    const category = normalizeSourcingCategory(role.category, role.label);
    const { data: categoryProducts = [], error } = await serviceSupabase
      .from("products")
      .select(
        `
        *,
        retailer:retailers(name, status),
        dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
      `
      )
      .eq("category_normalized", category)
      .not("price_aed", "is", null)
      .not("primary_image_url", "is", null)
      .order("last_checked_at", { ascending: false, nullsFirst: false })
      .limit(250);

    if (error) {
      throw new Error(error.message);
    }

    const candidates = (categoryProducts ?? [])
      .map(productToMatchCandidate)
      .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));
    const ranked = rankMatchesForLocalSkuFidelity({
      ranked: rankProductMatches({
        roomType,
        conceptText,
        candidates
      }),
      roles: [role],
      roomType,
      conceptText,
      roomMeasurements: null
    });

    for (const match of ranked.slice(0, 60)) {
      const product = categoryProducts?.find((candidate) => candidate.id === match.id);
      if (product) {
        productsById.set(product.id, product as ProductRow);
      }
    }
  }

  return Array.from(productsById.values())
    .map(productToMatchCandidate)
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));
}

export async function buildCatalogueGroundedConceptPlan({
  serviceSupabase,
  roomType,
  budgetMaxAed,
  roomMeasurements,
  designBrief,
  answeredQuestions
}: {
  serviceSupabase: ServiceSupabaseClient;
  roomType: string;
  budgetMaxAed: number | null;
  roomMeasurements: {
    wallLengthCm: number | null;
    roomDepthCm: number | null;
  } | null;
  designBrief: DesignBriefRow;
  answeredQuestions: AnsweredQuestionRow[];
}) {
  const rawCueText = catalogueGroundingCueText({ designBrief, answeredQuestions });
  // "avoid purple and bright red" must not read as positive purple/red cues:
  // strip avoid-clauses from the scoring text and enforce them structurally.
  const { cueText, avoidColorTags } = splitAvoidColorCues(rawCueText);
  const cueRequirements = catalogueCueRequirements(cueText);
  const anchorRoles = enhancedProductRolesForRoom(roomType)
    .filter((role) => role.importance === "anchor" || role.required)
    .map((role): RoomProductRoleSpec => ({
      category: role.category,
      label: role.label,
      visualBrief: [role.visualBrief ?? role.label, cueText ? `User-selected cues: ${cueText}` : null]
        .filter(Boolean)
        .join(". "),
      quantity: role.quantity,
      priority: role.required || role.includeWhen === "always" ? "required" : "supporting"
    }));
  const products = await fetchCatalogueGroundingProductWindow({
    serviceSupabase,
    roles: anchorRoles
  });
  const candidates = products
    .map((product) => productToMatchCandidate(product))
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));

  if (candidates.length === 0) {
    return {
      products: [],
      blockers: [catalogUnavailableMessage(products)],
      summary: {
        enabled: true,
        selectedProductCount: 0,
        blockerCount: 1,
        roles: []
      }
    };
  }
  const conceptText = [cueText, designBrief.style_notes, designBrief.color_notes, designBrief.functional_requirements]
    .filter(Boolean)
    .join("\n");
  const aestheticGateEnabled = localSkuFidelityModeEnabled(roomType);
  const plan = buildProductSourcingRuntimePlan({
    engineEnabled: true,
    roomType,
    conceptText,
    roles: anchorRoles,
    candidates,
    avoidColorTags,
    budgetMaxAed,
    roomMeasurements,
    candidatesPerRole: aestheticGateEnabled ? 36 : CATALOGUE_GROUNDED_CONCEPT_CANDIDATES_PER_ROLE,
    flatCandidateLimit: aestheticGateEnabled ? 96 : CATALOGUE_GROUNDED_CONCEPT_FLAT_CANDIDATE_LIMIT
  });
  const roleScopedPools = aestheticGateEnabled
    ? plan.roleScopedPools.map((pool) => rerankRolePoolForAestheticFit(pool, roomType, conceptText))
    : plan.roleScopedPools;
  const selected: CatalogueGroundingProduct[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const degradedRequiredRoles: string[] = [];
  // Wall-clock ceiling across all roles' reference-image fetches (see the constant).
  const imageFetchDeadline = Date.now() + CATALOGUE_GROUNDED_CONCEPT_IMAGE_FETCH_BUDGET_MS;

  for (const pool of roleScopedPools) {
    let selectedCandidate: (typeof pool.candidates)[number] | null = null;
    let selectedReferenceImage: CatalogueReferenceImage | null = null;
    let accessibleFallback:
      | {
          candidate: (typeof pool.candidates)[number];
          referenceImage: CatalogueReferenceImage;
        }
      | null = null;

    for (const candidate of pool.candidates) {
      let aestheticScoreAdjustment = 0;
      if (hasHardCatalogueGroundingContradiction(candidate.attributeScore.weaknessReasons)) {
        warnings.push(
          `${pool.role.label}: skipped ${candidate.name} on hard cue contradiction (${candidate.attributeScore.weaknessReasons.join("; ")}).`
        );
        continue;
      }

      if (aestheticGateEnabled) {
        const aestheticFit = assessAestheticFitForRole({
          candidate,
          role: pool.role,
          roomType,
          conceptText,
          companionCandidates: selected.map(({ match }) => match)
        });
        aestheticScoreAdjustment = aestheticFit.scoreAdjustment;
        if (aestheticFit.unsuitableHero) {
          warnings.push(`${pool.role.label}: skipped aesthetically unsuitable catalogue candidate (${candidate.name}).`);
          continue;
        }
      }

      if (Date.now() > imageFetchDeadline) {
        warnings.push(
          `${pool.role.label}: reference-image fetch budget exhausted; stopped evaluating further candidates.`
        );
        break;
      }

      const referenceImage = candidate.primaryImageUrl ? await fetchRemoteImage(candidate.primaryImageUrl) : null;
      if (!referenceImage) {
        warnings.push(`${pool.role.label}: skipped catalogue candidate without a fetchable reference image.`);
        continue;
      }

      if (isEntryPriceCatalogueGroundingAnchor(candidate, pool.role) && aestheticScoreAdjustment < 40) {
        accessibleFallback ??= {
          candidate,
          referenceImage
        };
        warnings.push(`${pool.role.label}: held entry-price catalogue candidate as fallback.`);
        continue;
      }

      selectedCandidate = candidate;
      selectedReferenceImage = referenceImage;
      break;
    }

    if (!selectedCandidate && accessibleFallback) {
      selectedCandidate = accessibleFallback.candidate;
      selectedReferenceImage = accessibleFallback.referenceImage;
      warnings.push(`${pool.role.label}: used entry-price catalogue candidate because stronger image-backed options were unavailable.`);
    }

    if (!selectedCandidate || !selectedReferenceImage) {
      // Graceful degradation: a single required role that can't produce an image-backed anchor
      // must NOT hard-block the whole concept. Concept-first (ADR 0001) designs the room freely,
      // then grounds real products at sourcing — so an ungrounded role is designed by the model
      // and matched to a real SKU later, not lost. We only block if NOTHING grounds at all
      // (post-loop check below), which is the true "catalogue has no usable evidence" case.
      if (pool.role.priority === "required") {
        const reason = pool.candidates.length > 0
          ? "eligible candidates had hard role or cue contradictions or lacked usable reference images"
          : "no eligible catalogue candidate";
        degradedRequiredRoles.push(pool.role.label);
        warnings.push(`${pool.role.label}: proceeding without a catalogue anchor (${reason}).`);
      }
      continue;
    }

    const weaknessReasons = catalogueGroundingWeaknessReasons(selectedCandidate.attributeScore, cueRequirements);
    if (weaknessReasons.length > 0) {
      warnings.push(
        `${pool.role.label}: selected best available catalogue candidate with warnings (${[
          `score ${selectedCandidate.attributeScore.total}`,
          ...weaknessReasons
        ].join("; ")}).`
      );
    }

    selected.push({
      role: pool.role,
      match: selectedCandidate,
      referenceImage: selectedReferenceImage
    });
  }
  // The concept is only truly ungroundable when not a single anchor could be secured. One or two
  // grounded anchors are enough for a catalogue-aware concept; ungrounded roles degrade to warnings
  // above and are matched to real products at sourcing.
  if (selected.length === 0) {
    blockers.push(
      "No catalogue anchor could be grounded for this room (no eligible candidate had a usable reference image)."
    );
  }

  if (aestheticGateEnabled) {
    await refineSelectedCatalogueProductsForAestheticFit({
      selected,
      pools: roleScopedPools,
      roomType,
      conceptText,
      warnings
    });
  }

  const productsForConcept = selected
    .sort(
      (left, right) =>
        renderReferencePriorityForProduct(
          {
            category: left.match.categoryNormalized,
            roleLabel: left.role.label,
            selectionReason: left.match.selectionReason
          },
          roomType
        ) -
        renderReferencePriorityForProduct(
          {
            category: right.match.categoryNormalized,
            roleLabel: right.role.label,
            selectionReason: right.match.selectionReason
          },
          roomType
        )
    )
    .slice(0, CATALOGUE_GROUNDED_CONCEPT_ANCHOR_LIMIT);
  const selectedAnchorByRole = new Map(
    selected.map(({ role, match }) => [catalogueGroundingRoleKey(role.category, role.label), match])
  );

  return {
    products: productsForConcept,
    blockers,
    summary: {
      enabled: true,
      selectedProductCount: productsForConcept.length,
      blockerCount: blockers.length,
      warningCount: warnings.length,
      degradedRequiredRoles,
      cueRequirements,
      warnings: warnings.slice(0, 12),
      selectedAnchors: productsForConcept.map(({ role, match }) => ({
        productId: match.id,
        category: role.category,
        roleLabel: role.label,
        priority: role.priority,
        anchorQuality:
          catalogueGroundingWeaknessReasons(match.attributeScore, cueRequirements).length > 0
            ? "best_available"
            : "strong",
        selectionReason: match.selectionReason,
        attributeScore: {
          total: match.attributeScore.total,
          color: match.attributeScore.color,
          material: match.attributeScore.material,
          style: match.attributeScore.style,
          silhouette: match.attributeScore.silhouette,
          weaknessReasons: match.attributeScore.weaknessReasons
        }
      })),
      aestheticTasteGateEnabled: aestheticGateEnabled,
      roles: roleScopedPools.map((pool) => ({
        category: pool.role.category,
        roleLabel: pool.role.label,
        candidateCount: pool.candidateCount,
        selectedProductId:
          selectedAnchorByRole.get(catalogueGroundingRoleKey(pool.role.category, pool.role.label))?.id ?? null,
        topAttributeTotal: pool.candidates[0]?.attributeScore.total ?? null
      }))
    }
  };
}

function catalogueGroundingRoleKey(category: string, label: string) {
  return `${category}::${label}`.toLowerCase();
}

export async function previousShoppingListRefreshHistory({
  serviceSupabase,
  roomId,
  conceptId
}: {
  serviceSupabase: ServiceSupabaseClient;
  roomId: string;
  conceptId: string;
}): Promise<ProductRefreshDiversityHistory[]> {
  const { data: existingList } = await serviceSupabase
    .from("shopping_lists")
    .select("id")
    .eq("room_id", roomId)
    .eq("concept_id", conceptId)
    .limit(1)
    .maybeSingle();

  if (!existingList?.id) {
    return [];
  }

  const { data: rows } = await serviceSupabase
    .from("shopping_list_items")
    .select("product_id, category, role_label, product:products(name, retailer:retailers(name))")
    .eq("shopping_list_id", existingList.id)
    .in("status", ["selected", "option"]);

  return (rows ?? []).map((row) => {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    const retailer = product?.retailer;
    const retailerName = Array.isArray(retailer) ? retailer[0]?.name : retailer?.name;

    return {
      productId: row.product_id,
      productName: product?.name ?? null,
      category: row.category,
      roleLabel: row.role_label,
      retailerName: retailerName ?? null
    };
  });
}

export function rerankRolePoolForAestheticFit(
  pool: RoleScopedCandidatePool,
  roomType: string,
  conceptText: string,
  companionCandidates: ProductMatchCandidate[] = []
): RoleScopedCandidatePool {
  return {
    ...pool,
    candidates: [...pool.candidates]
      .map((candidate) => {
        const assessment = assessAestheticFitForRole({
          candidate,
          role: pool.role,
          roomType,
          conceptText,
          companionCandidates
        });
        return {
          ...candidate,
          score: Number((candidate.score + assessment.scoreAdjustment).toFixed(3)),
          selectionReason: [
            candidate.selectionReason,
            ...assessment.reasons.map((reason) => `aesthetic fit: ${reason}`)
          ].join("; "),
          warnings: [...candidate.warnings, ...assessment.weaknessReasons],
          attributeScore: {
            ...candidate.attributeScore,
            total: candidate.attributeScore.total + assessment.scoreAdjustment,
            reasons: [...candidate.attributeScore.reasons, ...assessment.reasons],
            weaknessReasons: Array.from(
              new Set([...candidate.attributeScore.weaknessReasons, ...assessment.weaknessReasons])
            )
          }
        };
      })
      .sort((left, right) => right.score - left.score)
  };
}

export function roleScopedCandidatesForLocalSkuFidelityPlan(pools: RoleScopedCandidatePool[], limit: number) {
  const selectedIds = new Set<string>();
  const selected: RankedProductMatch[] = [];

  for (const pool of pools) {
    for (const candidate of pool.candidates) {
      if (selectedIds.has(candidate.id)) {
        continue;
      }
      selected.push(candidate);
      selectedIds.add(candidate.id);
    }
  }

  return selected.slice(0, limit);
}

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

export function rankMatchesForLocalSkuFidelity({
  ranked,
  roles,
  roomType,
  conceptText,
  roomMeasurements
}: {
  ranked: RankedProductMatch[];
  roles: RoomProductRoleSpec[];
  roomType: string;
  conceptText: string;
  roomMeasurements: {
    wallLengthCm: number | null;
    roomDepthCm: number | null;
  } | null;
}) {
  const rolesByCategory = new Map(roles.map((role) => [normalizeSourcingCategory(role.category, role.label), role]));

  return ranked
    .map((match) => {
      const category = match.categoryNormalized ?? "uncategorized";
      const role = rolesByCategory.get(category);
      if (!role) {
        return match;
      }

      const assessment = assessAestheticFitForRole({
        candidate: match,
        role,
        roomType,
        conceptText
      });
      const localAdjustment = localSkuFidelityScoreAdjustment(match, role, conceptText, roomMeasurements);

      return {
        ...match,
        score: Number((match.score + assessment.scoreAdjustment + localAdjustment.scoreAdjustment).toFixed(3)),
        selectionReason: [
          match.selectionReason,
          ...assessment.reasons.map((reason) => `aesthetic fit: ${reason}`),
          ...localAdjustment.reasons.map((reason) => `sku fidelity: ${reason}`)
        ].join("; "),
        warnings: [...match.warnings, ...assessment.weaknessReasons, ...localAdjustment.weaknessReasons]
      };
    })
    .sort((left, right) => right.score - left.score);
}

async function refineSelectedCatalogueProductsForAestheticFit({
  selected,
  pools,
  roomType,
  conceptText,
  warnings
}: {
  selected: CatalogueGroundingProduct[];
  pools: RoleScopedCandidatePool[];
  roomType: string;
  conceptText: string;
  warnings: string[];
}) {
  const selectedRug = selected.find(({ role }) => normalizeSourcingCategory(role.category, role.label) === "rugs");
  const selectedCoffeeTableIndex = selected.findIndex(
    ({ role }) => normalizeSourcingCategory(role.category, role.label) === "coffee_tables"
  );
  if (!selectedRug || selectedCoffeeTableIndex < 0) {
    return;
  }

  const selectedCoffeeTable = selected[selectedCoffeeTableIndex];
  const currentAssessment = assessAestheticFitForRole({
    candidate: selectedCoffeeTable.match,
    role: selectedCoffeeTable.role,
    roomType,
    conceptText,
    companionCandidates: [selectedRug.match]
  });
  if (!currentAssessment.unsuitableHero) {
    return;
  }

  const coffeeTablePool = pools.find(
    (pool) => normalizeSourcingCategory(pool.role.category, pool.role.label) === "coffee_tables"
  );
  for (const alternative of coffeeTablePool?.candidates ?? []) {
    if (alternative.id === selectedCoffeeTable.match.id) {
      continue;
    }

    const alternativeAssessment = assessAestheticFitForRole({
      candidate: alternative,
      role: selectedCoffeeTable.role,
      roomType,
      conceptText,
      companionCandidates: [selectedRug.match]
    });
    if (alternativeAssessment.unsuitableHero) {
      continue;
    }

    const referenceImage = alternative.primaryImageUrl ? await fetchRemoteImage(alternative.primaryImageUrl) : null;
    if (!referenceImage) {
      continue;
    }

    selected[selectedCoffeeTableIndex] = {
      role: selectedCoffeeTable.role,
      match: {
        ...alternative,
        selectionReason: [
          alternative.selectionReason,
          "aesthetic fit: replaced noisy coffee table to harmonize with patterned rug"
        ].join("; ")
      },
      referenceImage
    };
    warnings.push(
      `${selectedCoffeeTable.role.label}: replaced noisy catalogue anchor (${selectedCoffeeTable.match.name}) with quieter option (${alternative.name}).`
    );
    return;
  }
}

function hasHardCatalogueGroundingContradiction(weaknessReasons: string[]) {
  return weaknessReasons.some((reason) => {
    const lower = reason.toLowerCase();
    // Silhouette language is a soft styling preference (often sourced from
    // style-module prose like "curved forms"); it already costs score and must
    // never veto the top palette-and-category-correct anchor. Hard vetoes are
    // reserved for genuine contradictions: wrong class, clashing color family,
    // impossible dimensions, unavailable stock.
    if (lower.includes("silhouette")) {
      return false;
    }
    return (
      lower.includes("conflicts") ||
      lower.includes("mismatch") ||
      lower.includes("does not fit") ||
      lower.includes("unavailable")
    );
  });
}

function isEntryPriceCatalogueGroundingAnchor(
  candidate: CatalogueGroundingProduct["match"],
  role: RoomProductRoleSpec
) {
  const price = candidate.salePriceAed ?? candidate.priceAed;
  if (price === null) {
    return false;
  }

  const entryPriceFloors: Record<string, number> = {
    armchairs: 900,
    coffee_tables: 800,
    lighting: 500,
    rugs: 700,
    sofas: 2500,
    storage: 900
  };
  const floor = entryPriceFloors[role.category];

  return Boolean(floor && price < floor);
}

function catalogueGroundingCueText({
  designBrief,
  answeredQuestions
}: {
  designBrief: DesignBriefRow;
  answeredQuestions: AnsweredQuestionRow[];
}) {
  return [
    visualStyleSummary(likedStyleSlugsFromStructuredBrief(designBrief.structured_json)),
    designBrief.style_notes,
    designBrief.color_notes,
    designBrief.functional_requirements,
    designBrief.inspiration_notes,
    ...answeredQuestions
      .filter((question) => question.answer)
      .map((question) => `${question.question}: ${question.answer}`)
  ]
    .filter(Boolean)
    .join("\n");
}

function catalogueCueRequirements(cueText: string): CatalogueCueRequirements {
  const tokens = catalogueCueTokens(cueText);

  return {
    color: hasAnyCatalogueCue(tokens, [
      "beige",
      "black",
      "blue",
      "brown",
      "charcoal",
      "cream",
      "ecru",
      "green",
      "grey",
      "gray",
      "ivory",
      "navy",
      "oatmeal",
      "red",
      "sand",
      "sage",
      "tan",
      "taupe",
      "terracotta",
      "white"
    ]),
    material: hasAnyCatalogueCue(tokens, [
      "boucle",
      "brass",
      "fabric",
      "glass",
      "leather",
      "linen",
      "marble",
      "metal",
      "oak",
      "plaster",
      "stone",
      "travertine",
      "velvet",
      "walnut",
      "wood"
    ]),
    shape: hasAnyCatalogueCue(tokens, [
      "curved",
      "fluted",
      "low",
      "lowline",
      "oval",
      "rectangular",
      "ribbed",
      "round",
      "sculptural",
      "slender",
      "slim",
      "square",
      "tall",
      "tufted",
      "upholstered"
    ]),
    style: hasAnyCatalogueCue(tokens, [
      "bohemian",
      "classic",
      "coastal",
      "contemporary",
      "gallery",
      "industrial",
      "mid",
      "midcentury",
      "minimal",
      "modern",
      "scandinavian",
      "traditional"
    ])
  };
}

function catalogueGroundingWeaknessReasons(
  attributeScore: CatalogueGroundingProduct["match"]["attributeScore"],
  cueRequirements: CatalogueCueRequirements
) {
  const reasons = [...attributeScore.weaknessReasons];

  if (attributeScore.total < CATALOGUE_GROUNDED_CONCEPT_MIN_ATTRIBUTE_TOTAL) {
    reasons.push("top candidate attribute score is weak");
  }
  if (cueRequirements.color && attributeScore.color <= 0) {
    reasons.push("requested colour cue lacks positive catalogue evidence");
  }
  if (cueRequirements.material && attributeScore.material <= 0) {
    reasons.push("requested material cue lacks positive catalogue evidence");
  }
  if (cueRequirements.shape && attributeScore.silhouette <= 0) {
    reasons.push("requested shape cue lacks positive catalogue evidence");
  }
  if (cueRequirements.style && attributeScore.style <= 0) {
    reasons.push("requested style cue lacks positive catalogue evidence");
  }

  return Array.from(new Set(reasons));
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

function catalogueCueTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter(Boolean)
  );
}

function hasAnyCatalogueCue(tokens: Set<string>, cues: string[]) {
  return cues.some((cue) => tokens.has(cue));
}

export async function catalogueGroundingAnchorsForConcept({
  serviceSupabase,
  generationJobId
}: {
  serviceSupabase: ServiceSupabaseClient;
  generationJobId: string | null;
}): Promise<CatalogueGroundingAnchor[]> {
  if (!generationJobId) {
    return [];
  }

  const { data: generationJob } = await serviceSupabase
    .from("ai_jobs")
    .select("output_summary")
    .eq("id", generationJobId)
    .maybeSingle();
  const outputSummary = generationJob?.output_summary;
  if (!isRecord(outputSummary)) {
    return [];
  }

  const catalogueGrounding = outputSummary.catalogueGrounding;
  if (!isRecord(catalogueGrounding) || !Array.isArray(catalogueGrounding.selectedAnchors)) {
    return [];
  }

  return catalogueGrounding.selectedAnchors.filter(isCatalogueGroundingAnchor);
}

function isCatalogueGroundingAnchor(value: unknown): value is CatalogueGroundingAnchor {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.productId === "string" &&
    typeof value.category === "string" &&
    typeof value.roleLabel === "string" &&
    (value.priority === "required" || value.priority === "supporting") &&
    typeof value.selectionReason === "string"
  );
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

export function productImageCatalogRefreshMessage() {
  return "The shopping catalog is refreshing eligible products. Please try again shortly.";
}

export function productSourcingFailureMessage(error: unknown) {
  const failureKind = classifyProductSourcingFailure(error);
  if (failureKind === "provider_image_download") return productImageCatalogRefreshMessage();
  if (failureKind === "timeout") return productSourcingTimeoutMessage();
  return productSourcingGenericFailureMessage();
}

export function productSourcingAiPayloadSummary() {
  return {
    conceptImageDetail: PRODUCT_SOURCING_AI_CONCEPT_IMAGE_DETAIL,
    candidateImageLimit: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT,
    candidateImageDetail: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_DETAIL,
    productCandidateImagesEnabled: PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED
  };
}

export function productSourcingTimeoutDiagnostics({
  attemptDurationMs,
  timedOut,
  fallbackUsed,
  fallbackReason,
  candidateCount,
  rolePoolCount,
  retryAttempted = false,
  retryAttemptDurationMs = null,
  retryTimedOut = false,
  retryFallbackUsed = false,
  retryFallbackReason = null,
  retryProviderImageDownloadFailure = false,
  retryImageGateUsable = null
}: {
  attemptDurationMs: number | null;
  timedOut: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  candidateCount: number;
  rolePoolCount: number;
  retryAttempted?: boolean;
  retryAttemptDurationMs?: number | null;
  retryTimedOut?: boolean;
  retryFallbackUsed?: boolean;
  retryFallbackReason?: string | null;
  retryProviderImageDownloadFailure?: boolean;
  retryImageGateUsable?: boolean | null;
}) {
  return buildProductSourcingTimeoutDiagnostics({
    attemptDurationMs,
    timeoutMs: PRODUCT_SOURCING_AI_TIMEOUT_MS,
    timedOut,
    fallbackUsed,
    fallbackReason,
    candidateCount,
    rolePoolCount,
    conceptImageDetail: PRODUCT_SOURCING_AI_CONCEPT_IMAGE_DETAIL,
    candidateImageLimit: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT,
    productCandidateImagesEnabled: PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED,
    retry: {
      attempted: retryAttempted,
      attemptDurationMs: retryAttemptDurationMs,
      timedOut: retryTimedOut,
      fallbackUsed: retryFallbackUsed,
      fallbackReason: retryTimedOut ? "retry_visual_sourcing_timeout" : retryFallbackReason,
      providerImageDownloadFailure: retryProviderImageDownloadFailure,
      imageGateUsable: retryImageGateUsable
    }
  });
}

export function mergeProductMatchCandidates(
  candidates: ProductMatchCandidate[],
  requiredCandidates: ProductMatchCandidate[]
) {
  const mergedById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  for (const candidate of requiredCandidates) {
    mergedById.set(candidate.id, candidate);
  }

  return Array.from(mergedById.values());
}

export function bestThemeAlignedOptionForRole({
  role,
  options,
  conceptText,
  currentPick,
  localSkuFidelityMode = false
}: {
  role: RoleProductOptions;
  options: RankedProductMatch[];
  conceptText: string;
  currentPick: RankedProductMatch | undefined;
  localSkuFidelityMode?: boolean;
}) {
  if (options.length === 0 || !currentPick) {
    return null;
  }

  const preferredTokens = preferredCatalogueTokens(conceptText);
  const conflictingColors = catalogueConflictColors();

  const rankedOptions = [...options].sort((left, right) => {
    const leftScore = themeAlignedOptionScore(left, role, preferredTokens, conflictingColors, localSkuFidelityMode);
    const rightScore = themeAlignedOptionScore(right, role, preferredTokens, conflictingColors, localSkuFidelityMode);
    return rightScore - leftScore || right.score - left.score;
  });
  const bestOption = rankedOptions[0];
  const currentScore = themeAlignedOptionScore(currentPick, role, preferredTokens, conflictingColors, localSkuFidelityMode);
  const bestScore = themeAlignedOptionScore(bestOption, role, preferredTokens, conflictingColors, localSkuFidelityMode);
  const currentHasColorClash = hasThemeColorClash(currentPick, preferredTokens, conflictingColors, conceptText);
  const bestHasColorClash = hasThemeColorClash(bestOption, preferredTokens, conflictingColors, conceptText);
  const bestNonClashingOption = rankedOptions.find(
    (option) => !hasThemeColorClash(option, preferredTokens, conflictingColors, conceptText)
  );

  if (currentHasColorClash && bestNonClashingOption) {
    return bestNonClashingOption;
  }
  if (currentHasColorClash && !bestHasColorClash && bestScore >= currentScore - 20) {
    return bestOption;
  }
  return bestScore - currentScore >= 40 ? bestOption : currentPick;
}

function preferredCatalogueTokens(conceptText: string) {
  const conceptTokens = catalogueCueTokens(conceptText);
  return new Set(
    [
      "beige",
      "black",
      "blue",
      "brown",
      "cognac",
      "cream",
      "ivory",
      "grey",
      "gray",
      "gold",
      "brass",
      "bronze",
      "oak",
      "wood",
      "orange",
      "red",
      "sage",
      "green",
      "taupe",
      "travertine",
      "stone",
      "ceramic",
      "yellow"
    ].filter((token) => conceptTokens.has(token))
  );
}

function catalogueConflictColors() {
  return ["orange", "teal", "pink", "blue", "red", "purple"];
}

function themeAlignedOptionScore(
  option: RankedProductMatch,
  role: RoleProductOptions,
  preferredTokens: Set<string>,
  conflictingColors: string[],
  localSkuFidelityMode = false
) {
  const haystack = catalogueCueTokens(
    [
      option.name,
      option.color,
      option.material,
      option.description,
      option.styleTags.join(" "),
      option.colorTags.join(" "),
      option.materialTags.join(" ")
    ]
      .filter(Boolean)
      .join(" ")
  );
  let score = option.score;

  for (const token of preferredTokens) {
    if (haystack.has(token)) {
      score += 18;
    }
  }

  for (const color of conflictingColors) {
    if (haystack.has(color) && !preferredTokens.has(color)) {
      score -= 80;
    }
  }

  const roleText = `${role.category} ${role.label}`.toLowerCase();

  if (!localSkuFidelityMode) {
    if (role.category === "decor" && haystack.has("bench") && !roleText.includes("bench")) {
      score -= 45;
    }
    if (role.category === "wall_art" && (haystack.has("mirror") || haystack.has("panel"))) {
      score += 12;
    }
    if (role.category === "lighting" && option.priceAed !== null && option.priceAed < 250) {
      score -= 35;
    }
    if (option.priceAed === 0 || option.salePriceAed === 0) {
      score -= 30;
    }
    return score;
  }

  if (role.category === "decor" && haystack.has("bench") && !roleText.includes("bench")) {
    score -= 180;
  }
  if (role.category === "side_tables") {
    if (hasAnyCatalogueCue(haystack, ["bedside", "nightstand"])) {
      score -= 110;
    }
    if (hasAnyCatalogueCue(haystack, ["accent", "end", "side"])) {
      score += 36;
    }
  }
  if (role.category === "wall_art") {
    if (hasAnyCatalogueCue(haystack, ["panel", "panels", "shelf", "shelves"])) {
      score -= 95;
    }
    if (
      haystack.has("black") &&
      ["beige", "cream", "greige", "ivory", "taupe", "white"].some((token) => preferredTokens.has(token))
    ) {
      score -= 90;
    }
    if (hasAnyCatalogueCue(haystack, ["art", "artwork", "canvas", "framed", "painting", "print"])) {
      score += 28;
    }
    if (haystack.has("mirror")) {
      score -= 20;
    }
  }
  if (role.category === "lighting") {
    if (hasAnyCatalogueCue(haystack, ["spiral", "twisted", "dna", "led", "chrome", "office"])) {
      score -= 70;
    }
    if (hasAnyCatalogueCue(haystack, ["brass", "bronze", "gold", "shade", "linen"])) {
      score += 28;
    }
  }
  if (role.category === "storage") {
    if (hasAnyCatalogueCue(haystack, ["shelf", "shelves", "bookcase", "rack"])) {
      score -= 95;
    }
    if (hasAnyCatalogueCue(haystack, ["console", "credenza", "media", "sideboard", "tv"])) {
      score += 42;
    }
  }
  if (role.category === "decor") {
    if (hasAnyCatalogueCue(haystack, ["bench", "stool", "table"])) {
      score -= 90;
    }
    if (hasAnyCatalogueCue(haystack, ["bowl", "ceramic", "planter", "tray", "vase", "vessel"])) {
      score += 32;
    }
  }
  if (role.category === "lighting" && option.priceAed !== null && option.priceAed < 250) {
    score -= 35;
  }
  if (option.priceAed === 0 || option.salePriceAed === 0) {
    score -= 30;
  }

  return score;
}

function hasThemeColorClash(
  option: RankedProductMatch,
  preferredTokens: Set<string>,
  conflictingColors: string[],
  conceptText: string
) {
  const haystack = catalogueCueTokens(
    [option.name, option.color, option.description, option.colorTags.join(" ")]
      .filter(Boolean)
      .join(" ")
  );

  return conflictingColors.some(
    (color) => haystack.has(color) && !preferredTokens.has(color) && !conceptAllowsSeatingCue(conceptText, [color])
  );
}

function isCredibleAestheticDemoOption(
  option: RankedProductMatch,
  role: RoleProductOptions,
  conceptText: string,
  localSkuFidelityMode = false
) {
  const haystack = catalogueCueTokens(
    [
      option.name,
      option.color,
      option.material,
      option.description,
      option.styleTags.join(" "),
      option.colorTags.join(" "),
      option.materialTags.join(" ")
    ]
      .filter(Boolean)
      .join(" ")
  );
  const score = themeAlignedOptionScore(
    option,
    role,
    preferredCatalogueTokens(conceptText),
    catalogueConflictColors(),
    localSkuFidelityMode
  );
  const softNeutralConcept = conceptRequestsSoftNeutralUpholstery(conceptText);
  const hasUnrequestedDarkFinish =
    softNeutralConcept &&
    hasAnyCatalogueCue(haystack, ["black", "charcoal", "graphite"]) &&
    !conceptAllowsSeatingCue(conceptText, ["black", "charcoal", "graphite"]);

  if (
    localSkuFidelityMode &&
    hasUnrequestedDarkFinish &&
    ["decor", "lighting", "mirrors", "side_tables", "storage", "wall_art"].includes(role.category)
  ) {
    return false;
  }

  if (role.category === "side_tables") {
    return score >= 20 && hasAnyCatalogueCue(haystack, ["accent", "end", "side"]);
  }
  if (role.category === "sofas") {
    return (
      score >= 20 &&
      hasAnyCatalogueCue(haystack, ["chaise", "sectional", "sofa"]) &&
      !hasHardLocalSofaFidelityMismatch(option, conceptText)
    );
  }
  if (role.category === "armchairs" || role.category === "chairs") {
    const isPaletteCompatible = chairPaletteMatchesConcept(option, conceptText);
    return (
      (score >= 20 || (localSkuFidelityMode && isPaletteCompatible)) &&
      hasAnyCatalogueCue(haystack, ["accent", "armchair", "fabric", "lounge", "upholstered"]) &&
      (!localSkuFidelityMode || isPaletteCompatible) &&
      !hasAnyCatalogueCue(haystack, [
        "acapulco",
        "chipboard",
        "dining",
        "office",
        "outdoor",
        "pedestal",
        "recliner",
        "shell",
        "steel",
        "swing",
        "swivel",
        "vintage",
        "wire"
      ]) &&
      (!conceptRequestsSoftNeutralUpholstery(conceptText) ||
        !hasAnyCatalogueCue(haystack, ["cognac", "leather", "suede"]) ||
        conceptAllowsSeatingCue(conceptText, ["cognac", "leather", "suede"]))
    );
  }
  if (role.category === "coffee_tables") {
    return (
      score >= 20 &&
      hasAnyCatalogueCue(haystack, ["coffee", "table"]) &&
      !hasAnyCatalogueCue(haystack, [
        "attention",
        "bar",
        "bench",
        "black",
        "desk",
        "electra",
        "glass",
        "inlay",
        "office",
        "recamiere",
        "side",
        "steel",
        "statement",
        "striped",
        "unique"
      ])
    );
  }
  if (role.category === "rugs") {
    return score >= 20 && haystack.has("rug");
  }
  if (role.category === "lighting") {
    return (
      (score >= 20 || (localSkuFidelityMode && hasAnyCatalogueCue(haystack, ["floor", "lamp", "linen", "shade", "table"]))) &&
      !hasAnyCatalogueCue(haystack, ["dna", "kids", "moon", "night", "office", "projector", "spiral", "star", "starlight", "twisted"])
    );
  }
  if (role.category === "wall_art") {
    return (
      score >= 20 &&
      hasAnyCatalogueCue(haystack, ["art", "artwork", "canvas", "framed", "painting", "print"]) &&
      !hasAnyCatalogueCue(haystack, [
        "anime",
        "arsenal",
        "barcelona",
        "fantasy",
        "ferrari",
        "football",
        "holder",
        "hook",
        "mail",
        "messi",
        "naruto",
        "office",
        "panel",
        "panels",
        "poster",
        "rack",
        "schumacher",
        "shelf",
        "shelves",
        "sports"
      ])
    );
  }
  if (role.category === "storage") {
    return score >= 20 && hasAnyCatalogueCue(haystack, ["console", "credenza", "media", "sideboard", "tv"]);
  }
  if (role.category === "decor") {
    return (
      score >= 20 &&
      hasAnyCatalogueCue(haystack, ["bowl", "ceramic", "planter", "tray", "vase", "vessel"]) &&
      !hasAnyCatalogueCue(haystack, ["bench", "stool", "table"])
    );
  }

  return score >= 20;
}

function productFamilyTokens(option: RankedProductMatch) {
  return catalogueCueTokens(
    [
      option.name,
      option.color,
      option.material,
      option.description,
      option.styleTags.join(" "),
      option.colorTags.join(" "),
      option.materialTags.join(" ")
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function largestHorizontalDimensionCm(option: Pick<RankedProductMatch, "dimensions">) {
  const width = option.dimensions?.widthCm ?? null;
  const depth = option.dimensions?.depthCm ?? null;
  if (width === null && depth === null) {
    return null;
  }

  return Math.max(width ?? 0, depth ?? 0);
}

function explicitSectionalSofaRequested(conceptText: string) {
  const tokens = catalogueCueTokens(conceptText);
  const normalized = conceptText.toLowerCase();
  return (
    hasAnyCatalogueCue(tokens, ["chaise", "corner", "sectional", "modular"]) ||
    normalized.includes("l-shaped") ||
    normalized.includes("l shaped")
  );
}

function generousAnchorSofaRequested(conceptText: string) {
  const tokens = catalogueCueTokens(conceptText);
  return hasAnyCatalogueCue(tokens, ["family", "five", "generous", "large", "lounge", "spacious"]);
}

function hasHardLocalSofaFidelityMismatch(option: RankedProductMatch, conceptText: string) {
  const tokens = productFamilyTokens(option);
  const colorTokens = catalogueCueTokens([option.color, option.colorTags.join(" ")].filter(Boolean).join(" "));
  const largestHorizontal = largestHorizontalDimensionCm(option);
  const explicitSectional = explicitSectionalSofaRequested(conceptText);
  const generousAnchor = generousAnchorSofaRequested(conceptText);
  const softNeutralConcept = conceptRequestsSoftNeutralUpholstery(conceptText);
  const isShortSofa =
    hasAnyFamilyCue(tokens, ["1", "one", "single", "two", "2", "loveseat"]) ||
    /(?:1|2|one|two)[-\s.]*seater/i.test(option.name) ||
    (largestHorizontal !== null && largestHorizontal < (generousAnchor ? 210 : 185));
  const isSectional = hasAnyFamilyCue(tokens, ["chaise", "corner", "left", "right", "sectional", "modular"]);
  const clashesWithPalette = hasAnyFamilyCue(tokens, ["black", "blue", "orange", "red", "yellow"]);
  const requestedClashColor = ["black", "blue", "orange", "red", "yellow"].some((cue) =>
    tokens.has(cue) && conceptAllowsSeatingCue(conceptText, [cue])
  );
  const isCommercialOrUtility =
    hasAnyFamilyCue(tokens, ["bed", "office", "outdoor", "recliner"]) ||
    /sofa\s*bed|sofabed|pull[-\s]?out/i.test(option.name);
  const isHardLeatherOrDarkBrown =
    hasAnyFamilyCue(tokens, ["cognac", "leather", "suede"]) ||
    hasAnyFamilyCue(colorTokens, ["brown", "cognac"]);
  const requestedLeatherOrBrown = conceptAllowsSeatingCue(conceptText, ["brown", "cognac", "leather", "suede"]);

  return (
    !hasUsablePrice(option) ||
    (isShortSofa && generousAnchor) ||
    (isSectional && !explicitSectional) ||
    (softNeutralConcept && clashesWithPalette && !requestedClashColor) ||
    (softNeutralConcept && isHardLeatherOrDarkBrown && !requestedLeatherOrBrown) ||
    (softNeutralConcept && !hasNeutralUpholsteryCue(tokens)) ||
    isCommercialOrUtility
  );
}

function conceptRequestsSoftNeutralUpholstery(conceptText: string) {
  const tokens = catalogueCueTokens(conceptText);
  return (
    hasAnyFamilyCue(tokens, [
      "beige",
      "boucle",
      "cream",
      "ecru",
      "greige",
      "ivory",
      "linen",
      "oatmeal",
      "sand",
      "soft",
      "taupe",
      "transitional",
      "warm",
      "white"
    ]) &&
    !conceptAllowsSeatingCue(conceptText, ["black", "blue", "brown", "cognac", "leather", "orange", "red", "yellow"])
  );
}

function conceptAllowsSeatingCue(conceptText: string, cues: string[]) {
  const tokens = catalogueCueTokens(conceptText);
  if (!hasAnyFamilyCue(tokens, cues)) {
    return false;
  }

  const normalized = conceptText.toLowerCase();
  return cues.some((cue) => {
    const escapedCue = cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (
      new RegExp(`(?:${escapedCue}).{0,48}(?:armchair|chair|seat|seating|sofa|upholster)`, "i").test(normalized) ||
      new RegExp(`(?:armchair|chair|seat|seating|sofa|upholster).{0,48}(?:${escapedCue})`, "i").test(normalized)
    );
  });
}

function chairPaletteMatchesConcept(option: RankedProductMatch, conceptText: string) {
  const tokens = productFamilyTokens(option);
  const colorTokens = catalogueCueTokens([option.color, option.colorTags.join(" ")].filter(Boolean).join(" "));
  const materialTokens = catalogueCueTokens([option.material, option.materialTags.join(" ")].filter(Boolean).join(" "));
  const softNeutralConcept = conceptRequestsSoftNeutralUpholstery(conceptText);
  const neutralSeatingCues = [
    "beige",
    "cream",
    "ecru",
    "gray",
    "grey",
    "greige",
    "ivory",
    "linen",
    "oatmeal",
    "sand",
    "stone",
    "taupe",
    "white"
  ];
  const upholsteredCues = ["boucle", "chenille", "fabric", "linen", "textile", "upholstered"];

  if (softNeutralConcept) {
    return (
      hasAnyFamilyCue(colorTokens, neutralSeatingCues) &&
      (hasAnyFamilyCue(tokens, upholsteredCues) || hasAnyFamilyCue(materialTokens, upholsteredCues))
    );
  }

  const explicitColorFamilies = [
    "beige",
    "black",
    "blue",
    "brown",
    "cream",
    "cognac",
    "gray",
    "grey",
    "green",
    "greige",
    "ivory",
    "orange",
    "red",
    "sage",
    "taupe",
    "white",
    "yellow"
  ].filter((cue) => conceptAllowsSeatingCue(conceptText, [cue]));
  const explicitMaterialFamilies = ["boucle", "chenille", "fabric", "leather", "linen", "suede", "textile", "upholstered"].filter(
    (cue) => conceptAllowsSeatingCue(conceptText, [cue])
  );

  if (explicitColorFamilies.length === 0 && explicitMaterialFamilies.length === 0) {
    return !hasAnyFamilyCue(tokens, ["office", "outdoor", "pedestal", "shell", "swivel"]);
  }

  return (
    explicitColorFamilies.some((cue) => colorTokens.has(cue) || tokens.has(cue)) ||
    explicitMaterialFamilies.some((cue) => materialTokens.has(cue) || tokens.has(cue))
  );
}

function localSkuFidelityScoreAdjustment(
  option: RankedProductMatch,
  role: RoomProductRoleSpec | RoleProductOptions,
  conceptText: string,
  roomMeasurements: {
    wallLengthCm: number | null;
    roomDepthCm: number | null;
  } | null = null
) {
  const tokens = productFamilyTokens(option);
  const colorTokens = catalogueCueTokens([option.color, option.colorTags.join(" ")].filter(Boolean).join(" "));
  const reasons: string[] = [];
  const weaknessReasons: string[] = [];
  let scoreAdjustment = 0;

  if (role.category !== "sofas") {
    if (role.category === "armchairs" || role.category === "chairs") {
      const softNeutralConcept = conceptRequestsSoftNeutralUpholstery(conceptText);
      const paletteCompatible = chairPaletteMatchesConcept(option, conceptText);
      if (paletteCompatible) {
        scoreAdjustment += softNeutralConcept ? 220 : 140;
        reasons.push("chair palette and material match the approved seating family");
      }
      if (
        hasAnyFamilyCue(tokens, ["chipboard", "chrome", "shell", "swivel"]) ||
        (softNeutralConcept &&
          !conceptAllowsSeatingCue(conceptText, ["black", "blue", "brown", "cognac", "leather", "orange", "red"]) &&
          (hasAnyFamilyCue(tokens, ["black", "blue", "cognac", "leather", "orange", "red"]) ||
            hasAnyFamilyCue(colorTokens, ["brown", "black", "blue", "orange", "red"])))
      ) {
        scoreAdjustment -= 420;
        weaknessReasons.push("chair colour, material, or silhouette conflicts with the approved seating palette");
      }
      if (softNeutralConcept && !paletteCompatible) {
        scoreAdjustment -= 90;
        weaknessReasons.push("chair lacks same-family soft neutral upholstery evidence");
      }
    }
    if (role.category === "lighting") {
      if (hasAnyFamilyCue(tokens, ["kids", "moon", "multicolor", "night", "projector", "rocket", "space", "star", "starlight"])) {
        scoreAdjustment -= 420;
        weaknessReasons.push("novelty projector lighting conflicts with the refined living-room palette");
      }
      if (hasAnyFamilyCue(tokens, ["brass", "bronze", "ceramic", "floor", "gold", "linen", "shade", "table"])) {
        scoreAdjustment += 140;
        reasons.push("warm table/floor/shaded lighting supports the living-room scheme");
      }
    }
    if (role.category === "wall_art") {
      if (hasAnyFamilyCue(tokens, ["anime", "arsenal", "barcelona", "black", "fantasy", "ferrari", "football", "messi", "naruto", "navy", "office", "poster", "schumacher", "sports"])) {
        scoreAdjustment -= 420;
        weaknessReasons.push("novelty, sports, office, or fan poster wall art conflicts with the approved room direction");
      }
      if (hasAnyFamilyCue(tokens, ["abstract", "beige", "brown", "canvas", "framed", "neutral", "painting", "white"])) {
        scoreAdjustment += 90;
        reasons.push("neutral framed or canvas wall art supports the room direction");
      }
    }
    return { scoreAdjustment, reasons, weaknessReasons };
  }

  const largestHorizontal = largestHorizontalDimensionCm(option);
  const sofaLengthRange = roomMeasurements?.wallLengthCm
    ? {
        minCm: Math.max(205, Math.round(roomMeasurements.wallLengthCm * 0.42)),
        maxCm: Math.min(340, Math.round(roomMeasurements.wallLengthCm * 0.66))
      }
    : { minCm: 210, maxCm: 330 };
  const explicitSectional = explicitSectionalSofaRequested(conceptText);
  const generousAnchor = generousAnchorSofaRequested(conceptText);
  const softNeutralConcept = conceptRequestsSoftNeutralUpholstery(conceptText);
  const isSectional = hasAnyFamilyCue(tokens, ["chaise", "corner", "left", "right", "sectional", "modular"]);
  const isShortSofa =
    hasAnyFamilyCue(tokens, ["1", "one", "single", "two", "2", "loveseat"]) ||
    /(?:1|2|one|two)[-\s.]*seater/i.test(option.name) ||
    (largestHorizontal !== null && largestHorizontal < (generousAnchor ? 210 : 185));

  if (!hasUsablePrice(option)) {
    scoreAdjustment -= 500;
    weaknessReasons.push("sofa has no usable catalogue price");
  }
  if (isShortSofa && generousAnchor) {
    scoreAdjustment -= 650;
    weaknessReasons.push("short sofa cannot satisfy a generous family anchor-seating role");
  }
  if (largestHorizontal !== null && !isSectional && largestHorizontal < sofaLengthRange.minCm) {
    scoreAdjustment -= 360;
    weaknessReasons.push(`sofa length is below the spatial target range (${sofaLengthRange.minCm}-${sofaLengthRange.maxCm} cm)`);
  }
  if (largestHorizontal !== null && !isSectional && largestHorizontal > sofaLengthRange.maxCm) {
    scoreAdjustment -= 180;
    weaknessReasons.push(`sofa length is above the spatial target range (${sofaLengthRange.minCm}-${sofaLengthRange.maxCm} cm)`);
  }
  if (isSectional && !explicitSectional) {
    scoreAdjustment -= 520;
    weaknessReasons.push("sectional or corner sofa was not requested for this straight-sofa composition");
  }
  if (
    softNeutralConcept &&
    hasAnyFamilyCue(tokens, ["black", "blue", "orange", "red", "yellow"]) &&
    !["black", "blue", "orange", "red", "yellow"].some((cue) => tokens.has(cue) && conceptAllowsSeatingCue(conceptText, [cue]))
  ) {
    scoreAdjustment -= 360;
    weaknessReasons.push("sofa colour conflicts with the soft neutral palette");
  }
  if (
    softNeutralConcept &&
    (hasAnyFamilyCue(tokens, ["cognac", "leather", "suede"]) ||
      hasAnyFamilyCue(colorTokens, ["brown", "cognac"])) &&
    !conceptAllowsSeatingCue(conceptText, ["brown", "cognac", "leather", "suede"])
  ) {
    scoreAdjustment -= 420;
    weaknessReasons.push("brown or leather sofa upholstery is weak for the soft neutral fabric palette");
  }
  if (softNeutralConcept && !hasNeutralUpholsteryCue(tokens)) {
    scoreAdjustment -= 260;
    weaknessReasons.push("sofa lacks neutral upholstery evidence for this concept");
  }
  if (
    hasAnyFamilyCue(tokens, ["bed", "office", "outdoor", "recliner"]) ||
    /sofa\s*bed|sofabed|pull[-\s]?out/i.test(option.name)
  ) {
    scoreAdjustment -= 280;
    weaknessReasons.push("utility sofa language is weak for the investor-demo living-room anchor");
  }
  if (
    hasAnyFamilyCue(tokens, ["beige", "boucle", "cream", "ecru", "fabric", "greige", "ivory", "linen", "oatmeal", "sand", "taupe", "white"]) &&
    largestHorizontal !== null &&
    largestHorizontal >= sofaLengthRange.minCm &&
    largestHorizontal <= sofaLengthRange.maxCm &&
    !isSectional
  ) {
    scoreAdjustment += 320;
    reasons.push(`neutral full-size fabric sofa fits the spatial target range (${sofaLengthRange.minCm}-${sofaLengthRange.maxCm} cm)`);
  }
  if (hasAnyFamilyCue(tokens, ["3", "4", "three", "four"]) || /(?:3|4|three|four)[-\s.]*seater/i.test(option.name)) {
    scoreAdjustment += 80;
    reasons.push("multi-seat sofa scale matches the living-room anchor role");
  }

  return { scoreAdjustment, reasons, weaknessReasons };
}

function hasSharedCue(left: Set<string>, right: Set<string>, cues: string[]) {
  return cues.some((cue) => left.has(cue) && right.has(cue));
}

function hasAnyFamilyCue(tokens: Set<string>, cues: string[]) {
  return cues.some((cue) => tokens.has(cue));
}

function hasConflictFamilyCue(tokens: Set<string>) {
  return hasAnyFamilyCue(tokens, ["black", "blue", "chrome", "orange", "pink", "purple", "red", "teal"]);
}

function hasReferenceColorOrMaterialFamilyCue(tokens: Set<string>, referenceTokens: Set<string>) {
  const seatingColorCues = [
    "beige",
    "black",
    "blue",
    "brown",
    "cognac",
    "cream",
    "ecru",
    "gray",
    "grey",
    "green",
    "greige",
    "ivory",
    "oatmeal",
    "orange",
    "red",
    "sage",
    "sand",
    "taupe",
    "white",
    "yellow"
  ];
  const seatingMaterialCues = ["boucle", "chenille", "fabric", "leather", "linen", "suede", "teddy", "textile", "upholstered"];

  return (
    hasSharedCue(tokens, referenceTokens, seatingColorCues) ||
    hasSharedCue(tokens, referenceTokens, seatingMaterialCues)
  );
}

function hasNeutralUpholsteryCue(tokens: Set<string>) {
  return (
    hasAnyFamilyCue(tokens, ["beige", "boucle", "cream", "ecru", "greige", "ivory", "linen", "oatmeal", "sand", "taupe", "white"]) ||
    hasAnyFamilyCue(tokens, ["chenille", "fabric", "textile", "upholstered"])
  );
}

function hasUsablePrice(option: RankedProductMatch) {
  const price = option.salePriceAed ?? option.priceAed;
  return price !== null && price > 0;
}

function isSameRecommendationFamily({
  option,
  reference,
  role
}: {
  option: RankedProductMatch;
  reference: RankedProductMatch;
  role: RoleProductOptions;
}) {
  if (option.id === reference.id) {
    return true;
  }
  if (option.categoryNormalized !== reference.categoryNormalized) {
    return false;
  }

  const optionTokens = productFamilyTokens(option);
  const referenceTokens = productFamilyTokens(reference);
  const neutralCues = ["beige", "cream", "ecru", "greige", "ivory", "linen", "oatmeal", "sand", "taupe", "white"];
  const warmWoodCues = ["brown", "oak", "walnut", "wood"];
  const fabricCues = ["boucle", "chenille", "fabric", "linen", "teddy", "textile", "upholstered"];
  const leatherCues = ["cognac", "leather", "suede"];
  const stoneCues = ["ceramic", "marble", "stone", "travertine"];
  const blackOrChromeCues = ["black", "chrome", "silver"];

  if (
    hasAnyFamilyCue(optionTokens, catalogueConflictColors()) &&
    !hasSharedCue(optionTokens, referenceTokens, catalogueConflictColors())
  ) {
    return false;
  }

  if (role.category === "sofas" || role.category === "armchairs" || role.category === "chairs") {
    if (!hasUsablePrice(option)) {
      return false;
    }
    if (hasConflictFamilyCue(optionTokens) && !hasReferenceColorOrMaterialFamilyCue(optionTokens, referenceTokens)) {
      return false;
    }
    if (
      role.category === "sofas" &&
      hasAnyFamilyCue(optionTokens, ["left", "right", "sectional", "corner", "chaise", "modular"]) !==
        hasAnyFamilyCue(referenceTokens, ["left", "right", "sectional", "corner", "chaise", "modular"])
    ) {
      return false;
    }
    if (
      hasAnyFamilyCue(optionTokens, blackOrChromeCues) &&
      !hasSharedCue(optionTokens, referenceTokens, blackOrChromeCues) &&
      !hasReferenceColorOrMaterialFamilyCue(optionTokens, referenceTokens)
    ) {
      return false;
    }
    if (
      hasAnyFamilyCue(optionTokens, leatherCues) &&
      !hasSharedCue(optionTokens, referenceTokens, leatherCues) &&
      !hasReferenceColorOrMaterialFamilyCue(optionTokens, referenceTokens)
    ) {
      return false;
    }
    return (
      hasSharedCue(optionTokens, referenceTokens, neutralCues) ||
      hasSharedCue(optionTokens, referenceTokens, fabricCues) ||
      hasSharedCue(optionTokens, referenceTokens, warmWoodCues) ||
      hasReferenceColorOrMaterialFamilyCue(optionTokens, referenceTokens)
    );
  }

  if (role.category === "coffee_tables") {
    if (!hasUsablePrice(option)) {
      return false;
    }
    if (hasAnyCatalogueCue(optionTokens, ["desk", "office", "side", "striped", "statement"])) {
      return false;
    }
    return (
      hasSharedCue(optionTokens, referenceTokens, warmWoodCues) ||
      hasSharedCue(optionTokens, referenceTokens, stoneCues) ||
      hasSharedCue(optionTokens, referenceTokens, ["round", "oval", "low"])
    );
  }

  if (role.category === "rugs" || role.category === "curtains") {
    if (!hasUsablePrice(option)) {
      return false;
    }
    return (
      hasSharedCue(optionTokens, referenceTokens, neutralCues) ||
      hasSharedCue(optionTokens, referenceTokens, ["greige", "plain", "solid", "wool"])
    );
  }

  if (role.category === "lighting") {
    if (!hasUsablePrice(option)) {
      return false;
    }
    return (
      hasSharedCue(optionTokens, referenceTokens, ["brass", "bronze", "gold", "linen", "shade"]) ||
      hasSharedCue(optionTokens, referenceTokens, ["floor", "lamp", "table"])
    );
  }

  if (role.category === "storage" || role.category === "side_tables") {
    if (!hasUsablePrice(option)) {
      return false;
    }
    return (
      hasSharedCue(optionTokens, referenceTokens, warmWoodCues) ||
      hasSharedCue(optionTokens, referenceTokens, ["console", "media", "sideboard", "tv"])
    );
  }

  if (role.category === "wall_art" || role.category === "mirrors" || role.category === "decor") {
    return true;
  }

  return true;
}

function preserveCatalogueAnchorRoleOptions({
  roleOptions,
  ranked,
  rankedById,
  catalogueGroundingAnchors,
  optionsPerRole
}: {
  roleOptions: RoleProductOptions[];
  ranked: RankedProductMatch[];
  rankedById: Map<string, RankedProductMatch>;
  catalogueGroundingAnchors: CatalogueGroundingAnchor[];
  optionsPerRole: number;
}) {
  if (catalogueGroundingAnchors.length === 0) {
    return roleOptions;
  }

  const roleOptionsByCategory = new Map(roleOptions.map((role) => [role.category, role]));

  for (const anchor of catalogueGroundingAnchors) {
    const category = normalizeSourcingCategory(anchor.category, anchor.roleLabel);
    const anchorMatch = rankedById.get(anchor.productId);
    if (!anchorMatch) {
      continue;
    }

    const existingRole = roleOptionsByCategory.get(category);
    const role =
      existingRole ??
      ({
        category,
        label: anchor.roleLabel,
        visualBrief: anchor.selectionReason,
        quantity: 1,
        priority: anchor.priority,
        options: []
      } satisfies RoleProductOptions);

    const preservedAnchor = {
      ...anchorMatch,
      selectionReason: [anchorMatch.selectionReason, "catalogue-grounded concept anchor"].join("; ")
    };
    const optionsById = new Map(role.options.map((option) => [option.id, option]));
    optionsById.set(anchor.productId, preservedAnchor);
    const remainingOptions = role.options.filter((option) => option.id !== anchor.productId);
    roleOptionsByCategory.set(category, {
      ...role,
      options: [preservedAnchor, ...remainingOptions].slice(0, Math.max(1, optionsPerRole))
    });
  }

  const ordered = roleOptions.map((role) => roleOptionsByCategory.get(role.category) ?? role);
  const orderedCategories = new Set(ordered.map((role) => role.category));
  for (const match of ranked) {
    const anchor = catalogueGroundingAnchors.find((candidate) => candidate.productId === match.id);
    if (!anchor) {
      continue;
    }
    const category = normalizeSourcingCategory(anchor.category, anchor.roleLabel);
    const role = roleOptionsByCategory.get(category);
    if (role && !orderedCategories.has(category)) {
      ordered.push(role);
      orderedCategories.add(category);
    }
  }

  return ordered;
}

export function polishRoleOptionsForAestheticDemo({
  roleOptions,
  ranked,
  rankedById,
  catalogueGroundingAnchors,
  conceptText,
  localSkuFidelityMode,
  optionsPerRole
}: {
  roleOptions: RoleProductOptions[];
  ranked: RankedProductMatch[];
  rankedById: Map<string, RankedProductMatch>;
  catalogueGroundingAnchors: CatalogueGroundingAnchor[];
  conceptText: string;
  localSkuFidelityMode: boolean;
  optionsPerRole: number;
}) {
  const preserved = preserveCatalogueAnchorRoleOptions({
    roleOptions,
    ranked,
    rankedById,
    catalogueGroundingAnchors,
    optionsPerRole
  });

  if (!localSkuFidelityMode) {
    return preserved;
  }

  const anchorIdsByCategory = new Map<string, Set<string>>();
  for (const anchor of catalogueGroundingAnchors) {
    const category = normalizeSourcingCategory(anchor.category, anchor.roleLabel);
    const anchorIds = anchorIdsByCategory.get(category) ?? new Set<string>();
    anchorIds.add(anchor.productId);
    anchorIdsByCategory.set(category, anchorIds);
  }

  return preserved
    .map((role) => {
      const anchorIds = anchorIdsByCategory.get(role.category) ?? new Set<string>();
      const sortedOptions = [...role.options].sort((left, right) => {
        const leftIsAnchor = anchorIds.has(left.id);
        const rightIsAnchor = anchorIds.has(right.id);
        if (!localSkuFidelityMode && leftIsAnchor && !rightIsAnchor) {
          return -1;
        }
        if (!localSkuFidelityMode && !leftIsAnchor && rightIsAnchor) {
          return 1;
        }
        return (
          themeAlignedOptionScore(
            right,
            role,
            preferredCatalogueTokens(conceptText),
            catalogueConflictColors(),
            localSkuFidelityMode
          ) -
            themeAlignedOptionScore(
              left,
              role,
              preferredCatalogueTokens(conceptText),
              catalogueConflictColors(),
              localSkuFidelityMode
            ) ||
          right.score - left.score
        );
      });
      const anchorOptions = localSkuFidelityMode
        ? sortedOptions.filter(
            (option) => anchorIds.has(option.id) && isCredibleAestheticDemoOption(option, role, conceptText, localSkuFidelityMode)
          )
        : sortedOptions.filter((option) => anchorIds.has(option.id));
      const referenceOption =
        (localSkuFidelityMode
          ? sortedOptions.find((option) => isCredibleAestheticDemoOption(option, role, conceptText, localSkuFidelityMode))
          : anchorOptions[0]) ??
        anchorOptions[0] ??
        sortedOptions.find((option) => isCredibleAestheticDemoOption(option, role, conceptText, localSkuFidelityMode));
      const credibleOptions = sortedOptions.filter(
        (option) => !anchorIds.has(option.id) && isCredibleAestheticDemoOption(option, role, conceptText, localSkuFidelityMode)
      );
      const familyOptions = referenceOption
        ? credibleOptions.filter((option) =>
            isSameRecommendationFamily({
              option,
              reference: referenceOption,
              role
            })
          )
        : credibleOptions;
      const polishedOptions = anchorOptions.length > 0
        ? [...anchorOptions, ...familyOptions]
        : referenceOption
          ? [referenceOption, ...familyOptions.filter((option) => option.id !== referenceOption.id)]
          : familyOptions;

      return {
        ...role,
        options: polishedOptions.slice(0, Math.max(1, optionsPerRole))
      };
    })
    .filter((role) => role.options.length > 0);
}

export function ensureLocalSkuFidelitySupportOptions({
  roleOptions,
  roles,
  ranked,
  conceptText,
  localSkuFidelityMode
}: {
  roleOptions: RoleProductOptions[];
  roles: RoomProductRoleSpec[];
  ranked: RankedProductMatch[];
  conceptText: string;
  localSkuFidelityMode: boolean;
}) {
  if (!localSkuFidelityMode) {
    return roleOptions;
  }

  const roleOptionsByCategory = new Map(roleOptions.map((role) => [role.category, role]));
  for (const role of roles) {
    if (roleOptionsByCategory.has(role.category)) {
      continue;
    }

    const options = ranked
      .filter((option) => (option.categoryNormalized ?? "") === role.category)
      .filter((option) =>
        isCredibleAestheticDemoOption(
          option,
          {
            category: role.category,
            label: role.label,
            visualBrief: role.visualBrief,
            quantity: role.quantity,
            priority: role.priority,
            options: []
          },
          conceptText,
          localSkuFidelityMode
        )
      )
      .slice(0, 6);

    if (options.length > 0) {
      roleOptionsByCategory.set(role.category, {
        category: role.category,
        label: role.label,
        visualBrief: role.visualBrief,
        quantity: role.quantity,
        priority: role.priority,
        options
      });
    }
  }

  return roles
    .map((role) => roleOptionsByCategory.get(role.category))
    .filter((role): role is RoleProductOptions => Boolean(role));
}

export function mergeRoomRoles(primary: RoomProductRoleSpec[], secondary: RoomProductRoleSpec[]) {
  const roles: RoomProductRoleSpec[] = [];
  const categories = new Set<string>();

  for (const role of [...primary, ...secondary]) {
    if (categories.has(role.category)) {
      continue;
    }

    roles.push(role);
    categories.add(role.category);
  }

  return roles;
}

export function poolToSourcingRolePool(pool: RoleScopedCandidatePool, allowedCandidateIds: Set<string>) {
  return {
    category: pool.role.category,
    roleLabel: pool.role.label,
    visualBrief: pool.role.visualBrief,
    quantity: pool.role.quantity,
    priority: pool.role.priority,
    candidateIds: pool.candidates
      .map((candidate) => candidate.id)
      .filter((candidateId) => allowedCandidateIds.has(candidateId))
  };
}

export function roleCandidateCountSummary(pools: RoleScopedCandidatePool[]) {
  return pools.map((pool) => ({
    category: pool.role.category,
    roleLabel: pool.role.label,
    priority: pool.role.priority,
    candidateCount: pool.candidateCount,
    rejectedCount: pool.rejectedCount,
    rejectionReasons: pool.rejectionReasons,
    weaknessReasons: pool.weaknessReasons
  }));
}

export function roleStatusSummary(
  roleResults: Array<{
    category: string;
    roleLabel: string;
    status: string;
    productId: string | null;
    reason: string;
  }>
) {
  return roleResults.map((result) => ({
    category: normalizeSourcingCategory(result.category, result.roleLabel),
    roleLabel: result.roleLabel,
    status: result.status,
    productId: result.productId,
    reason: result.reason
  }));
}

export function roleConfidenceOutputFields(
  pools: RoleScopedCandidatePool[],
  roleResults: Array<{
    category: string;
    roleLabel: string;
    status: "strong_match" | "acceptable_match" | "closest_available" | "missing_required" | "missing_supporting";
    productId: string | null;
    reason: string;
  }>,
  nowMs: number,
  roomMeasurements: {
    wallLengthCm: number | null;
    roomDepthCm: number | null;
  } | null = null,
  visualSourcingDiagnostics: ReturnType<typeof productSourcingTimeoutDiagnostics> | null = null
) {
  const roleConfidence = productMatchConfidenceOutputSummary({
    pools,
    roleResults: roleResults.map((result) => ({
      ...result,
      category: normalizeSourcingCategory(result.category, result.roleLabel)
    })),
    nowMs,
    roomMeasurements
  });
  const requiredRoles = pools
    .filter((pool) => pool.role.priority === "required")
    .map((pool) =>
      productMatchRequiredRoleDescriptor({
        category: pool.role.category,
        roleLabel: pool.role.label
      })
    );

  return {
    roleConfidence,
    roleConfidenceGate: productMatchQaStopRuleOutputSummary({ roleConfidence, requiredRoles }),
    visualSourcingEvidence: buildProductMatchVisualSourcingEvidence({
      diagnostics: visualSourcingDiagnostics,
      roleConfidence
    })
  };
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

export function formatAedValue(value: number) {
  return `AED ${value.toLocaleString("en-AE", {
    maximumFractionDigits: 0
  })}`;
}

