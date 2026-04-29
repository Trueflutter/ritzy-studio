import { ButtonLink } from "@ritzy-studio/ui";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function PresentationPage({
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

  const { data: selectedConcept } = await supabase
    .from("concepts")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "selected")
    .limit(1)
    .maybeSingle();

  const { data: finalRenderAsset } = await supabase
    .from("room_assets")
    .select("*")
    .eq("room_id", roomId)
    .eq("asset_type", "final_render")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const finalRenderUrl = finalRenderAsset?.storage_path
    ? (
        await supabase.storage
          .from("generated-renders")
          .createSignedUrl(finalRenderAsset.storage_path, 60 * 60)
      ).data?.signedUrl
    : null;

  const { data: shoppingList } = await supabase
    .from("shopping_lists")
    .select("*")
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
    <main className="min-h-dvh bg-surface text-ink print:bg-surface">
      <header className="flex min-h-20 items-center justify-between border-b border-line bg-surface px-5 md:px-8 lg:px-12 xl:px-16 print:hidden">
        <Link className="font-display text-[28px] font-light text-ink" href="/">
          Ri <span className="font-body text-caption font-medium uppercase text-ink-muted">Ritzy Studio</span>
        </Link>
        <div className="flex items-center gap-6">
          <ButtonLink
            href={`/projects/${projectId}/rooms/${roomId}/shopping-list`}
            trailing="→"
            variant="quiet"
          >
            shopping list
          </ButtonLink>
          <PrintButton />
        </div>
      </header>

      <section className="mx-auto max-w-[1180px] px-5 py-12 md:px-8 lg:px-12 xl:px-16 print:px-0 print:py-0">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] print:block">
          <div>
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              Ritzy Studio Presentation
            </p>
            <div className="mt-3 h-px w-32 bg-ink" />
            <h1 className="mt-10 font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink print:text-display-m">
              {project.client_name ?? project.name}
            </h1>
            <p className="mt-5 max-w-[680px] font-body text-body-m text-ink-secondary">
              {room.name} · {room.room_type} · {project.location ?? "Dubai / UAE"}
            </p>
          </div>

          <aside className="border border-line bg-page p-5 print:mt-8">
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              Estimate
            </p>
            <p className="mt-5 font-display text-display-xs font-light italic text-ink">
              {formatAed(shoppingList?.estimated_total_aed)}
            </p>
            <p className="mt-4 font-body text-body-s text-ink-secondary">
              {listItems.length} selected catalog item{listItems.length === 1 ? "" : "s"}.
            </p>
          </aside>
        </div>

        <section className="mt-10 print:mt-8">
          <div className="aspect-[3/2] border border-line bg-page">
            {finalRenderUrl ? (
              <Image
                alt="Final client room render"
                className="h-full w-full object-cover"
                height={1024}
                unoptimized
                src={finalRenderUrl}
                width={1536}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8">
                <p className="font-display text-display-xs font-light italic text-ink">
                  Final render pending.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-12 grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)] print:block">
          <div>
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              Design Direction
            </p>
            <h2 className="mt-4 font-display text-display-s font-light italic text-ink">
              {selectedConcept?.title ?? "Selected concept pending"}
            </h2>
          </div>
          <div className="whitespace-pre-line font-body text-body-s text-ink-secondary">
            {selectedConcept?.description ??
              "Select a concept and generate a final render before sharing this presentation."}
          </div>
        </section>

        <section className="mt-12 border border-line">
          <div className="border-b border-line bg-page px-4 py-4">
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              Selected Products
            </p>
          </div>
          <div className="divide-y divide-line">
            {listItems.length > 0 ? (
              listItems.map((item) => {
                const product = item.product;
                const dimensions = product?.dimensions?.[0];

                return (
                  <article className="grid gap-4 p-4 md:grid-cols-[96px_minmax(0,1fr)_180px] print:grid-cols-[80px_minmax(0,1fr)_150px]" key={item.id}>
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
                      <p className="mt-2 font-body text-body-s text-ink-secondary">
                        {product?.retailer?.name ?? "Retailer"} · {item.category} ·{" "}
                        {product?.availability ?? "availability unavailable"}
                      </p>
                      <p className="mt-2 font-body text-caption text-ink-muted">
                        Dimensions:{" "}
                        {dimensions?.source_text ??
                          dimensionsText(dimensions?.width_cm, dimensions?.depth_cm, dimensions?.height_cm)}
                      </p>
                    </div>
                    <div className="font-body text-body-s text-ink-secondary md:text-right">
                      <p>{formatAed(item.line_total_aed)}</p>
                      {product?.canonical_url ? (
                        <a
                          className="mt-2 inline-flex font-display text-button-quiet italic text-ink print:hidden"
                          href={product.canonical_url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          retailer page →
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="p-6">
                <p className="font-display text-display-xs font-light italic text-ink">
                  Shopping list pending.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-10 border border-line bg-page p-5">
          <p className="font-body text-caption font-medium uppercase text-ink-muted">
            Notes
          </p>
          <p className="mt-4 font-body text-body-s text-ink-secondary">
            Product names, prices, availability, dimensions, images, and retailer links come from
            catalog records and should be rechecked before purchasing. The render is a best-effort
            visual composition and may not exactly reproduce every selected SKU.
          </p>
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
