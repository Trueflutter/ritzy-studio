import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

export type ButtonVariant = "primary" | "secondary" | "accent" | "quiet" | "chrome" | "destructive";
export type ButtonSize = "default" | "hero";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
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

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-[52px] gap-3 px-8 font-body text-button font-medium uppercase",
  hero: "h-[62px] gap-3 px-9 font-body text-button-l font-semibold uppercase tracking-[0.06em]"
};

function leadingIconClass(variant: ButtonVariant) {
  if (variant === "chrome") return "text-[var(--rs-text-muted)] group-hover:text-[var(--rs-text)]";
  if (variant === "quiet") return "text-[var(--rs-accent-deep)]";
  return "text-inherit";
}

function trailingIconClass(variant: ButtonVariant) {
  if (variant === "chrome") return "text-[var(--rs-text-muted)] group-hover:text-[var(--rs-text)]";
  if (variant === "primary" || variant === "secondary" || variant === "accent") return "text-inherit";
  return "text-[var(--rs-accent-deep)]";
}

export function Button({
  children,
  className,
  type = "button",
  variant = "primary",
  size = "default",
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
        "group inline-flex items-center justify-center border border-solid leading-none transition-colors duration-micro ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)] disabled:cursor-not-allowed",
        isInline ? "gap-2" : sizeClasses[size],
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
            leadingIconClass(variant),
            "transition-transform duration-standard ease-standard",
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
            trailingIconClass(variant),
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
  size?: ButtonSize;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function ButtonLink({
  children,
  className,
  variant = "primary",
  size = "default",
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
        isInline ? "gap-2" : sizeClasses[size],
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
            leadingIconClass(variant),
            "transition-transform duration-standard ease-standard",
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
            trailingIconClass(variant),
            "transition-transform duration-standard ease-standard",
            "group-hover:translate-x-1"
          )}
        >
          {trailing}
        </span>
      ) : null}
    </a>
  );
}
