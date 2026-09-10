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
  box: { x0: 0.1, y0: 0.2, x1: 0.5, y1: 0.6 },
  ...over
});

const actions = {
  confirm: async () => null,
  read: async () => null,
  revert: async () => null
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
      // The villa brochure case: located, not sized. Still worth confirming,
      // because the crop is what the concept prompts need.
      room({ label: "Family Room", level: "Upper", wallLengthCm: null, roomDepthCm: null }),
      // Neither: named on the drawing and nothing else.
      room({ label: "Store", wallLengthCm: null, roomDepthCm: null, box: null })
    ]
  });

  assert.match(markup, /Living Room/);
  assert.match(markup, /5\.2 by 4\.1 m|4\.7 by 3\.2 m/, "the numbers it would write are on the control she clicks");
  assert.match(markup, /Family Room, Upper/, "the level disambiguates three rooms with one name");
  assert.match(markup, /no size on the plan/);
  assert.match(markup, /no size or place on the plan/);
  assert.match(markup, /disabled=""/, "and the one it can do nothing for cannot be clicked");
  assert.match(markup, /<img[^>]+plan\.png/, "the plan she uploaded is on screen");
  assert.equal(markup.includes("Use the whole plan instead"), false, "nothing to revert before anything is confirmed");
}

// The outline follows the confirmed room without a hover, so the state is
// legible on a touch screen and in a screenshot.
{
  const markup = render("rooms", {
    planUrl: "https://example.test/plan.png",
    rooms: [room()],
    confirmed: { assetId: "plan-a", label: "Living Room", box: { x0: 0.1, y0: 0.2, x1: 0.5, y1: 0.6 } }
  });

  assert.match(markup, /data-testid="detected-room-outline"/);
  assert.match(markup, /left:10%/);
  assert.match(markup, /width:40%/);
  assert.match(markup, /We are treating Living Room as this room/);
  assert.match(markup, /Use the whole plan instead/, "a wrong box never costs her the numbers");
  assert.match(markup, /aria-pressed="true"/);
}

// A confirmation the plan could not locate draws no outline and offers no
// revert: there is nothing to undo.
{
  const markup = render("rooms", {
    planUrl: "https://example.test/plan.png",
    rooms: [room({ box: null })],
    confirmed: { assetId: "plan-a", label: "Living Room", box: null }
  });
  assert.equal(markup.includes("detected-room-outline"), false);
  assert.equal(markup.includes("Use the whole plan instead"), false);
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

console.log("detected rooms component tests passed");
