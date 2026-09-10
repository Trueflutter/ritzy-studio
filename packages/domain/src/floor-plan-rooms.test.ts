import assert from "node:assert/strict";

import { BRIEF_FIELD_BOUNDS } from "./index";
import {
  DETECTED_ROOM_LABEL_MAX,
  DETECTED_ROOM_MAX_CM,
  DETECTED_ROOMS_MAX,
  PLAN_READABLE_MIN_EDGE_PX,
  boundedDetectedRooms,
  confirmedFloorPlanRoom,
  detectedRoomLabel,
  floorPlanReadDecision,
  floorPlanScreenState,
  roomDimensionsLabel,
  roomIsDimensioned
} from "./floor-plan-rooms";

// S5b: what a floor plan read is allowed to say, and when it is allowed to
// happen at all.
//
// The stakes are set by what the confirmation writes: `confidence = 'verified'`,
// which is the value `measurementCanSupportProductFit` requires before the
// design will size furniture against a dimension. A number this module lets
// through is a number the room will be furnished by, so every bound here is a
// refusal to guess rather than a formatting preference.

// ---------------------------------------------------------------- the bounds
{
  const room = (over: Record<string, unknown> = {}) => ({
    label: "Living Room",
    wallLengthCm: 520,
    roomDepthCm: 410,
    ceilingHeightCm: null,
    level: null,
    ...over
  });

  assert.deepEqual(boundedDetectedRooms([room()]), [
    { label: "Living Room", wallLengthCm: 520, roomDepthCm: 410, ceilingHeightCm: null, level: null }
  ]);

  // A dimension outside what the brief's own schema will store is dropped, not
  // clamped: a plan read in millimetres returns 5200 for a 5.2 m wall, and
  // clamping it to the maximum would present 50 m as if it had been read.
  assert.equal(boundedDetectedRooms([room({ wallLengthCm: 52_000 })])[0].wallLengthCm, null);

  // A read is held to a tighter ceiling than the form is. A metric plan drawn
  // in millimetres returns 3200 for a 3.2 m bedroom, which sits comfortably
  // inside the form's 5000 cm, and confirming it would write 32 metres as
  // verified (review finding).
  assert.equal(boundedDetectedRooms([room({ wallLengthCm: 3200, roomDepthCm: 2800 })])[0].wallLengthCm, null);
  assert.equal(boundedDetectedRooms([room({ wallLengthCm: 3200, roomDepthCm: 2800 })])[0].roomDepthCm, null);
  assert.equal(boundedDetectedRooms([room({ wallLengthCm: DETECTED_ROOM_MAX_CM })])[0].wallLengthCm, DETECTED_ROOM_MAX_CM);
  assert.equal(boundedDetectedRooms([room({ wallLengthCm: DETECTED_ROOM_MAX_CM + 1 })])[0].wallLengthCm, null);
  assert.ok(DETECTED_ROOM_MAX_CM < BRIEF_FIELD_BOUNDS.wallLengthCm.max, "tighter than what a person may type");
  assert.equal(boundedDetectedRooms([room({ roomDepthCm: 0 })])[0].roomDepthCm, null);
  assert.equal(boundedDetectedRooms([room({ ceilingHeightCm: 2000 })])[0].ceilingHeightCm, null);
  assert.equal(boundedDetectedRooms([room({ wallLengthCm: Number.NaN })])[0].wallLengthCm, null);
  assert.equal(boundedDetectedRooms([room({ wallLengthCm: "520" })])[0].wallLengthCm, null, "a string is not a number");

  // Labels are the shopper-facing half and come from a model, so they are
  // trimmed and cut rather than trusted.
  assert.equal(boundedDetectedRooms([room({ label: "  Living Room  " })])[0].label, "Living Room");
  assert.equal(
    boundedDetectedRooms([room({ label: "x".repeat(DETECTED_ROOM_LABEL_MAX + 40) })])[0].label.length,
    DETECTED_ROOM_LABEL_MAX
  );
  assert.deepEqual(boundedDetectedRooms([room({ label: "   " })]), [], "a room with no name is not a room");
  assert.deepEqual(boundedDetectedRooms([room({ label: 12 })]), []);

  // A whole home has a lot of rooms; a model that returns two hundred is
  // answering a different question.
  const many = Array.from({ length: DETECTED_ROOMS_MAX + 9 }, (_, index) => room({ label: `Room ${index}` }));
  assert.equal(boundedDetectedRooms(many).length, DETECTED_ROOMS_MAX);

  // And the cut takes the rooms she cannot act on first. Plans name halls,
  // landings and cupboards without dimensioning them, so cutting in the
  // model's order can drop her bedroom in favour of twelve closets and leave
  // the screen saying nothing on the plan was dimensioned (review finding).
  const cupboards = Array.from({ length: DETECTED_ROOMS_MAX + 4 }, (_, index) =>
    room({ label: `Closet ${index}`, wallLengthCm: null, roomDepthCm: null })
  );
  const cut = boundedDetectedRooms([...cupboards, room({ label: "Master Bedroom" })]);
  assert.equal(cut.length, DETECTED_ROOMS_MAX);
  assert.equal(cut[0].label, "Master Bedroom", "the room she came for survives the cut");
  assert.deepEqual(
    boundedDetectedRooms([
      room({ label: "Hall", wallLengthCm: null, roomDepthCm: null }),
      room({ label: "Living Room" })
    ]).map((entry) => entry.label),
    ["Living Room", "Hall"],
    "the rooms she can measure from lead the list"
  );

  assert.deepEqual(boundedDetectedRooms([]), []);
  assert.deepEqual(boundedDetectedRooms(null), []);
  assert.deepEqual(boundedDetectedRooms("rooms"), []);
  assert.deepEqual(boundedDetectedRooms([null, 7, "room"]), []);
}

