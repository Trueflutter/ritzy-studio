import {
  evolinkCreditsToUsd,
  generateConceptView,
  generateInitialConcept,
  stageTextConfig,
  sumImagePlusTextUsd
} from "@ritzy-studio/ai";
import { configuredTextModel } from "@ritzy-studio/config";
import { deriveSpatialDesignerWarnings, parseSpatialIntent } from "@ritzy-studio/domain";

import { sumOutcomeCredits } from "@/lib/ai-cost";
import { conceptRenderTimeoutMs } from "@/lib/concept-run-budget";
import { CONCEPT_VIEW_KEYS } from "@/lib/render-flags";
import { configuredImageModel, configuredImageProvider, visionImageDataUrl } from "@/lib/render-images";
import { normalizeCatalogFirstRoomType } from "@/lib/room-type-normalize";

import { chooseConceptAnchors, persistConceptAnchors, type ConceptAnchorOutcome } from "./concept-anchors";
import { roomImageInputs } from "./room-images";
import { likedStyleSlugsFromStructuredBrief } from "./sourcing-support";
import { storageImageDataUrl } from "./storage-images";
import type { ServiceSupabaseClient, UserSupabaseClient } from "./supabase-clients";

// The concept-generation service: typed inputs and results, all persisted state
// transitions owned here. The action wrappers keep auth, entitlement gating
// (injected as ensureEntitled), redirects, and copy. Deferred work (the concept
// views) goes through the injected defer so the service stays free of
// next/server.
//
// Anchored concepts (S3b) changed the ordering for the pieces that carry a
// room. S2 generated from the room, brief and inspiration alone and sourced
// everything afterwards; S3 then measured what that costs, and with four
// retailers only about one in eight pieces an unconstrained render depicts has
// a genuine match in stock. So the hero roles are now chosen from live stock
// BEFORE the render and passed to it as reference photographs: they match by
// construction rather than by search. Everything else is unchanged, and
// sourcing still fills the remaining roles against the confirmed spec after
// approval.
//
// A room whose anchor pass cannot run still gets a concept. The ranked
// shortlist decides, or the render runs unanchored, and the job says which.

