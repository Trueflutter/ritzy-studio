import { floorPlanReadDecision, type DetectedRoom, type FloorPlanReadAction } from "@ritzy-studio/domain";
import { readFloorPlanRooms, stageTextConfig } from "@ritzy-studio/ai";
import { configuredTextModel } from "@ritzy-studio/config";

import { closeAiJob } from "./close-ai-job";
import { storagePlanImageDataUrl } from "./storage-images";
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
  input_summary: Record<string, unknown> | null;
  output_summary: Record<string, unknown> | null;
};

export async function newestFloorPlanReadJob(
  supabase: UserSupabaseClient,
  roomId: string
): Promise<FloorPlanReadRow | null> {
  const { data, error } = await supabase
    .from("ai_jobs")
    .select("status, input_summary, output_summary")
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
    planDataUrl = storagePlanImageDataUrl
  }: {
    readPlan?: typeof readFloorPlanRooms;
    planDataUrl?: typeof storagePlanImageDataUrl;
  } = {}
): Promise<FloorPlanReadOutcome> {
  const asset = await newestFloorPlanAsset(supabase, roomId);
  const job = await newestFloorPlanReadJob(supabase, roomId);

  const { action } = floorPlanReadDecision({
    asset: asset
      ? { id: asset.id, mimeType: asset.mime_type, widthPx: asset.width_px, heightPx: asset.height_px }
      : null,
    newestJob: job ? { assetId: jobAssetId(job), status: job.status } : null
  });

  if (action !== "read" || !asset) {
    return { status: "skipped", reason: action };
  }

  // The bytes come first. A row opened before them would have to be closed
  // again for a failure that cost nothing.
  const dataUrl = await planDataUrl(supabase, "room-assets", asset.storage_path, asset.mime_type);
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
