import {
  AnimatedStatus,
  ButtonLink,
  DecorativeRule,
  MarketingPanel,
  SectionEyebrow,
  SubmitButton
} from "@ritzy-studio/ui";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { generateFinalRenderAction } from "@/app/actions";
import { isRenderJobStalled } from "@/lib/render";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

import { RenderExpectationNote } from "../render-expectation-note";
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
  // A render whose in-request after() task never completed can sit in `running` indefinitely.
  // Once it is stalled, stop showing the progress spinner (which would poll forever) and fall
  // through to the retry affordance, which will fail the stale job and start a fresh render.
  const isRenderStalled = isRenderJobStalled(renderJobStatus, latestRenderJob?.created_at);
  const showRenderProgress =
    !finalRenderUrl &&
    !isRenderStalled &&
    (renderJobStatus === "running" || renderJobStatus === "queued");
  const showShoppingListUnlock = !commerceUnlocked && Boolean(finalRenderUrl);
  const canRequestRender = Boolean(selectedConcept && shoppingList && selectedItemIds.length > 0);
  const currentEstimateAed =
    listItems.length > 0
      ? listItems.reduce((total, item) => total + currentLineTotalAed(item), 0)
      : shoppingList?.estimated_total_aed;
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
        </div>
      </header>

      <section className="mx-auto max-w-[1180px] px-5 py-12 md:px-8 lg:px-12 xl:px-16 print:px-0 print:py-0">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] print:block">
          <div>
            <SectionEyebrow>N° 11 — Room Preview</SectionEyebrow>
            <DecorativeRule className="mt-5" />
            <h1 className="mt-7 font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink print:text-display-m">
              {commerceUnlocked ? (project.client_name ?? project.name) : roomLabel}
            </h1>
            <p className="mt-4 font-body text-caption font-medium uppercase tracking-[0.18em] text-ink-muted">
              {commerceUnlocked ? "Ritzy Studio Room Preview" : "The reveal"}
            </p>
            <p className="mt-5 max-w-[680px] font-body text-body-m text-ink-secondary">
              {commerceUnlocked
                ? `${room.name} · ${room.room_type} · ${project.location ?? "Dubai / UAE"}`
                : "Your selected pieces, brought together in the room."}
            </p>
          </div>

          <MarketingPanel as="aside" tone="paper" className="p-5 print:mt-8 print:shadow-none">
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              Estimated furniture total
            </p>
            <p className="mt-5 font-display text-display-xs font-light tracking-[-0.01em] text-ink">
              {formatAed(currentEstimateAed)}
            </p>
            <p className="mt-4 font-body text-body-s text-ink-secondary">
              {listItems.length} selected catalog item{listItems.length === 1 ? "" : "s"}
              {commerceUnlocked ? "." : " included in this direction."}
            </p>
            {showShoppingListUnlock ? (
              <div className="mt-6 border-t border-line pt-5">
                <p className="mb-5 font-body text-body-s text-ink-secondary">
                  Unlock the shopping list when you are ready to buy this room — retailer links and
                  product details open after payment.
                </p>
                <UnlockShoppingListCta projectId={projectId} roomId={roomId} />
                <ButtonLink
                  className="mt-4"
                  href={`/projects/${projectId}/rooms/${roomId}/shopping-list`}
                  trailing="→"
                  variant="secondary"
                >
                  Change selected pieces
                </ButtonLink>
              </div>
            ) : null}
          </MarketingPanel>
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
                  <h2 className="mt-6 font-display text-display-xs font-light tracking-[-0.01em] text-ink">
                    {isRenderStalled
                      ? "This render is taking longer than expected."
                      : renderJobStatus === "failed"
                        ? "The render needs another try."
                        : "Ready to generate your room."}
                  </h2>
                  <p className="mx-auto mt-4 max-w-[440px] font-body text-body-s text-ink-secondary">
                    {isRenderStalled
                      ? "The previous attempt stalled before it finished. Start it again — your concept and shopping list are unchanged."
                      : renderJobStatus === "failed"
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
            <SectionEyebrow>Design Direction</SectionEyebrow>
            <DecorativeRule className="mt-5" />
            <h2 className="mt-6 max-w-[420px] font-display text-display-s font-light tracking-[-0.015em] text-ink">
              {selectedConcept?.title ?? "Selected concept pending"}
            </h2>
          </div>
          <div className="whitespace-pre-line font-body text-body-s text-ink-secondary">
            {selectedConcept?.description ??
              "Select a concept and generate a final render before sharing this presentation."}
          </div>
        </section>

        <MarketingPanel as="section" tone="paper" className="mt-10 p-5 print:shadow-none">
          <p className="font-body text-caption font-medium uppercase text-ink-muted">
            Notes
          </p>
          <p className="mt-4 font-body text-body-s text-ink-secondary">
            {commerceUnlocked
              ? "The render is a best-effort visual composition and may not exactly reproduce every selected piece. Retailer links and product details live on the shopping list."
              : "The render is a best-effort visual composition based on your selected pieces. Unlock the shopping list to see retailer links and product details."}
          </p>
        </MarketingPanel>
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
