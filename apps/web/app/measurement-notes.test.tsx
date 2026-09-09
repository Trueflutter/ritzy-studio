import assert from "node:assert/strict";

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: unknown }).React = React;

import { MeasurementAssumptionNotes } from "./projects/[projectId]/rooms/[roomId]/brief/details/measurement-notes";

// S5 (AC 7): the assumption list renders what it is given, numbered, and
// renders nothing at all when there is nothing to assume, so a fully measured
// room does not carry an empty panel.

const withNotes = renderToStaticMarkup(
  <MeasurementAssumptionNotes
    notes={[
      "Without the main wall and the room depth, the design is scaled from your photographs rather than exact dimensions.",
      "Focal point not confirmed; assuming the TV/media wall anchors the seating."
    ]}
  />
);

assert.match(withNotes, /What we will assume/);
assert.match(withNotes, /scaled from your photographs/);
assert.match(withNotes, /TV\/media wall anchors the seating/);
assert.match(withNotes, /<ol/, "the assumptions are a list, per design system 12.5");
assert.equal((withNotes.match(/<li/g) ?? []).length, 2, "one item per assumption");
assert.match(withNotes, />i\.</, "numbered in roman numerals");
assert.match(withNotes, />ii\.</);

// Nothing to assume renders nothing, not an empty bordered box.
assert.equal(renderToStaticMarkup(<MeasurementAssumptionNotes notes={[]} />), "");

// The assumptions are visible on the page, never hidden behind a tooltip
// (12.5 forbids it) and never collapsed behind a control on this screen.
assert.equal(withNotes.includes("title="), false, "no tooltip carries the assumptions");
assert.equal(withNotes.includes("<details"), false, "the list is not collapsed on the form");

console.log("measurement notes component tests passed");
