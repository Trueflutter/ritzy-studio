"use client";

import {
  PLAN_READABLE_MIN_EDGE_PX,
  detectedRoomLabel,
  roomDimensionsLabel,
  roomIsDimensioned,
  type ConfirmedFloorPlanRoom,
  type DetectedRoom,
  type FloorPlanScreenState
} from "@ritzy-studio/domain";
import { useState, useTransition } from "react";

import { ASSUMPTION_SOURCE_FIELD_IDS } from "./measurement-notes";

// The rooms a floor plan names, and the one she says is this one (S5b).
//
// Confirming writes server side, but the write alone would not show: the three
// measurement inputs are uncontrolled `defaultValue`, so a field she has typed
// in keeps her number on screen while the database holds the plan's, and the
// assumption panel below them reads its state once at mount and recomputes only
// from `input` and `change`. A server refresh moves neither. So the control
// sets the fields through the native value setter and dispatches `input`, which
// makes the panel follow for free and keeps the screen and the row saying the
// same thing.
//
// Every control here is `type="button"`. The whole block sits inside the
// details form, and a bare button would submit the brief and generate the
// clarifying questions instead of confirming a room.

const MEASUREMENT_FIELD_IDS = [
  ASSUMPTION_SOURCE_FIELD_IDS.wall,
  ASSUMPTION_SOURCE_FIELD_IDS.depth,
  ASSUMPTION_SOURCE_FIELD_IDS.ceiling
] as const;

