import {
  extractConceptImagePalette,
  sourceProductsFromConcept,
  stageTextConfig,
  sumUsdCosts
} from "@ritzy-studio/ai";
import { configuredTextModel, productMatchingControlledPreviewGate } from "@ritzy-studio/config";
import {
  buildProductSourcingRuntimePlan,
  buildRoleScopedCandidatePools,
  buildShoppingListItemRows,
  buildPersistedSelectionSnapshot,
  composeRoomProductOptions,
  conceptPaletteMatchingText,
  enhancedProductRolesForRoom,
  fitSelectionToBudget,
  parseConceptImagePalette,
  productRolesForRoom,
  rankProductMatches,
  selectedItemsTotalAed,
  summarizeRolePoolDiversity,
  summarizeRolePoolQuality,
  summarizePoolQaRollup,
  type ProductMatchCandidate,
  type RankedProductMatch,
  type RoomProductRoleSpec
} from "@ritzy-studio/domain";

import { localSkuFidelityModeEnabled } from "@/lib/render-flags";
import { PRODUCT_SOURCING_MAX_IMAGE_BYTES } from "@/lib/render-images";
import {
  isProviderImageDownloadError,
  isProductSourcingTimeoutError,
  productSourcingTimeoutMessage
} from "@/lib/product-sourcing-failure";
import { buildProductSourcingTextFallbackResult } from "@/lib/product-sourcing-text-fallback";
import {
  productSourcingRetryFallbackEvidenceForStrategy,
  productSourcingVisualStrategy
} from "@/lib/product-sourcing-visual-strategy";
import {
  buildProductImagePreflightGate,
  preflightProductCandidateImages,
  skippedProductImagePreflight,
  type ProductImagePreflightSummary
} from "@/lib/product-image-preflight";

import {
  LOCAL_SKU_FIDELITY_CANDIDATES_PER_ROLE,
  PRODUCT_MATCHING_CATALOG_LIMIT,
  PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_DETAIL,
  PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT,
  PRODUCT_SOURCING_AI_CONCEPT_IMAGE_DETAIL,
  PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED,
  PRODUCT_SOURCING_AI_TIMEOUT_MS,
  PRODUCT_SOURCING_IMAGE_PREFLIGHT_BUDGET_MS,
  PRODUCT_SOURCING_IMAGE_PREFLIGHT_TIMEOUT_MS,
  bestThemeAlignedOptionForRole,
  catalogUnavailableMessage,
  catalogueGroundingAnchorsForConcept,
  ensureLocalSkuFidelitySupportOptions,
  fetchLocalSkuFidelityRoleWindowCandidates,
  fetchProductsById,
  isRecord,
  matchToSourcingCandidate,
  mergeProductMatchCandidates,
  mergeRoomRoles,
  normalizeSourcingCategory,
  polishRoleOptionsForAestheticDemo,
  poolToSourcingRolePool,
  previousShoppingListRefreshHistory,
  productImageCatalogRefreshMessage,
  productSourcingAiPayloadSummary,
  productSourcingFailureMessage,
  productSourcingTimeoutDiagnostics,
  type ProductRow,
  productToMatchCandidate,
  roleScopedShoppingAlternates,
  shoppingListRoleSpecFromRow,
  rankMatchesForLocalSkuFidelity,
  recentlyUsedProductIdsForUser,
  rerankRolePoolForAestheticFit,
  roleCandidateCountSummary,
  roleConfidenceOutputFields,
  roleScopedCandidatesForLocalSkuFidelityPlan,
  roleStatusSummary,
  sourcingCandidateImageDataUrls,
  splitAvoidColorCues
} from "./sourcing-support";
import type { ServiceSupabaseClient, UserSupabaseClient } from "./supabase-clients";
import { storageImageDataUrl } from "./storage-images";

// The product-sourcing service (S1 extraction): typed inputs and results, all
// persisted state transitions owned here. Blocked terminals collapse to one
// { status: "blocked", message } shape because every pre-extraction terminal was
// a message redirect back to product matching; S3 re-types these as it reworks
// sourcing against the confirmed spec.

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function productMatchingEngineV1Enabled() {
  return process.env.RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED === "true";
}

function productMatchingEngineV1EnabledForRequest({
  projectId,
  roomId,
  userId,
  userEmail,
  roomType
}: {
  projectId: string;
  roomId: string;
  userId: string;
  userEmail?: string | null;
  roomType: string;
}) {
  const engineFlagEnabled = productMatchingEngineV1Enabled();
  const previewGate = productMatchingControlledPreviewGate({
    env: process.env,
    projectId,
    roomId,
    userId,
    userEmail
  });

  return {
    enabled:
      (engineFlagEnabled && (!previewGate.configured || previewGate.allowed)) ||
      localSkuFidelityModeEnabled(roomType),
    gate: previewGate
  };
}



export type GroundProductsInput = {
  userId: string;
  userEmail: string | null;
  projectId: string;
  roomId: string;
  conceptId: string;
};

export type GroundProductsResult =
  | { status: "not_found" }
  | { status: "blocked"; message: string }
  | { status: "sourced" };

