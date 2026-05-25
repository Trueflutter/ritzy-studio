import Image from "next/image";
import {
  DecorativeRule,
  MarketingDisplay,
  MarketingPanel,
  Reveal
} from "@ritzy-studio/ui";

import { AURA_ASSETS, RETAILERS } from "./assets";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CheckIcon,
  PlayIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UploadIcon
} from "./icons";

export function Hero() {
  return (
    <section id="top" className="pb-16 pt-2 lg:pb-20">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 md:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 lg:px-12 lg:pl-12 xl:gap-20 xl:px-16 xl:pl-16">
        {/* LEFT — copy column */}
        <div className="flex min-h-[600px] flex-col justify-center lg:min-h-[680px] lg:pr-0">
          <Reveal delay={100}>
            <MarketingDisplay className="max-w-[640px]">
              Design the room.
              <br />
              Source every piece.
            </MarketingDisplay>

            <DecorativeRule className="mt-8" />

            <p className="mt-7 max-w-[34rem] font-body text-body-l text-ink-secondary">
              Upload a photo of your space, explore signature design directions, and generate polished concepts with a real shopping list. Every piece sourced from Dubai&rsquo;s best retailers.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <a
                href="#access"
                className="group inline-flex h-[62px] items-center justify-center gap-3 border border-solid border-ink bg-ink px-9 font-body text-button-l font-semibold uppercase tracking-[0.06em] text-ink-on-dark transition-colors duration-micro ease-standard hover:bg-[var(--rs-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)]"
              >
                <UploadIcon className="h-5 w-5" />
                Upload your room
              </a>

              <a
                href="#how-it-works"
                className="group inline-flex h-[62px] items-center justify-center gap-3 border border-line-strong bg-surface px-9 font-body text-button-l font-semibold uppercase tracking-[0.06em] text-ink transition-colors duration-micro ease-standard hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)]"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center border border-ink">
                  <PlayIcon className="ml-0.5 h-4 w-4" />
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
                icon={<ShieldCheckIcon className="h-7 w-7 text-[var(--rs-accent-deep)]" />}
                label="Tracked links"
                value="Every piece"
              />
              <span className="hidden h-12 w-px shrink-0 bg-line-strong sm:block" aria-hidden />
              <HeroMetric
                icon={<BadgeCheckIcon className="h-7 w-7 text-[var(--rs-accent-deep)]" />}
                label="Built for"
                value="Dubai homes"
              />
            </div>

            <p className="mt-6 font-body text-body-s text-ink-muted">
              Designed for Dubai homeowners and the design studios that serve them.
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
                sizes="(min-width: 1024px) 60vw, 100vw"
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

            {/* Style picker — right overlay */}
            <MarketingPanel
              elevation="float"
              as="aside"
              className="absolute right-3 top-[14%] hidden w-[238px] p-3.5 sm:right-5 sm:block sm:w-[252px]"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-body text-caption font-semibold uppercase tracking-[0.16em] text-ink">
                  Style direction
                </p>
                <span className="inline-flex h-7 w-7 items-center justify-center border border-line bg-surface-subtle text-[var(--rs-accent-deep)]">
                  <SparklesIcon className="h-3.5 w-3.5" />
                </span>
              </div>

              <ul className="space-y-2">
                <StyleOption label="Editorial Luxe" image={AURA_ASSETS.conceptEditorialSm} selected />
                <StyleOption label="Soft Minimal" image={AURA_ASSETS.conceptSoftMinimal} />
                <StyleOption label="Japandi" image={AURA_ASSETS.conceptSoftMinimal} dimmed />
                <StyleOption label="Warm Contemporary" image={AURA_ASSETS.conceptWarmContemporary} dimmed />
              </ul>

              <a
                href="#styles"
                className="mt-4 flex items-center justify-between border-t border-line pt-3 font-body text-caption font-semibold uppercase tracking-[0.16em] text-ink-muted transition-colors duration-micro ease-standard hover:text-ink"
              >
                View all styles
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </a>
            </MarketingPanel>

            {/* Retailer strip — bottom overlay (Ritzy differentiator vs Aura's materials dots) */}
            <MarketingPanel
              elevation="float"
              className="absolute bottom-5 left-4 right-4 px-4 py-4 sm:left-6 sm:right-auto sm:w-[min(72%,30rem)]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {RETAILERS.slice(0, 5).map((retailer) => (
                    <RetailerChip key={retailer.name} retailer={retailer} />
                  ))}
                </div>

                <div className="flex items-center gap-3 border-t border-line pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                  <div>
                    <p className="font-body text-caption font-semibold uppercase tracking-[0.16em] text-ink">
                      Sourced
                    </p>
                    <p className="mt-1 font-body text-caption text-ink-muted">From UAE retailers</p>
                  </div>
                  <span className="inline-flex h-7 w-7 items-center justify-center border border-line bg-surface-subtle text-[var(--rs-accent-deep)]">
                    <SparklesIcon className="h-3.5 w-3.5" />
                  </span>
                </div>
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

function StyleOption({
  label,
  image,
  selected = false,
  dimmed = false
}: {
  label: string;
  image: string;
  selected?: boolean;
  dimmed?: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-2.5 border p-2 transition-colors duration-micro ease-standard ${
        selected
          ? "border-[var(--rs-accent-deep)] bg-surface"
          : "border-line bg-surface"
      } ${dimmed ? "opacity-72" : ""}`}
    >
      <div className="relative h-[52px] w-[58px] shrink-0 overflow-hidden border border-line">
        <Image src={image} alt="" fill sizes="60px" className="object-cover object-center" />
      </div>
      <span className="min-w-0 flex-1 font-body text-caption font-semibold uppercase tracking-[0.12em] text-ink">
        {label}
      </span>
      {selected ? (
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center border border-[var(--rs-accent-deep)] text-[var(--rs-accent-deep)]">
          <CheckIcon className="h-3 w-3" />
        </span>
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden />
      )}
    </li>
  );
}

function RetailerChip({
  retailer
}: {
  retailer: { name: string; priority: "P0" | "P1"; short: string };
}) {
  // ASSET: aura-cdn / retailer-placeholder — swap to real logo SVG in follow-up PR.
  return (
    <span
      className="inline-flex items-center gap-1.5 border border-line bg-surface px-2.5 py-1 font-body text-caption-tight font-semibold uppercase tracking-[0.14em] text-ink"
      title={retailer.name}
    >
      {retailer.short}
    </span>
  );
}
