// Aggregates per-view gateway credits for an ai_jobs.cost_estimate_usd write. Counts every
// outcome that reported credits — a generation that succeeded but whose upload/insert failed
// still consumed them (review P2). Returns null (not 0) when no outcome carried a figure:
// non-Evolink providers report nothing, and a null cost must read as "unknown", never "free".
export function sumOutcomeCredits(outcomes: Array<{ creditsUsed?: number | null }>): number | null {
  const credits = outcomes
    .map((outcome) => outcome.creditsUsed)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (credits.length === 0) {
    return null;
  }
  return credits.reduce((total, value) => total + value, 0);
}
