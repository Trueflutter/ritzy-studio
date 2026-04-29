import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

export function Tabs({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("flex items-center gap-6", className)} role="tablist" {...props}>
      {children}
    </div>
  );
}

export function Tab({
  active,
  children,
  className
}: {
  active?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      aria-selected={active}
      className={cx(
        "relative pb-2 font-body text-button font-medium lowercase text-[var(--rs-text-muted)] transition-colors duration-standard ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)]",
        "after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:origin-left after:bg-[var(--rs-text)] after:transition-transform after:duration-standard after:ease-standard",
        active
          ? "text-[var(--rs-text)] after:scale-x-100"
          : "after:scale-x-0 hover:text-[var(--rs-text)] hover:after:scale-x-100",
        className
      )}
      role="tab"
      type="button"
    >
      {children}
    </button>
  );
}

export function SegmentedControl({
  options,
  value,
  className
}: {
  options: string[];
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "grid overflow-hidden border border-[var(--rs-border-strong)]",
        className
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option === value;

        return (
          <button
            aria-pressed={active}
            className={cx(
              "h-[52px] border-e border-[var(--rs-border-strong)] px-4 font-body text-button font-medium uppercase last:border-e-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)]",
              active
                ? "bg-[var(--rs-primary)] text-[var(--rs-surface)]"
                : "bg-transparent text-[var(--rs-text)]"
            )}
            key={option}
            type="button"
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
