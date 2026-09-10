"use client";

import { measurementAssumptionNotes, parseSpatialIntent } from "@ritzy-studio/domain";
import { useEffect, useState } from "react";

// The assumption list on the brief's details screen (S5, design system 12.5).
//
// 12.5 fixes the form of this list: a hairline-bordered panel holding a
// numbered list in roman numerals, and never a tooltip. It scopes the list to
// the concept screen, behind a quiet link, because there the assumptions are a
// disclosure about a design already made. Here it is rendered inline and
// always open, because on a form the assumption is a consequence of what the
// shopper is deciding in front of it.
//
// That justification only holds if the list follows the whole form. Every
// field it depends on, the three measurements and the two spatial selects,
// sits on this same screen above it, so a server-rendered list would assert
// assumptions the shopper has already overridden: pick a fireplace as the
// focal point and a saved-state list still says the design assumes the TV
// wall (review finding). Everything is therefore read live, and the SAME
// domain functions compose the list here as the ones the tests pin.

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"] as const;

// The ids this component reads. `details-field-ids.test.ts` asserts the page
// still renders every one of them, because a rename there would silently
// freeze this panel on its saved state.
export const ASSUMPTION_SOURCE_FIELD_IDS = {
  wall: "wallLengthCm",
  depth: "roomDepthCm",
  ceiling: "ceilingHeightCm",
  focalPoint: "focalPoint",
  seatingPriority: "seatingPriority",
  diningSeatCount: "diningSeatCount"
} as const;

const readValue = (id: string): string | null => {
  const field = document.getElementById(id);
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
    const raw = field.value.trim();
    return raw.length > 0 ? raw : null;
  }
  return null;
};

// The read step, separated from the DOM so it can be exercised against a stub
// accessor. Without this the listener wiring is the only thing a test can
// reach, and the wiring is not where the falsehood would come from: a control
// that stops being an input or a select reads as absent, and the panel would
// quietly assert the saved state again (tests review).
export function assumptionInputsFrom(getValue: (id: string) => string | null) {
  const asNumber = (id: string) => {
    const raw = getValue(id);
    if (raw === null || raw.trim().length === 0) {
      return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  };

  return {
    measurements: {
      wallLengthCm: asNumber(ASSUMPTION_SOURCE_FIELD_IDS.wall),
      roomDepthCm: asNumber(ASSUMPTION_SOURCE_FIELD_IDS.depth),
      ceilingHeightCm: asNumber(ASSUMPTION_SOURCE_FIELD_IDS.ceiling)
    },
    intent: {
      focalPoint: getValue(ASSUMPTION_SOURCE_FIELD_IDS.focalPoint) ?? "unknown",
      seatingPriority: getValue(ASSUMPTION_SOURCE_FIELD_IDS.seatingPriority) ?? "unknown",
      diningSeatCount: asNumber(ASSUMPTION_SOURCE_FIELD_IDS.diningSeatCount)
    }
  };
}

export function assumptionNotesFrom(getValue: (id: string) => string | null, roomType: string): string[] {
  const { measurements, intent } = assumptionInputsFrom(getValue);
  return measurementAssumptionNotes({
    measurements,
    spatialIntent: parseSpatialIntent({ spatialIntent: intent }, roomType)
  });
}

export function MeasurementAssumptionNotes({
  roomType,
  savedNotes
}: {
  roomType: string;
  // What the saved state assumes, so the server markup is right before this
  // hydrates and a shopper with JavaScript disabled still sees the list.
  savedNotes: readonly string[];
}) {
  const [notes, setNotes] = useState<readonly string[]>(savedNotes);

  useEffect(() => {
    const recompute = () => setNotes(assumptionNotesFrom(readValue, roomType));

    const fields = Object.values(ASSUMPTION_SOURCE_FIELD_IDS)
      .map((id) => document.getElementById(id))
      .filter((field): field is HTMLElement => field !== null);

    recompute();
    for (const field of fields) {
      field.addEventListener("input", recompute);
      field.addEventListener("change", recompute);
    }
    return () => {
      for (const field of fields) {
        field.removeEventListener("input", recompute);
        field.removeEventListener("change", recompute);
      }
    };
  }, [roomType]);

  if (notes.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 border border-line bg-page px-5 py-4" data-testid="measurement-assumption-notes">
      <p className="font-body text-caption-tight font-medium uppercase tracking-[0.24em] text-ink-muted">
        What we will assume
      </p>
      <ol className="mt-3 flex flex-col gap-2">
        {notes.map((note, index) => (
          <li className="flex gap-3 font-body text-body-s leading-[1.6] text-ink-secondary" key={note}>
            <span aria-hidden className="font-display italic text-ink-subtle">
              {ROMAN[index] ?? String(index + 1)}.
            </span>
            <span>{note}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