export async function groundProductsForRoom(
  { supabase, serviceSupabase }: { supabase: UserSupabaseClient; serviceSupabase: ServiceSupabaseClient },
  { userId, userEmail, projectId, roomId, conceptId }: GroundProductsInput
): Promise<GroundProductsResult> {
  const { data: project } = await supabase
    .from("projects")
    .select("id, budget_max_aed")
    .eq("id", projectId)
    .single();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  const { data: concept } = await supabase
    .from("concepts")
    .select("id, title, description, status, generation_job_id, palette_json, primary_image_asset:room_assets!concepts_primary_image_asset_id_fkey(*)")
    .eq("id", conceptId)
    .eq("room_id", roomId)
    .single();

  if (!project || !room || !concept) {
    return { status: "not_found" };
  }

  if (concept.status !== "selected") {
    return { status: "blocked", message: "Select a concept before product grounding." };
  }

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("wall_length_cm, room_depth_cm")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // The user's explicit avoid-colour instruction (brief avoid_notes, e.g. "avoid bright red") must
  // reach product matching. The concept-image palette's avoidColors is an inferred signal and can
  // miss what the user asked for, so union the two before the sourcing avoid-colour filter runs.
  const { data: sourcingDesignBrief } = await supabase
    .from("design_briefs")
    .select("avoid_notes")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseConceptText = `${concept.title}\n${concept.description ?? ""}`;
  const blueprintRoles: RoomProductRoleSpec[] = enhancedProductRolesForRoom(room.room_type).map((role) => ({
    category: role.category,
    label: role.label,
    visualBrief: role.visualBrief ?? null,
    quantity: role.quantity,
    priority: role.required ? "required" : "supporting"
  }));
  const localSkuFidelityMode = localSkuFidelityModeEnabled(room.room_type);

  const { data: products = [], error: productsError } = await serviceSupabase
    .from("products")
    .select(
      `
      *,
      retailer:retailers(name, status),
      dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
    `
    )
    .not("price_aed", "is", null)
    .not("primary_image_url", "is", null)
    .order("last_checked_at", { ascending: false, nullsFirst: false })
    .limit(PRODUCT_MATCHING_CATALOG_LIMIT);

  if (productsError) {
    throw new Error(productsError.message);
  }

  const candidates = (products ?? [])
    .map(productToMatchCandidate)
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));
  const localRoleWindowCandidates = localSkuFidelityMode
    ? await fetchLocalSkuFidelityRoleWindowCandidates({
        serviceSupabase,
        roomType: room.room_type,
        roles: blueprintRoles,
        conceptText: baseConceptText
      })
    : [];

  if (candidates.length === 0) {
    const message = catalogUnavailableMessage(products ?? []);
    return { status: "blocked", message: message };
  }

  const catalogueGroundingAnchors = await catalogueGroundingAnchorsForConcept({
    serviceSupabase,
    generationJobId: concept.generation_job_id
  });
  const catalogueAnchorIdsByCategory = new Map(
    catalogueGroundingAnchors.map((anchor) => [
      normalizeSourcingCategory(anchor.category, anchor.roleLabel),
      anchor.productId
    ])
  );
  const catalogueAnchorProducts = await fetchProductsById({
    serviceSupabase,
    productIds: catalogueGroundingAnchors.map((anchor) => anchor.productId)
  });
  const catalogueAnchorCandidates = catalogueAnchorProducts
    .map(productToMatchCandidate)
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));
  const matchingCandidates = mergeProductMatchCandidates(
    mergeProductMatchCandidates(candidates, localRoleWindowCandidates),
    catalogueAnchorCandidates
  );

  const conceptImageAsset = Array.isArray(concept.primary_image_asset)
    ? concept.primary_image_asset[0]
    : concept.primary_image_asset;
  const conceptImageVisionUrl = conceptImageAsset?.storage_path
    ? await storageImageDataUrl(
        serviceSupabase,
        "generated-renders",
        conceptImageAsset.storage_path,
        conceptImageAsset.mime_type
      )
    : null;
  const conceptSignedImage = conceptImageVisionUrl ? { signedUrl: conceptImageVisionUrl } : null;
  if (!conceptSignedImage?.signedUrl) {
    return { status: "blocked", message: "Product sourcing needs the concept image before it can match catalog pieces." };
  }

  // Aesthetic coherence is scored against the palette of the concept image as
  // rendered (extracted once, cached on the concept row), not only against the
  // concept's text tokens. Extraction failure degrades to text-only matching.
  let conceptPalette = parseConceptImagePalette(concept.palette_json);
  let paletteTextCostUsd: number | null = null;
  let initialSourcingTextCostUsd: number | null = null;
  if (!conceptPalette) {
    try {
      const paletteResult = await extractConceptImagePalette({
        imageUrl: conceptSignedImage.signedUrl
      });
      paletteTextCostUsd = paletteResult.textCostUsd ?? null;
      conceptPalette = paletteResult.palette;
      await serviceSupabase
        .from("concepts")
        .update({ palette_json: conceptPalette })
        .eq("id", concept.id);
    } catch (error) {
      console.error("Concept palette extraction failed; matching falls back to text tokens.", error);
    }
  }
  const conceptPaletteText = conceptPalette ? conceptPaletteMatchingText(conceptPalette) : null;
  const paletteGroundedConceptText = conceptPaletteText
    ? `${baseConceptText}
${conceptPaletteText}`
    : baseConceptText;
  const briefAvoidColorTags = splitAvoidColorCues(sourcingDesignBrief?.avoid_notes ?? "").avoidColorTags;
  const conceptAvoidColorTags = Array.from(
    new Set([...(conceptPalette?.avoidColors ?? []), ...briefAvoidColorTags])
  );

  const productMatchingPreview = productMatchingEngineV1EnabledForRequest({
    projectId,
    roomId,
    userId: userId,
    userEmail,
    roomType: room.room_type
  });
  const productMatchingEngineEnabled = productMatchingPreview.enabled;
  const recentlyUsedProductIds = await recentlyUsedProductIdsForUser({
    serviceSupabase,
    userId: userId,
    excludeRoomId: roomId
  });
  const candidatesPerRole = localSkuFidelityMode ? LOCAL_SKU_FIDELITY_CANDIDATES_PER_ROLE : 6;
  const flatCandidateLimit = localSkuFidelityMode
    ? Math.max(72, blueprintRoles.length * candidatesPerRole)
    : 36;
  const sourcingPlan = buildProductSourcingRuntimePlan({
    engineEnabled: productMatchingEngineEnabled,
    roomType: room.room_type,
    conceptText: paletteGroundedConceptText,
    roles: blueprintRoles,
    candidates: matchingCandidates,
    recentlyUsedProductIds,
    avoidColorTags: conceptAvoidColorTags,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? {
          wallLengthCm: measurements.wall_length_cm,
          roomDepthCm: measurements.room_depth_cm
        }
      : null,
    candidatesPerRole,
    flatCandidateLimit
  });
  const sourcingPools = localSkuFidelityMode
    ? sourcingPlan.roleScopedPools.map((pool) =>
        rerankRolePoolForAestheticFit(pool, room.room_type, paletteGroundedConceptText)
      )
    : sourcingPlan.roleScopedPools;
  const sourcingCandidates = localSkuFidelityMode
    ? roleScopedCandidatesForLocalSkuFidelityPlan(sourcingPools, flatCandidateLimit)
    : sourcingPlan.candidates;
  const legacyRequiredRoles: RoomProductRoleSpec[] = productRolesForRoom(room.room_type)
    .filter((role) => role.required)
    .map((role) => ({
      category: role.category,
      label: role.label,
      visualBrief: role.visualBrief ?? null,
      quantity: role.quantity,
      priority: "required"
    }));
  const staticRoles = mergeRoomRoles(blueprintRoles, legacyRequiredRoles);
  // Only fetch when the AI actually consumes product images; otherwise the gate and sanitized
  // candidates are discarded, so a slow CDN would add up to the whole preflight budget for nothing.
  const initialImagePreflight = PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED
    ? await preflightProductCandidateImages(sourcingCandidates, {
        timeoutMs: PRODUCT_SOURCING_IMAGE_PREFLIGHT_TIMEOUT_MS,
        budgetMs: PRODUCT_SOURCING_IMAGE_PREFLIGHT_BUDGET_MS,
        maxBytes: PRODUCT_SOURCING_MAX_IMAGE_BYTES
      })
    : skippedProductImagePreflight(sourcingCandidates);
  const aiSourcingCandidates = PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED
    ? initialImagePreflight.candidates
    : sourcingCandidates;
  const sourcingCandidateIds = new Set(sourcingCandidates.map((candidate) => candidate.id));
  const sourcingCandidatePools = sourcingPools.map((pool) => poolToSourcingRolePool(pool, sourcingCandidateIds));
  const initialImageGate = buildProductImagePreflightGate({
    candidateCount: sourcingCandidates.length,
    acceptedCandidateIds: initialImagePreflight.acceptedCandidateIds,
    rolePools: sourcingPools
  });
  const rolePoolDiversity = productMatchingEngineEnabled ? summarizeRolePoolDiversity(sourcingPools) : undefined;
  const rolePoolQuality = productMatchingEngineEnabled ? summarizeRolePoolQuality(sourcingPools) : undefined;
  const productMatchingRoomMeasurements = measurements
    ? {
        wallLengthCm: measurements.wall_length_cm,
        roomDepthCm: measurements.room_depth_cm
      }
    : null;
  let latestConfidencePools = sourcingPools;
  const productMatchingLoggedAtMs = Date.now();
  const { data: sourcingJob, error: sourcingJobError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: userId,
      room_id: roomId,
      job_type: "product_visual_sourcing",
      status: "running",
      provider: "openai",
      model: stageTextConfig("product_sourcing", configuredTextModel()).model,
      prompt_version: null,
      input_summary: {
        roomId,
        conceptId: concept.id,
        productMatchingEngineEnabled,
        localSkuFidelityMode,
        productMatchingPreviewGate: {
          configured: productMatchingPreview.gate.configured,
          enabled: productMatchingPreview.gate.enabled,
          allowed: productMatchingPreview.gate.allowed,
          matchedScopes: productMatchingPreview.gate.matchedScopes
        },
        candidateCount: sourcingCandidates.length,
        productSourcingAiPayload: productSourcingAiPayloadSummary(),
        productImagePreflight: initialImagePreflight.summary,
        productImagePreflightGate: initialImageGate,
        blueprintRoleCount: blueprintRoles.length,
        roleCandidateCounts: productMatchingEngineEnabled ? roleCandidateCountSummary(sourcingPools) : undefined,
        rolePoolDiversity,
        rolePoolQuality,
        rolePoolQaRollup:
          rolePoolQuality && rolePoolDiversity
            ? summarizePoolQaRollup({
                rolePoolQuality,
                rolePoolDiversity
              })
            : undefined
      }
    })
    .select("id")
    .single();

  if (sourcingJobError) {
    throw new Error(sourcingJobError.message);
  }

  if (PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED && !initialImageGate.usable) {
    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "Product visual sourcing did not have enough AI-usable product images.",
        output_summary: {
          productMatchingEngineEnabled,
          localSkuFidelityMode,
          productSourcingAiPayload: productSourcingAiPayloadSummary(),
          productImagePreflight: initialImagePreflight.summary,
          productImagePreflightGate: initialImageGate,
          usableProductImageCount: initialImagePreflight.summary.acceptedCount,
          minUsableProductImageCount: initialImageGate.minAcceptedCount
        }
      })
      .eq("id", sourcingJob.id);

    return { status: "blocked", message: productImageCatalogRefreshMessage() };
  }

  let sourcingResult: Awaited<ReturnType<typeof sourceProductsFromConcept>>;
  let productSourcingTextFallbackUsed = false;
  let productSourcingTextFallbackReason: string | null = null;
  let productSourcingInitialTimedOut = false;
  const productSourcingStrategy = productSourcingVisualStrategy({
    productCandidateImagesEnabled: PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED,
    candidateImageLimit: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT,
    rolePoolCount: sourcingCandidatePools.length
  });
  const productSourcingInitialAttemptStartedAtMs = Date.now();
  let productSourcingInitialAttemptDurationMs: number | null = null;
  try {
    if (!productSourcingStrategy.shouldAttemptVisualSourcing) {
      productSourcingTextFallbackUsed = true;
      productSourcingTextFallbackReason = productSourcingStrategy.fallbackReason;
      productSourcingInitialAttemptDurationMs = 0;
      sourcingResult = buildProductSourcingTextFallbackResult({
        roomType: room.room_type,
        conceptTitle: concept.title,
        conceptDescription: concept.description,
        roles: staticRoles,
        rankedCandidates: sourcingCandidates,
        model: configuredTextModel()
      });
    } else {
      sourcingResult = await withTimeout(
        sourceProductsFromConcept({
          roomType: room.room_type,
          conceptTitle: concept.title,
          conceptDescription: concept.description,
          conceptImageUrl: conceptSignedImage.signedUrl,
          candidates: aiSourcingCandidates.map(matchToSourcingCandidate),
          roleCandidatePools: productMatchingEngineEnabled ? sourcingCandidatePools : undefined,
          conceptImageDetail: PRODUCT_SOURCING_AI_CONCEPT_IMAGE_DETAIL,
          candidateImageLimit: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT,
          candidateImageDetail: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_DETAIL,
          candidateImageDataUrls: await sourcingCandidateImageDataUrls(
            aiSourcingCandidates,
            PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT
          )
        }),
        PRODUCT_SOURCING_AI_TIMEOUT_MS,
        "Product visual sourcing timed out."
      );
      productSourcingInitialAttemptDurationMs = Date.now() - productSourcingInitialAttemptStartedAtMs;
    }

    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        model: sourcingResult.model,
        prompt_version: sourcingResult.promptVersion,
        cost_estimate_usd: sumUsdCosts(sourcingResult.textCostUsd, paletteTextCostUsd),
        output_summary: {
          promptKey: sourcingResult.promptKey,
          needCount: sourcingResult.needs.length,
          selectedProductCount: sourcingResult.selectedProducts.length,
          missingRoleCount: sourcingResult.missingRoles.length,
          missingRoles: sourcingResult.missingRoles,
          productMatchingEngineEnabled,
          localSkuFidelityMode,
          productSourcingAiPayload: productSourcingAiPayloadSummary(),
          productSourcingVisualStrategy: productSourcingStrategy,
          productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
            attemptDurationMs: productSourcingInitialAttemptDurationMs,
            timedOut: false,
            fallbackUsed: productSourcingTextFallbackUsed,
            fallbackReason: productSourcingTextFallbackReason,
            candidateCount: aiSourcingCandidates.length,
            rolePoolCount: sourcingCandidatePools.length
          }),
          productSourcingTextFallbackUsed,
          productSourcingTextFallbackReason,
          productImagePreflight: initialImagePreflight.summary,
          productImagePreflightGate: initialImageGate,
          roleCandidateCounts: productMatchingEngineEnabled ? roleCandidateCountSummary(sourcingPools) : undefined,
          roleStatuses: productMatchingEngineEnabled ? roleStatusSummary(sourcingResult.roleResults) : undefined,
          ...(productMatchingEngineEnabled
            ? roleConfidenceOutputFields(
                sourcingPools,
                sourcingResult.roleResults,
                productMatchingLoggedAtMs,
                productMatchingRoomMeasurements,
                productSourcingTimeoutDiagnostics({
                  attemptDurationMs: productSourcingInitialAttemptDurationMs,
                  timedOut: false,
                  fallbackUsed: productSourcingTextFallbackUsed,
                  fallbackReason: productSourcingTextFallbackReason,
                  candidateCount: aiSourcingCandidates.length,
                  rolePoolCount: sourcingCandidatePools.length
                })
              )
            : {})
        }
      })
      .eq("id", sourcingJob.id);
  } catch (error) {
    productSourcingInitialAttemptDurationMs = Date.now() - productSourcingInitialAttemptStartedAtMs;
    const productSourcingTimedOut = isProductSourcingTimeoutError(error);
    productSourcingInitialTimedOut = productSourcingTimedOut;
    if (productSourcingTimedOut) {
      productSourcingTextFallbackUsed = true;
      productSourcingTextFallbackReason = "initial_visual_sourcing_timeout";
      sourcingResult = buildProductSourcingTextFallbackResult({
        roomType: room.room_type,
        conceptTitle: concept.title,
        conceptDescription: concept.description,
        roles: staticRoles,
        rankedCandidates: sourcingCandidates,
        model: configuredTextModel()
      });

      if (sourcingResult.needs.length > 0 && sourcingResult.selectedProducts.length > 0) {
        await serviceSupabase
          .from("ai_jobs")
          .update({
            status: "succeeded",
            completed_at: new Date().toISOString(),
            model: sourcingResult.model,
            prompt_version: sourcingResult.promptVersion,
            cost_estimate_usd: sumUsdCosts(sourcingResult.textCostUsd, paletteTextCostUsd),
            output_summary: {
              promptKey: sourcingResult.promptKey,
              needCount: sourcingResult.needs.length,
              selectedProductCount: sourcingResult.selectedProducts.length,
              missingRoleCount: sourcingResult.missingRoles.length,
              missingRoles: sourcingResult.missingRoles,
              productMatchingEngineEnabled,
              localSkuFidelityMode,
              productSourcingAiPayload: productSourcingAiPayloadSummary(),
              productSourcingVisualStrategy: productSourcingStrategy,
              productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
                attemptDurationMs: productSourcingInitialAttemptDurationMs,
                timedOut: productSourcingTimedOut,
                fallbackUsed: productSourcingTextFallbackUsed,
                fallbackReason: productSourcingTextFallbackReason,
                candidateCount: aiSourcingCandidates.length,
                rolePoolCount: sourcingCandidatePools.length
              }),
              productSourcingTimedOut,
              productSourcingTextFallbackUsed,
              productSourcingTextFallbackReason,
              productImagePreflight: initialImagePreflight.summary,
              productImagePreflightGate: initialImageGate,
              roleCandidateCounts: productMatchingEngineEnabled ? roleCandidateCountSummary(sourcingPools) : undefined,
              roleStatuses: productMatchingEngineEnabled ? roleStatusSummary(sourcingResult.roleResults) : undefined,
              ...(productMatchingEngineEnabled
                ? roleConfidenceOutputFields(
                    sourcingPools,
                    sourcingResult.roleResults,
                    productMatchingLoggedAtMs,
                    productMatchingRoomMeasurements,
                    productSourcingTimeoutDiagnostics({
                      attemptDurationMs: productSourcingInitialAttemptDurationMs,
                      timedOut: productSourcingTimedOut,
                      fallbackUsed: productSourcingTextFallbackUsed,
                      fallbackReason: productSourcingTextFallbackReason,
                      candidateCount: aiSourcingCandidates.length,
                      rolePoolCount: sourcingCandidatePools.length
                    })
                  )
                : {})
            }
          })
          .eq("id", sourcingJob.id);
      } else {
        await serviceSupabase
          .from("ai_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: "Product visual sourcing timed out and text fallback found no usable products.",
            output_summary: {
              productMatchingEngineEnabled,
              localSkuFidelityMode,
              productSourcingAiPayload: productSourcingAiPayloadSummary(),
              productSourcingVisualStrategy: productSourcingStrategy,
              productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
                attemptDurationMs: productSourcingInitialAttemptDurationMs,
                timedOut: productSourcingTimedOut,
                fallbackUsed: productSourcingTextFallbackUsed,
                fallbackReason: productSourcingTextFallbackReason,
                candidateCount: aiSourcingCandidates.length,
                rolePoolCount: sourcingCandidatePools.length
              }),
              productImagePreflight: initialImagePreflight.summary,
              productImagePreflightGate: initialImageGate,
              productSourcingTimedOut,
              productSourcingTextFallbackUsed,
              productSourcingTextFallbackReason,
              providerImageDownloadFailure: false
            }
          })
          .eq("id", sourcingJob.id);

        return { status: "blocked", message: productSourcingTimeoutMessage() };
      }
    } else {
      await serviceSupabase
        .from("ai_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : "Product visual sourcing failed.",
          output_summary: {
            productMatchingEngineEnabled,
            localSkuFidelityMode,
            productSourcingAiPayload: productSourcingAiPayloadSummary(),
            productSourcingVisualStrategy: productSourcingStrategy,
            productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
              attemptDurationMs: productSourcingInitialAttemptDurationMs,
              timedOut: productSourcingTimedOut,
              fallbackUsed: productSourcingTextFallbackUsed,
              fallbackReason: productSourcingTextFallbackReason,
              candidateCount: aiSourcingCandidates.length,
              rolePoolCount: sourcingCandidatePools.length
            }),
            productImagePreflight: initialImagePreflight.summary,
            productImagePreflightGate: initialImageGate,
            productSourcingTimedOut,
            productSourcingTextFallbackUsed,
            productSourcingTextFallbackReason,
            providerImageDownloadFailure: isProviderImageDownloadError(error)
          }
        })
        .eq("id", sourcingJob.id);

      const message = productSourcingFailureMessage(error);
      return { status: "blocked", message: message };
    }
  }

  if (sourcingResult.needs.length === 0 || sourcingResult.selectedProducts.length === 0) {
    return { status: "blocked", message: "Product sourcing could not find enough visually relevant catalog pieces. Please try sourcing again." };
  }
  const visualConceptText = [
    paletteGroundedConceptText,
    ...(sourcingResult?.needs.map(
      (need) => `${need.roleLabel}: ${need.visualBrief}`
    ) ?? [])
  ].join("\n");
  let visualMissingRoleCategories = new Set(
    sourcingResult.missingRoles.map((role) => normalizeSourcingCategory(role, role))
  );
  // The AI's read of the concept defines the room's roles; fall back to the
  // static room roles, and append any required static role the AI didn't name.
  const aiRoles: RoomProductRoleSpec[] = sourcingResult.needs.map((need) => ({
    category: normalizeSourcingCategory(need.category, need.roleLabel),
    label: need.roleLabel,
    visualBrief: need.visualBrief,
    quantity: Math.max(1, need.quantity),
    priority: need.priority === "required" ? "required" : "supporting"
  }));
  const usableAiRoles = aiRoles.filter((role) => !visualMissingRoleCategories.has(role.category));
  const aiRoleCategories = new Set(usableAiRoles.map((role) => role.category));
  const roles =
    usableAiRoles.length > 0
      ? [
          ...usableAiRoles,
          ...staticRoles.filter(
            (role) => !aiRoleCategories.has(role.category) && !visualMissingRoleCategories.has(role.category)
          )
        ]
      : staticRoles.filter((role) => !visualMissingRoleCategories.has(role.category));

  const baseVisualRanked = rankProductMatches({
    roomType: room.room_type,
    conceptText: visualConceptText,
    recentlyUsedProductIds,
    avoidColorTags: conceptAvoidColorTags,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? {
          wallLengthCm: measurements.wall_length_cm,
          roomDepthCm: measurements.room_depth_cm
        }
      : null,
    candidates: matchingCandidates
  });
  const visualRanked = localSkuFidelityMode
    ? rankMatchesForLocalSkuFidelity({
        ranked: baseVisualRanked,
        roles,
        roomType: room.room_type,
        conceptText: visualConceptText,
        roomMeasurements: measurements
          ? {
              wallLengthCm: measurements.wall_length_cm,
              roomDepthCm: measurements.room_depth_cm
            }
          : null
      })
    : baseVisualRanked;
  let missingRequiredVisualRoles = staticRoles.filter(
    (role) => role.priority === "required" && visualMissingRoleCategories.has(role.category)
  );
  let retryProductImagePreflightSummary: ProductImagePreflightSummary | null = null;
  let retryProductImagePreflightGate: ReturnType<typeof buildProductImagePreflightGate> | null = null;
  let retryProviderImageDownloadFailure = false;
  let retryProductSourcingTimedOut = false;
  let retryProductSourcingAttemptDurationMs: number | null = null;
  let retryProductSourcingTextFallbackUsed = false;
  let retryProductSourcingTextFallbackReason: string | null = null;

  if (!productSourcingTextFallbackUsed && missingRequiredVisualRoles.length > 0) {
    const retryRoles = mergeRoomRoles(missingRequiredVisualRoles, staticRoles);
    const retryPlan = buildProductSourcingRuntimePlan({
      engineEnabled: productMatchingEngineEnabled,
      roomType: room.room_type,
      conceptText: visualConceptText,
      roles: retryRoles,
      candidates: matchingCandidates,
      recentlyUsedProductIds,
      avoidColorTags: conceptAvoidColorTags,
      budgetMaxAed: project.budget_max_aed,
      roomMeasurements: measurements
        ? {
            wallLengthCm: measurements.wall_length_cm,
            roomDepthCm: measurements.room_depth_cm
          }
        : null,
      candidatesPerRole: localSkuFidelityMode ? LOCAL_SKU_FIDELITY_CANDIDATES_PER_ROLE : 8,
      flatCandidateLimit: localSkuFidelityMode
        ? Math.max(72, retryRoles.length * LOCAL_SKU_FIDELITY_CANDIDATES_PER_ROLE)
        : 36
    });
    const retryPools = retryPlan.roleScopedPools;
    const retryCandidates = retryPlan.candidates;
    const retryImagePreflight = PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED
      ? await preflightProductCandidateImages(retryCandidates, {
          timeoutMs: PRODUCT_SOURCING_IMAGE_PREFLIGHT_TIMEOUT_MS,
          budgetMs: PRODUCT_SOURCING_IMAGE_PREFLIGHT_BUDGET_MS,
          maxBytes: PRODUCT_SOURCING_MAX_IMAGE_BYTES
        })
      : skippedProductImagePreflight(retryCandidates);
    retryProductImagePreflightSummary = retryImagePreflight.summary;
    const aiRetryCandidates = PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED
      ? retryImagePreflight.candidates
      : retryCandidates;
    const retryCandidateIds = new Set(retryCandidates.map((candidate) => candidate.id));
    const retryImageGate = buildProductImagePreflightGate({
      candidateCount: retryCandidates.length,
      acceptedCandidateIds: retryImagePreflight.acceptedCandidateIds,
      rolePools: retryPools
    });
    retryProductImagePreflightGate = retryImageGate;
    const retryProductSourcingStrategy = productSourcingVisualStrategy({
      productCandidateImagesEnabled: PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED,
      candidateImageLimit: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT,
      rolePoolCount: retryPools.length
    });
    const retryFallbackEvidence = productSourcingRetryFallbackEvidenceForStrategy(retryProductSourcingStrategy);
    const retryAttemptStartedAtMs = Date.now();
    let retryResult: Awaited<ReturnType<typeof sourceProductsFromConcept>> | null = null;
    if (retryFallbackEvidence) {
      retryProductSourcingAttemptDurationMs = retryFallbackEvidence.retryAttemptDurationMs;
      retryProductSourcingTextFallbackUsed = retryFallbackEvidence.retryFallbackUsed;
      retryProductSourcingTextFallbackReason = retryFallbackEvidence.retryFallbackReason;
      retryProviderImageDownloadFailure = retryFallbackEvidence.retryProviderImageDownloadFailure;
      retryProductSourcingTimedOut = retryFallbackEvidence.retryTimedOut;
      retryResult = buildProductSourcingTextFallbackResult({
        roomType: room.room_type,
        conceptTitle: concept.title,
        conceptDescription: concept.description,
        roles: retryRoles,
        rankedCandidates: retryCandidates,
        model: configuredTextModel()
      });
    } else if (!PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED || retryImageGate.usable) {
      retryResult = await withTimeout(
        sourceProductsFromConcept({
          roomType: room.room_type,
          conceptTitle: concept.title,
          conceptDescription: concept.description,
          conceptImageUrl: conceptSignedImage.signedUrl,
          candidates: aiRetryCandidates.map(matchToSourcingCandidate),
          roleCandidatePools: productMatchingEngineEnabled
            ? retryPools.map((pool) => poolToSourcingRolePool(pool, retryCandidateIds))
            : undefined,
          conceptImageDetail: PRODUCT_SOURCING_AI_CONCEPT_IMAGE_DETAIL,
          candidateImageLimit: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT,
          candidateImageDetail: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_DETAIL,
          candidateImageDataUrls: await sourcingCandidateImageDataUrls(
            aiRetryCandidates,
            PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT
          )
        }),
        PRODUCT_SOURCING_AI_TIMEOUT_MS,
        "Product visual sourcing retry timed out."
      ).catch((error) => {
        retryProductSourcingAttemptDurationMs = Date.now() - retryAttemptStartedAtMs;
        retryProviderImageDownloadFailure = isProviderImageDownloadError(error);
        retryProductSourcingTimedOut = isProductSourcingTimeoutError(error);
        return null;
      });
    }
    if (retryResult && !retryFallbackEvidence) {
      retryProductSourcingAttemptDurationMs = Date.now() - retryAttemptStartedAtMs;
    }

    if (retryResult?.needs.length && retryResult.selectedProducts.length) {
      // The first attempt's spend is real even though its result is being replaced.
      initialSourcingTextCostUsd = sourcingResult?.textCostUsd ?? initialSourcingTextCostUsd;
      sourcingResult = retryResult;
      latestConfidencePools = retryPools;
      visualMissingRoleCategories = new Set(
        sourcingResult.missingRoles.map((role) => normalizeSourcingCategory(role, role))
      );
      missingRequiredVisualRoles = staticRoles.filter(
        (role) => role.priority === "required" && visualMissingRoleCategories.has(role.category)
      );

      await serviceSupabase
        .from("ai_jobs")
        .update({
          status: "succeeded",
          completed_at: new Date().toISOString(),
          model: sourcingResult.model,
          prompt_version: sourcingResult.promptVersion,
          cost_estimate_usd: sumUsdCosts(initialSourcingTextCostUsd, sourcingResult.textCostUsd, paletteTextCostUsd),
          output_summary: {
            promptKey: sourcingResult.promptKey,
            needCount: sourcingResult.needs.length,
            selectedProductCount: sourcingResult.selectedProducts.length,
            missingRoleCount: sourcingResult.missingRoles.length,
            missingRoles: sourcingResult.missingRoles,
            productMatchingEngineEnabled,
            localSkuFidelityMode,
            productSourcingAiPayload: productSourcingAiPayloadSummary(),
            productSourcingVisualStrategy: productSourcingStrategy,
            retryProductSourcingVisualStrategy: retryProductSourcingStrategy,
            productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
              attemptDurationMs: productSourcingInitialAttemptDurationMs,
              timedOut: productSourcingInitialTimedOut,
              fallbackUsed: productSourcingTextFallbackUsed,
              fallbackReason: productSourcingTextFallbackReason,
              candidateCount: aiSourcingCandidates.length,
              rolePoolCount: sourcingCandidatePools.length,
              retryAttempted: true,
              retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
              retryTimedOut: retryProductSourcingTimedOut,
              retryFallbackUsed: retryProductSourcingTextFallbackUsed,
              retryFallbackReason: retryProductSourcingTextFallbackReason,
              retryProviderImageDownloadFailure,
              retryImageGateUsable: retryImageGate.usable
            }),
            productSourcingTextFallbackUsed,
            productSourcingTextFallbackReason,
            retryProductSourcingTextFallbackUsed,
            retryProductSourcingTextFallbackReason,
            productImagePreflight: initialImagePreflight.summary,
            productImagePreflightGate: initialImageGate,
            retryProductImagePreflight: retryImagePreflight.summary,
            retryProductImagePreflightGate: retryImageGate,
            roleCandidateCounts: productMatchingEngineEnabled ? roleCandidateCountSummary(retryPools) : undefined,
            roleStatuses: productMatchingEngineEnabled ? roleStatusSummary(sourcingResult.roleResults) : undefined,
            ...(productMatchingEngineEnabled
              ? roleConfidenceOutputFields(
                  retryPools,
                  sourcingResult.roleResults,
                  productMatchingLoggedAtMs,
                  productMatchingRoomMeasurements,
                  productSourcingTimeoutDiagnostics({
                    attemptDurationMs: productSourcingInitialAttemptDurationMs,
                    timedOut: productSourcingInitialTimedOut,
                    fallbackUsed: productSourcingTextFallbackUsed,
                    fallbackReason: productSourcingTextFallbackReason,
                    candidateCount: aiRetryCandidates.length,
                    rolePoolCount: retryPools.length,
                    retryAttempted: true,
                    retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
                    retryTimedOut: retryProductSourcingTimedOut,
                    retryFallbackUsed: retryProductSourcingTextFallbackUsed,
                    retryFallbackReason: retryProductSourcingTextFallbackReason,
                    retryProviderImageDownloadFailure,
                    retryImageGateUsable: retryImageGate.usable
                  })
                )
              : {}),
            retryUsed: true,
            usable: missingRequiredVisualRoles.length === 0
          }
        })
        .eq("id", sourcingJob.id);
    }
  }

  if (missingRequiredVisualRoles.length > 0) {
    const missingLabels = missingRequiredVisualRoles.map((role) => role.label);
    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: `Visual sourcing reported missing required roles: ${missingLabels.join(", ")}.`,
        output_summary: {
          promptKey: sourcingResult.promptKey,
          needCount: sourcingResult.needs.length,
          selectedProductCount: sourcingResult.selectedProducts.length,
          missingRoleCount: sourcingResult.missingRoles.length,
          missingRoles: sourcingResult.missingRoles,
          productMatchingEngineEnabled,
          localSkuFidelityMode,
          productSourcingAiPayload: productSourcingAiPayloadSummary(),
          productSourcingVisualStrategy: productSourcingStrategy,
          productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
            attemptDurationMs: productSourcingInitialAttemptDurationMs,
            timedOut: productSourcingInitialTimedOut,
            fallbackUsed: productSourcingTextFallbackUsed,
            fallbackReason: productSourcingTextFallbackReason,
            candidateCount: aiSourcingCandidates.length,
            rolePoolCount: sourcingCandidatePools.length,
            retryAttempted: retryProductImagePreflightSummary !== null,
            retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
            retryTimedOut: retryProductSourcingTimedOut,
            retryFallbackUsed: retryProductSourcingTextFallbackUsed,
            retryFallbackReason: retryProductSourcingTextFallbackReason,
            retryProviderImageDownloadFailure,
            retryImageGateUsable: retryProductImagePreflightGate?.usable ?? null
          }),
          productSourcingTextFallbackUsed,
          productSourcingTextFallbackReason,
          productImagePreflight: initialImagePreflight.summary,
          productImagePreflightGate: initialImageGate,
          retryProductImagePreflight: retryProductImagePreflightSummary,
          retryProductImagePreflightGate,
          retryProductSourcingTimedOut,
          retryProductSourcingTextFallbackUsed,
          retryProductSourcingTextFallbackReason,
          retryProviderImageDownloadFailure,
          roleCandidateCounts: productMatchingEngineEnabled
            ? roleCandidateCountSummary(latestConfidencePools)
            : undefined,
          roleStatuses: productMatchingEngineEnabled ? roleStatusSummary(sourcingResult.roleResults) : undefined,
          ...(productMatchingEngineEnabled
            ? roleConfidenceOutputFields(
                latestConfidencePools,
                sourcingResult.roleResults,
                productMatchingLoggedAtMs,
                productMatchingRoomMeasurements,
                productSourcingTimeoutDiagnostics({
                  attemptDurationMs: productSourcingInitialAttemptDurationMs,
                  timedOut: productSourcingInitialTimedOut,
                  fallbackUsed: productSourcingTextFallbackUsed,
                  fallbackReason: productSourcingTextFallbackReason,
                  candidateCount: latestConfidencePools.reduce((count, pool) => count + pool.candidateCount, 0),
                  rolePoolCount: latestConfidencePools.length,
                  retryAttempted: retryProductImagePreflightSummary !== null,
                  retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
                  retryTimedOut: retryProductSourcingTimedOut,
                  retryFallbackUsed: retryProductSourcingTextFallbackUsed,
                  retryFallbackReason: retryProductSourcingTextFallbackReason,
                  retryProviderImageDownloadFailure,
                  retryImageGateUsable: retryProductImagePreflightGate?.usable ?? null
                })
              )
            : {}),
          usable: false
        }
      })
      .eq("id", sourcingJob.id);

    return { status: "blocked", message: retryProviderImageDownloadFailure ? productImageCatalogRefreshMessage() : retryProductSourcingTimedOut ? productSourcingTimeoutMessage() : "We need one more catalogue pass before this shopping list is ready. Please try sourcing again." };
  }

  const sourceSelectionsById = new Map(
    sourcingResult.selectedProducts.map((selection) => [selection.productId, selection])
  );
  const sourceRoleResultsByCategory = productMatchingEngineEnabled
    ? new Map(
        sourcingResult.roleResults.map((result) => [
          normalizeSourcingCategory(result.category, result.roleLabel),
          result
        ])
      )
    : new Map<string, (typeof sourcingResult.roleResults)[number]>();
  const refreshDiversityHistory = localSkuFidelityMode
    ? await previousShoppingListRefreshHistory({
        serviceSupabase,
        roomId,
        conceptId
      })
    : [];

  const visualRankedById = new Map(visualRanked.map((match) => [match.id, match]));
  const optionsPerRole = localSkuFidelityMode ? LOCAL_SKU_FIDELITY_CANDIDATES_PER_ROLE : 6;
  const roleScopedOptionPools = productMatchingEngineEnabled
    ? buildRoleScopedCandidatePools({
        roomType: room.room_type,
        conceptText: visualConceptText,
        roles,
        candidates: matchingCandidates,
        recentlyUsedProductIds,
        avoidColorTags: conceptAvoidColorTags,
        budgetMaxAed: project.budget_max_aed,
        roomMeasurements: measurements
          ? {
              wallLengthCm: measurements.wall_length_cm,
              roomDepthCm: measurements.room_depth_cm
            }
          : null,
        candidatesPerRole: Math.max(optionsPerRole * 2, optionsPerRole)
      }).pools.map((pool) =>
        localSkuFidelityMode ? rerankRolePoolForAestheticFit(pool, room.room_type, visualConceptText) : pool
      )
    : [];
  const roleOptions = ensureLocalSkuFidelitySupportOptions({
    roleOptions: polishRoleOptionsForAestheticDemo({
      roleOptions: composeRoomProductOptions({
        ranked: visualRanked,
        roles,
        roleScopedPools: roleScopedOptionPools,
        roomType: room.room_type,
        // Store a reserve beyond the three shown, so rejecting an option reveals a
        // replacement instantly with no catalog round-trip.
        optionsPerRole,
        refreshDiversityHistory: localSkuFidelityMode ? refreshDiversityHistory : []
      }),
      ranked: visualRanked,
      rankedById: visualRankedById,
      catalogueGroundingAnchors,
      conceptText: visualConceptText,
      localSkuFidelityMode,
      optionsPerRole: 6
    }),
    roles,
    ranked: visualRanked,
    conceptText: visualConceptText,
    localSkuFidelityMode
  });
  const missingCatalogueAnchors = catalogueGroundingAnchors
    .filter((anchor) => anchor.priority === "required")
    .filter((anchor) => {
      const category = normalizeSourcingCategory(anchor.category, anchor.roleLabel);
      const role = roleOptions.find((option) => option.category === category);
      return !role?.options.some((option) => option.id === anchor.productId);
    });

  if (missingCatalogueAnchors.length > 0 && !localSkuFidelityMode) {
    const missingAnchorLabels = missingCatalogueAnchors.map((anchor) => anchor.roleLabel || anchor.category);
    const { data: currentSourcingJob } = await serviceSupabase
      .from("ai_jobs")
      .select("output_summary")
      .eq("id", sourcingJob.id)
      .maybeSingle();
    const currentSourcingSummary = isRecord(currentSourcingJob?.output_summary)
      ? currentSourcingJob.output_summary
      : {};

    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: `Required catalogue anchors were missing from product options: ${missingAnchorLabels.join(", ")}.`,
        output_summary: {
          ...currentSourcingSummary,
          promptKey: sourcingResult.promptKey,
          needCount: sourcingResult.needs.length,
          selectedProductCount: sourcingResult.selectedProducts.length,
          missingRoleCount: sourcingResult.missingRoles.length,
          missingRoles: sourcingResult.missingRoles,
          productMatchingEngineEnabled,
          localSkuFidelityMode,
          productSourcingAiPayload: productSourcingAiPayloadSummary(),
          productSourcingVisualStrategy: productSourcingStrategy,
          productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
            attemptDurationMs: productSourcingInitialAttemptDurationMs,
            timedOut: productSourcingInitialTimedOut,
            fallbackUsed: productSourcingTextFallbackUsed,
            fallbackReason: productSourcingTextFallbackReason,
            candidateCount: aiSourcingCandidates.length,
            rolePoolCount: sourcingCandidatePools.length,
            retryAttempted: retryProductImagePreflightSummary !== null,
            retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
            retryTimedOut: retryProductSourcingTimedOut,
            retryFallbackUsed: retryProductSourcingTextFallbackUsed,
            retryFallbackReason: retryProductSourcingTextFallbackReason,
            retryProviderImageDownloadFailure,
            retryImageGateUsable: retryProductImagePreflightGate?.usable ?? null
          }),
          productSourcingTextFallbackUsed,
          productSourcingTextFallbackReason,
          productImagePreflight: initialImagePreflight.summary,
          productImagePreflightGate: initialImageGate,
          retryProductImagePreflight: retryProductImagePreflightSummary,
          retryProductImagePreflightGate,
          retryProductSourcingTimedOut,
          retryProductSourcingTextFallbackUsed,
          retryProductSourcingTextFallbackReason,
          retryProviderImageDownloadFailure,
          roleCandidateCounts: productMatchingEngineEnabled
            ? roleCandidateCountSummary(latestConfidencePools)
            : undefined,
          roleStatuses: productMatchingEngineEnabled ? roleStatusSummary(sourcingResult.roleResults) : undefined,
          ...(productMatchingEngineEnabled
            ? roleConfidenceOutputFields(
                latestConfidencePools,
                sourcingResult.roleResults,
                productMatchingLoggedAtMs,
                productMatchingRoomMeasurements,
                productSourcingTimeoutDiagnostics({
                  attemptDurationMs: productSourcingInitialAttemptDurationMs,
                  timedOut: productSourcingInitialTimedOut,
                  fallbackUsed: productSourcingTextFallbackUsed,
                  fallbackReason: productSourcingTextFallbackReason,
                  candidateCount: latestConfidencePools.reduce((count, pool) => count + pool.candidateCount, 0),
                  rolePoolCount: latestConfidencePools.length,
                  retryAttempted: retryProductImagePreflightSummary !== null,
                  retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
                  retryTimedOut: retryProductSourcingTimedOut,
                  retryFallbackUsed: retryProductSourcingTextFallbackUsed,
                  retryFallbackReason: retryProductSourcingTextFallbackReason,
                  retryProviderImageDownloadFailure,
                  retryImageGateUsable: retryProductImagePreflightGate?.usable ?? null
                })
              )
            : {}),
          usable: false,
          catalogueAnchorDivergence: {
            missingRequiredAnchorCount: missingCatalogueAnchors.length,
            missingRequiredAnchors: missingCatalogueAnchors.map((anchor) => ({
              productId: anchor.productId,
              category: anchor.category,
              roleLabel: anchor.roleLabel
            }))
          }
        }
      })
      .eq("id", sourcingJob.id);

    return { status: "blocked", message: "We need one more catalogue pass before this shopping list is ready. Please try sourcing again." };
  }
  if (missingCatalogueAnchors.length > 0 && localSkuFidelityMode) {
    const { data: currentSourcingJob } = await serviceSupabase
      .from("ai_jobs")
      .select("output_summary")
      .eq("id", sourcingJob.id)
      .maybeSingle();
    const currentSourcingSummary = isRecord(currentSourcingJob?.output_summary)
      ? currentSourcingJob.output_summary
      : {};

    await serviceSupabase
      .from("ai_jobs")
      .update({
        output_summary: {
          ...currentSourcingSummary,
          catalogueAnchorDivergence: {
            localReplacementAllowed: true,
            missingRequiredAnchorCount: missingCatalogueAnchors.length,
            missingRequiredAnchors: missingCatalogueAnchors.map((anchor) => ({
              category: normalizeSourcingCategory(anchor.category, anchor.roleLabel),
              roleLabel: anchor.roleLabel,
              productId: anchor.productId
            }))
          }
        }
      })
      .eq("id", sourcingJob.id);
  }

  const coveredCategories = new Set(roleOptions.map((role) => role.category));
  const missingRequiredRoles = roles
    .filter((role) => role.priority === "required" && !coveredCategories.has(role.category))
    .map((role) => role.label);

  if (missingRequiredRoles.length > 0) {
    const { data: currentSourcingJob } = await serviceSupabase
      .from("ai_jobs")
      .select("output_summary")
      .eq("id", sourcingJob.id)
      .maybeSingle();
    const currentSourcingSummary = isRecord(currentSourcingJob?.output_summary)
      ? currentSourcingJob.output_summary
      : {};

    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: `Required product roles were missing from product options: ${missingRequiredRoles.join(", ")}.`,
        output_summary: {
          ...currentSourcingSummary,
          missingRequiredRoles,
          productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
            attemptDurationMs: productSourcingInitialAttemptDurationMs,
            timedOut: productSourcingInitialTimedOut,
            fallbackUsed: productSourcingTextFallbackUsed,
            fallbackReason: productSourcingTextFallbackReason,
            candidateCount: aiSourcingCandidates.length,
            rolePoolCount: sourcingCandidatePools.length,
            retryAttempted: retryProductImagePreflightSummary !== null,
            retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
            retryTimedOut: retryProductSourcingTimedOut,
            retryFallbackUsed: retryProductSourcingTextFallbackUsed,
            retryFallbackReason: retryProductSourcingTextFallbackReason,
            retryProviderImageDownloadFailure,
            retryImageGateUsable: retryProductImagePreflightGate?.usable ?? null
          }),
          usable: false
        }
      })
      .eq("id", sourcingJob.id);

    return { status: "blocked", message: "We need one more catalogue pass before this shopping list is ready. Please try sourcing again." };
  }

  const { data: existingList } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("room_id", roomId)
    .eq("concept_id", conceptId)
    .limit(1)
    .maybeSingle();

  const shoppingListResult = existingList
    ? { data: existingList, error: null }
    : await supabase
        .from("shopping_lists")
        .insert({
          room_id: roomId,
          concept_id: conceptId,
          status: "draft"
        })
        .select("id")
        .single();

  if (shoppingListResult.error) {
    throw new Error(shoppingListResult.error.message);
  }

  const shoppingListId = shoppingListResult.data.id;
  await supabase.from("shopping_list_items").delete().eq("shopping_list_id", shoppingListId);

  // Pre-select the AI's recommended product per role. If the AI does not pick
  // one, fall back to the top-ranked option so every role starts chosen.
  const selectedProductIdByRole = new Map<string, string>();
  for (const role of roleOptions) {
    if (localSkuFidelityMode && role.options[0]) {
      selectedProductIdByRole.set(role.category, role.options[0].id);
      continue;
    }

    const catalogueAnchorId = catalogueAnchorIdsByCategory.get(role.category);
    if (!localSkuFidelityMode && catalogueAnchorId && role.options.some((option) => option.id === catalogueAnchorId)) {
      selectedProductIdByRole.set(role.category, catalogueAnchorId);
      continue;
    }

    const roleResult = sourceRoleResultsByCategory.get(role.category);
    const roleResultOption = roleResult?.productId
      ? role.options.find((option) => option.id === roleResult.productId)
      : undefined;
    const aiPick = sourcingResult.selectedProducts.find(
      (selection) =>
        normalizeSourcingCategory(selection.category, selection.roleLabel) === role.category &&
        role.options.some((option) => option.id === selection.productId)
    );
    const aiPickOption = aiPick ? role.options.find((option) => option.id === aiPick.productId) : undefined;
    const themeAlignedPick = bestThemeAlignedOptionForRole({
      role,
      options: role.options,
      conceptText: visualConceptText,
      currentPick: roleResultOption ?? aiPickOption,
      localSkuFidelityMode
    });
    if (themeAlignedPick && themeAlignedPick.id !== (roleResultOption ?? aiPickOption)?.id) {
      selectedProductIdByRole.set(role.category, themeAlignedPick.id);
      continue;
    }

    if (roleResult?.productId && role.options.some((option) => option.id === roleResult.productId)) {
      selectedProductIdByRole.set(role.category, roleResult.productId);
      continue;
    }

    if (aiPick) {
      selectedProductIdByRole.set(role.category, aiPick.productId);
    } else if (role.options[0]) {
      const fallbackPick =
        bestThemeAlignedOptionForRole({
          role,
          options: role.options,
          conceptText: visualConceptText,
          currentPick: role.options[0],
          localSkuFidelityMode
        }) ?? role.options[0];
      selectedProductIdByRole.set(role.category, fallbackPick.id);
    }
  }

  // Aggregate budget adherence: per-role selection above has no view of the running total, so the
  // qty-aware line-total sum can exceed the stated budget (a role at qty 2 doubles its line). Fit
  // the selection to budget by downgrading roles to cheaper in-pool alternates before persisting.
  const budgetFit = fitSelectionToBudget({
    roleOptions,
    selectedProductIdByRole,
    budgetMaxAed: project.budget_max_aed ?? null
  });
  const budgetAdjustedSelection = budgetFit.selectedProductIdByRole;

  const selectedFirstRoleOptions = roleOptions.map((role) => {
    const selectedId = budgetAdjustedSelection.get(role.category);
    const selectedOption = selectedId ? role.options.find((option) => option.id === selectedId) : undefined;
    if (!selectedOption || role.options[0]?.id === selectedOption.id) {
      return role;
    }

    return {
      ...role,
      options: [selectedOption, ...role.options.filter((option) => option.id !== selectedOption.id)]
    };
  });

  const itemRows = buildShoppingListItemRows({
    roleOptions: selectedFirstRoleOptions,
    selectedProductIdByRole: budgetAdjustedSelection,
    reasonFor: (match) => {
      const sourceSelection = sourceSelectionsById.get(match.id);
      return [
        sourceSelection?.visualMatchReason ? `visual match: ${sourceSelection.visualMatchReason}` : null,
        sourceSelection?.mismatchNote ? `mismatch: ${sourceSelection.mismatchNote}` : null,
        match.selectionReason,
        ...match.warnings.filter((warning) => warning !== match.dimensionFitNote)
      ]
        .filter(Boolean)
        .join(" ");
    }
  });

  const { error: itemError } = await supabase
    .from("shopping_list_items")
    .insert(itemRows.map((row) => ({ ...row, shopping_list_id: shoppingListId })));

  if (itemError) {
    throw new Error(itemError.message);
  }

  const estimatedTotal = selectedItemsTotalAed(itemRows);
  await supabase
    .from("shopping_lists")
    .update({
      estimated_total_aed: estimatedTotal,
      updated_at: new Date().toISOString()
    })
    .eq("id", shoppingListId);
  if (localSkuFidelityMode && productMatchingEngineEnabled) {
    const sourceSelectedProductIdByCategory = new Map<string, string | null>();
    for (const result of sourcingResult.roleResults) {
      sourceSelectedProductIdByCategory.set(
        normalizeSourcingCategory(result.category, result.roleLabel),
        result.productId
      );
    }
    const conceptAnchorProductIdByCategory = new Map<string, string | null>();
    for (const anchor of catalogueGroundingAnchors) {
      if (anchor.priority !== "required") {
        continue;
      }
      conceptAnchorProductIdByCategory.set(
        normalizeSourcingCategory(anchor.category, anchor.roleLabel),
        anchor.productId
      );
    }

    const { data: currentSourcingJob } = await serviceSupabase
      .from("ai_jobs")
      .select("output_summary")
      .eq("id", sourcingJob.id)
      .maybeSingle();
    const currentSourcingSummary = isRecord(currentSourcingJob?.output_summary)
      ? currentSourcingJob.output_summary
      : {};

    const { error: persistedSelectionSnapshotError } = await serviceSupabase
      .from("ai_jobs")
      .update({
        output_summary: {
          ...currentSourcingSummary,
          productSourcingTimeoutDiagnostics:
            currentSourcingSummary.productSourcingTimeoutDiagnostics ??
            productSourcingTimeoutDiagnostics({
              attemptDurationMs: productSourcingInitialAttemptDurationMs,
              timedOut: productSourcingInitialTimedOut,
              fallbackUsed: productSourcingTextFallbackUsed,
              fallbackReason: productSourcingTextFallbackReason,
              candidateCount: aiSourcingCandidates.length,
              rolePoolCount: sourcingCandidatePools.length,
              retryAttempted: retryProductImagePreflightSummary !== null,
              retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
              retryTimedOut: retryProductSourcingTimedOut,
              retryFallbackUsed: retryProductSourcingTextFallbackUsed,
              retryFallbackReason: retryProductSourcingTextFallbackReason,
              retryProviderImageDownloadFailure,
              retryImageGateUsable: retryProductImagePreflightGate?.usable ?? null
            }),
          persistedSelectionSnapshot: buildPersistedSelectionSnapshot({
            shoppingListId,
            estimatedTotalAed: estimatedTotal,
            sourcePath: productSourcingTextFallbackUsed ? "text_fallback" : "visual",
            roleOptions: selectedFirstRoleOptions,
            itemRows,
            sourceSelectedProductIdByCategory,
            conceptAnchorProductIdByCategory
          })
        }
      })
      .eq("id", sourcingJob.id);
    if (persistedSelectionSnapshotError) {
      throw new Error(persistedSelectionSnapshotError.message);
    }
  }
  await supabase.from("rooms").update({ status: "sourcing" }).eq("id", roomId);

  return { status: "sourced" };
}

