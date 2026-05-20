import { AnimatedStatus, ButtonLink, SubmitButton } from "@ritzy-studio/ui";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { generateFinalRenderAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

import { RenderExpectationNote } from "../render-expectation-note";
import { PrintButton } from "./print-button";
import { RenderRefresh } from "./render-refresh";
import { UnlockShoppingListCta } from "./unlock-shopping-list-cta";

export const dynamic = "force-dynamic";

const renderRevealPhases = [
  "Reading the room photograph",
  "Reviewing selected dimensions",
  "Placing the rug",
  "Anchoring the seating",
  "Balancing coffee table proportions",
  "Layering wall art and soft accents",
  "Checking walkways and clearances",
  "Tuning daylight and material warmth",
  "Preparing the final reveal"
];

export default async function PresentationPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string; roomId: string }>;
  searchParams: Promise<{ renderJobId?: string | string[] }>;
}) {
  const { projectId, roomId } = await params;
  const query = await searchParams;
  const renderJobId = Array.isArray(query.renderJobId) ? query.renderJobId[0] : query.renderJobId;
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

  const { data: canAccessCommerce = false } = await supabase.rpc("can_access_room_commerce", {
    room_id: roomId
  });
  const commerceUnlocked = Boolean(canAccessCommerce);

  const serviceSupabase = createServiceClient();
  const { data: selectedConcept } = await supabase
    .from("concepts")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "selected")
    .limit(1)
    .maybeSingle();

  const { data: shoppingList } = await supabase
    .from("shopping_lists")
    .select("*")
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
        .eq("status", "selected")
        .order("sort_order", { ascending: true })
    : { data: [] };
  const listItems = items ?? [];
  const selectedItemIds = listItems.map((item) => item.id).sort();
  const selectionKey = selectedItemIds.join(",");
  const { data: routedRenderJob } = renderJobId
    ? await serviceSupabase
        .from("render_jobs")
        .select("id, status, error_message, created_at, output_asset_ids")
        .eq("id", renderJobId)
        .eq("room_id", roomId)
        .maybeSingle()
    : { data: null };
  const { data: selectionRenderJob } =
    !routedRenderJob && shoppingList && selectedConcept
      ? await serviceSupabase
          .from("render_jobs")
          .select("id, status, error_message, created_at, output_asset_ids")
          .eq("room_id", roomId)
          .eq("concept_id", selectedConcept.id)
          .eq("shopping_list_id", shoppingList.id)
          .contains("input_summary", { selectionKey })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
  const latestRenderJob = routedRenderJob ?? selectionRenderJob;
  const matchingRenderAssetId = Array.isArray(latestRenderJob?.output_asset_ids)
    ? latestRenderJob.output_asset_ids[0]
    : null;
  const { data: finalRenderAsset } = matchingRenderAssetId
    ? await supabase
        .from("room_assets")
        .select("*")
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
  const renderJobStatus = latestRenderJob?.status ?? null;
  const showRenderProgress =
    !finalRenderUrl && (renderJobStatus === "running" || renderJobStatus === "queued");
  const canRequestRender = Boolean(selectedConcept && shoppingList && selectedItemIds.length > 0);
  const currentEstimateAed =
    listItems.length > 0
      ? listItems.reduce((total, item) => total + currentLineTotalAed(item), 0)
      : shoppingList?.estimated_total_aed;
  const revealPath = `/projects/${projectId}/rooms/${roomId}/presentation`;
  const roomLabel = `${project.client_name?.trim().split(/\s+/)[0] ?? "Your"}'s ${room.room_type.toLowerCase()}`;

  return (
    <main className="min-h-dvh bg-surface text-ink print:bg-surface">
      <RenderRefresh enabled={showRenderProgress} />
      <header className="flex min-h-20 items-center justify-between border-b border-line bg-surface px-5 md:px-8 lg:px-12 xl:px-16 print:hidden">
        <Link className="font-display text-[28px] font-light text-ink" href="/">
          Ri <span className="font-body text-caption font-medium uppercase text-ink-muted">Ritzy Studio</span>
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ButtonLink href="/" trailing="→" variant="secondary">
            Studio
          </ButtonLink>
          <ButtonLink
            href={`/projects/${projectId}/rooms/${roomId}/concepts`}
            trailing="→"
            variant="secondary"
          >
            Concepts
          </ButtonLink>
          {commerceUnlocked ? (
            <ButtonLink
              href={`/projects/${projectId}/rooms/${roomId}/shopping-list`}
              trailing="→"
              variant="primary"
            >
              Shopping list
            </ButtonLink>
          ) : null}
          {commerceUnlocked ? <PrintButton /> : null}
        </div>
      </header>

      <section className="mx-auto max-w-[1180px] px-5 py-12 md:px-8 lg:px-12 xl:px-16 print:px-0 print:py-0">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] print:block">
          <div>
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              {commerceUnlocked ? "Ritzy Studio Presentation" : "The reveal"}
            </p>
            <div className="mt-3 h-px w-32 bg-ink" />
            <h1 className="mt-10 font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink print:text-display-m">
              {commerceUnlocked ? (project.client_name ?? project.name) : roomLabel}
            </h1>
            <p className="mt-5 max-w-[680px] font-body text-body-m text-ink-secondary">
              {commerceUnlocked
                ? `${room.name} · ${room.room_type} · ${project.location ?? "Dubai / UAE"}`
                : "Your selected pieces, brought together in the room."}
            </p>
          </div>

          <aside className="border border-line bg-page p-5 print:mt-8">
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              Estimated furniture total
            </p>
            <p className="mt-5 font-display text-display-xs font-light italic text-ink">
              {formatAed(currentEstimateAed)}
            </p>
            <p className="mt-4 font-body text-body-s text-ink-secondary">
              {listItems.length} selected catalog item{listItems.length === 1 ? "" : "s"}
              {commerceUnlocked ? "." : " included in this direction."}
            </p>
            {!commerceUnlocked ? (
              <div className="mt-6 border-t border-line pt-5">
                <p className="mb-5 font-body text-body-s text-ink-secondary">
                  Generate the final shopping list when you are ready for retailer links and
                  product details.
                </p>
                <UnlockShoppingListCta
                  projectId={projectId}
                  returnTo={revealPath}
                  roomId={roomId}
                />
              </div>
            ) : null}
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
            ) : showRenderProgress ? (
              <div className="flex h-full items-center justify-center p-8">
                <div className="max-w-[520px] text-center">
                  <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                    Rendering the room
                  </p>
                  <RenderExpectationNote className="mx-auto mt-5 max-w-[360px]" />
                  <AnimatedStatus className="mt-8" phases={renderRevealPhases} />
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-8">
                <div className="max-w-[560px] text-center">
                  <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                    Final render
                  </p>
                  <h2 className="mt-6 font-display text-display-xs font-light italic text-ink">
                    {renderJobStatus === "failed" ? "The render needs another try." : "Ready to generate your room."}
                  </h2>
                  <p className="mx-auto mt-4 max-w-[440px] font-body text-body-s text-ink-secondary">
                    {renderJobStatus === "failed"
                      ? (latestRenderJob?.error_message ??
                        "The previous render attempt failed before it could create an image.")
                      : "Create the final image with your selected catalog pieces."}
                  </p>
                  <FinalRenderForm
                    canRequestRender={canRequestRender}
                    conceptId={selectedConcept?.id ?? null}
                    projectId={projectId}
                    roomId={roomId}
                    selectedIds={selectedItemIds}
                    shoppingListId={shoppingList?.id ?? null}
                  />
                </div>
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

        {commerceUnlocked ? (
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
                        <p>{formatAed(currentLineTotalAed(item))}</p>
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
        ) : null}

        <section className="mt-10 border border-line bg-page p-5">
          <p className="font-body text-caption font-medium uppercase text-ink-muted">
            Notes
          </p>
          <p className="mt-4 font-body text-body-s text-ink-secondary">
            {commerceUnlocked
              ? "Product names, prices, availability, dimensions, images, and retailer links come from catalog records and should be rechecked before purchasing. The render is a best-effort visual composition and may not exactly reproduce every selected SKU."
              : "The render is a best-effort visual composition based on your selected pieces. Generate the shopping list to reveal retailer links and product details."}
          </p>
        </section>
      </section>
    </main>
  );
}

function FinalRenderForm({
  canRequestRender,
  conceptId,
  projectId,
  roomId,
  selectedIds,
  shoppingListId
}: {
  canRequestRender: boolean;
  conceptId: string | null;
  projectId: string;
  roomId: string;
  selectedIds: string[];
  shoppingListId: string | null;
}) {
  const button = (
    <SubmitButton
      className="mt-8"
      disabled={!canRequestRender || conceptId === null || shoppingListId === null}
      pendingLabel="Generating render..."
    >
      Generate render
    </SubmitButton>
  );

  if (!canRequestRender || conceptId === null || shoppingListId === null) {
    return button;
  }

  return (
    <form action={generateFinalRenderAction}>
      <input name="projectId" type="hidden" value={projectId} />
      <input name="roomId" type="hidden" value={roomId} />
      <input name="conceptId" type="hidden" value={conceptId} />
      <input name="shoppingListId" type="hidden" value={shoppingListId} />
      <input name="selectedItemIds" type="hidden" value={selectedIds.join(",")} />
      {button}
    </form>
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
