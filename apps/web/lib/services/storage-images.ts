import { visionImageDataUrl } from "@/lib/render-images";

import type { ServiceSupabaseClient, UserSupabaseClient } from "./supabase-clients";

// Downloads a storage object and returns it as a downscaled vision data URL.
// Signed URLs expire and some buckets are private; bytes-through-data-URL is the
// only shape every vision provider accepts without a reachability dependency.
export async function storageImageDataUrl(
  client: ServiceSupabaseClient | UserSupabaseClient,
  bucket: string,
  path: string,
  mimeType?: string | null
) {
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) {
    return null;
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const contentType = mimeType ?? (data.type || "image/jpeg");
  return visionImageDataUrl(buffer, contentType);
}
