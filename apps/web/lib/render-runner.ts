import { randomUUID } from "node:crypto";

import {
  assessRenderSpatialQuality,
  CAMERA_READ_TIMEOUT_MS,
  evolinkCreditsToUsd,
  generateFinalGroundedRender,
  readRoomCameraFacts,
  SPATIAL_QA_TIMEOUT_MS,
  spatialQaCorrectionLanguage,
  sumImagePlusTextUsd,
  type AssessRenderSpatialQualityInput,
  type AssessRenderSpatialQualityResult,
  type GenerateFinalGroundedRenderInput,
  type GenerateFinalGroundedRenderResult,
  type ReadRoomCameraFactsInput,
  type ReadRoomCameraFactsResult
} from "@ritzy-studio/ai";
import {
  fallbackCameraRead,
  focalElementLabel,
  planViews,
  sourcingRolesFromDesignSpec,
  type RoomCameraRead,
  type ViewPlan
} from "@ritzy-studio/domain";

import { finalRenderAttemptBudgetMs } from "@/lib/render";
import { fetchRemoteImage, visionImageDataUrl } from "@/lib/render-images";
import { FinalRenderInputError, loadFinalRenderInputs, type LoadedFinalRenderInputs } from "@/lib/render-inputs";
import { enforceSpatialQa, type SpatialQaAssessment, type SpatialQaOutcome } from "@/lib/render-qa";
import { ensureFinalRenderViews } from "@/lib/render-views";
import { closeAiJob } from "@/lib/services/close-ai-job";
import type { ServiceSupabaseClient } from "@/lib/services/supabase-clients";

// Durable executor for the final grounded render. The server action inserts a `queued`
// render_jobs row and hands ONLY `{ renderJobId }` to this runner — via a Vercel Queues
// consumer on Vercel infra, or an in-request after() task locally (see renderExecutionMode).
// Everything else is re-fetched from the job row and its related tables, so the runner is
// safe to re-invoke at any time: at-least-once delivery is absorbed by the claim CAS, the
// success/failure CAS writes, and attempt-unique storage paths.
//
// S4: the hero is built from every photograph, the confirmed spec's preservation contract
// and the selected products in priority order (lib/render-inputs); a camera read on each
// hero image feeds both the spatial QA (which is told whether the focal element is in
// frame) and the view planner; the QA loop is the bounded state machine in lib/render-qa;
// and the success write persists the read, the outcome and the view plan the views phase
// executes. Every paid call runs against one absolute attempt deadline.

export const FINAL_RENDER_TOPIC = "final-render";

export type FinalRenderQueueMessage = {
  renderJobId: string;
};

export type RenderRunAttempt = { mode: "inline" } | { mode: "queue"; deliveryCount: number };

// Queue redeliveries retry the whole render; cap the spend on a persistently failing job.
// The consumer's retry callback acknowledges at the same threshold as a backstop.
export const FINAL_RENDER_MAX_QUEUE_ATTEMPTS = 3;

// Deterministic pre-render failures (missing selection, deleted room/concept/photo) must not
// burn queue retries: they fail the job immediately in both modes.
class FinalRenderValidationError extends Error {}

// Everything the runner needs from outside, injectable so the runner can be exercised
// against the recording Supabase double without `server-only`, `next/cache`, sharp or a
// provider in the test's module graph. Production callers pass nothing.
export type FinalRenderRunnerDeps = {
  createServiceClient: () => Promise<ServiceSupabaseClient>;
  revalidatePath: (path: string) => Promise<void>;
  now: () => number;
  render: (input: GenerateFinalGroundedRenderInput) => Promise<GenerateFinalGroundedRenderResult>;
  readCamera: (input: ReadRoomCameraFactsInput) => Promise<ReadRoomCameraFactsResult>;
  assessQa: (input: AssessRenderSpatialQualityInput) => Promise<AssessRenderSpatialQualityResult>;
  fetchImage: (url: string) => Promise<{ bytes: Buffer; mimeType: string } | null>;
  toVisionDataUrl: (bytes: Buffer, mimeType: string) => Promise<string>;
  ensureViews: (input: {
    serviceSupabase: ServiceSupabaseClient;
    renderJobId: string;
    deadlineAt: number;
    now: () => number;
  }) => Promise<{ complete: boolean }>;
};