function setFieldValue(id: string, value: number | null) {
  const field = document.getElementById(id);
  if (!(field instanceof HTMLInputElement)) {
    return;
  }
  // React tracks the last value it wrote and skips the event when the DOM
  // value is set directly, so the setter has to be called off the prototype.
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(field, value === null ? "" : String(value));
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

export type DetectedRoomsActions = {
  confirm: (roomId: string, roomIndex: number) => Promise<{ message?: string; cleared?: boolean } | null>;
  read: (roomId: string) => Promise<{ message?: string } | null>;
};

export function DetectedRooms({
  actions,
  confirmed,
  planUrl,
  roomId,
  rooms,
  state
}: {
  // The three server actions, handed in rather than imported. Importing them
  // pulls the whole action module, and with it the Supabase service client,
  // into anything that renders this: the component then cannot be exercised
  // without a live environment, which is how a screen's states go unpinned.
  actions: DetectedRoomsActions;
  confirmed: ConfirmedFloorPlanRoom | null;
  planUrl: string | null;
  roomId: string;
  rooms: readonly DetectedRoom[];
  state: FloorPlanScreenState;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // No `useRouter` here. Each of these actions calls `revalidatePath`, so Next
  // re-renders this page's server tree with the action's own response; asking
  // the router for a second refresh only doubles the work, and it would make
  // this component unrenderable outside a mounted router, which is how a
  // screen's states go unpinned.

  if (state === "no_plan") {
    return null;
  }

  // A refusal carries the design system's error treatment (8.19: a 1px error
  // border on the failed section and the caption in the error colour). Without
  // it a refusal is a neutral grey note carrying the same weight as a hint,
  // which is how both refusal states read as success (design review).
  const note = (text: string, action?: { label: string; run: () => void }, tone: "neutral" | "error" = "neutral") => (
    <div
      className={`mt-5 border bg-page px-5 py-4 ${tone === "error" ? "border-t-2 border-t-error border-line" : "border-line"}`}
      data-testid="detected-rooms"
      role={tone === "error" ? "status" : undefined}
    >
      <p
        className={
          tone === "error"
            ? "font-display text-[15px] italic leading-[1.6] text-error"
            : "font-body text-body-s leading-[1.6] text-ink-secondary"
        }
      >
        {text}
      </p>
      {action ? (
        <button
          className="mt-3 font-display text-[13.5px] italic leading-[1.5] text-accent-deep underline decoration-line underline-offset-4 disabled:opacity-50"
          disabled={pending}
          onClick={action.run}
          type="button"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );

  if (state === "pdf") {
    // Stored, and read by nothing: `room-images.ts` keeps a plan only when its
    // mime type is an image, so a PDF has never reached a model. Saying so is
    // the whole of this state until the rasterisation slice lands.
    return note(
      "Your plan is a PDF, which we cannot read yet. A picture of it works: a screenshot, or a photograph of the page.",
      undefined,
      "error"
    );
  }

  if (state === "too_small") {
    return note(
      `That plan is too small to read the room names and sizes on it. We need about ${PLAN_READABLE_MIN_EDGE_PX} pixels across; a screenshot taken at full size usually is.`,
      undefined,
      "error"
    );
  }

  if (state === "reading") {
    return note("Reading your floor plan. The rooms it names will appear here in a moment.");
  }

  if (state === "read_failed") {
    return note(
      "We could not read that floor plan. Nothing else on this page changed.",
      {
        label: "Try reading it again",
      run: () =>
        startTransition(async () => {
          setMessage(null);
          const result = await actions.read(roomId);
          if (result?.message) {
            setMessage(result.message);
          }
        })
      },
      "error"
    );
  }

  if (state === "no_rooms") {
    return note(
      "We could not find any named rooms on that plan. You can still type the measurements below, and the plan stays attached for the design to read."
    );
  }

  const confirmRoom = (index: number, room: DetectedRoom) => {
    startTransition(async () => {
      setMessage(null);
      const result = await actions.confirm(roomId, index);
      if (result?.message) {
        setMessage(result.message);
      }
      // The fields follow the row, without a reload and without depending on
      // `defaultValue` re-propagating through one. Including when the row was
      // cleared: leaving the previous room's numbers on screen above a chip
      // that names a different room is the same disagreement in reverse.
      if (roomIsDimensioned(room)) {
        setFieldValue(MEASUREMENT_FIELD_IDS[0], room.wallLengthCm);
        setFieldValue(MEASUREMENT_FIELD_IDS[1], room.roomDepthCm);
        if (room.ceilingHeightCm !== null) {
          setFieldValue(MEASUREMENT_FIELD_IDS[2], room.ceilingHeightCm);
        }
      } else if (result?.cleared) {
        setFieldValue(MEASUREMENT_FIELD_IDS[0], null);
        setFieldValue(MEASUREMENT_FIELD_IDS[1], null);
      }
    });
  };

  return (
    <div className="mt-5 border border-line bg-page px-5 py-4" data-testid="detected-rooms">
      <p className="font-body text-caption-tight font-medium uppercase tracking-[0.24em] text-ink-muted">
        Rooms on your plan
      </p>
      <p className="mt-2 font-body text-body-s leading-[1.6] text-ink-secondary">
        {confirmed
          ? `We are treating ${detectedRoomLabel(rooms[confirmed.index] ?? { label: confirmed.label, level: null })} as this room, and telling the design to read that room on your plan.`
          : "Pick the one this brief is for and we will use the size printed for it."}
      </p>

      {planUrl ? (
        <div className="mt-4">
          {/* The drawing she uploaded, so she can see it is the right one. No
              outline is drawn on it: the model locates rooms badly, and an
              outline around the wrong room is worse than none. At panel width
              a developer's sheet has five-pixel labels, so it opens full size
              rather than pretending to be readable here (design review). */}
          <a
            className="block border border-line bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)]"
            href={planUrl}
            rel="noreferrer"
            target="_blank"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="The floor plan you uploaded" className="block w-full" src={planUrl} />
          </a>
          <span className="mt-2 block font-body text-body-s text-ink-muted">
            Open the plan full size to read it.
          </span>
        </div>
      ) : null}

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room, index) => {
          const dimensions = roomDimensionsLabel(room);
          // By index, not by label: a whole-home plan carries "Bedroom" three
          // times and matching by name marks all three (review finding).
          const isConfirmed = confirmed?.index === index;
          return (
            <li key={`${room.label}-${index}`}>
              <button
                aria-pressed={isConfirmed}
                className={`w-full border px-3 py-2 text-left font-body text-body-s transition-colors duration-micro ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60 ${
                  isConfirmed ? "border-ink bg-surface text-ink" : "border-line bg-surface text-ink-secondary hover:border-ink"
                }`}
                disabled={pending}
                onClick={() => confirmRoom(index, room)}
                type="button"
              >
                <span className="block">{detectedRoomLabel(room)}</span>
                {/* `--rs-text-subtle` is forbidden below 18px: 3.6:1 (design
                    system 78). The one line saying a machine read these numbers
                    must not be the hardest thing here to read. And the values
                    are named rather than listed, because the read reports the
                    longer edge first while a drawing prints its own order, so
                    "3.2 by 2.4" against a plan printing "2.4m x 3.2m" reads as
                    a transcription error (design review). */}
                <span className="mt-1 block font-display text-[13.5px] italic text-ink-muted">
                  {dimensions ?? "no size printed on the plan"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {message ? (
        <p className="mt-3 font-body text-body-s leading-[1.6] text-ink-secondary" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
