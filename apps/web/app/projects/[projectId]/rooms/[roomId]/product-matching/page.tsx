import { AnimatedStatus, AutoSubmit, ButtonLink, SubmitButton } from "@ritzy-studio/ui";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  generateFinalRenderAction,
  groundProductsAction,
  substituteProductAction
} from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function ProductMatchingPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string; roomId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { projectId, roomId } = await params;
  const { message } = await searchParams;
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
  const { data: canAccessCommerce = false } = await supabase.rpc("can_access_room_commerce", {
    room_id: roomId
  });

  const { data: selectedConcept } = await supabase
    .from("concepts")
    .select("*, primary_image_asset:room_assets(*)")
    .eq("room_id", roomId)
    .eq("status", "selected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!selectedConcept) {
    redirect(
      `/projects/${projectId}/rooms/${roomId}/concepts?message=${encodeURIComponent(
        "Select a concept before matching products."
      )}`
    );
  }

  const conceptImageAsset = Array.isArray(selectedConcept.primary_image_asset)
    ? selectedConcept.primary_image_asset[0]
    : selectedConcept.primary_image_asset;
  const { data: signedConceptImage } = conceptImageAsset?.storage_path
    ? await serviceSupabase.storage
        .from("generated-renders")
        .createSignedUrl(conceptImageAsset.storage_path, 60 * 60)
    : { data: null };

  const { data: shoppingList } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("room_id", roomId)
    .eq("concept_id", selectedConcept.id)
    .limit(1)
    .maybeSingle();

  const { data: shoppingItems = [] } = shoppingList
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

  const { data: conceptRenderJobs = [] } = await supabase
    .from("render_jobs")
    .select("output_asset_ids, status, error_message, completed_at, created_at")
    .eq("room_id", roomId)
    .eq("concept_id", selectedConcept.id)
    .order("created_at", { ascending: false });

  const conceptRenderAssetIds = Array.from(
    new Set(
      (conceptRenderJobs ?? [])
        .filter((job) => job.status === "succeeded")
        .flatMap((job) => job.output_asset_ids ?? [])
    )
  );

  const { data: finalRenderAssets = [] } = conceptRenderAssetIds.length > 0
    ? await supabase
        .from("room_assets")
        .select("*")
        .eq("asset_type", "final_render")
        .in("id", conceptRenderAssetIds)
        .order("created_at", { ascending: false })
        .limit(4)
    : { data: [] };

  const finalRenders = await Promise.all(
    canAccessCommerce
      ? (finalRenderAssets ?? []).map(async (asset) => {
          const { data } = await serviceSupabase.storage
            .from("generated-renders")
            .createSignedUrl(asset.storage_path, 60 * 60);

          return { ...asset, signedUrl: data?.signedUrl ?? null };
        })
      : []
  );

  const latestRenderJob = (conceptRenderJobs ?? [])[0] ?? null;

  const shoppingItemsList = shoppingItems ?? [];
  const shouldAutoSource = !shoppingList && !message;
  const showRetryAfterError = !shoppingList && Boolean(message);

  return (
    <main className="min-h-dvh bg-page text-ink">
      <header className="flex min-h-20 items-center justify-between border-b border-line bg-surface px-5 md:px-8 lg:px-12 xl:px-16">
        <Link className="font-display text-[28px] font-light text-ink" href="/">
          Ri <span className="font-body text-caption font-medium uppercase text-ink-muted">Ritzy Studio</span>
        </Link>
        <ButtonLink href={`/projects/${projectId}/rooms/${roomId}/concepts`} leading="←" variant="chrome">
          Back to concepts
        </ButtonLink>
      </header>

      <section className="mx-auto max-w-[1280px] px-5 py-8 md:px-8 lg:px-12 xl:px-16">
        <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
          Project — Photos — Brief — Generate — Critique — Match
        </p>
        <div className="mt-3 h-px w-32 bg-ink" />

        <div className="mt-10 max-w-[860px]">
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
            N° 06 — Product Matching
          </p>
          <h1 className="mt-4 font-display text-display-l font-light leading-[1.05] tracking-[-0.015em] text-ink">
            {finalRenders.length > 0
              ? "Your grounded room is ready."
              : shoppingList
                ? "Pieces matched to your concept."
                : "Match the selected direction to real products."}
          </h1>
          <p className="mt-4 font-body text-body-m text-ink-muted">
            {project.name} · {room.name} · {room.room_type}
          </p>
        </div>

        {message ? (
          <div className="mt-8 border border-line bg-surface px-4 py-4">
            <p className="font-display text-body-m italic text-ink-secondary">{message}</p>
            {showRetryAfterError ? (
              <form action={groundProductsAction} className="mt-4">
                <input name="projectId" type="hidden" value={projectId} />
                <input name="roomId" type="hidden" value={roomId} />
                <input name="conceptId" type="hidden" value={selectedConcept.id} />
                <SubmitButton pendingLabel="Generating shopping list..." variant="secondary">
                  Try sourcing again
                </SubmitButton>
              </form>
            ) : null}
          </div>
        ) : null}

        {(() => {
          const latestRender = finalRenders[0] ?? null;
          const heroSrc = latestRender?.signedUrl ?? signedConceptImage?.signedUrl ?? null;
          const heroAlt = latestRender
            ? "Final grounded room render"
            : `${selectedConcept.title} concept render`;
          const heroLabel = latestRender ? "Final render" : "Selected concept";

          return (
            <article className="mt-10 border border-line bg-surface p-[14px]">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-page">
                {heroSrc ? (
                  <Image
                    alt={heroAlt}
                    className="h-full w-full object-cover"
                    height={1200}
                    priority
                    unoptimized
                    src={heroSrc}
                    width={1600}
                  />
                ) : (
                  <p className="font-display text-body-s italic text-error">
                    selected render could not load
                  </p>
                )}
              </div>
              <div className="mx-auto mt-5 max-w-[880px] border-t border-line px-6 pb-8 pt-8 md:px-10">
                <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                  {heroLabel}
                </p>
                <h2 className="mt-3 font-display text-display-s font-light italic text-ink">
                  {selectedConcept.title}
                </h2>
                {latestRender ? (
                  <p className="mt-3 font-body text-body-s text-ink-muted">
                    Rendered {new Date(latestRender.created_at).toLocaleDateString("en-AE")}
                  </p>
                ) : null}
              </div>
            </article>
          );
        })()}

        {shouldAutoSource ? (
          <div className="mt-10 flex flex-col items-center text-center">
            <AnimatedStatus
              phases={[
                "Sourcing the seating",
                "Pricing the lighting",
                "Matching the textiles",
                "Composing the plan"
              ]}
            />
            <form action={groundProductsAction} className="hidden" id="auto-source">
              <input name="projectId" type="hidden" value={projectId} />
              <input name="roomId" type="hidden" value={roomId} />
              <input name="conceptId" type="hidden" value={selectedConcept.id} />
            </form>
            <AutoSubmit formId="auto-source" />
          </div>
        ) : null}

        <section className="mt-16 border-t border-line pt-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-[680px]">
              <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                Shopping plan
              </p>
              <h2 className="mt-4 font-display text-display-m font-light italic text-ink">
                {shoppingList ? "Sourced from the live catalog." : "Source the shopping plan."}
              </h2>
              {shoppingList ? (
                <p className="mt-3 font-body text-body-s text-ink-muted">
                  Estimated total ·{" "}
                  <span className="font-display text-body-l font-light italic text-ink">
                    {formatAed(shoppingList.estimated_total_aed)}
                  </span>
                </p>
              ) : (
                <p className="mt-3 max-w-[560px] font-body text-body-s text-ink-secondary">
                  The system will match catalog products to this concept and return prices,
                  dimensions, and retailer links.
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-3 md:flex-row md:items-center">
              {shoppingList ? (
                <ButtonLink
                  href={`/projects/${projectId}/rooms/${roomId}/shopping-list`}
                  trailing="→"
                >
                  Open shopping list
                </ButtonLink>
              ) : null}
              <form action={groundProductsAction}>
                <input name="projectId" type="hidden" value={projectId} />
                <input name="roomId" type="hidden" value={roomId} />
                <input name="conceptId" type="hidden" value={selectedConcept.id} />
                <SubmitButton
                  pendingLabel="Generating shopping list..."
                  variant={shoppingList ? "secondary" : "primary"}
                >
                  {shoppingList ? "Refresh matches" : "Source the shopping plan"}
                </SubmitButton>
              </form>
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {shoppingItemsList.length > 0 ? (
              shoppingItemsList.map((item) => {
                const product = item.product;
                const dimensions = product?.dimensions?.[0];
                const warningText = [item.dimension_fit_note, item.selection_reason]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <article className="border border-line bg-surface p-[14px]" key={item.id}>
                    <div className="aspect-square overflow-hidden border border-line bg-page">
                      {product?.primary_image_url ? (
                        <Image
                          alt={`${product.name} product image`}
                          className="h-full w-full object-cover"
                          height={800}
                          unoptimized
                          src={product.primary_image_url}
                          width={800}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <p className="font-display text-body-s italic text-error">
                            image missing
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="mt-5 px-[6px] pb-[6px]">
                      <p className="font-body text-caption font-medium uppercase text-ink-muted">
                        {product?.retailer?.name ?? "Retailer"} · {item.category}
                      </p>
                      <h3 className="mt-3 font-display text-display-xs font-light italic text-ink">
                        {product?.name ?? "Product unavailable"}
                      </h3>
                      <div className="mt-4 space-y-2 font-body text-body-s text-ink-secondary">
                        <p>
                          Price: {formatAed(item.unit_price_aed)}
                          {product?.sale_price_aed ? " sale" : ""}
                        </p>
                        <p>Availability: {product?.availability ?? "not available"}</p>
                        <p>
                          Dimensions:{" "}
                          {dimensions?.source_text ??
                            dimensionsText(dimensions?.width_cm, dimensions?.depth_cm, dimensions?.height_cm)}
                        </p>
                      </div>
                      {warningText ? (
                        <p className="mt-4 border border-line bg-page px-4 py-3 font-display text-body-s italic text-warning">
                          {warningText}
                        </p>
                      ) : null}
                      {canAccessCommerce && product?.canonical_url ? (
                        <ButtonLink
                          className="mt-5"
                          href={product.canonical_url}
                          rel="noreferrer"
                          target="_blank"
                          trailing="→"
                          variant="quiet"
                        >
                          open retailer page
                        </ButtonLink>
                      ) : null}
                      {canAccessCommerce && shoppingList ? (
                        <form action={substituteProductAction} className="mt-5 border-t border-line pt-5">
                          <input name="projectId" type="hidden" value={projectId} />
                          <input name="roomId" type="hidden" value={roomId} />
                          <input name="shoppingListId" type="hidden" value={shoppingList.id} />
                          <input name="itemId" type="hidden" value={item.id} />
                          <label
                            className="mb-3 block font-body text-caption font-medium uppercase text-ink-muted"
                            htmlFor={`mode-${item.id}`}
                          >
                            Swap request
                          </label>
                          <select
                            className="h-[52px] w-full border border-line-strong bg-transparent px-4 font-body text-body-s text-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                            id={`mode-${item.id}`}
                            name="mode"
                          >
                            <option value="cheaper">cheaper option</option>
                            <option value="closer_style">closer style</option>
                            <option value="same_retailer">same retailer</option>
                            <option value="in_stock">in stock only</option>
                          </select>
                          <SubmitButton className="mt-4 w-full" pendingLabel="Finding substitute..." variant="secondary">
                            Swap this item
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="border border-line bg-surface p-10 md:col-span-2 xl:col-span-3">
                <p className="font-display text-display-xs font-light italic text-ink">
                  No pieces sourced yet.
                </p>
                <p className="mt-3 max-w-[560px] font-body text-body-s text-ink-secondary">
                  Press <span className="italic">Source the shopping plan</span> above to match
                  catalog products with prices, dimensions, and retailer links.
                </p>
              </div>
            )}
          </div>
        </section>

        {shoppingList && shoppingItemsList.length > 0 ? (
          <section className="mt-16 border-t border-line pt-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-[680px]">
                <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                  Final render
                </p>
                <h2 className="mt-4 font-display text-display-m font-light italic text-ink">
                  {finalRenders.length > 0
                    ? "The grounded render is live above."
                    : "Generate the grounded render."}
                </h2>
                <p className="mt-3 max-w-[560px] font-body text-body-s text-ink-secondary">
                  The render uses your sourced product images as visual references. The shopping
                  list above remains the source of truth.
                </p>
                {latestRenderJob?.status === "failed" ? (
                  <p className="mt-5 border border-line bg-surface px-4 py-3 font-display text-body-s italic text-error">
                    {latestRenderJob.error_message ?? "Final render failed."}
                  </p>
                ) : null}
              </div>

              <form action={generateFinalRenderAction} className="shrink-0">
                <input name="projectId" type="hidden" value={projectId} />
                <input name="roomId" type="hidden" value={roomId} />
                <input name="conceptId" type="hidden" value={selectedConcept.id} />
                <input name="shoppingListId" type="hidden" value={shoppingList?.id ?? ""} />
                <SubmitButton
                  disabled={!canAccessCommerce}
                  pendingLabel="Generating final render..."
                >
                  {finalRenders.length > 0 ? "Regenerate render" : "Generate final render"}
                </SubmitButton>
              </form>
            </div>

            {finalRenders.length > 1 ? (
              <div className="mt-10">
                <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                  Earlier renders
                </p>
                <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {finalRenders.slice(1).map((render) => (
                    <article className="border border-line bg-surface p-[14px]" key={render.id}>
                      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-page">
                        {render.signedUrl ? (
                          <Image
                            alt="Earlier grounded room render"
                            className="h-full w-full object-cover"
                            height={900}
                            unoptimized
                            src={render.signedUrl}
                            width={1200}
                          />
                        ) : (
                          <p className="font-display text-body-s italic text-error">
                            render could not load
                          </p>
                        )}
                      </div>
                      <div className="mt-5 border-t border-line px-[18px] pb-[18px] pt-5">
                        <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                          {new Date(render.created_at).toLocaleDateString("en-AE")}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
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
