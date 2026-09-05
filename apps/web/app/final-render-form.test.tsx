import assert from "node:assert/strict";

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: unknown }).React = React;

import { FinalRenderForm } from "./projects/[projectId]/rooms/[roomId]/presentation/final-render-form";

// S4 (AC 10 and 11, the wire): the review note's "render again" posts the
// job it renders again as a hidden retryOf field, and only then; a normal
// submission carries no retryOf, and a room that cannot request a render
// gets the button alone, never a form.
const action = async () => {};
const base = { action, canRequestRender: true, conceptId: "concept-1", projectId: "proj-1", roomId: "room-1", selectedIds: ["item-1", "item-2"], shoppingListId: "list-1" };

const again = renderToStaticMarkup(<FinalRenderForm {...base} retryOf="job-1" tone="ink" />);
assert.match(again, /<input type="hidden" name="retryOf" value="job-1"\/>/, "the flagged state posts the job it renders again");
assert.match(again, /Render again/);
assert.match(again, /<input type="hidden" name="selectedItemIds" value="item-1,item-2"\/>/);
assert.match(again, /<form/);

const fresh = renderToStaticMarkup(<FinalRenderForm {...base} />);
assert.equal(fresh.includes("retryOf"), false, "a normal submission carries no retryOf");
assert.match(fresh, /Generate render/);

const locked = renderToStaticMarkup(<FinalRenderForm {...base} canRequestRender={false} retryOf="job-1" />);
assert.equal(locked.includes("<form"), false, "a room that cannot request a render gets no form");
assert.equal(locked.includes("retryOf"), false);

console.log("final render form component tests passed");
