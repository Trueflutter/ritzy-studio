export type ProductSourcingFailureKind = "provider_image_download" | "timeout" | "other";

export function classifyProductSourcingFailure(error: unknown): ProductSourcingFailureKind {
  if (isProviderImageDownloadError(error)) {
    return "provider_image_download";
  }

  if (isProductSourcingTimeoutError(error)) {
    return "timeout";
  }

  return "other";
}

export function productSourcingTimeoutMessage() {
  return "Product sourcing took longer than expected. Please try matching products again in a minute.";
}

export function productSourcingGenericFailureMessage() {
  return "Product sourcing could not complete. Please try sourcing again.";
}

export function isProductSourcingTimeoutError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  if (normalized.includes("product visual sourcing") && normalized.includes("timed out")) {
    return true;
  }
  // The OpenAI SDK's own client deadline ("Request timed out.") can fire before the
  // outer sourcing wrapper when RITZY_TEXT_TIMEOUT_MS is set below it; both mean the
  // same thing here, and both must route to the text fallback instead of failing the room.
  return normalized.includes("request timed out");
}

export function isProviderImageDownloadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  return (
    normalized.includes("unable to download content") ||
    normalized.includes("download content from the provided url") ||
    normalized.includes("invalid image url") ||
    normalized.includes("failed to download image") ||
    normalized.includes("could not download image")
  );
}
