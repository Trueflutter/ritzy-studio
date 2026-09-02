import type { Database } from "@ritzy-studio/db";
import { configuredTextModel } from "@ritzy-studio/config";
import { verifyProductsAgainstConcept,
  stageTextConfig
} from "@ritzy-studio/ai";
import {
  checkCandidateAgainstSpecRole,
  filterSubstitutionCandidates,
  selectedItemsTotalAed,
  type ProductMatchCandidate,
  type SubstitutionMode,
  PRODUCT_CONSISTENCY_THRESHOLD
} from "@ritzy-studio/domain";

import { alternateProse, specRoleForListRow } from "./product-sourcing";
import { storageImageDataUrl } from "./storage-images";
import type { ServiceSupabaseClient, UserSupabaseClient } from "./supabase-clients";
import {
  PRODUCT_MATCHING_CATALOG_LIMIT,
  productToMatchCandidate,
  roleScopedShoppingAlternates,
  shoppingListRoleSpecFromRow,
  type ProductRow,
  sourcingCandidateImageDataUrls
} from "./sourcing-support";

// The selection-swap service (S1 extraction): typed inputs and results, all
// persisted state transitions owned here. The action wrappers keep auth,
// entitlement gating, redirects, and user-facing copy.

export type SubstituteProductInput = {
  projectId: string;
  roomId: string;
  shoppingListId: string;
  itemId: string;
  mode: SubstitutionMode;
};

// The app chooses the replacement in a swap, so the same rule holds as in
// sourcing: it may only become the shopper's selected piece once something has
// judged it against the design. A swap that cannot be verified is refused
// rather than written, and the shopper keeps the piece they had.
export type SubstituteProductResult =
  | { status: "swapped"; priceImpactAed: number }
  | { status: "not_substitutable" }
  | { status: "no_replacement" }
  // The design spec changed since this list was sourced: re-source first.
  | { status: "stale_spec" }
  // The replacement did not match the design, or could not be checked.
  | { status: "not_verified" }
  | { status: "not_found" };

