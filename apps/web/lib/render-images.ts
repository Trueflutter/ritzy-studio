import sharp from "sharp";

import {
  buildReferenceHostAllowlist,
  followGuardedRedirects,
  guardReferenceUrl,
  readResponseBytesCapped
} from "@ritzy-studio/ai";
import { configuredImageModelName, configuredImageProvider as configImageProvider } from "@ritzy-studio/config";

// Shared image helpers for the AI generation paths. Extracted from app/actions.ts so the
// durable render runner (lib/render-runner.ts) can reuse them outside the "use server" module,
// which may only export async server actions.

export type CatalogueReferenceImage = {
  bytes: Buffer;
  mimeType: string;
};

export const PRODUCT_SOURCING_MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// Real catalogue reference images (Home Centre media CDN) are frequently 2-3 MB and take longer
// than a couple of seconds to download. At 2.5s the largest-image roles (rugs especially) had
// EVERY candidate time out ("without a fetchable reference image"), which blocked the whole
// concept ("we need a little more catalogue evidence"). The grounding loop breaks on the first
// fetchable candidate, so a longer ceiling keeps the happy path fast while rescuing large images.
const CATALOGUE_GROUNDED_CONCEPT_IMAGE_FETCH_TIMEOUT_MS = 12_000;

// Thin delegations kept for existing import sites; the defaults live in the config
// schema, not here.
export function configuredImageProvider() {
  return configImageProvider();
}

export function configuredImageModel() {
  return configuredImageModelName();
}

function bytesToDataUrl(bytes: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

// Vision models tile images at ~1k px; sending multi-megabyte originals only
// adds cost, latency, and gateway cost-estimate rejections. Downscale for
// vision inputs; image-GENERATION references keep original bytes.
export async function visionImageDataUrl(bytes: Buffer, mimeType: string) {
  try {
    const resized = await sharp(bytes)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    return `data:image/jpeg;base64,${resized.toString("base64")}`;
  } catch {
    return bytesToDataUrl(bytes, mimeType);
  }
}

function remoteImageAllowlist() {
  return buildReferenceHostAllowlist({
    configured: process.env.RITZY_REFERENCE_IMAGE_HOSTS,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
  });
}

type FetchImpl = (input: string | URL, init?: RequestInit) => Promise<Response>;

export async function fetchRemoteImage(
  url: string,
  fetchImpl: FetchImpl = fetch
): Promise<CatalogueReferenceImage | null> {
  // Every remote image fetch goes through the shared reference guard: known-breaking
  // resize params stripped, hosts restricted to the retailer/storage allowlist,
  // redirects re-validated hop by hop by the ONE follower in @ritzy-studio/ai.
  // Refusals return null, which callers already treat as "no fetchable reference
  // image".
  const allowlist = remoteImageAllowlist();
  const stripHosts = process.env.RITZY_REFERENCE_STRIP_QUERY_HOSTS
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const guarded = guardReferenceUrl(url, { allowlist, stripQueryHosts: stripHosts });
  if (!guarded.ok) {
    // Distinct from a CDN flake: this URL was refused by policy, not unreachable.
    console.warn(`[reference-guard] refusing remote image fetch: ${guarded.reason}`);
    return null;
  }

  // Retailer CDNs rate-limit and flake; one quick retry rescues most transient
  // failures without meaningfully slowing the happy path.
  const first = await fetchRemoteImageOnce(guarded.url, allowlist, fetchImpl);
  if (first) {
    return first;
  }
  await new Promise((resolve) => setTimeout(resolve, 750));
  return fetchRemoteImageOnce(guarded.url, allowlist, fetchImpl);
}

async function fetchRemoteImageOnce(
  url: string,
  allowlist: Set<string>,
  fetchImpl: FetchImpl
): Promise<CatalogueReferenceImage | null> {
  // Never throws: any failure (refusal, redirect escape, HTTP error, mid-body reset,
  // body-read deadline) returns null so one bad reference degrades to "no image"
  // instead of failing a whole render or sourcing operation.
  try {
    const followed = await followGuardedRedirects(url, {
      allowlist,
      fetchImpl,
      timeoutMs: CATALOGUE_GROUNDED_CONCEPT_IMAGE_FETCH_TIMEOUT_MS,
      // Redirect chains must not multiply the per-fetch deadline.
      overallTimeoutMs: CATALOGUE_GROUNDED_CONCEPT_IMAGE_FETCH_TIMEOUT_MS,
      method: "GET"
    });
    if (!followed.ok || !followed.response.ok) {
      return null;
    }
    const response = followed.response;

    const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      void response.body?.cancel().catch(() => {});
      return null;
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > PRODUCT_SOURCING_MAX_IMAGE_BYTES) {
      void response.body?.cancel().catch(() => {});
      return null;
    }

    const bytes = await readResponseBytesCapped(
      response,
      PRODUCT_SOURCING_MAX_IMAGE_BYTES,
      CATALOGUE_GROUNDED_CONCEPT_IMAGE_FETCH_TIMEOUT_MS
    );
    if (!bytes) {
      return null;
    }

    return {
      bytes: Buffer.from(bytes),
      mimeType
    };
  } catch {
    return null;
  }
}
