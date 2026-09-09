import { BRIEF_FIELD_BOUNDS, type BriefFieldName } from "@ritzy-studio/domain";

// The one status note the brief's steps render (S5).
//
// Every step had its own copy of this block, in three slightly different
// styles, and none could tell a refusal from a success, so a refusal
// redirected to a step whose copy ignored the tone rendered as a
// success-styled aside.
//
// A refusal travels as a FIELD NAME, not as text. `?message=` is reflected
// verbatim on this and eight other screens, which is a pre-existing pattern,
// but giving that channel the error treatment as well would let anyone
// holding a room's URL render arbitrary copy as a first-class error inside
// the owner's session (security review). So free text keeps the neutral
// note it has always had, and only a name this file recognises produces an
// error.

const REFUSAL_LABELS: Partial<Record<BriefFieldName, string>> = {
  colorNotes: "Your colours and materials answer",
  functionalRequirements: "Your answer about what the room needs to do",
  avoidNotes: "Your answer about what to keep out",
  inspirationNotes: "Your note about your references",
  styleNotes: "Your style note",
  measurementNotes: "Your measurement note",
  mustKeepClear: "Your note about what must stay clear",
  wallLengthCm: "The main wall measurement",
  roomDepthCm: "The room depth measurement",
  ceilingHeightCm: "The ceiling measurement"
};

export function isRefusedField(value: string | undefined): value is BriefFieldName {
  return value !== undefined && value in REFUSAL_LABELS;
}

export function refusalCopy(field: BriefFieldName): string {
  const bound = BRIEF_FIELD_BOUNDS[field];
  const limit = bound.kind === "text" ? ` Keep it under ${bound.max} characters.` : ` Keep it under ${bound.max}.`;
  return `${REFUSAL_LABELS[field] ?? "One of your answers"} was too long to save, so we kept the answer you had and changed nothing else.${limit}`;
}

export function BriefMessage({ message, refused }: { message?: string; refused?: string }) {
  if (isRefusedField(refused)) {
    return (
      <p
        className="mb-10 max-w-[65ch] border-s-2 border-error bg-surface px-4 py-3 font-body text-body-s text-ink"
        role="alert"
      >
        {refusalCopy(refused)}
      </p>
    );
  }

  if (!message) {
    return null;
  }

  return (
    <p className="mb-10 max-w-[65ch] border border-line bg-surface px-4 py-3 font-body text-body-s text-ink-secondary">
      {message}
    </p>
  );
}

// The error treatment for the field the refusal names (design system 15.7:
// the input's bottom border becomes the error colour and the message sits
// beneath it). A banner alone marks the page and not the input that has to
// change, and on a narrow screen the two are never both visible (design
// review).
export function fieldErrorClass(field: BriefFieldName, refused: string | undefined): string {
  return refused === field ? " border-error focus:border-error" : "";
}

export function FieldError({ field, refused }: { field: BriefFieldName; refused: string | undefined }) {
  if (refused !== field) {
    return null;
  }
  const bound = BRIEF_FIELD_BOUNDS[field];
  return (
    <p className="mt-[10px] font-display text-[13.5px] italic leading-[1.5] text-error">
      Too long to save. Keep it under {bound.max}
      {bound.kind === "text" ? " characters" : ""}.
    </p>
  );
}