// ------------------------------------------------------- what she can confirm
{
  const rooms = boundedDetectedRooms([
    { label: "Living Room", wallLengthCm: 520, roomDepthCm: 410, ceilingHeightCm: null, level: null },
    // The villa brochure case, measured on the Tilal fixture: its drawings are
    // embedded 1546 by 949 JPEGs, so the names read and the dimension lines
    // under them do not, at any rasterisation. Confirming still tells the
    // concept prompt which room on the drawing is hers, which is the half this
    // read is reliable at.
    { label: "Family Room", wallLengthCm: null, roomDepthCm: null, ceilingHeightCm: null, level: null },
    { label: "Study", wallLengthCm: 300, roomDepthCm: null, ceilingHeightCm: null, level: null }
  ]);

  assert.equal(roomIsDimensioned(rooms[0]), true);
  assert.equal(roomIsDimensioned(rooms[1]), false);
  assert.equal(roomIsDimensioned(rooms[2]), false, "one dimension is not a size");
}

// ------------------------------------------------------------- what she reads
{
  assert.equal(roomDimensionsLabel({ wallLengthCm: 520, roomDepthCm: 410 }), "5.2 by 4.1 m");
  assert.equal(roomDimensionsLabel({ wallLengthCm: 884, roomDepthCm: 470 }), "8.8 by 4.7 m");
  assert.equal(roomDimensionsLabel({ wallLengthCm: 500, roomDepthCm: 400 }), "5.0 by 4.0 m", "a trailing zero is kept");
  assert.equal(roomDimensionsLabel({ wallLengthCm: 520, roomDepthCm: null }), null);
  assert.equal(roomDimensionsLabel({ wallLengthCm: null, roomDepthCm: null }), null);

  // The same drawing can carry the same name three times, one per floor
  // (Ayo's fixture does exactly this), so the level is part of the name when
  // the read gives one.
  assert.equal(detectedRoomLabel({ label: "Bedroom", level: null }), "Bedroom");
  assert.equal(detectedRoomLabel({ label: "Bedroom", level: "second" }), "Bedroom, second");
  assert.equal(detectedRoomLabel({ label: "Bedroom", level: "  " }), "Bedroom");
}

