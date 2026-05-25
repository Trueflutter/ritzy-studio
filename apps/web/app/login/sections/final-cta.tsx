import Image from "next/image";
import {
  DecorativeRule,
  MarketingDisplay,
  MarketingPanel,
  Reveal
} from "@ritzy-studio/ui";

import { AURA_ASSETS } from "./assets";
import {
  BriefcaseIcon,
  HouseIcon,
  PlayIcon,
  UploadIcon
} from "./icons";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-line">
      {/* Full-bleed background */}
      <div className="absolute inset-0 z-0">
        <Image
          src={AURA_ASSETS.heroPoster}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(31,31,29,0.55)_0%,rgba(31,31,29,0.35)_45%,rgba(31,31,29,0.78)_100%)]"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1440px] px-5 pb-16 pt-24 md:px-8 lg:px-12 lg:pb-24 lg:pt-32 xl:px-16">
        {/* CTA card */}
        <Reveal>
          <MarketingPanel
            elevation="float"
            className="mx-auto max-w-[720px] px-7 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14"
          >
            <MarketingDisplay as="h2" className="mx-auto max-w-[560px] text-center">
              Design the next
              <br />
              version of your room.
            </MarketingDisplay>

            <div className="mt-7 flex justify-center">
              <DecorativeRule />
            </div>

            <p className="mx-auto mt-7 max-w-[34rem] text-center font-body text-body-l text-ink-secondary">
              Upload your room, explore multiple styles, and unlock a real shopping list — every piece sourced from a UAE retailer.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="#access"
                className="group inline-flex h-[58px] w-full items-center justify-center gap-3 border border-ink bg-ink px-9 font-body text-button-l font-semibold uppercase tracking-[0.06em] text-ink-on-dark transition-colors duration-micro ease-standard hover:bg-[var(--rs-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)] sm:w-auto sm:min-w-[230px]"
              >
                <UploadIcon className="h-5 w-5" />
                Upload your room
              </a>
              <a
                href="mailto:hello@ritzy.studio"
                className="group inline-flex h-[58px] w-full items-center justify-center gap-3 border border-line-strong bg-surface px-9 font-body text-button-l font-semibold uppercase tracking-[0.06em] text-ink transition-colors duration-micro ease-standard hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)] sm:w-auto sm:min-w-[200px]"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center border border-ink">
                  <PlayIcon className="ml-0.5 h-3.5 w-3.5" />
                </span>
                Book a walkthrough
              </a>
            </div>
          </MarketingPanel>
        </Reveal>

        {/* Audience strip — two audiences (homeowner + designer) */}
        <Reveal delay={300}>
          <MarketingPanel
            elevation="float"
            tone="ink"
            className="mx-auto mt-14 max-w-[920px] px-7 py-7 sm:px-10"
          >
            <div className="grid gap-0 lg:grid-cols-3 lg:items-center">
              <div className="px-2 lg:pr-8">
                <p className="font-display text-display-xs font-light italic leading-[1.2] tracking-[-0.015em] text-ink-on-dark">
                  &ldquo;A real shopping list is the thing every render had been missing.&rdquo;
                </p>
                <p className="mt-5 font-body text-caption font-semibold uppercase tracking-[0.18em] text-ink-on-dark-muted">
                  Voice to confirm — placeholder
                </p>
              </div>

              <AudienceCell
                icon={<HouseIcon className="h-7 w-7 text-[var(--rs-accent)]" />}
                title="For Homeowners"
                body="Design with confidence before you renovate."
              />
              <AudienceCell
                icon={<BriefcaseIcon className="h-7 w-7 text-[var(--rs-accent)]" />}
                title="For Designers"
                body="Present ideas faster — with a real list at the end."
              />
            </div>
          </MarketingPanel>
        </Reveal>
      </div>
    </section>
  );
}

function AudienceCell({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center border-t border-[rgba(242,237,228,0.18)] px-6 pt-7 text-center lg:border-l lg:border-t-0 lg:pt-0">
      {icon}
      <p className="mt-4 font-body text-body-m font-semibold uppercase tracking-[0.06em] text-ink-on-dark">
        {title}
      </p>
      <p className="mt-2 max-w-[16rem] font-body text-body-s text-ink-on-dark-muted">{body}</p>
    </div>
  );
}
