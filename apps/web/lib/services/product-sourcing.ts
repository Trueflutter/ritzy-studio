import {
  extractConceptImagePalette,
  sourceProductsFromConcept,
  stageTextConfig,
  sumUsdCosts
} from "@ritzy-studio/ai";
import { configuredTextModel, productSourcingImageBudget } from "@ritzy-studio/config";
import {
  buildShoppingListItemRows,
  buildSpecSourcingPlan,
  checkCandidateAgainstSpecRole,
  conceptPaletteMatchingText,
  enhancedProductRolesForRoom,
  fitSelectionToBudget,
  imageCandidateIdsForPools,
  parseConceptImagePalette,
  resolveSpecRoleOutcomes,
  resolveSpecRoleOutcomesByRanking,
  roleOptionKey,
  roleOptionsFromOutcomes,
  selectedItemsTotalAed,
  sourcingRolesFromBlueprint,
  sourcingRolesFromDesignSpec,
  type MissingRoleEntry,
  type ProductMatchCandidate,
  type RankedProductMatch,
  type RoleProductOptions,
  type RoleScopedRankedProductMatch,
  type RoomProductRoleSpec,
  type SpecRoleOutcome,
  type SpecSourcingRole,
  type UnsourceableSpecObject
} from "@ritzy-studio/domain";

import { readRoomDesignSpec } from "./design-spec";
import {
  PRODUCT_MATCHING_CATALOG_LIMIT,
  PRODUCT_SOURCING_AI_TIMEOUT_MS,
  catalogUnavailableMessage,
  matchToSourcingCandidate,
  productToMatchCandidate,
  recentlyUsedProductIdsForUser,
  roleScopedShoppingAlternates,
  shoppingListRoleSpecFromRow,
  sourcingCandidateImageDataUrls,
  splitAvoidColorCues,
  type ProductRow
} from "./sourcing-support";
import type { ServiceSupabaseClient, UserSupabaseClient } from "./supabase-clients";
import { storageImageDataUrl } from "./storage-images";

// The product-sourcing service (S3): sourcing against the CONFIRMED design spec.
//
// Every purchasable spec object is a role with a hard contract (domain
// spec-sourcing). Retrieval runs per role through the scorer with the contract
// applied before the cut; the visual pass sees the concept image plus the
// top candidates' images per role (app-fetched, budgeted) and picks per role
// or declares the role unmatched; picks are held to the contract again; a
// role the catalogue cannot honestly fill is persisted on the list as a
// missing-role entry with the reason and what to do, never filled with the
// wrong thing and never silently dropped. Swaps and refills re-run the same
// contract for the row's spec object.
//
// Sourcing never runs the paid spec extraction itself: a room whose spec is
// not yet read, still being read, or not yet confirmed is sent to /spec. A
// room whose extraction failed (and whose user chose to continue) sources
// against the room-type blueprint roles through the same contract machinery,
// and the job records that it did.

type Clients = { supabase: UserSupabaseClient; serviceSupabase: ServiceSupabaseClient };

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
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
  | { status: "spec_pending" }
  | { status: "sourced"; selectedCount: number; missingRoleCount: number };

export type SpecSource = "confirmed_spec" | "blueprint_fallback";

const CANDIDATES_PER_ROLE = 8;

// One sentence a person can read (design system 12.7): the visual pass's own
// reason for the chosen piece, the ranking's reason for the alternates.
function whyThisPiece(outcome: Extract<SpecRoleOutcome, { kind: "selected" }>): string {
  return [outcome.reason, outcome.mismatchNote].filter(Boolean).join(" ");
}

function alternateProse(match: RankedProductMatch | RoleScopedRankedProductMatch, role: RoomProductRoleSpec): string {
  const reasons = "attributeScore" in match ? match.attributeScore.reasons.slice(0, 2) : [];
  return reasons.length > 0
    ? `Offered as an alternative for the ${role.label}: ${reasons.join("; ")}.`
    : `Offered as an alternative for the ${role.label}.`;
}

function selectedFirst(roleOptions: RoleProductOptions[], selection: Map<string, string>): RoleProductOptions[] {
  return roleOptions.map((role) => {
    const selectedId = selection.get(roleOptionKey(role));
    const selected = selectedId ? role.options.find((option) => option.id === selectedId) : undefined;
    if (!selected || role.options[0]?.id === selected.id) {
      return role;
    }
    return { ...role, options: [selected, ...role.options.filter((option) => option.id !== selected.id)] };
  });
}