// -------------------------------------------------------------- the decision
{
  const attached = "asset-b";

  // Nothing attached, nothing to read.
  assert.equal(floorPlanReadDecision({ asset: null, newestJob: null }).action, "no_plan");

  // A PDF is stored today and read by nothing; it is refused before a call is
  // made rather than sent to a model that cannot open it.
  assert.equal(
    floorPlanReadDecision({
      asset: { id: attached, mimeType: "application/pdf", widthPx: 2400, heightPx: 1600 },
      newestJob: null
    }).action,
    "unreadable_format"
  );

  // The floor. Ayo's real plan is 390 by 578, so its dimension strings are
  // about four pixels tall; reading it can only guess, and the confirmation
  // would then write that guess as verified.
  assert.equal(
    floorPlanReadDecision({
      asset: { id: attached, mimeType: "image/jpeg", widthPx: 390, heightPx: 578 },
      newestJob: null
    }).action,
    "too_small"
  );
  assert.equal(
    floorPlanReadDecision({
      asset: { id: attached, mimeType: "image/jpeg", widthPx: PLAN_READABLE_MIN_EDGE_PX, heightPx: 400 },
      newestJob: null
    }).action,
    "read",
    "the floor is on the LONGEST edge, so a wide plan qualifies"
  );

  // The case the floor must not refuse: a real Emaar marketing plan, which is
  // what a Dubai developer publishes and what the fixtures now carry. A floor
  // above this would reject the drawing the feature exists for.
  assert.equal(
    floorPlanReadDecision({
      asset: { id: attached, mimeType: "image/jpeg", widthPx: 1067, heightPx: 550 },
      newestJob: null
    }).action,
    "read"
  );
  assert.ok(PLAN_READABLE_MIN_EDGE_PX < 1067, "the floor sits below what developers publish");
  assert.ok(PLAN_READABLE_MIN_EDGE_PX > 578, "and above the listing thumbnail nothing can be read from");

  // An unknown size is read rather than refused: `readImageSize` returns null
  // for a format it cannot measure in the browser, and refusing on that would
  // turn a missing measurement into a missing feature.
  assert.equal(
    floorPlanReadDecision({
      asset: { id: attached, mimeType: "image/png", widthPx: null, heightPx: null },
      newestJob: null
    }).action,
    "read"
  );

  const readable = { id: attached, mimeType: "image/png", widthPx: 2400, heightPx: 1600 };

  // The guard that stops the same answer being bought twice.
  assert.equal(
    floorPlanReadDecision({ asset: readable, newestJob: { assetId: attached, status: "succeeded" } }).action,
    "already_read"
  );
  assert.equal(
    floorPlanReadDecision({ asset: readable, newestJob: { assetId: attached, status: "running" } }).action,
    "in_flight"
  );

  // A failed read is retryable, which is what the screen's retry calls.
  assert.equal(
    floorPlanReadDecision({ asset: readable, newestJob: { assetId: attached, status: "failed" } }).action,
    "read"
  );

  // A job for the plan she replaced says nothing about the plan she attached.
  assert.equal(
    floorPlanReadDecision({ asset: readable, newestJob: { assetId: "asset-a", status: "succeeded" } }).action,
    "read"
  );
}

// ------------------------------------------ what the confirmation remembers
{
  assert.deepEqual(confirmedFloorPlanRoom({ assetId: "plan-a", label: "Living Room", index: 2 }), {
    assetId: "plan-a",
    label: "Living Room",
    index: 2
  });

  // An index is part of the identity, because a whole-home plan carries
  // "Bedroom" three times and a label alone marks all three.
  assert.equal(confirmedFloorPlanRoom({ assetId: "plan-a", label: "Living Room" }), null);
  assert.equal(confirmedFloorPlanRoom({ assetId: "plan-a", label: "Living Room", index: -1 }), null);
  assert.equal(confirmedFloorPlanRoom({ assetId: "plan-a", label: "Living Room", index: 1.5 }), null);
  assert.equal(confirmedFloorPlanRoom({ label: "Living Room", index: 0 }), null);
  assert.equal(confirmedFloorPlanRoom(null), null);
  assert.equal(confirmedFloorPlanRoom("living room"), null);
}

console.log("floor plan rooms tests passed");
