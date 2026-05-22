import type { RoleScopedCandidatePool, RoleScopedRankedProductMatch } from "./product-matching";

export type ProductMatchVisualStatus =
  | "strong_match"
  | "acceptable_match"
  | "closest_available"
  | "missing_required"
  | "missing_supporting";

export type ProductMatchConfidenceTier = "strong" | "acceptable" | "weak" | "missing" | "invalid_selection";

export type ProductMatchRoleResultEvidence = {
  category: string;
  roleLabel: string;
  status: ProductMatchVisualStatus;
  productId: string | null;
  reason: string;
};

export type ProductMatchRoleConfidence = {
  category: string;
  roleLabel: string;
  roleKey: string;
  status: ProductMatchVisualStatus | "not_evaluated";
  selectedProductId: string | null;
  candidateCount: number;
  rejectedCount: number;
  rejectionReasons: Record<string, number>;
  confidenceTier: ProductMatchConfidenceTier;
  reasons: string[];
  weaknessReasons: string[];
  hasColorMismatch: boolean;
  hasWeakMaterialMatch: boolean;
};

export function productMatchRoleKey(category: string, roleLabel: string) {
  return `${normalizeRoleKeyPart(category)}::${normalizeRoleKeyPart(roleLabel)}`;
}

export function buildProductMatchConfidenceSummary({
  pools,
  roleResults = []
}: {
  pools: RoleScopedCandidatePool[];
  roleResults?: ProductMatchRoleResultEvidence[];
}): ProductMatchRoleConfidence[] {
  const roleResultsByKey = new Map(
    roleResults.map((result) => [productMatchRoleKey(result.category, result.roleLabel), result])
  );

  return pools.map((pool) => {
    const key = productMatchRoleKey(pool.role.category, pool.role.label);
    const roleResult = roleResultsByKey.get(key) ?? null;
    const selectedCandidate = selectedCandidateForRole(pool, roleResult?.productId ?? null);
    const invalidSelection = Boolean(roleResult?.productId && !selectedCandidate);
    const status = roleResult?.status ?? "not_evaluated";
    const attributeScore = selectedCandidate?.attributeScore ?? null;
    const weaknessReasons = Array.from(
      new Set([
        ...pool.weaknessReasons,
        ...(attributeScore?.weaknessReasons ?? []),
        ...(invalidSelection ? [`selected product ${roleResult?.productId} is outside this role pool`] : [])
      ])
    );
    const reasons = [
      roleResult?.reason ? `visual status: ${roleResult.reason}` : null,
      selectedCandidate?.selectionReason ?? null,
      invalidSelection ? "selected product was ignored because it is outside this role pool" : null
    ].filter((reason): reason is string => Boolean(reason));

    return {
      category: pool.role.category,
      roleLabel: pool.role.label,
      roleKey: key,
      status,
      selectedProductId: selectedCandidate?.id ?? null,
      candidateCount: pool.candidateCount,
      rejectedCount: pool.rejectedCount,
      rejectionReasons: pool.rejectionReasons,
      confidenceTier: confidenceTierFor({ status, selectedCandidate, invalidSelection }),
      reasons,
      weaknessReasons,
      hasColorMismatch: Boolean(attributeScore && attributeScore.color < 0),
      hasWeakMaterialMatch: Boolean(attributeScore && attributeScore.material < 0)
    };
  });
}

export function productMatchConfidenceOutputSummary({
  pools,
  roleResults = []
}: {
  pools: RoleScopedCandidatePool[];
  roleResults?: ProductMatchRoleResultEvidence[];
}) {
  return buildProductMatchConfidenceSummary({ pools, roleResults }).map((summary) => ({
    category: summary.category,
    roleLabel: summary.roleLabel,
    roleKey: summary.roleKey,
    status: summary.status,
    selectedProductId: summary.selectedProductId,
    candidateCount: summary.candidateCount,
    rejectedCount: summary.rejectedCount,
    rejectionReasons: summary.rejectionReasons,
    confidenceTier: summary.confidenceTier,
    reasons: summary.reasons,
    weaknessReasons: summary.weaknessReasons,
    hasColorMismatch: summary.hasColorMismatch,
    hasWeakMaterialMatch: summary.hasWeakMaterialMatch
  }));
}

function normalizeRoleKeyPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function selectedCandidateForRole(pool: RoleScopedCandidatePool, productId: string | null) {
  if (!productId) {
    return null;
  }

  return pool.candidates.find((candidate) => candidate.id === productId) ?? null;
}

function confidenceTierFor({
  status,
  selectedCandidate,
  invalidSelection
}: {
  status: ProductMatchRoleConfidence["status"];
  selectedCandidate: RoleScopedRankedProductMatch | null;
  invalidSelection: boolean;
}): ProductMatchConfidenceTier {
  if (invalidSelection) {
    return "invalid_selection";
  }

  if (status === "missing_required" || status === "missing_supporting" || !selectedCandidate) {
    return "missing";
  }

  if (status === "strong_match") {
    return "strong";
  }

  if (status === "acceptable_match") {
    return "acceptable";
  }

  if (status === "closest_available") {
    return "weak";
  }

  return selectedCandidate.attributeScore.color < 0 || selectedCandidate.attributeScore.material < 0
    ? "weak"
    : "acceptable";
}
