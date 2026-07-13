import sharp from "sharp";

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

export function configuredImageProvider() {
  return process.env.RITZY_IMAGE_PROVIDER ?? "openai";
}

export function configuredImageModel() {
  const provider = configuredImageProvider();
  if (provider === "evolink") {
    return process.env.EVOLINK_IMAGE_MODEL ?? "gemini-3.1-flash-image-preview";
  }
  if (provider === "gemini") {
    return process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image-preview";
  }
  return process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
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

export async function fetchRemoteImage(url: string): Promise<CatalogueReferenceImage | null> {
  // Retailer CDNs rate-limit and flake; one quick retry rescues most transient
  // failures without meaningfully slowing the happy path.
  const first = await fetchRemoteImageOnce(url);
  if (first) {
    return first;
  }
  await new Promise((resolve) => setTimeout(resolve, 750));
  return fetchRemoteImageOnce(url);
}

async function fetchRemoteImageOnce(url: string): Promise<CatalogueReferenceImage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CATALOGUE_GROUNDED_CONCEPT_IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "RitzyStudioBot/0.1 (+https://ritzy-studio.local; final render references)"
      }
    });

    if (!response.ok) {
      return null;
    }

    const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      return null;
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > PRODUCT_SOURCING_MAX_IMAGE_BYTES) {
      return null;
    }

    const bytes = await readResponseBytesWithLimit(response, PRODUCT_SOURCING_MAX_IMAGE_BYTES);
    if (!bytes) {
      return null;
    }

    return {
      bytes: Buffer.from(bytes),
      mimeType
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBytesWithLimit(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) {
    return null;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return null;
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks, totalBytes);
}
