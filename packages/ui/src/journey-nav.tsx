import { cx } from "./utils";

export type JourneyStep = "photos" | "brief" | "concepts" | "sourcing" | "presentation";

const STEPS: ReadonlyArray<{ key: JourneyStep; label: string }> = [
  { key: "photos", label: "Photos" },
  { key: "brief", label: "Brief" },
  { key: "concepts", label: "Concepts" },
  { key: "sourcing", label: "Sourcing" },
  { key: "presentation", label: "Presentation" }
];

type JourneyNavProps = {
  /** The active step; its label is inked and underlined in brass. */
  current: JourneyStep;
  /** Appends a ✓ to completed (earlier) steps — used on the brief screen. */
  showChecks?: boolean;
  /** Paper header (default) or the ink presentation surface. */
  tone?: "paper" | "ink";
  className?: string;
};

/**
 * The studio journey breadcrumb — Photos — Brief — Concepts — Sourcing — Presentation.
 * Earlier steps read muted, the current step is inked with a brass underline, later steps
 * are disabled. Presentational and non-interactive by design (matches the prototype and
 * avoids injecting mid-flow navigation).
 */
export function JourneyNav({ current, showChecks = false, tone = "paper", className }: JourneyNavProps) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);
  const isInk = tone === "ink";

  const pastColor = isInk ? "text-[var(--rs-text-on-ink-muted)]" : "text-[var(--rs-text-subtle)]";
  const currentColor = isInk ? "text-[var(--rs-text-on-ink)]" : "text-[var(--rs-text)]";
  const futureColor = isInk ? "text-[rgba(242,237,228,0.38)]" : "text-[var(--rs-text-disabled)]";
  const dashColor = isInk ? "text-[rgba(242,237,228,0.38)]" : "text-[var(--rs-text-disabled)]";

  return (
    <nav
      aria-label={`Journey — step ${currentIndex + 1} of ${STEPS.length}`}
      className={cx("flex flex-wrap items-center gap-y-1", className)}
    >
      {STEPS.map((step, index) => {
        const isPast = index < currentIndex;
        const isCurrent = index === currentIndex;
        const color = isCurrent ? currentColor : isPast ? pastColor : futureColor;

        // Narrow screens show only the current step to avoid horizontal overflow;
        // the full breadcrumb appears from the sm breakpoint up.
        return (
          <span
            className={cx("items-center gap-2", isCurrent ? "flex" : "hidden sm:flex")}
            key={step.key}
          >
            {index > 0 ? (
              <span aria-hidden className={cx("hidden sm:inline", dashColor)}>
                —
              </span>
            ) : null}
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={cx(
                "font-body text-caption-tight font-medium uppercase tracking-[0.28em]",
                color,
                isCurrent && "border-b border-[var(--rs-accent)] pb-[2px]"
              )}
            >
              {step.label}
              {isPast && showChecks ? " ✓" : ""}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
