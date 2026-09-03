import assert from "node:assert/strict";

import { initialConceptPrompt, roomBlueprintDefaultsLanguage, roomDesignLanguage } from "@ritzy-studio/prompts";

import { buildInitialConceptImagePrompt, buildInitialConceptSystemPrompt, initialConceptReferences } from ".";

// Concept-first prompt architecture (S2): one path, no flags, no pre-approval
// catalogue anchors. The system prompt carries the full design language plus the
// palette-register guardrail; the image prompt mirrors it.

const systemPrompt = buildInitialConceptSystemPrompt({
  roomType: "living room",
  styleSlugs: ["modern"]
});

assert.ok(systemPrompt.startsWith(initialConceptPrompt.system));
assert.match(systemPrompt, /Ritzy interior design language:/);
assert.match(systemPrompt, /source room as the architectural anchor/);
assert.match(systemPrompt, /editorial residential interior photography/);
assert.equal(systemPrompt.includes(roomDesignLanguage("living room")), true);
assert.equal(systemPrompt.includes(roomBlueprintDefaultsLanguage("living room")), true);
assert.match(systemPrompt, /Sculptural Minimal/);
// The palette-register guardrail: derived from the brief, never defaulted.
assert.match(systemPrompt, /Palette and material register:/);
assert.match(systemPrompt, /Never fall back to a generic beige-brown scheme by default/);
assert.match(systemPrompt, /cool, dark, saturated, or bold colour, commit to that register fully/);
assert.match(systemPrompt, /choose ONE deliberate register/);
assert.match(systemPrompt, /may never appear as a dominant surface/);

const imagePrompt = buildInitialConceptImagePrompt({
  generationPrompt: "Create a warm living room concept.",
  roomType: "living room",
  hasInspirationImages: true,
  styleSlugs: ["modern"]
});

assert.match(imagePrompt, /Create a warm living room concept/);
assert.match(imagePrompt, /Use the uploaded room photo as the base image/);
assert.match(imagePrompt, /Use the uploaded inspiration images as style references/);
assert.match(imagePrompt, /Sculptural Minimal/);
assert.match(imagePrompt, /source room as the architectural anchor/);
assert.match(imagePrompt, /arranged for conversation/);
assert.match(imagePrompt, /primary seating must be placed on a different wall or zone/);
assert.match(imagePrompt, /sofa seat\/front should face the TV\/media wall or declared focal point/);
assert.match(imagePrompt, /widescreen TV/);
assert.match(imagePrompt, /corrected verticals/);
assert.match(imagePrompt, /fake product labels/);
assert.match(imagePrompt, /Ritzy enhanced image styling layer/);
assert.match(imagePrompt, /Palette and material register:/);
// No catalogue framing may survive in the concept-first image prompt.
assert.equal(imagePrompt.includes("Catalogue-grounded concept references"), false);
assert.equal(imagePrompt.includes("Do not invent alternate anchor furniture"), false);

// --- Anchored concepts (S3b). This clause and the reference order below ARE
// the mechanism: the pieces are chosen and paid for before the render, the list
// tells the shopper they are in the design, and the harness gates on it. If the
// render never sees them, every one of those remains true and every one of them
// is a lie, so both halves are pinned here.
{
  const anchored = buildInitialConceptImagePrompt({
    generationPrompt: "Create a warm living room concept.",
    roomType: "living room",
    hasInspirationImages: false,
    anchorProducts: [{ roleLabel: "sofa" }, { roleLabel: "rug" }]
  });
  assert.match(anchored, /The LAST 2 input images are photographs of real furniture already chosen for this room/);
  assert.match(anchored, /image 1 of that set is the sofa, image 2 of that set is the rug/);
  assert.match(anchored, /Put those exact pieces in the room/);
  assert.match(anchored, /Do not swap any of them for a similar-looking piece/);

  // Singular reads as English, because a room can be anchored on one piece.
  const one = buildInitialConceptImagePrompt({
    generationPrompt: "Create a warm living room concept.",
    roomType: "living room",
    hasInspirationImages: false,
    anchorProducts: [{ roleLabel: "sofa" }]
  });
  assert.match(one, /The LAST 1 input image is a photograph of real furniture/);

  // And a room with no anchors is not told to keep anything.
  assert.equal(imagePrompt.includes("already chosen for this room"), false);
}

// --- The images themselves: anchors last, so "the last N" means what the
// prompt says; required, so a provider cannot quietly drop one; and carrying
// bytes with no URL, because a retailer link is what cost the render its
// primary provider at 232 s against a 300 s limit.
{
  const bytes = (tag: string) => Buffer.from(tag);
  const references = initialConceptReferences({
    roomPhotoBytes: bytes("room"),
    roomPhotoMimeType: "image/jpeg",
    roomPhotoUrl: "https://example-project.supabase.co/room.jpg",
    additionalRoomPhotos: [
      { url: "https://example-project.supabase.co/angle.jpg", bytes: bytes("angle"), mimeType: "image/jpeg" }
    ],
    anchorProducts: [
      { roleLabel: "sofa", bytes: bytes("sofa"), mimeType: "image/jpeg" },
      { roleLabel: "rug", bytes: bytes("rug"), mimeType: "image/jpeg" }
    ]
  });

  assert.deepEqual(
    references.map((reference) => reference.name),
    ["room", "room-angle-2", "anchor-1", "anchor-2"],
    "anchors come last, in the order the prompt numbers them"
  );
  const anchors = references.slice(-2);
  assert.ok(anchors.every((reference) => reference.required), "a dropped anchor is a render of furniture nobody is buying");
  assert.ok(anchors.every((reference) => reference.url === null), "and never a link for the provider to follow");
  assert.deepEqual(anchors.map((reference) => reference.bytes.toString()), ["sofa", "rug"]);

  assert.equal(
    initialConceptReferences({
      roomPhotoBytes: bytes("room"),
      roomPhotoMimeType: "image/jpeg",
      roomPhotoUrl: "https://example-project.supabase.co/room.jpg"
    }).length,
    1,
    "an unanchored room sends its photograph and nothing else"
  );
}

const strictPreservationImagePrompt = buildInitialConceptImagePrompt({
  generationPrompt: "Create a warm living room concept.",
  roomType: "living room",
  strictSourceRoomPreservation: true
});

assert.match(strictPreservationImagePrompt, /Strict source-room preservation layer/);
assert.match(strictPreservationImagePrompt, /Do not close, fill, remove, or invent wall openings/);
assert.match(strictPreservationImagePrompt, /keep that opening and sightline visible/);

console.log("initial concept prompt assembly tests passed");
