import { ButtonLink, SubmitButton } from "@ritzy-studio/ui";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { groupShoppingItemsByRole, selectedItemsTotalAed } from "@ritzy-studio/domain";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createDesignerSubscriptionCheckoutAction,
  createHomeownerRoomUnlockCheckoutAction
} from "@/app/actions";

import type { ProductCardItem } from "./product-card";
import { ShoppingListGrid, type CategoryGroup } from "./shopping-list-grid";

export const dynamic = "force-dynamic";

export default async function ShoppingListPage({
  params
}: {
  params: Promise<{ projectId: string; roomId: string }>;
}) {
  const { projectId, roomId } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  if (!project || !room) {
    notFound();
  }

  const serviceSupabase = createServiceClient();
  const { data: shoppingList } = await supabase
    .from("shopping_lists")
    .select("*, concept:concepts(title)")
    .eq("room_id", roomId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: items = [] } = shoppingList
    ? await serviceSupabase
        .from("shopping_list_items")
        .select(
          `
          *,
          product:products(
            *,
            retailer:retailers(name, domain),
            dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
          )
        `
        )
        .eq("shopping_list_id", shoppingList.id)
        .order("sort_order", { ascending: true })
    : { data: [] };
  const listItems = items ?? [];
  const currentEstimateAed =
    listItems.length > 0 ? selectedItemsTotalAed(listItems) : shoppingList?.estimated_total_aed;
  const selectedItemCount = listItems.filter((item) => item.status === "selected").length;
  const { data: canAccessCommerce = false } = await supabase.rpc("can_access_room_commerce", {
    room_id: roomId
  });
  const commerceUnlocked = Boolean(canAccessCommerce);
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("intended_mode")
    .eq("user_id", user.id)
    .maybeSingle();
  const isDesignerMode = profile?.intended_mode === "designer" || profile?.intended_mode === "both";

  const cardItems: ProductCardItem[] = listItems.map((item) => {
    const product = item.product;
    const dimensions = product?.dimensions?.[0];
    const warnings = warningsFor(item, product);
    const warning = warnings.length > 0 ? warnings.join(" ") : null;
    const lineTotal = currentLineTotalAed(item);

    return {
      id: item.id,
      shoppingListId: shoppingList?.id ?? "",
      warning,
      detail: {
        id: item.id,
        name: product?.name ?? "Product unavailable",
        imageUrl: product?.primary_image_url ?? null,
        retailerName: product?.retailer?.name ?? null,
        category: item.category,
        priceLabel: formatAed(lineTotal),
        dimensionsLabel:
          dimensions?.source_text ??
          dimensionsText(dimensions?.width_cm, dimensions?.depth_cm, dimensions?.height_cm),
        description: product?.description ?? null,
        retailerUrl: product?.canonical_url ?? null,
        warning
      }
    };
  });

  // Sourced items arrive as ranked options grouped by room role. Rebuild those
  // role groups for the picker — grouping drops rejected options and surfaces
  // the selected pick. Legacy one-row-per-product lists group cleanly too.
  const cardItemById = new Map(cardItems.map((card) => [card.id, card]));
  const roleGroups: CategoryGroup[] = groupShoppingItemsByRole(listItems).map((group) => ({
    category: group.category,
    label: group.label,
    priority: group.priority,
    quantity: group.quantity,
    selectedId: group.selectedId,
    items: group.options
      .map((option) => cardItemById.get(option.id))
      .filter((card): card is ProductCardItem => Boolean(card))
  }));

  return (
    <main className="min-h-dvh bg-page text-ink">
      <header className="flex min-h-20 items-center justify-between border-b border-line bg-surface px-5 md:px-8 lg:px-12 xl:px-16">
        <Link className="font-display text-[28px] font-light text-ink" href="/">
          Ri <span className="font-body text-caption font-medium uppercase text-ink-muted">Ritzy Studio</span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ButtonLink
            href="/"
            trailing="→"
            variant="secondary"
          >
            Studio
          </ButtonLink>
          <ButtonLink
            href={`/projects/${projectId}/rooms/${roomId}/concepts`}
            trailing="→"
            variant="secondary"
          >
            Concepts
          </ButtonLink>
          <ButtonLink
            href={`/projects/${projectId}/rooms/${roomId}/presentation`}
            trailing="→"
            variant="primary"
          >
            Presentation
          </ButtonLink>
        </div>
      </header>

      <section className="mx-auto max-w-[1280px] px-5 py-12 md:px-8 lg:px-12 xl:px-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
              Shopping list
            </p>
            <div className="mt-3 h-px w-32 bg-ink" />
            <h1 className="mt-8 font-display text-display-l font-light leading-[1] tracking-[-0.015em] text-ink">
              Choose the pieces for each category.
            </h1>
            <p className="mt-5 max-w-[640px] font-body text-body-m text-ink-secondary">
              {project.name} · {room.name} · {shoppingList?.concept?.title ?? "No selected concept"}
            </p>
            <p className="mt-3 max-w-[640px] font-body text-body-s text-ink-muted">
              Each section below is a category your {room.room_type} needs — some need more than
              one piece. Click a card to choose it, or expand the image for detail.
            </p>
          </div>

          <aside className="border border-line bg-surface p-5 lg:self-start">
            <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
              Estimate
            </p>
            <div className="mt-3 h-px w-20 bg-ink" />
            <p className="mt-6 font-display text-display-xs font-light italic text-ink">
              {formatAed(currentEstimateAed)}
            </p>
            <p className="mt-4 font-body text-body-s text-ink-secondary">
              {selectedItemCount} piece{selectedItemCount === 1 ? "" : "s"} selected.
            </p>
            {!commerceUnlocked && isDesignerMode ? (
              <form action={createDesignerSubscriptionCheckoutAction} className="mt-6 border-t border-line pt-5">
                <input
                  name="returnTo"
                  type="hidden"
                  value={`/projects/${projectId}/rooms/${roomId}/shopping-list`}
                />
                <p className="mb-5 font-body text-body-s text-ink-secondary">
                  Start the designer plan to reveal retailer links, presentations, product swaps,
                  final renders, and additional rooms.
                </p>
                <SubmitButton className="w-full" pendingLabel="Opening secure checkout...">
                  Start designer plan
                </SubmitButton>
              </form>
            ) : !commerceUnlocked ? (
              <form action={createHomeownerRoomUnlockCheckoutAction} className="mt-6 border-t border-line pt-5">
                <input name="projectId" type="hidden" value={projectId} />
                <input name="roomId" type="hidden" value={roomId} />
                <p className="mb-5 font-body text-body-s text-ink-secondary">
                  Unlock retailer links, eligible partner discounts, and the final room plan for
                  AED 100.
                </p>
                <SubmitButton className="w-full" pendingLabel="Opening secure checkout...">
                  Unlock room
                </SubmitButton>
              </form>
            ) : (
              <p className="mt-6 border-t border-line pt-5 font-display text-body-s italic text-success">
                Room commerce unlocked.
              </p>
            )}
          </aside>
        </div>

        <section className="mt-12">
          {shoppingList && roleGroups.length > 0 ? (
            <ShoppingListGrid
              canAccessCommerce={commerceUnlocked}
              conceptId={shoppingList.concept_id ?? null}
              groups={roleGroups}
              projectId={projectId}
              roomId={roomId}
              shoppingListId={shoppingList.id}
            />
          ) : (
            <div className="border border-line bg-surface p-10">
              <p className="font-display text-display-xs font-light italic text-ink">
                No shopping list yet.
              </p>
              <p className="mt-4 max-w-[560px] font-body text-body-s text-ink-secondary">
                Match products from the concepts page to create a draft catalog estimate.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function formatAed(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "AED not available";
  }

  return `AED ${Number(value).toLocaleString("en-AE", {
    maximumFractionDigits: 0
  })}`;
}

function dimensionsText(
  width: number | null | undefined,
  depth: number | null | undefined,
  height: number | null | undefined
) {
  const parts = [
    width ? `W ${width}` : null,
    depth ? `D ${depth}` : null,
    height ? `H ${height}` : null
  ].filter(Boolean);

  return parts.length > 0 ? `${parts.join(" × ")} cm` : "not available";
}

function currentLineTotalAed(item: {
  quantity: number | null;
  line_total_aed: number | null;
  product:
    | {
        sale_price_aed: number | null;
        price_aed: number | null;
      }
    | null;
}) {
  const unitPrice = item.product?.sale_price_aed ?? item.product?.price_aed;
  if (unitPrice !== null && unitPrice !== undefined) {
    return unitPrice * (item.quantity ?? 1);
  }

  return item.line_total_aed ?? 0;
}

function warningsFor(
  item: { dimension_fit_note: string | null; selection_reason: string | null },
  product:
    | {
        last_checked_at: string | null;
        dimensions: Array<{ source_text: string | null }> | null;
      }
    | null
) {
  const warnings: string[] = [];
  const hasCatalogDimensions = Boolean(product?.dimensions?.[0]?.source_text);

  if (!hasCatalogDimensions && !item.dimension_fit_note) {
    warnings.push("Dimensions missing.");
  }

  if (!product?.last_checked_at || Date.now() - new Date(product.last_checked_at).getTime() > 1000 * 60 * 60 * 24 * 7) {
    warnings.push("Price or stock may be stale.");
  }

  const staleMissingDimensionNote =
    hasCatalogDimensions && item.dimension_fit_note?.toLowerCase().includes("dimensions missing");

  if (
    item.dimension_fit_note &&
    !item.dimension_fit_note.startsWith("verified") &&
    !staleMissingDimensionNote
  ) {
    warnings.push(item.dimension_fit_note);
  }

  return Array.from(new Set(warnings));
}
