import { fenceUntrustedText } from "@ritzy-studio/ai";
import type { RenderSpatialQaResponse, ViewConsistencyResponse } from "@ritzy-studio/prompts";

// S4 step 3: the enforcement state machines behind the final render's spatial
// QA and the planned views' consistency check. Pure: the paid calls come in
// as functions, time comes in as a function, and every outcome is a value the
// runner persists and the presentation can say in the shopper's words.
//
// Both machines make exactly one bounded regeneration and then stop. Phase 0
// shipped a render on a "warn" that named the missing TV orientation; what
// changed is that the verdict is derived from the checks in code, and that an
// unresolved verdict is recorded and shown instead of shipped silently.

export type SpatialQaFacts = {
  // From the camera read: whether the focal element is in the hero frame.
  // null when the read could not say, or no focal element is named.
  focalElementInFrame: boolean | null;
};

export type EffectiveSpatialVerdict = "pass" | "warn" | "regenerate";

// A hard violation is a regeneration however the model labelled it: seating
// turned away from a focal element the camera can see, a blocked opening or
// impossible scale, or broken zoning in a combined room. A focal fail with
// the focal element behind the camera (or unknown) is a warning carried in
// the issues, because the reviewer is judging a wall it cannot see.
export function effectiveSpatialQaVerdict(qa: RenderSpatialQaResponse, facts: SpatialQaFacts | null): EffectiveSpatialVerdict {
  if (qa.scalePlausibility === "fail" || qa.zoning === "fail") {
    return "regenerate";
  }
  if (qa.focalOrientation === "fail" && facts?.focalElementInFrame === true) {
    return "regenerate";
  }
  const focalIsTheOnlyFail =
    qa.focalOrientation === "fail" && qa.anchorAlignment !== "fail" && qa.compositionIntegrity !== "fail";
  if (qa.verdict === "regenerate" && focalIsTheOnlyFail && facts?.focalElementInFrame === false) {
    // The model regenerated for the focal wall alone, and the camera read
    // knows that wall is behind the camera. Anything else it regenerated
    // for (a canted anchor, artifacts) keeps its verdict, and so does a
    // focal regeneration when the framing is unknown.
    return "warn";
  }
  return qa.verdict;
}

// A check the model failed without writing an issue still needs a sentence
// for the correction prompt and for the shopper's review note.
const SPATIAL_CHECK_FALLBACK_ISSUES: Array<[keyof RenderSpatialQaResponse, string]> = [
  ["focalOrientation", "The primary seating does not address the room's focal element."],
  ["anchorAlignment", "The primary piece is canted off the room grid."],
  ["scalePlausibility", "Furniture scale or clearances are not plausible for the room."],
  ["compositionIntegrity", "There are visible artifacts: warped, floating or duplicated furniture."],
  ["zoning", "The living and dining zones are merged or reversed."]
];

export function spatialQaIssues(qa: RenderSpatialQaResponse): string[] {
  if (qa.issues.length > 0) {
    return [...qa.issues];
  }
  return SPATIAL_CHECK_FALLBACK_ISSUES.filter(([check]) => qa[check] === "fail").map(([, sentence]) => sentence);
}

export type SpatialQaOutcome = "passed" | "resolved_after_regeneration" | "unresolved" | "unreviewed";

export type SpatialQaAssessment = {
  qa: RenderSpatialQaResponse;
  facts: SpatialQaFacts;
  textCostUsd?: number | null;
};

// What a retry must be able to afford before it is started: an image call at
// the primary provider's observed pace (20 to 60 s) plus the camera read and
// the QA. Sized to the observed pace, not the provider ceiling: the image
// call itself is bounded by the remaining deadline, so a retry started with
// this much left either lands or aborts and the judged first render stands.
// Sized to the ceiling it could never run inside the inline budget at all.
export const SPATIAL_QA_RETRY_RESERVE_MS = 90_000;

export type EnforceSpatialQaInput<R, A extends SpatialQaAssessment> = {
  render: (promptSuffix: string | null) => Promise<R>;
  assess: (render: R) => Promise<A>;
  correction: (issues: string[]) => string;
  remainingMs: () => number;
  creditsOf: (render: R) => number | null;
  retryReserveMs?: number;
};

export type EnforceSpatialQaResult<R, A extends SpatialQaAssessment> = {
  result: R;
  // The assessment of the kept render; null when the review could not run.
  assessment: A | null;
  outcome: SpatialQaOutcome;
  regenerated: boolean;
  issues: string[];
  verdicts: EffectiveSpatialVerdict[];
  reason: "no_time_for_retry" | null;
  error: string | null;
  imageCreditsUsed: number | null;
  textCostUsd: number | null;
};

function addCredits(total: number | null, next: number | null): number | null {
  if (typeof next !== "number" || !Number.isFinite(next)) {
    return total;
  }
  return (total ?? 0) + next;
}

