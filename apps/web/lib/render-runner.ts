import { randomUUID } from "node:crypto";

import {
  assessRenderSpatialQuality,
  evolinkCreditsToUsd,
  generateFinalGroundedRender,
  generateFinalRenderView,
  spatialQaCorrectionLanguage,
  sumUsdCosts
} from "@ritzy-studio/ai";
import { parseSpatialIntent, sortProductsForRenderReferences } from "@ritzy-studio/domain";
import { revalidatePath } from "next/cache";

import { sumOutcomeCredits } from "@/lib/ai-cost";
import {
  CONCEPT_VIEW_KEYS,
  LOCAL_SKU_FIDELITY_RENDER_REFERENCE_LIMIT,
  localSkuFidelityModeEnabled,
  productReferenceOrderingV2Enabled
} from "@/lib/render-flags";
import {
  configuredImageModel,
  configuredImageProvider,
  fetchRemoteImage,
  visionImageDataUrl
} from "@/lib/render-images";
import { createServiceClient } from "@/lib/supabase/service";

// Durable executor for the final grounded render. The server action inserts a `queued`
// render_jobs row and hands ONLY `{ renderJobId }` to this runner — via a Vercel Queues
// consumer on Vercel infra, or an in-request after() task locally (see renderExecutionMode).
// Everything else is re-fetched from the job row and its related tables, so the runner is
// safe to re-invoke at any time: at-least-once delivery is absorbed by the claim CAS, the
// success/failure CAS writes, and attempt-unique storage paths.

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

// The reveal page self-refreshes every 12s (RenderRefresh), so revalidation is a freshness
// optimization, never a correctness requirement — and it must never fail a render that has
// already committed. revalidatePath also throws outright when no request store exists
// (e.g. direct runner invocations from scripts/tests).
function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
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

