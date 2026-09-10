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

export const DETECTED_ROOMS_MAX = 12;
export const DETECTED_ROOM_LABEL_MAX = 40;

// The smallest share of the drawing a box may claim and still be a room. A
// model that answers with a point rather than a region would otherwise produce
// a crop of eighty pixels of paper, which the concept model would then be told
// is the room, and an outline the shopper sees as a dot.
export const DETECTED_ROOM_BOX_MIN_EDGE = 0.02;

// The longest edge a plan needs before a read is worth paying for. The real
// listing plan in `scripts/dev-harness/fixtures` is 390 by 578, which puts its
// dimension strings at about four pixels tall; the number below is set by the
// evidence run, which reads the synthetic fixture at descending widths and
// finds where the answer stops matching the drawing.
export const PLAN_READABLE_MIN_EDGE_PX = 1200;

// How much of the surrounding drawing a crop keeps, so the room arrives with
// its own walls rather than cut through them.
export const PLAN_CROP_MARGIN_RATIO = 0.04;

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
  return value >= bound.min && value <= bound.max ? value : null;
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
    if (rooms.length >= DETECTED_ROOMS_MAX) {
      break;
    }
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
  return rooms;
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

  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
  const left = clamp(Math.round((box.x0 - marginRatio) * widthPx), widthPx);
  const top = clamp(Math.round((box.y0 - marginRatio) * heightPx), heightPx);
  const right = clamp(Math.round((box.x1 + marginRatio) * widthPx), widthPx);
  const bottom = clamp(Math.round((box.y1 + marginRatio) * heightPx), heightPx);

  const width = right - left;
  const height = bottom - top;
  return width >= 1 && height >= 1 ? { left, top, width, height } : null;
}
