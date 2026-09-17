import {
  PDF_MIME_TYPE,
  PLAN_READABLE_MIN_EDGE_PX,
  UNKNOWN_BYTES_MIME_TYPE,
  boundedDetectedRooms,
  floorPlanReadDecision,
  roomIsDimensioned,
  type ConfirmedFloorPlanRoom,
  type DetectedRoom,
  type FloorPlanAsset,
  type FloorPlanReadAction,
  type FloorPlanReadJob
} from "@ritzy-studio/domain";
import { readFloorPlanRooms, stageTextConfig } from "@ritzy-studio/ai";
import { configuredTextModel } from "@ritzy-studio/config";

import { writeBriefDocument } from "./brief-document";
import { closeAiJob } from "./close-ai-job";
import { planImageOptions } from "@/lib/render-images";
import { storageImageDataUrl } from "./storage-images";
import type { ServiceSupabaseClient, UserSupabaseClient } from "./supabase-clients";

// Reading the room off a floor plan (S5b).
//
// The answer lives on the `ai_jobs` row that paid for it, not in
// `design_briefs.structured_json` where the inspiration analysis writes. That
// column is read, modified and written whole by `saveDesignBriefAction`, and a
// plan read takes tens of seconds: press Continue in that window and one write
// discards the other, losing an answer already paid for. One row, one writer,
// and the row's status doubles as the state the screen renders.

export type FloorPlanReadOutcome =
  | { status: "read"; rooms: DetectedRoom[]; unitRead: string }
  | { status: "skipped"; reason: FloorPlanReadAction }
  | { status: "failed"; message: string };

export type FloorPlanAssetRow = {
  id: string;
  storage_path: string;
  mime_type: string | null;
  width_px: number | null;
  height_px: number | null;
};

export async function newestFloorPlanAsset(
  supabase: UserSupabaseClient,
  roomId: string
): Promise<FloorPlanAssetRow | null> {
  const { data, error } = await supabase
    .from("room_assets")
    .select("id, storage_path, mime_type, width_px, height_px")
    .eq("room_id", roomId)
    .eq("asset_type", "floor_plan")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as FloorPlanAssetRow | null) ?? null;
}

export type FloorPlanReadRow = {
  status: string;
  created_at: string | null;
  input_summary: Record<string, unknown> | null;
  output_summary: Record<string, unknown> | null;
};

export async function newestFloorPlanReadJob(
  supabase: UserSupabaseClient,
  roomId: string
): Promise<FloorPlanReadRow | null> {
  const { data, error } = await supabase
    .from("ai_jobs")
    .select("status, created_at, input_summary, output_summary")
    .eq("room_id", roomId)
    .eq("job_type", "floor_plan_read")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as FloorPlanReadRow | null) ?? null;
}

export function jobAssetId(job: FloorPlanReadRow | null): string | null {
  const value = job?.input_summary?.assetId;
  return typeof value === "string" ? value : null;
}

// The rows, in the shape the decision and the screen take. One mapping for
// the read and for the page, because the defect this closes was the two of
// them reaching different answers about the same plan (PR review).
export function floorPlanAssetInput(row: FloorPlanAssetRow | null): FloorPlanAsset | null {
  return row ? { id: row.id, mimeType: row.mime_type, widthPx: row.width_px, heightPx: row.height_px } : null;
}

export function floorPlanJobInput(row: FloorPlanReadRow | null): FloorPlanReadJob | null {
  return row ? { assetId: jobAssetId(row), status: row.status, startedAt: row.created_at } : null;
}

