import {
  checkCandidateAgainstSpecRole,
  filterSubstitutionCandidates,
  selectedItemsTotalAed,
  type ProductMatchCandidate,
  type SubstitutionMode
} from "@ritzy-studio/domain";

import { specRoleForListRow } from "./product-sourcing";
import type { ServiceSupabaseClient, UserSupabaseClient } from "./supabase-clients";
import {
  PRODUCT_MATCHING_CATALOG_LIMIT,
  productToMatchCandidate,
  roleScopedShoppingAlternates,
  shoppingListRoleSpecFromRow,
  type ProductRow
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

export type SubstituteProductResult =
  | { status: "swapped"; priceImpactAed: number }
  | { status: "not_substitutable" }
  | { status: "no_replacement" }
  | { status: "not_found" };

export async function substituteProduct(
  { supabase, serviceSupabase }: { supabase: UserSupabaseClient; serviceSupabase: ServiceSupabaseClient },
  { projectId, roomId, shoppingListId, itemId, mode }: SubstituteProductInput,
  {
    ensureEntitled
  }: {
    // The commerce paywall gate, injected so it runs at the exact pre-extraction
    // position (before any read or write) and the suite can pin that ordering.
    ensureEntitled: () => Promise<void>;
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
    .select("id, room_type")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  const { data: shoppingList } = await supabase
    .from("shopping_lists")
    .select("id, concept_id")
    .eq("id", shoppingListId)
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
    .select("id, title, description")
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

  // S3: a swap stays inside the row's spec contract. The row's role_label is
  // the spec object's label verbatim; when the list was built from a spec,
  // only contract-clean candidates can replace the piece.
  const specRole = await specRoleForListRow(serviceSupabase, {
    roomId,
    conceptId: shoppingList.concept_id,
    roomType: room.room_type,
    roleLabel: item.role_label
  });
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
      selection_reason: [
        replacement.selectionReason,
        ...replacement.warnings.filter((warning) => warning !== replacement.dimensionFitNote)
      ].join(" "),
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
    .select("id, category, role_label")
    .eq("id", itemId)
    .eq("shopping_list_id", shoppingListId)
    .single();

  if (!item) {
    return { status: "not_found" };
  }

  // One pick per ROLE (category plus label: a floor lamp and a pendant are
  // both lighting) — clear the role's current selection, then set this.
  await supabase
    .from("shopping_list_items")
    .update({ status: "option" })
    .eq("shopping_list_id", shoppingListId)
    .eq("category", item.category)
    .eq("role_label", item.role_label)
    .eq("status", "selected");
  await supabase
    .from("shopping_list_items")
    .update({ status: "selected" })
    .eq("id", itemId)
    .eq("shopping_list_id", shoppingListId);

  await recalculateShoppingListTotal(supabase, shoppingListId);
  return { status: "selected" };
}
