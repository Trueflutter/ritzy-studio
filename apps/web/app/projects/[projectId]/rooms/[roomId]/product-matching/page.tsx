import {
  AnimatedStatus,
  AutoSubmit,
  ButtonLink,
  DecorativeRule,
  GradientPlaceholder,
  JourneyNav,
  SectionEyebrow,
  StudioHeader,
  SubmitButton
} from "@ritzy-studio/ui";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import {
  generateFinalRenderAction,
  groundProductsAction,
  substituteProductAction
} from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

function possessiveClientFirstName(clientName: string | null | undefined) {
  const firstName = clientName?.trim().split(/\s+/)[0];

  if (!firstName) {
    return "Your";
  }

  return firstName.endsWith("s") ? `${firstName}'` : `${firstName}'s`;
}

function publicProductMatchingMessage(message: string | undefined) {
  if (!message) {
    return undefined;
  }

  const lower = message.toLowerCase();
  const internalFragments = [
    "catalogue-grounded concept anchors",
    "product grounding diverged",
    "better catalog matches",
    "more catalog coverage",
    "missing:",
    "rolecandidate",
    "attribute score"
  ];

  if (internalFragments.some((fragment) => lower.includes(fragment))) {
    return "We need one more catalogue pass before this shopping list is ready. Please try sourcing again.";
  }

  return message;
}

