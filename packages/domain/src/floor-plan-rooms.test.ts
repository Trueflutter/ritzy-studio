import assert from "node:assert/strict";

import { BRIEF_FIELD_BOUNDS } from "./index";
import {
  DETECTED_ROOM_LABEL_MAX,
  DETECTED_ROOMS_MAX,
  PLAN_READABLE_MIN_EDGE_PX,
  boundedDetectedRooms,
  confirmableRooms,
  cropRectangleFor,
  detectedRoomLabel,
  floorPlanReadDecision,
  roomDimensionsLabel
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
    box: null,
    level: null,
    ...over
  });

  assert.deepEqual(boundedDetectedRooms([room()]), [
    { label: "Living Room", wallLengthCm: 520, roomDepthCm: 410, ceilingHeightCm: null, box: null, level: null }
  ]);

  // A dimension outside what the brief's own schema will store is dropped, not
  // clamped: a plan read in millimetres returns 5200 for a 5.2 m wall, and
  // clamping it to the maximum would present 50 m as if it had been read.
  assert.equal(boundedDetectedRooms([room({ wallLengthCm: 52_000 })])[0].wallLengthCm, null);
  assert.equal(boundedDetectedRooms([room({ roomDepthCm: 0 })])[0].roomDepthCm, null);
  assert.equal(boundedDetectedRooms([room({ ceilingHeightCm: 2000 })])[0].ceilingHeightCm, null);
  assert.equal(
    boundedDetectedRooms([room({ wallLengthCm: BRIEF_FIELD_BOUNDS.wallLengthCm.max })])[0].wallLengthCm,
    BRIEF_FIELD_BOUNDS.wallLengthCm.max,
    "the schema's own maximum is inside the bound, not outside it"
  );
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

  assert.deepEqual(boundedDetectedRooms([]), []);
  assert.deepEqual(boundedDetectedRooms(null), []);
  assert.deepEqual(boundedDetectedRooms("rooms"), []);
  assert.deepEqual(boundedDetectedRooms([null, 7, "room"]), []);
}

// ------------------------------------------------------------------ the box
{
  const withBox = (box: unknown) =>
    boundedDetectedRooms([
      { label: "Living Room", wallLengthCm: 520, roomDepthCm: 410, ceilingHeightCm: null, box, level: null }
    ])[0].box;

  assert.deepEqual(withBox({ x0: 0.1, y0: 0.2, x1: 0.5, y1: 0.6 }), { x0: 0.1, y0: 0.2, x1: 0.5, y1: 0.6 });

  // A box that is not a box is dropped, and the room survives without one:
  // the room is still confirmable, it just cannot be cropped or outlined.
  assert.equal(withBox({ x0: -0.1, y0: 0.2, x1: 0.5, y1: 0.6 }), null, "outside the image");
  assert.equal(withBox({ x0: 0.1, y0: 0.2, x1: 1.4, y1: 0.6 }), null);
  assert.equal(withBox({ x0: 0.5, y0: 0.2, x1: 0.5, y1: 0.6 }), null, "zero width is not a region");
  assert.equal(
    withBox({ x0: 0.5, y0: 0.5, x1: 0.5004, y1: 0.5004 }),
    null,
    "a point is not a region: with a margin around it a degenerate box still crops, so it is refused here"
  );
  assert.deepEqual(
    withBox({ x0: 0.5, y0: 0.5, x1: 0.52, y1: 0.52 }),
    { x0: 0.5, y0: 0.5, x1: 0.52, y1: 0.52 },
    "and the smallest real region is kept"
  );
  assert.equal(withBox({ x0: 0.6, y0: 0.2, x1: 0.5, y1: 0.6 }), null, "reversed is not a region");
  assert.equal(withBox({ x0: 0.1, y0: 0.2, x1: 0.5 }), null);
  assert.equal(withBox(null), null);
  assert.equal(withBox("0.1,0.2,0.5,0.6"), null);
}

// ------------------------------------------------------- what she can confirm
{
  const rooms = boundedDetectedRooms([
    { label: "Living Room", wallLengthCm: 520, roomDepthCm: 410, ceilingHeightCm: null, box: null, level: null },
    { label: "Store", wallLengthCm: null, roomDepthCm: null, ceilingHeightCm: null, box: null, level: null },
    { label: "Study", wallLengthCm: 300, roomDepthCm: null, ceilingHeightCm: null, box: null, level: null }
  ]);

  // Confirming writes the row, so a room the plan gives no dimensions for has
  // nothing to write. It still appears on screen, saying so, which is why this
  // is a split rather than a filter.
  assert.deepEqual(
    confirmableRooms(rooms).map((room) => room.label),
    ["Living Room"]
  );
  assert.equal(rooms.length, 3, "the unconfirmable rooms are still rendered");
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

// ------------------------------------------------------------------ the crop
{
  const box = { x0: 0.25, y0: 0.5, x1: 0.5, y1: 0.75 };

  // Pixels for sharp, with a margin so the crop carries the room's own walls
  // rather than cutting through them.
  const rect = cropRectangleFor({ box, widthPx: 1000, heightPx: 800, marginRatio: 0 });
  assert.deepEqual(rect, { left: 250, top: 400, width: 250, height: 200 });

  const withMargin = cropRectangleFor({ box, widthPx: 1000, heightPx: 800, marginRatio: 0.04 });
  assert.deepEqual(withMargin, { left: 210, top: 368, width: 330, height: 264 });

  // The margin cannot walk off the drawing.
  assert.deepEqual(
    cropRectangleFor({ box: { x0: 0, y0: 0, x1: 0.2, y1: 0.2 }, widthPx: 1000, heightPx: 800, marginRatio: 0.1 }),
    { left: 0, top: 0, width: 300, height: 240 }
  );
  assert.deepEqual(
    cropRectangleFor({ box: { x0: 0.9, y0: 0.9, x1: 1, y1: 1 }, widthPx: 1000, heightPx: 800, marginRatio: 0.1 }),
    { left: 800, top: 640, width: 200, height: 160 }
  );

  // A crop of nothing is not a crop.
  assert.equal(cropRectangleFor({ box: null, widthPx: 1000, heightPx: 800 }), null);
  assert.equal(cropRectangleFor({ box, widthPx: 0, heightPx: 800 }), null);
  assert.equal(
    cropRectangleFor({ box: { x0: 0.5, y0: 0.5, x1: 0.5004, y1: 0.5004 }, widthPx: 1000, heightPx: 800, marginRatio: 0 }),
    null,
    "a region under a pixel is not a region once nothing is added around it"
  );
}

console.log("floor plan rooms tests passed");