async function defaultServiceClient(): Promise<ServiceSupabaseClient> {
  // Dynamic import keeps `server-only` off the runner test's module graph; the queue SDK
  // below is loaded the same way for the same reason.
  const { createServiceClient } = await import("@/lib/supabase/service");
  return createServiceClient();
}

async function defaultRevalidatePath(path: string): Promise<void> {
  const { revalidatePath } = await import("next/cache");
  revalidatePath(path);
}

function resolveDeps(overrides: Partial<FinalRenderRunnerDeps> | undefined): FinalRenderRunnerDeps {
  return {
    createServiceClient: defaultServiceClient,
    revalidatePath: defaultRevalidatePath,
    now: () => Date.now(),
    render: generateFinalGroundedRender,
    readCamera: readRoomCameraFacts,
    assessQa: assessRenderSpatialQuality,
    fetchImage: fetchRemoteImage,
    toVisionDataUrl: visionImageDataUrl,
    ensureViews: ({ serviceSupabase, renderJobId, deadlineAt, now }) =>
      ensureFinalRenderViews({ serviceSupabase, renderJobId, deadlineAt, now }),
    ...overrides
  };
}

// The reveal page self-refreshes every 12s (RenderRefresh), so revalidation is a freshness
// optimization, never a correctness requirement — and it must never fail a render that has
// already committed. revalidatePath also throws outright when no request store exists
// (e.g. direct runner invocations from scripts/tests).
async function safeRevalidatePath(deps: FinalRenderRunnerDeps, path: string) {
  try {
    await deps.revalidatePath(path);
  } catch (error) {
    console.warn(`revalidatePath failed for ${path}; the reveal poll will pick up the change.`, error);
  }
}

export async function enqueueFinalRender(renderJobId: string): Promise<void> {
  // Dynamic import keeps the beta SDK off every actions.ts consumer's module graph; only the
  // queue execution path loads it.
  const { send } = await import("@vercel/queue");
  await send<FinalRenderQueueMessage>(FINAL_RENDER_TOPIC, { renderJobId });
}

type FinalRenderJobInputSummary = {
  selectionKey?: string;
  selectedShoppingItemIds?: string[];
  productCount?: number;
  conceptTitle?: string;
  userId?: string;
  revealPath?: string;
  executionPath?: string;
};

// What the hero's assessment carries besides the QA verdict: the camera read that fed it
// (or why there is none), so the plan is computed from the kept hero's facts.
type HeroAssessment = SpatialQaAssessment & {
  cameraRead: RoomCameraRead | null;
  cameraReadError: string | null;
  cameraReadCostUsd: number | null;
};

