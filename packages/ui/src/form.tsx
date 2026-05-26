import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes
} from "react";

import { cx } from "./utils";

export function Field({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("mb-7", className)}>{children}</div>;
}

export function Label({ children, className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cx(
        "mb-[14px] block font-body text-caption font-medium uppercase text-[var(--rs-text-muted)]",
        className
      )}
      {...props}
    >
      {children}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
  helper?: string;
  label?: string;
  narrative?: boolean;
};

export function TextInput({
  className,
  error,
  helper,
  id,
  label,
  narrative,
  ...props
}: InputProps) {
  const helperId = id && helper ? `${id}-helper` : undefined;
  return (
    <Field>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {helper ? (
        <p
          className="-mt-2 mb-3 font-body text-body-s text-[var(--rs-text-muted)]"
          id={helperId}
        >
          {helper}
        </p>
      ) : null}
      <input
        aria-describedby={helperId}
        className={cx(
          "w-full border-0 border-b border-[var(--rs-border)] bg-transparent px-0 pb-2 text-[var(--rs-text)] outline-none transition-colors duration-micro ease-standard placeholder:text-[var(--rs-text-placeholder)] hover:border-[var(--rs-border-strong)] focus:border-[var(--rs-accent-deep)] disabled:border-[var(--rs-border)] disabled:text-[var(--rs-text-disabled)]",
          narrative
            ? "font-display text-display-xs font-light italic"
            : "font-body text-body-m",
          error && "border-[var(--rs-error)]",
          className
        )}
        id={id}
        {...props}
      />
      {error ? (
        <p className="mt-2 font-body text-body-s text-[var(--rs-error)]">{error}</p>
      ) : null}
    </Field>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string;
  helper?: string;
  label?: string;
};

export function Textarea({ className, error, helper, id, label, ...props }: TextareaProps) {
  const helperId = id && helper ? `${id}-helper` : undefined;
  return (
    <Field className="mb-9">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {helper ? (
        <p
          className="-mt-2 mb-3 font-body text-body-s text-[var(--rs-text-muted)]"
          id={helperId}
        >
          {helper}
        </p>
      ) : null}
      <textarea
        aria-describedby={helperId}
        className={cx(
          "min-h-28 max-h-80 w-full resize-y border border-[var(--rs-border)] bg-transparent px-4 py-3 font-body text-body-m text-[var(--rs-text)] outline-none transition-colors duration-micro ease-standard placeholder:text-[var(--rs-text-placeholder)] hover:border-[var(--rs-border-strong)] focus:border-[var(--rs-accent-deep)] disabled:border-[var(--rs-border)] disabled:text-[var(--rs-text-disabled)]",
          error && "border-[var(--rs-error)]",
          className
        )}
        id={id}
        {...props}
      />
      {error ? (
        <p className="mt-2 font-body text-body-s text-[var(--rs-error)]">{error}</p>
      ) : null}
    </Field>
  );
}
