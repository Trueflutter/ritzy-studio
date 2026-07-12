import type { ReactNode } from "react";

import { cx } from "./utils";

type StepState = "done" | "active" | "todo";

export type StepRailStep = {
  numeral: ReactNode;
  label: string;
  state: StepState;
};

type StepRailProps = {
  steps: StepRailStep[];
  /** Italic Cormorant note pushed to the right — the "one thing to do here" reassurance. */
  aside?: ReactNode;
  className?: string;
};

function circleClasses(state: StepState) {
  if (state === "active") {
    return "bg-[var(--rs-primary)] text-[var(--rs-text-on-ink)] border border-[var(--rs-primary)]";
  }
  if (state === "done") {
    return "bg-[var(--rs-accent)] text-[var(--rs-text-on-ink)] border border-[var(--rs-accent)]";
  }
  return "border border-[var(--rs-border-strong)] text-[var(--rs-text-subtle)]";
}

/**
 * The two-step rail shared by the photos and brief screens — ① Add your photos → ② The brief.
 * Each step is a numbered disc (filled ink when active, brass ✓ when done, outlined when
 * upcoming) with a connector line; an optional italic aside sits to the right.
 */
export function StepRail({ steps, aside, className }: StepRailProps) {
  return (
    <div className={cx("flex flex-wrap items-center gap-x-5 gap-y-4", className)}>
      {steps.map((step, index) => (
        <div className="flex items-center gap-5" key={index}>
          {index > 0 ? (
            <span aria-hidden className="hidden h-px w-[120px] max-w-[120px] flex-1 bg-[var(--rs-border-strong)] sm:block" />
          ) : null}
          <div className="flex items-center gap-[14px]">
            <span
              className={cx(
                "inline-flex h-7 w-7 items-center justify-center rounded-full font-body text-[12px] font-medium [font-feature-settings:'tnum']",
                circleClasses(step.state)
              )}
            >
              {step.state === "done" ? "✓" : step.numeral}
            </span>
            <span
              className={cx(
                "font-body text-caption font-medium uppercase tracking-[0.28em]",
                step.state === "active" ? "text-[var(--rs-text)]" : "text-[var(--rs-text-subtle)]"
              )}
            >
              {step.label}
            </span>
          </div>
        </div>
      ))}
      {aside ? (
        <span className="font-display text-button-quiet italic text-[var(--rs-text-subtle)] sm:ml-auto">
          {aside}
        </span>
      ) : null}
    </div>
  );
}
