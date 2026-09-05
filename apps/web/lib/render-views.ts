import { randomUUID } from "node:crypto";

import {
  assessViewConsistency,
  evolinkCreditsToUsd,
  generateFinalRenderView,
  VIEW_CONSISTENCY_TIMEOUT_MS,
  viewConsistencyCorrectionLanguage,
  type AssessViewConsistencyInput,
  type AssessViewConsistencyResult,
  type GenerateFinalRenderViewInput,
  type GenerateFinalRenderViewResult
} from "@ritzy-studio/ai";
import {
  focalElementLabel,
  parseViewPlan,
  PLANNED_VIEW_CAPTIONS,
  PLANNED_VIEW_LABELS,
  type PlannedView,
  type ViewPlan
} from "@ritzy-studio/domain";

import { configuredImageModel, configuredImageProvider, fetchRemoteImage, visionImageDataUrl } from "@/lib/render-images";
import {
  addCost,
  addCredits,
  enforceViewConsistency,
  MIN_TEXT_CALL_MS,
  type ViewConsistencyOutcome
} from "@/lib/render-qa";
import { closeAiJob } from "@/lib/services/close-ai-job";
import type { ServiceSupabaseClient } from "@/lib/services/supabase-clients";

// S4 step 5: the final render's planned views. Called after the hero commits,
// on every delivery, with the identical `{ complete }` contract the runner
// had: an incomplete set below the attempt cap asks the queue to redeliver.
//
// Idempotent and exclusive under at-least-once delivery, the way the spec
// extraction is: a view's check row is opened as a LEASE before any paid
// call, and a partial unique index on ai_jobs allows one running or succeeded
// row per render job and view key, so a duplicate delivery gets a unique
// violation and adopts instead of paying; an expired lease is reclaimed by a
// status-conditional compare-and-swap. Every generated view goes to an
// attempt-unique path with its own asset row, so nothing another delivery
// judged is ever overwritten, the row names the asset its verdict describes,
// and the view a reveal shows is the asset of the one succeeded row for its
// key. The job's asset list is written under an optimistic version.

export const RENDER_VIEW_CHECK_JOB_TYPE = "render_view_check";
export const FINAL_RENDER_VIEWS_JOB_TYPE = "final_render_views";

// What a view needs before it is started: an image call at the primary
// provider's observed pace plus its check. The image call itself is bounded
// by the remaining deadline, so a view started here and cut off by the route
// closes its row failed and is repaired by the next delivery.
export const VIEW_START_RESERVE_MS = 90_000;
// A lease outlives its holder's expected work by this much so a delivery that
// is slow but alive is not reclaimed while it is still writing.
export const VIEW_LEASE_GRACE_MS = 30_000;
// A lease is bounded by the VIEW's own worst case (start, one retry, grace),
// never by the whole attempt: a dead delivery's lease must lapse inside the
// queue's redelivery cadence, or its views would never be repaired. It is
// extended by the holder once the generation lands, for the check, a retry
// and its grace; every paid call of the view is bounded by the lease as well
// as the attempt, so the extension must hold a check AND the retry reserve.
export const VIEW_LEASE_MS = VIEW_START_RESERVE_MS + 75_000 + VIEW_LEASE_GRACE_MS;
export const VIEW_LEASE_EXTENSION_MS = VIEW_CONSISTENCY_TIMEOUT_MS + 75_000 + VIEW_LEASE_GRACE_MS;

const SIGNED_URL_TTL_SECONDS = 60 * 30;

export type FinalRenderViewsDeps = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  generateView: (input: GenerateFinalRenderViewInput) => Promise<GenerateFinalRenderViewResult>;
  assessView: (input: AssessViewConsistencyInput) => Promise<AssessViewConsistencyResult>;
  fetchImage: (url: string) => Promise<{ bytes: Buffer; mimeType: string } | null>;
  toVisionDataUrl: (bytes: Buffer, mimeType: string) => Promise<string>;
  nonce: () => string;
};

type ViewCheckRow = {
  id: string;
  status: string;
  created_at: string;
  input_summary: unknown;
  output_summary: unknown;
};

type ViewAssetRow = { id: string; storage_path: string; view_key: string | null; mime_type: string | null };