export async function groundProductsForRoom(
  { supabase, serviceSupabase }: Clients,
  { userId, projectId, roomId, conceptId }: GroundProductsInput,
  {
    // Injectable seams (sibling-service pattern): the spec read, the paid
    // visual pass, the candidate image fetch, and the palette extraction, so
    // every persisted transition is testable without a live provider.
    readSpec = readRoomDesignSpec,
    sourceProducts = sourceProductsFromConcept,
    fetchCandidateImages = sourcingCandidateImageDataUrls,
    extractPalette = extractConceptImagePalette
  }: {
    readSpec?: typeof readRoomDesignSpec;
    sourceProducts?: typeof sourceProductsFromConcept;
    fetchCandidateImages?: typeof sourcingCandidateImageDataUrls;
    extractPalette?: typeof extractConceptImagePalette;
  } = {}
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
    .select(
      "id, title, description, status, palette_json, primary_image_asset:room_assets!concepts_primary_image_asset_id_fkey(*)"
    )
    .eq("id", conceptId)
    .eq("room_id", roomId)
    .single();

  if (!project || !room || !concept) {
    return { status: "not_found" };
  }

  if (concept.status !== "selected") {
    return { status: "blocked", message: "Select a concept before product grounding." };
  }

  // The spec gate. Sourcing consumes CONFIRMED truth: an unread, in-flight,
  // or unconfirmed spec sends the user to /spec (which starts or shows the
  // extraction, or asks for the confirm) and lands back here. A failed or
  // image-less extraction does not block: the blueprint fallback keeps the
  // journey alive, and the job says which source built the list.
  const specState = await readSpec({ supabase, serviceSupabase }, { roomId });
  if (specState.status === "extraction_needed" || specState.status === "extraction_running") {
    return { status: "spec_pending" };
  }
  if (specState.status === "ready" && specState.spec.status !== "confirmed") {
    return { status: "spec_pending" };
  }

  let roles: SpecSourcingRole[];
  let unsourceable: UnsourceableSpecObject[] = [];
  let missingRoles: MissingRoleEntry[] = [];
  let mustPreserve: string[] = [];
  let specSource: SpecSource;
  if (specState.status === "ready") {
    const mapped = sourcingRolesFromDesignSpec(specState.spec, room.room_type);
    roles = mapped.roles;
    unsourceable = mapped.unsourceable;
    mustPreserve = specState.spec.mustPreserve;
    specSource = "confirmed_spec";
  } else {
    roles = sourcingRolesFromBlueprint(enhancedProductRolesForRoom(room.room_type), room.room_type);
    specSource = "blueprint_fallback";
  }

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("wall_length_cm, room_depth_cm")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // The user's explicit avoid-colour instruction (brief avoid_notes) must
  // reach matching; the concept palette's avoidColors is an inferred signal
  // and can miss what the user asked for, so the two are unioned.
  const { data: sourcingDesignBrief } = await supabase
    .from("design_briefs")
    .select("avoid_notes")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const conceptImageAsset = Array.isArray(concept.primary_image_asset)
    ? concept.primary_image_asset[0]
    : concept.primary_image_asset;
  const conceptImageUrl = conceptImageAsset?.storage_path
    ? await storageImageDataUrl(
        serviceSupabase,
        "generated-renders",
        conceptImageAsset.storage_path,
        conceptImageAsset.mime_type
      )
    : null;
  if (!conceptImageUrl) {
    return { status: "blocked", message: "Product sourcing needs the concept image before it can match catalog pieces." };
  }

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

  if (candidates.length === 0) {
    return { status: "blocked", message: catalogUnavailableMessage(products ?? []) };
  }

  // Aesthetic coherence is scored against the palette of the concept image as
  // rendered (extracted once, cached on the concept row), not only against the
  // concept's text tokens. Extraction failure degrades to text-only matching.
  const baseConceptText = `${concept.title}\n${concept.description ?? ""}`;
  let conceptPalette = parseConceptImagePalette(concept.palette_json);
  let paletteTextCostUsd: number | null = null;
  if (!conceptPalette) {
    try {
      const paletteResult = await extractPalette({ imageUrl: conceptImageUrl });
      paletteTextCostUsd = paletteResult.textCostUsd ?? null;
      conceptPalette = paletteResult.palette;
      await serviceSupabase.from("concepts").update({ palette_json: conceptPalette }).eq("id", concept.id);
    } catch (error) {
      console.error("Concept palette extraction failed; matching falls back to text tokens.", error);
    }
  }
  const conceptText = conceptPalette
    ? `${baseConceptText}\n${conceptPaletteMatchingText(conceptPalette)}`
    : baseConceptText;
  const avoidColorTags = Array.from(
    new Set([
      ...(conceptPalette?.avoidColors ?? []),
      ...splitAvoidColorCues(sourcingDesignBrief?.avoid_notes ?? "").avoidColorTags
    ])
  );
  const recentlyUsedProductIds = await recentlyUsedProductIdsForUser({
    serviceSupabase,
    userId,
    excludeRoomId: roomId
  });
  const roomMeasurements = measurements
    ? { wallLengthCm: measurements.wall_length_cm, roomDepthCm: measurements.room_depth_cm }
    : null;

  const plan = buildSpecSourcingPlan({
    roles,
    unsourceable,
    candidates,
    roomType: room.room_type,
    conceptText,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements,
    recentlyUsedProductIds,
    avoidColorTags,
    candidatesPerRole: CANDIDATES_PER_ROLE
  });
  const contractRejections = plan.pools.reduce<Record<string, number>>((totals, pool) => {
    for (const [reason, count] of Object.entries(pool.rejectionReasons)) {
      totals[reason] = (totals[reason] ?? 0) + count;
    }
    return totals;
  }, {});
  const imageBudget = productSourcingImageBudget();

  // Spend never precedes its audit row.
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
        specSource,
        roleCount: roles.length,
        poolCount: plan.pools.length,
        unsourceableCount: unsourceable.length,
        missingBeforeVisualPass: plan.missing.filter((entry) => entry.kind === "missing").map((entry) => entry.label),
        candidateCount: candidates.length,
        imageBudget
      }
    })
    .select("id")
    .single();

  if (sourcingJobError || !sourcingJob) {
    throw new Error(sourcingJobError?.message ?? "Could not open the sourcing job.");
  }

  // The visual pass: concept image plus the top candidates' images per role.
  let outcomes: SpecRoleOutcome[];
  let visualPass: {
    used: boolean;
    error: string | null;
    promptKey: string | null;
    promptVersion: string | null;
    model: string | null;
    textCostUsd: number | null;
    imageCount: number;
  } = { used: false, error: null, promptKey: null, promptVersion: null, model: null, textCostUsd: null, imageCount: 0 };

  if (plan.pools.length === 0) {
    outcomes = [];
  } else {
    const poolCandidatesById = new Map<string, RoleScopedRankedProductMatch>();
    for (const pool of plan.pools) {
      for (const candidate of pool.candidates) {
        poolCandidatesById.set(candidate.id, candidate);
      }
    }
    const imageIds = imageCandidateIdsForPools(plan.pools, imageBudget);
    let candidateImageDataUrls: Record<string, string> = {};
    if (imageIds.length > 0) {
      try {
        candidateImageDataUrls = await fetchCandidateImages(
          imageIds.map((id) => poolCandidatesById.get(id)!),
          imageIds.length
        );
      } catch (error) {
        console.error("Candidate image fetch failed; the visual pass judges from text.", error);
      }
    }
    visualPass.imageCount = Object.keys(candidateImageDataUrls).length;

    try {
      const result = await withTimeout(
        sourceProducts({
          roomType: room.room_type,
          conceptTitle: concept.title,
          conceptDescription: concept.description,
          conceptImageUrl,
          candidates: Array.from(poolCandidatesById.values()).map(matchToSourcingCandidate),
          roleCandidatePools: plan.pools.map((pool) => ({
            category: pool.role.category,
            roleLabel: pool.role.echoKey,
            visualBrief: pool.role.visualBrief,
            quantity: pool.role.quantity,
            priority: pool.role.priority,
            candidateIds: pool.candidates.map((candidate) => candidate.id)
          })),
          conceptImageDetail: "high",
          candidateImageDetail: "low",
          candidateImageDataUrls,
          designSpec: {
            roles: plan.pools.map((pool) => ({
              echoKey: pool.role.echoKey,
              category: pool.role.category,
              label: pool.role.label,
              quantity: pool.role.quantity,
              sizeDescriptor: pool.role.specSizeDescriptor,
              capacity: pool.role.specCapacity,
              paletteMaterials: pool.role.specPaletteMaterials
            })),
            mustPreserve
          }
        }),
        PRODUCT_SOURCING_AI_TIMEOUT_MS,
        "Product visual sourcing timed out."
      );
      outcomes = resolveSpecRoleOutcomes({
        pools: plan.pools,
        roleResults: result.roleResults,
        selections: result.selectedProducts
      });
      visualPass = {
        ...visualPass,
        used: true,
        promptKey: result.promptKey,
        promptVersion: result.promptVersion,
        model: result.model,
        textCostUsd: result.textCostUsd ?? null
      };
    } catch (error) {
      // Honest degraded path: catalogue ranking against the spec, labelled as
      // such on every row, never presented as a visual match.
      const message = error instanceof Error ? error.message : "Product visual sourcing failed.";
      console.error("Product visual sourcing failed; falling back to ranking.", error);
      outcomes = resolveSpecRoleOutcomesByRanking(
        plan.pools,
        "Chosen by catalogue ranking because the visual pass was unavailable; check it against the concept."
      );
      visualPass = { ...visualPass, used: false, error: message };
    }
  }

  const resolved = roleOptionsFromOutcomes(outcomes);
  missingRoles = [...plan.missing, ...resolved.missing];

  // Aggregate budget adherence: per-role picks have no view of the running
  // total, so downgrade to cheaper in-pool alternates before persisting.
  const budgetFit = fitSelectionToBudget({
    roleOptions: resolved.roleOptions,
    selectedProductIdByRole: resolved.selectedProductIdByRole,
    budgetMaxAed: project.budget_max_aed ?? null
  });
  const selection = budgetFit.selectedProductIdByRole;
  const roleOptions = selectedFirst(resolved.roleOptions, selection);
  const reasonBySelectedId = new Map(
    outcomes
      .filter((outcome): outcome is Extract<SpecRoleOutcome, { kind: "selected" }> => outcome.kind === "selected")
      .map((outcome) => [outcome.selectedProductId, whyThisPiece(outcome)])
  );
  const roleByProductId = new Map<string, RoomProductRoleSpec>();
  for (const role of roleOptions) {
    for (const option of role.options) {
      roleByProductId.set(option.id, role);
    }
  }
  const itemRows = buildShoppingListItemRows({
    roleOptions,
    selectedProductIdByRole: selection,
    reasonFor: (match) =>
      reasonBySelectedId.get(match.id) ??
      alternateProse(match, roleByProductId.get(match.id) ?? { category: match.categoryNormalized ?? "", label: "role", visualBrief: null, quantity: 1, priority: "supporting" })
  });

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
        .insert({ room_id: roomId, concept_id: conceptId, status: "draft" })
        .select("id")
        .single();

  if (shoppingListResult.error || !shoppingListResult.data) {
    throw new Error(shoppingListResult.error?.message ?? "Could not open the shopping list.");
  }

  const shoppingListId = shoppingListResult.data.id;
  const { error: deleteError } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("shopping_list_id", shoppingListId);
  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (itemRows.length > 0) {
    const { error: itemError } = await supabase
      .from("shopping_list_items")
      .insert(itemRows.map((row) => ({ ...row, shopping_list_id: shoppingListId })));
    if (itemError) {
      throw new Error(itemError.message);
    }
  }

  const estimatedTotal = selectedItemsTotalAed(itemRows);
  const { error: listUpdateError } = await supabase
    .from("shopping_lists")
    .update({
      estimated_total_aed: estimatedTotal,
      missing_roles: missingRoles,
      updated_at: new Date().toISOString()
    })
    .eq("id", shoppingListId);
  if (listUpdateError) {
    throw new Error(listUpdateError.message);
  }

  await supabase.from("rooms").update({ status: "sourcing" }).eq("id", roomId);

  const selectedCount = itemRows.filter((row) => row.status === "selected").length;
  const missingRoleCount = missingRoles.filter((entry) => entry.kind === "missing").length;

  await serviceSupabase
    .from("ai_jobs")
    .update({
      status: "succeeded",
      completed_at: new Date().toISOString(),
      model: visualPass.model ?? stageTextConfig("product_sourcing", configuredTextModel()).model,
      prompt_version: visualPass.promptVersion,
      cost_estimate_usd: sumUsdCosts(visualPass.textCostUsd, paletteTextCostUsd),
      output_summary: {
        specSource,
        roleCount: roles.length,
        poolCount: plan.pools.length,
        selectedCount,
        missingRoles: missingRoles.filter((entry) => entry.kind === "missing").map((entry) => entry.label),
        unsourceable: missingRoles.filter((entry) => entry.kind !== "missing").map((entry) => entry.label),
        contractRejections,
        visualPass,
        budgetFit: {
          adjusted: budgetFit.adjusted,
          withinBudget: budgetFit.withinBudget,
          downgrades: budgetFit.downgrades.length
        },
        shoppingListId,
        estimatedTotalAed: estimatedTotal
      }
    })
    .eq("id", sourcingJob.id);

  return { status: "sourced", selectedCount, missingRoleCount };
}

