import assert from "node:assert/strict";

import { designSpecObjectsSchema, parseRoomDesignSpecRow } from "./design-spec";

const OBJECTS = [
  {
    role: "sofa",
    label: "Three-seat sofa",
    quantity: 1,
    sizeDescriptor: "three-seat, around 240 cm",
    capacity: "seats 3",
    paletteMaterials: ["ivory boucle", "walnut legs"]
  },
  {
    role: "dining_chairs",
    label: "Dining chairs",
    quantity: 6,
    sizeDescriptor: null,
    capacity: null,
    paletteMaterials: ["oak", "linen"]
  }
];

assert.equal(designSpecObjectsSchema.safeParse(OBJECTS).success, true);
assert.equal(designSpecObjectsSchema.safeParse([]).success, false);
assert.equal(
  designSpecObjectsSchema.safeParse([{ ...OBJECTS[0], quantity: 0 }]).success,
  false,
  "zero-quantity objects are not a commitment"
);

// Upper caps bound user-controlled confirm input; widening them must fail here.
assert.equal(
  designSpecObjectsSchema.safeParse(Array.from({ length: 31 }, () => OBJECTS[0])).success,
  false,
  "31 objects must be rejected"
);
assert.equal(
  designSpecObjectsSchema.safeParse([{ ...OBJECTS[0], quantity: 25 }]).success,
  false,
  "quantity 25 must be rejected"
);
assert.equal(
  designSpecObjectsSchema.safeParse([{ ...OBJECTS[0], label: "x".repeat(121) }]).success,
  false,
  "over-long labels must be rejected"
);
assert.equal(
  designSpecObjectsSchema.safeParse([
    { ...OBJECTS[0], paletteMaterials: Array.from({ length: 9 }, (_, i) => `material ${i}`) }
  ]).success,
  false,
  "9 palette entries must be rejected"
);

const row = {
  id: "spec-1",
  room_id: "room-1",
  concept_id: "concept-1",
  objects: OBJECTS,
  must_preserve: ["sliding doors to the terrace", "marble flooring"],
  status: "extracted"
};

const parsed = parseRoomDesignSpecRow(row);
assert.ok(parsed);
assert.equal(parsed?.objects.length, 2);
assert.equal(parsed?.mustPreserve.length, 2);
assert.equal(parsed?.status, "extracted");

assert.equal(parseRoomDesignSpecRow({ ...row, objects: [{ bad: true }] }), null);
assert.equal(parseRoomDesignSpecRow({ ...row, status: "draft" }), null);

console.log("design-spec domain tests passed");
