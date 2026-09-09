import { BRIEF_FIELD_BOUNDS, type BriefFieldName } from "@ritzy-studio/domain";

// The two decisions the brief's details form was getting wrong (S5).
//
// They live here rather than as conditions inside a 439-line async server
// component because both were one-line mistakes that no test could reach:
// the colour field's condition asked the wrong question, and nothing carried
// the schema's bounds into the markup at all.

type TextField = {
  [K in BriefFieldName]: (typeof BRIEF_FIELD_BOUNDS)[K]["kind"] extends "text" ? K : never;
}[BriefFieldName];

type NumberField = {
  [K in BriefFieldName]: (typeof BRIEF_FIELD_BOUNDS)[K]["kind"] extends "number" ? K : never;
}[BriefFieldName];

// What the browser should enforce, taken from what the server enforces, so a
// shopper is stopped where she types instead of after she submits.
export function briefTextAttributes(field: TextField): { maxLength: number } {
  const bound = BRIEF_FIELD_BOUNDS[field];
  return { maxLength: bound.max };
}

export function briefNumberAttributes(field: NumberField): { min: number; max: number } {
  const bound = BRIEF_FIELD_BOUNDS[field];
  return { min: bound.min, max: bound.max };
}

// The colour and materials field. What a shopper saved always wins; the
// palette read from her inspiration images fills in only when she has saved
// nothing.
//
// The value is a DEFAULT in both cases and never a placeholder. A placeholder
// is not submitted, so offering the palette that way would quietly stop it
// reaching the concept prompt and the sourcing pass for every room whose owner
// accepted the suggestion by leaving it alone.
export function colourNotesDefault(
  saved: string | null | undefined,
  palette: string | null | undefined
): { value: string; fromPalette: boolean } {
  const savedNote = (saved ?? "").trim();
  if (savedNote.length > 0) {
    return { value: savedNote, fromPalette: false };
  }

  const suggestion = (palette ?? "").trim();
  return suggestion.length > 0 ? { value: suggestion, fromPalette: true } : { value: "", fromPalette: false };
}

// Whether the details step should write a measurement row (S5).
//
// Measurements used to be mandatory, so "the shopper cleared one" could not
// happen and the old rule, write a row when any value was submitted, was
// enough. With the fields optional, clearing is a real intent that has to
// reach the database: the details page reads the newest row, so a value that
// is not overwritten comes back for ever and cannot be removed.
//
// This runs ONLY for the details step. On the style and inspiration steps the
// measurement inputs are not in the form at all, so every value arrives
// undefined, and treating that as "cleared" would wipe a room's measurements
// the moment its owner edited her style notes.
export type SubmittedMeasurements = {
  wallLengthCm?: number | null;
  roomDepthCm?: number | null;
  ceilingHeightCm?: number | null;
  notes?: string | null;
};

export type StoredMeasurements = {
  wall_length_cm: number | null;
  room_depth_cm: number | null;
  ceiling_height_cm: number | null;
  notes: string | null;
} | null;

export function measurementsChanged(submitted: SubmittedMeasurements, existing: StoredMeasurements): boolean {
  const next = {
    wall: submitted.wallLengthCm ?? null,
    depth: submitted.roomDepthCm ?? null,
    ceiling: submitted.ceilingHeightCm ?? null,
    notes: submitted.notes ?? null
  };
  const empty = next.wall === null && next.depth === null && next.ceiling === null && next.notes === null;

  if (!existing) {
    // Nothing on record: write only when something was actually given, so a
    // room whose owner never measures does not collect empty rows.
    return !empty;
  }

  return (
    next.wall !== existing.wall_length_cm ||
    next.depth !== existing.room_depth_cm ||
    next.ceiling !== existing.ceiling_height_cm ||
    next.notes !== existing.notes
  );
}
