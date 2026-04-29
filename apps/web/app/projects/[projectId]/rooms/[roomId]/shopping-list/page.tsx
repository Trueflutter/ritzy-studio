import { ButtonLink } from "@ritzy-studio/ui";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

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

  const { data: shoppingList } = await supabase
    .from("shopping_lists")
    .select("*, concept:concepts(title)")
    .eq("room_id", roomId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: items = [] } = shoppingList
    ? await supabase
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

  return (
    <main className="min-h-dvh bg-page text-ink">
      <header className="flex min-h-20 items-center justify-between border-b border-line bg-surface px-5 md:px-8 lg:px-12 xl:px-16">
        <Link className="font-display text-[28px] font-light text-ink" href="/">
          Ri <span className="font-body text-caption font-medium uppercase text-ink-muted">Ritzy Studio</span>
        </Link>
        <div className="flex items-center gap-6">
          <ButtonLink
            href={`/projects/${projectId}/rooms/${roomId}/presentation`}
            trailing="→"
            variant="quiet"
          >
            presentation
          </ButtonLink>
          <ButtonLink
            href={`/projects/${projectId}/rooms/${roomId}/concepts`}
            trailing="→"
            variant="quiet"
          >
            back to concepts
          </ButtonLink>
        </div>
      </header>

      <section className="mx-auto max-w-[1280px] px-5 py-12 md:px-8 lg:px-12 xl:px-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              Project — Products — Estimate
            </p>
            <div className="mt-3 h-px w-32 bg-ink" />
            <p className="mt-12 font-body text-caption font-medium uppercase text-ink-muted">
              Shopping List
            </p>
            <h1 className="mt-6 font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
              Catalog-backed cost estimate.
            </h1>
            <p className="mt-6 max-w-[680px] font-body text-body-m text-ink-secondary">
              {project.name} · {room.name} · {shoppingList?.concept?.title ?? "No selected concept"}
            </p>
          </div>

          <aside className="border border-line bg-surface p-5 lg:self-start">
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              Estimate
            </p>
            <div className="mt-3 h-px w-20 bg-ink" />
            <p className="mt-6 font-display text-display-xs font-light italic text-ink">
              {formatAed(shoppingList?.estimated_total_aed)}
            </p>
            <p className="mt-4 font-body text-body-s text-ink-secondary">
              {listItems.length} catalog item{listItems.length === 1 ? "" : "s"} in draft.
            </p>
          </aside>
        </div>

        <section className="mt-12 overflow-x-auto border border-line bg-surface">
          {shoppingList && listItems.length > 0 ? (
            <table className="w-full min-w-[1040px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-page">
                  <th className="px-4 py-4 font-body text-caption font-medium uppercase text-ink-muted">
                    Product
                  </th>
                  <th className="px-4 py-4 font-body text-caption font-medium uppercase text-ink-muted">
                    Retailer
                  </th>
                  <th className="px-4 py-4 font-body text-caption font-medium uppercase text-ink-muted">
                    Category
                  </th>
                  <th className="px-4 py-4 font-body text-caption font-medium uppercase text-ink-muted">
                    Price
                  </th>
                  <th className="px-4 py-4 font-body text-caption font-medium uppercase text-ink-muted">
                    Dimensions
                  </th>
                  <th className="px-4 py-4 font-body text-caption font-medium uppercase text-ink-muted">
                    Status
                  </th>
                  <th className="px-4 py-4 font-body text-caption font-medium uppercase text-ink-muted">
                    Link
                  </th>
                </tr>
              </thead>
              <tbody>
                {listItems.map((item) => {
                  const product = item.product;
                  const dimensions = product?.dimensions?.[0];
                  const warnings = warningsFor(item, product);

                  return (
                    <tr className="border-b border-line align-top last:border-b-0" key={item.id}>
                      <td className="w-[340px] px-4 py-4">
                        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-4">
                          <div className="aspect-[4/3] bg-page">
                            {product?.primary_image_url ? (
                              <Image
                                alt={`${product.name} product image`}
                                className="h-full w-full object-cover"
                                height={180}
                                unoptimized
                                src={product.primary_image_url}
                                width={240}
                              />
                            ) : null}
                          </div>
                          <div>
                            <p className="font-display text-body-l font-light italic leading-snug text-ink">
                              {product?.name ?? "Product unavailable"}
                            </p>
                            {warnings.length > 0 ? (
                              <p className="mt-2 font-display text-body-s italic text-warning">
                                {warnings.join(" ")}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-body text-body-s text-ink-secondary">
                        {product?.retailer?.name ?? "not available"}
                      </td>
                      <td className="px-4 py-4 font-body text-body-s text-ink-secondary">
                        {item.category}
                      </td>
                      <td className="px-4 py-4 font-body text-body-s text-ink-secondary">
                        {formatAed(item.line_total_aed)}
                      </td>
                      <td className="px-4 py-4 font-body text-body-s text-ink-secondary">
                        {dimensions?.source_text ??
                          dimensionsText(dimensions?.width_cm, dimensions?.depth_cm, dimensions?.height_cm)}
                      </td>
                      <td className="px-4 py-4 font-body text-body-s text-ink-secondary">
                        {product?.availability ?? "not available"}
                      </td>
                      <td className="px-4 py-4">
                        {product?.canonical_url ? (
                          <a
                            className="font-display text-button-quiet italic text-ink transition-colors hover:text-accent-deep"
                            href={product.canonical_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            retailer page →
                          </a>
                        ) : (
                          <span className="font-body text-body-s text-ink-muted">not available</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8">
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

  return parts.length > 0 ? `${parts.join(" x ")} cm` : "not available";
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

  if (!product?.dimensions?.[0]?.source_text) {
    warnings.push("Dimensions missing.");
  }

  if (!product?.last_checked_at || Date.now() - new Date(product.last_checked_at).getTime() > 1000 * 60 * 60 * 24 * 7) {
    warnings.push("Price or stock may be stale.");
  }

  if (item.dimension_fit_note && !item.dimension_fit_note.startsWith("verified")) {
    warnings.push(item.dimension_fit_note);
  }

  return Array.from(new Set(warnings));
}
