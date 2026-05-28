import { ButtonLink } from "@ritzy-studio/ui";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { groupShoppingItemsByRole, selectedItemsTotalAed } from "@ritzy-studio/domain";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PrintButton } from "./print-button";
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
  const retailerGroups = groupSelectedItemsByRetailer(listItems);

  const selectedItemIds = listItems
    .filter((item) => item.status === "selected")
    .map((item) => item.id)
    .sort();
  const selectionKey = selectedItemIds.join(",");
  const { data: matchingRenderJob } =
    commerceUnlocked && shoppingList && shoppingList.concept_id
      ? await serviceSupabase
          .from("render_jobs")
          .select("output_asset_ids")
          .eq("room_id", roomId)
          .eq("concept_id", shoppingList.concept_id)
          .eq("shopping_list_id", shoppingList.id)
          .contains("input_summary", { selectionKey })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
  const matchingRenderAssetId = Array.isArray(matchingRenderJob?.output_asset_ids)
    ? matchingRenderJob.output_asset_ids[0]
    : null;
  const { data: finalRenderAsset } = matchingRenderAssetId
    ? await supabase
        .from("room_assets")
        .select("storage_path")
        .eq("id", matchingRenderAssetId)
        .eq("room_id", roomId)
        .eq("asset_type", "final_render")
        .maybeSingle()
    : { data: null };
  const finalRenderUrl = finalRenderAsset?.storage_path
    ? (
        await serviceSupabase.storage
          .from("generated-renders")
          .createSignedUrl(finalRenderAsset.storage_path, 60 * 60)
      ).data?.signedUrl
    : null;
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
    <main className="min-h-dvh bg-page text-ink print:bg-surface">
      <header className="flex min-h-20 items-center justify-between border-b border-line bg-surface px-5 md:px-8 lg:px-12 xl:px-16 print:hidden">
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
            Room Preview
          </ButtonLink>
          {commerceUnlocked ? <PrintButton /> : null}
        </div>
      </header>

      <section className="mx-auto max-w-[1280px] px-5 py-12 md:px-8 lg:px-12 xl:px-16 print:max-w-none print:px-0 print:py-0">
        {commerceUnlocked ? (
          <div className="hidden print:mb-8 print:block">
            <h1 className="font-display text-display-m font-light leading-[1.05] tracking-[-0.015em] text-ink">
              {project.client_name ?? project.name}
            </h1>
            <p className="mt-3 font-body text-body-s text-ink-secondary">
              {room.name} · {room.room_type} · {project.location ?? "Dubai / UAE"}
            </p>
          </div>
        ) : null}

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] print:hidden">
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
          </aside>
        </div>

        {commerceUnlocked && finalRenderUrl ? (
          <section className="mt-12 print:mt-0">
            <div className="aspect-[3/2] border border-line bg-page">
              <Image
                alt="Final room render"
                className="h-full w-full object-cover"
                height={1024}
                src={finalRenderUrl}
                unoptimized
                width={1536}
              />
            </div>
          </section>
        ) : null}

        <section className="mt-12 print:mt-8">
          {shoppingList && roleGroups.length > 0 ? (
            <>
              <div className="print:hidden">
                <ShoppingListGrid
                  canAccessCommerce={commerceUnlocked}
                  conceptId={shoppingList.concept_id ?? null}
                  clientName={project.client_name}
                  groups={roleGroups}
                  projectId={projectId}
                  roomType={room.room_type}
                  roomId={roomId}
                  shoppingListId={shoppingList.id}
                  showRenderCta={!commerceUnlocked}
                />
              </div>
              {commerceUnlocked ? <RetailerGroups groups={retailerGroups} /> : null}
            </>
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

type RetailerGroup = {
  domain: string | null;
  itemCount: number;
  items: Array<{
    category: string;
    id: string;
    lastCheckedAt: string | null;
    lineTotalAed: number;
    name: string;
    quantity: number;
    retailerUrl: string | null;
    unitPriceAed: number | null;
  }>;
  name: string;
  subtotalAed: number;
};

function RetailerGroups({ groups }: { groups: RetailerGroup[] }) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="mt-14 border-t border-line pt-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
            Retailer groups
          </p>
          <h2 className="mt-4 font-display text-display-s font-light italic text-ink">
            Purchase paths, grouped by retailer.
          </h2>
        </div>
        <p className="max-w-[420px] font-body text-body-s text-ink-secondary md:text-right">
          Each retailer group has its own subtotal and product links. Prices and stock should be
          rechecked on the retailer page before checkout.
        </p>
      </div>

      <div className="mt-8 grid gap-5">
        {groups.map((group) => (
          <article className="border border-line bg-surface" key={group.name}>
            <div className="grid gap-4 border-b border-line p-5 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
              <div>
                <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                  {group.itemCount} item{group.itemCount === 1 ? "" : "s"}
                </p>
                <h3 className="mt-3 font-display text-display-xs font-light italic text-ink">
                  {group.name}
                </h3>
                <p className="mt-3 font-body text-body-s text-ink-secondary">
                  {freshnessText(group.items)}
                </p>
              </div>
              <div className="md:text-right">
                <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                  Retailer subtotal
                </p>
                <p className="mt-3 font-display text-display-xs font-light italic text-ink">
                  {formatAed(group.subtotalAed)}
                </p>
                {group.domain ? (
                  <a
                    className="mt-4 inline-flex border border-line px-4 py-3 font-body text-button uppercase tracking-[0.18em] text-ink transition-colors duration-micro ease-standard hover:bg-surface-subtle"
                    href={`https://${group.domain}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open retailer
                  </a>
                ) : null}
              </div>
            </div>

            <div className="divide-y divide-line">
              {group.items.map((item) => (
                <div
                  className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_140px_160px] md:items-center"
                  key={item.id}
                >
                  <div>
                    <p className="font-display text-body-l font-light italic leading-snug text-ink">
                      {item.name}
                    </p>
                    <p className="mt-2 font-body text-caption uppercase tracking-[0.24em] text-ink-muted">
                      {item.category} · Qty {item.quantity}
                    </p>
                  </div>
                  <div className="font-body text-body-s text-ink-secondary md:text-right">
                    <p>{formatAed(item.lineTotalAed)}</p>
                    {item.quantity > 1 && item.unitPriceAed !== null ? (
                      <p className="mt-1 text-ink-muted">
                        {item.quantity} × {formatAed(item.unitPriceAed)}
                      </p>
                    ) : null}
                  </div>
                  <div className="md:text-right">
                    {item.retailerUrl ? (
                      <a
                        className="font-display text-button-quiet italic text-ink transition-colors duration-micro ease-standard hover:text-accent-deep"
                        href={item.retailerUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        product page →
                      </a>
                    ) : (
                      <span className="font-body text-caption uppercase tracking-[0.24em] text-ink-muted">
                        link unavailable
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function groupSelectedItemsByRetailer(
  items: Array<{
    category: string;
    id: string;
    quantity: number | null;
    status: string | null;
    product:
      | {
          canonical_url: string | null;
          last_checked_at: string | null;
          name: string;
          price_aed: number | null;
          retailer: { domain: string | null; name: string | null } | null;
          sale_price_aed: number | null;
        }
      | null;
    line_total_aed: number | null;
  }>
): RetailerGroup[] {
  const groups = new Map<string, RetailerGroup>();

  for (const item of items) {
    if (item.status !== "selected") {
      continue;
    }

    const product = item.product;
    const retailerName = product?.retailer?.name ?? "Retailer";
    const quantity = item.quantity ?? 1;
    const unitPriceAed = product?.sale_price_aed ?? product?.price_aed ?? null;
    const lineTotalAed = currentLineTotalAed(item);
    const existing = groups.get(retailerName) ?? {
      domain: product?.retailer?.domain ?? null,
      itemCount: 0,
      items: [],
      name: retailerName,
      subtotalAed: 0
    };

    existing.itemCount += quantity;
    existing.subtotalAed += lineTotalAed;
    existing.items.push({
      category: item.category,
      id: item.id,
      lastCheckedAt: product?.last_checked_at ?? null,
      lineTotalAed,
      name: product?.name ?? "Product unavailable",
      quantity,
      retailerUrl: product?.canonical_url ?? null,
      unitPriceAed
    });

    groups.set(retailerName, existing);
  }

  return [...groups.values()].sort((a, b) => b.subtotalAed - a.subtotalAed);
}

function freshnessText(items: Array<{ lastCheckedAt: string | null }>) {
  const timestamps = items
    .map((item) => (item.lastCheckedAt ? new Date(item.lastCheckedAt).getTime() : null))
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (timestamps.length === 0) {
    return "Stock check unavailable.";
  }

  const latest = Math.max(...timestamps);
  const days = Math.max(0, Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24)));

  if (days === 0) {
    return "Stock checked today.";
  }

  if (days === 1) {
    return "Stock checked yesterday.";
  }

  return `Stock checked ${days} days ago.`;
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
