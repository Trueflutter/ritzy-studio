import Image from "next/image";
import {
  DecorativeRule,
  MarketingDisplay,
  MarketingPanel,
  Reveal,
  SectionEyebrow
} from "@ritzy-studio/ui";

import { AURA_ASSETS } from "./assets";
import { ArrowRightIcon } from "./icons";

type Style = {
  name: string;
  body: string;
  image: string;
  popular?: boolean;
  variant: "large" | "compact";
};

// 4 of Ritzy's 6 styles shown on the landing — Modern, Contemporary,
// Scandinavian, Bohemian. Industrial + Traditional live in the app's full
// picker so users discover them once they're in the brief flow.
const STYLES: Style[] = [
  {
    name: "Contemporary",
    body: "Current design language. Mixed textures, curved forms, evolving palette.",
    image: AURA_ASSETS.styleContemporary,
    popular: true,
    variant: "large"
  },
  {
    name: "Modern",
    body: "Clean lines, neutral palette, intentional simplicity.",
    image: AURA_ASSETS.styleModern,
    variant: "large"
  },
  {
    name: "Scandinavian",
    body: "Light wood, soft neutrals. Cosy and quietly functional.",
    image: AURA_ASSETS.styleScandinavian,
    variant: "compact"
  },
  {
    name: "Bohemian",
    body: "Layered patterns, plants, collected pieces from many places.",
    image: AURA_ASSETS.styleBohemian,
    variant: "compact"
  }
];

export function StyleLibrary() {
  const large = STYLES.filter((style) => style.variant === "large");
  const compact = STYLES.filter((style) => style.variant === "compact");

  return (
    <section id="styles" className="border-t border-line py-20 lg:py-28">
      <div className="mx-auto grid max-w-[1440px] gap-14 px-5 md:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-20 lg:px-12 xl:px-16">
        {/* LEFT — copy + materials note */}
        <div>
          <Reveal>
            <SectionEyebrow>Style library</SectionEyebrow>
            <DecorativeRule className="mt-4" />

            <MarketingDisplay as="h2" className="mt-7 max-w-[600px]">
              Explore signature
              <br />
              design directions.
            </MarketingDisplay>

            <p className="mt-7 max-w-[32rem] font-body text-body-l text-ink-secondary">
              Four directions we lead with on the landing. Two more — Industrial and Traditional — wait in the app, so you can shape every room to the way UAE homes actually live.
            </p>

            <a
              href="#access"
              className="group mt-8 inline-flex items-center gap-3 font-body text-button font-semibold uppercase tracking-[0.18em] text-[var(--rs-accent-deep)] transition-colors duration-micro ease-standard hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)]"
            >
              Start a room
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-standard ease-standard group-hover:translate-x-1" />
            </a>
          </Reveal>

          <Reveal delay={300}>
            <MarketingPanel className="mt-14 max-w-[360px] p-6">
              <p className="font-body text-caption font-semibold uppercase tracking-[0.18em] text-ink">
                Curated material palette
              </p>
              <div className="mt-6 flex items-center gap-2.5">
                <MaterialDot gradient="radial-gradient(circle at 35% 25%, #e6dfd5, #bfb5aa)" />
                <MaterialDot gradient="linear-gradient(90deg, #786653, #b39a82, #705844)" />
                <MaterialDot gradient="radial-gradient(circle at 30% 20%, #333638, #111314)" />
                <MaterialDot gradient="radial-gradient(circle at 40% 20%, #d8ceb9, #a9967f)" />
                <MaterialDot gradient="linear-gradient(120deg, #6d452d, #b57b4d, #553722)" />
              </div>
              <div className="my-5 h-px w-full bg-line" />
              <p className="max-w-[18rem] font-body text-body-s text-ink-muted">
                Natural textures and considered finishes — tonal materials for refined room concepts.
              </p>
            </MarketingPanel>
          </Reveal>
        </div>

        {/* RIGHT — 2x3 card grid */}
        <div>
          <div className="grid gap-5 lg:grid-cols-[1.02fr_0.98fr] xl:gap-6">
            {/* Left column — 2 large cards */}
            <div className="flex flex-col gap-5">
              {large.map((style, index) => (
                <Reveal key={style.name} delay={index === 0 ? 100 : 200}>
                  <StyleCard style={style} />
                </Reveal>
              ))}
            </div>
            {/* Right column — 3 compact cards */}
            <div className="flex flex-col gap-5">
              {compact.map((style, index) => (
                <Reveal key={style.name} delay={index === 0 ? 200 : index === 1 ? 300 : 500}>
                  <StyleCard style={style} compact />
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StyleCard({ style, compact = false }: { style: Style; compact?: boolean }) {
  return (
    <article
      className={`group relative overflow-hidden border border-line bg-surface transition-shadow duration-standard ease-standard hover:shadow-marketing-float`}
    >
      <div
        className={`relative overflow-hidden border-b border-line ${
          compact ? "h-[150px]" : "h-[240px]"
        }`}
      >
        <Image
          src={style.image}
          alt={`${style.name} interior direction`}
          fill
          sizes="(min-width: 1024px) 30vw, 100vw"
          className="object-cover object-center transition-transform duration-[600ms] ease-standard group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_60%,rgba(31,31,29,0.12)_100%)]" />
      </div>

      <div className="flex items-end justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h3
              className={`font-display font-light tracking-[-0.02em] text-ink ${
                compact ? "text-display-xs" : "text-display-s"
              }`}
            >
              {style.name}
            </h3>
            {style.popular ? (
              <span className="border border-line bg-surface-subtle px-2.5 py-1 font-body text-caption-tight font-semibold uppercase tracking-[0.16em] text-[var(--rs-accent-deep)]">
                Popular
              </span>
            ) : null}
          </div>
          <p className="mt-3 max-w-[22rem] font-body text-body-s text-ink-muted">
            {style.body}
          </p>
        </div>
        <a
          href="#access"
          aria-label={`Explore ${style.name}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-line bg-surface-subtle text-[var(--rs-accent-deep)] transition-colors duration-micro ease-standard group-hover:border-[var(--rs-accent-deep)] group-hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)]"
        >
          <ArrowRightIcon className="h-4 w-4 transition-transform duration-standard ease-standard group-hover:translate-x-0.5" />
        </a>
      </div>
    </article>
  );
}

function MaterialDot({ gradient }: { gradient: string }) {
  return (
    <span
      aria-hidden
      className="h-[42px] w-[42px] rounded-full border border-line"
      style={{ background: gradient }}
    />
  );
}
