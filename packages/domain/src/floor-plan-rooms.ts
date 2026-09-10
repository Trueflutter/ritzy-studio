import { BRIEF_FIELD_BOUNDS } from "./brief-field-bounds";

// What a floor plan is allowed to tell this app (S5b).
//
// Everything here is a refusal to guess. Confirming a detected room writes a
// `room_measurements` row at `confidence = 'verified'`, and that value is what
// `measurementCanSupportProductFit` requires before the design will size
// furniture and check clearances against a dimension. So a number that reaches
// the screen is a number a room gets furnished by: a model's answer is bounded
// to what the brief's own schema would store, and anything outside it is
// dropped rather than clamped, because a clamped 50 m wall looks exactly like a
// read one.

// A display bound, not a safety one: the answer schema allows forty. What
// matters more than the number is the ORDER it cuts in, below.
export const DETECTED_ROOMS_MAX = 24;

// What a room in a home can plausibly measure, which is not the same question
// as what a person may type into the form. The form's ceiling is 5000 cm
// because someone measuring a long villa wall should not be argued with; a
// model converting a metric plan drawn in millimetres returns 3200 for a 3.2 m
// bedroom, and 3200 sits comfortably inside that. So a read is held to a
// tighter ceiling of its own (review finding). The largest room on the listing
// fixture is 927 cm, so 1500 leaves room for a majlis and still catches the
// unconverted case for every room over 15 m.
//
// It does not catch everything: a 1.2 m cloakroom read as 1200 mm lands inside
// the plausible range. The defences left for that are the chip, which shows
// metres to the person clicking it, and criterion 9, which measures a read
// against a drawing whose figures are known.
export const DETECTED_ROOM_MAX_CM = 1500;
export const DETECTED_ROOM_LABEL_MAX = 40;

// The longest edge a plan needs before a read is worth paying for.
//
// Both fixtures are real, and between them they bracket this number. The
// listing thumbnail is 390 by 578 for a three-level house, which leaves each
// room about sixty pixels wide and its dimension strings about four pixels
// tall: nothing can be read off it, and a guess written as `verified` is the
// worst thing this feature can produce. The Emaar marketing plan is 1067 by
// 550 for one apartment, which leaves its room labels legible, and that is
// what a Dubai developer actually publishes. A floor set above 1067 would
// refuse the real case it was built for, which is how this number came down
// from a first guess of 1200.
//
// It is a proxy: what matters is pixels per room, not pixels per sheet, and
// this cannot know how much building is on the page. The evidence run reads
// the synthetic plan at descending widths to find where the answer stops
// matching the drawing, and this number is set from that.
export const PLAN_READABLE_MIN_EDGE_PX = 800;

// There is no box here, and that is a measured decision rather than an
// omission. A first version asked the model to locate each room so the drawing
// could be cropped to it before the concept prompts saw it. The boxes came
// back plausible and wrong: on the Emaar fixture the outline for the living
// room enclosed the balcony and ran outside the exterior wall, and a crop like
// that grounds a paid concept on a room the shopper never picked. The names
// and the dimensions are what this read is good at, so the room's NAME is what
// travels to the prompt instead (design review).

export type DetectedRoom = {
  label: string;
  wallLengthCm: number | null;
  roomDepthCm: number | null;
  ceilingHeightCm: number | null;
  // Which floor of the drawing this room sits on, when the drawing says. A
  // whole-home plan can carry three levels and the label "Bedroom" three
  // times, so without this she would be asked to pick between identical chips.
  level: string | null;
};

function boundedNumber(value: unknown, field: "wallLengthCm" | "roomDepthCm" | "ceilingHeightCm"): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const bound = BRIEF_FIELD_BOUNDS[field];
  const max = field === "ceilingHeightCm" ? bound.max : Math.min(bound.max, DETECTED_ROOM_MAX_CM);
  return value >= bound.min && value <= max ? value : null;
}

function boundedLabel(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const label = value.trim().slice(0, DETECTED_ROOM_LABEL_MAX);
  return label.length > 0 ? label : null;
}

export function boundedDetectedRooms(value: unknown): DetectedRoom[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rooms: DetectedRoom[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const row = entry as Record<string, unknown>;
    const label = boundedLabel(row.label);
    if (label === null) {
      continue;
    }
    rooms.push({
      label,
      wallLengthCm: boundedNumber(row.wallLengthCm, "wallLengthCm"),
      roomDepthCm: boundedNumber(row.roomDepthCm, "roomDepthCm"),
      ceilingHeightCm: boundedNumber(row.ceilingHeightCm, "ceilingHeightCm"),
      level: boundedLabel(row.level)
    });
  }

  // The rooms she can act on come first, and only then is the list cut. Plans
  // name halls, landings, closets and cloakrooms without dimensioning them, so
  // cutting in the model's own order can drop her bedroom in favour of twelve
  // cupboards and leave the screen saying nothing was dimensioned (review
  // finding). Stable within each group, so the drawing's own order survives.
  return [...rooms]
    .sort((left, right) => Number(roomIsDimensioned(right)) - Number(roomIsDimensioned(left)))
    .slice(0, DETECTED_ROOMS_MAX);
}

