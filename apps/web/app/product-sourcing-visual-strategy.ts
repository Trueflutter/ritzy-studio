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
