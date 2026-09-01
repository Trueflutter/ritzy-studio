export const INSPIRATION_ANALYSIS_CONTINUE_FAILURE_MESSAGE =
  "We couldn't read the inspiration image yet. You can continue manually or try again.";

export type InspirationAnalysisContinueDecision =
  | "continue_without_analysis"
  | "run_analysis"
  | "use_existing_analysis";

export function hasStructuredInspirationAnalysis(structuredJson: unknown) {
  if (!structuredJson || typeof structuredJson !== "object" || Array.isArray(structuredJson)) {
    return false;
  }

  const analysis = (structuredJson as { inspirationAnalysis?: unknown }).inspirationAnalysis;
  if (!analysis || typeof analysis !== "object" || Array.isArray(analysis)) {
    return false;
  }

  return typeof (analysis as { styleDirection?: unknown }).styleDirection === "string";
}

export function inspirationAnalysisContinueDecision({
  inspirationAssetCount,
  structuredJson
}: {
  inspirationAssetCount: number;
  structuredJson: unknown;
}): InspirationAnalysisContinueDecision {
  if (hasStructuredInspirationAnalysis(structuredJson)) {
    return "use_existing_analysis";
  }

  return inspirationAssetCount > 0 ? "run_analysis" : "continue_without_analysis";
}
