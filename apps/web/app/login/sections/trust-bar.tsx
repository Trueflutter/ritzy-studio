import { Reveal } from "@ritzy-studio/ui";

// Retailer names spelled as each brand uses publicly. Order from highest
// integration priority (Home Centre is live) to broadest catalogue (IKEA).
const TRUST_BAR_RETAILERS = [
  "Home Centre",
  "Pan Home",
  "Chattels & More",
  "Crate & Barrel",
  "2XL",
  "IKEA"
];

/**
 * Trust bar — slim hairline-bounded band that names the UAE retailers Ritzy
 * sources from. Typographic treatment (DM Sans 500 uppercase, ink-muted) so
 * the names read as marks-of-trust rather than as logos competing for color.
 * Replaces the abbreviated chip strip that used to sit inside the hero.
 *
 * ASSET: aura-cdn / retailer-placeholder — when real partner logos are sourced
 * with usage rights, swap each name span for an inline SVG logo at the same
 * footprint. Until then, the typographic treatment is the canonical look.
 */
export function TrustBar() {
  return (
    <section
      aria-label="UAE retailers Ritzy sources from"
      className="border-y border-line bg-page"
    >
      <Reveal>
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-6 px-5 py-10 md:px-8 lg:flex-row lg:items-center lg:gap-10 lg:px-12 lg:py-12 xl:px-16">
          <p className="shrink-0 font-body text-caption font-semibold uppercase tracking-[0.24em] text-[var(--rs-accent-deep)] lg:max-w-[180px]">
            Sourced from
            <br className="hidden lg:block" />
            <span className="lg:hidden"> </span>
            UAE retailers
          </p>

          <div className="hidden h-10 w-px shrink-0 bg-line-strong lg:block" aria-hidden />

          <ul className="flex flex-1 flex-wrap items-center justify-center gap-x-8 gap-y-4 lg:justify-between lg:gap-x-10">
            {TRUST_BAR_RETAILERS.map((name) => (
              <li key={name}>
                <span className="font-body text-body-s font-medium uppercase tracking-[0.18em] text-ink-muted">
                  {name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
