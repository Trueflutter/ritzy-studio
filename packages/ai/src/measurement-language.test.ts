import assert from "node:assert/strict";

import { measurementAssumptionNotes, parseSpatialIntent } from "@ritzy-studio/domain";

import { buildInitialConceptImagePrompt } from ".";

// S5 (AC 6): what the brief's details screen tells a shopper about missing
// measurements has to be what the concept prompt actually does with them.
// The note lives in the domain package and the prompt in this one, so this is
// the only package that can call both, and it does, in one test.
//
// The rule being pinned is not obvious: roomMeasurementsLanguage returns
// nothing unless BOTH the wall length and the depth are known, so a wall
// length on its own reaches the model as silence. A note that implied
// otherwise would be a lie a shopper cannot check.

const roomType = "living room";
const intent = parseSpatialIntent({ spatialIntent: {} }, roomType);
const notesFor = (measurements: { wallLengthCm?: number | null; roomDepthCm?: number | null; ceilingHeightCm?: number | null } | null) =>
  measurementAssumptionNotes({ measurements, spatialIntent: intent });
const promptFor = (measurements: { wallLengthCm?: number | null; roomDepthCm?: number | null; ceilingHeightCm?: number | null } | null) =>
  buildInitialConceptImagePrompt({
    generationPrompt: "A calm living room in warm neutrals.",
    roomType,
    measurements
  });

const centimetres = (prompt: string) => prompt.match(/\d+\s*cm/g) ?? [];
const saysPhotographs = (notes: string[]) => notes.some((note) => /scaled from your photographs/i.test(note));

// No measurements: the note says photographs, and the prompt carries no
// dimension at all.
{
  const notes = notesFor(null);
  const prompt = promptFor(null);
  assert.equal(saysPhotographs(notes), true, "the note says the design is scaled from photographs");
  assert.deepEqual(centimetres(prompt), [], "the prompt carries no centimetre dimension");
}

// A wall length with no depth: the prompt still carries nothing, so the note
// must still say photographs rather than implying the number was used.
{
  const measurements = { wallLengthCm: 520, roomDepthCm: null, ceilingHeightCm: 300 };
  assert.equal(saysPhotographs(notesFor(measurements)), true, "one dimension alone is still photographs");
  assert.deepEqual(centimetres(promptFor(measurements)), [], "one dimension alone reaches the model as silence");
}

// All three: no measurement note, and every number reaches the prompt.
{
  const measurements = { wallLengthCm: 520, roomDepthCm: 410, ceilingHeightCm: 300 };
  const notes = notesFor(measurements);
  const prompt = promptFor(measurements);
  assert.equal(saysPhotographs(notes), false, "a measured room is not told it was scaled from photographs");
  assert.equal(notes.some((note) => /ceiling height is not stated/i.test(note)), false);
  assert.match(prompt, /520\s*cm/);
  assert.match(prompt, /410\s*cm/);
  assert.match(prompt, /300\s*cm/);
}

// Wall and depth without a ceiling: the prompt uses the plan shape and omits
// the ceiling, and the note names exactly that.
{
  const measurements = { wallLengthCm: 520, roomDepthCm: 410, ceilingHeightCm: null };
  const notes = notesFor(measurements);
  const prompt = promptFor(measurements);
  assert.equal(saysPhotographs(notes), false);
  assert.equal(notes.some((note) => /ceiling/i.test(note)), true, "the missing ceiling is named");
  assert.match(prompt, /520\s*cm/);
  assert.match(prompt, /410\s*cm/);
  assert.equal(/ceiling/i.test(prompt.split("The real room measures")[1]?.split(".")[0] ?? ""), false);
}

console.log("measurement language correspondence tests passed");