// Whether the plan printed a size for this room, which is the one thing that
// decides whether confirming it can fill the measurement fields. Exported
// because the service writes the row and the screen draws the control, and two
// spellings of "measured" in two packages drift apart (review finding).
export function roomIsDimensioned(room: DetectedRoom): boolean {
  return room.wallLengthCm !== null && room.roomDepthCm !== null;
}

export function roomDimensionsLabel({
  wallLengthCm,
  roomDepthCm
}: {
  wallLengthCm: number | null;
  roomDepthCm: number | null;
}): string | null {
  if (wallLengthCm === null || roomDepthCm === null) {
    return null;
  }
  // Named rather than listed. The read reports the longer edge as the wall and
  // the shorter as the depth, while a drawing prints its own order, so
  // "3.2 by 2.4 m" under a plan printing "2.4m x 3.2m" reads as a
  // transcription error rather than as the two fields above it (design
  // review).
  const metres = (cm: number) => (cm / 100).toFixed(1);
  return `${metres(wallLengthCm)} m wall, ${metres(roomDepthCm)} m deep, from your plan`;
}

export function detectedRoomLabel({ label, level }: { label: string; level: string | null }): string {
  const floor = level?.trim();
  return floor ? `${label}, ${floor}` : label;
}

export type FloorPlanAsset = {
  id: string;
  mimeType: string | null;
  widthPx: number | null;
  heightPx: number | null;
};

export type FloorPlanReadJob = {
  assetId: string | null;
  status: string;
};

export type FloorPlanReadAction =
  | "read"
  | "no_plan"
  | "unreadable_format"
  | "too_small"
  | "in_flight"
  | "already_read";

// Whether this plan is worth a call, and whether it has already had one.
//
// Every refusal here is money not spent and, more importantly, a number not
// invented. The screen renders each of these as its own sentence, so a shopper
// is never left with a plan attached and nothing said about it.
export function floorPlanReadDecision({
  asset,
  newestJob
}: {
  asset: FloorPlanAsset | null;
  newestJob: FloorPlanReadJob | null;
}): { action: FloorPlanReadAction } {
  if (!asset) {
    return { action: "no_plan" };
  }

  if (!asset.mimeType?.startsWith("image/")) {
    return { action: "unreadable_format" };
  }

  // An unknown size is read rather than refused: the browser cannot measure
  // every format, and refusing on a missing measurement would turn it into a
  // missing feature.
  const longestEdge = Math.max(asset.widthPx ?? 0, asset.heightPx ?? 0);
  if (longestEdge > 0 && longestEdge < PLAN_READABLE_MIN_EDGE_PX) {
    return { action: "too_small" };
  }

  if (newestJob?.assetId === asset.id) {
    if (newestJob.status === "running") {
      return { action: "in_flight" };
    }
    if (newestJob.status === "succeeded") {
      return { action: "already_read" };
    }
  }

  return { action: "read" };
}

// What the brief records once she has confirmed a room, and the one question
// every reader of it has to ask.
//
// The record names the plan it belongs to. A plan can be replaced, and the
// room she picked off the old drawing says nothing about the new one, so every
// reader checks the asset id before trusting it.
export type ConfirmedFloorPlanRoom = {
  assetId: string;
  label: string;
  // Which room in the read's own list, because a label is not an identity: a
  // whole-home plan carries "Bedroom" three times, once per floor, which is
  // why `level` exists at all. Matching by label alone marks all three as
  // confirmed and tells a screen reader three controls are pressed (review
  // finding).
  index: number;
};

export function confirmedFloorPlanRoom(value: unknown): ConfirmedFloorPlanRoom | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  const assetId = typeof row.assetId === "string" && row.assetId.length > 0 ? row.assetId : null;
  const label = boundedLabel(row.label);
  const index = typeof row.index === "number" && Number.isInteger(row.index) && row.index >= 0 ? row.index : null;
  if (!assetId || label === null || index === null) {
    return null;
  }
  return { assetId, label, index };
}

// What the screen says about the plan attached to this room.
//
// Every one of these is a sentence a shopper reads, and the set is closed on
// purpose: a plan attached with nothing said about it is the state S5a spent
// its life removing. The read's own job row carries the state, so this is a
// pure function of what is attached and what the newest read did with it.
export type FloorPlanScreenState =
  | "no_plan"
  | "pdf"
  | "too_small"
  | "reading"
  | "read_failed"
  | "no_rooms"
  | "rooms";

export function floorPlanScreenState({
  asset,
  newestJob,
  roomCount
}: {
  asset: FloorPlanAsset | null;
  newestJob: FloorPlanReadJob | null;
  roomCount: number;
}): FloorPlanScreenState {
  const { action } = floorPlanReadDecision({ asset, newestJob });

  if (action === "no_plan") {
    return "no_plan";
  }
  if (action === "unreadable_format") {
    return "pdf";
  }
  if (action === "too_small") {
    return "too_small";
  }
  if (action === "in_flight") {
    return "reading";
  }
  if (action === "already_read") {
    return roomCount > 0 ? "rooms" : "no_rooms";
  }

  // The decision says this plan is worth reading, which means no succeeded or
  // running job names it. Either the read failed, or the upload's call has not
  // opened its row yet; both are "we are on it" from the screen's side, and the
  // failed one carries a retry.
  return newestJob?.status === "failed" && newestJob.assetId === asset?.id ? "read_failed" : "reading";
}
