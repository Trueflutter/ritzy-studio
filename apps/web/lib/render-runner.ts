import { randomUUID } from "node:crypto";

import {
  assessRenderSpatialQuality,
  generateFinalGroundedRender,
  generateFinalRenderView,
  spatialQaCorrectionLanguage
} from "@ritzy-studio/ai";
import { parseSpatialIntent, sortProductsForRenderReferences } from "@ritzy-studio/domain";
import { revalidatePath } from "next/cache";

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

  // Terminal jobs are a no-op: a redelivery after success (or after a stale-reclaim marked the
  // job failed) must never produce a second asset or resurrect the job.
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

    // Post-render spatial QA: one corrective retry on a hard fail, then keep
    // the better of the two attempts. QA failure never fails the render.
    let renderQaVerdict: string | null = null;
    let renderQaIssues: string[] = [];
    let renderQaRegenerated = false;
    try {
      let qa = await assessRenderSpatialQuality({
        imageUrl: await visionImageDataUrl(Buffer.from(result.imageBase64, "base64"), "image/png"),
        roomType: room.room_type,
        spatialIntent: renderSpatialIntentPrompt
      });
      if (qa.qa.verdict === "regenerate" && qa.qa.issues.length > 0) {
        const retryResult = await generateFinalGroundedRender({
          ...renderInput,
          promptSuffix: spatialQaCorrectionLanguage([...qa.qa.issues])
        });
        const retryQa = await assessRenderSpatialQuality({
          imageUrl: await visionImageDataUrl(Buffer.from(retryResult.imageBase64, "base64"), "image/png"),
          roomType: room.room_type,
          spatialIntent: renderSpatialIntentPrompt
        });
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
          spatialQaRegenerated: renderQaRegenerated
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
    revalidatePath(revealPath);

    // The hero render is committed and the job is succeeded. Generate the additional camera
    // angles best-effort in the same task: any failure or a task timeout leaves the hero-only
    // presentation intact (its own try/catch keeps this off the render's failure path).
    try {
      await generateAndStoreFinalRenderViews({
        serviceSupabase,
        userId,
        roomId: job.room_id,
        renderJobId: job.id,
        heroAssetId: renderAsset.id,
        roomType: room.room_type,
        conceptTitle: concept.title,
        conceptDescription: concept.description,
        heroImageBytes: Buffer.from(result.imageBase64, "base64"),
        heroImageStoragePath: renderPath
      });
      revalidatePath(revealPath);
    } catch (error) {
      console.error("Final render view generation failed; shipping hero-only render.", error);
    }
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
      revalidatePath(revealPath);
    }
  }
}

// Generates the additional camera angles for a completed final render and records them as
// final-render room assets, appending their ids to the render job's output_asset_ids (hero first).
// Runs AFTER the hero render is committed and the job marked succeeded, so a view failure or a
// task timeout can never regress the render — the presentation just shows the hero alone.
// Mirrors generateAndStoreConceptViews; each view is best-effort.
async function generateAndStoreFinalRenderViews({
  serviceSupabase,
  userId,
  roomId,
  renderJobId,
  heroAssetId,
  roomType,
  conceptTitle,
  conceptDescription,
  heroImageBytes,
  heroImageStoragePath
}: {
  serviceSupabase: ReturnType<typeof createServiceClient>;
  userId: string;
  roomId: string;
  renderJobId: string;
  heroAssetId: string;
  roomType: string;
  conceptTitle: string;
  conceptDescription?: string | null;
  heroImageBytes: Buffer;
  heroImageStoragePath: string;
}) {
  const { data: signedHero } = await serviceSupabase.storage
    .from("generated-renders")
    .createSignedUrl(heroImageStoragePath, 60 * 30);

  const { data: viewsJob } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: userId,
      room_id: roomId,
      job_type: "final_render_views",
      status: "running",
      provider: configuredImageProvider(),
      model: configuredImageModel(),
      input_summary: { renderJobId, viewKeys: CONCEPT_VIEW_KEYS }
    })
    .select("id")
    .single();

  const outcomes = await Promise.all(
    CONCEPT_VIEW_KEYS.map(async (viewKey) => {
      try {
        const view = await generateFinalRenderView({
          roomType,
          viewKey,
          conceptTitle,
          conceptDescription,
          heroImageBytes,
          heroImageMimeType: "image/png",
          heroImageUrl: signedHero?.signedUrl ?? null
        });
        const viewPath = `${userId}/${roomId}/final-${renderJobId}-${viewKey}.png`;
        const { error: uploadError } = await serviceSupabase.storage
          .from("generated-renders")
          .upload(viewPath, Buffer.from(view.imageBase64, "base64"), {
            contentType: "image/png",
            upsert: true
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: viewAsset, error: assetError } = await serviceSupabase
          .from("room_assets")
          .insert({
            room_id: roomId,
            asset_type: "final_render",
            storage_path: viewPath,
            mime_type: "image/png",
            is_primary: false,
            view_key: viewKey
          })
          .select("id")
          .single();

        if (assetError || !viewAsset) {
          throw new Error(assetError?.message ?? "Final render view asset insert returned no row.");
        }

        return {
          viewKey,
          ok: true as const,
          assetId: viewAsset.id,
          provider: view.imageProvider,
          fallbackUsed: view.imageFallbackUsed
        };
      } catch (error) {
        console.error(`Final render view generation failed (${viewKey}, render ${renderJobId}):`, error);
        return {
          viewKey,
          ok: false as const,
          error: error instanceof Error ? error.message : "Final render view generation failed."
        };
      }
    })
  );

  const viewAssetIds = outcomes
    .filter((outcome): outcome is Extract<(typeof outcomes)[number], { ok: true }> => outcome.ok)
    .map((outcome) => outcome.assetId);
  if (viewAssetIds.length > 0) {
    // Append the view assets after the hero (index 0 stays the primary render). Guard on the job
    // still being the succeeded owner so a reclaimed/superseded job is never mutated.
    await serviceSupabase
      .from("render_jobs")
      .update({ output_asset_ids: [heroAssetId, ...viewAssetIds] })
      .eq("id", renderJobId)
      .eq("status", "succeeded");
  }

  if (viewsJob) {
    const failed = outcomes.filter((outcome) => !outcome.ok);
    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: failed.length > 0 ? "failed" : "succeeded",
        completed_at: new Date().toISOString(),
        error_message: failed.length > 0 ? failed.map((outcome) => `${outcome.viewKey}: ${outcome.error}`).join("; ") : null,
        output_summary: { renderJobId, outcomes }
      })
      .eq("id", viewsJob.id);
  }
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
