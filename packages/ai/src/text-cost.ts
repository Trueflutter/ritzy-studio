// USD cost estimation for text/vision (Responses API) calls, so every ai_jobs row can
// carry cost_estimate_usd instead of only the image stages. Rates are published
// per-1M-token prices; unknown models record null rather than a fabricated number.

export type TextUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
} | null | undefined;

// input / output USD per 1M tokens. Cached-input discounts are ignored, which slightly
// overestimates; the estimate is telemetry, not billing.
const TEXT_MODEL_RATES_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-5-mini": { input: 0.25, output: 2.0 },
  "gpt-5.1": { input: 1.25, output: 10.0 }
};

export function estimateTextCostUsd(model: string, usage: TextUsage): number | null {
  if (!usage) {
    return null;
  }
  const rates = TEXT_MODEL_RATES_PER_MILLION[model];
  if (!rates) {
    return null;
  }
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const usd = (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
  // 6 decimal places keeps sub-cent calls visible without float noise.
  return Math.round(usd * 1_000_000) / 1_000_000;
}

// Adds the costs that are known; returns null only when nothing is known, so an
// unknown stage never masquerades as free.
export function sumUsdCosts(...values: Array<number | null | undefined>): number | null {
  const known = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (known.length === 0) {
    return null;
  }
  const total = known.reduce((sum, value) => sum + value, 0);
  return Math.round(total * 1_000_000) / 1_000_000;
}

// Strict variant for totals whose components must ALL be known: any unknown input
// makes the whole total unknown, so a missing image cost can never masquerade as a
// cheap text-only run.
export function sumUsdCostsStrict(...values: Array<number | null | undefined>): number | null {
  if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    return null;
  }
  return sumUsdCosts(...values);
}
