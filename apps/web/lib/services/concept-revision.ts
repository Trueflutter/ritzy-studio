import {
  assessRevisionVisualDiff,
  evolinkCreditsToUsd,
  generateConceptRevision,
  stageTextConfig,
  sumImagePlusTextUsd,
  sumUsdCostsStrict
} from "@ritzy-studio/ai";
import { configuredTextModel } from "@ritzy-studio/config";

import { configuredImageModel, configuredImageProvider, visionImageDataUrl } from "@/lib/render-images";

import { generateAndStoreConceptViews } from "./concept-generation";
import { conceptPrimaryRender, roomImageInputs } from "./room-images";
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
  {
    defer,
    // Injectable like defer, so the success path's persisted transitions are
    // testable without a live provider.
    generateRevision = generateConceptRevision
  }: {
    defer: (task: () => Promise<void>) => void;
    generateRevision?: typeof generateConceptRevision;
  }
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

  const images = await roomImageInputs(supabase, roomId);
  const roomPhoto = images.roomPhoto;

  if (!roomPhoto) {
    return { status: "missing_photo" };
  }

  // The image being edited: the previous concept's primary render.
  const previousRender = await conceptPrimaryRender(
    { supabase, serviceSupabase },
    concept.primary_image_asset_id
  );

  if (!previousRender) {
    return { status: "concept_image_unprepared" };
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
    if (!images.signedPhotoUrl || !images.photoBytes) {
      return { status: "photo_unprepared" };
    }
    const result = await generateRevision({
      roomType: room.room_type,
      roomPhotoUrl: await visionImageDataUrl(images.photoBytes, roomPhoto.mime_type),
      roomPhotoReferenceUrl: images.signedPhotoUrl,
      roomPhotoBytes: images.photoBytes,
      roomPhotoMimeType: roomPhoto.mime_type,
      additionalRoomPhotos: images.additionalRoomPhotos,
      floorPlanImageUrl: images.floorPlanImageUrl,
      previousConceptImage: {
        bytes: previousRender.bytes,
        mimeType: previousRender.mimeType,
        url: previousRender.signedUrl
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

    const { error: primaryImageError } = await supabase
      .from("concepts")
      .update({ primary_image_asset_id: renderAsset.id })
      .eq("id", revisedConcept.id);

    if (primaryImageError) {
      throw new Error(primaryImageError.message);
    }

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

    // Tie the critique to the version it produced. Post-success bookkeeping: a
    // failure here must not fail the revision, but it must be visible.
    if (critiqueRow) {
      const { error: linkError } = await supabase
        .from("concept_critiques")
        .update({ concept_version_link: revisedConcept.id })
        .eq("id", critiqueRow.id);
      if (linkError) {
        console.error(
          `Failed to link critique ${critiqueRow.id} to revision ${revisedConcept.id}: ${linkError.message}`
        );
      }
    }

    defer(async () => {
      // Visual-diff QA first (cheap text call): did the asked change happen, did
      // anything drift. Best-effort: a QA failure never fails the revision.
      try {
        const diff = await assessRevisionVisualDiff({
          previousImage: {
            bytes: previousRender.bytes,
            mimeType: previousRender.mimeType
          },
          revisedImage: { bytes: revisionImageBytes, mimeType: "image/png" },
          mustChange: result.changePlan.mustChange,
          mustPreserve: result.changePlan.mustPreserve
        });
        await serviceSupabase
          .from("concepts")
          .update({ diff_summary: diff.summary })
          .eq("id", revisedConcept.id);
        const { data: jobRow, error: jobRowError } = await serviceSupabase
          .from("ai_jobs")
          .select("cost_estimate_usd, output_summary")
          .eq("id", job.id)
          .maybeSingle();
        if (!jobRowError && jobRow) {
          await serviceSupabase
            .from("ai_jobs")
            .update({
              // Strict merge preserves the honest-null invariant: an unknown image
              // cost stays null instead of being overwritten by the QA text cost.
              cost_estimate_usd: sumUsdCostsStrict(jobRow.cost_estimate_usd, diff.textCostUsd),
              output_summary: {
                ...(jobRow.output_summary as Record<string, unknown> | null),
                visualDiff: {
                  changeApplied: diff.changeApplied,
                  unintendedChanges: diff.unintendedChanges,
                  summary: diff.summary,
                  model: diff.model
                }
              }
            })
            .eq("id", job.id);
        }
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
