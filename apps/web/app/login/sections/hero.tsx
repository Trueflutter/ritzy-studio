import Image from "next/image";
import {
  DecorativeRule,
  MarketingPanel,
  Reveal
} from "@ritzy-studio/ui";

import { AURA_ASSETS } from "./assets";
import {
  BadgeCheckIcon,
  PlayIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  UploadIcon
} from "./icons";

export function Hero() {
  return (
    <section id="top" className="pb-16 pt-2 lg:pb-20">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 md:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14 lg:px-12 xl:gap-16 xl:px-16">
        {/* LEFT — copy column */}
        <div className="flex min-h-[600px] flex-col justify-center lg:min-h-[680px]">
          <Reveal delay={100}>
            <h1 className="max-w-[680px] font-display font-light text-ink text-[clamp(48px,6.5vw,80px)] leading-[0.94] tracking-[-0.035em] [overflow-wrap:anywhere]">
              Design the room. Source every piece.
            </h1>

            <DecorativeRule className="mt-8" />

            <p className="mt-7 max-w-[34rem] font-body text-body-l text-ink-secondary">
              Upload a photo of your space, explore signature design directions, and generate polished concepts with a real shopping list. Every piece sourced from the UAE&rsquo;s best retailers.
            </p>

            <div className="mt-9 flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-3">
              <a
                href="#access"
                className="group inline-flex h-[62px] items-center justify-center gap-3 whitespace-nowrap border border-solid border-ink bg-ink px-7 font-body text-button-l font-semibold uppercase tracking-[0.06em] text-ink-on-dark transition-colors duration-micro ease-standard hover:bg-[var(--rs-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)]"
              >
                <UploadIcon className="h-5 w-5 shrink-0" />
                Upload your room
              </a>

              <a
                href="#how-it-works"
                className="group inline-flex h-[62px] items-center justify-center gap-3 whitespace-nowrap border border-line-strong bg-surface px-7 font-body text-button-l font-semibold uppercase tracking-[0.06em] text-ink transition-colors duration-micro ease-standard hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)]"
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center border border-ink">
                  <PlayIcon className="ml-0.5 h-3.5 w-3.5" />
                </span>
                See how it works
              </a>
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-y-6 lg:flex-nowrap">
              <HeroMetric
                icon={<ShoppingBagIcon className="h-7 w-7 text-[var(--rs-accent-deep)]" />}
                label="Sourcing"
                value="6 UAE retailers"
              />
              <span className="hidden h-12 w-px shrink-0 bg-line-strong sm:block" aria-hidden />
              <HeroMetric
                icon={<BadgeCheckIcon className="h-7 w-7 text-[var(--rs-accent-deep)]" />}
                label="Real SKUs"
                value="Live catalogues"
              />
              <span className="hidden h-12 w-px shrink-0 bg-line-strong sm:block" aria-hidden />
              <HeroMetric
                icon={<ShieldCheckIcon className="h-7 w-7 text-[var(--rs-accent-deep)]" />}
                label="Built for"
                value="UAE homes"
              />
            </div>

            <p className="mt-6 font-body text-body-s text-ink-muted">
              Designed for UAE homeowners and the design studios that serve them.
            </p>
          </Reveal>
        </div>

        {/* RIGHT — visual column */}
        <div className="relative min-h-[640px] lg:min-h-[680px]">
          <Reveal delay={300} className="relative h-full w-full">
            <div className="relative h-[560px] w-full overflow-hidden rounded-card border border-line bg-surface-subtle sm:h-[620px] lg:h-[700px]">
              <Image
                src={AURA_ASSETS.heroPoster}
                alt="Warm editorial living room — sample Ritzy concept render"
                fill
                priority
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(31,31,29,0)_55%,rgba(31,31,29,0.18)_100%)]" />
            </div>

            {/* "Before" thumbnail — top-left overlay */}
            <MarketingPanel
              elevation="float"
              className="absolute -left-3 top-6 w-[170px] p-1.5 sm:-left-5 sm:top-8 sm:w-[185px]"
            >
              <div className="relative h-[120px] w-full overflow-hidden rounded-card border border-line">
                <Image
                  src={AURA_ASSETS.beforeRoom}
                  alt="Empty room before concept render"
                  fill
                  sizes="200px"
                  className="object-cover object-center grayscale-[12%] saturate-[0.8]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />
                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 border border-line bg-surface px-2 py-1 font-body text-caption-tight font-semibold uppercase tracking-[0.16em] text-ink">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--rs-accent-deep)]" aria-hidden />
                  Before
                </span>
              </div>
            </MarketingPanel>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function HeroMetric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 pr-5 xl:pr-6">
      {icon}
      <div>
        <p className="font-body text-caption font-semibold uppercase tracking-[0.18em] text-ink-muted">
          {label}
        </p>
        <p className="mt-1.5 font-body text-body-m font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}
