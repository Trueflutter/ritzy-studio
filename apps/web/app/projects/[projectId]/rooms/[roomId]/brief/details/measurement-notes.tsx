// The assumption list on the brief's details screen (S5, design system 12.5).
//
// 12.5 fixes the form of this list: a hairline-bordered panel holding a
// numbered list in roman numerals, and never a tooltip. It scopes the list to
// the concept screen, behind a quiet link, because there the assumptions are a
// disclosure about a design already made. Here it is rendered inline and
// always open, because on a form the assumption is a consequence of what the
// shopper is deciding in front of it: the measurement fields are optional, and
// this is what leaving them empty means.

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"] as const;

export function MeasurementAssumptionNotes({ notes }: { notes: readonly string[] }) {
  if (notes.length === 0) {
    return null;
  }

  return (
    <div
      className="mt-5 border border-line bg-page px-5 py-4"
      data-testid="measurement-assumption-notes"
    >
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