export default async function ProductMatchingPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string; roomId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { projectId, roomId } = await params;
  const { message } = await searchParams;
  const displayMessage = publicProductMatchingMessage(message);
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

  const roomDisplayName = `${possessiveClientFirstName(project.client_name)} ${room.name}`;

  const serviceSupabase = createServiceClient();
  const { data: canAccessCommerce = false } = await supabase.rpc("can_access_room_commerce", {
    room_id: roomId
  });

  const { data: selectedConcept } = await supabase
    .from("concepts")
    .select("*, primary_image_asset:room_assets!concepts_primary_image_asset_id_fkey(*)")
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

  // Sourcing is its own screen. Until a shopping list exists, this route shows
  // only the sourcing progress — or a retry on failure — never the workspace.
  if (!shoppingList) {
    return (
      <main className="flex min-h-dvh flex-col bg-page text-ink">
        <StudioHeader>
          <JourneyNav current="sourcing" />
        </StudioHeader>

        <section className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center justify-center px-5 py-24 text-center">
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
            N° 06 — Product Matching
          </p>
          <div className="mt-3 h-px w-24 bg-ink" />

          {displayMessage ? (
            <>
              <h1 className="mt-9 font-display text-display-m font-light italic leading-[1.1] text-ink">
                Sourcing didn’t complete.
              </h1>
              <p className="mt-4 font-body text-body-m text-ink-muted">{displayMessage}</p>
              <form action={groundProductsAction} className="mt-9">
                <input name="projectId" type="hidden" value={projectId} />
                <input name="roomId" type="hidden" value={roomId} />
                <input name="conceptId" type="hidden" value={selectedConcept.id} />
                <SubmitButton pendingLabel="Sourcing pieces..." variant="primary">
                  Try sourcing again
                </SubmitButton>
              </form>
            </>
          ) : (
            <>
              <h1 className="mt-9 font-display text-display-m font-light italic leading-[1.1] text-ink">
                Sourcing pieces for {roomDisplayName}.
              </h1>
              <p className="mt-4 max-w-[460px] font-body text-body-m text-ink-muted">
                Matching catalog products to your concept. The prices, dimensions, and retailer
                links will follow afterwards.
              </p>
              <p className="mt-3 max-w-[420px] font-body text-body-s text-ink-muted">
                Sourcing usually takes about 3–5 minutes.
              </p>
              <div className="mt-12">
                <AnimatedStatus
                  phases={[
                    "Sourcing the seating",
                    "Pricing the lighting",
                    "Matching the textiles",
                    "Composing the plan"
                  ]}
                />
              </div>
              <form action={groundProductsAction} className="sr-only" id="auto-source">
                <input name="projectId" type="hidden" value={projectId} />
                <input name="roomId" type="hidden" value={roomId} />
                <input name="conceptId" type="hidden" value={selectedConcept.id} />
                <button type="submit">Submit sourcing request</button>
              </form>
              <AutoSubmit formId="auto-source" />
            </>
          )}
        </section>
      </main>
    );
  }

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
        .neq("status", "rejected")
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
  const latestRender = finalRenders[0] ?? null;
  const heroSrc = latestRender?.signedUrl ?? signedConceptImage?.signedUrl ?? null;
  const heroLabel = latestRender ? "Final render" : "Selected concept";
  const estimatedTotal = shoppingList.estimated_total_aed;
  const estimatedTotalDisplay =
    estimatedTotal === null || estimatedTotal === undefined
      ? "—"
      : Number(estimatedTotal).toLocaleString("en-AE", { maximumFractionDigits: 0 });
  const rowGrid =
    "grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-7 gap-y-3 border-t border-line px-5 py-5 md:px-8 lg:grid-cols-[128px_minmax(0,1.4fr)_minmax(0,1fr)_140px_150px_190px] lg:px-12";

  return (
    <main className="min-h-dvh bg-page text-ink">
      <StudioHeader>
        <JourneyNav current="sourcing" />
      </StudioHeader>

      {/* top — the render stays central, the intro sits beside it */}
      <div className="grid grid-cols-1 border-b border-line lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="bg-surface lg:border-r lg:border-line">
          <div className="h-[360px] overflow-hidden md:h-[480px] lg:h-[560px]">
            {heroSrc ? (
              <Image
                alt={latestRender ? "Final grounded room render" : `${selectedConcept.title} concept render`}
                className="h-full w-full object-cover"
                height={1120}
                priority
                src={heroSrc}
                unoptimized
                width={1512}
              />
            ) : (
              <p className="flex h-full items-center justify-center font-display text-body-s italic text-error">
                selected render could not load
              </p>
            )}
          </div>
          <p className="border-t border-line px-6 py-[14px] font-body text-caption-tight font-medium uppercase tracking-[0.28em] text-ink-muted md:px-8">
            {heroLabel} · {selectedConcept.title} — renders are design direction, the list below is the record
          </p>
        </div>

        <div className="flex flex-col justify-center bg-page px-6 py-11 md:px-10">
          <SectionEyebrow>N° 06 — Product Matching</SectionEyebrow>
          <DecorativeRule className="mt-4" />
          <h1 className="mt-6 font-display text-[48px] font-light leading-[1.05] tracking-[-0.015em] text-ink">
            {finalRenders.length > 0 ? (
              "Your grounded room is ready."
            ) : (
              <>
                Pieces matched to <em className="italic">the concept.</em>
              </>
            )}
          </h1>
          <p className="mt-[18px] font-body text-body-m leading-[1.65] text-ink-secondary">
            Sourced from the live UAE catalog against your palette, avoid-colours and budget. Swap any
            piece; selected and alternate choices stay aligned.
          </p>
          <p className="mt-2 font-body text-body-s text-ink-muted">
            {project.name} · {room.name} · {room.room_type}
          </p>

          <div className="mt-8 flex flex-wrap items-baseline gap-3">
            <span className="font-body text-caption font-medium uppercase tracking-[0.32em] text-accent-deep [font-feature-settings:'tnum','lnum']">
              AED
            </span>
            <span className="font-display text-[44px] font-light text-ink [font-feature-settings:'tnum','lnum']">
              {estimatedTotalDisplay}
            </span>
            <span className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
              estimated · {shoppingItemsList.length} {shoppingItemsList.length === 1 ? "piece" : "pieces"}
            </span>
          </div>

          <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <ButtonLink href={`/projects/${projectId}/rooms/${roomId}/shopping-list`} trailing="→">
              Open shopping list
            </ButtonLink>
            <form action={groundProductsAction}>
              <input name="projectId" type="hidden" value={projectId} />
              <input name="roomId" type="hidden" value={roomId} />
              <input name="conceptId" type="hidden" value={selectedConcept.id} />
              <SubmitButton className="w-full" pendingLabel="Refreshing matches..." variant="secondary">
                Refresh matches
              </SubmitButton>
            </form>
          </div>
        </div>
      </div>

      {message ? (
        <p className="border-b border-line bg-surface px-5 py-3 font-display text-body-m italic text-ink-secondary md:px-8 lg:px-12">
          {message}
        </p>
      ) : null}

      {latestRender ? (
        <p className="border-b border-line bg-surface px-5 py-3 font-body text-body-s text-ink-muted md:px-8 lg:px-12">
          Grounded render made {new Date(latestRender.created_at).toLocaleDateString("en-AE")} — shown above.
        </p>
      ) : null}

      {/* ledger — products as a materials record, not a retail grid */}
      <div className="bg-surface">
        <div className="flex flex-col gap-1 px-5 pt-6 sm:flex-row sm:items-baseline sm:justify-between md:px-8 lg:px-12">
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
            The ledger — selected pieces
          </p>
          <p className="font-display text-button-quiet italic text-ink-subtle">
            the shopping list remains the source of truth
          </p>
        </div>

        {shoppingItemsList.length > 0 ? (
          <div className="mt-[18px] flex flex-col">
            {shoppingItemsList.map((item) => {
              const product = item.product;
              const dimensions = product?.dimensions?.[0];
              const warningText = [item.dimension_fit_note, item.selection_reason]
                .filter(Boolean)
                .join(" ");
              const quantity = item.quantity ?? 1;
              const priceDisplay =
                item.unit_price_aed === null || item.unit_price_aed === undefined
                  ? null
                  : Number(item.unit_price_aed).toLocaleString("en-AE", { maximumFractionDigits: 0 });

              return (
                <div className={rowGrid} key={item.id}>
                  <div className="h-24 w-24 overflow-hidden border border-line bg-page">
                    {product?.primary_image_url ? (
                      <Image
                        alt={`${product.name} product image`}
                        className="h-full w-full object-cover"
                        height={256}
                        src={product.primary_image_url}
                        unoptimized
                        width={256}
                      />
                    ) : (
                      <GradientPlaceholder
                        caption={
                          <>
                            image
                            <br />
                            unavailable
                          </>
                        }
                        captionClassName="text-[13px] leading-tight"
                        className="h-full w-full"
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="font-body text-caption-tight font-medium uppercase tracking-[0.28em] text-ink-muted">
                      {product?.retailer?.name ?? "Retailer"} · {item.category}
                    </p>
                    <h3 className="mt-2 font-display text-display-xs font-light italic text-ink">
                      {product?.name ?? "Product unavailable"}
                      {quantity > 1 ? (
                        <span className="ml-2 align-middle font-body text-caption-tight font-medium not-italic tracking-[0.2em] text-ink-muted">
                          × {quantity}
                        </span>
                      ) : null}
                    </h3>
                    {warningText ? (
                      <p className="mt-2 font-display text-body-m italic leading-snug text-warning">
                        {warningText}
                      </p>
                    ) : null}
                    {canAccessCommerce && product?.canonical_url ? (
                      <ButtonLink
                        className="mt-2"
                        href={product.canonical_url}
                        rel="noreferrer"
                        target="_blank"
                        trailing="→"
                        variant="quiet"
                      >
                        open retailer page
                      </ButtonLink>
                    ) : null}
                  </div>

                  <p className="font-body text-body-s text-ink-secondary [font-feature-settings:'tnum','lnum']">
                    <span className="font-medium uppercase tracking-[0.2em] text-ink-muted lg:hidden">
                      Dimensions:{" "}
                    </span>
                    {dimensions?.source_text ??
                      dimensionsText(dimensions?.width_cm, dimensions?.depth_cm, dimensions?.height_cm)}
                  </p>

                  <p className={`font-body text-body-s ${availabilityTone(product?.availability)}`}>
                    ● {product?.availability ?? "not available"}
                  </p>

                  <p className="lg:text-right [font-feature-settings:'tnum','lnum']">
                    <span className="font-body text-caption font-medium uppercase tracking-[0.28em] text-accent-deep">
                      AED{" "}
                    </span>
                    <span className="font-display text-[22px] font-normal text-ink">
                      {priceDisplay ?? "not available"}
                    </span>
                    {product?.sale_price_aed ? (
                      <span className="ml-1 font-body text-caption-tight uppercase tracking-[0.2em] text-accent-deep">
                        sale
                      </span>
                    ) : null}
                  </p>

                  <div className="lg:text-right">
                    {canAccessCommerce && shoppingList ? (
                      <form action={substituteProductAction}>
                        <input name="projectId" type="hidden" value={projectId} />
                        <input name="roomId" type="hidden" value={roomId} />
                        <input name="shoppingListId" type="hidden" value={shoppingList.id} />
                        <input name="itemId" type="hidden" value={item.id} />
                        <label className="sr-only" htmlFor={`mode-${item.id}`}>
                          Swap request for {product?.name ?? "this piece"}
                        </label>
                        <select
                          className="h-10 w-full border border-line-strong bg-transparent px-3 font-body text-body-s text-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ring lg:w-auto lg:min-w-[150px]"
                          id={`mode-${item.id}`}
                          name="mode"
                        >
                          <option value="cheaper">cheaper option</option>
                          <option value="closer_style">closer style</option>
                          <option value="same_retailer">same retailer</option>
                          <option value="in_stock">in stock only</option>
                        </select>
                        <SubmitButton
                          className="mt-2 whitespace-nowrap lg:w-full lg:justify-end"
                          pendingLabel="Swapping…"
                          trailing="→"
                          variant="quiet"
                        >
                          swap
                        </SubmitButton>
                      </form>
                    ) : (
                      <span className="font-display text-button-quiet italic text-ink-disabled">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border-t border-line px-5 py-12 md:px-8 lg:px-12">
            <p className="font-display text-display-xs font-light italic text-ink">
              No pieces sourced yet.
            </p>
            <p className="mt-3 max-w-[560px] font-body text-body-s text-ink-secondary">
              Press <span className="italic">Refresh matches</span> above to match catalog products
              with prices, dimensions, and retailer links.
            </p>
          </div>
        )}
      </div>

      {/* ink CTA band — ground the concept with the sourced pieces */}
      {shoppingList && shoppingItemsList.length > 0 ? (
        <div className="flex flex-col gap-8 bg-[var(--rs-surface-ink)] px-5 py-9 md:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div className="max-w-[640px]">
            <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-on-dark-muted">
              Final render
            </p>
            <p className="mt-[10px] font-display text-[28px] font-light text-ink-on-dark">
              Ground the concept with{" "}
              <em className="italic text-accent">these pieces.</em>
            </p>
            <p className="mt-2 font-body text-body-s text-ink-on-dark-muted">
              The render uses your sourced product images as visual references. The shopping list
              above remains the source of truth.
            </p>
            {latestRenderJob?.status === "failed" ? (
              <p className="mt-4 font-display text-body-s italic text-accent">
                {latestRenderJob.error_message ?? "Final render failed."}
              </p>
            ) : null}
          </div>

          <form action={generateFinalRenderAction} className="shrink-0">
            <input name="projectId" type="hidden" value={projectId} />
            <input name="roomId" type="hidden" value={roomId} />
            <input name="conceptId" type="hidden" value={selectedConcept.id} />
            <input name="shoppingListId" type="hidden" value={shoppingList?.id ?? ""} />
            <SubmitButton pendingLabel="Generating final render..." variant="paper">
              {finalRenders.length > 0 ? "Regenerate render" : "Generate final render"}
            </SubmitButton>
          </form>
        </div>
      ) : null}

      {finalRenders.length > 1 ? (
        <section className="bg-page px-5 py-11 md:px-8 lg:px-12">
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
            Earlier renders
          </p>
          <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {finalRenders.slice(1).map((render) => (
              <figure className="m-0" key={render.id}>
                <div className="h-[220px] overflow-hidden border border-line bg-surface">
                  {render.signedUrl ? (
                    <Image
                      alt="Earlier grounded room render"
                      className="h-full w-full object-cover"
                      height={640}
                      src={render.signedUrl}
                      unoptimized
                      width={854}
                    />
                  ) : (
                    <p className="flex h-full items-center justify-center font-display text-body-s italic text-error">
                      render could not load
                    </p>
                  )}
                </div>
                <figcaption className="mt-[10px] font-body text-caption-tight font-medium uppercase tracking-[0.28em] text-ink-muted">
                  {new Date(render.created_at).toLocaleDateString("en-AE")}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function availabilityTone(availability: string | null | undefined) {
  const value = (availability ?? "").toLowerCase();
  if (value.includes("out of stock") || value.includes("unavailable")) {
    return "text-error";
  }
  if (value.includes("in stock") || value.includes("available")) {
    return "text-success";
  }
  return "text-warning";
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