export type ShoppingOptionRefillInput = {
  projectId: string;
  roomId: string;
  shoppingListId: string;
  category: string;
};

type OptionRowTemplate = {
  role_label: string;
  role_visual_brief: string | null;
  role_priority: string;
  role_quantity: number;
  option_rank: number;
};

// Shared by refresh and find-more: fresh ranked matches become option rows that
// inherit the role fields from the highest-ranked existing row.
function optionRowsFromMatches(
  shoppingListId: string,
  category: string,
  template: OptionRowTemplate,
  fresh: RankedProductMatch[]
) {
  return fresh.map((match, index) => {
    const unitPrice = match.salePriceAed ?? match.priceAed ?? 0;
    const optionRank = template.option_rank + 1 + index;
    return {
      shopping_list_id: shoppingListId,
      product_id: match.id,
      category,
      status: "option" as const,
      role_label: template.role_label,
      role_visual_brief: template.role_visual_brief,
      role_priority: template.role_priority,
      role_quantity: template.role_quantity,
      option_rank: optionRank,
      quantity: template.role_quantity,
      unit_price_aed: unitPrice,
      line_total_aed: unitPrice * template.role_quantity,
      selection_reason: [
        match.selectionReason,
        ...match.warnings.filter((warning) => warning !== match.dimensionFitNote)
      ]
        .filter(Boolean)
        .join(" "),
      dimension_fit_note: match.dimensionFitNote,
      sort_order: optionRank
    };
  });
}

