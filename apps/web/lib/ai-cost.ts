// Aggregates per-view gateway credits for an ai_jobs.cost_estimate_usd write. Returns null
// (not 0) when no outcome carried a credits figure — non-Evolink providers report nothing,
// and a null cost must read as "unknown", never "free".
export function sumOutcomeCredits(
  outcomes: Array<{ ok: boolean; creditsUsed?: number | null }>
): number | null {
  const credits = outcomes
    .map((outcome) => (outcome.ok ? outcome.creditsUsed : null))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (credits.length === 0) {
    return null;
  }
  return credits.reduce((total, value) => total + value, 0);
}