function addCost(total: number | null, next: number | null | undefined): number | null {
  if (typeof next !== "number" || !Number.isFinite(next)) {
    return total;
  }
  return Math.round(((total ?? 0) + next) * 10_000) / 10_000;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function enforceSpatialQa<R, A extends SpatialQaAssessment>({
  render,
  assess,
  correction,
  remainingMs,
  creditsOf,
  retryReserveMs = SPATIAL_QA_RETRY_RESERVE_MS
}: EnforceSpatialQaInput<R, A>): Promise<EnforceSpatialQaResult<R, A>> {
  const first = await render(null);
  let imageCreditsUsed = addCredits(null, creditsOf(first));
  let textCostUsd: number | null = null;

  let firstAssessment: A;
  try {
    firstAssessment = await assess(first);
  } catch (error) {
    return {
      result: first,
      assessment: null,
      outcome: "unreviewed",
      regenerated: false,
      issues: [],
      verdicts: [],
      reason: null,
      error: errorMessage(error, "The placement review could not run."),
      imageCreditsUsed,
      textCostUsd
    };
  }
  textCostUsd = addCost(textCostUsd, firstAssessment.textCostUsd);
  const firstVerdict = effectiveSpatialQaVerdict(firstAssessment.qa, firstAssessment.facts);
  const firstIssues = spatialQaIssues(firstAssessment.qa);

  if (firstVerdict !== "regenerate") {
    return {
      result: first,
      assessment: firstAssessment,
      outcome: "passed",
      regenerated: false,
      issues: firstIssues,
      verdicts: [firstVerdict],
      reason: null,
      error: null,
      imageCreditsUsed,
      textCostUsd
    };
  }

  if (remainingMs() < retryReserveMs) {
    return {
      result: first,
      assessment: firstAssessment,
      outcome: "unresolved",
      regenerated: false,
      issues: firstIssues,
      verdicts: [firstVerdict],
      reason: "no_time_for_retry",
      error: null,
      imageCreditsUsed,
      textCostUsd
    };
  }

  // The corrected attempt is best effort in both halves: a retry image call
  // that fails (provider outage, the attempt deadline) must not lose the paid,
  // judged first render.
  let retry: R;
  try {
    retry = await render(correction(firstIssues));
  } catch (error) {
    return {
      result: first,
      assessment: firstAssessment,
      outcome: "unresolved",
      regenerated: false,
      issues: firstIssues,
      verdicts: [firstVerdict],
      reason: null,
      error: errorMessage(error, "The corrected render could not be generated."),
      imageCreditsUsed,
      textCostUsd
    };
  }
  imageCreditsUsed = addCredits(imageCreditsUsed, creditsOf(retry));

  let retryAssessment: A;
  try {
    retryAssessment = await assess(retry);
  } catch (error) {
    // The corrected attempt cannot be judged; the judged first render stands,
    // and the shopper sees the review's findings and the way to try again.
    return {
      result: first,
      assessment: firstAssessment,
      outcome: "unresolved",
      regenerated: false,
      issues: firstIssues,
      verdicts: [firstVerdict],
      reason: null,
      error: errorMessage(error, "The placement review of the corrected render could not run."),
      imageCreditsUsed,
      textCostUsd
    };
  }
  textCostUsd = addCost(textCostUsd, retryAssessment.textCostUsd);
  const retryVerdict = effectiveSpatialQaVerdict(retryAssessment.qa, retryAssessment.facts);

  if (retryVerdict !== "regenerate") {
    return {
      result: retry,
      assessment: retryAssessment,
      outcome: "resolved_after_regeneration",
      regenerated: true,
      issues: spatialQaIssues(retryAssessment.qa),
      verdicts: [firstVerdict, retryVerdict],
      reason: null,
      error: null,
      imageCreditsUsed,
      textCostUsd
    };
  }

  return {
    result: first,
    assessment: firstAssessment,
    outcome: "unresolved",
    regenerated: false,
    issues: firstIssues,
    verdicts: [firstVerdict, retryVerdict],
    reason: null,
    error: null,
    imageCreditsUsed,
    textCostUsd
  };
}

// The view check's effective verdict, derived from the fields so a model that
// labels a view "consistent" while reporting an invented piece, an unmatched
// anchored camera or the missing focal element does not get the last word.
export function effectiveViewConsistencyVerdict(
  check: ViewConsistencyResponse,
  focalLabel: string | null
): "consistent" | "inconsistent" {
  if (check.verdict === "inconsistent") {
    return "inconsistent";
  }
  if (!check.architectureConsistent || !check.sharedObjectsConsistent || check.cameraMatchesAnchor === "no") {
    return "inconsistent";
  }
  if (check.invented.length > 0) {
    return "inconsistent";
  }
  // The model saw the labels through the same fence the app applies before
  // sending them, and copies them back as it saw them; compare like with like.
  const focal = focalLabel ? fenceUntrustedText(focalLabel, 160).toLowerCase() : null;
  if (focal && check.expectedMissing.some((label) => fenceUntrustedText(label, 160).toLowerCase() === focal)) {
    return "inconsistent";
  }
  return "consistent";
}

export type ViewConsistencyOutcome = "consistent" | "resolved_after_regeneration" | "unresolved" | "unchecked";

export type ViewConsistencyAssessment = {
  check: ViewConsistencyResponse;
  textCostUsd?: number | null;
};

// An image call at the observed pace plus a check, on the same reasoning.
export const VIEW_RETRY_RESERVE_MS = 75_000;

export type EnforceViewConsistencyInput<R, A extends ViewConsistencyAssessment> = {
  generate: (promptSuffix: string | null) => Promise<R>;
  assess: (image: R) => Promise<A>;
  correction: (issues: string[]) => string;
  remainingMs: () => number;
  creditsOf: (image: R) => number | null;
  focalLabel: string | null;
  retryReserveMs?: number;
};

export type EnforceViewConsistencyResult<R, A extends ViewConsistencyAssessment> = {
  image: R;
  assessment: A | null;
  outcome: ViewConsistencyOutcome;
  regenerated: boolean;
  issues: string[];
  verdicts: Array<"consistent" | "inconsistent">;
  reason: "no_time_for_retry" | null;
  error: string | null;
  imageCreditsUsed: number | null;
  textCostUsd: number | null;
};

export async function enforceViewConsistency<R, A extends ViewConsistencyAssessment>({
  generate,
  assess,
  correction,
  remainingMs,
  creditsOf,
  focalLabel,
  retryReserveMs = VIEW_RETRY_RESERVE_MS
}: EnforceViewConsistencyInput<R, A>): Promise<EnforceViewConsistencyResult<R, A>> {
  const first = await generate(null);
  let imageCreditsUsed = addCredits(null, creditsOf(first));
  let textCostUsd: number | null = null;

  let firstAssessment: A;
  try {
    firstAssessment = await assess(first);
  } catch (error) {
    return {
      image: first,
      assessment: null,
      outcome: "unchecked",
      regenerated: false,
      issues: [],
      verdicts: [],
      reason: null,
      error: errorMessage(error, "The view could not be checked."),
      imageCreditsUsed,
      textCostUsd
    };
  }
  textCostUsd = addCost(textCostUsd, firstAssessment.textCostUsd);
  const firstVerdict = effectiveViewConsistencyVerdict(firstAssessment.check, focalLabel);
  const firstIssues = [...firstAssessment.check.issues];

  if (firstVerdict === "consistent") {
    return {
      image: first,
      assessment: firstAssessment,
      outcome: "consistent",
      regenerated: false,
      issues: firstIssues,
      verdicts: [firstVerdict],
      reason: null,
      error: null,
      imageCreditsUsed,
      textCostUsd
    };
  }

  if (remainingMs() < retryReserveMs) {
    return {
      image: first,
      assessment: firstAssessment,
      outcome: "unresolved",
      regenerated: false,
      issues: firstIssues,
      verdicts: [firstVerdict],
      reason: "no_time_for_retry",
      error: null,
      imageCreditsUsed,
      textCostUsd
    };
  }

  let retry: R;
  try {
    retry = await generate(correction(firstIssues));
  } catch (error) {
    // The corrected view could not be generated; the judged first image
    // stands as unresolved rather than failing the whole view.
    return {
      image: first,
      assessment: firstAssessment,
      outcome: "unresolved",
      regenerated: false,
      issues: firstIssues,
      verdicts: [firstVerdict],
      reason: null,
      error: errorMessage(error, "The corrected view could not be generated."),
      imageCreditsUsed,
      textCostUsd
    };
  }
  imageCreditsUsed = addCredits(imageCreditsUsed, creditsOf(retry));

  let retryAssessment: A;
  try {
    retryAssessment = await assess(retry);
  } catch (error) {
    // The corrected view cannot be judged. The last attempt is kept, as the
    // unresolved rule says, with the first verdict's issues and the reason
    // the second has none; no assessment describes the kept image.
    return {
      image: retry,
      assessment: null,
      outcome: "unresolved",
      regenerated: true,
      issues: [...firstIssues, "The corrected view could not be checked."],
      verdicts: [firstVerdict],
      reason: null,
      error: errorMessage(error, "The corrected view could not be checked."),
      imageCreditsUsed,
      textCostUsd
    };
  }
  textCostUsd = addCost(textCostUsd, retryAssessment.textCostUsd);
  const retryVerdict = effectiveViewConsistencyVerdict(retryAssessment.check, focalLabel);

  if (retryVerdict === "consistent") {
    return {
      image: retry,
      assessment: retryAssessment,
      outcome: "resolved_after_regeneration",
      regenerated: true,
      issues: [...retryAssessment.check.issues],
      verdicts: [firstVerdict, retryVerdict],
      reason: null,
      error: null,
      imageCreditsUsed,
      textCostUsd
    };
  }

  // Both attempts inconsistent: the last attempt is kept for the record and
  // both verdicts' issues travel with it; the reveal leaves it out.
  return {
    image: retry,
    assessment: retryAssessment,
    outcome: "unresolved",
    regenerated: true,
    issues: [...firstIssues, ...retryAssessment.check.issues],
    verdicts: [firstVerdict, retryVerdict],
    reason: null,
    error: null,
    imageCreditsUsed,
    textCostUsd
  };
}