async function loadRefillContext(
  { supabase, serviceSupabase }: { supabase: UserSupabaseClient; serviceSupabase: ServiceSupabaseClient },
  { projectId, roomId, shoppingListId, category }: ShoppingOptionRefillInput,
  itemColumns: string
) {
  const { data: shoppingList } = await supabase
    .from("shopping_lists")
    .select("id, concept_id")
    .eq("id", shoppingListId)
    .single();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  const { data: project } = await supabase
    .from("projects")
    .select("id, budget_max_aed")
    .eq("id", projectId)
    .single();

  if (!shoppingList?.concept_id || !room || !project) {
    return null;
  }

  const { data: concept } = await supabase
    .from("concepts")
    .select("title, description")
    .eq("id", shoppingList.concept_id)
    .single();

  const { data: existingRows } = await supabase
    .from("shopping_list_items")
    .select(itemColumns)
    .eq("shopping_list_id", shoppingListId)
    .eq("category", category);

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("wall_length_cm, room_depth_cm")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: products } = await serviceSupabase
    .from("products")
    .select(
      `
      *,
      retailer:retailers(name, status),
      dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
    `
    )
    .not("price_aed", "is", null)
    .not("primary_image_url", "is", null)
    .order("last_checked_at", { ascending: false, nullsFirst: false })
    .limit(PRODUCT_MATCHING_CATALOG_LIMIT);

  return { room, project, concept, existingRows, measurements, products };
}

