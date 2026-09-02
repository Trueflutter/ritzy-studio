import type { MissingRoleEntry } from "@ritzy-studio/domain";

// The honest gap (S3, AC 9): every spec role the catalogue could not fill is a
// visible row with the reason and what to do, never hidden and never counted
// in a total. Built-in fixtures and objects with no catalogue category sit in
// the same ledger, labelled as not-for-sale rather than missing. Presentational:
// both the matching and the shopping-list screens render it.

export function missingRoleCount(entries: ReadonlyArray<MissingRoleEntry>): number {
  return entries.filter((entry) => entry.kind === "missing").length;
}

// The one-line caveat beside any completeness copy ("N of N roles chosen"):
// present only when something is missing, so a full list never reads as
// complete while a role is unsourced.
export function missingRolesCaveat(entries: ReadonlyArray<MissingRoleEntry>): string | null {
  const count = missingRoleCount(entries);
  if (count === 0) {
    return null;
  }
  return count === 1 ? "1 piece could not be sourced." : `${count} pieces could not be sourced.`;
}

export function MissingRolesSection({
  entries,
  tone = "surface"
}: {
  entries: ReadonlyArray<MissingRoleEntry>;
  tone?: "surface" | "page";
}) {
  const missing = entries.filter((entry) => entry.kind === "missing");
  const notForSale = entries.filter((entry) => entry.kind !== "missing");
  if (missing.length === 0 && notForSale.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Pieces not on this list"
      className={`border border-line ${tone === "page" ? "bg-page" : "bg-surface"} px-5 py-6 md:px-6`}
      data-testid="missing-roles"
    >
      {missing.length > 0 ? (
        <>
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
            Not sourced
          </p>
          <p className="mt-2 font-display text-display-xs font-light italic text-ink">
            {missingRolesCaveat(entries)}
          </p>
          <ul className="mt-5 divide-y divide-line border-t border-line">
            {missing.map((entry) => (
              <li className="grid gap-2 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6" data-testid="missing-role" key={entry.specKey}>
                <div>
                  <p className="font-display text-body-m italic text-ink">
                    {entry.label}
                    {entry.quantity > 1 ? (
                      <span className="ml-2 align-middle font-body text-caption-tight font-medium not-italic tracking-[0.2em] text-ink-muted">
                        × {entry.quantity}
                      </span>
                    ) : null}
                  </p>
                  {entry.category ? (
                    <p className="mt-1 font-body text-caption-tight font-medium uppercase tracking-[0.28em] text-ink-muted">
                      {entry.category.replace(/_/g, " ")}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="font-body text-body-s text-ink-secondary">{entry.reason}</p>
                  <p className="mt-1 font-display text-body-s italic text-ink-muted">{entry.guidance}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {notForSale.length > 0 ? (
        <div className={missing.length > 0 ? "mt-6" : ""}>
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
            Part of the room, nothing to buy
          </p>
          <ul className="mt-3 space-y-1">
            {notForSale.map((entry) => (
              <li className="font-body text-body-s text-ink-secondary" data-testid="not-for-sale" key={entry.specKey}>
                <span className="font-display italic text-ink">{entry.label}</span>
                {entry.quantity > 1 ? ` × ${entry.quantity}` : ""}
                {" · "}
                {entry.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
