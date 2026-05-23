import type { RoleScopedCandidatePool, RoleScopedRankedProductMatch } from "./product-matching";
import { productMatchRoleKey } from "./product-matching-confidence";

const NARROW_UNIQUE_SIGNAL_COUNT = 1;
const SCATTERED_UNIQUE_SIGNAL_COUNT = 4;
const DUPLICATE_NAME_TOKEN_MIN_LENGTH = 4;

export type ProductMatchPoolDiversityStatus = "empty" | "narrow" | "balanced" | "scattered";

export type ProductMatchRolePoolDiversity = {
  category: string;
  roleLabel: string;
  roleKey: string;
  priority: "required" | "supporting";
  poolDiversityStatus: ProductMatchPoolDiversityStatus;
  candidateCount: number;
  uniqueRetailerCount: number;
  uniqueColorSignalCount: number;
  uniqueMaterialSignalCount: number;
  duplicateNameTokenCount: number;
  repeatedNameTokens: string[];
  reasons: string[];
};

export function summarizeRolePoolDiversity(pools: RoleScopedCandidatePool[]): ProductMatchRolePoolDiversity[] {
  return pools.map((pool) => {
    const retailerSignals = uniqueSignals(pool.candidates, (candidate) => [candidate.retailerName]);
    const colorSignals = uniqueSignals(pool.candidates, (candidate) => [
      candidate.color,
      ...candidate.colorTags,
      ...candidate.attributeScore.candidateColorFamilies
    ]);
    const materialSignals = uniqueSignals(pool.candidates, (candidate) => [
      candidate.material,
      ...candidate.materialTags,
      ...candidate.attributeScore.candidateMaterialFamilies
    ]);
    const repeatedNameTokens = duplicateNameTokens(pool.candidates);
    const status = diversityStatus({
      candidateCount: pool.candidateCount,
      uniqueColorSignalCount: colorSignals.size,
      uniqueMaterialSignalCount: materialSignals.size
    });

    return {
      category: pool.role.category,
      roleLabel: pool.role.label,
      roleKey: productMatchRoleKey(pool.role.category, pool.role.label),
      priority: pool.role.priority,
      poolDiversityStatus: status,
      candidateCount: pool.candidateCount,
      uniqueRetailerCount: retailerSignals.size,
      uniqueColorSignalCount: colorSignals.size,
      uniqueMaterialSignalCount: materialSignals.size,
      duplicateNameTokenCount: repeatedNameTokens.length,
      repeatedNameTokens,
      reasons: diversityReasons({
        status,
        repeatedNameTokens,
        uniqueColorSignalCount: colorSignals.size,
        uniqueMaterialSignalCount: materialSignals.size
      })
    };
  });
}

function diversityStatus({
  candidateCount,
  uniqueColorSignalCount,
  uniqueMaterialSignalCount
}: {
  candidateCount: number;
  uniqueColorSignalCount: number;
  uniqueMaterialSignalCount: number;
}): ProductMatchPoolDiversityStatus {
  if (candidateCount === 0) {
    return "empty";
  }

  if (
    uniqueColorSignalCount <= NARROW_UNIQUE_SIGNAL_COUNT &&
    uniqueMaterialSignalCount <= NARROW_UNIQUE_SIGNAL_COUNT
  ) {
    return "narrow";
  }

  if (
    uniqueColorSignalCount >= SCATTERED_UNIQUE_SIGNAL_COUNT ||
    uniqueMaterialSignalCount >= SCATTERED_UNIQUE_SIGNAL_COUNT
  ) {
    return "scattered";
  }

  return "balanced";
}

function diversityReasons({
  status,
  repeatedNameTokens,
  uniqueColorSignalCount,
  uniqueMaterialSignalCount
}: {
  status: ProductMatchPoolDiversityStatus;
  repeatedNameTokens: string[];
  uniqueColorSignalCount: number;
  uniqueMaterialSignalCount: number;
}) {
  const reasons: string[] = [];

  if (status === "empty") {
    reasons.push("role pool has no candidates to compare");
  }

  if (status === "narrow") {
    reasons.push("role pool has very similar color and material signals");
  }

  if (status === "scattered") {
    reasons.push("role pool has broad color or material signal spread");
  }

  if (repeatedNameTokens.length > 0) {
    reasons.push("role pool has repeated product-name tokens; duplicate signal is best-effort");
  }

  if (uniqueColorSignalCount === 0) {
    reasons.push("role pool has no color diversity signals");
  }

  if (uniqueMaterialSignalCount === 0) {
    reasons.push("role pool has no material diversity signals");
  }

  return reasons;
}

function uniqueSignals(
  candidates: RoleScopedRankedProductMatch[],
  valuesForCandidate: (candidate: RoleScopedRankedProductMatch) => Array<string | null>
) {
  const signals = new Set<string>();

  for (const candidate of candidates) {
    for (const value of valuesForCandidate(candidate)) {
      const normalized = normalizeSignal(value);
      if (normalized) {
        signals.add(normalized);
      }
    }
  }

  return signals;
}

function duplicateNameTokens(candidates: RoleScopedRankedProductMatch[]) {
  const counts = new Map<string, number>();

  for (const candidate of candidates) {
    for (const token of nameTokens(candidate.name)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([token]) => token)
    .sort();
}

function nameTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= DUPLICATE_NAME_TOKEN_MIN_LENGTH)
  );
}

function normalizeSignal(value: string | null) {
  return value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