function rankFreshOptions({
  room,
  project,
  concept,
  measurements,
  products,
  category,
  template,
  usedProductIds,
  limit
}: {
  room: { room_type: string };
  project: { budget_max_aed: number | null };
  concept: { title: string; description: string | null };
  measurements: { wall_length_cm: number | null; room_depth_cm: number | null } | null;
  products: ProductRow[] | null;
  category: string;
  template: OptionRowTemplate;
  usedProductIds: Set<string>;
  limit: number;
}) {
  const candidates = (products ?? [])
    .map(productToMatchCandidate)
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));

  const conceptText = `${concept.title}\n${concept.description ?? ""}`;
  const role = shoppingListRoleSpecFromRow({
    category,
    role_label: template.role_label,
    role_visual_brief: template.role_visual_brief,
    role_priority: template.role_priority,
    role_quantity: template.role_quantity
  });
  return roleScopedShoppingAlternates({
    roomType: room.room_type,
    conceptText,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? { wallLengthCm: measurements.wall_length_cm, roomDepthCm: measurements.room_depth_cm }
      : null,
    role,
    candidates,
    excludeProductIds: usedProductIds,
    limit
  });
}

export type RefreshShoppingOptionsResult = { status: "refreshed" } | { status: "no_change" };

// Replace the non-selected options for a role while preserving the shopper's
// current pick. This keeps refresh scoped to exploration, not selection.
export async function refreshShoppingOptions(
  clients: { supabase: UserSupabaseClient; serviceSupabase: ServiceSupabaseClient },
  input: ShoppingOptionRefillInput
): Promise<RefreshShoppingOptionsResult> {
  const context = await loadRefillContext(
    clients,
    input,
    "id, product_id, status, role_label, role_visual_brief, role_priority, role_quantity, option_rank"
  );
  if (!context) {
    return { status: "no_change" };
  }

  const existingRows = (context.existingRows ?? []) as unknown as Array<
    OptionRowTemplate & { id: string; product_id: string; status: string }
  >;
  const selectedRow = existingRows.find((row) => row.status === "selected") ?? null;
  if (!context.concept || existingRows.length === 0 || !selectedRow) {
    return { status: "no_change" };
  }

  const usedProductIds = new Set(existingRows.map((row) => row.product_id));
  const template = existingRows.reduce(
    (best, row) => (row.option_rank > best.option_rank ? row : best),
    existingRows[0]
  );

  const fresh = rankFreshOptions({
    room: context.room,
    project: context.project,
    concept: context.concept,
    measurements: context.measurements,
    products: context.products as ProductRow[] | null,
    category: input.category,
    template,
    usedProductIds,
    limit: 2
  });

  if (fresh.length === 0) {
    return { status: "no_change" };
  }

  await clients.supabase
    .from("shopping_list_items")
    .update({ status: "rejected" })
    .eq("shopping_list_id", input.shoppingListId)
    .eq("category", input.category)
    .neq("status", "selected");

  await clients.supabase
    .from("shopping_list_items")
    .insert(optionRowsFromMatches(input.shoppingListId, input.category, template, fresh));
  return { status: "refreshed" };
}

