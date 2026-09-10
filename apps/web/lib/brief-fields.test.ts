import assert from "node:assert/strict";

import { BRIEF_FIELD_BOUNDS, designBriefSchema } from "@ritzy-studio/domain";

import {
  AVOIDED_STYLES_PREFIX,
  SELECTED_STYLES_PREFIX,
  briefNumberAttributes,
  briefRefusal,
  briefTextAttributes,
  colourNotesDefault,
  composeStyleNote,
  measurementsAfterRefusal,
  measurementsChanged,
  normaliseSubmittedText,
  shopperStyleNote,
  withoutRefusedFields
} from "./brief-fields";

// S5 (AC 4, AC 5): the two decisions the details form was getting wrong.
//
// The colour field rendered an empty box the moment a real value existed,
// because its condition asked whether the palette suggestion was showing
// rather than what the shopper had saved. And nothing stopped a shopper
// typing past a bound the server would then refuse, throwing her whole
// submission away.

// The colour field. A saved note always wins; the inspiration palette fills
// in only when there is nothing saved; and the value is a default in both
// cases, never a placeholder, because a placeholder is not submitted and the
// suggestion would silently stop reaching the design.
{
  const saved = colourNotesDefault("warm walnut, brushed brass", "sand, oak, cream");
  assert.equal(saved.value, "warm walnut, brushed brass");
  assert.equal(saved.fromPalette, false, "a saved note is not credited to the inspiration analysis");

  const suggested = colourNotesDefault("", "sand, oak, cream");
  assert.equal(suggested.value, "sand, oak, cream");
  assert.equal(suggested.fromPalette, true, "the palette is offered when nothing is saved");

  const empty = colourNotesDefault("", "");
  assert.equal(empty.value, "");
  assert.equal(empty.fromPalette, false);

  assert.equal(colourNotesDefault(null, null).value, "", "absent values read as empty, never as the string null");
  assert.equal(colourNotesDefault("   ", "sand").value, "sand", "whitespace is not a saved note");
  assert.equal(colourNotesDefault("   ", "sand").fromPalette, true);
}

// The input attributes come from the schema's own bounds, so the browser
// stops a shopper exactly where the server would have refused her.
{
  assert.equal(briefTextAttributes("colorNotes").maxLength, BRIEF_FIELD_BOUNDS.colorNotes.max);
  assert.equal(briefTextAttributes("functionalRequirements").maxLength, BRIEF_FIELD_BOUNDS.functionalRequirements.max);
  assert.equal(briefTextAttributes("avoidNotes").maxLength, BRIEF_FIELD_BOUNDS.avoidNotes.max);
  assert.equal(briefTextAttributes("inspirationNotes").maxLength, BRIEF_FIELD_BOUNDS.inspirationNotes.max);

  assert.deepEqual(briefNumberAttributes("wallLengthCm"), { min: 1, max: 5000 });
  assert.deepEqual(briefNumberAttributes("roomDepthCm"), { min: 1, max: 5000 });
  assert.deepEqual(briefNumberAttributes("ceilingHeightCm"), { min: 1, max: 1000 });

  // The numbers are read from the shared table, not restated here, so raising
  // a bound in the schema moves the form with it.
  for (const field of ["wallLengthCm", "roomDepthCm", "ceilingHeightCm"] as const) {
    const bound = BRIEF_FIELD_BOUNDS[field];
    assert.equal(bound.kind, "number");
    if (bound.kind === "number") {
      assert.deepEqual(briefNumberAttributes(field), { min: bound.min, max: bound.max });
    }
  }
}

