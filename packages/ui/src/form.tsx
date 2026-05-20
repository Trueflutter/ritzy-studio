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
  return (
    <Field>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <input
        aria-describedby={helper && !error ? `${id}-helper` : undefined}
        className={cx(
          "w-full border-0 border-b border-[var(--rs-border)] bg-transparent px-0 pb-2 text-[var(--rs-text)] outline-none transition-colors duration-micro ease-standard placeholder:font-display placeholder:font-light placeholder:italic placeholder:text-[var(--rs-text-placeholder)] hover:border-[var(--rs-border-strong)] focus:border-[var(--rs-accent-deep)] disabled:border-[var(--rs-border)] disabled:text-[var(--rs-text-disabled)]",
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
        <p className="mt-2 font-display text-body-s italic text-[var(--rs-error)]">{error}</p>
      ) : helper ? (
        <p
          className="mt-2 font-display text-body-s italic text-[var(--rs-text-helper)]"
          id={id ? `${id}-helper` : undefined}
        >
          {helper}
        </p>
      ) : null}
    </Field>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string;
  label?: string;
};

export function Textarea({ className, error, id, label, ...props }: TextareaProps) {
  return (
    <Field className="mb-9">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <textarea
        className={cx(
          "min-h-24 max-h-80 w-full resize-y border-0 border-b border-[var(--rs-border)] bg-transparent px-0 pb-2 font-body text-body-m text-[var(--rs-text)] outline-none transition-colors duration-micro ease-standard placeholder:font-display placeholder:text-display-xs placeholder:font-light placeholder:italic placeholder:text-[var(--rs-text-placeholder)] hover:border-[var(--rs-border-strong)] focus:border-[var(--rs-accent-deep)] disabled:border-[var(--rs-border)] disabled:text-[var(--rs-text-disabled)]",
          error && "border-[var(--rs-error)]",
          className
        )}
        id={id}
        {...props}
      />
      {error ? (
        <p className="mt-2 font-display text-body-s italic text-[var(--rs-error)]">{error}</p>
      ) : null}
    </Field>
  );
}
