import {
  AnimatedStatus,
  ButtonLink,
  DecorativeRule,
  JourneyNav,
  SectionEyebrow,
  StudioHeader,
  SubmitButton
} from "@ritzy-studio/ui";
import { plannedViewLabel } from "@ritzy-studio/domain";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { generateFinalRenderAction } from "@/app/actions";
import { isRenderJobStalled, isWithinFinalRenderViewsWindow } from "@/lib/render";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

import { RenderExpectationNote } from "../render-expectation-note";
import { leftOutViewCount, RenderDisclaimer, RenderReviewNote, ViewsLeftOutNote } from "./render-notes";
import { RenderRefresh } from "./render-refresh";
import { UnlockShoppingListCta } from "./unlock-shopping-list-cta";

export const dynamic = "force-dynamic";
// This page posts the final render action; when the queue cannot be reached the
// render runs inline inside this route, under FINAL_RENDER_INLINE_BUDGET_MS
// (pinned by lib/render.test.ts against this literal).
export const maxDuration = 300;

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
        .select("id, status, error_message, created_at, completed_at, output_asset_ids, input_summary")
        .eq("id", renderJobId)
        .eq("room_id", roomId)
        .maybeSingle()
    : { data: null };
  const { data: selectionRenderJob } =
    !routedRenderJob && shoppingList && selectedConcept
      ? await serviceSupabase
          .from("render_jobs")
          .select("id, status, error_message, created_at, completed_at, output_asset_ids, input_summary")
          .eq("room_id", roomId)
          .eq("concept_id", selectedConcept.id)
          .eq("shopping_list_id", shoppingList.id)
          .contains("input_summary", { selectionKey })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
  const latestRenderJob = routedRenderJob ?? selectionRenderJob;
  // output_asset_ids is [hero, ...additional camera angles]. Fetch them all so the presentation can
  // show the room from several viewpoints, like a designer would; the hero stays index 0.
  const renderAssetIds = Array.isArray(latestRenderJob?.output_asset_ids)
    ? latestRenderJob.output_asset_ids.filter((id): id is string => typeof id === "string")
    : [];
  const { data: renderAssets } =
    renderAssetIds.length > 0
      ? await supabase
          .from("room_assets")
          .select("id, storage_path, view_key")
          .in("id", renderAssetIds)
          .eq("room_id", roomId)
          .eq("asset_type", "final_render")
      : { data: null };
  // The hero is strictly output_asset_ids[0]; the rest are additional angles. Sign each by its own
  // id so a failed hero URL never promotes an alternate into the hero slot (which drives the whole
  // reveal state) — if the hero can't be produced the render simply reads as not-ready.
  const signRenderAsset = async (assetId: string) => {
    const asset = (renderAssets ?? []).find((candidate) => candidate.id === assetId);
    if (!asset?.storage_path) {
      return null;
    }
    const { data: signed } = await serviceSupabase.storage
      .from("generated-renders")
      .createSignedUrl(asset.storage_path, 60 * 60);
    // The hero carries no view_key; planned angles do, and one table names them.
    return signed?.signedUrl ? { url: signed.signedUrl, label: plannedViewLabel(asset.view_key) } : null;
  };
  const heroRenderView = renderAssetIds[0] ? await signRenderAsset(renderAssetIds[0]) : null;
  const additionalRenderViews = (await Promise.all(renderAssetIds.slice(1).map(signRenderAsset))).filter(
    (view): view is { url: string; label: string } => Boolean(view)
  );
  const finalRenderUrl = heroRenderView?.url ?? null;
  const renderJobStatus = latestRenderJob?.status ?? null;
  // A render whose in-request after() task never completed can sit in `running` indefinitely.
  // Once it is stalled, stop showing the progress spinner (which would poll forever) and fall
  // through to the retry affordance, which will fail the stale job and start a fresh render.
  const latestRenderSummary = ((latestRenderJob?.input_summary ?? {}) as {
    executionPath?: string;
    spatialQaOutcome?: string;
    spatialQaIssues?: string[];
    spatialQaError?: string | null;
    spatialQaVerdicts?: string[];
    spatialQaReason?: string | null;
    viewOutcomes?: unknown;
  }) ?? {};
  // The placement review's outcome on the kept hero (S4): unresolved after the
  // one bounded regeneration, or a review that could not run, is shown with
  // its findings and a working render-again, never presented as finished.
  const reviewOutcome = latestRenderSummary.spatialQaOutcome ?? null;
  const reviewFlagged = reviewOutcome === "unresolved" || reviewOutcome === "unreviewed";
  const reviewIssues = Array.isArray(latestRenderSummary.spatialQaIssues)
    ? latestRenderSummary.spatialQaIssues.filter((issue): issue is string => typeof issue === "string")
    : [];
  // A correction may be claimed only when a corrected render was judged: two
  // recorded verdicts. One verdict means the retry never ran or was never judged.
  const correctedAttemptJudged = (latestRenderSummary.spatialQaVerdicts?.length ?? 0) >= 2;
  const viewsLeftOut = leftOutViewCount(latestRenderSummary.viewOutcomes);
  const isRenderStalled = isRenderJobStalled(
    renderJobStatus,
    latestRenderJob?.created_at,
    undefined,
    latestRenderSummary.executionPath
  );
  const showRenderProgress =
    !finalRenderUrl &&
    !isRenderStalled &&
    (renderJobStatus === "running" || renderJobStatus === "queued");
  // The additional camera angles are generated right after the hero commits (same after() task), so
  // keep refreshing until the final_render_views job is terminal — otherwise the gallery would only
  // appear on a manual reload. Bounded by the render's age so a task that died before producing the
  // views can never poll forever.
  const { data: finalRenderViewsJob } =
    finalRenderUrl && latestRenderJob?.id
      ? await serviceSupabase
          .from("ai_jobs")
          .select("status, created_at")
          .eq("room_id", roomId)
          .eq("job_type", "final_render_views")
          .contains("input_summary", { renderJobId: latestRenderJob.id })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
  // Measure the views window from the hero's commit time, not the job's creation: with the
  // durable queue path a retried render can commit minutes after created_at, and the window
  // must cover the views that generate right after the hero lands.
  const renderRecentlySucceeded = isWithinFinalRenderViewsWindow(
    latestRenderJob?.completed_at ?? latestRenderJob?.created_at
  );
  const viewsJobComplete =
    finalRenderViewsJob?.status === "succeeded" || finalRenderViewsJob?.status === "failed";
  const showViewProgress =
    Boolean(finalRenderUrl) && additionalRenderViews.length === 0 && !viewsJobComplete && renderRecentlySucceeded;
  const showShoppingListUnlock = !commerceUnlocked && Boolean(finalRenderUrl);
  const canRequestRender = Boolean(selectedConcept && shoppingList && selectedItemIds.length > 0);
  const currentEstimateAed =
    listItems.length > 0
      ? listItems.reduce((total, item) => total + currentLineTotalAed(item), 0)
      : shoppingList?.estimated_total_aed;
  const roomLabel = `${project.client_name?.trim().split(/\s+/)[0] ?? "Your"}'s ${room.room_type.toLowerCase()}`;
  const estimatedDisplay =
    currentEstimateAed === null || currentEstimateAed === undefined
      ? "not available"
      : Number(currentEstimateAed).toLocaleString("en-AE", { maximumFractionDigits: 0 });

  return (
    <main className="min-h-dvh bg-[var(--rs-surface-ink)] text-ink-on-dark print:bg-surface print:text-ink">
      <RenderRefresh enabled={showRenderProgress || showViewProgress} />
      <StudioHeader className="print:hidden" tone="ink">
        <div className="hidden items-center gap-6 sm:flex">
          <JourneyNav current="presentation" tone="ink" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {commerceUnlocked ? (
            <ButtonLink
              href={`/projects/${projectId}/rooms/${roomId}/shopping-list`}
              trailing="→"
              variant="paper"
            >
              Shopping list
            </ButtonLink>
          ) : null}
        </div>
      </StudioHeader>

      {/* title block — reveal name on the left, estimated total on the right */}
      <div className="flex flex-col gap-8 px-5 pb-8 pt-14 md:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-12 print:px-0 print:pt-8">
        <div>
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-accent print:text-accent-deep">
            {commerceUnlocked ? "N° 11 — Room Preview" : "N° 11 — The reveal"}
          </p>
          <span aria-hidden className="mt-[18px] block h-px w-14 bg-accent" />
          <h1 className="mt-6 font-display text-[52px] font-light leading-[0.98] tracking-[-0.015em] text-ink-on-dark md:text-[64px] lg:text-[72px] print:text-ink print:text-display-m">
            {commerceUnlocked ? (project.client_name ?? project.name) : roomLabel}
          </h1>
          <p className="mt-[18px] max-w-[680px] font-body text-body-m text-ink-on-dark-muted print:text-ink-secondary">
            {commerceUnlocked
              ? `${room.name} · ${room.room_type} · ${project.location ?? "Dubai / UAE"}`
              : "Your selected pieces, brought together in the room."}
          </p>
        </div>
        <div className="lg:pb-[6px] lg:text-right">
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-on-dark-muted print:text-ink-muted">
            Estimated furniture total
          </p>
          <p className="mt-3 [font-feature-settings:'tnum','lnum']">
            <span className="font-body text-caption font-medium uppercase tracking-[0.28em] text-accent">
              AED{" "}
            </span>
            <span className="font-display text-[46px] font-light italic text-ink-on-dark print:text-ink">
              {estimatedDisplay}
            </span>
          </p>
          <p className="mt-2 font-body text-body-s text-ink-on-dark-muted print:text-ink-secondary [font-feature-settings:'tnum','lnum']">
            {listItems.length} selected catalog item{listItems.length === 1 ? "" : "s"}
            {commerceUnlocked ? "." : " included in this direction."}
          </p>
        </div>
      </div>

      {/* hero render — full-bleed within the gutters */}
      <div className="px-5 md:px-8 lg:px-12 print:px-0">
        {finalRenderUrl ? (
          <>
            <div className="overflow-hidden">
              <Image
                alt="Final client room render"
                className="h-[420px] w-full object-cover md:h-[560px] lg:h-[720px]"
                height={1024}
                src={finalRenderUrl}
                unoptimized
                width={1536}
              />
            </div>
            <p className="mt-[14px] font-body text-caption-tight font-medium uppercase tracking-[0.28em] text-ink-on-dark-muted print:text-ink-muted">
              Final render · hero view
            </p>
            <RenderDisclaimer />
            {reviewFlagged ? (
              <RenderReviewNote
                correctedAttemptJudged={correctedAttemptJudged}
                error={latestRenderSummary.spatialQaError ?? null}
                issues={reviewIssues}
                outcome={reviewOutcome}
                reason={latestRenderSummary.spatialQaReason ?? null}
              >
                <FinalRenderForm
                  canRequestRender={canRequestRender}
                  conceptId={selectedConcept?.id ?? null}
                  projectId={projectId}
                  retryOf={latestRenderJob?.id ?? null}
                  roomId={roomId}
                  selectedIds={selectedItemIds}
                  shoppingListId={shoppingList?.id ?? null}
                  tone="ink"
                />
              </RenderReviewNote>
            ) : null}
          </>
        ) : (
          <div className="aspect-[3/2] border border-line bg-page text-ink">
            {showRenderProgress ? (
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
        )}

        {finalRenderUrl && additionalRenderViews.length > 0 ? (
          <div className="mt-9 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
            {additionalRenderViews.map((view) => (
              <figure className="m-0" key={view.url}>
                <div className="h-[240px] overflow-hidden md:h-[340px]">
                  <Image
                    alt={`Final client room render — ${view.label.toLowerCase()}`}
                    className="h-full w-full object-cover"
                    height={1024}
                    src={view.url}
                    unoptimized
                    width={1536}
                  />
                </div>
                <figcaption className="mt-3 font-body text-caption-tight font-medium uppercase tracking-[0.28em] text-ink-on-dark-muted print:text-ink-muted">
                  {view.label}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : null}
        {finalRenderUrl && additionalRenderViews.length > 0 ? <RenderDisclaimer /> : null}
        {finalRenderUrl ? <ViewsLeftOutNote count={viewsLeftOut} /> : null}
      </div>

      {/* paper section — direction + the commerce gate breaks the ink */}
      <div className="mt-14 bg-surface px-5 py-16 text-ink md:px-8 lg:px-12 print:mt-8">
        <div className="grid gap-10 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-16">
          <div>
            <SectionEyebrow>Design direction</SectionEyebrow>
            <DecorativeRule className="mt-4" />
            <h2 className="mt-5 font-display text-[36px] font-light italic leading-[1.1] text-ink">
              {selectedConcept?.title ?? "Selected concept pending"}
            </h2>
          </div>
          <div>
            <p className="max-w-[66ch] whitespace-pre-line font-body text-body-m leading-[1.75] text-ink-secondary first-letter:float-left first-letter:pr-3 first-letter:pt-1 first-letter:font-display first-letter:text-[64px] first-letter:font-light first-letter:leading-[0.8] first-letter:text-accent">
              {selectedConcept?.description ??
                "Select a concept and generate a final render before sharing this presentation."}
            </p>
            <p className="mt-5 max-w-[60ch] font-display text-body-l italic leading-[1.6] text-ink-muted">
              Retailer links and product details live on the shopping list.
            </p>
          </div>
        </div>

        {showShoppingListUnlock ? (
          <div className="mt-14 flex flex-col gap-8 border-t border-line-strong pt-9 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                The shopping list
              </p>
              <p className="mt-[10px] max-w-[56ch] font-body text-body-s leading-[1.6] text-ink-secondary">
                Unlock the shopping list when you are ready to buy this room — retailer links and
                product details open after payment.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <ButtonLink
                href={`/projects/${projectId}/rooms/${roomId}/shopping-list`}
                variant="secondary"
              >
                Change selected pieces
              </ButtonLink>
              <UnlockShoppingListCta projectId={projectId} roomId={roomId} />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function FinalRenderForm({
  canRequestRender,
  conceptId,
  projectId,
  roomId,
  selectedIds,
  shoppingListId,
  retryOf = null,
  tone = "paper"
}: {
  canRequestRender: boolean;
  conceptId: string | null;
  projectId: string;
  roomId: string;
  selectedIds: string[];
  shoppingListId: string | null;
  // The succeeded job this submission renders again (S4): the action accepts it
  // only for a job whose placement review stayed unresolved or could not run.
  retryOf?: string | null;
  tone?: "paper" | "ink";
}) {
  const button = (
    <SubmitButton
      className={tone === "ink" ? "mt-6" : "mt-8"}
      disabled={!canRequestRender || conceptId === null || shoppingListId === null}
      pendingLabel="Generating render..."
      variant={tone === "ink" ? "paper" : undefined}
    >
      {retryOf ? "Render again" : "Generate render"}
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
      {retryOf ? <input name="retryOf" type="hidden" value={retryOf} /> : null}
      {button}
    </form>
  );
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
