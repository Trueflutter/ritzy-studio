import assert from "node:assert/strict";

import { BRIEF_FIELD_BOUNDS } from "./index";
import {
  DETECTED_ROOM_LABEL_MAX,
  DETECTED_ROOM_MAX_CM,
  DETECTED_ROOMS_MAX,
  FLOOR_PLAN_SCREEN_STATES,
  PDF_MIME_TYPE,
  PLAN_READABLE_MIN_EDGE_PX,
  UNKNOWN_BYTES_MIME_TYPE,
  boundedDetectedRooms,
  confirmedFloorPlanRoom,
  detectedRoomLabel,
  FLOOR_PLAN_READ_STALE_MS,
  floorPlanReadDecision,
  floorPlanRefused,
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
  assert.equal(roomDimensionsLabel({ wallLengthCm: 520, roomDepthCm: 410 }), "5.2 m wall, 4.1 m deep, from your plan");
  assert.equal(roomDimensionsLabel({ wallLengthCm: 884, roomDepthCm: 470 }), "8.8 m wall, 4.7 m deep, from your plan");
  assert.equal(
    roomDimensionsLabel({ wallLengthCm: 500, roomDepthCm: 400 }),
    "5.0 m wall, 4.0 m deep, from your plan",
    "a trailing zero is kept"
  );
  // The two values are NAMED. The read reports the longer edge as the wall,
  // and a drawing prints its own order, so a bare "3.2 by 2.4 m" under a plan
  // printing "2.4m x 3.2m" reads as a transcription error (design review).
  assert.match(roomDimensionsLabel({ wallLengthCm: 320, roomDepthCm: 240 }) ?? "", /3\.2 m wall, 2\.4 m deep/);
  assert.match(roomDimensionsLabel({ wallLengthCm: 320, roomDepthCm: 240 }) ?? "", /from your plan/, "and say where they came from");
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
    floorPlanReadDecision({ asset: readable, newestJob: { assetId: attached, status: "succeeded", startedAt: null } }).action,
    "already_read"
  );
  assert.equal(
    floorPlanReadDecision({ asset: readable, newestJob: { assetId: attached, status: "running", startedAt: null } }).action,
    "in_flight"
  );

  // A failed read is retryable, which is what the screen's retry calls.
  assert.equal(
    floorPlanReadDecision({ asset: readable, newestJob: { assetId: attached, status: "failed", startedAt: null } }).action,
    "read"
  );

  // A job for the plan she replaced says nothing about the plan she attached.
  assert.equal(
    floorPlanReadDecision({ asset: readable, newestJob: { assetId: "asset-a", status: "succeeded", startedAt: null } }).action,
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

// --------------------------------------- a read that never came back (codex)
{
  const plan = { id: "plan-a", mimeType: "image/png", widthPx: 2400, heightPx: 1600 };
  const now = Date.parse("2026-09-10T12:00:00Z");
  const running = (startedAt: string | null) => ({ assetId: "plan-a", status: "running", startedAt });

  // A row opened moments ago is a read in flight, and the screen waits.
  assert.equal(
    floorPlanReadDecision({ asset: plan, newestJob: running("2026-09-10T11:59:30Z"), now }).action,
    "in_flight"
  );
  assert.equal(floorPlanScreenState({ asset: plan, newestJob: running("2026-09-10T11:59:30Z"), roomCount: 0, now }), "reading");

  // A row that outlived the 90 second call it was opened for did not finish:
  // the function was killed mid-call, or both attempts to close it failed and
  // `closeAiJob` returned rather than threw. Without this the screen says
  // "in a moment" for ever and the decision refuses a fresh read.
  const abandoned = running(new Date(now - FLOOR_PLAN_READ_STALE_MS - 1000).toISOString());
  assert.equal(floorPlanReadDecision({ asset: plan, newestJob: abandoned, now }).action, "read");
  assert.equal(floorPlanScreenState({ asset: plan, newestJob: abandoned, roomCount: 0, now }), "read_failed");

  // A row with no timestamp is believed rather than discarded: the cost of a
  // wrong guess here is a second paid call.
  assert.equal(floorPlanReadDecision({ asset: plan, newestJob: running(null), now }).action, "in_flight");
}

// ------------------------ no read is not a read in progress (PR review, P1)
{
  const plan = { id: "plan-a", mimeType: "image/png", widthPx: 2400, heightPx: 1600 };
  const now = Date.parse("2026-09-10T12:00:00Z");

  // A plan nothing has read. The upload's call can fail to arrive, or throw
  // before it opens a row, or refuse without writing anything down, and a
  // first version rendered every one of those as "reading", for ever, with
  // nothing to press.
  assert.equal(floorPlanScreenState({ asset: plan, newestJob: null, roomCount: 0, now }), "unread");
  assert.equal(
    floorPlanScreenState({
      asset: plan,
      newestJob: { assetId: "plan-before", status: "succeeded", startedAt: null },
      roomCount: 3,
      now
    }),
    "unread",
    "the newest read was of the plan she replaced, which says nothing about this one"
  );

  // So "reading" is said exactly when a read of THIS plan is running and young,
  // over every plan and every job this screen can be handed.
  const young = "2026-09-10T11:59:30Z";
  const abandoned = new Date(now - FLOOR_PLAN_READ_STALE_MS - 1000).toISOString();
  const plans = [
    { asset: plan, readable: true },
    { asset: { ...plan, widthPx: null, heightPx: null }, readable: true },
    { asset: { ...plan, widthPx: 500, heightPx: 320 }, readable: false },
    { asset: { ...plan, mimeType: PDF_MIME_TYPE }, readable: false },
    { asset: { ...plan, mimeType: UNKNOWN_BYTES_MIME_TYPE }, readable: false }
  ];
  const jobs = [
    { job: null, runningNow: false },
    ...["queued", "running", "succeeded", "failed", "cancelled"].flatMap((status) => [
      { job: { assetId: "plan-a", status, startedAt: young }, runningNow: status === "running" },
      { job: { assetId: "plan-a", status, startedAt: abandoned }, runningNow: false },
      { job: { assetId: "plan-before", status, startedAt: young }, runningNow: false }
    ])
  ];
  for (const { asset, readable } of plans) {
    for (const { job, runningNow } of jobs) {
      const state = floorPlanScreenState({ asset, newestJob: job, roomCount: 1, now });
      assert.equal(
        state === "reading",
        readable && runningNow,
        `${JSON.stringify(asset)} with ${JSON.stringify(job)} rendered ${state}`
      );
    }
  }

  // The refusal says which remedy applies. A PDF can be photographed; bytes
  // the read could not open, or a document dropped past the file picker, are
  // not told they are a PDF.
  assert.equal(floorPlanScreenState({ asset: { ...plan, mimeType: PDF_MIME_TYPE }, newestJob: null, roomCount: 0, now }), "pdf");
  assert.equal(
    floorPlanScreenState({ asset: { ...plan, mimeType: UNKNOWN_BYTES_MIME_TYPE }, newestJob: null, roomCount: 0, now }),
    "unreadable"
  );
  assert.equal(
    floorPlanScreenState({ asset: { ...plan, mimeType: "application/msword" }, newestJob: null, roomCount: 0, now }),
    "unreadable"
  );

  // The upload panel and the refusal beneath it agree on which states cannot
  // be used, from one definition.
  assert.deepEqual(FLOOR_PLAN_SCREEN_STATES.filter(floorPlanRefused), ["pdf", "unreadable", "too_small"]);
}

console.log("floor plan rooms tests passed");
