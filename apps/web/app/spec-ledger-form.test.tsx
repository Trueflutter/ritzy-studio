import assert from "node:assert/strict";

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// tsx resolves workspace ui components through node_modules symlinks, where its
// transform emits the classic JSX runtime; providing the React global satisfies
// those modules without touching the library.
(globalThis as { React?: unknown }).React = React;

import { SpecLedgerForm } from "./projects/[projectId]/rooms/[roomId]/spec/spec-ledger-form";

// One editable row per object, keyed by INDEX: duplicate roles must never
// collapse rows, or a confirm would persist a truncated spec as truth.

const objects = [
  {
    role: "lighting",
    label: "Arc floor lamp",
    quantity: 1,
    sizeDescriptor: "tall, arching over the sofa",
    capacity: null,
    paletteMaterials: ["brass"]
  },
  {
    role: "lighting",
    label: "Recessed downlights",
    quantity: 8,
    sizeDescriptor: null,
    capacity: null,
    paletteMaterials: []
  }
];

const html = renderToStaticMarkup(
  <SpecLedgerForm
    action={() => {}}
    conceptTitle="Warm Gallery"
    extracted
    mustPreserve={["sliding doors", "marble floor"]}
    objects={objects}
    projectId="proj-1"
    roomId="room-1"
    specId="spec-1"
  />
);

// Both same-role objects render their own editable row with index-stable names.
assert.equal((html.match(/name="object-\d+-label"/g) ?? []).length, 2);
assert.ok(html.includes('name="object-0-label"'));
assert.ok(html.includes('name="object-1-label"'));
assert.ok(html.includes('value="Arc floor lamp"'));
assert.ok(html.includes('value="Recessed downlights"'));
assert.ok(html.includes('value="8"'));
// Hidden roles carry through per row.
assert.equal((html.match(/name="object-\d+-role"/g) ?? []).length, 2);
// The count the decoder trusts matches the rendered rows.
assert.ok(html.includes('name="objectCount"') && html.includes('value="2"'));
// The schema constraints ride on the inputs (edit-safety review finding).
assert.ok(html.includes('max="24"'));
assert.ok(html.includes("required"));
// 12.6: extracted sizes carry the assumed caption.
assert.ok(html.includes(">assumed<"));
// Must-preserve prefills one per line.
assert.ok(html.includes("sliding doors\nmarble floor"));

console.log("spec ledger form component tests passed");
