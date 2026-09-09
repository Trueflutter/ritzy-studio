import assert from "node:assert/strict";

import { BRIEF_FIELD_BOUNDS } from "@ritzy-studio/domain";

import {
  briefNumberAttributes,
  briefTextAttributes,
  colourNotesDefault,
  measurementsChanged,
  shopperStyleNote
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

  // A room that never measured and submits nothing collects no empty rows.
  assert.equal(measurementsChanged({}, null), false);
  assert.equal(measurementsChanged({ wallLengthCm: 520 }, null), true, "the first measurement is written");

  // The clearing case the old mandatory gate made unreachable.
  assert.equal(
    measurementsChanged({}, stored(520, 410, 300)),
    true,
    "emptying every field is a change that must be recorded"
  );
  assert.equal(
    measurementsChanged({ wallLengthCm: 520, roomDepthCm: 410 }, stored(520, 410, 300)),
    true,
    "clearing one field is a change"
  );

  // An unchanged resubmission writes nothing, so pressing Continue twice does
  // not grow the table.
  assert.equal(measurementsChanged({ wallLengthCm: 520, roomDepthCm: 410, ceilingHeightCm: 300 }, stored(520, 410, 300)), false);
  assert.equal(measurementsChanged({}, stored(null, null, null)), false, "an empty row resubmitted empty is unchanged");

  // A changed value is a change.
  assert.equal(measurementsChanged({ wallLengthCm: 521, roomDepthCm: 410, ceilingHeightCm: 300 }, stored(520, 410, 300)), true);
  assert.equal(
    measurementsChanged({ wallLengthCm: 520, roomDepthCm: 410, ceilingHeightCm: 300, notes: "the alcove is 40 cm deep" }, stored(520, 410, 300)),
    true,
    "a note is part of the record"
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

  const composedOnce = [
    "Selected visual styles: Quiet Luxury, Warm Minimal",
    "calm, not cold",
    "Avoid styles: Industrial."
  ].join("\n\n");
  assert.equal(shopperStyleNote(composedOnce), "calm, not cold", "the composed lines are not the shopper's words");

  // The already-grown case: composing repeatedly nested the machine lines.
  const composedTwice = [
    "Selected visual styles: Quiet Luxury, Warm Minimal",
    "Selected visual styles: Quiet Luxury",
    "calm, not cold",
    "Avoid styles: Industrial.",
    "Avoid styles: Industrial."
  ].join("\n\n");
  assert.equal(shopperStyleNote(composedTwice), "calm, not cold", "a grown value is repaired, not preserved");

  // A room where the shopper wrote nothing keeps nothing, so the next
  // composition is exactly the two machine lines and stops growing.
  assert.equal(shopperStyleNote(["Selected visual styles: Quiet Luxury", "Avoid styles: Industrial."].join("\n\n")), undefined);

  // Applying it twice changes nothing, which is what makes the composition
  // safe to run on every save.
  const once = shopperStyleNote(composedOnce);
  assert.equal(shopperStyleNote(once), once);
}

console.log("brief fields tests passed");
