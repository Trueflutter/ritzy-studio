import {
  BRIEF_FIELD_BOUNDS,
  type BriefFieldName,
  type NumberBriefFieldName,
  type TextBriefFieldName
} from "@ritzy-studio/domain";

// CRLF to LF, before anything counts characters. The browser's maxLength
// counts a newline as one code unit and form encoding sends it as two, so a
// shopper who pastes a bounded answer with paragraph breaks is truncated to a
// legal length in the field and then refused by the schema for a limit she is
// already under. Exported and tested here rather than left inline in the
// action, where nothing could reach it (tests review).
export function normaliseSubmittedText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

// The two decisions the brief's details form was getting wrong (S5).
//
// They live here rather than as conditions inside a 439-line async server
// component because both were one-line mistakes that no test could reach:
// the colour field's condition asked the wrong question, and nothing carried
// the schema's bounds into the markup at all.

// What the browser should enforce, taken from what the server enforces, so a
// shopper is stopped where she types instead of after she submits.
export function briefTextAttributes(field: TextBriefFieldName): { maxLength: number } {
  const bound = BRIEF_FIELD_BOUNDS[field];
  return { maxLength: bound.max };
}

export function briefNumberAttributes(field: NumberBriefFieldName): { min: number; max: number } {
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

export function measurementsChanged({
  step,
  submitted,
  existing
}: {
  // The brief step that was submitted. Only the details step carries the
  // measurement inputs, so only it can express a change; taking the step as an
  // argument keeps that rule inside the tested function rather than leaving it
  // as a conjunct in the action that a later edit can drop (tests review).
  step: string;
  submitted: SubmittedMeasurements;
  existing: StoredMeasurements;
}): boolean {
  if (step !== "details") {
    return false;
  }

  const next = {
    wall: submitted.wallLengthCm ?? null,
    depth: submitted.roomDepthCm ?? null,
    ceiling: submitted.ceilingHeightCm ?? null
  };
  const empty = next.wall === null && next.depth === null && next.ceiling === null;

  if (!existing) {
    // Nothing on record: write only when something was actually given, so a
    // room whose owner never measures does not collect empty rows.
    return !empty;
  }

  // `notes` is deliberately not compared: the details form renders no field
  // for it, so every submission would read as a change against a row that has
  // one, and each visit would insert a fresh row with a null note, deleting
  // whatever S5b's floor-plan pass had written there (tests review).
  return (
    next.wall !== existing.wall_length_cm ||
    next.depth !== existing.room_depth_cm ||
    next.ceiling !== existing.ceiling_height_cm
  );
}

// The shopper's own style note, recovered from the stored value (S5).
//
// The style step round-trips `design_briefs.style_notes` through a hidden
// textarea, and the action re-wraps whatever comes back with a fresh
// "Selected visual styles: ..." line and a trailing "Avoid styles: ..." line.
// Composing from the composed value means the column grows by roughly eighty
// characters on every save, and once it passes the schema's 2000-character
// bound the style step can never be submitted again. Stripping the lines this
// app wrote makes the composition idempotent, and repairs an already-grown
// value the next time that room is saved.
// The exact prefixes this app writes into `style_notes`. Exported because
// three files have to agree on them: the action that composes the value, the
// selector that pre-fills it in the browser, and the reader below that strips
// them out again. Reword one in isolation and the growth bug returns silently,
// which is why `composeStyleNote` and `shopperStyleNote` are a pair and the
// test asserts they round-trip rather than matching a pasted literal.
export const SELECTED_STYLES_PREFIX = "Selected visual styles:";
export const AVOIDED_STYLES_PREFIX = "Avoid styles:";

export function composeStyleNote({
  selectedSummary,
  shopperNote,
  avoidedSummary,
  maxChars
}: {
  selectedSummary: string | null;
  shopperNote: string | null | undefined;
  avoidedSummary: string | null;
  // The column's bound. The composed value is mostly this app's own text, so
  // it has to fit whether or not the shopper wrote anything; her words are
  // what gets trimmed, because the style summaries are what the design reads.
  maxChars?: number;
}): string {
  const machineLines = [
    selectedSummary ? `${SELECTED_STYLES_PREFIX} ${selectedSummary}` : null,
    avoidedSummary ? `${AVOIDED_STYLES_PREFIX} ${avoidedSummary}.` : null
  ].filter((line): line is string => line !== null);

  let note = shopperStyleNote(shopperNote);
  if (maxChars !== undefined && note !== undefined) {
    const room = maxChars - machineLines.join("\n\n").length - machineLines.length * 2;
    note = room <= 0 ? undefined : note.length <= room ? note : note.slice(0, room).trimEnd();
  }

  const composed = [
    selectedSummary ? `${SELECTED_STYLES_PREFIX} ${selectedSummary}` : null,
    note ?? null,
    avoidedSummary ? `${AVOIDED_STYLES_PREFIX} ${avoidedSummary}.` : null
  ]
    .filter(Boolean)
    .join("\n\n");

  return maxChars !== undefined && composed.length > maxChars ? composed.slice(0, maxChars).trimEnd() : composed;
}

export function shopperStyleNote(stored: string | null | undefined): string | undefined {
  const blocks = (stored ?? "")
    .split(/(?:\r?\n){2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  // Stripped only WHERE this app writes its own blocks, not wherever those
  // words appear. `composeStyleNote` puts the selected summary first and the
  // avoided summary last with the shopper's note between them, so walking in
  // from the two edges recovers her note exactly and leaves anything she wrote
  // in the middle alone, even when it opens with the same words (review
  // finding: matching the prefix anywhere deleted a paragraph of hers that
  // happened to start "Avoid styles: ...").
  //
  // Greedy at each edge rather than one block a side because the pre-S5
  // composition wrapped its own output on every save, leaving a RUN of these
  // blocks at each end; a single-block rule would strip one layer per save and
  // never clear the value it is there to repair.
  //
  // Deliberately not narrowed further by matching the style names the summary
  // carries: that would stop recognising this app's own text the day a style
  // is renamed, and an unrecognised block is then kept, re-wrapped, and the
  // growth-to-lockout bug this pair exists to stop comes back silently.
  let first = 0;
  let end = blocks.length;
  while (first < end && blocks[first].startsWith(SELECTED_STYLES_PREFIX)) {
    first += 1;
  }
  while (end > first && blocks[end - 1].startsWith(AVOIDED_STYLES_PREFIX)) {
    end -= 1;
  }

  const kept = blocks.slice(first, end).join("\n\n");
  return kept.length > 0 ? kept : undefined;
}

// What a refused submission costs, and what it must not (S5, review finding).
//
// The first version of this refused the WHOLE submission: it redirected before
// the Supabase client was created, so a shopper who fixed her colour note and
// pasted an over-long functional answer in the same visit lost both. That is
// the same loss this slice exists to remove, one layer further in, and the
// copy on the screen claimed otherwise.
//
// So a refusal is now per field. The fields the schema would not take keep the
// value already on record; everything else in the submission is saved, and the
// screen names what was refused.

export function isBriefFieldName(value: unknown): value is BriefFieldName {
  // hasOwnProperty, not `in`: `in` walks the prototype chain, so `constructor`
  // and `__proto__` would pass an allowlist this file calls closed (security
  // review).
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(BRIEF_FIELD_BOUNDS, value);
}

export type BriefRefusal = {
  // The bounded fields the schema refused, in the order it reported them.
  refused: BriefFieldName[];
  // Whether the rest of the submission can still be saved. False when
  // something that is not a bounded field failed, a room id that is not a uuid
  // for instance: there is then no "rest" worth writing and nothing the
  // shopper could shorten to fix it.
  recoverable: boolean;
};

export function briefRefusal(issues: readonly { readonly path?: readonly PropertyKey[] }[]): BriefRefusal {
  const refused: BriefFieldName[] = [];
  let recoverable = issues.length > 0;

  for (const issue of issues) {
    const field = issue.path?.[0];
    if (isBriefFieldName(field)) {
      if (!refused.includes(field)) {
        refused.push(field);
      }
      continue;
    }
    recoverable = false;
  }

  return { refused, recoverable };
}

// The submission again with the refused fields removed, so re-parsing it
// yields exactly what the shopper sent minus what could not be taken. The
// caller must then leave the stored value alone for those fields: an
// `undefined` here means "not submitted", and the write path turns a submitted
// empty into a deletion.
export function withoutRefusedFields<T extends Record<string, unknown>>(
  submission: T,
  refused: readonly BriefFieldName[]
): T {
  const repaired: Record<string, unknown> = { ...submission };
  for (const field of refused) {
    repaired[field] = undefined;
  }
  return repaired as T;
}

// The three measurements as they should be written once a refusal is known.
//
// A number the schema would not take keeps whatever is on record, so the ones
// she did fix still land and the refused one is not read as a deletion. Inline
// in the action this was a conditional per field that no test could reach,
// which is how the last swallowed clearing decision got in (tests review).
export function measurementsAfterRefusal({
  submitted,
  existing,
  refused
}: {
  submitted: SubmittedMeasurements;
  existing: StoredMeasurements;
  refused: readonly BriefFieldName[];
}): { wallLengthCm: number | null; roomDepthCm: number | null; ceilingHeightCm: number | null } {
  return {
    wallLengthCm: refused.includes("wallLengthCm")
      ? (existing?.wall_length_cm ?? null)
      : (submitted.wallLengthCm ?? null),
    roomDepthCm: refused.includes("roomDepthCm")
      ? (existing?.room_depth_cm ?? null)
      : (submitted.roomDepthCm ?? null),
    ceilingHeightCm: refused.includes("ceilingHeightCm")
      ? (existing?.ceiling_height_cm ?? null)
      : (submitted.ceilingHeightCm ?? null)
  };
}