// Generates the additional camera angles for a stored concept and records them as
// concept-linked room assets. Runs deferred (after()): view failures must never
// fail the concept itself, so each view is best-effort.
export async function generateAndStoreConceptViews({
  serviceSupabase,
  userId,
  roomId,
  conceptId,
  roomType,
  conceptTitle,
  conceptDescription,
  conceptGenerationPrompt,
  heroImageBytes,
  heroImageStoragePath
}: {
  serviceSupabase: ServiceSupabaseClient;
  userId: string;
  roomId: string;
  conceptId: string;
  roomType: string;
  conceptTitle: string;
  conceptDescription?: string | null;
  conceptGenerationPrompt?: string | null;
  heroImageBytes: Buffer;
  heroImageStoragePath: string;
}) {
  const { data: signedHero } = await serviceSupabase.storage
    .from("generated-renders")
    .createSignedUrl(heroImageStoragePath, 60 * 30);

  // Tracked as an ai_job so silent failures are observable and retryable; the
  // two views generate in parallel to stay well inside the task lifetime.
  const { data: viewsJob } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: userId,
      room_id: roomId,
      job_type: "concept_views",
      status: "running",
      provider: configuredImageProvider(),
      model: configuredImageModel(),
      input_summary: { conceptId, viewKeys: CONCEPT_VIEW_KEYS }
    })
    .select("id")
    .single();

  const outcomes = await Promise.all(
    CONCEPT_VIEW_KEYS.map(async (viewKey) => {
      // Captured outside the try so a post-generation failure still reports the credits the
      // generation consumed (review P2).
      let creditsUsed: number | null = null;
      try {
        const view = await generateConceptView({
          roomType,
          viewKey,
          conceptTitle,
          conceptDescription,
          conceptGenerationPrompt,
          heroImageBytes,
          heroImageMimeType: "image/png",
          heroImageUrl: signedHero?.signedUrl ?? null
        });
        creditsUsed = view.imageCreditsUsed;
        const viewPath = `${userId}/${roomId}/${conceptId}-${viewKey}.png`;
        const { error: uploadError } = await serviceSupabase.storage
          .from("generated-renders")
          .upload(viewPath, Buffer.from(view.imageBase64, "base64"), {
            contentType: "image/png",
            upsert: true
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { error: assetError } = await serviceSupabase.from("room_assets").insert({
          room_id: roomId,
          asset_type: "concept_render",
          storage_path: viewPath,
          mime_type: "image/png",
          is_primary: false,
          concept_id: conceptId,
          view_key: viewKey
        });

        if (assetError) {
          throw new Error(assetError.message);
        }

        return {
          viewKey,
          ok: true as const,
          provider: view.imageProvider,
          fallbackUsed: view.imageFallbackUsed,
          creditsUsed
        };
      } catch (error) {
        console.error(`Concept view generation failed (${viewKey}, concept ${conceptId}):`, error);
        return {
          viewKey,
          ok: false as const,
          creditsUsed,
          error: error instanceof Error ? error.message : "Concept view generation failed."
        };
      }
    })
  );

  if (viewsJob) {
    const failed = outcomes.filter((outcome) => !outcome.ok);
    await serviceSupabase
      .from("ai_jobs")
      .update({
        // Any missing view is a failed job: partial success must stay visible
        // and retryable by status, not silently ship a one-view concept.
        status: failed.length > 0 ? "failed" : "succeeded",
        completed_at: new Date().toISOString(),
        error_message: failed.length > 0 ? failed.map((outcome) => `${outcome.viewKey}: ${outcome.error}`).join("; ") : null,
        cost_estimate_usd: evolinkCreditsToUsd(sumOutcomeCredits(outcomes)),
        output_summary: { conceptId, outcomes }
      })
      .eq("id", viewsJob.id);
  }
}

export function hasRequiredRoomSize(measurements: {
  wall_length_cm?: number | null;
  room_depth_cm?: number | null;
  ceiling_height_cm?: number | null;
}) {
  return Boolean(
    measurements.wall_length_cm && measurements.room_depth_cm && measurements.ceiling_height_cm
  );
}

export type GenerateInitialConceptInput = {
  userId: string;
  projectId: string;
  roomId: string;
};

export type GenerateInitialConceptResult =
  | { status: "room_not_found" }
  | { status: "missing_brief" }
  | { status: "already_generated" }
  | { status: "missing_photo" }
  | { status: "already_running" }
  | { status: "photo_unprepared" }
  | { status: "generation_failed" }
  | { status: "generated"; conceptId: string };

export async function generateInitialConceptForRoom(
  { supabase, serviceSupabase }: { supabase: UserSupabaseClient; serviceSupabase: ServiceSupabaseClient },
  { userId, projectId, roomId }: GenerateInitialConceptInput,
  {
    ensureEntitled,
    defer,
    chooseAnchors = chooseConceptAnchors,
    generateConcept = generateInitialConcept,
    now = Date.now
  }: {
    ensureEntitled: () => Promise<void>;
    defer: (task: () => Promise<void>) => void;
    chooseAnchors?: typeof chooseConceptAnchors;
    // Injected for the same reason the anchor pass is: this is where the
    // anchors either reach the render or silently do not, and that is the one
    // failure the rest of the pipeline cannot detect.
    generateConcept?: typeof generateInitialConcept;
    now?: () => number;
  }
): Promise<GenerateInitialConceptResult> {
  const startedAt = now();
  let generatedConceptId = "";
  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  if (!room) {
    return { status: "room_not_found" };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, budget_max_aed")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { status: "room_not_found" };
  }

  await ensureEntitled();

  const { data: designBrief } = await supabase
    .from("design_briefs")
    .select("*")
    .eq("room_id", roomId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!designBrief) {
    return { status: "missing_brief" };
  }

  const { data: existingConcept } = await supabase
    .from("concepts")
    .select("id")
    .eq("room_id", roomId)
    .eq("design_brief_id", designBrief.id)
    .in("status", ["generated", "selected"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingConcept) {
    return { status: "already_generated" };
  }

  // Dedupe before any storage work: a running generation for this brief blocks.
  const runningSince = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: runningConceptJob } = await serviceSupabase
    .from("ai_jobs")
    .select("id")
    .eq("room_id", roomId)
    .eq("job_type", "initial_concept_generation")
    .eq("status", "running")
    .gte("created_at", runningSince)
    .contains("input_summary", { designBriefId: designBrief.id })
    .limit(1)
    .maybeSingle();

  if (runningConceptJob) {
    return { status: "already_running" };
  }

  const images = await roomImageInputs(supabase, roomId);
  const roomPhoto = images.roomPhoto;

  if (!roomPhoto) {
    return { status: "missing_photo" };
  }

  const { data: inspirationAssets = [] } = await supabase
    .from("room_assets")
    .select("id, storage_path")
    .eq("room_id", roomId)
    .eq("asset_type", "inspiration_image")
    .order("created_at", { ascending: true })
    .limit(6);

  const signedInspirationUrls = (
    await Promise.all(
      (inspirationAssets ?? []).map((asset) =>
        storageImageDataUrl(supabase, "room-assets", asset.storage_path)
      )
    )
  ).filter((url): url is string => Boolean(url));

  if (!images.signedPhotoUrl || !images.photoBytes) {
    return { status: "photo_unprepared" };
  }

  const additionalRoomPhotos = images.additionalRoomPhotos;
  const floorPlanImageUrl = images.floorPlanImageUrl;

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const measurementsMissing = !measurements || !hasRequiredRoomSize(measurements);

  const spatialIntent = parseSpatialIntent(designBrief.structured_json, room.room_type);
  const spatialWarnings = deriveSpatialDesignerWarnings({
    roomType: normalizeCatalogFirstRoomType(room.room_type),
    intent: spatialIntent,
    measurements: measurements
      ? {
          wallLengthCm: measurements.wall_length_cm,
          roomDepthCm: measurements.room_depth_cm,
          ceilingHeightCm: measurements.ceiling_height_cm,
          source: measurements.source,
          confidence: measurements.confidence
        }
      : null
  });
  const spatialAssumptions = [
    ...(spatialIntent.assumptions ?? []),
    ...(measurementsMissing
      ? ["Room measurements were not provided; furniture scale is directional until dimensions are added."]
      : [])
  ];

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
      job_type: "initial_concept_generation",
      status: "running",
      provider: configuredImageProvider(),
      model: `${stageTextConfig("concept_direction", configuredTextModel()).model} + ${configuredImageModel()}`,
      prompt_version: null,
      input_summary: {
        roomId,
        designBriefId: designBrief.id,
        roomPhotoAssetId: roomPhoto.id,
        inspirationAssetCount: signedInspirationUrls.length,
        answeredQuestionCount: answeredQuestions?.length ?? 0
      }
    })
    .select("id")
    .single();

  if (jobError) {
    throw new Error(jobError.message);
  }

  let anchorOutcome: ConceptAnchorOutcome | null = null;

  try {
    const roomPhotoDataUrl = await visionImageDataUrl(images.photoBytes, roomPhoto.mime_type);

    // The hero pieces, chosen from live stock before the render is asked for.
    // Never fatal, and this try is what makes that true rather than a comment:
    // chooseConceptAnchors answers its own failures with a fallback, but an
    // unexpected one would otherwise cost the room its concept, when the right
    // answer is a concept with no anchors and a job that says so.
    try {
      anchorOutcome = await chooseAnchors(
        { supabase, serviceSupabase },
        {
          userId,
          roomId,
          roomType: room.room_type,
          roomPhotoDataUrl,
          budgetMaxAed: project.budget_max_aed,
          designBrief,
          styleSlugs: likedStyleSlugsFromStructuredBrief(designBrief.structured_json),
          measurements: measurements
            ? { wall_length_cm: measurements.wall_length_cm, room_depth_cm: measurements.room_depth_cm }
            : null,
          startedAt
        }
      );
    } catch (error) {
      console.error(`Room ${roomId}: choosing anchors failed; the concept is generated unanchored.`, error);
      anchorOutcome = null;
    }

    const result = await generateConcept({
      roomType: room.room_type,
      // What is left for the picture after the anchor work. Held to here
      // because the image providers' own ceilings outlast this route, and a
      // request the platform kills leaves this job "running" and the shopper
      // locked out of a retry for fifteen minutes.
      imageDeadlineMs: conceptRenderTimeoutMs({ startedAt, now: now() }),
      roomPhotoUrl: roomPhotoDataUrl,
      roomPhotoReferenceUrl: images.signedPhotoUrl,
      // Anchors travel as bytes. The image provider is never handed a retailer
      // link to follow: the fetch already happened app-side, through the guard,
      // and a retailer host that refuses the provider (or answers it with a
      // resize error) would otherwise cost the render its primary provider and
      // most of the run's budget. The input type has no URL field to pass.
      anchorProducts: (anchorOutcome?.anchors ?? []).map((anchor) => ({
        roleLabel: anchor.roleLabel,
        bytes: anchor.imageBytes,
        mimeType: anchor.imageMimeType
      })),
      roomPhotoBytes: images.photoBytes,
      roomPhotoMimeType: roomPhoto.mime_type,
      additionalRoomPhotos,
      inspirationImageUrls: signedInspirationUrls,
      floorPlanImageUrl,
      spatialIntent: {
        focalPoint: spatialIntent.focalPoint,
        seatingPriority: spatialIntent.seatingPriority,
        diningSeatCount: spatialIntent.diningSeatCount,
        mustKeepClear: spatialIntent.mustKeepClear
      },
      styleSlugs: likedStyleSlugsFromStructuredBrief(designBrief.structured_json),
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
        : null
    });

    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        provider: result.imageProvider,
        model: `${result.textModel} + ${result.imageModel}`,
        prompt_version: result.promptVersion,
        // This job's own calls only. The anchor pass has its own row carrying
        // its own cost, and a run's spend is the sum of its rows; adding it
        // here as well would count it twice against the per-run ceiling.
        // output_summary.anchors.selectionCostUsd keeps it visible from here.
        cost_estimate_usd: sumImagePlusTextUsd(evolinkCreditsToUsd(result.imageCreditsUsed), result.textCostUsd),
        output_summary: {
          promptKey: result.promptKey,
          title: result.concept.title,
          uncertaintyNotes: result.analysis.uncertaintyNotes,
          revisedPrompt: result.revisedPrompt ?? null,
          imageProvider: result.imageProvider,
          imageModel: result.imageModel,
          imagePromptVersion: result.promptVersion,
          imageLatencySeconds: result.imageLatencySeconds,
          imageFallbackUsed: result.imageFallbackUsed,
          imageFallbackError: result.imageFallbackError ?? null,
          imageCreditsUsed: result.imageCreditsUsed,
          anchors: anchorOutcome
            ? {
                status: anchorOutcome.status,
                error: anchorOutcome.error,
                chosen: anchorOutcome.anchors.map((anchor) => ({
                  roleKey: anchor.roleKey,
                  productId: anchor.product.id,
                  source: anchor.source
                })),
                setNote: anchorOutcome.setNote,
                selectionJobId: anchorOutcome.jobId,
                selectionCostUsd: anchorOutcome.costUsd
              }
            : { status: "unavailable", error: "Choosing anchors failed; the concept was generated unanchored." }
        }
      })
      .eq("id", job.id);

    const { data: concept, error: conceptError } = await supabase
      .from("concepts")
      .insert({
        room_id: roomId,
        design_brief_id: designBrief.id,
        generation_job_id: job.id,
        title: result.concept.title,
        description: [
          result.concept.rationale,
          "",
          `Uncertainty: ${[
            result.concept.uncertaintyNote,
            ...spatialAssumptions,
            ...spatialWarnings
              .filter((warning) => warning.code !== "spatial_geometry_missing")
              .map((warning) => warning.message)
          ].join(" ")}`
        ].join("\n"),
        status: "generated"
      })
      .select("id")
      .single();

    if (conceptError) {
      throw new Error(conceptError.message);
    }

    // Now that there is a concept for them to belong to: what this render was
    // actually built from, so sourcing fills the remaining roles instead of
    // re-deciding these, and the next room can avoid repeating them.
    await persistConceptAnchors(serviceSupabase, {
      roomId,
      conceptId: concept.id,
      anchors: anchorOutcome?.anchors ?? [],
      selectionJobId: anchorOutcome?.jobId ?? null
    });

    const renderPath = `${userId}/${roomId}/${concept.id}.png`;
    const renderBytes = Buffer.from(result.imageBase64, "base64");
    const { error: uploadError } = await serviceSupabase.storage
      .from("generated-renders")
      .upload(renderPath, renderBytes, {
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
      .eq("id", concept.id);

    await supabase.from("rooms").update({ status: "concepting" }).eq("id", roomId);

    generatedConceptId = concept.id;
    defer(async () => {
      await generateAndStoreConceptViews({
        serviceSupabase,
        userId: userId,
        roomId,
        conceptId: concept.id,
        roomType: room.room_type,
        conceptTitle: result.concept.title,
        conceptDescription: result.concept.rationale,
        conceptGenerationPrompt: result.concept.generationPrompt,
        heroImageBytes: renderBytes,
        heroImageStoragePath: renderPath
      });
    });
  } catch (error) {
    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Initial concept generation failed."
      })
      .eq("id", job.id);

    return { status: "generation_failed" };
  }

  return { status: "generated", conceptId: generatedConceptId };
}

export async function selectConcept(
  supabase: UserSupabaseClient,
  { roomId, conceptId }: { roomId: string; conceptId: string }
) {
  await supabase.from("concepts").update({ status: "rejected" }).eq("room_id", roomId);
  await supabase.from("concepts").update({ status: "selected" }).eq("id", conceptId);
}
