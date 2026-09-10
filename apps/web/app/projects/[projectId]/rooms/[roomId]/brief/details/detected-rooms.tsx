"use client";

import {
  detectedRoomLabel,
  roomConfirmKind,
  roomDimensionsLabel,
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
  confirm: (roomId: string, roomIndex: number) => Promise<{ message?: string } | null>;
  read: (roomId: string) => Promise<{ message?: string } | null>;
  revert: (roomId: string) => Promise<{ message?: string } | null>;
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
  const [outlined, setOutlined] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // No `useRouter` here. Each of these actions calls `revalidatePath`, so Next
  // re-renders this page's server tree with the action's own response; asking
  // the router for a second refresh only doubles the work, and it would make
  // this component unrenderable outside a mounted router, which is how a
  // screen's states go unpinned.

  if (state === "no_plan") {
    return null;
  }

  const note = (text: string, action?: { label: string; run: () => void }) => (
    <div className="mt-5 border border-line bg-page px-5 py-4" data-testid="detected-rooms">
      <p className="font-body text-body-s leading-[1.6] text-ink-secondary">{text}</p>
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
      "Your plan is a PDF, which we cannot read yet. Upload a picture of it, a screenshot or a photograph, and we will find the rooms on it."
    );
  }

  if (state === "too_small") {
    return note(
      "That plan is too small for us to read the room names and sizes on it. A larger copy, or a screenshot taken at full size, would let us find the rooms."
    );
  }

  if (state === "reading") {
    return note("Reading your floor plan. The rooms it names will appear here in a moment.");
  }

  if (state === "read_failed") {
    return note("We could not read that floor plan. Nothing else on this page changed.", {
      label: "Try reading it again",
      run: () =>
        startTransition(async () => {
          setMessage(null);
          const result = await actions.read(roomId);
          if (result?.message) {
            setMessage(result.message);
          }
        })
    });
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
      // `defaultValue` re-propagating through one.
      if (room.wallLengthCm !== null && room.roomDepthCm !== null) {
        setFieldValue(MEASUREMENT_FIELD_IDS[0], room.wallLengthCm);
        setFieldValue(MEASUREMENT_FIELD_IDS[1], room.roomDepthCm);
        if (room.ceilingHeightCm !== null) {
          setFieldValue(MEASUREMENT_FIELD_IDS[2], room.ceilingHeightCm);
        }
      }
    });
  };

  const outlinedBox = outlined !== null ? (rooms[outlined]?.box ?? null) : (confirmed?.box ?? null);

  return (
    <div className="mt-5 border border-line bg-page px-5 py-4" data-testid="detected-rooms">
      <p className="font-body text-caption-tight font-medium uppercase tracking-[0.24em] text-ink-muted">
        Rooms on your plan
      </p>
      <p className="mt-2 font-body text-body-s leading-[1.6] text-ink-secondary">
        {confirmed
          ? `We are treating ${confirmed.label} as this room.`
          : "Pick the one this brief is for and we will use its part of the drawing."}
      </p>

      {planUrl ? (
        <div className="relative mt-4 border border-line bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Your floor plan" className="block w-full" src={planUrl} />
          {outlinedBox ? (
            <span
              aria-hidden
              className="pointer-events-none absolute border-2 border-accent-deep"
              data-testid="detected-room-outline"
              style={{
                left: `${outlinedBox.x0 * 100}%`,
                top: `${outlinedBox.y0 * 100}%`,
                width: `${(outlinedBox.x1 - outlinedBox.x0) * 100}%`,
                height: `${(outlinedBox.y1 - outlinedBox.y0) * 100}%`
              }}
            />
          ) : null}
        </div>
      ) : null}

      <ul className="mt-4 flex flex-wrap gap-2">
        {rooms.map((room, index) => {
          const kind = roomConfirmKind(room);
          const dimensions = roomDimensionsLabel(room);
          const isConfirmed = confirmed?.label === room.label;
          return (
            <li key={`${room.label}-${index}`}>
              <button
                aria-pressed={isConfirmed}
                className={`border px-3 py-2 text-left font-body text-body-s transition-colors duration-micro ease-standard disabled:cursor-not-allowed disabled:opacity-60 ${
                  isConfirmed ? "border-ink bg-surface text-ink" : "border-line bg-surface text-ink-secondary hover:border-ink"
                }`}
                disabled={kind === null || pending}
                onBlur={() => setOutlined(null)}
                onClick={() => confirmRoom(index, room)}
                onFocus={() => setOutlined(room.box ? index : null)}
                onMouseEnter={() => setOutlined(room.box ? index : null)}
                onMouseLeave={() => setOutlined(null)}
                type="button"
              >
                <span className="block">{detectedRoomLabel(room)}</span>
                <span className="mt-1 block font-display text-[13.5px] italic text-ink-subtle">
                  {dimensions ?? (kind === "location" ? "no size on the plan" : "no size or place on the plan")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {confirmed?.box ? (
        <button
          className="mt-4 font-display text-[13.5px] italic leading-[1.5] text-ink-subtle underline decoration-line underline-offset-4 disabled:opacity-50"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await actions.revert(roomId);
            })
          }
          type="button"
        >
          Use the whole plan instead
        </button>
      ) : null}

      {message ? (
        <p className="mt-3 font-body text-body-s leading-[1.6] text-ink-secondary" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
