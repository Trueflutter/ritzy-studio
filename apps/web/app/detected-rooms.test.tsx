import assert from "node:assert/strict";

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: unknown }).React = React;

import type { ConfirmedFloorPlanRoom, DetectedRoom, FloorPlanScreenState } from "@ritzy-studio/domain";

import { DetectedRooms } from "./projects/[projectId]/rooms/[roomId]/brief/details/detected-rooms";

// S5b: every state this block can be in says something. A plan attached with
// nothing said about it is the silence S5a spent its life removing, and here
// there are six ways to arrive at it: a PDF, a plan too small to read, a read
// in flight, a read that failed, a read that found nothing, and a read that
// found rooms.

const room = (over: Partial<DetectedRoom> = {}): DetectedRoom => ({
  label: "Living Room",
  level: null,
  wallLengthCm: 470,
  roomDepthCm: 320,
  ceilingHeightCm: null,
  ...over
});

const actions = {
  confirm: async () => null,
  read: async () => null
};

const render = (
  state: FloorPlanScreenState,
  {
    rooms = [],
    confirmed = null,
    planUrl = null
  }: { rooms?: DetectedRoom[]; confirmed?: ConfirmedFloorPlanRoom | null; planUrl?: string | null } = {}
) =>
  renderToStaticMarkup(
    <DetectedRooms
      actions={actions}
      confirmed={confirmed}
      planUrl={planUrl}
      roomId="room-1"
      rooms={rooms}
      state={state}
    />
  );

// Nothing attached, nothing said: the dropzone above is the whole story.
assert.equal(render("no_plan"), "");

// The three refusals, each naming what she can do about it.
const pdf = render("pdf");
assert.match(pdf, /PDF, which we cannot read yet/);
assert.match(pdf, /picture of it/, "and what to upload instead");

const small = render("too_small");
assert.match(small, /too small for us to read/);
assert.match(small, /larger copy/);

const reading = render("reading");
assert.match(reading, /Reading your floor plan/);

const failed = render("read_failed");
assert.match(failed, /could not read that floor plan/);
assert.match(failed, /Nothing else on this page changed/, "the promise S5a made about refusals holds here too");
assert.match(failed, /Try reading it again/, "a failed read is retryable, and the retry is the only place that spends");

const none = render("no_rooms");
assert.match(none, /could not find any named rooms/);
assert.match(none, /still type the measurements/, "and the form is not blocked by it");

// The rooms, with what confirming each one would be worth.
{
  const markup = render("rooms", {
    planUrl: "https://example.test/plan.png",
    rooms: [
      room(),
      // The villa brochure case: named, not sized. Still worth confirming,
      // because the NAME is what the concept prompt is told.
      room({ label: "Family Room", level: "Upper", wallLengthCm: null, roomDepthCm: null })
    ]
  });

  assert.match(markup, /Living Room/);
  assert.match(markup, /5\.2 by 4\.1 m|4\.7 by 3\.2 m/, "the numbers it would write are on the control she clicks");
  assert.match(markup, /Family Room, Upper/, "the level disambiguates three rooms with one name");
  assert.match(markup, /no size printed on the plan/);
  assert.match(markup, /read from your plan/, "an AI-read number says where it came from (design system 12.6)");
  assert.match(markup, /<img[^>]+plan\.png/, "the plan she uploaded is on screen, so she can see it is the right one");
  assert.equal(markup.includes("detected-room-outline"), false, "and nothing is outlined on it");
}

// A confirmed room is named back and marked, by index rather than by label: a
// whole-home plan carries "Bedroom" three times.
{
  const markup = render("rooms", {
    planUrl: "https://example.test/plan.png",
    rooms: [
      room({ label: "Bedroom", level: "Ground" }),
      room({ label: "Bedroom", level: "First" }),
      room({ label: "Bedroom", level: "Second" })
    ],
    confirmed: { assetId: "plan-a", label: "Bedroom", index: 1 }
  });

  assert.equal((markup.match(/aria-pressed="true"/g) ?? []).length, 1, "exactly one chip is pressed");
  assert.match(markup, /We are treating Bedroom, First as this room/);
}

// Every control in this block sits inside the details form, so a bare button
// would submit the brief and generate the clarifying questions instead of
// confirming a room.
for (const state of ["read_failed", "rooms"] as const) {
  const markup = render(state, { rooms: [room()], planUrl: "https://example.test/plan.png" });
  const buttons = markup.match(/<button[^>]*>/g) ?? [];
  assert.ok(buttons.length > 0, `${state} renders a control`);
  for (const button of buttons) {
    assert.match(button, /type="button"/, `${state}: every control is type=button`);
  }
}

// Every named room is clickable, including the ones the plan does not size:
// confirming one tells the concept prompt which room on the drawing is hers.
// An unanchored search for `disabled` cannot tell WHICH chip is disabled, and
// disabling the unsized ones is exactly the regression the villa brochure
// deviation exists to prevent (tests review, mutation-verified).
{
  const markup = render("rooms", {
    planUrl: "https://example.test/plan.png",
    rooms: [room(), room({ label: "Family Room", wallLengthCm: null, roomDepthCm: null })]
  });
  const chips = markup.match(/<button[^>]*>[\s\S]*?<\/button>/g) ?? [];
  assert.equal(chips.length, 2);
  for (const chip of chips) {
    // The ATTRIBUTE, not the word: the class list carries `disabled:opacity-60`
    // and an unanchored search matches that instead.
    assert.equal(/disabled=""/.test(chip), false, `no chip is disabled: ${chip.slice(0, 90)}`);
  }
}

console.log("detected rooms component tests passed");
