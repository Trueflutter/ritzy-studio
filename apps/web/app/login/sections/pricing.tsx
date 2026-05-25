"use client";

import { useState } from "react";
import Image from "next/image";
import {
  DecorativeRule,
  MarketingDisplay,
  MarketingPanel,
  Reveal,
  SectionEyebrow
} from "@ritzy-studio/ui";

import { AURA_ASSETS } from "./assets";
import { ArrowRightIcon, BriefcaseIcon, CheckCircleIcon, HouseIcon } from "./icons";

type Mode = "homeowner" | "designer";

const TIERS = {
  homeowner: {
    label: "Home",
    body: "Per room. Pay only when you unlock the shopping list.",
    image: AURA_ASSETS.conceptSoftMinimal,
    price: "AED 99",
    unit: "per room",
    fineprint: "Free to design. Pay only to unlock the retailer links.",
    cta: "Start with Home",
    features: [
      "Concept generation + final grounded render",
      "Curated material palette",
      "Shopping list preview with room total",
      "Unlocked: tracked retailer links",
      "Unlocked: eligible partner discounts",
      "Substitutions within concept limits"
    ]
  },
  designer: {
    label: "Studio",
    body: "Monthly subscription for designers running multiple projects.",
    image: AURA_ASSETS.conceptEditorialSm,
    price: "AED 199",
    unit: "per month",
    fineprint: "Cancel anytime. Generous fair-use limits, monitored not capped.",
    cta: "Start with Studio",
    features: [
      "Everything in Home, across unlimited rooms",
      "Client projects + multi-room organisation",
      "Client presentations + export PDFs",
      "Priority concept renders",
      "Retailer attribution + partner discounts",
      "Substitutions + product-grounded renders"
    ]
  }
} as const;

export function Pricing() {
  const [mode, setMode] = useState<Mode>("homeowner");
  const tier = TIERS[mode];

  return (
    <section id="pricing" className="border-t border-line py-20 lg:py-28">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-5 md:px-8 lg:grid-cols-[0.52fr_1.48fr] lg:gap-16 lg:px-12 xl:gap-20 xl:px-16">
        {/* LEFT — copy column */}
        <div>
          <Reveal>
            <SectionEyebrow>Pricing</SectionEyebrow>
            <DecorativeRule className="mt-4" />

            <MarketingDisplay as="h2" className="mt-7 max-w-[420px]">
              Choose what
              <br />
              fits your project.
            </MarketingDisplay>

            <p className="mt-7 max-w-[28rem] font-body text-body-l text-ink-secondary">
              From a single room makeover to a studio of client projects — pick the path that gives you the right tools, credits, and support.
            </p>
          </Reveal>
        </div>

        {/* RIGHT — toggle + card */}
        <div>
          <Reveal>
            <div className="mb-10 flex flex-col items-center justify-center gap-3">
              <div
                role="tablist"
                aria-label="Pricing audience"
                className="inline-flex border border-line-strong bg-surface"
              >
                <ModeButton
                  active={mode === "homeowner"}
                  onClick={() => setMode("homeowner")}
                  icon={<HouseIcon className="h-4 w-4" />}
                  label="Homeowners"
                />
                <ModeButton
                  active={mode === "designer"}
                  onClick={() => setMode("designer")}
                  icon={<BriefcaseIcon className="h-4 w-4" />}
                  label="Designers"
                />
              </div>
              <p className="font-body text-body-s text-ink-muted">
                {mode === "homeowner"
                  ? "Single room? Pay per unlock."
                  : "Running multiple projects? Subscribe and go."}
              </p>
            </div>
          </Reveal>

          <Reveal delay={200} key={mode}>
            <MarketingPanel elevation="float" className="mx-auto max-w-[640px] p-8 sm:p-10">
              <div className="grid gap-8 sm:grid-cols-[1.05fr_0.95fr] sm:items-center">
                <div className="order-2 sm:order-1">
                  <p className="font-body text-caption font-semibold uppercase tracking-[0.18em] text-[var(--rs-accent-deep)]">
                    {mode === "homeowner" ? "Homeowner" : "Designer"}
                  </p>
                  <h3 className="mt-3 font-display text-display-l font-light tracking-[-0.02em] text-ink">
                    {tier.label}
                  </h3>
                  <p className="mt-3 max-w-[24rem] font-body text-body-m text-ink-secondary">
                    {tier.body}
                  </p>

                  <div className="mt-7 flex items-end gap-2">
                    <span className="font-display text-display-l font-light leading-none tracking-[-0.02em] text-ink">
                      {tier.price}
                    </span>
                    <span className="mb-1 font-body text-body-m font-semibold uppercase tracking-[0.06em] text-ink-muted">
                      {tier.unit}
                    </span>
                  </div>
                  <p className="mt-3 font-body text-body-s text-ink-muted">{tier.fineprint}</p>

                  <a
                    href="#access"
                    className="mt-7 inline-flex h-[52px] items-center justify-center gap-3 border border-ink bg-ink px-8 font-body text-button font-semibold uppercase tracking-[0.06em] text-ink-on-dark transition-colors duration-micro ease-standard hover:bg-[var(--rs-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)]"
                  >
                    {tier.cta}
                    <ArrowRightIcon className="h-4 w-4" />
                  </a>
                </div>

                <div className="order-1 sm:order-2">
                  <div className="relative aspect-[5/6] w-full overflow-hidden border border-line">
                    <Image
                      src={tier.image}
                      alt={`${tier.label} plan preview`}
                      fill
                      sizes="(min-width: 1024px) 30vw, 100vw"
                      className="object-cover object-center"
                    />
                  </div>
                </div>
              </div>

              <ul className="mt-8 grid gap-3 border-t border-line pt-7 sm:grid-cols-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 font-body text-body-s text-ink-secondary">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--rs-accent-deep)]" />
                    {feature}
                  </li>
                ))}
              </ul>
            </MarketingPanel>
          </Reveal>

          <Reveal delay={300}>
            <p
              id="for-designers"
              className="mt-10 text-center font-body text-body-s text-ink-muted"
            >
              Running a studio with a team of designers?{" "}
              <a href="mailto:hello@ritzy.studio" className="text-ink underline underline-offset-4 hover:text-[var(--rs-accent-deep)]">
                Get in touch about studio access
              </a>
              .
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex h-[52px] items-center gap-3 border-r border-line-strong px-6 font-body text-button font-semibold uppercase tracking-[0.08em] transition-colors duration-micro ease-standard last:border-r-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)] ${
        active ? "bg-ink text-ink-on-dark" : "bg-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