export async function runFinalRender({
  renderJobId,
  attempt
}: {
  renderJobId: string;
  attempt: RenderRunAttempt;
}): Promise<void> {
  const serviceSupabase = createServiceClient();

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

  // A succeeded job on redelivery means the hero committed but the delivery died before (or
  // during) the angle views — repair ONLY the missing views. ensureFinalRenderViews is
  // idempotent (deterministic per-view storage paths, asset-row dedupe, recomputed
  // output_asset_ids), so a duplicate delivery after full success is a no-op.
  if (job.status === "succeeded") {
    const summary = ((job.input_summary ?? {}) as FinalRenderJobInputSummary) ?? {};
    await runViewsPhase({
      serviceSupabase,
      renderJobId: job.id,
      attempt,
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

    const { data: concept } = await serviceSupabase
      .from("concepts")
      .select(
        "id, title, description, primary_image_asset:room_assets!concepts_primary_image_asset_id_fkey(*)"
      )
      .eq("id", job.concept_id)
      .eq("room_id", job.room_id)
      .maybeSingle();
    if (!concept) {
      throw new FinalRenderValidationError("Final render job's concept no longer exists.");
    }

    const { data: roomPhoto } = await serviceSupabase
      .from("room_assets")
      .select("*")
      .eq("room_id", job.room_id)
      .eq("asset_type", "room_photo")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!roomPhoto) {
      throw new FinalRenderValidationError("Final render job's room photo no longer exists.");
    }

    const { data: roomBlob, error: roomDownloadError } = await serviceSupabase.storage
      .from("room-assets")
      .download(roomPhoto.storage_path);
    if (roomDownloadError || !roomBlob) {
      throw new Error("The original room photo could not be prepared for final rendering.");
    }

    const conceptImageAsset = Array.isArray(concept.primary_image_asset)
      ? concept.primary_image_asset[0]
      : concept.primary_image_asset;
    const { data: conceptBlob } = conceptImageAsset?.storage_path
      ? await serviceSupabase.storage.from("generated-renders").download(conceptImageAsset.storage_path)
      : { data: null };

    const { data: items = [] } = await serviceSupabase
      .from("shopping_list_items")
      .select(
        `
        *,
        product:products(
          *,
          retailer:retailers(name, status),
          dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
        )
      `
      )
      .in("id", selectedShoppingItemIds)
      .order("sort_order", { ascending: true });

    const selectedProducts = (items ?? []).filter((item) => item.product);
    if (selectedProducts.length === 0) {
      throw new FinalRenderValidationError("Final render job's selected products no longer exist.");
    }

    const productReferencesForRender = productReferenceOrderingV2Enabled()
      ? sortProductsForRenderReferences(selectedProducts, room.room_type)
      : selectedProducts;
    const renderReferenceLimit = localSkuFidelityModeEnabled(room.room_type)
      ? LOCAL_SKU_FIDELITY_RENDER_REFERENCE_LIMIT
      : 8;
    const productsForRender = await Promise.all(
      productReferencesForRender.slice(0, renderReferenceLimit).map(async (item) => {
        const product = item.product!;
        const image = product.primary_image_url ? await fetchRemoteImage(product.primary_image_url) : null;
        const dimensions = formatProductDimensionsForRender(product.dimensions?.[0] ?? null);

        return {
          name: product.name,
          retailerName: product.retailer?.name ?? "Retailer",
          category: item.category,
          roleLabel: item.role_label ?? roleLabelFromSelectionReason(item.selection_reason) ?? item.category,
          visualMatchReason: item.selection_reason,
          description: product.description,
          priceAed: item.unit_price_aed,
          dimensions,
          imageBytes: image?.bytes ?? null,
          imageMimeType: image?.mimeType ?? null,
          imageUrl: product.primary_image_url ?? null
        };
      })
    );
    const { data: signedRoomPhotoForRender } = await serviceSupabase.storage
      .from("room-assets")
      .createSignedUrl(roomPhoto.storage_path, 60 * 30);
    const { data: signedConceptImageForRender } = conceptImageAsset?.storage_path
      ? await serviceSupabase.storage
          .from("generated-renders")
          .createSignedUrl(conceptImageAsset.storage_path, 60 * 30)
      : { data: null };
    const { data: renderDesignBrief } = await serviceSupabase
      .from("design_briefs")
      .select("structured_json")
      .eq("room_id", job.room_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const renderSpatialIntent = parseSpatialIntent(renderDesignBrief?.structured_json, room.room_type);
    const renderSpatialIntentPrompt = {
      focalPoint: renderSpatialIntent.focalPoint,
      seatingPriority: renderSpatialIntent.seatingPriority,
      diningSeatCount: renderSpatialIntent.diningSeatCount,
      mustKeepClear: renderSpatialIntent.mustKeepClear
    };
    const renderInput = {
      roomType: room.room_type,
      spatialIntent: renderSpatialIntentPrompt,
      roomPhotoBytes: Buffer.from(await roomBlob.arrayBuffer()),
      roomPhotoMimeType: roomPhoto.mime_type,
      roomPhotoUrl: signedRoomPhotoForRender?.signedUrl ?? null,
      conceptImageBytes: conceptBlob ? Buffer.from(await conceptBlob.arrayBuffer()) : null,
      conceptImageMimeType: conceptImageAsset?.mime_type ?? null,
      conceptImageUrl: signedConceptImageForRender?.signedUrl ?? null,
      conceptTitle: concept.title,
      conceptDescription: concept.description,
      products: productsForRender
    };
    let result = await generateFinalGroundedRender(renderInput);
    // Total image spend for this attempt, INCLUDING a discarded spatial-QA regen — the
    // discarded generation still consumed credits (review P2).
    let renderImageCreditsUsed = result.imageCreditsUsed;

    // Post-render spatial QA: one corrective retry on a hard fail, then keep
    // the better of the two attempts. QA failure never fails the render.
    let renderQaVerdict: string | null = null;
    let renderQaIssues: string[] = [];
    let renderQaRegenerated = false;
    let renderQaTextCostUsd: number | null = null;
    try {
      let qa = await assessRenderSpatialQuality({
        imageUrl: await visionImageDataUrl(Buffer.from(result.imageBase64, "base64"), "image/png"),
        roomType: room.room_type,
        spatialIntent: renderSpatialIntentPrompt
      });
      renderQaTextCostUsd = sumUsdCosts(renderQaTextCostUsd, qa.textCostUsd);
      if (qa.qa.verdict === "regenerate" && qa.qa.issues.length > 0) {
        const retryResult = await generateFinalGroundedRender({
          ...renderInput,
          promptSuffix: spatialQaCorrectionLanguage([...qa.qa.issues])
        });
        if (typeof retryResult.imageCreditsUsed === "number") {
          renderImageCreditsUsed = (renderImageCreditsUsed ?? 0) + retryResult.imageCreditsUsed;
        }
        const retryQa = await assessRenderSpatialQuality({
          imageUrl: await visionImageDataUrl(Buffer.from(retryResult.imageBase64, "base64"), "image/png"),
          roomType: room.room_type,
          spatialIntent: renderSpatialIntentPrompt
        });
        renderQaTextCostUsd = sumUsdCosts(renderQaTextCostUsd, retryQa.textCostUsd);
        if (retryQa.qa.verdict !== "regenerate") {
          result = retryResult;
          qa = retryQa;
          renderQaRegenerated = true;
        }
      }
      renderQaVerdict = qa.qa.verdict;
      renderQaIssues = [...qa.qa.issues];
    } catch (error) {
      console.error("Final render spatial QA failed; shipping unreviewed render.", error);
    }
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
        completed_at: new Date().toISOString(),
        prompt_key: result.promptKey,
        prompt_version: result.promptVersion,
        model: result.imageModel,
        output_asset_ids: [renderAsset.id],
        input_summary: {
          ...inputSummary,
          productCount: selectedProducts.length,
          productImageReferencesUsed: productsForRender.filter((product) => product.imageBytes).length,
          revisedPrompt: result.revisedPrompt ?? null,
          imageProvider: result.imageProvider,
          imageModel: result.imageModel,
          imagePromptVersion: result.promptVersion,
          imageLatencySeconds: result.imageLatencySeconds,
          imageFallbackUsed: result.imageFallbackUsed,
          imageFallbackError: result.imageFallbackError ?? null,
          spatialQaVerdict: renderQaVerdict,
          spatialQaIssues: renderQaIssues,
          spatialQaRegenerated: renderQaRegenerated,
          // render_jobs has no cost column; the hero's spend (including any discarded QA
          // regen) is recorded here and the views' spend on the final_render_views ai_job.
          imageCreditsUsed: renderImageCreditsUsed,
          spatialQaTextCostUsd: renderQaTextCostUsd,
          costEstimateUsd: sumUsdCosts(evolinkCreditsToUsd(renderImageCreditsUsed), renderQaTextCostUsd)
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
    safeRevalidatePath(revealPath);

    // The hero render is committed and the job is succeeded. Generate the additional camera
    // angles: a view failure never regresses the hero, but in queue mode an incomplete set
    // rethrows so the redelivery repairs the missing views (the succeeded-job branch above).
    await runViewsPhase({ serviceSupabase, renderJobId: job.id, attempt, revealPath });
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
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Final render generation failed."
      })
      .eq("id", job.id)
      .eq("status", "running");
    if (revealPath) {
      safeRevalidatePath(revealPath);
    }
  }
}

// Views phase wrapper with the queue/inline retry contract. The hero is already committed
// and safe, so a views failure must never fail the job — but in queue mode, an incomplete
// view set below the attempt cap rethrows so Vercel Queues redelivers and the next attempt
// repairs only what is missing. Inline mode keeps today's best-effort behaviour.
async function runViewsPhase({
  serviceSupabase,
  renderJobId,
  attempt,
  revealPath
}: {
  serviceSupabase: ReturnType<typeof createServiceClient>;
  renderJobId: string;
  attempt: RenderRunAttempt;
  revealPath: string | null;
}) {
  let complete = false;
  try {
    complete = (await ensureFinalRenderViews({ serviceSupabase, renderJobId })).complete;
  } catch (error) {
    console.error(`Final render view generation failed for job ${renderJobId}.`, error);
  }
  if (revealPath) {
    safeRevalidatePath(revealPath);
  }
  if (!complete && attempt.mode === "queue" && attempt.deliveryCount < FINAL_RENDER_MAX_QUEUE_ATTEMPTS) {
    throw new Error(
      `Final render ${renderJobId} succeeded but its angle views are incomplete; requesting redelivery.`
    );
  }
}

// Generates whatever camera-angle views are still MISSING for a succeeded final render and
// appends them to the job's output_asset_ids (hero stays index 0). Idempotent by construction
// so at-least-once delivery can re-run it safely: view storage paths are deterministic per
// (job, viewKey), existing assets are detected up front (and again on an insert race), and
// output_asset_ids is recomputed rather than appended. Everything is re-derived from the DB —
// no in-memory state from the hero attempt is required, which is what lets a redelivery repair
// views after the original function died.
async function ensureFinalRenderViews({
  serviceSupabase,
  renderJobId
}: {
  serviceSupabase: ReturnType<typeof createServiceClient>;
  renderJobId: string;
}): Promise<{ complete: boolean }> {
  const { data: job } = await serviceSupabase
    .from("render_jobs")
    .select("id, room_id, concept_id, status, output_asset_ids, input_summary")
    .eq("id", renderJobId)
    .maybeSingle();

  const heroAssetId = job?.output_asset_ids?.[0];
  if (!job || job.status !== "succeeded" || !heroAssetId) {
    // Nothing to repair (reclaimed, superseded, or no committed hero) — do not block the ack.
    return { complete: true };
  }

  const summary = ((job.input_summary ?? {}) as FinalRenderJobInputSummary) ?? {};
  let userId = typeof summary.userId === "string" ? summary.userId : null;
  if (!userId) {
    const { data: room } = await serviceSupabase
      .from("rooms")
      .select("project_id")
      .eq("id", job.room_id)
      .maybeSingle();
    const { data: project } = room
      ? await serviceSupabase.from("projects").select("owner_user_id").eq("id", room.project_id).maybeSingle()
      : { data: null };
    userId = project?.owner_user_id ?? null;
  }
  if (!userId) {
    return { complete: true };
  }

  const viewPathFor = (viewKey: string) => `${userId}/${job.room_id}/final-${job.id}-${viewKey}.png`;
  const { data: existingViewAssets } = await serviceSupabase
    .from("room_assets")
    .select("id, storage_path")
    .in(
      "storage_path",
      CONCEPT_VIEW_KEYS.map((viewKey) => viewPathFor(viewKey))
    );
  const viewAssetIdByKey = new Map<string, string>();
  for (const viewKey of CONCEPT_VIEW_KEYS) {
    const existing = (existingViewAssets ?? []).find((asset) => asset.storage_path === viewPathFor(viewKey));
    if (existing) {
      viewAssetIdByKey.set(viewKey, existing.id);
    }
  }
  const missingViewKeys = CONCEPT_VIEW_KEYS.filter((viewKey) => !viewAssetIdByKey.has(viewKey));

  if (missingViewKeys.length > 0) {
    const { data: heroAsset } = await serviceSupabase
      .from("room_assets")
      .select("id, storage_path")
      .eq("id", heroAssetId)
      .maybeSingle();
    if (!heroAsset) {
      return { complete: true };
    }
    const { data: heroBlob } = await serviceSupabase.storage
      .from("generated-renders")
      .download(heroAsset.storage_path);
    if (!heroBlob) {
      throw new Error("Final render hero image could not be downloaded for view generation.");
    }
    const heroImageBytes = Buffer.from(await heroBlob.arrayBuffer());
    const { data: signedHero } = await serviceSupabase.storage
      .from("generated-renders")
      .createSignedUrl(heroAsset.storage_path, 60 * 30);

    const { data: room } = await serviceSupabase
      .from("rooms")
      .select("room_type")
      .eq("id", job.room_id)
      .maybeSingle();
    const { data: concept } = job.concept_id
      ? await serviceSupabase
          .from("concepts")
          .select("title, description")
          .eq("id", job.concept_id)
          .maybeSingle()
      : { data: null };

    // Tracked per attempt so silent failures are observable; only inserted when there is
    // actual work, so duplicate deliveries after full success do not spam ai_jobs.
    const { data: viewsJob } = await serviceSupabase
      .from("ai_jobs")
      .insert({
        user_id: userId,
        room_id: job.room_id,
        job_type: "final_render_views",
        status: "running",
        provider: configuredImageProvider(),
        model: configuredImageModel(),
        input_summary: { renderJobId: job.id, viewKeys: missingViewKeys }
      })
      .select("id")
      .single();

    const outcomes = await Promise.all(
      missingViewKeys.map(async (viewKey) => {
        // Captured outside the try so a post-generation failure (upload, asset insert) still
        // reports the credits the generation consumed (review P2).
        let creditsUsed: number | null = null;
        try {
          const view = await generateFinalRenderView({
            roomType: room?.room_type ?? "living room",
            viewKey,
            conceptTitle: concept?.title ?? "Final render",
            conceptDescription: concept?.description,
            heroImageBytes,
            heroImageMimeType: "image/png",
            heroImageUrl: signedHero?.signedUrl ?? null
          });
          creditsUsed = view.imageCreditsUsed;
          const viewPath = viewPathFor(viewKey);
          const { error: uploadError } = await serviceSupabase.storage
            .from("generated-renders")
            .upload(viewPath, Buffer.from(view.imageBase64, "base64"), {
              contentType: "image/png",
              upsert: true
            });

          if (uploadError) {
            throw new Error(uploadError.message);
          }

          let { data: viewAsset, error: assetError } = await serviceSupabase
            .from("room_assets")
            .insert({
              room_id: job.room_id,
              asset_type: "final_render",
              storage_path: viewPath,
              mime_type: "image/png",
              is_primary: false,
              view_key: viewKey
            })
            .select("id")
            .single();

          // unique(storage_path): a concurrent duplicate delivery already inserted this view's
          // row — adopt it instead of failing the outcome.
          if (assetError?.code === "23505") {
            const { data: raced } = await serviceSupabase
              .from("room_assets")
              .select("id")
              .eq("storage_path", viewPath)
              .maybeSingle();
            viewAsset = raced ?? null;
            assetError = null;
          }
          if (assetError || !viewAsset) {
            throw new Error(assetError?.message ?? "Final render view asset insert returned no row.");
          }

          viewAssetIdByKey.set(viewKey, viewAsset.id);
          return {
            viewKey,
            ok: true as const,
            assetId: viewAsset.id,
            provider: view.imageProvider,
            fallbackUsed: view.imageFallbackUsed,
            creditsUsed
          };
        } catch (error) {
          console.error(`Final render view generation failed (${viewKey}, render ${job.id}):`, error);
          return {
            viewKey,
            ok: false as const,
            creditsUsed,
            error: error instanceof Error ? error.message : "Final render view generation failed."
          };
        }
      })
    );

    if (viewsJob) {
      const failed = outcomes.filter((outcome) => !outcome.ok);
      await serviceSupabase
        .from("ai_jobs")
        .update({
          status: failed.length > 0 ? "failed" : "succeeded",
          completed_at: new Date().toISOString(),
          error_message:
            failed.length > 0
              ? failed.map((outcome) => `${outcome.viewKey}: ${outcome.error}`).join("; ")
              : null,
          cost_estimate_usd: evolinkCreditsToUsd(sumOutcomeCredits(outcomes)),
          output_summary: { renderJobId: job.id, outcomes }
        })
        .eq("id", viewsJob.id);
    }
  }

  // Recompute (not append) the asset list in stable order. Guard on the job still being the
  // succeeded owner so a reclaimed/superseded job is never mutated.
  const orderedViewAssetIds = CONCEPT_VIEW_KEYS.map((viewKey) => viewAssetIdByKey.get(viewKey)).filter(
    (id): id is string => Boolean(id)
  );
  if (orderedViewAssetIds.length > 0) {
    await serviceSupabase
      .from("render_jobs")
      .update({ output_asset_ids: [heroAssetId, ...orderedViewAssetIds] })
      .eq("id", renderJobId)
      .eq("status", "succeeded");
  }

  return { complete: orderedViewAssetIds.length === CONCEPT_VIEW_KEYS.length };
}

function roleLabelFromSelectionReason(selectionReason: string | null) {
  return selectionReason?.match(/room role: ([^;]+)/)?.[1]?.trim() ?? null;
}

function formatProductDimensionsForRender(
  dimensions:
    | {
        width_cm: number | null;
        depth_cm: number | null;
        height_cm: number | null;
        source_text: string | null;
      }
    | null
) {
  if (!dimensions) {
    return null;
  }

  if (dimensions.source_text) {
    return dimensions.source_text;
  }

  const parts = [
    dimensions.width_cm ? `W ${dimensions.width_cm} cm` : null,
    dimensions.depth_cm ? `D ${dimensions.depth_cm} cm` : null,
    dimensions.height_cm ? `H ${dimensions.height_cm} cm` : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" x ") : null;
}
