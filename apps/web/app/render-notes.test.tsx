import assert from "node:assert/strict";

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: unknown }).React = React;

import {
  leftOutViewCount,
  RenderDisclaimer,
  RenderReviewNote,
  SKU_RENDER_DISCLAIMER,
  ViewsLeftOutNote
} from "./projects/[projectId]/rooms/[roomId]/presentation/render-notes";

// S4 step 6 (AC 10): the reveal's honest states. A render whose placement
// review stayed unresolved, or could not run, says so in the shopper's words
// with the findings and the way to render again; a planned angle left out is
// said once; the 12.9 disclaimer is the exact sentence.

assert.equal(
  SKU_RENDER_DISCLAIMER,
  "this render is a visual approximation; product styling may vary. Refer to the shopping list for verified SKUs."
);
const disclaimer = renderToStaticMarkup(<RenderDisclaimer />);
assert.ok(disclaimer.includes(SKU_RENDER_DISCLAIMER));
assert.equal((disclaimer.match(/data-testid="sku-render-disclaimer"/g) ?? []).length, 1);
assert.ok(/italic/.test(disclaimer), "italic display type, per 12.9");

// Unresolved after a judged correction: both findings listed, the retry slot
// rendered, and the headline may say the render was corrected once.
const unresolved = renderToStaticMarkup(
  <RenderReviewNote
    outcome="unresolved"
    issues={["The sofa faces away from the TV wall.", "The rug floats away from the seating."]}
    correctedAttemptJudged
  >
    <button data-testid="render-again">Render again</button>
  </RenderReviewNote>
);
assert.ok(unresolved.includes("The sofa faces away from the TV wall."));
assert.ok(unresolved.includes("The rug floats away from the seating."));
assert.ok(/data-testid="render-again"/.test(unresolved), "the render-again form is mounted inside the note");
assert.ok(/We corrected it once/.test(unresolved));
assert.equal(unresolved.includes("$"), false);

// Unresolved with ONE recorded verdict (no time for a retry, or the retry
// never produced a judged image): the note must not claim a correction.
const noRetry = renderToStaticMarkup(
  <RenderReviewNote outcome="unresolved" issues={["The rug floats away from the seating."]} reason="no_time_for_retry">
    <button data-testid="render-again">Render again</button>
  </RenderReviewNote>
);
assert.equal(/corrected it once/.test(noRetry), false, "no correction is claimed for a single verdict");
assert.ok(/did not pass our placement review/.test(noRetry));
assert.ok(/no time left in this attempt/.test(noRetry));
assert.ok(/data-testid="render-again"/.test(noRetry));
const retryFailed = renderToStaticMarkup(
  <RenderReviewNote outcome="unresolved" issues={["The rug floats away from the seating."]} />
);
assert.equal(/corrected it once/.test(retryFailed), false);
assert.ok(/A correction could not be completed/.test(retryFailed));
assert.equal(retryFailed.includes("provider 503"), false);

// Unreviewed: the note says the review could not run, with no findings to list.
const unreviewed = renderToStaticMarkup(
  <RenderReviewNote outcome="unreviewed" issues={[]}>
    <button data-testid="render-again">Render again</button>
  </RenderReviewNote>
);
assert.ok(/could not run/i.test(unreviewed));
assert.ok(/data-testid="render-again"/.test(unreviewed));
assert.equal(unreviewed.includes("provider timed out"), false, "provider errors are not shopper copy");

// Passed and resolved: no note at all.
assert.equal(renderToStaticMarkup(<RenderReviewNote outcome="passed" issues={[]} />), "");
assert.equal(renderToStaticMarkup(<RenderReviewNote outcome="resolved_after_regeneration" issues={["fixed"]} />), "");

// Left-out angles: one line, once; nothing when none.
assert.equal(renderToStaticMarkup(<ViewsLeftOutNote count={0} />), "");
const one = renderToStaticMarkup(<ViewsLeftOutNote count={1} />);
assert.ok(/One planned angle could not be verified as the same room and was left out\./.test(one));
assert.equal((one.match(/left out/g) ?? []).length, 1);
assert.ok(/Two planned angles/.test(renderToStaticMarkup(<ViewsLeftOutNote count={2} />)));

// The count comes from the job's recorded view outcomes.
assert.equal(leftOutViewCount({ focal_wide: { outcome: "unresolved", assetId: "a" }, anchor_detail: { outcome: "consistent", assetId: "b" } }), 1);
assert.equal(leftOutViewCount({ focal_wide: { outcome: "unchecked", assetId: "a" } }), 0);
assert.equal(leftOutViewCount(null), 0);
assert.equal(leftOutViewCount("nonsense"), 0);

console.log("render notes component tests passed");
