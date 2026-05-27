import Image from "next/image";
import {
  DecorativeRule,
  MarketingDisplay,
  MarketingPanel,
  Reveal,
  SectionEyebrow
} from "@ritzy-studio/ui";

import { AURA_ASSETS, RETAILERS } from "./assets";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UploadIcon
} from "./icons";

type Step = {
  n: number;
  title: string;
  body: string;
  visual: React.ReactNode;
  delay: 0 | 100 | 200 | 300 | 500;
};

export function HowItWorks() {
  const steps: Step[] = [
    {
      n: 1,
      title: "Upload your room",
      body: "Snap a photo of your space. Lighting helps the AI read every detail.",
      visual: <UploadMock />,
      delay: 0
    },
    {
      n: 2,
      title: "Choose a style",
      body: "Pick a direction to shape mood, palette, and feel.",
      visual: <StylePickerMock />,
      delay: 100
    },
    {
      n: 3,
      title: "Generate concepts",
      body: "Multiple high-quality renders, tailored to your room.",
      visual: <ConceptsMock />,
      delay: 200
    },
    {
      n: 4,
      title: "Refine and export",
      body: "Lock the favourite and export at high resolution.",
      visual: <RefineMock />,
      delay: 300
    },
    {
      n: 5,
      title: "Shop with confidence",
      body: "Unlock a real shopping list — every piece a UAE-retailer SKU.",
      visual: <ShoppingListMock />,
      delay: 500
    }
  ];

  return (
    <section id="how-it-works" className="border-t border-line py-20 lg:py-28">
      <div className="mx-auto max-w-[1440px] px-5 md:px-8 lg:px-12 xl:px-16">
        <Reveal>
          <div className="max-w-[720px]">
            <SectionEyebrow>How it works</SectionEyebrow>
            <DecorativeRule className="mt-4" />

            <MarketingDisplay as="h2" className="mt-7">
              From room photo
              <br />
              to ready-to-buy.
            </MarketingDisplay>

            <p className="mt-7 max-w-[36rem] font-body text-body-l text-ink-secondary">
              Ritzy transforms your space in five steps — from upload to a shopping list every retailer in the room can fulfil.
            </p>
          </div>
        </Reveal>

        {/* Integrated step grid: number + title + body + visual in one column.
            Faint vertical hairlines between adjacent columns on lg+ help the eye
            parse the five-step rhythm; on smaller widths the dividers collapse
            since the layout reflows to 2 columns / 1 column. */}
        <ol className="mt-14 grid gap-y-12 md:grid-cols-2 md:gap-x-8 lg:grid-cols-5 lg:gap-x-0">
          {steps.map((step, index) => {
            const isFirst = index === 0;
            const isLast = index === steps.length - 1;
            return (
              <Reveal key={step.n} delay={step.delay}>
                <li
                  className={[
                    "flex h-full flex-col",
                    isFirst ? "lg:pr-6" : "lg:border-l lg:border-line lg:pl-6 lg:pr-6",
                    isLast ? "lg:pr-0" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="font-body text-caption font-semibold uppercase tracking-[0.18em] text-[var(--rs-accent-deep)]">
                    {step.n.toString().padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 font-body text-body-m font-semibold uppercase tracking-[0.06em] text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 min-h-[3.5rem] font-body text-body-s text-ink-muted">{step.body}</p>
                  <div className="mt-5 h-[300px] overflow-hidden border border-line bg-surface">
                    {step.visual}
                  </div>
                </li>
              </Reveal>
            );
          })}
        </ol>

        {/* Privacy banner */}
        <Reveal delay={500}>
          <MarketingPanel className="mx-auto mt-14 max-w-[920px] px-6 py-4">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-6">
              <div className="flex items-center gap-3">
                <CheckCircleIcon className="h-6 w-6 text-[var(--rs-accent-deep)]" />
                <span className="font-body text-body-m font-semibold uppercase tracking-[0.06em] text-ink">
                  Your photos, your data
                </span>
              </div>
              <span className="hidden h-5 w-px bg-line sm:block" aria-hidden />
              <span className="font-body text-body-s text-ink-muted">
                Photos are stored privately and only used to generate your concepts.
              </span>
            </div>
          </MarketingPanel>
        </Reveal>
      </div>
    </section>
  );
}

function UploadMock() {
  return (
    <div className="relative h-full">
      <Image
        src={AURA_ASSETS.beforeRoom}
        alt=""
        fill
        sizes="(min-width: 1024px) 20vw, 50vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-x-3 top-3 flex items-center justify-center border border-dashed border-line-strong bg-surface/85 px-3 py-3 backdrop-blur-[2px]">
        <UploadIcon className="h-4 w-4 shrink-0 text-[var(--rs-accent-deep)]" />
        <span className="ml-2 font-body text-caption-tight font-semibold uppercase tracking-[0.14em] text-ink">
          Drag and drop
        </span>
      </div>
      <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 border border-line bg-surface px-2.5 py-1.5 font-body text-caption-tight font-semibold uppercase tracking-[0.14em] text-ink">
        <CheckCircleIcon className="h-3.5 w-3.5 text-[var(--rs-accent-deep)]" />
        IMG_9421.jpg
      </div>
    </div>
  );
}

function StylePickerMock() {
  const styles = [
    { name: "Contemporary", image: AURA_ASSETS.styleContemporaryThumb, selected: true },
    { name: "Modern", image: AURA_ASSETS.styleModernThumb },
    { name: "Scandinavian", image: AURA_ASSETS.styleScandinavianThumb },
    { name: "Bohemian", image: AURA_ASSETS.styleBohemianThumb }
  ];
  return (
    <div className="flex h-full flex-col p-3">
      <ul className="flex-1 space-y-2">
        {styles.map((style) => (
          <li
            key={style.name}
            className={`flex items-center gap-3 border p-1.5 ${
              style.selected
                ? "border-[var(--rs-accent-deep)] bg-surface"
                : "border-line bg-surface-subtle"
            }`}
          >
            <div className="relative h-[40px] w-[48px] shrink-0 overflow-hidden border border-line">
              <Image src={style.image} alt="" fill sizes="60px" className="object-cover" />
            </div>
            <span className="flex-1 truncate font-body text-caption font-semibold uppercase tracking-[0.1em] text-ink">
              {style.name}
            </span>
            {style.selected ? (
              <span className="inline-flex h-4 w-4 items-center justify-center border border-[var(--rs-accent-deep)] text-[var(--rs-accent-deep)]">
                <CheckIcon className="h-2.5 w-2.5" />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConceptsMock() {
  return (
    <div className="relative h-full overflow-hidden">
      <Image
        src={AURA_ASSETS.heroPoster}
        alt=""
        fill
        sizes="(min-width: 1024px) 20vw, 50vw"
        className="object-cover object-center"
      />
      <span className="absolute left-3 top-3 inline-flex items-center gap-2 border border-line bg-surface px-2.5 py-1.5 font-body text-caption-tight font-semibold uppercase tracking-[0.14em] text-ink">
        Concept 01
      </span>
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-surface" : "bg-surface/55"}`}
          />
        ))}
      </div>
    </div>
  );
}

function RefineMock() {
  return (
    <div className="relative h-full">
      <Image
        src={AURA_ASSETS.heroPoster}
        alt=""
        fill
        sizes="(min-width: 1024px) 20vw, 50vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-x-3 top-3 flex items-center justify-between border border-line bg-surface/90 px-2.5 py-1.5 backdrop-blur-[2px]">
        <span className="font-body text-caption-tight font-semibold uppercase tracking-[0.14em] text-ink">
          Final concept
        </span>
        <SparklesIcon className="h-3.5 w-3.5 text-[var(--rs-accent-deep)]" />
      </div>
      <div className="absolute inset-x-3 bottom-3 flex gap-1.5">
        <span className="inline-flex h-7 flex-1 items-center justify-center border border-line bg-surface font-body text-caption-tight font-semibold uppercase tracking-[0.14em] text-ink-muted">
          4K
        </span>
        <span className="inline-flex h-7 flex-1 items-center justify-center border border-line bg-surface font-body text-caption-tight font-semibold uppercase tracking-[0.14em] text-ink-muted">
          PDF
        </span>
        <span className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 border border-ink bg-ink font-body text-caption-tight font-semibold uppercase tracking-[0.14em] text-ink-on-dark">
          Export
        </span>
      </div>
    </div>
  );
}

function ShoppingListMock() {
  return (
    <div className="flex h-full flex-col p-3">
      <div className="flex items-center justify-between">
        <span className="font-body text-caption font-semibold uppercase tracking-[0.18em] text-ink">
          Shopping list
        </span>
        <ShoppingBagIcon className="h-4 w-4 text-[var(--rs-accent-deep)]" />
      </div>

      <ul className="mt-3 flex-1 space-y-1.5">
        {RETAILERS.slice(0, 3).map((retailer) => (
          <li key={retailer.name} className="border border-line bg-surface-subtle px-2.5 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-body text-caption-tight font-semibold uppercase tracking-[0.1em] text-ink">
                {retailer.name}
              </span>
              <span className="font-body text-caption-tight text-ink-muted">3 items</span>
            </div>
            <div className="mt-0.5 font-body text-caption-tight text-ink-muted">
              AED <span className="font-semibold text-ink">2,480</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-line pt-2.5">
        <div className="flex items-center justify-between">
          <span className="font-body text-caption-tight font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Room total
          </span>
          <span className="font-body text-body-s font-semibold text-ink">AED 8,640</span>
        </div>
        <span className="mt-2.5 inline-flex w-full items-center justify-center gap-2 border border-ink bg-ink px-2.5 py-1.5 font-body text-caption-tight font-semibold uppercase tracking-[0.14em] text-ink-on-dark">
          Unlock
          <ArrowRightIcon className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}