// ------------------------------------------------------------- refill

export type ShoppingOptionRefillInput = {
  projectId: string;
  roomId: string;
  shoppingListId: string;
  category: string;
  // The role's label (a spec object's label after S3). Scopes the refill to
  // ONE role when a category carries several; absent for legacy lists.
  roleLabel?: string | null;
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
  matches: RankedProductMatch[]
) {
  return matches.map((match, index) => {
    const unitPrice = match.salePriceAed ?? match.priceAed ?? 0;
    return {
      shopping_list_id: shoppingListId,
      product_id: match.id,
      category,
      status: "option",
      role_label: template.role_label,
      role_visual_brief: template.role_visual_brief,
      role_priority: template.role_priority,
      role_quantity: template.role_quantity,
      option_rank: template.option_rank + index + 1,
      quantity: template.role_quantity,
      unit_price_aed: unitPrice,
      line_total_aed: unitPrice * template.role_quantity,
      selection_reason: [match.selectionReason, ...match.warnings.filter((warning) => warning !== match.dimensionFitNote)].join(" "),
      dimension_fit_note: match.dimensionFitNote,
      sort_order: template.option_rank + index + 1
    };
  });
}

// The spec role a persisted row belongs to, by label (the row's role_label is
// the spec object's label verbatim), so refills and swaps re-run the SAME
// contract sourcing used. Null when the list was built without a spec.
export async function specRoleForListRow(
  serviceSupabase: ServiceSupabaseClient,
  { roomId, conceptId, roomType, roleLabel }: { roomId: string; conceptId: string | null; roomType: string; roleLabel: string | null | undefined }
): Promise<SpecSourcingRole | null> {
  if (!conceptId || !roleLabel) {
    return null;
  }
  const { data: specRow } = await serviceSupabase
    .from("room_design_specs")
    .select("*")
    .eq("room_id", roomId)
    .eq("concept_id", conceptId)
    .maybeSingle();
  if (!specRow) {
    return null;
  }
  const { parseRoomDesignSpecRow } = await import("@ritzy-studio/domain");
  const spec = parseRoomDesignSpecRow(specRow);
  if (!spec) {
    return null;
  }
  const wanted = roleLabel.trim().toLowerCase();
  return (
    sourcingRolesFromDesignSpec(spec, roomType).roles.find((role) => role.label.trim().toLowerCase() === wanted) ?? null
  );
}

