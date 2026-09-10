import { floorPlanCropBox } from "@ritzy-studio/domain";

import { croppedVisionImageDataUrl, visionImageDataUrl } from "@/lib/render-images";

import { storageImageDataUrl } from "./storage-images";
import { structuredBriefJson } from "./sourcing-support";
import type { ServiceSupabaseClient, UserSupabaseClient } from "./supabase-clients";

// The room's image inputs for AI calls, assembled ONE way (S2 gauntlet finding):
// concept generation and revision must always see the same photo set, ordering,
// and floor plan, or the two paths' architecture ground truth silently diverges.

export type AdditionalRoomPhoto = {
  url: string;
  referenceUrl: string | null;
  bytes: Buffer;
  mimeType: string;
};

export type RoomImageInputs = {
  roomPhoto: { id: string; storage_path: string; mime_type: string } | null;
  signedPhotoUrl: string | null;
  photoBytes: Buffer | null;
  additionalRoomPhotos: AdditionalRoomPhoto[];
  floorPlanImageUrl: string | null;
};

export async function roomImageInputs(
  supabase: UserSupabaseClient,
  roomId: string
): Promise<RoomImageInputs> {
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
    return {
      roomPhoto: null,
      signedPhotoUrl: null,
      photoBytes: null,
      additionalRoomPhotos: [],
      floorPlanImageUrl: null
    };
  }

  const { data: signedPhoto } = await supabase.storage
    .from("room-assets")
    .createSignedUrl(roomPhoto.storage_path, 60 * 30);

  const { data: photoBlob, error: downloadError } = await supabase.storage
    .from("room-assets")
    .download(roomPhoto.storage_path);

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
    .select("id, storage_path, mime_type")
    .eq("room_id", roomId)
    .eq("asset_type", "floor_plan")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // The prompt that receives this asserts it is THIS room's plan ("use it to
  // understand the room's true footprint, door and window positions"). Since
  // S5b invites whole-home drawings, that sentence is only true once the
  // drawing is cut down to the room she confirmed, so the crop happens here,
  // on the way to the model, and nothing is stored (S5b).
  const { data: brief } = await supabase
    .from("design_briefs")
    .select("structured_json")
    .eq("room_id", roomId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const cropBox = floorPlanCropBox({
    recorded: structuredBriefJson(brief?.structured_json).floorPlan,
    attachedAssetId: floorPlanAsset?.id ?? null
  });

  const floorPlanImageUrl = floorPlanAsset?.mime_type?.startsWith("image/")
    ? await floorPlanDataUrl(supabase, floorPlanAsset, cropBox)
    : null;

  return {
    roomPhoto,
    signedPhotoUrl: signedPhoto?.signedUrl ?? null,
    photoBytes: !downloadError && photoBlob ? Buffer.from(await photoBlob.arrayBuffer()) : null,
    additionalRoomPhotos,
    floorPlanImageUrl
  };
}

// Signed display URL for a concept's primary render, no bytes downloaded (the
// stored-spec fast path needs a URL, not the image). One TTL for every consumer.
const RENDER_SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function signedConceptRenderUrl(
  {
    supabase,
    serviceSupabase
  }: { supabase: UserSupabaseClient; serviceSupabase: ServiceSupabaseClient },
  primaryImageAssetId: string | null
): Promise<string | null> {
  if (!primaryImageAssetId) {
    return null;
  }
  const { data: renderAsset } = await supabase
    .from("room_assets")
    .select("storage_path")
    .eq("id", primaryImageAssetId)
    .maybeSingle();
  if (!renderAsset) {
    return null;
  }
  const { data: signed } = await serviceSupabase.storage
    .from("generated-renders")
    .createSignedUrl(renderAsset.storage_path, RENDER_SIGNED_URL_TTL_SECONDS);
  return signed?.signedUrl ?? null;
}

// The concept's primary render, resolved ONE way for every consumer (spec
// extraction, revision base image, and the /spec page's display).
export async function conceptPrimaryRender(
  {
    supabase,
    serviceSupabase
  }: { supabase: UserSupabaseClient; serviceSupabase: ServiceSupabaseClient },
  primaryImageAssetId: string | null
): Promise<{ bytes: Buffer; mimeType: string; storagePath: string; signedUrl: string | null } | null> {
  if (!primaryImageAssetId) {
    return null;
  }

  const { data: renderAsset } = await supabase
    .from("room_assets")
    .select("storage_path, mime_type")
    .eq("id", primaryImageAssetId)
    .maybeSingle();

  if (!renderAsset) {
    return null;
  }

  const { data: renderBlob, error: renderError } = await serviceSupabase.storage
    .from("generated-renders")
    .download(renderAsset.storage_path);

  if (renderError || !renderBlob) {
    return null;
  }

  const { data: signed } = await serviceSupabase.storage
    .from("generated-renders")
    .createSignedUrl(renderAsset.storage_path, RENDER_SIGNED_URL_TTL_SECONDS);

  return {
    bytes: Buffer.from(await renderBlob.arrayBuffer()),
    mimeType: renderAsset.mime_type ?? "image/png",
    storagePath: renderAsset.storage_path,
    signedUrl: signed?.signedUrl ?? null
  };
}

async function floorPlanDataUrl(
  supabase: UserSupabaseClient,
  asset: { storage_path: string; mime_type: string },
  cropBox: Parameters<typeof croppedVisionImageDataUrl>[2] | null
) {
  if (!cropBox) {
    return storageImageDataUrl(supabase, "room-assets", asset.storage_path, asset.mime_type);
  }

  const { data, error } = await supabase.storage.from("room-assets").download(asset.storage_path);
  if (error || !data) {
    return null;
  }
  return croppedVisionImageDataUrl(Buffer.from(await data.arrayBuffer()), asset.mime_type, cropBox);
}
