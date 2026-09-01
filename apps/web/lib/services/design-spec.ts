import { extractRoomDesignSpec } from "@ritzy-studio/ai";
import {
  designSpecMustPreserveSchema,
  designSpecObjectsSchema,
  parseRoomDesignSpecRow,
  type RoomDesignSpec
} from "@ritzy-studio/domain";

import type { ServiceSupabaseClient, UserSupabaseClient } from "./supabase-clients";

// The design-spec service (S2 step 8): spec-at-approval with on-demand backfill.
// ensureRoomDesignSpec returns the stored spec for a room's selected concept,
// extracting one on first touch so every room that predates specs (all existing
// rooms) keeps working with no dead end. confirmRoomDesignSpec persists the
// user's edits and flips the row to confirmed truth.

export type EnsureRoomDesignSpecInput = {
  userId: string;
  roomId: string;
};

export type EnsureRoomDesignSpecResult =
  | { status: "no_selected_concept" }
  | { status: "concept_image_unprepared" }
  | { status: "extraction_failed" }
  | { status: "ready"; spec: RoomDesignSpec; conceptTitle: string; extractedNow: boolean };

export async function ensureRoomDesignSpec(
  { supabase, serviceSupabase }: { supabase: UserSupabaseClient; serviceSupabase: ServiceSupabaseClient },
  { userId, roomId }: EnsureRoomDesignSpecInput
): Promise<EnsureRoomDesignSpecResult> {
  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", roomId)
    .single();

  const { data: concept } = await supabase
    .from("concepts")
    .select("id, title, status, primary_image_asset_id")
    .eq("room_id", roomId)
    .eq("status", "selected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!room || !concept) {
    return { status: "no_selected_concept" };
  }

  const { data: existing } = await supabase
    .from("room_design_specs")
    .select("*")
    .eq("room_id", roomId)
    .eq("concept_id", concept.id)
    .maybeSingle();

  if (existing) {
    const parsed = parseRoomDesignSpecRow(existing);
    if (parsed) {
      return { status: "ready", spec: parsed, conceptTitle: concept.title, extractedNow: false };
    }
    // A stored spec that no longer validates is treated as absent: re-extract
    // rather than dead-ending the room on a malformed row.
  }

  if (!concept.primary_image_asset_id) {
    return { status: "concept_image_unprepared" };
  }

  const { data: renderAsset } = await supabase
    .from("room_assets")
    .select("storage_path, mime_type")
    .eq("id", concept.primary_image_asset_id)
    .maybeSingle();

  if (!renderAsset) {
    return { status: "concept_image_unprepared" };
  }

  const { data: renderBlob, error: renderError } = await serviceSupabase.storage
    .from("generated-renders")
    .download(renderAsset.storage_path);

  if (renderError || !renderBlob) {
    return { status: "concept_image_unprepared" };
  }

  const { data: designBrief } = await supabase
    .from("design_briefs")
    .select("style_notes, color_notes, functional_requirements, avoid_notes")
    .eq("room_id", roomId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("wall_length_cm, room_depth_cm, ceiling_height_cm")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: job } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: userId,
      room_id: roomId,
      job_type: "spec_extraction",
      status: "running",
      provider: "openai",
      model: "pending",
      input_summary: { roomId, conceptId: concept.id }
    })
    .select("id")
    .single();

  try {
    const extraction = await extractRoomDesignSpec({
      roomType: room.room_type,
      conceptImage: {
        bytes: Buffer.from(await renderBlob.arrayBuffer()),
        mimeType: renderAsset.mime_type ?? "image/png"
      },
      brief: {
        styleNotes: designBrief?.style_notes,
        colorNotes: designBrief?.color_notes,
        functionalRequirements: designBrief?.functional_requirements,
        avoidNotes: designBrief?.avoid_notes
      },
      measurements: measurements
        ? {
            wallLengthCm: measurements.wall_length_cm,
            roomDepthCm: measurements.room_depth_cm,
            ceilingHeightCm: measurements.ceiling_height_cm
          }
        : null
    });

    // Upsert semantics on (room, concept): a concurrent first visit loses the
    // race harmlessly and reads the winner's row back.
    const { data: inserted, error: insertError } = await supabase
      .from("room_design_specs")
      .insert({
        room_id: roomId,
        concept_id: concept.id,
        objects: extraction.objects,
        must_preserve: extraction.mustPreserve,
        status: "extracted",
        extraction_job_id: job?.id ?? null
      })
      .select("*")
      .single();

    if (job) {
      await serviceSupabase
        .from("ai_jobs")
        .update({
          status: "succeeded",
          completed_at: new Date().toISOString(),
          model: extraction.model,
          prompt_version: extraction.promptVersion,
          cost_estimate_usd: extraction.textCostUsd ?? null,
          output_summary: {
            conceptId: concept.id,
            objectCount: extraction.objects.length,
            mustPreserveCount: extraction.mustPreserve.length
          }
        })
        .eq("id", job.id);
    }

    if (insertError) {
      const { data: raced } = await supabase
        .from("room_design_specs")
        .select("*")
        .eq("room_id", roomId)
        .eq("concept_id", concept.id)
        .maybeSingle();
      const parsedRaced = raced ? parseRoomDesignSpecRow(raced) : null;
      if (parsedRaced) {
        return { status: "ready", spec: parsedRaced, conceptTitle: concept.title, extractedNow: false };
      }
      throw new Error(insertError.message);
    }

    const parsed = inserted ? parseRoomDesignSpecRow(inserted) : null;
    if (!parsed) {
      throw new Error("Extracted spec did not validate after insert.");
    }
    return { status: "ready", spec: parsed, conceptTitle: concept.title, extractedNow: true };
  } catch (error) {
    if (job) {
      await serviceSupabase
        .from("ai_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : "Spec extraction failed."
        })
        .eq("id", job.id);
    }
    return { status: "extraction_failed" };
  }
}

export type ConfirmRoomDesignSpecInput = {
  roomId: string;
  specId: string;
  objects: unknown;
  mustPreserve: unknown;
};

export type ConfirmRoomDesignSpecResult =
  | { status: "invalid"; message: string }
  | { status: "not_found" }
  | { status: "confirmed" };

export async function confirmRoomDesignSpec(
  supabase: UserSupabaseClient,
  { roomId, specId, objects, mustPreserve }: ConfirmRoomDesignSpecInput
): Promise<ConfirmRoomDesignSpecResult> {
  const parsedObjects = designSpecObjectsSchema.safeParse(objects);
  if (!parsedObjects.success) {
    return { status: "invalid", message: "Every piece needs a name and a quantity of at least one." };
  }
  const parsedPreserve = designSpecMustPreserveSchema.safeParse(mustPreserve);
  if (!parsedPreserve.success) {
    return { status: "invalid", message: "Preserved-architecture notes must be short plain sentences." };
  }

  const { data: existing } = await supabase
    .from("room_design_specs")
    .select("id")
    .eq("id", specId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (!existing) {
    return { status: "not_found" };
  }

  const { error } = await supabase
    .from("room_design_specs")
    .update({
      objects: parsedObjects.data,
      must_preserve: parsedPreserve.data,
      status: "confirmed"
    })
    .eq("id", specId)
    .eq("room_id", roomId);

  if (error) {
    throw new Error(error.message);
  }

  return { status: "confirmed" };
}
