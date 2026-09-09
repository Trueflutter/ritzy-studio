import { BRIEF_FIELD_BOUNDS, type BriefFieldName } from "@ritzy-studio/domain";

import { isBriefFieldName } from "@/lib/brief-fields";

// The one status note the brief's steps render (S5).
//
// Every step had its own copy of this block, in three slightly different
// styles, and none could tell a refusal from a success, so a refusal
// redirected to a step whose copy ignored the tone rendered as a
// success-styled aside.
//
// A refusal travels as FIELD NAMES, not as text. `?message=` is reflected
// verbatim on this and eight other screens, which is a pre-existing pattern,
// but giving that channel the error treatment as well would let anyone
// holding a room's URL render arbitrary copy as a first-class error inside
// the owner's session (security review). So free text keeps the neutral
// note it has always had, and only names this app recognises produce an
// error.

// Every bounded field needs a label: a refusal on one without it renders
// nothing at all, so the shopper presses Continue, the page reloads
// identical and nothing was saved. That is the silent refusal this component
// exists to prevent, so the type is total rather than partial and
// `brief-message.test.tsx` walks the bounds table (tests review).
//
// Lowercase, because these are composed into a sentence that can name more
// than one of them.
const REFUSAL_LABELS: Record<BriefFieldName, string> = {
  colorNotes: "your colours and materials answer",
  functionalRequirements: "your answer about what the room needs to do",
  avoidNotes: "your answer about what to keep out",
  inspirationNotes: "your note about your references",
  styleNotes: "your style note",
  measurementNotes: "your measurement note",
  mustKeepClear: "your note about what must stay clear",
  wallLengthCm: "the main wall measurement",
  roomDepthCm: "the room depth measurement",
  ceilingHeightCm: "the ceiling measurement",
  budgetNotes: "the budget note carried from your project"
};

export function isRefusedField(value: string | undefined): value is BriefFieldName {
  return isBriefFieldName(value);
}

// The refusal in the URL, resolved to names this app knows. Anything else is
// dropped rather than rendered, which is what keeps the error treatment out of
// reach of whoever can put text in a link (security review). Parsed in ONE
// place, so the banner, the field outline and the field's own message cannot
// disagree about what was refused.
export function refusedFieldsFrom(value: string | string[] | undefined): BriefFieldName[] {
  const raw = Array.isArray(value) ? value : value === undefined ? [] : value.split(",");
  const fields: BriefFieldName[] = [];
  for (const candidate of raw.flatMap((entry) => entry.split(","))) {
    const field = candidate.trim();
    if (isRefusedField(field) && !fields.includes(field)) {
      fields.push(field);
    }
  }
  return fields;
}

function limitClause(field: BriefFieldName): string {
  const bound = BRIEF_FIELD_BOUNDS[field];
  return bound.kind === "text" ? ` Keep it under ${bound.max} characters.` : ` Keep it under ${bound.max}.`;
}

function sentence(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function nameList(labels: string[]): string {
  if (labels.length <= 2) {
    return labels.join(" and ");
  }
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function refusalCopy(fields: readonly BriefFieldName[]): string {
  // "Everything else was saved" is a promise the action now keeps: the fields
  // it could not take keep the value already on record and the rest of the
  // submission is written (review finding). The copy said the opposite of what
  // the code did before, which is worse than either.
  if (fields.length === 1) {
    const field = fields[0];
    return `${sentence(REFUSAL_LABELS[field])} was too long to save, so we kept the answer you had. Everything else on this page was saved.${limitClause(field)}`;
  }

  return `${sentence(nameList(fields.map((field) => REFUSAL_LABELS[field])))} were too long to save, so we kept the answers you had. Everything else on this page was saved.`;
}

export function BriefMessage({
  message,
  refused = []
}: {
  message?: string;
  refused?: readonly BriefFieldName[];
}) {
  if (refused.length > 0) {
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

// The error treatment for each field the refusal names (design system 15.7:
// the input's bottom border becomes the error colour and the message sits
// beneath it). A banner alone marks the page and not the input that has to
// change, and on a narrow screen the two are never both visible (design
// review).
export function fieldErrorClass(field: BriefFieldName, refused: readonly BriefFieldName[]): string {
  return refused.includes(field) ? " border-error focus:border-error" : "";
}

export function FieldError({ field, refused }: { field: BriefFieldName; refused: readonly BriefFieldName[] }) {
  if (!refused.includes(field)) {
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
