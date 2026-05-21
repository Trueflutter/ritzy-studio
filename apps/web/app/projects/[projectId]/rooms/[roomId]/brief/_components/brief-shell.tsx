import { ButtonLink } from "@ritzy-studio/ui";
import Link from "next/link";
import type { ReactNode } from "react";

const steps = ["Style", "Inspiration", "Details", "Questions"] as const;

export function BriefShell({
  backHref,
  children,
  currentStep,
  eyebrow,
  projectName,
  roomName,
  roomType,
  subtitle,
  title
}: {
  backHref: string;
  children: ReactNode;
  currentStep: 1 | 2 | 3 | 4;
  eyebrow: string;
  projectName: string;
  roomName: string;
  roomType: string;
  subtitle?: string;
  title?: string;
}) {
  return (
    <main className="min-h-dvh bg-page text-ink">
      <header className="flex min-h-20 items-center justify-between border-b border-line bg-surface px-5 md:px-8 lg:px-12 xl:px-16">
        <Link className="font-display text-[28px] font-light text-ink" href="/">
          Ri <span className="font-body text-caption font-medium uppercase text-ink-muted">Ritzy Studio</span>
        </Link>
        <div className="flex items-center gap-3">
          <ButtonLink href={backHref} leading="←" variant="chrome">
            Previous step
          </ButtonLink>
          <ButtonLink href="/" variant="chrome">
            Studio
          </ButtonLink>
        </div>
      </header>

      <div className="mx-auto max-w-[1040px] px-5 py-12 md:px-8 lg:px-12 xl:px-16">
        <BriefProgress currentStep={currentStep} />
        <div className="mt-12">
          <p className="font-body text-caption font-medium uppercase text-ink-muted">{eyebrow}</p>
          {title ? (
            <h1 className="mt-6 max-w-[780px] font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p className="mt-6 max-w-[640px] font-body text-body-m text-ink-secondary">{subtitle}</p>
          ) : null}
          <p className="mt-5 font-body text-body-s text-ink-muted">
            {projectName} · {roomName} · {roomType}
          </p>
        </div>

        <div className="mt-12">{children}</div>

        <div className="mt-10">
          <ButtonLink href={backHref} leading="←" variant="chrome">
            Previous step
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}

export function BriefProgress({ currentStep }: { currentStep: number }) {
  return (
    <div aria-label={`Brief step ${currentStep} of ${steps.length}`} className="flex items-center gap-4">
      {steps.map((step, index) => {
        const active = index + 1 === currentStep;
        return (
          <span className="flex items-center gap-3" key={step}>
            <span
              aria-hidden
              className={active ? "block h-px w-12 bg-ink" : "block h-px w-12 bg-line-strong"}
            />
            <span className={active ? "font-body text-caption font-medium uppercase text-ink" : "sr-only"}>
              {step}
            </span>
          </span>
        );
      })}
    </div>
  );
}
