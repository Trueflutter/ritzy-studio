import Image from "next/image";
import {
  DecorativeRule,
  MarketingDisplay,
  MarketingPanel,
  Reveal,
  SectionEyebrow
} from "@ritzy-studio/ui";

import { AURA_ASSETS } from "./assets";
import { ArrowRightIcon, ShieldCheckIcon, ShoppingBagIcon } from "./icons";

// Static placeholder counts for the shopping-list pane. Real counts will come
// from the live shopping-list API once that section is wired beyond /login.
const RETAILER_GROUPS: { name: string; count: number }[] = [
  { name: "Home Centre", count: 4 },
  { name: "IKEA", count: 3 },
  { name: "Crate & Barrel", count: 2 },
  { name: "2XL", count: 2 }
];

// Retailer names spelled the way each brand uses publicly — matches the
// top-of-page trust bar so the same six names reappear in the same order.
const RETAILER_NAMES = [
  "Home Centre",
  "Pan Home",
  "Chattels & More",
  "Crate & Barrel",
  "2XL",
  "IKEA"
];

/**
 * REPLACES Aura template Section 05 "AI Intelligence" with the Ritzy
 * differentiator: every concept render lands as a real shopping list,
 * grouped by UAE retailer, with tracked outbound links.
 */
export function FromConceptToCart() {
  return (
    <section
      id="concept-to-cart"
      className="border-t border-line bg-surface-subtle py-20 lg:py-28"
    >
      <div className="mx-auto max-w-[1440px] px-5 md:px-8 lg:px-12 xl:px-16">
        <Reveal>
          <div className="max-w-[720px]">
            <SectionEyebrow>From concept to cart</SectionEyebrow>
            <DecorativeRule className="mt-4" />

            <MarketingDisplay as="h2" className="mt-7">
              From the render.
              <br />
              Straight to the cart.
            </MarketingDisplay>

            <p className="mt-7 max-w-[38rem] font-body text-body-l text-ink-secondary">
              Every Ritzy concept lands as a real shopping list — grouped by retailer, priced in dirhams, with tracked outbound links and eligible partner discounts. No more matching renders to SKUs by hand.
            </p>
          </div>
        </Reveal>

        {/* 3-pane visual: room → render → retailer-grouped list */}
        <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-3 lg:gap-6">
          <Reveal>
            <PaneCard label="Step 1 · Room photo">
              <div className="relative h-[280px] overflow-hidden border-b border-line lg:h-[320px]">
                <Image
                  src={AURA_ASSETS.beforeRoom}
                  alt="Empty room photograph"
                  fill
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="object-cover object-center"
                />
              </div>
              <p className="px-5 py-4 font-body text-body-s text-ink-muted">
                Snap a photo. Lighting matters. Empty or furnished works.
              </p>
            </PaneCard>
          </Reveal>

          <Reveal delay={200}>
            <PaneCard label="Step 2 · Concept render">
              <div className="relative h-[280px] overflow-hidden border-b border-line lg:h-[320px]">
                <Image
                  src={AURA_ASSETS.conceptEditorial}
                  alt="Generated concept render"
                  fill
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="object-cover object-center"
                />
              </div>
              <p className="px-5 py-4 font-body text-body-s text-ink-muted">
                AI-generated, photo-grounded. The room you can actually build.
              </p>
            </PaneCard>
          </Reveal>

          <Reveal delay={300}>
            <PaneCard label="Step 3 · Shopping list">
              <div className="flex h-[280px] flex-col gap-2 border-b border-line bg-surface p-4 lg:h-[320px]">
                {RETAILER_GROUPS.map((group) => (
                  <div
                    key={group.name}
                    className="flex items-center justify-between border border-line bg-surface-subtle px-3 py-2"
                  >
                    <div>
                      <p className="font-body text-caption font-semibold uppercase tracking-[0.12em] text-ink">
                        {group.name}
                      </p>
                      <p className="mt-0.5 font-body text-caption-tight text-ink-muted">
                        {group.count} pieces &middot; tracked link
                      </p>
                    </div>
                    <ArrowRightIcon className="h-4 w-4 text-[var(--rs-accent-deep)]" />
                  </div>
                ))}
                <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
                  <span className="font-body text-caption font-semibold uppercase tracking-[0.14em] text-ink-muted">
                    Room total
                  </span>
                  <span className="font-body text-body-m font-semibold text-ink">AED 8,640</span>
                </div>
              </div>
              <p className="px-5 py-4 font-body text-body-s text-ink-muted">
                Grouped by retailer. Open each, buy in their flow.
              </p>
            </PaneCard>
          </Reveal>
        </div>

        {/* Retailer logo strip — full names, ink-muted typography. Same six
            retailers as the top-of-page trust bar but spread across with more
            breathing room since this is the section that explains the model. */}
        <Reveal delay={300}>
          <MarketingPanel className="mt-14 px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
              <div className="lg:max-w-[260px]">
                <p className="font-body text-caption font-semibold uppercase tracking-[0.18em] text-[var(--rs-accent-deep)]">
                  Sourced from
                </p>
                <p className="mt-3 font-display text-display-xs font-light tracking-[-0.01em] text-ink">
                  UAE retailers Ritzy knows.
                </p>
              </div>
              <ul className="grid flex-1 grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-6">
                {RETAILER_NAMES.map((name) => (
                  <li key={name} className="flex items-center justify-center text-center">
                    {/* ASSET: aura-cdn / retailer-placeholder — swap each name span
                        for an SVG logo at the same footprint when partner brand
                        assets land. Until then, typographic treatment is canonical. */}
                    <span className="font-body text-body-s font-medium uppercase tracking-[0.18em] text-ink-muted">
                      {name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </MarketingPanel>
        </Reveal>

        {/* Trust strip */}
        <Reveal delay={500}>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
            <TrustItem
              icon={<ShoppingBagIcon className="h-6 w-6 text-[var(--rs-accent-deep)]" />}
              title="Real SKUs"
              body="Every product is a live retailer SKU — no fabricated catalogue."
            />
            <TrustItem
              icon={<ShieldCheckIcon className="h-6 w-6 text-[var(--rs-accent-deep)]" />}
              title="Buy where you trust"
              body="Each piece opens in its retailer's flow — Home Centre, IKEA, the rest. No middleman cart."
            />
            <TrustItem
              icon={<ArrowRightIcon className="h-6 w-6 text-[var(--rs-accent-deep)]" />}
              title="Eligible discounts"
              body="Where partners offer codes, Ritzy surfaces them — only when honest."
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function PaneCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <article className="flex h-full flex-col overflow-hidden border border-line bg-surface">
      <div className="border-b border-line px-5 py-3">
        <p className="font-body text-caption font-semibold uppercase tracking-[0.18em] text-[var(--rs-accent-deep)]">
          {label}
        </p>
      </div>
      {children}
    </article>
  );
}

function TrustItem({
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
      <h3 className="mt-3 font-body text-body-m font-semibold uppercase tracking-[0.06em] text-ink">
        {title}
      </h3>
      <p className="mt-2 font-body text-body-s text-ink-muted">{body}</p>
    </div>
  );
}