export async function substituteProduct(
  { supabase, serviceSupabase }: { supabase: UserSupabaseClient; serviceSupabase: ServiceSupabaseClient },
  { projectId, roomId, shoppingListId, itemId, mode }: SubstituteProductInput,
  {
    ensureEntitled,
    verifyProducts = verifyProductsAgainstConcept,
    fetchProductImages = sourcingCandidateImageDataUrls
  }: {
    // The commerce paywall gate, injected so it runs at the exact pre-extraction
    // position (before any read or write) and the suite can pin that ordering.
    ensureEntitled: () => Promise<void>;
    // The design check and its image fetch, injected like the sourcing service's.
    verifyProducts?: typeof verifyProductsAgainstConcept;
    fetchProductImages?: typeof sourcingCandidateImageDataUrls;
  }
): Promise<SubstituteProductResult> {
  await ensureEntitled();

  const { data: project } = await supabase
    .from("projects")
    .select("id, budget_max_aed")
    .eq("id", projectId)
    .single();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type, project:projects(owner_user_id)")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  const { data: shoppingList } = await supabase
    .from("shopping_lists")
    .select("id, concept_id, spec_source")
    .eq("id", shoppingListId)
    // Already bound to the room in the request: row-level security lets a
    // shopper read both of their own lists, so an id alone would let one
    // room's spec, measurements and budget govern another room's swap.
    .eq("room_id", roomId)
    .single();

  const { data: item } = await serviceSupabase
    .from("shopping_list_items")
    .select(
      `
      *,
      product:products(
        *,
        retailer:retailers(name, status),
        dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
      )
    `
    )
    .eq("id", itemId)
    .eq("shopping_list_id", shoppingListId)
    .single();

  if (!project || !room || !shoppingList?.concept_id || !item?.product) {
    return { status: "not_found" };
  }

  const { data: concept } = await supabase
    .from("concepts")
    .select("id, title, description, primary_image_asset:room_assets!concepts_primary_image_asset_id_fkey(storage_path, mime_type)")
    .eq("id", shoppingList.concept_id)
    .eq("room_id", roomId)
    .single();

  if (!concept) {
    return { status: "not_found" };
  }

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("wall_length_cm, room_depth_cm")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: selectedItems = [] } = await supabase
    .from("shopping_list_items")
    .select("product_id")
    .eq("shopping_list_id", shoppingListId);

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

  const currentCandidate = productToMatchCandidate(item.product as ProductRow);
  const candidates = (products ?? [])
    .map(productToMatchCandidate)
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));

  if (!currentCandidate) {
    return { status: "not_substitutable" };
  }

  // S3: a swap stays inside the row's spec contract, resolved by the row's
  // spec key (its label for rows that predate keys). A list whose spec has
  // moved on is stale and must be re-sourced, never swapped unconstrained.
  const rowRole = await specRoleForListRow(serviceSupabase, {
    roomId,
    conceptId: shoppingList.concept_id,
    roomType: room.room_type,
    specSource: shoppingList.spec_source,
    specKey: item.spec_key,
    roleLabel: item.role_label
  });
  // Stale, or unreadable: either way the row's contract cannot be applied,
  // and swapping without it is how a chandelier lands in a floor-lamp role.
  if (rowRole.status === "stale" || rowRole.status === "unavailable") {
    return { status: "stale_spec" };
  }
  const specRole = rowRole.status === "role" ? rowRole.role : null;
  const contractClean = specRole
    ? candidates.filter((candidate) => checkCandidateAgainstSpecRole(candidate, specRole).ok)
    : candidates;
  const alternatives = filterSubstitutionCandidates({
    current: currentCandidate,
    candidates: contractClean,
    mode,
    selectedProductIds: (selectedItems ?? []).map((selected) => selected.product_id)
  });

  const conceptText = `${concept.title}\n${concept.description ?? ""}`;
  const role = specRole ?? shoppingListRoleSpecFromRow(item);
  const ranked = roleScopedShoppingAlternates({
    roomType: room.room_type,
    conceptText,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? {
          wallLengthCm: measurements.wall_length_cm,
          roomDepthCm: measurements.room_depth_cm
        }
      : null,
    role,
    candidates: alternatives,
    excludeProductIds: new Set([currentCandidate.id]),
    limit: 1
  });
  const replacement = ranked[0];

  if (!replacement) {
    return { status: "no_replacement" };
  }

  // The design check, on the one piece being swapped in. Nothing the app
  // chooses reaches a shopper's list as "selected" without a verdict, and a
  // swap is the app choosing.
  const renderPath = concept.primary_image_asset?.storage_path;
  const conceptImageUrl = renderPath
    ? await storageImageDataUrl(serviceSupabase, "generated-renders", renderPath, concept.primary_image_asset?.mime_type ?? "image/png")
    : null;
  const productImages = conceptImageUrl ? await fetchProductImages([replacement], 1) : {};
  const replacementImage = productImages[replacement.id];
  if (!conceptImageUrl || !replacementImage) {
    return { status: "not_verified" };
  }
  // Spend never precedes its audit row, here as in sourcing: this is a paid
  // vision call on every swap, and the ai_jobs ledger is the only place the
  // per-room cost aggregation can see it.
  const { data: checkJob, error: checkJobError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: room.project?.owner_user_id ?? null,
      room_id: roomId,
      job_type: "product_design_check",
      status: "running",
      provider: "openai",
      model: stageTextConfig("product_verification", configuredTextModel()).model,
      prompt_version: null,
      input_summary: { roomId, shoppingListId, itemId, mode, productId: replacement.id }
    })
    .select("id")
    .single();

  // Spend never precedes its audit row: without a row to record the charge
  // against, the call does not happen at all and the shopper keeps the piece
  // they had. Failing closed costs a swap; failing open costs money nothing
  // can account for.
  if (checkJobError || !checkJob) {
    console.error(`Could not open the design-check job for room ${roomId}: ${checkJobError?.message ?? "no row"}`);
    return { status: "not_verified" };
  }

  const closeCheckJob = async (payload: Database["public"]["Tables"]["ai_jobs"]["Update"]) => {
    // Checked and retried, like the sourcing service's terminal write: a paid
    // call must not be left recorded as still running.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { error } = await serviceSupabase
        .from("ai_jobs")
        .update({ completed_at: new Date().toISOString(), ...payload })
        .eq("id", checkJob.id);
      if (!error) {
        return;
      }
      if (attempt === 1) {
        console.error(`Could not close design-check job ${checkJob.id} (${payload.status}): ${error.message}`);
      }
    }
  };

  try {
    const checked = await verifyProducts({
      conceptImageUrl,
      products: [
        {
          productId: replacement.id,
          productName: replacement.name,
          roleLabel: role.label,
          category: role.category,
          imageDataUrl: replacementImage
        }
      ],
      threshold: PRODUCT_CONSISTENCY_THRESHOLD
    });
    const verdict = checked.verdicts.find((entry) => entry.productId === replacement.id);
    const passed = Boolean(verdict && verdict.categoryMatches && verdict.similarity >= PRODUCT_CONSISTENCY_THRESHOLD);
    await closeCheckJob({
      status: "succeeded",
      model: checked.model,
      prompt_version: checked.promptVersion,
      cost_estimate_usd: checked.textCostUsd ?? null,
      output_summary: {
        promptKey: checked.promptKey,
        productId: replacement.id,
        passed,
        similarity: verdict?.similarity ?? null,
        categoryMatches: verdict?.categoryMatches ?? null
      }
    });
    if (!passed) {
      return { status: "not_verified" };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "The design check failed.";
    console.error("The design check failed for a swap; the shopper keeps the piece they had.", error);
    await closeCheckJob({ status: "failed", error_message: message });
    return { status: "not_verified" };
  }

  const previousPrice = Number(item.line_total_aed ?? item.unit_price_aed ?? 0);
  const unitPrice = replacement.salePriceAed ?? replacement.priceAed ?? 0;
  // The swap keeps the row's purchase quantity — a "Buy 2" role still buys 2.
  const lineTotal = unitPrice * item.quantity;
  const priceImpact = lineTotal - previousPrice;

  const { error: updateError } = await supabase
    .from("shopping_list_items")
    .update({
      product_id: replacement.id,
      category: replacement.categoryNormalized ?? item.category,
      unit_price_aed: unitPrice,
      line_total_aed: lineTotal,
      // Prose only (12.7); the swap's own reason, not ranking warnings.
      selection_reason: `Swapped in as the ${SWAP_MODE_LABEL[mode]} option. ${alternateProse(replacement, role)}`,
      dimension_fit_note: replacement.dimensionFitNote,
      updated_at: new Date().toISOString()
    })
    .eq("id", item.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Estimate selected rows only — option pools must not inflate the total.
  await recalculateShoppingListTotal(supabase, shoppingListId);

  return { status: "swapped", priceImpactAed: priceImpact };
}

const SWAP_MODE_LABEL: Record<SubstitutionMode, string> = {
  cheaper: "cheaper",
  closer_style: "closer-style",
  same_retailer: "same-retailer",
  in_stock: "in-stock"
};

export async function recalculateShoppingListTotal(supabase: UserSupabaseClient, shoppingListId: string) {
  const { data: rows } = await supabase
    .from("shopping_list_items")
    .select("status, unit_price_aed, quantity")
    .eq("shopping_list_id", shoppingListId);
  await supabase
    .from("shopping_lists")
    .update({
      estimated_total_aed: selectedItemsTotalAed(rows ?? []),
      updated_at: new Date().toISOString()
    })
    .eq("id", shoppingListId);
}

export type SelectShoppingItemInput = {
  shoppingListId: string;
  itemId: string;
};

export type SelectShoppingItemResult = { status: "selected" } | { status: "not_found" };

export async function selectShoppingItem(
  supabase: UserSupabaseClient,
  { shoppingListId, itemId }: SelectShoppingItemInput
): Promise<SelectShoppingItemResult> {
  const { data: item } = await supabase
    .from("shopping_list_items")
    .select("id, category, role_label, spec_key")
    .eq("id", itemId)
    .eq("shopping_list_id", shoppingListId)
    .single();

  if (!item) {
    return { status: "not_found" };
  }

  // One pick per ROLE, identified by the row's spec key (category plus label
  // for rows that predate keys): a floor lamp and a pendant are both
  // lighting, and two roles the user labelled alike are still two roles. A
  // keyed role is cleared by its key alone: a swap may have moved the pick's
  // category inside the role's allowed classes (armchairs to chairs).
  const clearSelection = supabase.from("shopping_list_items").update({ status: "option" }).eq("shopping_list_id", shoppingListId);
  await (item.spec_key
    ? clearSelection.eq("spec_key", item.spec_key)
    : clearSelection.eq("category", item.category).eq("role_label", item.role_label)
  ).eq("status", "selected");
  await supabase
    .from("shopping_list_items")
    .update({ status: "selected" })
    .eq("id", itemId)
    .eq("shopping_list_id", shoppingListId);

  await recalculateShoppingListTotal(supabase, shoppingListId);
  return { status: "selected" };
}
