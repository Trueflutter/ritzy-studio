import {
  DecorativeRule,
  MarketingDisplay,
  MarketingPanel,
  Reveal,
  SectionEyebrow
} from "@ritzy-studio/ui";

import { AccessForm } from "../access-form";

type AccessProps = {
  message?: string;
};

/**
 * The auth section sits below the hero (plan option B). Gives the existing
 * AccessForm room to breathe instead of competing with the hero's overlays.
 * Reuses the AccessForm component verbatim — no auth-flow changes in this PR.
 */
export function Access({ message }: AccessProps) {
  return (
    <section id="access" className="border-t border-line bg-surface-subtle py-20 lg:py-28">
      <div className="mx-auto grid max-w-[1180px] gap-12 px-5 md:px-8 lg:grid-cols-[1fr_minmax(360px,420px)] lg:gap-16 lg:px-12 xl:px-16">
        <div>
          <Reveal>
            <SectionEyebrow>Begin</SectionEyebrow>
            <DecorativeRule className="mt-4" />

            <MarketingDisplay as="h2" className="mt-7 max-w-[520px]">
              One photo
              <br />
              away from yes.
            </MarketingDisplay>

            <p className="mt-7 max-w-[34rem] font-body text-body-l text-ink-secondary">
              Create an account to upload your first room. Existing users sign in to pick up where the last project left off — concepts, shopping lists, presentations, all still there.
            </p>

            <ul className="mt-8 space-y-3 font-body text-body-s text-ink-secondary">
              <li className="flex items-start gap-3">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--rs-accent-deep)]" />
                Free to design. Pay only when you unlock the retailer links.
              </li>
              <li className="flex items-start gap-3">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--rs-accent-deep)]" />
                Your photos stay private. We only use them to generate concepts.
              </li>
              <li className="flex items-start gap-3">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--rs-accent-deep)]" />
                Designers — your studio mode unlocks at sign-up.
              </li>
            </ul>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <MarketingPanel elevation="float" className="p-8 sm:p-10">
            <p className="font-body text-caption font-semibold uppercase tracking-[0.18em] text-[var(--rs-accent-deep)]">
              Access
            </p>

            {message ? (
              <p className="mt-6 border-t border-error pt-4 font-display text-body-m italic text-error">
                {message}
              </p>
            ) : null}

            <AccessForm />
          </MarketingPanel>
        </Reveal>
      </div>
    </section>
  );
}
