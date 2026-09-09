import { BRIEF_FIELD_BOUNDS, type BriefFieldName } from "@ritzy-studio/domain";
import { ButtonLink } from "@ritzy-studio/ui";

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

// The one refusal that names no field: a submission the schema could not read
// at all, where nothing was written and there is nothing to shorten.
//
// It travels as a CODE and the sentence is resolved here, for the same reason
// the field names are. The obvious spelling, putting the sentence in
// `?message=`, would have this PR depend on a channel that renders whatever
// text a link carries, which is the pre-existing reflection this component
// deliberately keeps out of the error treatment (security review).
const REFUSAL_CODES = {
  unreadable: "We could not read that submission, so nothing was changed. Please try again."
} as const;

export type RefusalCode = keyof typeof REFUSAL_CODES;

export function refusalCodesFrom(value: string | string[] | undefined): RefusalCode[] {
  return tokensOf(value).filter((token): token is RefusalCode =>
    Object.prototype.hasOwnProperty.call(REFUSAL_CODES, token)
  );
}

// The refusal in the URL, resolved to names this app knows. Anything else is
// dropped rather than rendered, which is what keeps the error treatment out of
// reach of whoever can put text in a link (security review). Parsed in ONE
// place, so the banner, the field outline and the field's own message cannot
// disagree about what was refused.
export function refusedFieldsFrom(value: string | string[] | undefined): BriefFieldName[] {
  const fields: BriefFieldName[] = [];
  for (const token of tokensOf(value)) {
    if (isRefusedField(token) && !fields.includes(token)) {
      fields.push(token);
    }
  }
  return fields;
}

function tokensOf(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return raw.flatMap((entry) => entry.split(",")).map((entry) => entry.trim());
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

// The limit belongs where the repair happens. On a page that marks each
// refused field, the number is on the field and the banner is the pointer; on
// a step that renders no field for it, the banner is the only place it can be
// said (design review, correctness review).
export function refusalCopy(fields: readonly BriefFieldName[], { fieldsAreMarked = false } = {}): string {
  // "Everything else was saved" is a promise the action now keeps: the fields
  // it could not take keep the value already on record and the rest of the
  // submission is written (review finding). The copy said the opposite of what
  // the code did before, which is worse than either.
  if (fields.length === 1) {
    const field = fields[0];
    return `${sentence(REFUSAL_LABELS[field])} was too long to save, so we kept the answer you had. Everything else on this page was saved.${fieldsAreMarked ? "" : limitClause(field)}`;
  }

  // Each limit is stated, not just the names: a shopper told two answers were
  // refused and given no number for either has nothing to aim at (correctness
  // review). Where the fields carry their own, this says none of them.
  const named = `${sentence(nameList(fields.map((field) => REFUSAL_LABELS[field])))} were too long to save, so we kept the answers you had. Everything else on this page was saved.`;
  if (fieldsAreMarked) {
    return named;
  }
  const limits = fields.map(
    (field) =>
      `Keep ${REFUSAL_LABELS[field]} under ${BRIEF_FIELD_BOUNDS[field].max}${BRIEF_FIELD_BOUNDS[field].kind === "text" ? " characters" : ""}.`
  );
  return `${named} ${limits.join(" ")}`;
}

export function BriefMessage({
  codes = [],
  fieldsAreMarked = false,
  message,
  refused = []
}: {
  codes?: readonly RefusalCode[];
  // Whether this page renders a `FieldError` beside each refused field. It
  // decides where the limit is said, so it is never said twice and never
  // nowhere.
  fieldsAreMarked?: boolean;
  message?: string;
  refused?: readonly BriefFieldName[];
}) {
  if (codes.length > 0) {
    return (
      <p
        className="mb-10 max-w-[65ch] border-s-2 border-error bg-surface px-4 py-3 font-body text-body-s text-ink"
        data-testid="brief-refusal"
        role="alert"
      >
        {REFUSAL_CODES[codes[0]]}
      </p>
    );
  }

  if (refused.length > 0) {
    return (
      <div
        className="mb-10 max-w-[65ch] border-s-2 border-error bg-surface px-4 py-3 font-body text-body-s text-ink"
        data-testid="brief-refusal"
        role="alert"
      >
        <p>{refusalCopy(refused, { fieldsAreMarked })}</p>
        {/* The banner sits in the first viewport and the field it names is a
            screen or more below it, so stating the remedy here without a way
            to reach it leaves her scrolling for a field she has to recognise
            from a paraphrase (design review). Every refusable field is
            rendered with its own name as its id, which
            `details-field-ids.test.ts` holds the page to. */}
        <ButtonLink className="mt-2" href={`#${refused[0]}`} trailing="→" variant="quiet">
          {refused.length > 1 ? "Go to the first" : "Go to that answer"}
        </ButtonLink>
      </div>
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
  // NOT "too long to save" on its own: what this field is showing is the
  // SHORTER answer she had, restored, and marking a visibly short value as
  // over its limit reads as nonsense (design review). The limit rides here
  // rather than in the banner, because this is where she rewrites and the
  // banner is a screen above her by then (design review, second pass).
  const bound = BRIEF_FIELD_BOUNDS[field];
  return (
    <p className="mt-[10px] font-display text-[13.5px] italic leading-[1.5] text-error">
      What you typed was too long to save, so this is the answer you had. Keep it under {bound.max}
      {bound.kind === "text" ? " characters" : ""}.
    </p>
  );
}
