// The brief's field bounds, in one place, because the browser and the server
// must enforce the same numbers. The form renders these as `maxLength` and
// `max` so a shopper is stopped before she submits something the schema would
// refuse; the schema below is built from the same table so the two cannot
// drift apart. `brief-field-bounds.test.ts` proves the agreement by exercising
// the schema at each bound rather than trusting the wiring.
export const BRIEF_FIELD_BOUNDS = {
  styleNotes: { kind: "text", max: 2000 },
  colorNotes: { kind: "text", max: 1200 },
  budgetNotes: { kind: "text", max: 1200 },
  functionalRequirements: { kind: "text", max: 2000 },
  avoidNotes: { kind: "text", max: 1200 },
  inspirationNotes: { kind: "text", max: 1600 },
  measurementNotes: { kind: "text", max: 1200 },
  // Free text on the same form, written verbatim into structured_json.
  // parseSpatialIntent bounds it on READ, which protects the prompt budget but
  // not the column: an unbounded post is re-read by every select on the row
  // for the life of the room (security review).
  mustKeepClear: { kind: "text", max: 160 },
  wallLengthCm: { kind: "number", min: 1, max: 5000 },
  roomDepthCm: { kind: "number", min: 1, max: 5000 },
  ceilingHeightCm: { kind: "number", min: 1, max: 1000 }
} as const satisfies Record<string, { kind: "text"; max: number } | { kind: "number"; min: number; max: number }>;

export type BriefFieldName = keyof typeof BRIEF_FIELD_BOUNDS;

// Split by kind, so a text bound cannot be applied to a measurement field.
// The obvious spelling, Extract<BriefFieldName, keyof typeof BRIEF_FIELD_BOUNDS>,
// is Extract<T, T> and narrows nothing (review finding).
export type TextBriefFieldName = {
  [K in BriefFieldName]: (typeof BRIEF_FIELD_BOUNDS)[K]["kind"] extends "text" ? K : never;
}[BriefFieldName];

export type NumberBriefFieldName = {
  [K in BriefFieldName]: (typeof BRIEF_FIELD_BOUNDS)[K]["kind"] extends "number" ? K : never;
}[BriefFieldName];