export async function runFinalRender(
  {
    renderJobId,
    attempt
  }: {
    renderJobId: string;
    attempt: RenderRunAttempt;
  },
  depsOverride?: Partial<FinalRenderRunnerDeps>
): Promise<void> {
  const deps = resolveDeps(depsOverride);
  const serviceSupabase = await deps.createServiceClient();

  const { data: job, error: jobError } = await serviceSupabase
    .from("render_jobs")
    .select("id, room_id, concept_id, shopping_list_id, status, input_summary, created_at")
    .eq("id", renderJobId)
    .maybeSingle();

  if (jobError) {
    throw new Error(jobError.message);
  }
  if (!job) {
    console.error(`Final render runner: render job ${renderJobId} not found; dropping.`);
    return;
  }

  // Failed jobs are terminal: a redelivery after a stale-reclaim must never resurrect them.
  if (job.status === "failed") {
    return;
  }

  // One absolute deadline for the whole attempt, in the mode the runner was invoked in.
  const attemptStartedAt = deps.now();
  const deadlineAt = attemptStartedAt + finalRenderAttemptBudgetMs(attempt.mode === "queue" ? "queue" : "inline");
  const remainingMs = () => Math.max(0, deadlineAt - deps.now());

  // A succeeded job on redelivery means the hero committed but the delivery died before (or
  // during) the planned views — repair ONLY what is missing. The views phase is idempotent
  // (attempt-unique view paths, lease rows per view, recomputed output_asset_ids), so a
  // duplicate delivery after full success is a no-op.
  if (job.status === "succeeded") {
    const summary = ((job.input_summary ?? {}) as FinalRenderJobInputSummary) ?? {};
    await runViewsPhase({
      deps,
      serviceSupabase,
      renderJobId: job.id,
      attempt,
      deadlineAt,
      revealPath: typeof summary.revealPath === "string" ? summary.revealPath : null
    });
    return;
  }

  if (job.status !== "queued" && job.status !== "running") {
    return;
  }

  // Claim: only proceed while the job is still live. `running` is deliberately claimable —
  // a redelivery racing a presumed-dead attempt is the designed recovery path; the success
  // CAS below guarantees at most one attempt ever commits.
  const { data: claimedRows, error: claimError } = await serviceSupabase
    .from("render_jobs")
    .update({ status: "running" })
    .eq("id", renderJobId)
    .in("status", ["queued", "running"])
    .select("id");

  if (claimError) {
    throw new Error(claimError.message);
  }
  if (!claimedRows || claimedRows.length === 0) {
    return;
  }

  const inputSummary = ((job.input_summary ?? {}) as FinalRenderJobInputSummary) ?? {};
  let revealPath = typeof inputSummary.revealPath === "string" ? inputSummary.revealPath : null;

  try {
    const selectedShoppingItemIds = Array.isArray(inputSummary.selectedShoppingItemIds)
      ? inputSummary.selectedShoppingItemIds.filter((id): id is string => typeof id === "string")
      : [];
    if (selectedShoppingItemIds.length === 0) {
      throw new FinalRenderValidationError("Final render job is missing its product selection.");
    }
    if (!job.concept_id) {
      throw new FinalRenderValidationError("Final render job is missing its concept.");
    }

    const { data: room } = await serviceSupabase
      .from("rooms")
      .select("id, room_type, project_id")
      .eq("id", job.room_id)
      .maybeSingle();
    if (!room) {
      throw new FinalRenderValidationError("Final render job's room no longer exists.");
    }
    revealPath ??= `/projects/${room.project_id}/rooms/${job.room_id}/presentation`;

    let userId = typeof inputSummary.userId === "string" ? inputSummary.userId : null;
    if (!userId) {
      const { data: project } = await serviceSupabase
        .from("projects")
        .select("owner_user_id")
        .eq("id", room.project_id)
        .maybeSingle();
      userId = project?.owner_user_id ?? null;
    }
    if (!userId) {
      throw new FinalRenderValidationError("Final render job's owner could not be resolved.");
    }

    let loaded: LoadedFinalRenderInputs;
    try {
      loaded = await loadFinalRenderInputs({
        serviceSupabase,
        roomId: job.room_id,
        roomType: room.room_type,
        conceptId: job.concept_id,
        selectedShoppingItemIds,
        fetchImage: deps.fetchImage
      });
    } catch (error) {
      throw error instanceof FinalRenderInputError ? new FinalRenderValidationError(error.message) : error;
    }

    const focalLabel = focalElementLabel(loaded.focalPoint);
    const keyRoles = loaded.spec
      ? sourcingRolesFromDesignSpec(loaded.spec, room.room_type).roles.map((role) => ({ key: role.specKey, label: role.specLabel }))
      : loaded.products.map((product) => ({ key: product.specKey ?? product.itemId, label: product.roleLabel }));
    const photoDataUrls = await Promise.all(
      loaded.photos.map(async (photo) => ({ assetId: photo.assetId, dataUrl: await deps.toVisionDataUrl(photo.bytes, photo.mimeType) }))
    );
    const spatialIntentPrompt = {
      focalPoint: loaded.spatialIntent.focalPoint,
      seatingPriority: loaded.spatialIntent.seatingPriority,
      diningSeatCount: loaded.spatialIntent.diningSeatCount,
      mustKeepClear: loaded.spatialIntent.mustKeepClear
    };

    // The camera read on a hero image, on its own audit row (no row, no call), then the
    // spatial QA told what the read found. Both bounded by what is left of the attempt.
    // The last completed read is kept outside the assessment so a QA call that throws
    // after a paid, successful read does not cost the plan that read.
    let latestRead: { cameraRead: RoomCameraRead | null; cameraReadError: string | null } = {
      cameraRead: null,
      cameraReadError: null
    };
    const assessHero = async (render: GenerateFinalGroundedRenderResult): Promise<HeroAssessment> => {
      const heroDataUrl = await deps.toVisionDataUrl(Buffer.from(render.imageBase64, "base64"), "image/png");
      let cameraRead: RoomCameraRead | null = null;
      let cameraReadError: string | null = null;
      let cameraReadCostUsd: number | null = null;
      const { data: readJob, error: readJobError } = await serviceSupabase
        .from("ai_jobs")
        .insert({
          user_id: userId,
          room_id: job.room_id,
          job_type: "render_camera_read",
          status: "running",
          provider: "openai",
          model: "camera_read",
          input_summary: { renderJobId: job.id, photoAssetIds: loaded.photos.map((photo) => photo.assetId) }
        })
        .select("id")
        .single();
      if (readJobError || !readJob) {
        cameraReadError = `The camera read's audit row could not be opened (${readJobError?.message ?? "no row returned"}); the read was not made.`;
      } else {
        try {
          const read = await deps.readCamera({
            roomType: room.room_type,
            focalPoint: loaded.focalPoint,
            focalLabel,
            heroImageDataUrl: heroDataUrl,
            photos: photoDataUrls,
            keyRoles,
            timeoutMs: Math.max(1_000, Math.min(CAMERA_READ_TIMEOUT_MS, remainingMs()))
          });
          cameraRead = read.read;
          cameraReadCostUsd = read.textCostUsd ?? null;
          await closeAiJob(
            serviceSupabase,
            readJob.id,
            {
              status: "succeeded",
              completed_at: new Date(deps.now()).toISOString(),
              model: read.model,
              prompt_version: read.promptVersion,
              cost_estimate_usd: read.textCostUsd ?? null,
              output_summary: { read: read.read }
            },
            "camera read"
          );
        } catch (error) {
          cameraReadError = error instanceof Error ? error.message : "The camera read failed.";
          await closeAiJob(
            serviceSupabase,
            readJob.id,
            { status: "failed", completed_at: new Date(deps.now()).toISOString(), error_message: cameraReadError },
            "camera read"
          );
        }
      }
      latestRead = { cameraRead, cameraReadError };
      const facts = { focalElementInFrame: cameraRead?.hero.showsFocalElement ?? null };
      const qa = await deps.assessQa({
        imageUrl: heroDataUrl,
        roomType: room.room_type,
        spatialIntent: spatialIntentPrompt,
        cameraFacts: { focalElementInFrame: facts.focalElementInFrame, focalLabel },
        timeoutMs: Math.max(1_000, Math.min(SPATIAL_QA_TIMEOUT_MS, remainingMs()))
      });
      return { qa: qa.qa, facts, textCostUsd: qa.textCostUsd ?? null, cameraRead, cameraReadError, cameraReadCostUsd };
    };

    // Post-render spatial QA: the bounded state machine. A review that cannot run never
    // fails the render; its outcome is recorded and shown instead.
    const enforced = await enforceSpatialQa<GenerateFinalGroundedRenderResult, HeroAssessment>({
      render: (promptSuffix) => deps.render(loaded.renderInput({ imageDeadlineMs: remainingMs(), promptSuffix })),
      assess: assessHero,
      correction: spatialQaCorrectionLanguage,
      remainingMs,
      creditsOf: (render) => render.imageCreditsUsed
    });
    const result = enforced.result;
    const renderQaOutcome: SpatialQaOutcome = enforced.outcome;
    const renderQaVerdict = enforced.assessment?.qa.verdict ?? null;
    if (enforced.outcome === "unreviewed") {
      console.error("Final render spatial QA failed; shipping unreviewed render.", enforced.error);
    }

    // The view plan, from the KEPT hero's read; when the review could not run, from the
    // last read that completed (it judged the render that was kept). A missing read (the
    // call failed, or its audit row could not be opened) is the conservative fallback,
    // never an inference.
    const cameraRead = enforced.assessment?.cameraRead ?? latestRead.cameraRead ?? fallbackCameraRead(loaded.photos);
    const cameraReadError = enforced.assessment?.cameraReadError ?? latestRead.cameraReadError;
    const viewPlan: ViewPlan = planViews({
      roomType: room.room_type,
      focalPoint: loaded.focalPoint,
      spec: loaded.spec,
      heroPhotoAssetId: loaded.photos[0]?.assetId ?? null,
      photos: loaded.photos,
      cameraRead,
      products: loaded.products.map((product) => ({
        itemId: product.itemId,
        specKey: product.specKey,
        category: product.category,
        label: product.roleLabel
      })),
      heroReferenceCap: loaded.heroReferenceCap
    });

    // Attempt-unique storage path: two deliveries of the same job must never share an object,
    // or the CAS loser's upload would overwrite the committed winner's PNG in place.
    const attemptNonce = randomUUID().slice(0, 8);
    const renderPath = `${userId}/${job.room_id}/final-${job.id}-${attemptNonce}.png`;
    const { error: uploadError } = await serviceSupabase.storage
      .from("generated-renders")
      .upload(renderPath, Buffer.from(result.imageBase64, "base64"), {
        contentType: "image/png",
        upsert: true
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: renderAsset, error: renderAssetError } = await serviceSupabase
      .from("room_assets")
      .insert({
        room_id: job.room_id,
        asset_type: "final_render",
        storage_path: renderPath,
        mime_type: "image/png",
        is_primary: false
      })
      .select("id")
      .single();

    if (renderAssetError) {
      throw new Error(renderAssetError.message);
    }

    // Only record success if THIS job is still running. If a stale-retry reclaimed it (flipped
    // it to failed) while we were rendering, the `.eq("status", "running")` filter matches no
    // rows — do not resurrect the reclaimed job (that would duplicate work and leave two
    // succeeded jobs for one selection); discard the render we just produced instead.
    const { data: completedRows, error: completeError } = await serviceSupabase
      .from("render_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date(deps.now()).toISOString(),
        prompt_key: result.promptKey,
        prompt_version: result.promptVersion,
        model: result.imageModel,
        output_asset_ids: [renderAsset.id],
        input_summary: {
          ...inputSummary,
          productCount: loaded.products.length,
          productImageReferencesUsed: loaded.products.slice(0, loaded.heroReferenceCap).filter((product) => product.imageBytes).length,
          roomPhotoCount: loaded.photos.length,
          preservationContract: loaded.spec ? loaded.spec.mustPreserve.length : 0,
          revisedPrompt: result.revisedPrompt ?? null,
          imageProvider: result.imageProvider,
          imageModel: result.imageModel,
          imagePromptVersion: result.promptVersion,
          imageLatencySeconds: result.imageLatencySeconds,
          imageFallbackUsed: result.imageFallbackUsed,
          imageFallbackError: result.imageFallbackError ?? null,
          spatialQaVerdict: renderQaVerdict,
          spatialQaIssues: enforced.issues,
          spatialQaRegenerated: enforced.regenerated,
          spatialQaOutcome: renderQaOutcome,
          spatialQaReason: enforced.reason,
          spatialQaError: enforced.error,
          spatialQaVerdicts: enforced.verdicts,
          cameraRead,
          cameraReadError,
          viewPlan,
          viewsVersion: 0,
          attemptBudgetMs: deadlineAt - attemptStartedAt,
          // render_jobs has no cost column; the hero's spend (including any discarded QA
          // regen) is recorded here and the views' spend on the final_render_views ai_job.
          // The camera reads carry their own rows.
          imageCreditsUsed: enforced.imageCreditsUsed,
          spatialQaTextCostUsd: enforced.textCostUsd,
          costEstimateUsd: sumImagePlusTextUsd(evolinkCreditsToUsd(enforced.imageCreditsUsed), enforced.textCostUsd)
        }
      })
      .eq("id", job.id)
      .eq("status", "running")
      .select("id");

    // A DB error is NOT a reclamation — only an empty result set (0 rows, no error) means the
    // job was reclaimed. On error, re-throw so the catch handles it; never delete the render
    // we just produced on a transient failure.
    if (completeError) {
      throw new Error(completeError.message);
    }
    if (completedRows.length === 0) {
      await serviceSupabase.storage.from("generated-renders").remove([renderPath]);
      await serviceSupabase.from("room_assets").delete().eq("id", renderAsset.id);
      return;
    }

    await serviceSupabase.from("rooms").update({ status: "rendering" }).eq("id", job.room_id);
    await safeRevalidatePath(deps, revealPath);

    // The hero render is committed and the job is succeeded. Generate the planned views:
    // a view failure never regresses the hero, but in queue mode an incomplete set
    // rethrows so the redelivery repairs the missing views (the succeeded-job branch above).
    await runViewsPhase({ deps, serviceSupabase, renderJobId: job.id, attempt, deadlineAt, revealPath });
  } catch (error) {
    // Queue attempts below the cap rethrow so Vercel Queues redelivers; the job stays `running`
    // and the existing stale-reclaim remains the user-visible safety net in the meantime.
    // Everything else — inline mode (no redelivery exists), the final queue attempt, and
    // deterministic validation failures — resolves the job now.
    const isFinalQueueAttempt =
      attempt.mode === "queue" && attempt.deliveryCount >= FINAL_RENDER_MAX_QUEUE_ATTEMPTS;
    const shouldRetry =
      attempt.mode === "queue" && !isFinalQueueAttempt && !(error instanceof FinalRenderValidationError);
    if (shouldRetry) {
      throw error;
    }

    // Same guard as success: never overwrite a job that was already reclaimed/finalised by
    // another path.
    await serviceSupabase
      .from("render_jobs")
      .update({
        status: "failed",
        completed_at: new Date(deps.now()).toISOString(),
        error_message: error instanceof Error ? error.message : "Final render generation failed."
      })
      .eq("id", job.id)
      .eq("status", "running");
    if (revealPath) {
      await safeRevalidatePath(deps, revealPath);
    }
  }
}

