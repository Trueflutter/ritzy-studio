import { visionImageDataUrl } from "@/lib/render-images";

import { storageImageDataUrl } from "./storage-images";
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
    .select("storage_path, mime_type")
    .eq("room_id", roomId)
    .eq("asset_type", "floor_plan")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const floorPlanImageUrl = floorPlanAsset?.mime_type?.startsWith("image/")
    ? await storageImageDataUrl(supabase, "room-assets", floorPlanAsset.storage_path, floorPlanAsset.mime_type)
    : null;

  return {
    roomPhoto,
    signedPhotoUrl: signedPhoto?.signedUrl ?? null,
    photoBytes: !downloadError && photoBlob ? Buffer.from(await photoBlob.arrayBuffer()) : null,
    additionalRoomPhotos,
    floorPlanImageUrl
  };
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
    .createSignedUrl(renderAsset.storage_path, 60 * 30);

  return {
    bytes: Buffer.from(await renderBlob.arrayBuffer()),
    mimeType: renderAsset.mime_type ?? "image/png",
    storagePath: renderAsset.storage_path,
    signedUrl: signed?.signedUrl ?? null
  };
}
