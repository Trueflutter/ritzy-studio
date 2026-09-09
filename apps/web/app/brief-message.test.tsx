import assert from "node:assert/strict";

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: unknown }).React = React;

import { BRIEF_FIELD_BOUNDS } from "@ritzy-studio/domain";

import {
  BriefMessage,
  isRefusedField
} from "./projects/[projectId]/rooms/[roomId]/brief/_components/brief-message";

// S5: a refusal travels as a field name and the screen resolves the copy.
// `?message=` is reflected verbatim on this and eight other screens, which is
// a pre-existing pattern, but handing that channel the error treatment would
// let anyone holding a room's URL render their own text as a first-class error
// inside the owner's session (security review).

// A known field renders the error: an alert, the error border, the field's
// name and the limit to aim for.
const refused = renderToStaticMarkup(<BriefMessage refused="colorNotes" />);
assert.match(refused, /role="alert"/);
assert.match(refused, /border-error/);
assert.match(refused, /colours and materials/);
assert.match(refused, /under 1200 characters/);

// Free text keeps the neutral note it has always had, and cannot borrow the
// error treatment however it is dressed.
const injected = renderToStaticMarkup(<BriefMessage message="Your payment failed." />);
assert.equal(injected.includes("role=\"alert\""), false, "free text is not an alert");
assert.equal(injected.includes("border-error"), false, "free text does not get the error border");
assert.match(injected, /Your payment failed\./, "it still renders, as a neutral note");

// An unknown name is not an error either, and neither is anything reachable
// through the prototype chain: `in` would have let `constructor` and
// `__proto__` through the allowlist (security review).
for (const value of ["unknown", "constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"]) {
  assert.equal(isRefusedField(value), false, `${value} is not a refusable field`);
  assert.equal(
    renderToStaticMarkup(<BriefMessage refused={value} />),
    "",
    `${value} renders nothing rather than an error`
  );
}

// EVERY bounded field, walked from the table rather than from a list pasted
// here: a field the schema bounds but this component does not label renders
// nothing at all, so the shopper presses Continue, the page reloads identical
// and nothing was saved (tests review, which found budgetNotes in exactly
// that state).
for (const field of Object.keys(BRIEF_FIELD_BOUNDS)) {
  assert.equal(isRefusedField(field), true, `${field} is refusable`);
  const markup = renderToStaticMarkup(<BriefMessage refused={field} />);
  assert.match(markup, /was too long to save/, `${field} explains what happened`);
  assert.equal(markup.includes("Shorten it and continue"), false, "no instruction the shopper cannot follow");
}

// Nothing at all renders nothing.
assert.equal(renderToStaticMarkup(<BriefMessage />), "");

console.log("brief message component tests passed");
