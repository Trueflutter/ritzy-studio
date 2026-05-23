import type { RoleScopedCandidatePool, RoleScopedRankedProductMatch } from "./product-matching";
import { productMatchRoleKey } from "./product-matching-confidence";

const THIN_POOL_CANDIDATE_COUNT = 3;
const WEAK_TOP_ATTRIBUTE_TOTAL = 35;

export type ProductMatchPoolQualityStatus = "empty" | "thin" | "weak" | "healthy";

export type ProductMatchRolePoolQuality = {
  category: string;
  roleLabel: string;
  roleKey: string;
  priority: "required" | "supporting";
  poolQualityStatus: ProductMatchPoolQualityStatus;
  candidateCount: number;
  rejectedCount: number;
  rejectionReasons: Record<string, number>;
  weaknessReasons: string[];
  topCandidateId: string | null;
  topScore: number | null;
  topAttributeTotal: number | null;
  reasons: string[];
};

export function summarizeRolePoolQuality(pools: RoleScopedCandidatePool[]): ProductMatchRolePoolQuality[] {
  return pools.map((pool) => {
    const topCandidate = pool.candidates[0] ?? null;
    const reasons = rolePoolQualityReasons(pool, topCandidate);

    return {
      category: pool.role.category,
      roleLabel: pool.role.label,
      roleKey: productMatchRoleKey(pool.role.category, pool.role.label),
      priority: pool.role.priority,
      poolQualityStatus: rolePoolQualityStatus(pool, topCandidate),
      candidateCount: pool.candidateCount,
      rejectedCount: pool.rejectedCount,
      rejectionReasons: pool.rejectionReasons,
      weaknessReasons: pool.weaknessReasons,
      topCandidateId: topCandidate?.id ?? null,
      topScore: topCandidate?.score ?? null,
      topAttributeTotal: topCandidate?.attributeScore.total ?? null,
      reasons
    };
  });
}

function rolePoolQualityStatus(
  pool: RoleScopedCandidatePool,
  topCandidate: RoleScopedRankedProductMatch | null
): ProductMatchPoolQualityStatus {
  if (pool.candidateCount === 0 || !topCandidate) {
    return "empty";
  }

  if (pool.candidateCount < THIN_POOL_CANDIDATE_COUNT) {
    return "thin";
  }

  if (isWeakTopCandidate(topCandidate) || pool.weaknessReasons.length > 0) {
    return "weak";
  }

  return "healthy";
}

function rolePoolQualityReasons(
  pool: RoleScopedCandidatePool,
  topCandidate: RoleScopedRankedProductMatch | null
) {
  const reasons: string[] = [];

  if (pool.candidateCount === 0 || !topCandidate) {
    reasons.push("role pool has no eligible candidates");
  } else if (pool.candidateCount < THIN_POOL_CANDIDATE_COUNT) {
    reasons.push(`role pool has fewer than ${THIN_POOL_CANDIDATE_COUNT} candidates`);
  }

  if (topCandidate && topCandidate.attributeScore.total < WEAK_TOP_ATTRIBUTE_TOTAL) {
    reasons.push("top candidate attribute score is weak");
  }

  if (topCandidate && topCandidate.attributeScore.weaknessReasons.length > 0) {
    reasons.push(...topCandidate.attributeScore.weaknessReasons);
  }

  if (pool.weaknessReasons.length > 0) {
    reasons.push(...pool.weaknessReasons);
  }

  return Array.from(new Set(reasons));
}

function isWeakTopCandidate(candidate: RoleScopedRankedProductMatch) {
  return (
    candidate.attributeScore.total < WEAK_TOP_ATTRIBUTE_TOTAL ||
    candidate.attributeScore.color < 0 ||
    candidate.attributeScore.material < 0 ||
    candidate.attributeScore.weaknessReasons.length > 0
  );
}
