import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// S3: a role the app did not choose FOR the shopper (nothing was confirmed to
// match the design) must stay unchosen until they click it. The grid used to
// seed every unchosen role with its top-ranked option AND persist that as the
// selection on mount, which turned an open role back into an unverified pick,
// credited it in "N of N roles chosen", and put it in front of the design gate
// as the app's own choice.
//
// This reads the source rather than rendering: the component imports the
// server actions, which pull in `server-only`, so it cannot be mounted here
// today. Both halves of the regression are structural, so both are pinned.
const source = readFileSync(
  path.join(process.cwd(), "app/projects/[projectId]/rooms/[roomId]/shopping-list/shopping-list-grid.tsx"),
  "utf8"
);

// 1. Nothing may reach the database that the shopper did not click. The
// component therefore runs no effects at all; a future effect must not write.
assert.ok(
  !source.includes("useEffect"),
  "the grid must not run an effect that persists a pick the shopper never made"
);

// 2. The optimistic selection map starts from the persisted pick alone. A
// `group.items[0]` fallback here is what made an open role read as chosen on
// first paint, before any click or write.
const seed = source.slice(source.indexOf("useState<Map<string, string>>"), source.indexOf("const [rejectedIds"));
assert.ok(seed.includes("group.selectedId"), "the seed reads the persisted pick");
assert.ok(
  !/group\.items\[0\]/.test(seed),
  "an unchosen role must not be seeded with its top-ranked option"
);

// 3. The role's own affordance and the progress copy both come from that map,
// so an open role asks for a choice and is never counted as made.
assert.ok(source.includes("Choose one"), "an open role asks for a choice");
assert.ok(
  source.includes("selectedByRole.has(group.roleKey)"),
  "progress counts roles with a persisted or clicked pick, never every role"
);

console.log("shopping list grid tests passed");
