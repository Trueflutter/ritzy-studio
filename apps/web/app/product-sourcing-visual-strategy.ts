export type ProductSourcingVisualStrategyInput = {
  productCandidateImagesEnabled: boolean;
  candidateImageLimit: number;
  rolePoolCount: number;
};

export type ProductSourcingVisualStrategy = {
  shouldAttemptVisualSourcing: boolean;
  fallbackReason: "product_candidate_images_disabled" | null;
  evidenceNote: string | null;
};

export function productSourcingVisualStrategy({
  productCandidateImagesEnabled,
  candidateImageLimit,
  rolePoolCount
}: ProductSourcingVisualStrategyInput): ProductSourcingVisualStrategy {
  if (!productCandidateImagesEnabled && candidateImageLimit === 0 && rolePoolCount > 0) {
    return {
      shouldAttemptVisualSourcing: false,
      fallbackReason: "product_candidate_images_disabled",
      evidenceNote: "Product candidate images were disabled; deterministic text fallback was used without waiting for visual sourcing."
    };
  }

  return {
    shouldAttemptVisualSourcing: true,
    fallbackReason: null,
    evidenceNote: null
  };
}

export type ProductSourcingRetryFallbackEvidence = {
  retryAttempted: boolean;
  retryAttemptDurationMs: number;
  retryTimedOut: boolean;
  retryFallbackUsed: boolean;
  retryFallbackReason: "product_candidate_images_disabled";
  retryProviderImageDownloadFailure: boolean;
  retryImageGateUsable: boolean | null;
};

export function productSourcingRetryFallbackEvidenceForStrategy(
  strategy: ProductSourcingVisualStrategy
): ProductSourcingRetryFallbackEvidence | null {
  if (strategy.shouldAttemptVisualSourcing || strategy.fallbackReason !== "product_candidate_images_disabled") {
    return null;
  }

  return {
    retryAttempted: true,
    retryAttemptDurationMs: 0,
    retryTimedOut: false,
    retryFallbackUsed: true,
    retryFallbackReason: strategy.fallbackReason,
    retryProviderImageDownloadFailure: false,
    retryImageGateUsable: null
  };
}
