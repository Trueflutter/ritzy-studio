import assert from "node:assert/strict";

import { catalogFirstRolesForRoom, type CatalogFirstRoomType } from "./catalog-first-room-generation";
import { catalogFirstRolesToProductMatchingSpecs } from "./catalog-first-product-matching";

const expectedSpecsByRoom: Record<CatalogFirstRoomType, ReturnType<typeof catalogFirstRolesToProductMatchingSpecs>> = {
  living_room: [
    { category: "sofas", label: "sofa", visualBrief: null, quantity: 1, priority: "required" },
    { category: "rugs", label: "rug", visualBrief: null, quantity: 1, priority: "required" },
    { category: "coffee_tables", label: "coffee table", visualBrief: null, quantity: 1, priority: "required" },
    { category: "storage", label: "TV/media console", visualBrief: null, quantity: 1, priority: "supporting" },
    { category: "lighting", label: "lighting", visualBrief: null, quantity: 2, priority: "supporting" },
    { category: "decor", label: "cushions", visualBrief: null, quantity: 4, priority: "supporting" }
  ],
  dining_room: [
    { category: "dining_tables", label: "dining table", visualBrief: null, quantity: 1, priority: "required" },
    { category: "chairs", label: "dining chairs", visualBrief: null, quantity: 6, priority: "required" },
    { category: "lighting", label: "lighting", visualBrief: null, quantity: 1, priority: "supporting" },
    { category: "storage", label: "sideboard/console", visualBrief: null, quantity: 1, priority: "supporting" }
  ],
  bedroom: [
    { category: "beds", label: "bed", visualBrief: null, quantity: 1, priority: "required" },
    { category: "side_tables", label: "bedside tables", visualBrief: null, quantity: 2, priority: "required" },
    { category: "lighting", label: "lighting", visualBrief: null, quantity: 2, priority: "supporting" },
    { category: "rugs", label: "rug/textile layer", visualBrief: null, quantity: 1, priority: "supporting" }
  ],
  home_office: [
    { category: "desks", label: "desk", visualBrief: null, quantity: 1, priority: "required" },
    { category: "office_chairs", label: "office chair", visualBrief: null, quantity: 1, priority: "required" },
    { category: "lighting", label: "task lighting", visualBrief: null, quantity: 1, priority: "supporting" },
    { category: "storage", label: "storage/shelving", visualBrief: null, quantity: 1, priority: "supporting" }
  ]
};

for (const roomType of Object.keys(expectedSpecsByRoom) as CatalogFirstRoomType[]) {
  const roles = catalogFirstRolesForRoom(roomType);
  const before = structuredClone(roles);
  const specs = catalogFirstRolesToProductMatchingSpecs(roles);

  assert.deepEqual(specs, expectedSpecsByRoom[roomType]);
  assert.notEqual(specs, roles);
  assert.deepEqual(roles, before);
}

console.log("catalog-first product matching adapter tests passed");