// S5 (AC 2): a measurement can be cleared. The details page reads the newest
// row, so a value the shopper deleted has to be written as deleted or it
// comes back for ever.
{
  const stored = (wall: number | null, depth: number | null, ceiling: number | null, notes: string | null = null) => ({
    wall_length_cm: wall,
    room_depth_cm: depth,
    ceiling_height_cm: ceiling,
    notes
  });
  const onDetails = (submitted: Parameters<typeof measurementsChanged>[0]["submitted"], existing: Parameters<typeof measurementsChanged>[0]["existing"]) =>
    measurementsChanged({ step: "details", submitted, existing });

  // A room that never measured and submits nothing collects no empty rows.
  assert.equal(onDetails({}, null), false);
  assert.equal(onDetails({ wallLengthCm: 520 }, null), true, "the first measurement is written");

  // The clearing case the old mandatory gate made unreachable.
  assert.equal(onDetails({}, stored(520, 410, 300)), true, "emptying every field is a change that must be recorded");
  assert.equal(onDetails({ wallLengthCm: 520, roomDepthCm: 410 }, stored(520, 410, 300)), true, "clearing one field is a change");

  // An unchanged resubmission writes nothing, so pressing Continue twice does
  // not grow the table.
  assert.equal(onDetails({ wallLengthCm: 520, roomDepthCm: 410, ceilingHeightCm: 300 }, stored(520, 410, 300)), false);
  assert.equal(onDetails({}, stored(null, null, null)), false, "an empty row resubmitted empty is unchanged");

  // A changed value is a change.
  assert.equal(onDetails({ wallLengthCm: 521, roomDepthCm: 410, ceilingHeightCm: 300 }, stored(520, 410, 300)), true);

  // The other brief steps carry no measurement inputs, so they can never
  // clear a room's measurements however the submission looks. This is the
  // guard that used to live as a conjunct in the action.
  for (const step of ["style", "inspiration", "", "DETAILS"]) {
    assert.equal(
      measurementsChanged({ step, submitted: {}, existing: stored(520, 410, 300) }),
      false,
      `the ${step || "empty"} step cannot clear a measured room`
    );
  }

  // A note written by another source (S5b's floor-plan pass) is not a change
  // the details form can express, so it must not trigger a rewrite that would
  // drop it.
  assert.equal(
    onDetails({ wallLengthCm: 520, roomDepthCm: 410, ceilingHeightCm: 300 }, stored(520, 410, 300, "the alcove is 40 cm deep")),
    false,
    "a stored note does not make an unchanged submission look changed"
  );
}

// Review finding: the style step re-wraps its own output, so the stored note
// grew by about eighty characters on every save and eventually crossed the
// schema bound, after which the step could never be submitted again. Stripping
// the lines this app wrote makes composing idempotent.
{
  assert.equal(shopperStyleNote(null), undefined);
  assert.equal(shopperStyleNote("   "), undefined);
  assert.equal(shopperStyleNote("calm, not cold"), "calm, not cold");

  // Round-tripped through the real composer, not a pasted literal: rewording
  // the composed line without updating the reader is exactly how the growth
  // bug would come back, so the test has to exercise both halves together.
  const compose = (shopperNote: string | undefined) =>
    composeStyleNote({
      selectedSummary: "Quiet Luxury, Warm Minimal",
      shopperNote,
      avoidedSummary: "Industrial"
    });

  const composedOnce = compose("calm, not cold");
  assert.equal(shopperStyleNote(composedOnce), "calm, not cold", "the composed lines are not the shopper's words");

  // The growth this PR exists to stop: composing the composed value must not
  // add anything, however many times it happens.
  const composedTwice = compose(composedOnce);
  assert.equal(composedTwice, composedOnce, "composing twice is composing once");
  const composedFiveTimes = compose(compose(compose(composedTwice)));
  assert.equal(composedFiveTimes.length, composedOnce.length, "the value cannot grow by repetition");
  assert.equal(shopperStyleNote(composedFiveTimes), "calm, not cold");

  // A room where the shopper wrote nothing keeps nothing.
  assert.equal(shopperStyleNote(compose(undefined)), undefined);
}

