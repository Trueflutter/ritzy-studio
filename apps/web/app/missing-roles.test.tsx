import assert from "node:assert/strict";

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: unknown }).React = React;

import {
  MissingRolesSection,
  missingRoleCount,
  missingRolesCaveat
} from "./projects/[projectId]/rooms/[roomId]/shopping-list/missing-roles";

// AC 9: a role with no qualifying candidates renders a visible row with reason
// and guidance; totals and completeness copy exclude it; "6 of 6" style false
// completeness cannot render while a role is missing.

const entries = [
  {
    specKey: "3:floor_lamp",
    kind: "missing" as const,
    label: "tall tripod floor lamp",
    category: "lighting",
    quantity: 1,
    reason: "Every lighting piece in the catalogue is the wrong kind of fixture for this role; the design asks for a floor or table lamp.",
    guidance: "Try Refresh matches after the nightly catalogue update, or source this piece directly from a retailer."
  },
  {
    specKey: "9:bedside_table",
    kind: "missing" as const,
    label: "walnut bedside tables",
    category: "side_tables",
    quantity: 2,
    reason: "No side table in the live catalogue matched this piece.",
    guidance: "Try Refresh matches after the nightly catalogue update, or source this piece directly from a retailer."
  },
  {
    specKey: "4:lighting",
    kind: "built_in" as const,
    label: "recessed downlights",
    category: null,
    quantity: 8,
    reason: "Built into the room; not a purchasable piece.",
    guidance: "Nothing to buy for this one."
  }
];

const html = renderToStaticMarkup(<MissingRolesSection entries={entries} />);
assert.equal((html.match(/data-testid="missing-role"/g) ?? []).length, 2, "one visible row per missing role");
assert.ok(html.includes("tall tripod floor lamp"));
assert.ok(html.includes("wrong kind of fixture"), "the reason is rendered");
assert.ok(html.includes("source this piece directly from a retailer"), "the guidance is rendered");
assert.ok(html.includes("× 2"), "quantity is shown");
assert.equal((html.match(/data-testid="not-for-sale"/g) ?? []).length, 1, "built-in fixtures are listed apart, not as missing");
assert.ok(html.includes("2 pieces could not be sourced."));
assert.equal(html.includes("$"), false, "no dollar signs in user-visible copy");

assert.equal(missingRoleCount(entries), 2, "built-in fixtures never count as missing");
assert.equal(missingRolesCaveat(entries), "2 pieces could not be sourced.");
assert.equal(missingRolesCaveat([entries[0]]), "1 piece could not be sourced.");
assert.equal(missingRolesCaveat([entries[2]]), null, "nothing missing means no caveat");
assert.equal(renderToStaticMarkup(<MissingRolesSection entries={[]} />), "", "nothing to disclose renders nothing");

console.log("missing roles component tests passed");