// Views phase wrapper with the queue/inline retry contract. The hero is already committed
// and safe, so a views failure must never fail the job — but in queue mode, an incomplete
// view set below the attempt cap rethrows so Vercel Queues redelivers and the next attempt
// repairs only what is missing. Inline mode keeps today's best-effort behaviour.
async function runViewsPhase({
  deps,
  serviceSupabase,
  renderJobId,
  attempt,
  deadlineAt,
  revealPath
}: {
  deps: FinalRenderRunnerDeps;
  serviceSupabase: ServiceSupabaseClient;
  renderJobId: string;
  attempt: RenderRunAttempt;
  deadlineAt: number;
  revealPath: string | null;
}) {
  let complete = false;
  try {
    complete = (await deps.ensureViews({ serviceSupabase, renderJobId, deadlineAt, now: deps.now })).complete;
  } catch (error) {
    console.error(`Final render view generation failed for job ${renderJobId}.`, error);
  }
  if (revealPath) {
    await safeRevalidatePath(deps, revealPath);
  }
  if (!complete && attempt.mode === "queue" && attempt.deliveryCount < FINAL_RENDER_MAX_QUEUE_ATTEMPTS) {
    throw new Error(
      `Final render ${renderJobId} succeeded but its angle views are incomplete; requesting redelivery.`
    );
  }
}