// Tests review, mutation-verified: removing the CRLF replacement left every
// suite green, because the only assertions were facts about String.length.
// The normalisation is asserted here, on the function that performs it.
{
  const bound = BRIEF_FIELD_BOUNDS.colorNotes.max;
  // What a browser sends for a value the field accepted at exactly its bound:
  // maxLength counted six newlines as six, the encoder sends twelve.
  // Newlines in the MIDDLE: trailing ones are trimmed, which is correct and
  // would hide what this is measuring.
  const paragraphed = "x".repeat(100) + "\n".repeat(6) + "x".repeat(bound - 106);
  assert.equal(paragraphed.length, bound);
  const encoded = paragraphed.replace(/\n/g, "\r\n");
  assert.equal(encoded.length, bound + 6, "the wire form is over the bound");
  assert.equal(
    normaliseSubmittedText(encoded).length,
    bound,
    "normalising brings it back to the length the field counted"
  );
  assert.equal(normaliseSubmittedText("  spaced  "), "spaced", "and it still trims");
  assert.equal(normaliseSubmittedText("a\r\nb"), "a\nb");
  assert.equal(normaliseSubmittedText(""), "");
}

// Review finding: a refusal used to discard the WHOLE submission. A shopper
// who fixed her colour note and pasted an over-long functional answer in the
// same visit lost both, while the message told her everything else had been
// kept. Exercised against the real schema, because the repair is only correct
// if it produces exactly what the schema would have taken.
{
  const submission = {
    projectId: "6133dc43-b169-4fe9-8b05-5796e105543a",
    roomId: "f4fba429-63e0-45cf-b7c6-eefc81657b55",
    roomType: "Living Room",
    styleSlugs: [],
    avoidStyleSlugs: [],
    colorNotes: "warm walnut, brushed brass",
    functionalRequirements: "x".repeat(BRIEF_FIELD_BOUNDS.functionalRequirements.max + 1)
  };

  const first = designBriefSchema.safeParse(submission);
  assert.equal(first.success, false, "the over-long answer is refused");
  const refusal = briefRefusal(first.success ? [] : first.error.issues);
  assert.deepEqual(refusal.refused, ["functionalRequirements"]);
  assert.equal(refusal.recoverable, true, "a bounded answer is something the rest of the write can survive");

  const second = designBriefSchema.safeParse(withoutRefusedFields(submission, refusal.refused));
  assert.equal(second.success, true, "what is left parses");
  assert.equal(
    second.success && second.data.colorNotes,
    "warm walnut, brushed brass",
    "the valid sibling is NOT discarded with the refused one"
  );
  assert.equal(
    second.success && second.data.functionalRequirements,
    undefined,
    "and the refused field arrives as not-submitted, so the action leaves the stored answer alone"
  );

  // Two at once are both named, because naming one and silently keeping the
  // other is the same silent refusal in a smaller form.
  const both = designBriefSchema.safeParse({
    ...submission,
    colorNotes: "y".repeat(BRIEF_FIELD_BOUNDS.colorNotes.max + 1)
  });
  assert.deepEqual(briefRefusal(both.success ? [] : both.error.issues).refused.sort(), [
    "colorNotes",
    "functionalRequirements"
  ]);

  // A failure that is not a bounded answer cannot be repaired by dropping a
  // field: there is nothing the shopper could shorten and no rest of the
  // submission worth writing.
  const broken = designBriefSchema.safeParse({ ...submission, roomId: "not-a-uuid", functionalRequirements: "fine" });
  const brokenRefusal = briefRefusal(broken.success ? [] : broken.error.issues);
  assert.equal(brokenRefusal.recoverable, false);
  assert.deepEqual(brokenRefusal.refused, []);

  // The measurements the write should carry afterwards: the refused number
  // keeps what is on record, the ones she fixed land.
  const onRecord = { wall_length_cm: 520, room_depth_cm: 410, ceiling_height_cm: 300, notes: null };
  assert.deepEqual(
    measurementsAfterRefusal({
      submitted: { wallLengthCm: undefined, roomDepthCm: 400, ceilingHeightCm: 290 },
      existing: onRecord,
      refused: ["wallLengthCm"]
    }),
    { wallLengthCm: 520, roomDepthCm: 400, ceilingHeightCm: 290 }
  );
  assert.equal(
    measurementsChanged({
      step: "details",
      submitted: measurementsAfterRefusal({
        submitted: { wallLengthCm: undefined, roomDepthCm: 400, ceilingHeightCm: 290 },
        existing: onRecord,
        refused: ["wallLengthCm"]
      }),
      existing: onRecord
    }),
    true,
    "the fixed measurements are still written"
  );
  // And a refusal on a room that has no row invents nothing.
  assert.deepEqual(
    measurementsAfterRefusal({
      submitted: { wallLengthCm: undefined, roomDepthCm: 400 },
      existing: null,
      refused: ["wallLengthCm"]
    }),
    { wallLengthCm: null, roomDepthCm: 400, ceilingHeightCm: null }
  );
  // With nothing refused it is the submission, unchanged.
  assert.deepEqual(
    measurementsAfterRefusal({
      submitted: { wallLengthCm: 520, roomDepthCm: 410, ceilingHeightCm: 300 },
      existing: onRecord,
      refused: []
    }),
    { wallLengthCm: 520, roomDepthCm: 410, ceilingHeightCm: 300 }
  );
}

