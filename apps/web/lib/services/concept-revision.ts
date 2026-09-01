import {
  assessRevisionVisualDiff,
  evolinkCreditsToUsd,
  generateConceptRevision,
  stageTextConfig,
  sumImagePlusTextUsd,
  sumUsdCosts
} from "@ritzy-studio/ai";
import { configuredTextModel } from "@ritzy-studio/config";

import { configuredImageModel, configuredImageProvider, visionImageDataUrl } from "@/lib/render-images";

import { generateAndStoreConceptViews } from "./concept-generation";
import { storageImageDataUrl } from "./storage-images";
import type { ServiceSupabaseClient, UserSupabaseClient } from "./supabase-clients";

// The concept-revision service: a revision is a reference-preserving EDIT of the
// previous concept image (S2): inputs are the previous concept render, all room
// photos, the floor plan, and a critique-derived change/preserve plan; the
// deferred visual-diff QA writes concepts.diff_summary and the critique's
// concept_version_link ties the critique to the version it produced. The critique
// row is saved BEFORE any later step can fail (a failed revision keeps the
// critique). Deferred work goes through the injected defer.

export type ReviseConceptInput = {
  userId: string;
  projectId: string;
  roomId: string;
  conceptId: string;
  critique: string;
};

export type ReviseConceptResult =
  | { status: "not_found" }
  | { status: "missing_brief" }
  | { status: "missing_photo" }
  | { status: "photo_unprepared" }
  | { status: "concept_image_unprepared" }
  | { status: "revision_failed" }
  | { status: "revised"; conceptId: string };

