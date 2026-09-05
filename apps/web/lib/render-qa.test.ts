import assert from "node:assert/strict";

import type { RenderSpatialQaResponse } from "@ritzy-studio/prompts";

import {
  effectiveSpatialQaVerdict,
  effectiveViewConsistencyVerdict,
  enforceSpatialQa,
  enforceViewConsistency,
  spatialQaIssues,
  SPATIAL_QA_RETRY_RESERVE_MS,
  VIEW_RETRY_RESERVE_MS
} from "./render-qa";

// S4 step 3 (AC 5, AC 6): the bounded enforcement state machines, pure, with
// injected render and assess fakes and a fake clock.

async function main() {

type Qa = RenderSpatialQaResponse;

const passQa: Qa = {
  focalOrientation: "pass",
  anchorAlignment: "pass",
  scalePlausibility: "pass",
  compositionIntegrity: "pass",
  zoning: "not_applicable",
  verdict: "pass",
  issues: []
};
const regenerateQa: Qa = { ...passQa, scalePlausibility: "fail", verdict: "regenerate", issues: ["The rug floats away from the seating."] };
// The Phase 0 verdict, replayed: the reviewer said "warn" while failing the
// focal orientation check, and the render shipped.
const phaseZeroQa: Qa = { ...passQa, focalOrientation: "fail", verdict: "warn", issues: ["Primary seating group does not address the TV media wall."] };

// Escalation: a focal fail is a regeneration only when the focal element is in
// frame; behind the camera it stays a warn. Scale and zoning fails always
// escalate. The model's own verdict is otherwise kept.
assert.equal(effectiveSpatialQaVerdict(phaseZeroQa, { focalElementInFrame: true }), "regenerate");
assert.equal(effectiveSpatialQaVerdict(phaseZeroQa, { focalElementInFrame: false }), "warn");
assert.equal(effectiveSpatialQaVerdict(phaseZeroQa, { focalElementInFrame: null }), "warn");
assert.equal(effectiveSpatialQaVerdict(phaseZeroQa, null), "warn");
assert.equal(effectiveSpatialQaVerdict({ ...passQa, scalePlausibility: "fail", verdict: "warn" }, { focalElementInFrame: false }), "regenerate");
assert.equal(effectiveSpatialQaVerdict({ ...passQa, zoning: "fail", verdict: "warn" }, null), "regenerate");
assert.equal(effectiveSpatialQaVerdict({ ...passQa, verdict: "warn", anchorAlignment: "fail" }, null), "warn");
assert.equal(effectiveSpatialQaVerdict(passQa, null), "pass");
// Review fix: a model regeneration is downgraded only when the focal wall is
// the SOLE failed check and the read knows it is behind the camera. Artifacts
// or a canted anchor keep the regeneration; so does unknown framing.
const artifactsAndFocal: Qa = {
  ...passQa,
  focalOrientation: "fail",
  anchorAlignment: "fail",
  compositionIntegrity: "fail",
  verdict: "regenerate",
  issues: ["Sofa canted 30 degrees off the rug grid.", "Coffee table legs merge into the rug."]
};
assert.equal(effectiveSpatialQaVerdict(artifactsAndFocal, { focalElementInFrame: false }), "regenerate");
assert.equal(effectiveSpatialQaVerdict(artifactsAndFocal, null), "regenerate");
const focalOnlyRegenerate: Qa = { ...passQa, focalOrientation: "fail", verdict: "regenerate", issues: ["Seating faces away from the TV wall."] };
assert.equal(effectiveSpatialQaVerdict(focalOnlyRegenerate, { focalElementInFrame: false }), "warn");
assert.equal(effectiveSpatialQaVerdict(focalOnlyRegenerate, { focalElementInFrame: null }), "regenerate", "unknown framing keeps the model's verdict");
assert.equal(effectiveSpatialQaVerdict(focalOnlyRegenerate, { focalElementInFrame: true }), "regenerate");
// A failed check with no written issue still yields a correction sentence.
assert.deepEqual(
  spatialQaIssues({ ...passQa, scalePlausibility: "fail", verdict: "warn", issues: [] }),
  ["Furniture scale or clearances are not plausible for the room."]
);
assert.deepEqual(spatialQaIssues(regenerateQa), regenerateQa.issues);

type Render = { id: string; credits: number | null };

function spatialHarness(verdicts: Array<Qa | Error>, remaining: number[] = [600_000, 600_000, 600_000]) {
  let renders = 0;
  let assessments = 0;
  const suffixes: Array<string | null> = [];
  return {
    calls: () => ({ renders, assessments, suffixes }),
    run: () =>
      enforceSpatialQa<Render, { qa: Qa; facts: { focalElementInFrame: boolean | null }; textCostUsd: number | null }>({
        render: async (suffix) => {
          suffixes.push(suffix);
          renders += 1;
          return { id: `render-${renders}`, credits: 20 };
        },
        assess: async () => {
          const next = verdicts[assessments];
          assessments += 1;
          if (next instanceof Error) {
            throw next;
          }
          return { qa: next, facts: { focalElementInFrame: true }, textCostUsd: 0.01 };
        },
        correction: (issues) => `fix: ${issues.join(" | ")}`,
        remainingMs: () => remaining[Math.min(renders, remaining.length - 1)],
        creditsOf: (render) => render.credits
      })
  };
}

// AC 5: regenerate twice renders exactly twice, keeps the FIRST render, and
// reports unresolved with both verdicts.
{
  const harness = spatialHarness([regenerateQa, regenerateQa]);
  const result = await harness.run();
  assert.equal(harness.calls().renders, 2);
  assert.equal(result.result.id, "render-1");
  assert.equal(result.outcome, "unresolved");
  assert.equal(result.regenerated, false);
  assert.deepEqual(result.verdicts, ["regenerate", "regenerate"]);
  assert.deepEqual(result.issues, ["The rug floats away from the seating."]);
  assert.equal(harness.calls().suffixes[1], "fix: The rug floats away from the seating.");
  assert.equal(result.imageCreditsUsed, 40, "the discarded retry still consumed credits");
  assert.equal(result.textCostUsd, 0.02);
  assert.equal(result.reason, null);
}

// regenerate then pass keeps the SECOND render as resolved.
{
  const harness = spatialHarness([regenerateQa, passQa]);
  const result = await harness.run();
  assert.equal(harness.calls().renders, 2);
  assert.equal(result.result.id, "render-2");
  assert.equal(result.outcome, "resolved_after_regeneration");
  assert.equal(result.regenerated, true);
  assert.deepEqual(result.verdicts, ["regenerate", "pass"]);
  assert.deepEqual(result.issues, []);
}

// pass renders once; warn also passes (presentable) with its issues carried.
{
  const harness = spatialHarness([passQa]);
  const result = await harness.run();
  assert.equal(harness.calls().renders, 1);
  assert.equal(result.outcome, "passed");
  assert.equal(result.regenerated, false);
  // In frame, the Phase 0 verdict is a regeneration: it retries, and the
  // corrected render is what ships.
  const escalated = spatialHarness([phaseZeroQa, passQa]);
  const escalatedResult = await escalated.run();
  assert.equal(escalated.calls().renders, 2);
  assert.equal(escalatedResult.outcome, "resolved_after_regeneration");
  assert.deepEqual(escalatedResult.verdicts, ["regenerate", "pass"]);
}

// The Phase 0 verdict with the focal element in frame regenerates; behind the
// camera it ships as passed with the warning carried.
{
  const facts = { focalElementInFrame: false as boolean | null };
  let renders = 0;
  const result = await enforceSpatialQa<Render, { qa: Qa; facts: typeof facts; textCostUsd: number | null }>({
    render: async () => ({ id: `render-${(renders += 1)}`, credits: null }),
    assess: async () => ({ qa: phaseZeroQa, facts, textCostUsd: null }),
    correction: () => "fix",
    remainingMs: () => 600_000,
    creditsOf: () => null
  });
  assert.equal(renders, 1);
  assert.equal(result.outcome, "passed");
  assert.deepEqual(result.issues, phaseZeroQa.issues);
  assert.equal(result.imageCreditsUsed, null, "no credits reported reads as unknown, never zero");
}

// A throwing assess yields unreviewed with the render kept, no retry.
{
  const harness = spatialHarness([new Error("provider down")]);
  const result = await harness.run();
  assert.equal(harness.calls().renders, 1);
  assert.equal(result.outcome, "unreviewed");
  assert.equal(result.result.id, "render-1");
  assert.equal(result.assessment, null);
  assert.match(result.error ?? "", /provider down/);
}

// A throwing assess on the RETRY keeps the first, judged render as unresolved.
{
  const harness = spatialHarness([regenerateQa, new Error("provider down")]);
  const result = await harness.run();
  assert.equal(harness.calls().renders, 2);
  assert.equal(result.result.id, "render-1");
  assert.equal(result.outcome, "unresolved");
  assert.match(result.error ?? "", /provider down/);
}

// A retry image call that throws keeps the paid, judged first render.
{
  let renders = 0;
  const result = await enforceSpatialQa<Render, { qa: Qa; facts: { focalElementInFrame: boolean | null }; textCostUsd: number | null }>({
    render: async (suffix) => {
      renders += 1;
      if (suffix) {
        throw new Error("provider 503");
      }
      return { id: `render-${renders}`, credits: 20 };
    },
    assess: async () => ({ qa: regenerateQa, facts: { focalElementInFrame: true }, textCostUsd: 0.01 }),
    correction: (issues) => `fix: ${issues.join(" | ")}`,
    remainingMs: () => 600_000,
    creditsOf: (render) => render.credits
  });
  assert.equal(renders, 2);
  assert.equal(result.result.id, "render-1");
  assert.equal(result.outcome, "unresolved");
  assert.match(result.error ?? "", /provider 503/);
  assert.equal(result.imageCreditsUsed, 20, "the failed retry consumed nothing that was reported");
}

// An escalated regeneration whose model wrote no issue is corrected with the
// synthesised sentence rather than an empty list.
{
  const suffixes: Array<string | null> = [];
  await enforceSpatialQa<Render, { qa: Qa; facts: { focalElementInFrame: boolean | null }; textCostUsd: number | null }>({
    render: async (suffix) => {
      suffixes.push(suffix);
      return { id: "r", credits: null };
    },
    assess: async () => ({ qa: { ...passQa, scalePlausibility: "fail", verdict: "warn", issues: [] }, facts: { focalElementInFrame: null }, textCostUsd: null }),
    correction: (issues) => issues.join("|"),
    remainingMs: () => 600_000,
    creditsOf: () => null
  });
  assert.equal(suffixes[1], "Furniture scale or clearances are not plausible for the room.");
}

// No time for a retry: exactly one render, unresolved, reason recorded.
{
  const harness = spatialHarness([regenerateQa], [SPATIAL_QA_RETRY_RESERVE_MS - 1]);
  const result = await harness.run();
  assert.equal(harness.calls().renders, 1);
  assert.equal(result.outcome, "unresolved");
  assert.equal(result.reason, "no_time_for_retry");
  assert.deepEqual(result.verdicts, ["regenerate"]);
}

// View consistency: the effective verdict is derived from the fields, and a
// focal expectation that is missing or an unmatched anchored camera is
// inconsistent whatever the model's own verdict said.
type Check = Parameters<typeof effectiveViewConsistencyVerdict>[0];
const consistentCheck: Check = {
  architectureConsistent: true,
  cameraMatchesAnchor: "not_applicable",
  sharedObjectsConsistent: true,
  expectedShown: ["the TV and media wall"],
  expectedMissing: [],
  invented: [],
  verdict: "consistent",
  issues: []
};
assert.equal(effectiveViewConsistencyVerdict(consistentCheck, "the TV and media wall"), "consistent");
assert.equal(effectiveViewConsistencyVerdict({ ...consistentCheck, cameraMatchesAnchor: "no" }, null), "inconsistent");
assert.equal(effectiveViewConsistencyVerdict({ ...consistentCheck, invented: ["a second armchair"] }, null), "inconsistent");
assert.equal(effectiveViewConsistencyVerdict({ ...consistentCheck, architectureConsistent: false }, null), "inconsistent");
assert.equal(
  effectiveViewConsistencyVerdict({ ...consistentCheck, expectedShown: [], expectedMissing: ["the TV and media wall"] }, "the TV and media wall"),
  "inconsistent",
  "the focal expectation missing is a failure"
);
assert.equal(
  effectiveViewConsistencyVerdict({ ...consistentCheck, expectedShown: [], expectedMissing: ["small side table"] }, "the TV and media wall"),
  "consistent",
  "a non-focal expectation missing is reported, not failed"
);
assert.equal(effectiveViewConsistencyVerdict({ ...consistentCheck, verdict: "inconsistent" }, null), "inconsistent", "the model's own inconsistent verdict is kept");
// The model saw the fenced label and copies it back fenced; a quote in the
// focal label must not defeat the comparison.
assert.equal(
  effectiveViewConsistencyVerdict(
    { ...consistentCheck, expectedShown: [], expectedMissing: ["the TV and media wall (65 wall-mounted TV)"] },
    'the TV and media wall (65" wall-mounted TV)'
  ),
  "inconsistent"
);

type View = { id: string; credits: number | null };
const inconsistentCheck: Check = { ...consistentCheck, sharedObjectsConsistent: false, verdict: "inconsistent", issues: ["The sofa changed colour."] };

function viewHarness(checks: Array<Check | Error>, remaining: number[] = [600_000, 600_000, 600_000]) {
  let generations = 0;
  let assessments = 0;
  return {
    calls: () => ({ generations, assessments }),
    run: () =>
      enforceViewConsistency<View, { check: Check; textCostUsd: number | null }>({
        generate: async () => ({ id: `view-${(generations += 1)}`, credits: 20 }),
        assess: async () => {
          const next = checks[assessments];
          assessments += 1;
          if (next instanceof Error) {
            throw next;
          }
          return { check: next, textCostUsd: 0.003 };
        },
        correction: (issues) => `fix: ${issues.join(" | ")}`,
        remainingMs: () => remaining[Math.min(generations, remaining.length - 1)],
        creditsOf: (view) => view.credits,
        focalLabel: "the TV and media wall"
      })
  };
}

// AC 6: inconsistent twice generates exactly twice and returns unresolved with
// the LAST image and both verdicts' issues.
{
  const harness = viewHarness([inconsistentCheck, { ...inconsistentCheck, issues: ["The rug pattern changed."] }]);
  const result = await harness.run();
  assert.equal(harness.calls().generations, 2);
  assert.equal(result.image.id, "view-2");
  assert.equal(result.outcome, "unresolved");
  assert.deepEqual(result.issues, ["The sofa changed colour.", "The rug pattern changed."]);
  assert.equal(result.regenerated, true, "the kept image is the regeneration");
  assert.equal(result.imageCreditsUsed, 40);
}

// inconsistent then consistent keeps the second image as resolved.
{
  const harness = viewHarness([inconsistentCheck, consistentCheck]);
  const result = await harness.run();
  assert.equal(result.image.id, "view-2");
  assert.equal(result.outcome, "resolved_after_regeneration");
  assert.equal(result.regenerated, true);
}

// consistent first time: one generation.
{
  const harness = viewHarness([consistentCheck]);
  const result = await harness.run();
  assert.equal(harness.calls().generations, 1);
  assert.equal(result.outcome, "consistent");
  assert.equal(result.regenerated, false);
}

// A camera that does not match the anchored photograph is inconsistent even
// when architecture and objects agree, and regenerates once.
{
  const harness = viewHarness([{ ...consistentCheck, cameraMatchesAnchor: "no", issues: ["The view stands at the window, not the doorway."] }, consistentCheck]);
  const result = await harness.run();
  assert.equal(harness.calls().generations, 2);
  assert.equal(result.outcome, "resolved_after_regeneration");
}

// A retry generation that throws keeps the judged first image as unresolved.
{
  let generations = 0;
  const result = await enforceViewConsistency<View, { check: Check; textCostUsd: number | null }>({
    generate: async (suffix) => {
      generations += 1;
      if (suffix) {
        throw new Error("provider 503");
      }
      return { id: `view-${generations}`, credits: 20 };
    },
    assess: async () => ({ check: inconsistentCheck, textCostUsd: 0.003 }),
    correction: (issues) => issues.join("|"),
    remainingMs: () => 600_000,
    creditsOf: (view) => view.credits,
    focalLabel: null
  });
  assert.equal(generations, 2);
  assert.equal(result.image.id, "view-1");
  assert.equal(result.outcome, "unresolved");
  assert.equal(result.regenerated, false);
  assert.match(result.error ?? "", /provider 503/);
}

// A retry check that throws keeps the last image, with no assessment claiming
// to describe it.
{
  const harness = viewHarness([inconsistentCheck, new Error("provider down")]);
  const result = await harness.run();
  assert.equal(result.image.id, "view-2");
  assert.equal(result.outcome, "unresolved");
  assert.equal(result.assessment, null);
  assert.ok(result.issues.includes("The corrected view could not be checked."));
}

// A throwing assess returns unchecked with the image kept.
{
  const harness = viewHarness([new Error("provider down")]);
  const result = await harness.run();
  assert.equal(harness.calls().generations, 1);
  assert.equal(result.outcome, "unchecked");
  assert.equal(result.image.id, "view-1");
  assert.match(result.error ?? "", /provider down/);
}

// No time for a retry after an inconsistent verdict: one generation, unresolved.
{
  const harness = viewHarness([inconsistentCheck], [VIEW_RETRY_RESERVE_MS - 1]);
  const result = await harness.run();
  assert.equal(harness.calls().generations, 1);
  assert.equal(result.outcome, "unresolved");
  assert.equal(result.reason, "no_time_for_retry");
}

}

main()
  .then(() => {
    console.log("render-qa tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