type ViewState =
  | { kind: "terminal"; outcome: ViewConsistencyOutcome; assetId: string; legacy?: boolean }
  | { kind: "not_terminal"; why: string };

export type ViewOutcomeSummary = Record<string, { outcome: ViewConsistencyOutcome; assetId: string; legacy?: boolean }>;

type ViewImage = {
  assetId: string;
  assetPath: string;
  bytes: Buffer;
  credits: number | null;
  recovered: boolean;
};

export function displayableViewOutcome(outcome: ViewConsistencyOutcome | string | null | undefined): boolean {
  return outcome === "consistent" || outcome === "resolved_after_regeneration" || outcome === "unchecked";
}

function summaryOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

// The keys the old runner generated, as a plan: hero reference only, no photo
// anchoring, no expectations. Used for a job whose hero committed before the
// planner existed.
// A row's cost: image credits when a generation was made, text cost when a
// check was; a row that only checked a recovered asset still records its
// text cost rather than collapsing to null (correctness review).
function viewCostUsd(imageCredits: number | null, textCostUsd: number | null): number | null {
  if (imageCredits === null && textCostUsd === null) {
    return null;
  }
  const imageUsd = imageCredits === null ? 0 : (evolinkCreditsToUsd(imageCredits) ?? 0);
  return Math.round((imageUsd + (textCostUsd ?? 0)) * 10_000) / 10_000;
}

export function compatibilityViewPlan(): ViewPlan {
  const view = (key: "reverse_wide" | "anchor_detail"): PlannedView => ({
    key,
    label: PLANNED_VIEW_LABELS[key],
    purpose: PLANNED_VIEW_CAPTIONS[key],
    sourcePhotoAssetId: null,
    mustShow: [],
    mustShowLabels: [],
    referenceItemIds: [],
    photoNotes: []
  });
  return {
    version: 1,
    heroPhotoAssetId: null,
    heroReferenceItemIds: [],
    views: [view("reverse_wide"), view("anchor_detail")],
    designLabels: [],
    coverage: { focalToken: null, focalCoveredBy: null, keyRoleKeys: [], heroCovers: [], uncovered: [] }
  };
}