export async function reviseConceptForRoom(
  { supabase, serviceSupabase }: { supabase: UserSupabaseClient; serviceSupabase: ServiceSupabaseClient },
  { userId, projectId, roomId, conceptId, critique }: ReviseConceptInput,
  { defer }: { defer: (task: () => Promise<void>) => void }
): Promise<ReviseConceptResult> {
  let revisedConceptId = "";
  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  const { data: concept } = await supabase
    .from("concepts")
    .select("*")
    .eq("id", conceptId)
    .eq("room_id", roomId)
    .single();

  if (!room || !concept) {
    return { status: "not_found" };
  }

  const { data: designBrief } = await supabase
    .from("design_briefs")
    .select("*")
    .eq("id", concept.design_brief_id)
    .single();

  if (!designBrief) {
    return { status: "missing_brief" };
  }

  const { data: critiqueRow, error: critiqueError } = await supabase
    .from("concept_critiques")
    .insert({
      concept_id: concept.id,
      critique_text: critique,
      created_by_user_id: userId
    })
    .select("id")
    .single();

  if (critiqueError) {
    throw new Error(critiqueError.message);
  }

  const { data: roomPhotos = [] } = await supabase
    .from("room_assets")
    .select("*")
    .eq("room_id", roomId)
    .eq("asset_type", "room_photo")
    .order("created_at", { ascending: true })
    .limit(3);
  const roomPhoto = roomPhotos?.[0] ?? null;
  const additionalRoomPhotoAssets = (roomPhotos ?? []).slice(1);

  if (!roomPhoto) {
    return { status: "missing_photo" };
  }

  // The image being edited: the previous concept's primary render.
  const { data: previousRenderAsset } = concept.primary_image_asset_id
    ? await supabase
        .from("room_assets")
        .select("storage_path, mime_type")
        .eq("id", concept.primary_image_asset_id)
        .maybeSingle()
    : { data: null };

  if (!previousRenderAsset) {
    return { status: "concept_image_unprepared" };
  }

  const { data: previousRenderBlob, error: previousRenderError } = await serviceSupabase.storage
    .from("generated-renders")
    .download(previousRenderAsset.storage_path);
  const { data: signedPreviousRender } = await serviceSupabase.storage
    .from("generated-renders")
    .createSignedUrl(previousRenderAsset.storage_path, 60 * 30);

  if (previousRenderError || !previousRenderBlob) {
    return { status: "concept_image_unprepared" };
  }
  const previousConceptImageBytes = Buffer.from(await previousRenderBlob.arrayBuffer());

  const { data: signedPhoto } = await supabase.storage
    .from("room-assets")
    .createSignedUrl(roomPhoto.storage_path, 60 * 30);

  const { data: photoBlob, error: downloadError } = await supabase.storage
    .from("room-assets")
    .download(roomPhoto.storage_path);

  if (!signedPhoto?.signedUrl || downloadError || !photoBlob) {
    return { status: "photo_unprepared" };
  }

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: answeredQuestions = [] } = await supabase
    .from("clarifying_questions")
    .select("question, answer")
    .eq("design_brief_id", designBrief.id)
    .eq("status", "answered")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const additionalRoomPhotos = (
    await Promise.all(
      additionalRoomPhotoAssets.map(async (asset) => {
        const { data: blob, error: blobError } = await supabase.storage
          .from("room-assets")
          .download(asset.storage_path);
        if (blobError || !blob) {
          return null;
        }
        const bytes = Buffer.from(await blob.arrayBuffer());
        const { data: signed } = await supabase.storage
          .from("room-assets")
          .createSignedUrl(asset.storage_path, 60 * 30);
        return {
          url: await visionImageDataUrl(bytes, asset.mime_type),
          referenceUrl: signed?.signedUrl ?? null,
          bytes,
          mimeType: asset.mime_type
        };
      })
    )
  ).filter((photo): photo is NonNullable<typeof photo> => Boolean(photo));

  const { data: floorPlanAsset } = await supabase
    .from("room_assets")
    .select("storage_path, mime_type")
    .eq("room_id", roomId)
    .eq("asset_type", "floor_plan")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const floorPlanImageUrl = floorPlanAsset?.mime_type?.startsWith("image/")
    ? await storageImageDataUrl(supabase, "room-assets", floorPlanAsset.storage_path, floorPlanAsset.mime_type)
    : null;

  const { data: job, error: jobError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: userId,
      room_id: roomId,
      job_type: "concept_revision",
      status: "running",
      provider: configuredImageProvider(),
      model: `${stageTextConfig("revision_direction", configuredTextModel()).model} + ${configuredImageModel()}`,
      prompt_version: null,
      input_summary: {
        roomId,
        parentConceptId: concept.id,
        critiqueLength: critique.length
      }
    })
    .select("id")
    .single();

  if (jobError) {
    throw new Error(jobError.message);
  }

  try {
    const revisionPhotoBytes = Buffer.from(await photoBlob.arrayBuffer());
    const result = await generateConceptRevision({
      roomType: room.room_type,
      roomPhotoUrl: await visionImageDataUrl(revisionPhotoBytes, roomPhoto.mime_type),
      roomPhotoReferenceUrl: signedPhoto.signedUrl,
      roomPhotoBytes: revisionPhotoBytes,
      roomPhotoMimeType: roomPhoto.mime_type,
      additionalRoomPhotos,
      floorPlanImageUrl,
      previousConceptImage: {
        bytes: previousConceptImageBytes,
        mimeType: previousRenderAsset.mime_type ?? "image/png",
        url: signedPreviousRender?.signedUrl ?? null
      },
      styleNotes: designBrief.style_notes,
      colorNotes: designBrief.color_notes,
      budgetNotes: designBrief.budget_notes,
      functionalRequirements: designBrief.functional_requirements,
      avoidNotes: designBrief.avoid_notes,
      inspirationNotes: designBrief.inspiration_notes,
      clarifyingAnswers: (answeredQuestions ?? [])
        .filter((question) => question.answer)
        .map((question) => ({
          question: question.question,
          answer: question.answer ?? ""
        })),
      measurements: measurements
        ? {
            wallLengthCm: measurements.wall_length_cm,
            roomDepthCm: measurements.room_depth_cm,
            ceilingHeightCm: measurements.ceiling_height_cm,
            notes: measurements.notes
          }
        : null,
      previousConcept: {
        title: concept.title,
        description: concept.description
      },
      critique
    });

    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        provider: result.imageProvider,
        model: `${result.textModel} + ${result.imageModel}`,
        prompt_version: result.promptVersion,
        cost_estimate_usd: sumImagePlusTextUsd(evolinkCreditsToUsd(result.imageCreditsUsed), result.textCostUsd),
        output_summary: {
          promptKey: result.promptKey,
          title: result.concept.title,
          parentConceptId: concept.id,
          changePlan: result.changePlan,
          revisedPrompt: result.revisedPrompt ?? null,
          imageProvider: result.imageProvider,
          imageModel: result.imageModel,
          imageLatencySeconds: result.imageLatencySeconds,
          imageFallbackUsed: result.imageFallbackUsed,
          imageFallbackError: result.imageFallbackError ?? null,
          imageCreditsUsed: result.imageCreditsUsed
        }
      })
      .eq("id", job.id);

    const { data: revisedConcept, error: conceptError } = await supabase
      .from("concepts")
      .insert({
        room_id: roomId,
        design_brief_id: designBrief.id,
        parent_concept_id: concept.id,
        generation_job_id: job.id,
        title: result.concept.title,
        description: [
          result.concept.rationale,
          "",
          `Uncertainty: ${result.concept.uncertaintyNote}`
        ].join("\n"),
        status: "generated"
      })
      .select("id")
      .single();

    if (conceptError) {
      throw new Error(conceptError.message);
    }

    const renderPath = `${userId}/${roomId}/${revisedConcept.id}.png`;
    const { error: uploadError } = await serviceSupabase.storage
      .from("generated-renders")
      .upload(renderPath, Buffer.from(result.imageBase64, "base64"), {
        contentType: "image/png",
        upsert: true
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: renderAsset, error: renderAssetError } = await supabase
      .from("room_assets")
      .insert({
        room_id: roomId,
        asset_type: "concept_render",
        storage_path: renderPath,
        mime_type: "image/png",
        is_primary: true
      })
      .select("id")
      .single();

    if (renderAssetError) {
      throw new Error(renderAssetError.message);
    }

    await supabase
      .from("concepts")
      .update({ primary_image_asset_id: renderAsset.id })
      .eq("id", revisedConcept.id);

    // A revision is the room's new current direction. Clear the prior
    // selection so the concepts page surfaces this revision as the hero
    // instead of the now-superseded concept it was revised from.
    await supabase
      .from("concepts")
      .update({ status: "generated" })
      .eq("room_id", roomId)
      .eq("status", "selected");

    const revisionImageBytes = Buffer.from(result.imageBase64, "base64");
    revisedConceptId = revisedConcept.id;

    // Tie the critique to the version it produced.
    if (critiqueRow) {
      await supabase
        .from("concept_critiques")
        .update({ concept_version_link: revisedConcept.id })
        .eq("id", critiqueRow.id);
    }

    defer(async () => {
      // Visual-diff QA first (cheap text call): did the asked change happen, did
      // anything drift. Best-effort: a QA failure never fails the revision.
      try {
        const diff = await assessRevisionVisualDiff({
          previousImage: {
            bytes: previousConceptImageBytes,
            mimeType: previousRenderAsset.mime_type ?? "image/png"
          },
          revisedImage: { bytes: revisionImageBytes, mimeType: "image/png" },
          mustChange: result.changePlan.mustChange,
          mustPreserve: result.changePlan.mustPreserve
        });
        await serviceSupabase
          .from("concepts")
          .update({ diff_summary: diff.summary })
          .eq("id", revisedConcept.id);
        const { data: jobRow } = await serviceSupabase
          .from("ai_jobs")
          .select("cost_estimate_usd, output_summary")
          .eq("id", job.id)
          .maybeSingle();
        await serviceSupabase
          .from("ai_jobs")
          .update({
            cost_estimate_usd: sumUsdCosts(jobRow?.cost_estimate_usd ?? null, diff.textCostUsd),
            output_summary: {
              ...(jobRow?.output_summary as Record<string, unknown> | null),
              visualDiff: {
                changeApplied: diff.changeApplied,
                unintendedChanges: diff.unintendedChanges,
                summary: diff.summary,
                model: diff.model
              }
            }
          })
          .eq("id", job.id);
      } catch (error) {
        console.error(`Revision visual-diff QA failed (concept ${revisedConcept.id}):`, error);
      }

      await generateAndStoreConceptViews({
        serviceSupabase,
        userId: userId,
        roomId,
        conceptId: revisedConcept.id,
        roomType: room.room_type,
        conceptTitle: result.concept.title,
        conceptDescription: result.concept.rationale,
        conceptGenerationPrompt: result.concept.generationPrompt,
        heroImageBytes: revisionImageBytes,
        heroImageStoragePath: renderPath
      });
    });
  } catch (error) {
    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Concept revision failed."
      })
      .eq("id", job.id);

    return { status: "revision_failed" };
  }

  return { status: "revised", conceptId: revisedConceptId };
}
