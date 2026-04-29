import type { ButtonHTMLAttributes } from "react";

import { cx } from "./utils";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function Chip({ active, children, className, type = "button", ...props }: ChipProps) {
  return (
    <button
      aria-pressed={active}
      className={cx(
        "rounded-pill border px-[18px] py-2.5 font-body text-body-s transition-colors duration-micro ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)]",
        active
          ? "border-[var(--rs-primary)] bg-[var(--rs-primary)] text-[var(--rs-surface)]"
          : "border-[var(--rs-border-strong)] bg-transparent text-[var(--rs-text)] hover:border-[var(--rs-accent-deep)]",
        className
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
