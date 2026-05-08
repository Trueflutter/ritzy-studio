"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Button, type ButtonVariant } from "./button";

type SubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  pendingLabel?: ReactNode;
  variant?: ButtonVariant;
};

export function SubmitButton({
  children,
  disabled,
  pendingLabel = "Working...",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-busy={pending}
      data-pending={pending ? "true" : undefined}
      disabled={pending || disabled}
      type="submit"
      {...props}
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}