export async function readFloorPlanForRoom(
  {
    roomId,
    userId,
    supabase,
    serviceSupabase
  }: {
    roomId: string;
    userId: string;
    supabase: UserSupabaseClient;
    serviceSupabase: ServiceSupabaseClient;
  },
  {
    // Injectable so the persisted transitions are testable without a live
    // provider, the way the spec extraction runner is.
    readPlan = readFloorPlanRooms,
    planDataUrl = storageImageDataUrl
  }: {
    readPlan?: typeof readFloorPlanRooms;
    planDataUrl?: typeof storageImageDataUrl;
  } = {}
): Promise<FloorPlanReadOutcome> {
  const asset = await newestFloorPlanAsset(supabase, roomId);
  const job = await newestFloorPlanReadJob(supabase, roomId);

  const { action } = floorPlanReadDecision({ asset: floorPlanAssetInput(asset), newestJob: floorPlanJobInput(job) });

  if (action !== "read" || !asset) {
    return { status: "skipped", reason: action };
  }

  // The bytes come first. A row opened before them would have to be closed
  // again for a failure that cost nothing.
  //
  // They are also what the readable floor is judged on. `mime_type`,
  // `width_px` and `height_px` on `room_assets` are written by the browser and
  // RLS lets an owner write the row directly, so a forged 2400 by 1600 on a
  // thumbnail buys a paid call that criterion 14 says to refuse. The decision
  // above uses the row because it is free; this checks the file (cross-model
  // review).
  //
  // And what the file turns out to be is written back to the row. The screen
  // renders from rows and from nothing else, so a refusal that was only
  // returned left the page deciding from what the browser had declared: a
  // readable image with no read against it, which it rendered as "Reading your
  // floor plan" for ever (PR review). Written, the page reaches the refusal
  // this did, on every load. So does the concept path, which decides whether to
  // send a plan by the same column and would otherwise put these bytes in a
  // paid call.
  const measured = await measurePlan(supabase, asset.storage_path);
  if (measured.outcome === "unreadable") {
    // Bytes no decoder can open are bytes no model can read. A first version
    // treated every measurement failure as "believe the row", which let PDF
    // bytes declared as `image/png` walk past the format check and spend
    // (cross-model gate, round three). A download that fails is different:
    // that is transient, and refusing it would turn a storage blip into a
    // missing feature.
    await correctPlanAsset(supabase, asset.id, { mime_type: measured.mimeType });
    return { status: "skipped", reason: "unreadable_format" };
  }
  if (measured.outcome === "measured" && Math.max(measured.widthPx, measured.heightPx) < PLAN_READABLE_MIN_EDGE_PX) {
    await correctPlanAsset(supabase, asset.id, { width_px: measured.widthPx, height_px: measured.heightPx });
    return { status: "skipped", reason: "too_small" };
  }

  const dataUrl = await planDataUrl(supabase, "room-assets", asset.storage_path, asset.mime_type, planImageOptions());
  if (!dataUrl) {
    return { status: "failed", message: "The floor plan could not be prepared for reading." };
  }

  const { data: opened, error: openError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: userId,
      room_id: roomId,
      job_type: "floor_plan_read",
      status: "running",
      provider: "openai",
      model: stageTextConfig("floor_plan_read", configuredTextModel()).model,
      prompt_version: null,
      input_summary: { assetId: asset.id }
    })
    .select("id")
    .single();

  if (openError || !opened) {
    throw new Error(openError?.message ?? "The floor plan read could not be started.");
  }

  try {
    const result = await readPlan({ planImageDataUrl: dataUrl });
    await closeAiJob(
      serviceSupabase,
      opened.id,
      {
        status: "succeeded",
        cost_estimate_usd: result.textCostUsd,
        prompt_version: result.promptVersion,
        // The whole answer, because this row is what the screen renders from.
        output_summary: {
          unitRead: result.read.unitRead,
          roomsFound: result.read.roomsFound,
          rooms: result.read.rooms
        }
      },
      "floor plan read"
    );
    return { status: "read", rooms: result.read.rooms, unitRead: result.read.unitRead };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The floor plan could not be read.";
    // No cost on this path: the provider gives no usage to price when the call
    // does not complete, which is what `analyzeAndWriteInspirationForRoom`
    // does too. The row is still closed, so nothing is left running.
    await closeAiJob(serviceSupabase, opened.id, { status: "failed", error_message: message }, "floor plan read");
    return { status: "failed", message };
  }
}

// What she confirmed, and what confirming it is worth (S5b).
//
// Two independent halves, because a plan can give one without the other. The
// dimensions fill the measurement fields, written with the plan as their
// source. The name tells the concept and revision prompts which room on the
// drawing is hers (`floorPlanLanguage`; the crop that once did this was
// withdrawn). A villa brochure gives the second and not the first; an estate
// agent's plan of one apartment gives both.

export type ConfirmRoomOutcome =
  | {
      status: "confirmed";
      wroteMeasurements: boolean;
      // True when the plan gave this room no size AND a row from confirming
      // another room off the same drawing had to be cleared, so the screen can
      // say the measurements went with it.
      supersededAnotherRoom: boolean;
      label: string;
    }
  | { status: "stale" }
  | { status: "not_found" };

export function detectedRoomsOnJob(job: FloorPlanReadRow | null): DetectedRoom[] {
  return boundedDetectedRooms(job?.output_summary?.rooms);
}

