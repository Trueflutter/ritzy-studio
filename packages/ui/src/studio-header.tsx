import type { ReactNode } from "react";

import { cx } from "./utils";

type StudioHeaderProps = {
  /** Right-side content — the journey breadcrumb, chrome links, or a sign-out form. */
  children?: ReactNode;
  /** Paper header (default) or the ink presentation surface. */
  tone?: "paper" | "ink";
  className?: string;
};

/**
 * The 72px studio shell header shared across every authenticated screen — the `Ri` / Ritzy
 * Studio wordmark on the left (links home) and a caller-supplied right slot. Uses a plain
 * anchor to stay framework-agnostic inside the UI package, matching `ButtonLink`.
 */
export function StudioHeader({ children, tone = "paper", className }: StudioHeaderProps) {
  const isInk = tone === "ink";

  return (
    <header
      className={cx(
        "flex h-[72px] items-center justify-between border-b px-5 md:px-8 lg:px-12",
        isInk
          ? "border-[rgba(242,237,228,0.12)] bg-transparent"
          : "border-[var(--rs-border)] bg-[var(--rs-surface)]",
        className
      )}
    >
      <a
        className="group inline-flex items-baseline gap-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)]"
        href="/"
      >
        <span
          className={cx(
            "font-display text-[26px] font-light leading-none",
            isInk ? "text-[var(--rs-text-on-ink)]" : "text-[var(--rs-text)]"
          )}
        >
          Ri
        </span>
        <span
          className={cx(
            "font-body text-caption font-medium uppercase tracking-[0.32em]",
            isInk ? "text-[var(--rs-text-on-ink-muted)]" : "text-[var(--rs-text-muted)]"
          )}
        >
          Ritzy Studio
        </span>
      </a>
      {children ? <div className="flex items-center gap-6">{children}</div> : null}
    </header>
  );
}
