import Image from "next/image";
import {
  DecorativeRule,
  MarketingDisplay,
  MarketingPanel,
  Reveal,
  SectionEyebrow
} from "@ritzy-studio/ui";

import { AURA_ASSETS } from "./assets";
import {
  BookmarkIcon,
  CrosshairIcon,
  LayoutIcon,
  PaletteIcon,
  ScanSearchIcon,
  ShieldCheckIcon,
  SparklesIcon
} from "./icons";

export function Philosophy() {
  return (
    <section className="border-t border-line py-20 lg:py-28">
      <div className="mx-auto grid max-w-[1440px] gap-14 px-5 md:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20 lg:px-12 xl:px-16">
        {/* LEFT — copy + quote + three points */}
        <div>
          <Reveal>
            <SectionEyebrow>Our approach</SectionEyebrow>
            <DecorativeRule className="mt-4" />

            <MarketingDisplay as="h2" className="mt-7 max-w-[640px]">
              Source the room.
              <br />
              Not just the look.
            </MarketingDisplay>

            <p className="mt-7 max-w-[34rem] font-body text-body-l text-ink-secondary">
              Ritzy exists to bring clarity to the moment a project gets real. Upload your room, explore curated directions, and see polished concepts with a real shopping list — so you can move from uncertainty to a room you can actually build.
            </p>
          </Reveal>

          <Reveal delay={200}>
            <MarketingPanel className="mt-10 max-w-[480px] px-7 py-6">
              <div className="flex gap-5">
                <span aria-hidden className="-mt-2 font-display text-[4rem] leading-none text-[var(--rs-accent-deep)]">
                  &ldquo;
                </span>
                <div>
                  <p className="font-display text-display-s font-light italic leading-[1.1] tracking-[-0.02em] text-ink">
                    AI should sharpen taste,
                    <br />
                    not replace it.
                  </p>
                  <p className="mt-5 font-body text-caption font-semibold uppercase tracking-[0.18em] text-[var(--rs-accent-deep)]">
                    — Ritzy Studio
                  </p>
                </div>
              </div>
            </MarketingPanel>
          </Reveal>

          <Reveal delay={300}>
            <div className="mt-14 grid gap-8 sm:grid-cols-3 sm:gap-6">
              <PhilosophyPoint
                icon={<CrosshairIcon className="h-7 w-7 text-[var(--rs-accent-deep)]" />}
                title="Clarity first"
                body="Turn guesswork into a confident creative direction."
              />
              <PhilosophyPoint
                icon={<BookmarkIcon className="h-7 w-7 text-[var(--rs-accent-deep)]" />}
                title="Sourced, not invented"
                body="Every piece on the list is a real SKU from a UAE retailer."
              />
              <PhilosophyPoint
                icon={<ShieldCheckIcon className="h-7 w-7 text-[var(--rs-accent-deep)]" />}
                title="Built for Dubai"
                body="Homes, clients, and budgets the region actually has."
              />
            </div>
          </Reveal>
        </div>

        {/* RIGHT — image collage + AI guidance card */}
        <div className="relative min-h-[600px] lg:min-h-[720px]">
          <Reveal delay={200}>
            {/* Back slab */}
            <div className="absolute right-[8%] top-0 z-0 hidden h-[260px] w-[300px] overflow-hidden border border-line bg-surface-subtle lg:block">
              <div className="h-full w-full bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.6),transparent_30%),radial-gradient(circle_at_72%_72%,rgba(140,106,62,0.12),transparent_40%),linear-gradient(135deg,#e6dfd5,#bfb5aa)]" />
            </div>

            {/* Main image */}
            <div className="absolute left-0 top-12 z-10 h-[460px] w-full overflow-hidden border border-line bg-surface-subtle sm:h-[520px] sm:w-[78%] lg:left-0 lg:w-[80%]">
              <Image
                src={AURA_ASSETS.conceptEditorial}
                alt="Editorial-direction interior concept"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(31,31,29,0.18),transparent_50%,rgba(255,255,255,0.04))]" />
            </div>

            {/* AI guidance card */}
            <MarketingPanel
              elevation="float"
              className="absolute right-0 top-16 z-20 w-[280px] sm:right-3 sm:w-[300px] lg:right-0"
            >
              <div className="flex items-center justify-between px-5 py-4">
                <p className="font-body text-caption font-semibold uppercase tracking-[0.18em] text-ink">
                  AI guidance
                </p>
                <span className="inline-flex h-7 w-7 items-center justify-center border border-line bg-surface-subtle text-[var(--rs-accent-deep)]">
                  <SparklesIcon className="h-3.5 w-3.5" />
                </span>
              </div>
              <GuidanceItem
                icon={<ScanSearchIcon className="h-4 w-4" />}
                label="Style signals"
                value="Warm minimalism"
              />
              <GuidanceItem
                icon={<PaletteIcon className="h-4 w-4" />}
                label="Palette match"
                value="Earthy neutrals"
              />
              <GuidanceItem
                icon={<LayoutIcon className="h-4 w-4" />}
                label="Spatial balance"
                value="Open, calm, inviting"
              />
            </MarketingPanel>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function PhilosophyPoint({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div>
      {icon}
      <h3 className="mt-4 font-body text-body-m font-semibold uppercase tracking-[0.06em] text-ink">
        {title}
      </h3>
      <p className="mt-3 font-body text-body-s text-ink-muted">{body}</p>
    </div>
  );
}

function GuidanceItem({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border-t border-line px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-line bg-surface-subtle text-[var(--rs-accent-deep)]">
          {icon}
        </span>
        <div>
          <p className="font-body text-caption font-semibold uppercase tracking-[0.16em] text-ink">
            {label}
          </p>
          <p className="mt-0.5 font-body text-caption text-ink-muted">{value}</p>
        </div>
      </div>
    </div>
  );
}