export async function confirmDetectedRoom(
  {
    roomId,
    roomIndex,
    supabase
  }: {
    roomId: string;
    roomIndex: number;
    supabase: UserSupabaseClient;
  }
): Promise<ConfirmRoomOutcome> {
  const asset = await newestFloorPlanAsset(supabase, roomId);
  const job = await newestFloorPlanReadJob(supabase, roomId);

  // The list she clicked has to be the list of the plan that is attached. If
  // the plan changed underneath her, confirming would write one drawing's
  // numbers against another drawing's id.
  if (!asset || !job || jobAssetId(job) !== asset.id) {
    return { status: "stale" };
  }

  // The index comes from a client, and a server action's arguments are not
  // typed at runtime: a non-integer would index the array's prototype and hand
  // back something that passes a truth test (security review).
  const rooms = detectedRoomsOnJob(job);
  const room =
    Number.isInteger(roomIndex) && roomIndex >= 0 && roomIndex < rooms.length ? rooms[roomIndex] : null;
  if (!room) {
    return { status: "not_found" };
  }

  // What is on record now, and whether it describes a DIFFERENT room she
  // confirmed off this same drawing. Both questions decide what gets written.
  const { data: previous, error: previousError } = await supabase
    .from("room_measurements")
    .select("wall_length_cm, room_depth_cm, ceiling_height_cm, notes, source, floor_plan_asset_id")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousError) {
    throw new Error(previousError.message);
  }

  const supersedesAnotherRoom = previous?.source === "floor_plan" && previous.floor_plan_asset_id === asset.id;
  const dimensioned = roomIsDimensioned(room);

  // A plan almost never prints a ceiling height and never writes a note, so a
  // row built from one alone would blank both, and every reader takes the
  // newest row: a ceiling she typed would vanish from the form and the concept
  // prompt would gain "measurements were not provided" for a room that just
  // got a better wall length. Carried forward the way `saveDesignBriefAction`
  // carries a note it has no field for (review finding).
  //
  // Carried on the superseding path too. A first version dropped them there,
  // reasoning that the row belonged to the other room, but a ceiling and a
  // note never come from the plan: they are hers, whichever room she picks
  // (review finding, which caught the test that could not see the loss).
  const carried = { ceiling: previous?.ceiling_height_cm ?? null, notes: previous?.notes ?? null };

  // Writing happens when the plan has dimensions to write, and also when it
  // has none but the newest row is another room's confirmation off this same
  // drawing. Leaving that row would pair one room's measurements with another
  // room's crop and name, and size a paid concept to a room it was never
  // shown (review finding).
  const wroteMeasurements = dimensioned || supersedesAnotherRoom;
  if (wroteMeasurements) {
    // `verified` is what keeps dimension-aware product fit switched on, and
    // the chip she clicked carried these numbers, so the click is a person
    // confirming what she can see. A superseding row with nothing to say is
    // `unknown`, which is what it knows.
    const { error } = await supabase.from("room_measurements").insert({
      room_id: roomId,
      source: "floor_plan",
      confidence: dimensioned ? "verified" : "unknown",
      wall_length_cm: room.wallLengthCm,
      room_depth_cm: room.roomDepthCm,
      ceiling_height_cm: room.ceilingHeightCm ?? carried.ceiling,
      notes: carried.notes,
      floor_plan_asset_id: asset.id
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  await writeConfirmedRoom(supabase, roomId, { assetId: asset.id, label: room.label, index: roomIndex });

  return {
    status: "confirmed",
    wroteMeasurements: dimensioned,
    supersededAnotherRoom: wroteMeasurements && !dimensioned,
    label: room.label
  };
}


async function writeConfirmedRoom(
  supabase: UserSupabaseClient,
  roomId: string,
  floorPlan: ConfirmedFloorPlanRoom
): Promise<void> {
  // Through the column's one guarded writer, so a save landing between this
  // read and this write cannot take the room with it, and vice versa.
  await writeBriefDocument(supabase, roomId, { merge: (current) => ({ ...current, floorPlan }) });
}

// What the file actually is, as opposed to what the row says it is.
//
// Three answers, and the difference between the last two is the point. Bytes
// that no decoder can open are `unreadable` and refused: a model cannot read
// them either, and `mime_type` on the row is written by the browser, so PDF
// bytes declared as `image/png` arrive here looking legitimate. A download
// that fails is `unavailable`, which is transient and believed, because
// refusing it would turn a storage blip into a missing feature.
type PlanMeasurement =
  | { outcome: "measured"; widthPx: number; heightPx: number }
  | { outcome: "unreadable"; mimeType: string }
  | { outcome: "unavailable" };

async function measurePlan(supabase: UserSupabaseClient, storagePath: string): Promise<PlanMeasurement> {
  const { data, error } = await supabase.storage.from("room-assets").download(storagePath);
  if (error || !data) {
    return { outcome: "unavailable" };
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(bytes).metadata();
    // As displayed, which is what the browser records, so a corrected row
    // agrees with the rows the uploader writes for a photograph turned on its
    // side.
    const widthPx = meta.autoOrient?.width ?? meta.width ?? 0;
    const heightPx = meta.autoOrient?.height ?? meta.height ?? 0;
    if (widthPx > 0 && heightPx > 0) {
      return { outcome: "measured", widthPx, heightPx };
    }
  } catch {
    // No decoder recognised the bytes, which is the answer below.
  }
  // `%PDF-` opens every PDF.
  const isPdf = bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  return { outcome: "unreadable", mimeType: isPdf ? PDF_MIME_TYPE : UNKNOWN_BYTES_MIME_TYPE };
}

// The plan's row corrected to what the file is. Through the shopper's own
// client, so RLS stays the authority on whose row this is.
async function correctPlanAsset(
  supabase: UserSupabaseClient,
  assetId: string,
  truth: { mime_type?: string; width_px?: number; height_px?: number }
): Promise<void> {
  const { error } = await supabase.from("room_assets").update(truth).eq("id", assetId);
  if (error) {
    throw new Error(error.message);
  }
}