// Review finding: the strip rule matched the prefix ANYWHERE in the stored
// value, so a paragraph of the shopper's that happened to open with one of the
// two lines this app writes was deleted on save. It is stripped only where
// this app puts its own blocks now, walking in from the two edges.
{
  const compose = (shopperNote: string | undefined) =>
    composeStyleNote({ selectedSummary: "Quiet Luxury", shopperNote, avoidedSummary: "Industrial" });

  for (const prefix of [SELECTED_STYLES_PREFIX, AVOIDED_STYLES_PREFIX]) {
    const hers = `I looked at the board again.\n\n${prefix} the calm ones, not the shiny ones.\n\nRugs matter more than art.`;
    assert.equal(shopperStyleNote(hers), hers, `a paragraph opening "${prefix}" is not this app's text`);
    assert.equal(shopperStyleNote(compose(hers)), hers, "and it survives a round trip through the composer");
  }

  // The corner this deliberately does not cover: a note whose FIRST block
  // opens with the selected line, which is exactly where the composer writes
  // its own. Matching the style names instead would tell them apart, and would
  // also stop recognising this app's own text the day a style is renamed,
  // after which the value grows on every save again. That is the bug this
  // whole pair exists to stop, so the ambiguity is left at the edges.
  assert.equal(shopperStyleNote(`${SELECTED_STYLES_PREFIX} my own words`), undefined);

  // The style selector writes a DIFFERENT shape into the same field, the
  // prefix on its own line followed by "Name: description" lines, and replaces
  // the whole field with it. If that stopped being recognised, the action
  // would treat it as the shopper's words and re-wrap it on every save, which
  // is the growth that eventually locked the step (mutation-checked: keeping
  // only single-line machine blocks leaves this green and the growth back).
  const fromSelector = `${SELECTED_STYLES_PREFIX}\nQuiet Luxury: calm, unshowy materials\nWarm Minimal: few pieces, warm tone`;
  assert.equal(shopperStyleNote(fromSelector), undefined, "the selector's block is this app's text too");
  const afterSelectorEdit = compose(fromSelector);
  assert.equal(afterSelectorEdit, compose(undefined), "so composing it adds nothing");
  assert.ok(afterSelectorEdit.length < BRIEF_FIELD_BOUNDS.styleNotes.max);

  // A value the pre-S5 composition had already grown, which nests its own
  // output at both ends: the repair has to clear the whole run, not one layer
  // per save.
  const grown = [
    `${SELECTED_STYLES_PREFIX} Quiet Luxury`,
    `${SELECTED_STYLES_PREFIX} Quiet Luxury`,
    `${SELECTED_STYLES_PREFIX} Quiet Luxury`,
    "calm, not cold",
    `${AVOIDED_STYLES_PREFIX} Industrial.`,
    `${AVOIDED_STYLES_PREFIX} Industrial.`
  ].join("\n\n");
  assert.equal(shopperStyleNote(grown), "calm, not cold", "an accumulated value repairs in one save");
}

console.log("brief fields tests passed");
