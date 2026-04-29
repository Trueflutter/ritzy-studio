import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

type ButtonVariant = "primary" | "secondary" | "accent" | "quiet" | "destructive";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  trailing?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-[var(--rs-primary)] bg-[var(--rs-primary)] text-[var(--rs-surface)] hover:bg-transparent hover:text-[var(--rs-text)] disabled:border-[var(--rs-border-strong)] disabled:bg-transparent disabled:text-[var(--rs-text-disabled)]",
  secondary:
    "border-[var(--rs-text)] bg-transparent text-[var(--rs-text)] hover:bg-[var(--rs-text)] hover:text-[var(--rs-surface)] disabled:border-[var(--rs-border-strong)] disabled:bg-transparent disabled:text-[var(--rs-text-disabled)]",
  accent:
    "border-[var(--rs-accent)] bg-[var(--rs-accent)] text-[var(--rs-primary)] hover:border-[var(--rs-accent-deep)] hover:bg-[var(--rs-accent-deep)] disabled:border-[var(--rs-border-strong)] disabled:bg-transparent disabled:text-[var(--rs-text-disabled)]",
  quiet:
    "h-auto border-transparent bg-transparent px-0 py-0 font-display text-[var(--rs-text)] italic tracking-normal hover:text-[var(--rs-accent-deep)] disabled:text-[var(--rs-text-disabled)]",
  destructive:
    "border-[var(--rs-destructive)] bg-transparent text-[var(--rs-destructive)] hover:bg-[var(--rs-destructive)] hover:text-[var(--rs-surface)] disabled:border-[var(--rs-border-strong)] disabled:bg-transparent disabled:text-[var(--rs-text-disabled)]"
};

export function Button({
  children,
  className,
  type = "button",
  variant = "primary",
  trailing,
  ...props
}: ButtonProps) {
  const isQuiet = variant === "quiet";

  return (
    <button
      className={cx(
        "inline-flex items-center justify-center border border-solid transition-colors duration-micro ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)] disabled:cursor-not-allowed",
        isQuiet
          ? "text-button-quiet"
          : "h-[52px] px-8 font-body text-button font-medium uppercase",
        variantClasses[variant],
        className
      )}
      type={type}
      {...props}
    >
      <span>{children}</span>
      {trailing ? (
        <span
          className={cx(
            "ms-2 text-[var(--rs-accent-deep)] transition-transform duration-standard ease-standard",
            isQuiet && "group-hover:translate-x-1.5"
          )}
        >
          {trailing}
        </span>
      ) : null}
    </button>
  );
}
