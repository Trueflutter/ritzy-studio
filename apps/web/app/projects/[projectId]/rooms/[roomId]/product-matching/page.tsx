import { ButtonLink, SubmitButton } from "@ritzy-studio/ui";
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

  const { data: finalRenderAssets = [] } = await supabase
    .from("room_assets")
    .select("*")
    .eq("room_id", roomId)
    .eq("asset_type", "final_render")
    .order("created_at", { ascending: false })
    .limit(4);

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

  const { data: latestRenderJob } = await supabase
    .from("render_jobs")
    .select("status, error_message, completed_at")
    .eq("room_id", roomId)
    .eq("concept_id", selectedConcept.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const shoppingItemsList = shoppingItems ?? [];

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

      <section className="mx-auto max-w-[1120px] px-5 py-12 md:px-8 lg:px-12 xl:px-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              Project - Photos - Brief - Generate - Critique - Match
            </p>
            <div className="mt-3 h-px w-32 bg-ink" />
            <p className="mt-12 font-body text-caption font-medium uppercase text-ink-muted">
              N° 06 - Product Matching
            </p>
            <h1 className="mt-6 font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
              Match the selected direction to real products.
            </h1>
            <p className="mt-6 max-w-[640px] font-body text-body-m text-ink-secondary">
              {project.name} · {room.name} · {room.room_type}
            </p>
            {message ? (
              <p className="mt-8 border border-line bg-surface px-4 py-3 font-display text-body-s italic text-ink-secondary">
                {message}
              </p>
            ) : null}
          </div>

          <aside className="border border-line bg-surface p-5 lg:self-start">
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              Sourcing Status
            </p>
            <div className="mt-3 h-px w-20 bg-ink" />
            <p className="mt-6 font-display text-display-xs font-light italic text-ink">
              {shoppingList ? "catalog products matched" : "ready to source"}
            </p>
            <form action={groundProductsAction} className="mt-8">
              <input name="projectId" type="hidden" value={projectId} />
              <input name="roomId" type="hidden" value={roomId} />
              <input name="conceptId" type="hidden" value={selectedConcept.id} />
              <SubmitButton className="w-full" pendingLabel="Matching products...">
                {shoppingList ? "Refresh matches" : "Match products"}
              </SubmitButton>
            </form>
            {shoppingList ? (
              <p className="mt-5 font-body text-body-s text-ink-secondary">
                Estimated catalog total: {formatAed(shoppingList.estimated_total_aed)}
              </p>
            ) : null}
            {shoppingList ? (
              <ButtonLink
                className="mt-5 w-full"
                href={`/projects/${projectId}/rooms/${roomId}/shopping-list`}
                variant="quiet"
              >
                open shopping list
              </ButtonLink>
            ) : null}
          </aside>
        </div>

        <section className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="border border-line bg-surface p-[14px]">
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-page">
              {signedConceptImage?.signedUrl ? (
                <Image
                  alt={`${selectedConcept.title} generated room concept`}
                  className="h-full w-full object-cover"
                  height={900}
                  unoptimized
                  src={signedConceptImage.signedUrl}
                  width={1200}
                />
              ) : (
                <p className="font-display text-body-s italic text-error">
                  selected render could not load
                </p>
              )}
            </div>
            <div className="mt-5 border-t border-line px-[18px] pb-[18px] pt-5">
              <p className="font-body text-caption font-medium uppercase text-ink-muted">
                Selected Concept
              </p>
              <h2 className="mt-3 font-display text-display-xs font-light italic text-ink">
                {selectedConcept.title}
              </h2>
            </div>
          </article>
        </section>

        <section className="mt-12">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
              <div className="border border-line bg-surface p-8 md:col-span-2 xl:col-span-3">
                <p className="font-display text-display-xs font-light italic text-ink">
                  No product matches yet.
                </p>
                <p className="mt-4 max-w-[560px] font-body text-body-s text-ink-secondary">
                  Match the selected direction to catalog products when you are ready for the
                  shopping plan.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-16 border-t border-line pt-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <p className="font-body text-caption font-medium uppercase text-ink-muted">
                N° 07 - Final Render
              </p>
              <h2 className="mt-4 font-display text-display-s font-light italic text-ink">
                Generate the client-facing grounded render.
              </h2>
              <p className="mt-4 max-w-[680px] font-body text-body-s text-ink-secondary">
                The render uses selected product images as visual references where available. The
                shopping list remains the source of truth.
              </p>
              {latestRenderJob?.status === "failed" ? (
                <p className="mt-5 border border-line bg-surface px-4 py-3 font-display text-body-s italic text-error">
                  {latestRenderJob.error_message ?? "Final render failed."}
                </p>
              ) : null}
            </div>

            <aside className="border border-line bg-surface p-5 lg:self-start">
              <p className="font-body text-caption font-medium uppercase text-ink-muted">
                Render Status
              </p>
              <div className="mt-3 h-px w-20 bg-ink" />
              <p className="mt-6 font-display text-display-xs font-light italic text-ink">
                {shoppingList && shoppingItemsList.length > 0 ? "shopping list ready" : "match products first"}
              </p>
              <form action={generateFinalRenderAction} className="mt-8">
                <input name="projectId" type="hidden" value={projectId} />
                <input name="roomId" type="hidden" value={roomId} />
                <input name="conceptId" type="hidden" value={selectedConcept.id} />
                <input name="shoppingListId" type="hidden" value={shoppingList?.id ?? ""} />
                <SubmitButton
                  className="w-full"
                  disabled={!canAccessCommerce || !shoppingList || shoppingItemsList.length === 0}
                  pendingLabel="Generating final render..."
                >
                  Generate final render
                </SubmitButton>
              </form>
            </aside>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {finalRenders.length > 0 ? (
              finalRenders.map((render) => (
                <article className="border border-line bg-surface p-[14px]" key={render.id}>
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-page">
                    {render.signedUrl ? (
                      <Image
                        alt="Final grounded room render"
                        className="h-full w-full object-cover"
                        height={900}
                        unoptimized
                        src={render.signedUrl}
                        width={1200}
                      />
                    ) : (
                      <p className="font-display text-body-s italic text-error">
                        final render could not load
                      </p>
                    )}
                  </div>
                  <div className="mt-5 border-t border-line px-[18px] pb-[18px] pt-5">
                    <p className="font-body text-caption font-medium uppercase text-ink-muted">
                      Final render · {new Date(render.created_at).toLocaleDateString("en-AE")}
                    </p>
                  </div>
                </article>
              ))
            ) : null}
          </div>
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
