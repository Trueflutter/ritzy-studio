import type { ReactNode } from "react";

// The reveal's honest states (S4 step 6, design system 12.9 and 12.6): a
// render whose placement review stayed unresolved, or could not run, is shown
// with the review's findings and the way to render again, never presented as
// finished; a planned angle the consistency check could not verify is left
// out and said once; and the SKU disclaimer sits beneath every final render,
// in the exact words the design system fixes.

export const SKU_RENDER_DISCLAIMER =
  "this render is a visual approximation; product styling may vary. Refer to the shopping list for verified SKUs.";

export function RenderDisclaimer({ className }: { className?: string }) {
  return (
    <p
      className={`mt-3 font-display text-[14px] italic leading-[1.5] text-ink-on-dark-muted print:text-ink-muted ${className ?? ""}`}
      data-testid="sku-render-disclaimer"
    >
      {SKU_RENDER_DISCLAIMER}
    </p>
  );
}

export type RenderReviewOutcome = "passed" | "resolved_after_regeneration" | "unresolved" | "unreviewed" | string | null | undefined;

// The review note. Provider errors stay in the job row (the `error` prop is
// accepted and deliberately never rendered); the shopper reads what the
// review found, or that it could not run, and what to do.
export function RenderReviewNote({
  outcome,
  issues,
  correctedAttemptJudged = false,
  reason = null,
  children
}: {
  outcome: RenderReviewOutcome;
  issues: readonly string[];
  error?: string | null;
  // True only when a corrected render was produced AND judged (two recorded
  // verdicts); the headline may claim a correction only then.
  correctedAttemptJudged?: boolean;
  // Why no corrected attempt was judged, when that is the case.
  reason?: "no_time_for_retry" | string | null;
  children?: ReactNode;
}) {
  if (outcome !== "unresolved" && outcome !== "unreviewed") {
    return null;
  }
  const couldNotRun = outcome === "unreviewed";
  const headline = couldNotRun
    ? "Our placement review could not run on this render."
    : correctedAttemptJudged
      ? "We corrected it once and it still did not pass our placement review."
      : "This render did not pass our placement review.";
  const explanation = couldNotRun
    ? "The render is shown as it came back. You can render it again; your concept and shopping list are unchanged."
    : correctedAttemptJudged
      ? "The render is shown as it is, with the findings above. You can render it again; your concept and shopping list are unchanged."
      : reason === "no_time_for_retry"
        ? "There was no time left in this attempt to try a correction. The render is shown as it is, with the findings above; you can render it again, and your concept and shopping list are unchanged."
        : "A correction could not be completed. The render is shown as it is, with the findings above; you can render it again, and your concept and shopping list are unchanged.";
  return (
    <aside
      className="mt-8 border border-line-on-dark bg-[rgba(251,248,242,0.06)] px-6 py-6 text-ink-on-dark md:px-8"
      data-testid="render-review-note"
    >
      <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-accent">
        {couldNotRun ? "Placement review" : "Placement review flagged this render"}
      </p>
      <h2 className="mt-4 font-display text-[28px] font-light leading-[1.15] text-ink-on-dark">{headline}</h2>
      {!couldNotRun && issues.length > 0 ? (
        <ul className="mt-4 max-w-[60ch] list-disc space-y-2 pl-5 font-body text-body-s leading-[1.6] text-ink-on-dark-muted">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 max-w-[60ch] font-body text-body-s leading-[1.6] text-ink-on-dark-muted">{explanation}</p>
      {children ? <div className="mt-2">{children}</div> : null}
    </aside>
  );
}

// How many planned angles were judged not to be the same room and left out.
export function leftOutViewCount(viewOutcomes: unknown): number {
  if (!viewOutcomes || typeof viewOutcomes !== "object") {
    return 0;
  }
  return Object.values(viewOutcomes as Record<string, unknown>).filter(
    (entry) => entry && typeof entry === "object" && (entry as { outcome?: string }).outcome === "unresolved"
  ).length;
}

const COUNT_WORDS = ["", "One", "Two", "Three", "Four"];

export function ViewsLeftOutNote({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }
  const word = COUNT_WORDS[count] ?? String(count);
  return (
    <p className="mt-4 font-body text-body-s leading-[1.6] text-ink-on-dark-muted print:text-ink-secondary" data-testid="views-left-out">
      {count === 1
        ? `${word} planned angle could not be verified as the same room and was left out.`
        : `${word} planned angles could not be verified as the same room and were left out.`}
    </p>
  );
}
