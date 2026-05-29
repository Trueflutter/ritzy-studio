export type ProductSourcingAttemptKind = "initial_visual_sourcing" | "retry_missing_required_roles";

export type ProductSourcingFallbackReason =
  | "initial_visual_sourcing_timeout"
  | "retry_visual_sourcing_timeout"
  | "product_candidate_images_disabled"
  | "none";

export type ProductSourcingTimeoutDiagnosticInput = {
  attemptKind?: ProductSourcingAttemptKind;
  attemptDurationMs: number | null;
  timeoutMs: number;
  timedOut: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  candidateCount: number;
  rolePoolCount: number;
  conceptImageDetail: "low" | "high" | "auto";
  candidateImageLimit: number;
  productCandidateImagesEnabled: boolean;
  retry?: {
    attempted: boolean;
    attemptDurationMs: number | null;
    timedOut: boolean;
    fallbackUsed: boolean;
    fallbackReason: string | null;
    providerImageDownloadFailure: boolean;
    imageGateUsable: boolean | null;
  };
};

export type ProductSourcingTimeoutDiagnostics = {
  attemptKind: ProductSourcingAttemptKind;
  initialAttemptDurationMs: number | null;
  timeoutMs: number;
  timedOut: boolean;
  fallbackUsed: boolean;
  fallbackReason: ProductSourcingFallbackReason;
  fallbackSourcePath: "visual" | "text_fallback";
  isolationReason:
    | "visual_sourcing_completed"
    | "visual_sourcing_timeout_text_fallback"
    | "visual_sourcing_skipped_product_images_disabled_text_fallback"
    | "retry_visual_sourcing_timeout"
    | "retry_visual_sourcing_skipped_product_images_disabled_text_fallback"
    | "visual_sourcing_failed_without_timeout";
  canDistinguishTimeoutFromSemanticQuality: boolean;
  candidateCount: number;
  rolePoolCount: number;
  conceptImageDetail: "low" | "high" | "auto";
  candidateImageLimit: number;
  productCandidateImagesEnabled: boolean;
  retry: {
    attempted: boolean;
    attemptDurationMs: number | null;
    timedOut: boolean;
    fallbackUsed: boolean;
    fallbackReason: ProductSourcingFallbackReason;
    providerImageDownloadFailure: boolean;
    imageGateUsable: boolean | null;
  };
};

function normalizeFallbackReason(reason: string | null): ProductSourcingFallbackReason {
  if (
    reason === "initial_visual_sourcing_timeout" ||
    reason === "retry_visual_sourcing_timeout" ||
    reason === "product_candidate_images_disabled"
  ) {
    return reason;
  }

  return "none";
}

export function buildProductSourcingTimeoutDiagnostics({
  attemptKind = "initial_visual_sourcing",
  attemptDurationMs,
  timeoutMs,
  timedOut,
  fallbackUsed,
  fallbackReason,
  candidateCount,
  rolePoolCount,
  conceptImageDetail,
  candidateImageLimit,
  productCandidateImagesEnabled,
  retry
}: ProductSourcingTimeoutDiagnosticInput): ProductSourcingTimeoutDiagnostics {
  const normalizedFallbackReason = normalizeFallbackReason(fallbackReason);
  const retryTimedOut = retry?.timedOut ?? false;
  const retryFallbackReason = normalizeFallbackReason(retry?.fallbackReason ?? null);
  const fallbackSourcePath = fallbackUsed ? "text_fallback" : "visual";
  const isolationReason = timedOut
    ? "visual_sourcing_timeout_text_fallback"
    : normalizedFallbackReason === "product_candidate_images_disabled"
      ? "visual_sourcing_skipped_product_images_disabled_text_fallback"
      : retryFallbackReason === "product_candidate_images_disabled"
        ? "retry_visual_sourcing_skipped_product_images_disabled_text_fallback"
      : retryTimedOut
        ? "retry_visual_sourcing_timeout"
        : fallbackUsed
          ? "visual_sourcing_failed_without_timeout"
          : "visual_sourcing_completed";

  return {
    attemptKind,
    initialAttemptDurationMs: attemptDurationMs,
    timeoutMs,
    timedOut,
    fallbackUsed,
    fallbackReason: normalizedFallbackReason,
    fallbackSourcePath,
    isolationReason,
    canDistinguishTimeoutFromSemanticQuality:
      timedOut ||
      retryTimedOut ||
      !fallbackUsed ||
      normalizedFallbackReason === "product_candidate_images_disabled" ||
      retryFallbackReason === "product_candidate_images_disabled",
    candidateCount,
    rolePoolCount,
    conceptImageDetail,
    candidateImageLimit,
    productCandidateImagesEnabled,
    retry: {
      attempted: retry?.attempted ?? false,
      attemptDurationMs: retry?.attemptDurationMs ?? null,
      timedOut: retryTimedOut,
      fallbackUsed: retry?.fallbackUsed ?? false,
      fallbackReason: retryFallbackReason,
      providerImageDownloadFailure: retry?.providerImageDownloadFailure ?? false,
      imageGateUsable: retry?.imageGateUsable ?? null
    }
  };
}