export async function ensureFinalRenderViews({
  serviceSupabase,
  renderJobId,
  deadlineAt,
  now,
  deps: depsOverride
}: {
  serviceSupabase: ServiceSupabaseClient;
  renderJobId: string;
  deadlineAt: number;
  now: () => number;
  deps?: Partial<FinalRenderViewsDeps>;
}): Promise<{ complete: boolean }> {
  const deps: FinalRenderViewsDeps = {
    now,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    generateView: generateFinalRenderView,
    assessView: assessViewConsistency,
    fetchImage: fetchRemoteImage,
    toVisionDataUrl: visionImageDataUrl,
    nonce: () => randomUUID().slice(0, 8),
    ...depsOverride
  };
  const remainingMs = () => Math.max(0, deadlineAt - deps.now());

  // A failed read is never "nothing to repair": it throws, and the queue
  // redelivers below the attempt cap (correctness review; the runner's rule).
  const { data: job, error: jobError } = await serviceSupabase
    .from("render_jobs")
    .select("id, room_id, concept_id, shopping_list_id, status, output_asset_ids, input_summary")
    .eq("id", renderJobId)
    .maybeSingle();
  if (jobError) {
    throw new Error(`The final render job could not be read for its views: ${jobError.message}`);
  }

  const heroAssetId = job?.output_asset_ids?.[0];
  if (!job || job.status !== "succeeded" || !heroAssetId) {
    // Nothing to repair (reclaimed, superseded, or no committed hero); do not block the ack.
    return { complete: true };
  }

  const summary = summaryOf(job.input_summary);
  let userId = typeof summary.userId === "string" ? summary.userId : null;
  if (!userId) {
    const { data: room, error: roomError } = await serviceSupabase.from("rooms").select("project_id").eq("id", job.room_id).maybeSingle();
    if (roomError) {
      throw new Error(`The room could not be read for the render's views: ${roomError.message}`);
    }
    const { data: project, error: projectError } = room
      ? await serviceSupabase.from("projects").select("owner_user_id").eq("id", room.project_id).maybeSingle()
      : { data: null, error: null };
    if (projectError) {
      throw new Error(`The project could not be read for the render's views: ${projectError.message}`);
    }
    userId = project?.owner_user_id ?? null;
  }
  if (!userId) {
    return { complete: true };
  }

  const persistedPlan = parseViewPlan(summary.viewPlan);
  const legacy = persistedPlan === null;
  const plan = persistedPlan ?? compatibilityViewPlan();
  const viewPrefix = `${userId}/${job.room_id}/final-${job.id}-`;
  const legacyPathFor = (viewKey: string) => `${viewPrefix}${viewKey}.png`;
  const focalPoint = plan.coverage.focalToken?.replace(/^focal:/, "") ?? null;
  const focalLabel = focalElementLabel(focalPoint);
  const heroHiddenLabels = Array.from(new Set(plan.views.flatMap((view) => view.mustShowLabels)));

  // Only a legacy job (no persisted plan) has deterministic-path assets to
  // adopt; every other delivery skips the scan (simplification review).
  let viewAssets: ViewAssetRow[] = [];
  if (legacy) {
    const { data: assetRows, error: assetRowsError } = await serviceSupabase
      .from("room_assets")
      .select("id, storage_path, view_key, mime_type")
      .eq("room_id", job.room_id)
      .eq("asset_type", "final_render")
      .not("view_key", "is", null);
    if (assetRowsError) {
      throw new Error(`The legacy view assets could not be read: ${assetRowsError.message}`);
    }
    viewAssets = ((assetRows ?? []) as ViewAssetRow[]).filter((asset) => asset.storage_path.startsWith(viewPrefix));
  }

  const { data: rowData, error: rowsError } = await serviceSupabase
    .from("ai_jobs")
    .select("id, status, created_at, input_summary, output_summary")
    .eq("job_type", RENDER_VIEW_CHECK_JOB_TYPE)
    .contains("input_summary", { renderJobId: job.id })
    .order("created_at", { ascending: false });
  // A failed read of the check rows is not an empty world: the list would be
  // rewritten without a view another delivery paid for (correctness review).
  if (rowsError) {
    throw new Error(`The view check rows could not be read: ${rowsError.message}`);
  }
  const checkRows = (rowData ?? []) as ViewCheckRow[];
  const rowsFor = (viewKey: string) => checkRows.filter((row) => summaryOf(row.input_summary).viewKey === viewKey);

  // Lazily loaded shared inputs.
  let heroImage: { bytes: Buffer; signedUrl: string | null; dataUrl: string } | null = null;
  const loadHero = async () => {
    if (heroImage) {
      return heroImage;
    }
    const { data: heroAsset } = await serviceSupabase
      .from("room_assets")
      .select("id, storage_path, mime_type")
      .eq("id", heroAssetId)
      .eq("room_id", job.room_id)
      .maybeSingle();
    if (!heroAsset) {
      throw new Error("Final render hero asset no longer exists.");
    }
    const { data: heroBlob } = await serviceSupabase.storage.from("generated-renders").download(heroAsset.storage_path);
    if (!heroBlob) {
      throw new Error("Final render hero image could not be downloaded for view generation.");
    }
    const bytes = Buffer.from(await heroBlob.arrayBuffer());
    const { data: signedHero } = await serviceSupabase.storage
      .from("generated-renders")
      .createSignedUrl(heroAsset.storage_path, SIGNED_URL_TTL_SECONDS);
    heroImage = { bytes, signedUrl: signedHero?.signedUrl ?? null, dataUrl: await deps.toVisionDataUrl(bytes, "image/png") };
    return heroImage;
  };

  let roomContext: { roomType: string; conceptTitle: string; conceptDescription: string | null } | null = null;
  const loadRoomContext = async () => {
    if (roomContext) {
      return roomContext;
    }
    const { data: room, error: roomError } = await serviceSupabase.from("rooms").select("room_type").eq("id", job.room_id).maybeSingle();
    if (roomError) {
      throw new Error(`The room could not be read for the view: ${roomError.message}`);
    }
    const { data: concept, error: conceptError } = job.concept_id
      ? await serviceSupabase.from("concepts").select("title, description").eq("id", job.concept_id).maybeSingle()
      : { data: null, error: null };
    if (conceptError) {
      throw new Error(`The concept could not be read for the view: ${conceptError.message}`);
    }
    roomContext = {
      roomType: room?.room_type ?? "living room",
      conceptTitle: concept?.title ?? "Final render",
      conceptDescription: concept?.description ?? null
    };
    return roomContext;
  };

  const loadSourcePhoto = async (assetId: string) => {
    const { data: asset, error: assetError } = await serviceSupabase
      .from("room_assets")
      .select("id, storage_path, mime_type")
      .eq("id", assetId)
      .eq("room_id", job.room_id)
      .maybeSingle();
    // A transient read must not quietly generate an unanchored view under a
    // plan that says it stands at the photograph (correctness review).
    if (assetError) {
      throw new Error(`The anchored photograph could not be read: ${assetError.message}`);
    }
    if (!asset) {
      return null;
    }
    const { data: blob } = await serviceSupabase.storage.from("room-assets").download(asset.storage_path);
    if (!blob) {
      return null;
    }
    const bytes = Buffer.from(await blob.arrayBuffer());
    const { data: signed } = await serviceSupabase.storage.from("room-assets").createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS);
    const mimeType = asset.mime_type ?? "image/jpeg";
    return { bytes, mimeType, url: signed?.signedUrl ?? null, dataUrl: await deps.toVisionDataUrl(bytes, mimeType) };
  };

  const loadProductReferences = async (itemIds: string[]) => {
    if (itemIds.length === 0) {
      return [];
    }
    const { data: items, error: itemsError } = await serviceSupabase
      .from("shopping_list_items")
      .select("id, role_label, product:products(id, name, primary_image_url)")
      .eq("shopping_list_id", job.shopping_list_id ?? "")
      .in("id", itemIds);
    if (itemsError) {
      throw new Error(`The view's product references could not be read: ${itemsError.message}`);
    }
    const byId = new Map((items ?? []).map((item) => [item.id, item]));
    const references = await Promise.all(
      itemIds.map(async (itemId) => {
        const item = byId.get(itemId);
        const product = item?.product as { name: string; primary_image_url: string | null } | null | undefined;
        if (!product?.primary_image_url) {
          return null;
        }
        const image = await deps.fetchImage(product.primary_image_url);
        return image
          ? { name: product.name, roleLabel: item?.role_label ?? null, bytes: image.bytes, mimeType: image.mimeType, url: product.primary_image_url }
          : null;
      })
    );
    return references.filter((reference): reference is NonNullable<typeof reference> => reference !== null);
  };

  // The delivery's own audit row, opened only when there is work to do. The
  // views run in parallel, so the in-flight insert is what is memoised, or
  // two views would each open a row before either insert resolved.
  let viewsJobId: string | null = null;
  let viewsJobOpening: Promise<string | null> | null = null;
  const ensureViewsJob = () => {
    viewsJobOpening ??= (async () => {
      const { data: viewsJob } = await serviceSupabase
        .from("ai_jobs")
        .insert({
          user_id: userId,
          room_id: job.room_id,
          job_type: FINAL_RENDER_VIEWS_JOB_TYPE,
          status: "running",
          provider: configuredImageProvider(),
          model: configuredImageModel(),
          input_summary: { renderJobId: job.id, viewKeys: plan.views.map((view) => view.key), legacy }
        })
        .select("id")
        .single();
      viewsJobId = viewsJob?.id ?? null;
      return viewsJobId;
    })();
    return viewsJobOpening;
  };

  let deliveryCredits: number | null = null;
  let deliveryTextCost: number | null = null;
  const deliveryErrors: string[] = [];

  const processView = async (view: PlannedView): Promise<ViewState> => {
    const rows = rowsFor(view.key);
    const succeeded = rows.find((row) => row.status === "succeeded");
    if (succeeded) {
      const out = summaryOf(succeeded.output_summary);
      const assetId = typeof out.assetId === "string" ? out.assetId : null;
      const outcome = out.outcome as ViewConsistencyOutcome | undefined;
      if (assetId && outcome) {
        return { kind: "terminal", outcome, assetId };
      }
      return { kind: "not_terminal", why: "succeeded row without an asset" };
    }

    let nowMs = deps.now();
    let running = rows.filter((row) => row.status === "running");
    const live = running.find((row) => Number(summaryOf(row.input_summary).leaseUntil ?? 0) > nowMs);
    if (live) {
      // Another delivery holds the lease. If it is alive it will finish; if it
      // died, its lease lapses within the view's own worst case. Waiting it out
      // inside this attempt's budget, then reclaiming, is what lets a
      // redelivery repair a dead delivery's views instead of spending an
      // attempt on a lease it cannot touch.
      const waitMs = Number(summaryOf(live.input_summary).leaseUntil) - nowMs + 1_000;
      if (remainingMs() - waitMs < VIEW_START_RESERVE_MS) {
        return { kind: "not_terminal", why: "another delivery holds the lease" };
      }
      await deps.sleep(waitMs);
      nowMs = deps.now();
      const { data: after } = await serviceSupabase
        .from("ai_jobs")
        .select("id, status, created_at, input_summary, output_summary")
        .eq("id", live.id)
        .maybeSingle();
      const afterRow = after as ViewCheckRow | null;
      if (afterRow?.status === "succeeded") {
        const out = summaryOf(afterRow.output_summary);
        const assetId = typeof out.assetId === "string" ? out.assetId : null;
        const outcome = out.outcome as ViewConsistencyOutcome | undefined;
        if (assetId && outcome) {
          return { kind: "terminal", outcome, assetId };
        }
        return { kind: "not_terminal", why: "succeeded row without an asset" };
      }
      if (afterRow?.status === "running" && Number(summaryOf(afterRow.input_summary).leaseUntil ?? 0) > nowMs) {
        // The holder extended its lease: it is alive and working.
        return { kind: "not_terminal", why: "another delivery holds the lease" };
      }
      running = afterRow?.status === "running" ? [afterRow] : [];
    }
    let recovered: { assetId: string; assetPath: string } | null = null;
    for (const expired of running) {
      const { data: reclaimed } = await serviceSupabase
        .from("ai_jobs")
        .update({
          status: "failed",
          completed_at: new Date(nowMs).toISOString(),
          error_message: "The view's lease expired before its check closed; reclaimed by a later delivery."
        })
        .eq("id", expired.id)
        .eq("status", "running")
        .select("id");
      if (!reclaimed || reclaimed.length === 0) {
        return { kind: "not_terminal", why: "the expired lease was taken by another delivery" };
      }
      const out = summaryOf(expired.output_summary);
      if (!recovered && typeof out.assetId === "string" && typeof out.assetPath === "string") {
        recovered = { assetId: out.assetId, assetPath: out.assetPath };
      }
    }

    if (legacy) {
      const adopted = viewAssets.find((asset) => asset.storage_path === legacyPathFor(view.key));
      if (adopted) {
        return { kind: "terminal", outcome: "unchecked", assetId: adopted.id, legacy: true };
      }
    }

    if (remainingMs() < VIEW_START_RESERVE_MS) {
      // Opened even when nothing can start, so the audit shows this delivery
      // ran and why the set is short (tests review).
      await ensureViewsJob();
      return { kind: "not_terminal", why: "no time left in this attempt to start the view" };
    }

    const leaseUntil = Math.min(deps.now() + VIEW_LEASE_MS, deadlineAt + VIEW_LEASE_GRACE_MS);
    // The image call is bounded by the lease as well as the attempt: a provider
    // slower than the lease would otherwise still be generating when a later
    // delivery reclaims the lease and pays for the same view again (Codex).
    let leaseUntilMs = leaseUntil;
    const leaseRemainingMs = () => Math.max(0, leaseUntilMs - deps.now() - VIEW_LEASE_GRACE_MS);
    // Every paid call of this view, and the retry reserve, see the SMALLER of
    // the attempt's time and the lease's: nothing this delivery pays for can
    // outlive the lease a reclaimer could take (Codex, round 2).
    const viewRemainingMs = () => Math.min(remainingMs(), leaseRemainingMs());
    const leaseSummary = {
      renderJobId: job.id,
      viewKey: view.key,
      leaseUntil,
      legacy,
      sourcePhotoAssetId: view.sourcePhotoAssetId,
      mustShow: view.mustShow,
      referenceItemIds: view.referenceItemIds,
      recoveredAssetId: recovered?.assetId ?? null
    };
    const { data: lease, error: leaseError } = await serviceSupabase
      .from("ai_jobs")
      .insert({
        user_id: userId,
        room_id: job.room_id,
        job_type: RENDER_VIEW_CHECK_JOB_TYPE,
        status: "running",
        provider: "openai",
        model: "view_consistency",
        input_summary: leaseSummary
      })
      .select("id")
      .single();
    if (leaseError?.code === "23505") {
      return { kind: "not_terminal", why: "a concurrent delivery opened the lease first" };
    }
    if (leaseError || !lease) {
      console.error(`Final render ${job.id}: could not open the lease for view ${view.key} (${leaseError?.message ?? "no row returned"}).`);
      return { kind: "not_terminal", why: "the lease row could not be opened" };
    }
    await ensureViewsJob();

    let spentCredits: number | null = null;
    let spentTextCost: number | null = null;
    try {
      const hero = await loadHero();
      const context = await loadRoomContext();
      const sourcePhoto = view.sourcePhotoAssetId ? await loadSourcePhoto(view.sourcePhotoAssetId) : null;
      const productReferences = await loadProductReferences(view.referenceItemIds);

      const generate = async (promptSuffix: string | null): Promise<ViewImage> => {
        if (promptSuffix === null && recovered) {
          const { data: blob } = await serviceSupabase.storage.from("generated-renders").download(recovered.assetPath);
          if (blob) {
            return { assetId: recovered.assetId, assetPath: recovered.assetPath, bytes: Buffer.from(await blob.arrayBuffer()), credits: null, recovered: true };
          }
        }
        const generated = await deps.generateView({
          roomType: context.roomType,
          viewKey: view.key,
          conceptTitle: context.conceptTitle,
          conceptDescription: context.conceptDescription,
          heroImageBytes: hero.bytes,
          heroImageMimeType: "image/png",
          heroImageUrl: hero.signedUrl,
          sourcePhoto: sourcePhoto ? { bytes: sourcePhoto.bytes, mimeType: sourcePhoto.mimeType, url: sourcePhoto.url } : null,
          productReferences,
          focalLabel,
          mustShowLabels: view.mustShowLabels,
          purpose: view.purpose,
          promptSuffix,
          deadlineMs: viewRemainingMs()
        });
        // Counted the moment the provider answered: an upload or asset insert
        // that fails after this still closes the row with the spend (Codex).
        spentCredits = addCredits(spentCredits, generated.imageCreditsUsed);
        const bytes = Buffer.from(generated.imageBase64, "base64");
        const assetPath = `${viewPrefix}${view.key}-${deps.nonce()}.png`;
        const { error: uploadError } = await serviceSupabase.storage
          .from("generated-renders")
          .upload(assetPath, bytes, { contentType: "image/png", upsert: false });
        if (uploadError) {
          throw new Error(uploadError.message);
        }
        const { data: asset, error: assetError } = await serviceSupabase
          .from("room_assets")
          .insert({
            room_id: job.room_id,
            asset_type: "final_render",
            storage_path: assetPath,
            mime_type: "image/png",
            is_primary: false,
            view_key: view.key
          })
          .select("id")
          .single();
        if (assetError || !asset) {
          throw new Error(assetError?.message ?? "Final render view asset insert returned no row.");
        }
        // Recorded before the check so a crash from here leaves a recoverable
        // asset, and the lease is extended for the check and a possible retry.
        const extendedUntil = Math.min(deps.now() + VIEW_LEASE_EXTENSION_MS, deadlineAt + VIEW_LEASE_GRACE_MS);
        const { data: extended, error: extendError } = await serviceSupabase
          .from("ai_jobs")
          .update({
            output_summary: { assetId: asset.id, assetPath },
            input_summary: { ...leaseSummary, leaseUntil: extendedUntil }
          })
          .eq("id", lease.id)
          .eq("status", "running")
          .select("id");
        // The extension must land before anything else is paid for: a lease
        // already reclaimed means another delivery owns the view now, and the
        // asset just recorded is what it will check (Codex, round 2).
        if (extendError) {
          throw new Error(`The view's lease could not be extended: ${extendError.message}`);
        }
        if (!extended || extended.length === 0) {
          throw new Error("The view's lease was reclaimed before its generation landed; the reclaiming delivery checks the asset.");
        }
        leaseUntilMs = extendedUntil;
        return { assetId: asset.id, assetPath, bytes, credits: generated.imageCreditsUsed, recovered: false };
      };

      // The focal label as the judge sees and echoes it: the composed entry the
      // plan put in this view's expected list (the focal element with its
      // carrier pieces), never the bare one, or the verdict's "focal
      // expectation missing" comparison could never match (review finding).
      const focalIndex = plan.coverage.focalToken ? view.mustShow.indexOf(plan.coverage.focalToken) : -1;
      // A view not carrying the focal token is not judged against the focal
      // element at all (a detail crop cannot show the TV wall).
      const viewFocalLabel = focalIndex >= 0 ? (view.mustShowLabels[focalIndex] ?? focalLabel) : null;

      const assess = async (image: ViewImage) => {
        if (viewRemainingMs() < MIN_TEXT_CALL_MS) {
          throw new Error("No time left in the attempt to check the view.");
        }
        const result = await deps.assessView({
          roomType: context.roomType,
          viewKey: view.key,
          heroImageDataUrl: hero.dataUrl,
          viewImageDataUrl: await deps.toVisionDataUrl(image.bytes, "image/png"),
          anchorPhotoDataUrl: sourcePhoto?.dataUrl ?? null,
          expectedLabels: view.mustShowLabels,
          hiddenLabels: heroHiddenLabels,
          designLabels: plan.designLabels,
          focalLabel: viewFocalLabel,
          timeoutMs: Math.max(1_000, Math.min(VIEW_CONSISTENCY_TIMEOUT_MS, viewRemainingMs()))
        });
        spentTextCost = addCost(spentTextCost, result.textCostUsd ?? null);
        return { check: result.check, textCostUsd: result.textCostUsd ?? null };
      };

      const enforced = await enforceViewConsistency<ViewImage, { check: AssessViewConsistencyResult["check"]; textCostUsd: number | null }>({
        generate,
        assess,
        correction: viewConsistencyCorrectionLanguage,
        remainingMs: viewRemainingMs,
        creditsOf: (image) => image.credits,
        focalLabel: viewFocalLabel
      });
      deliveryCredits = enforced.imageCreditsUsed === null ? deliveryCredits : (deliveryCredits ?? 0) + enforced.imageCreditsUsed;
      deliveryTextCost =
        enforced.textCostUsd === null ? deliveryTextCost : Math.round(((deliveryTextCost ?? 0) + enforced.textCostUsd) * 10_000) / 10_000;

      const closePayload = {
        status: "succeeded" as const,
        completed_at: new Date(deps.now()).toISOString(),
        cost_estimate_usd: viewCostUsd(enforced.imageCreditsUsed, enforced.textCostUsd),
        output_summary: {
          viewKey: view.key,
          outcome: enforced.outcome,
          assetId: enforced.image.assetId,
          assetPath: enforced.image.assetPath,
          recovered: enforced.image.recovered,
          regenerated: enforced.regenerated,
          verdicts: enforced.verdicts,
          issues: enforced.issues,
          reason: enforced.reason,
          error: enforced.error,
          check: enforced.assessment?.check ?? null,
          anchoredPhotoAssetId: sourcePhoto ? view.sourcePhotoAssetId : null,
          productReferenceCount: productReferences.length
        }
      };
      // A transient error on the close is retried once, the way closeAiJob
      // does: only a clean write that matches no row means the lease was
      // reclaimed by another delivery, whose row then decides.
      let closed: Array<{ id: string }> | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { data, error } = await serviceSupabase
          .from("ai_jobs")
          .update(closePayload)
          .eq("id", lease.id)
          .eq("status", "running")
          .select("id");
        if (!error) {
          closed = data ?? [];
          break;
        }
        console.error(`Final render ${job.id}: closing the check row for ${view.key} failed (${error.message}); retrying once.`);
      }
      if (closed === null) {
        // The row stays running until its lease lapses; the next delivery
        // reclaims it and checks the recorded asset without regenerating.
        return { kind: "not_terminal", why: "the check row could not be closed" };
      }
      if (closed.length === 0) {
        return { kind: "not_terminal", why: "the lease was reclaimed before the check closed" };
      }
      return { kind: "terminal", outcome: enforced.outcome, assetId: enforced.image.assetId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Final render view generation failed.";
      console.error(`Final render view generation failed (${view.key}, render ${job.id}):`, error);
      deliveryErrors.push(`${view.key}: ${message}`);
      // The spend up to the failure stays on the audit row and in the views job.
      deliveryCredits = spentCredits === null ? deliveryCredits : (deliveryCredits ?? 0) + spentCredits;
      deliveryTextCost = spentTextCost === null ? deliveryTextCost : Math.round(((deliveryTextCost ?? 0) + spentTextCost) * 10_000) / 10_000;
      await closeAiJob(
        serviceSupabase,
        lease.id,
        {
          status: "failed",
          completed_at: new Date(deps.now()).toISOString(),
          error_message: message,
          cost_estimate_usd: viewCostUsd(spentCredits, spentTextCost),
          output_summary: { viewKey: view.key, imageCreditsUsed: spentCredits, textCostUsd: spentTextCost }
        },
        "final render view"
      );
      return { kind: "not_terminal", why: message };
    }
  };

  const states = await Promise.all(plan.views.map((view) => processView(view)));
  let outcomes: ViewOutcomeSummary = {};
  const notTerminal: string[] = [];
  plan.views.forEach((view, index) => {
    const state = states[index];
    if (state.kind === "terminal") {
      outcomes[view.key] = { outcome: state.outcome, assetId: state.assetId, ...(state.legacy ? { legacy: true } : {}) };
    } else {
      notTerminal.push(`${view.key}: ${state.why}`);
    }
  });
  let complete = states.every((state) => state.kind === "terminal");

  if (viewsJobId) {
    await closeAiJob(
      serviceSupabase,
      viewsJobId,
      {
        status: complete ? "succeeded" : "failed",
        completed_at: new Date(deps.now()).toISOString(),
        error_message: complete ? null : Array.from(new Set([...deliveryErrors, ...notTerminal])).join("; "),
        cost_estimate_usd: viewCostUsd(deliveryCredits, deliveryTextCost),
        output_summary: { renderJobId: job.id, outcomes, notTerminal, legacy }
      },
      "final render views"
    );
  }

  // The asset list: hero, then each planned view's winner that the reveal may
  // show, in plan order, under the version that was read. A write that
  // matches no row means another delivery wrote first: re-read, merge its
  // recorded outcomes with this delivery's (one succeeded row per key makes
  // the union conflict-free), recompute the list and the completeness, retry.
  const orderedAssetIds = (map: ViewOutcomeSummary) =>
    plan.views
      .map((view) => map[view.key])
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry) && displayableViewOutcome(entry?.outcome))
      .map((entry) => entry.assetId);
  let currentSummary = summary;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const version = typeof currentSummary.viewsVersion === "number" ? currentSummary.viewsVersion : null;
    const update = serviceSupabase
      .from("render_jobs")
      .update({
        output_asset_ids: [heroAssetId, ...orderedAssetIds(outcomes)],
        input_summary: { ...currentSummary, viewsVersion: (version ?? 0) + 1, viewOutcomes: outcomes, viewsComplete: complete }
      })
      .eq("id", job.id)
      .eq("status", "succeeded");
    const { data: written, error: writeError } = await (version === null
      ? update.is("input_summary->>viewsVersion", null)
      : update.eq("input_summary->>viewsVersion", String(version))
    ).select("id");
    // A DB error is not "another delivery wrote first": every view is terminal
    // on its own row, so a redelivery recomputes and rewrites the list
    // (correctness review).
    if (writeError) {
      throw new Error(`The final render's asset list could not be written: ${writeError.message}`);
    }
    if (written && written.length > 0) {
      break;
    }
    const { data: fresh, error: freshError } = await serviceSupabase
      .from("render_jobs")
      .select("id, room_id, concept_id, status, output_asset_ids, input_summary")
      .eq("id", job.id)
      .maybeSingle();
    if (freshError) {
      throw new Error(`The final render job could not be re-read after a version miss: ${freshError.message}`);
    }
    if (!fresh || fresh.status !== "succeeded") {
      break;
    }
    currentSummary = summaryOf(fresh.input_summary);
    const recorded = summaryOf(currentSummary.viewOutcomes) as ViewOutcomeSummary;
    outcomes = { ...recorded, ...outcomes };
    complete = plan.views.every((view) => Boolean(outcomes[view.key]));
  }

  return { complete };
}
