import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

export type ButtonVariant = "primary" | "secondary" | "accent" | "quiet" | "chrome" | "destructive";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  leading?: ReactNode;
  trailing?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-[var(--rs-primary)] bg-[var(--rs-primary)] text-[var(--rs-surface)] shadow-[inset_0_0_0_1px_var(--rs-primary)] hover:border-[var(--rs-primary-hover)] hover:bg-[var(--rs-primary-hover)] disabled:border-[var(--rs-border-strong)] disabled:bg-transparent disabled:text-[var(--rs-text-disabled)] disabled:shadow-none",
  secondary:
    "border-[var(--rs-text)] bg-[var(--rs-surface)] text-[var(--rs-text)] hover:bg-[var(--rs-text)] hover:text-[var(--rs-surface)] disabled:border-[var(--rs-border-strong)] disabled:bg-transparent disabled:text-[var(--rs-text-disabled)]",
  accent:
    "border-[var(--rs-accent)] bg-[var(--rs-accent)] text-[var(--rs-primary)] hover:border-[var(--rs-accent-deep)] hover:bg-[var(--rs-accent-deep)] disabled:border-[var(--rs-border-strong)] disabled:bg-transparent disabled:text-[var(--rs-text-disabled)]",
  quiet:
    "h-auto border-transparent bg-transparent px-0 py-1 font-display text-[var(--rs-text)] italic tracking-normal hover:text-[var(--rs-accent-deep)] disabled:text-[var(--rs-text-disabled)]",
  chrome:
    "h-auto border-transparent bg-transparent px-0 py-1 font-body text-caption font-medium uppercase tracking-[0.32em] text-[var(--rs-text-muted)] hover:text-[var(--rs-text)] disabled:text-[var(--rs-text-disabled)]",
  destructive:
    "border-[var(--rs-destructive)] bg-transparent text-[var(--rs-destructive)] hover:bg-[var(--rs-destructive)] hover:text-[var(--rs-surface)] disabled:border-[var(--rs-border-strong)] disabled:bg-transparent disabled:text-[var(--rs-text-disabled)]"
};

export function Button({
  children,
  className,
  type = "button",
  variant = "primary",
  leading,
  trailing,
  ...props
}: ButtonProps) {
  const isQuiet = variant === "quiet";
  const isChrome = variant === "chrome";
  const isInline = isQuiet || isChrome;

  return (
    <button
      className={cx(
        "inline-flex items-center justify-center border border-solid leading-none transition-colors duration-micro ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)] disabled:cursor-not-allowed",
        isInline
          ? "gap-2"
          : "h-[52px] gap-3 px-8 font-body text-button font-medium uppercase",
        isQuiet && "text-button-quiet",
        variantClasses[variant],
        className
      )}
      type={type}
      {...props}
    >
      {leading ? (
        <span
          aria-hidden
          className={cx(
            "text-[var(--rs-text-muted)] transition-transform duration-standard ease-standard",
            isInline && "group-hover:-translate-x-1"
          )}
        >
          {leading}
        </span>
      ) : null}
      <span>{children}</span>
      {trailing ? (
        <span
          aria-hidden
          className={cx(
            isChrome ? "text-[var(--rs-text-muted)]" : "text-[var(--rs-accent-deep)]",
            "transition-transform duration-standard ease-standard",
            isInline && "group-hover:translate-x-1"
          )}
        >
          {trailing}
        </span>
      ) : null}
    </button>
  );
}

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function ButtonLink({
  children,
  className,
  variant = "primary",
  leading,
  trailing,
  ...props
}: ButtonLinkProps) {
  const isQuiet = variant === "quiet";
  const isChrome = variant === "chrome";
  const isInline = isQuiet || isChrome;

  return (
    <a
      className={cx(
        "group inline-flex items-center justify-center border border-solid leading-none transition-colors duration-micro ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)]",
        isInline
          ? "gap-2"
          : "h-[52px] gap-3 px-8 font-body text-button font-medium uppercase",
        isQuiet && "text-button-quiet",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {leading ? (
        <span
          aria-hidden
          className={cx(
            "transition-transform duration-standard ease-standard",
            isChrome ? "text-[var(--rs-text-muted)] group-hover:text-[var(--rs-text)]" : "text-[var(--rs-accent-deep)]",
            "group-hover:-translate-x-1"
          )}
        >
          {leading}
        </span>
      ) : null}
      <span>{children}</span>
      {trailing ? (
        <span
          aria-hidden
          className={cx(
            "transition-transform duration-standard ease-standard",
            isChrome ? "text-[var(--rs-text-muted)] group-hover:text-[var(--rs-text)]" : "text-[var(--rs-accent-deep)]",
            "group-hover:translate-x-1"
          )}
        >
          {trailing}
        </span>
      ) : null}
    </a>
  );
}
