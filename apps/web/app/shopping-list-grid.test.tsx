import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  allRolesChosen,
  awaitingChoiceCaveat,
  chosenRoleCount,
  rolesAwaitingChoice
} from "./projects/[projectId]/rooms/[roomId]/shopping-list/completeness";

// S3: a role the app did not choose FOR the shopper (nothing was confirmed to
// match the design) must stay unchosen until they click it, must not be
// counted as chosen, and must keep the final render gated. The grid used to
// seed every unchosen role with its top-ranked option AND persist that as the
// selection on mount, which turned an open role back into an unverified pick.

const groups = [{ roleKey: "spec:0:sofa" }, { roleKey: "spec:1:tray" }, { roleKey: "spec:2:lamp" }];

// Only roles with a pick count, and the render stays gated until all do.
assert.equal(chosenRoleCount(groups, new Map()), 0, "an all-open list has nothing chosen");
assert.equal(chosenRoleCount(groups, new Map([["spec:0:sofa", "item-1"]])), 1);
assert.equal(chosenRoleCount([], new Map()), 0);
assert.equal(allRolesChosen(groups, new Map([["spec:0:sofa", "item-1"]])), false);
assert.equal(
  allRolesChosen(groups, new Map(groups.map((group) => [group.roleKey, "item"]))),
  true
);
// A pick for a role that is not on the list cannot stand in for a real one.
assert.equal(chosenRoleCount(groups, new Map([["spec:9:ghost", "item-9"]])), 0);
assert.equal(allRolesChosen(groups, new Map([["spec:9:ghost", "item-9"]])), false);

// The screens say how many pieces still need a choice, so a list with open
// roles can never read as complete.
const group = (statuses: string[]) => ({ options: statuses.map((status) => ({ status })) });
assert.equal(rolesAwaitingChoice([group(["selected", "option"]), group(["option", "option"])]), 1);
assert.equal(rolesAwaitingChoice([group(["selected"]), group(["selected"])]), 0);
assert.equal(rolesAwaitingChoice([group([])]), 1, "a role with no options at all still needs a choice");
assert.equal(awaitingChoiceCaveat(0), null);
assert.equal(awaitingChoiceCaveat(1), "1 piece needs your choice.");
assert.equal(awaitingChoiceCaveat(6), "6 pieces need your choice.");

// The blocker this pins was an effect that persisted a default pick on mount,
// which server rendering cannot execute and a pure helper cannot express. The
// component therefore carries no effects at all: nothing may reach the
// database that the shopper did not click.
const source = readFileSync(
  path.join(process.cwd(), "app/projects/[projectId]/rooms/[roomId]/shopping-list/shopping-list-grid.tsx"),
  "utf8"
);
assert.ok(
  !source.includes("useEffect"),
  "the grid must not run an effect that persists a pick the shopper never made"
);
const seed = source.slice(source.indexOf("useState<Map<string, string>>"), source.indexOf("const [rejectedIds"));
assert.ok(seed.includes("group.selectedId"), "the seed reads the persisted pick");
assert.ok(!/group\.items\[0\]/.test(seed), "an unchosen role must not be seeded with its top-ranked option");

console.log("shopping list grid tests passed");
