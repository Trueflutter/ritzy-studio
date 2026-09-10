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

// The smallest share of the drawing a box may claim and still be a room. A
// model that answers with a point rather than a region would otherwise produce
// a crop of eighty pixels of paper, which the concept model would then be told
// is the room, and an outline the shopper sees as a dot.
export const DETECTED_ROOM_BOX_MIN_EDGE = 0.02;

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

// How much of the room's own width and height a crop adds around it, so it
// arrives with its own walls rather than cut through them.
export const PLAN_CROP_MARGIN_RATIO = 0.06;

export type DetectedRoomBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type DetectedRoom = {
  label: string;
  wallLengthCm: number | null;
  roomDepthCm: number | null;
  ceilingHeightCm: number | null;
  box: DetectedRoomBox | null;
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

function boundedBox(value: unknown): DetectedRoomBox | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const { x0, y0, x1, y1 } = value as Record<string, unknown>;
  const coordinates = [x0, y0, x1, y1];
  if (!coordinates.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))) {
    return null;
  }
  const box = { x0, y0, x1, y1 } as DetectedRoomBox;
  const inside = coordinates.every((coordinate) => (coordinate as number) >= 0 && (coordinate as number) <= 1);
  const spans =
    box.x1 - box.x0 >= DETECTED_ROOM_BOX_MIN_EDGE && box.y1 - box.y0 >= DETECTED_ROOM_BOX_MIN_EDGE;
  return inside && spans ? box : null;
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
      box: boundedBox(row.box),
      level: boundedLabel(row.level)
    });
  }

  // The rooms she can act on come first, and only then is the list cut. Plans
  // name halls, landings, closets and cloakrooms without dimensioning them, so
  // cutting in the model's own order can drop her bedroom in favour of twelve
  // cupboards and leave the screen saying nothing was dimensioned (review
  // finding). Stable within each group, so the drawing's own order survives.
  const dimensioned = rooms.filter((room) => room.wallLengthCm !== null && room.roomDepthCm !== null);
  const rest = rooms.filter((room) => room.wallLengthCm === null || room.roomDepthCm === null);
  return [...dimensioned, ...rest].slice(0, DETECTED_ROOMS_MAX);
}

// Confirming writes the row, so a room the plan gives no dimensions for has
// nothing to write. It is still rendered, saying so, which is why this is a
// split and not a filter: a plan whose rooms are all unconfirmable must not
// look like a plan with no rooms in it.
export function confirmableRooms(rooms: readonly DetectedRoom[]): DetectedRoom[] {
  return rooms.filter((room) => room.wallLengthCm !== null && room.roomDepthCm !== null);
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
  const metres = (cm: number) => (cm / 100).toFixed(1);
  return `${metres(wallLengthCm)} by ${metres(roomDepthCm)} m`;
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

export function cropRectangleFor({
  box,
  widthPx,
  heightPx,
  marginRatio = PLAN_CROP_MARGIN_RATIO
}: {
  box: DetectedRoomBox | null;
  widthPx: number;
  heightPx: number;
  marginRatio?: number;
}): { left: number; top: number; width: number; height: number } | null {
  if (!box || widthPx <= 0 || heightPx <= 0) {
    return null;
  }

  // The margin is a fraction of the ROOM, not of the sheet. Taken off the
  // sheet it scales with the drawing instead of the room, so on a whole-home
  // plan a bedroom would arrive as a third of its own crop and the concept
  // model would be told two thirds of the neighbours were hers (review
  // finding).
  const marginX = marginRatio * (box.x1 - box.x0);
  const marginY = marginRatio * (box.y1 - box.y0);

  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
  const left = clamp(Math.round((box.x0 - marginX) * widthPx), widthPx);
  const top = clamp(Math.round((box.y0 - marginY) * heightPx), heightPx);
  const right = clamp(Math.round((box.x1 + marginX) * widthPx), widthPx);
  const bottom = clamp(Math.round((box.y1 + marginY) * heightPx), heightPx);

  const width = right - left;
  const height = bottom - top;
  return width >= 1 && height >= 1 ? { left, top, width, height } : null;
}
