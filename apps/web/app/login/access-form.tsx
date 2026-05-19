"use client";

import { useState } from "react";
import { Button, SubmitButton, TextInput, cx } from "@ritzy-studio/ui";

import { requestPasswordResetAction, signInAction, signUpAction } from "@/app/actions";

type AccessMode = "signin" | "signup" | "reset";

export function AccessForm() {
  const [mode, setMode] = useState<AccessMode>("signin");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

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
        <form action={signInAction} className="mt-10 space-y-8">
          <TextInput
            autoComplete="email"
            id="signin-email"
            label="Email"
            name="email"
            required
            spellCheck={false}
            type="email"
          />
          <PasswordField
            id="signin-password"
            label="Password"
            name="password"
            onToggle={() => setShowSignInPassword((visible) => !visible)}
            required
            showPassword={showSignInPassword}
          />
          <div className="flex items-center justify-between gap-5">
            <button
              className="font-display text-button-quiet italic text-ink transition-colors hover:text-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)]"
              onClick={() => setMode("reset")}
              type="button"
            >
              Forgot password?
            </button>
          </div>
          <SubmitButton className="w-full" pendingLabel="Signing in...">
            Sign in
          </SubmitButton>
        </form>
      ) : mode === "reset" ? (
        <form action={requestPasswordResetAction} className="mt-10 space-y-8">
          <div>
            <p className="font-display text-display-xs font-light italic text-ink">
              Reset your password.
            </p>
            <p className="mt-3 font-body text-body-s text-ink-secondary">
              Enter your account email and we will send a secure reset link.
            </p>
          </div>
          <TextInput
            autoComplete="email"
            id="reset-email"
            label="Email"
            name="email"
            required
            spellCheck={false}
            type="email"
          />
          <div className="flex flex-col gap-4">
            <SubmitButton className="w-full" pendingLabel="Sending reset link...">
              Send reset link
            </SubmitButton>
            <Button className="w-full" onClick={() => setMode("signin")} type="button" variant="secondary">
              Back to sign in
            </Button>
          </div>
        </form>
      ) : (
        <form action={signUpAction} className="mt-10 space-y-8">
          <TextInput autoComplete="name" id="signup-name" label="Name" name="name" />
          <TextInput
            autoComplete="email"
            id="signup-email"
            label="Email"
            name="email"
            required
            spellCheck={false}
            type="email"
          />
          <PasswordField
            autoComplete="new-password"
            id="signup-password"
            label="Password"
            name="password"
            onToggle={() => setShowSignUpPassword((visible) => !visible)}
            required
            showPassword={showSignUpPassword}
          />
          <SubmitButton className="w-full" pendingLabel="Creating account...">
            Create account
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

type PasswordFieldProps = {
  autoComplete?: string;
  id: string;
  label: string;
  name: string;
  onToggle: () => void;
  required?: boolean;
  showPassword: boolean;
};

function PasswordField({
  autoComplete = "current-password",
  id,
  label,
  name,
  onToggle,
  required,
  showPassword
}: PasswordFieldProps) {
  return (
    <div>
      <label
        className="mb-[14px] block font-body text-caption font-medium uppercase text-[var(--rs-text-muted)]"
        htmlFor={id}
      >
        {label}
      </label>
      <div className="group flex items-end border-b border-[var(--rs-border-strong)] transition-colors duration-micro ease-standard focus-within:border-[var(--rs-accent-deep)]">
        <input
          autoComplete={autoComplete}
          className="min-w-0 flex-1 border-0 bg-transparent px-0 pb-4 font-body text-body-m text-[var(--rs-text)] outline-none"
          id={id}
          name={name}
          required={required}
          type={showPassword ? "text" : "password"}
        />
        <button
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="mb-3 ms-4 inline-flex size-9 items-center justify-center border border-line bg-surface text-ink-secondary transition-colors hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)]"
          onClick={onToggle}
          type="button"
        >
          <EyeIcon hidden={showPassword} />
        </button>
      </div>
    </div>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M3.75 12s2.9-5.25 8.25-5.25S20.25 12 20.25 12 17.35 17.25 12 17.25 3.75 12 3.75 12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M12 14.75A2.75 2.75 0 1 0 12 9.25a2.75 2.75 0 0 0 0 5.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      {hidden ? (
        <path
          d="m4.5 19.5 15-15"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      ) : null}
    </svg>
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
