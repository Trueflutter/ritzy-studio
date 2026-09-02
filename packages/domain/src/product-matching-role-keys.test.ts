import assert from "node:assert/strict";

import { normalizeProductMatchRoleResultCategory, productMatchRoleKey } from "./product-matching-role-keys";

// What survives of the catalogue-first apparatus: how a role's category is
// normalised when the visual pass's answer is reconciled with the pool it came
// from. A drift here silently sends a verdict to the wrong role.

assert.equal(productMatchRoleKey("Side Tables", "Bedside table"), "side_tables::bedside_table");
assert.equal(productMatchRoleKey("  lighting  ", "Arc floor lamp!"), "lighting::arc_floor_lamp");

// A dining chair is a chair, not an armchair, whatever the pool called it.
assert.equal(normalizeProductMatchRoleResultCategory("armchairs", "upholstered dining chairs"), "chairs");
assert.equal(normalizeProductMatchRoleResultCategory("side_tables", "anything at all"), "side_tables");
assert.equal(normalizeProductMatchRoleResultCategory("furniture", "walnut headboard"), "headboards");
assert.equal(normalizeProductMatchRoleResultCategory("furniture", "leaning floor mirror"), "mirrors");
// Preserved quirk, pinned rather than silently inherited: "wall" is tested
// before "mirror", so a WALL mirror normalises to wall_art. Sourcing does not
// depend on it (the spec contract decides the category), but a future change
// to this order should be a deliberate one.
assert.equal(normalizeProductMatchRoleResultCategory("furniture", "round wall mirror"), "wall_art");
assert.equal(normalizeProductMatchRoleResultCategory("furniture", "ceramic vase"), "decor");
assert.equal(normalizeProductMatchRoleResultCategory("furniture", "media console"), "storage");
assert.equal(normalizeProductMatchRoleResultCategory("furniture", "king bed"), "beds");
// Nothing recognised leaves the category as it was.
assert.equal(normalizeProductMatchRoleResultCategory("rugs", "large flatweave"), "rugs");

console.log("product matching role key tests passed");
