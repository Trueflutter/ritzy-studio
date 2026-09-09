"use client";

import { measurementScalingNotes } from "@ritzy-studio/domain";
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
// That justification only holds if the list follows what she is typing. A
// server-rendered list would describe the measurements she last SAVED while
// sitting directly beneath the inputs that override them, so a shopper who
// types her three numbers would still be told the design is scaled from her
// photographs until she submitted (review finding). The measurement half is
// therefore recomputed here from the live field values; the intent
// assumptions come from the server, because the fields that decide them are
// elsewhere on the page and unchanged by this slice.

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"] as const;

const readNumber = (id: string): number | null => {
  const field = document.getElementById(id);
  const raw = field instanceof HTMLInputElement ? field.value.trim() : "";
  if (raw.length === 0) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
};

export function MeasurementAssumptionNotes({
  intentAssumptions,
  scalingNotes,
  fieldIds = { wall: "wallLengthCm", depth: "roomDepthCm", ceiling: "ceilingHeightCm" }
}: {
  // The assumptions parseSpatialIntent recorded, from the server.
  intentAssumptions: readonly string[];
  // The measurement lines for what is saved, so the panel is correct in the
  // server-rendered markup before this component hydrates.
  scalingNotes: readonly string[];
  fieldIds?: { wall: string; depth: string; ceiling: string };
}) {
  const [liveScaling, setLiveScaling] = useState<readonly string[]>(scalingNotes);

  useEffect(() => {
    const recompute = () =>
      setLiveScaling(
        measurementScalingNotes({
          wallLengthCm: readNumber(fieldIds.wall),
          roomDepthCm: readNumber(fieldIds.depth),
          ceilingHeightCm: readNumber(fieldIds.ceiling)
        })
      );

    const fields = [fieldIds.wall, fieldIds.depth, fieldIds.ceiling]
      .map((id) => document.getElementById(id))
      .filter((field): field is HTMLElement => field !== null);

    recompute();
    for (const field of fields) {
      field.addEventListener("input", recompute);
    }
    return () => {
      for (const field of fields) {
        field.removeEventListener("input", recompute);
      }
    };
  }, [fieldIds.wall, fieldIds.depth, fieldIds.ceiling]);

  const notes = [...liveScaling, ...intentAssumptions];
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
