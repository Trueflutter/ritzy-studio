"use client";

import { useState } from "react";
import { SubmitButton, TextInput, cx } from "@ritzy-studio/ui";

import { signInAction, signUpAction } from "@/app/actions";

type AccessMode = "signin" | "signup";

export function AccessForm() {
  const [mode, setMode] = useState<AccessMode>("signin");

  return (
    <div className="mt-10">
      <div
        aria-label="Access mode"
        className="grid grid-cols-2 border border-line-strong"
        role="tablist"
      >
        <button
          aria-label="Returning user"
          aria-selected={mode === "signin"}
          className={modeButtonClass(mode === "signin")}
          onClick={() => setMode("signin")}
          role="tab"
          type="button"
        >
          Returning
        </button>
        <button
          aria-label="Create account"
          aria-selected={mode === "signup"}
          className={modeButtonClass(mode === "signup")}
          onClick={() => setMode("signup")}
          role="tab"
          type="button"
        >
          New user
        </button>
      </div>

      {mode === "signin" ? (
        <form action={signInAction} className="mt-10">
          <TextInput id="signin-email" label="Email" name="email" required type="email" />
          <TextInput id="signin-password" label="Password" name="password" required type="password" />
          <SubmitButton className="mt-4 w-full" pendingLabel="Signing in...">
            Sign in
          </SubmitButton>
        </form>
      ) : (
        <form action={signUpAction} className="mt-10">
          <TextInput id="signup-name" label="Name" name="name" />
          <TextInput id="signup-email" label="Email" name="email" required type="email" />
          <TextInput id="signup-password" label="Password" name="password" required type="password" />
          <SubmitButton className="mt-4 w-full" pendingLabel="Creating account...">
            Create account
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

function modeButtonClass(active: boolean) {
  return cx(
    "h-[52px] min-w-0 whitespace-nowrap border-0 border-e border-line-strong px-2 text-center font-body text-[11px] font-medium uppercase tracking-[0.18em] leading-none transition-colors duration-micro ease-standard last:border-e-0 min-[420px]:text-button focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)]",
    active
      ? "bg-[var(--rs-primary)] text-[var(--rs-surface)]"
      : "bg-transparent text-ink hover:bg-[var(--rs-surface-subtle)]"
  );
}