export type FindMoreShoppingOptionsResult =
  | { status: "appended" }
  | { status: "no_candidates" }
  | { status: "no_change" };

// Rare path: every loaded option for a role was rejected. Rank the catalog for
// that category, skip products already in the list, and append fresh options.
export async function findMoreShoppingOptions(
  clients: { supabase: UserSupabaseClient; serviceSupabase: ServiceSupabaseClient },
  input: ShoppingOptionRefillInput
): Promise<FindMoreShoppingOptionsResult> {
  const context = await loadRefillContext(
    clients,
    input,
    "product_id, role_label, role_visual_brief, role_priority, role_quantity, option_rank"
  );
  if (!context) {
    return { status: "no_change" };
  }

  const existingRows = (context.existingRows ?? []) as unknown as Array<
    OptionRowTemplate & { product_id: string }
  >;
  if (!context.concept || existingRows.length === 0) {
    return { status: "no_change" };
  }

  const usedProductIds = new Set(existingRows.map((row) => row.product_id));
  const template = existingRows.reduce(
    (best, row) => (row.option_rank > best.option_rank ? row : best),
    existingRows[0]
  );

  const fresh = rankFreshOptions({
    room: context.room,
    project: context.project,
    concept: context.concept,
    measurements: context.measurements,
    products: context.products as ProductRow[] | null,
    category: input.category,
    template,
    usedProductIds,
    limit: 3
  });

  if (fresh.length === 0) {
    return { status: "no_candidates" };
  }

  await clients.supabase
    .from("shopping_list_items")
    .insert(optionRowsFromMatches(input.shoppingListId, input.category, template, fresh));
  return { status: "appended" };
}