async function loadRefillContext(
  { supabase, serviceSupabase }: Clients,
  { projectId, roomId, shoppingListId, category, roleLabel }: ShoppingOptionRefillInput,
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

  let rowsQuery = supabase
    .from("shopping_list_items")
    .select(itemColumns)
    .eq("shopping_list_id", shoppingListId)
    .eq("category", category);
  if (roleLabel) {
    rowsQuery = rowsQuery.eq("role_label", roleLabel);
  }
  const { data: existingRows } = await rowsQuery;

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

  const specRole = await specRoleForListRow(serviceSupabase, {
    roomId,
    conceptId: shoppingList.concept_id,
    roomType: room.room_type,
    roleLabel: roleLabel ?? null
  });

  return { room, project, concept, existingRows, measurements, products, specRole };
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
  limit,
  specRole
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
  specRole: SpecSourcingRole | null;
}) {
  const allCandidates = (products ?? [])
    .map(productToMatchCandidate)
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));
  // Spec-constrained: only contract-clean candidates can refill a spec role.
  const candidates = specRole
    ? allCandidates.filter((candidate) => checkCandidateAgainstSpecRole(candidate, specRole).ok)
    : allCandidates;

  const conceptText = `${concept.title}\n${concept.description ?? ""}`;
  const role =
    specRole ??
    shoppingListRoleSpecFromRow({
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
  clients: Clients,
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
    limit: 2,
    specRole: context.specRole
  });

  if (fresh.length === 0) {
    return { status: "no_change" };
  }

  let rejectQuery = clients.supabase
    .from("shopping_list_items")
    .update({ status: "rejected" })
    .eq("shopping_list_id", input.shoppingListId)
    .eq("category", input.category)
    .neq("status", "selected");
  if (input.roleLabel) {
    rejectQuery = rejectQuery.eq("role_label", input.roleLabel);
  }
  await rejectQuery;

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
// that role, skip products already in the list, and append fresh options.
export async function findMoreShoppingOptions(
  clients: Clients,
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
    limit: 3,
    specRole: context.specRole
  });

  if (fresh.length === 0) {
    return { status: "no_candidates" };
  }

  await clients.supabase
    .from("shopping_list_items")
    .insert(optionRowsFromMatches(input.shoppingListId, input.category, template, fresh));
  return { status: "appended" };
}
