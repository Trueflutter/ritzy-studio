"use client";

import { TextInput } from "@ritzy-studio/ui";
import { useState, type InputHTMLAttributes } from "react";

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "defaultValue"
> & {
  label?: string;
  defaultValue?: string | number;
};

function groupThousands(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("en-US") : "";
}

export function MoneyInput({ defaultValue, ...props }: MoneyInputProps) {
  const [value, setValue] = useState(() => groupThousands(String(defaultValue ?? "")));

  return (
    <TextInput
      {...props}
      className="tabular-nums"
      inputMode="numeric"
      onChange={(event) => setValue(groupThousands(event.target.value))}
      value={value}
    />
  );
}
