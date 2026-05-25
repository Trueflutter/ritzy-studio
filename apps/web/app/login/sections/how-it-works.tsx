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

const STEPS = [
  {
    n: 1,
    title: "Upload your room",
    body: "Upload a photo of your space. Good lighting helps the AI read every detail."
  },
  {
    n: 2,
    title: "Choose a style direction",
    body: "Explore curated styles and materials to shape the mood and vision of your room."
  },
  {
    n: 3,
    title: "Generate concepts",
    body: "Multiple high-quality concepts, tailored to your room and your direction."
  },
  {
    n: 4,
    title: "Refine and export",
    body: "Customize details, lock the favorite concept, and export at high resolution."
  },
  {
    n: 5,
    title: "Shop with confidence",
    body: "Unlock a real shopping list — every piece sourced from a UAE retailer, tracked end-to-end."
  }
];

export function HowItWorks() {
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

        {/* Step timeline — 5 columns on lg, stacked on mobile */}
        <Reveal delay={200}>
          <ol className="mt-14 grid gap-8 lg:grid-cols-5 lg:gap-6">
            {STEPS.map((step) => (
              <li key={step.n} className="flex items-start gap-4">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-line-strong bg-surface font-body text-body-s font-semibold text-[var(--rs-accent-deep)]">
                  {step.n.toString().padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-body text-body-m font-semibold uppercase tracking-[0.06em] text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 font-body text-body-s text-ink-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        {/* Product card mocks — 5 columns */}
        <div className="mt-14 grid gap-5 lg:grid-cols-5">
          <Reveal>
            <ProductCard title="Upload your room">
              <UploadMock />
            </ProductCard>
          </Reveal>
          <Reveal delay={100}>
            <ProductCard title="Choose a style">
              <StylePickerMock />
            </ProductCard>
          </Reveal>
          <Reveal delay={200}>
            <ProductCard title="Generate concepts">
              <ConceptsMock />
            </ProductCard>
          </Reveal>
          <Reveal delay={300}>
            <ProductCard title="Refine + export">
              <RefineMock />
            </ProductCard>
          </Reveal>
          <Reveal delay={500}>
            <ProductCard title="Shop with confidence">
              <ShoppingListMock />
            </ProductCard>
          </Reveal>
        </div>

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

function ProductCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="flex h-[420px] flex-col overflow-hidden border border-line bg-surface">
      <div className="px-4 py-3">
        <h3 className="font-body text-caption font-semibold uppercase tracking-[0.18em] text-ink">
          {title}
        </h3>
      </div>
      <div className="relative min-h-0 flex-1 border-t border-line">{children}</div>
    </article>
  );
}

function UploadMock() {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex h-[120px] flex-col items-center justify-center border border-dashed border-line-strong bg-surface-subtle">
        <UploadIcon className="h-6 w-6 text-[var(--rs-accent-deep)]" />
        <p className="mt-3 font-body text-caption text-ink-muted">Drag and drop, or browse</p>
      </div>
      <div className="relative mt-auto h-[180px] overflow-hidden border-t border-line">
        <Image
          src={AURA_ASSETS.beforeRoom}
          alt=""
          fill
          sizes="200px"
          className="object-cover object-center"
        />
        <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 border border-line bg-surface px-2.5 py-1.5 font-body text-caption-tight font-semibold uppercase tracking-[0.14em] text-ink">
          <CheckCircleIcon className="h-3.5 w-3.5 text-[var(--rs-accent-deep)]" />
          IMG_9421.jpg
        </div>
      </div>
    </div>
  );
}

function StylePickerMock() {
  const styles = [
    { name: "Editorial Luxe", image: AURA_ASSETS.conceptEditorialSm, selected: true },
    { name: "Soft Minimal", image: AURA_ASSETS.conceptSoftMinimal },
    { name: "Japandi", image: AURA_ASSETS.conceptSoftMinimal },
    { name: "Modern Organic", image: AURA_ASSETS.conceptWarmContemporary }
  ];
  return (
    <div className="flex h-full flex-col p-4">
      <ul className="flex-1 space-y-2.5">
        {styles.map((style) => (
          <li
            key={style.name}
            className={`flex items-center gap-3 border p-2 ${
              style.selected ? "border-[var(--rs-accent-deep)] bg-surface" : "border-line bg-surface-subtle"
            }`}
          >
            <div className="relative h-[42px] w-[52px] shrink-0 overflow-hidden border border-line">
              <Image src={style.image} alt="" fill sizes="60px" className="object-cover" />
            </div>
            <span className="flex-1 font-body text-caption font-semibold uppercase tracking-[0.1em] text-ink">
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
        src={AURA_ASSETS.conceptEditorial}
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
            className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-surface" : "bg-surface/50"}`}
          />
        ))}
      </div>
    </div>
  );
}

function RefineMock() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-3">
        <span className="font-body text-caption-tight font-semibold uppercase tracking-[0.14em] text-ink">
          Final concept
        </span>
        <SparklesIcon className="h-4 w-4 text-[var(--rs-accent-deep)]" />
      </div>
      <div className="relative min-h-0 flex-1">
        <Image
          src={AURA_ASSETS.conceptEditorial}
          alt=""
          fill
          sizes="(min-width: 1024px) 20vw, 50vw"
          className="object-cover object-center"
        />
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-line px-3 py-3">
        <button className="border border-line bg-surface px-2 py-1.5 font-body text-caption-tight font-semibold uppercase tracking-[0.12em] text-ink-muted">
          4K
        </button>
        <button className="border border-line bg-surface px-2 py-1.5 font-body text-caption-tight font-semibold uppercase tracking-[0.12em] text-ink-muted">
          PDF
        </button>
        <button className="border border-ink bg-ink px-2 py-1.5 font-body text-caption-tight font-semibold uppercase tracking-[0.12em] text-ink-on-dark">
          Export
        </button>
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

      <ul className="mt-3 flex-1 space-y-2">
        {RETAILERS.slice(0, 3).map((retailer) => (
          <li key={retailer.name} className="border border-line bg-surface px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-body text-caption font-semibold uppercase tracking-[0.12em] text-ink">
                {retailer.name}
              </span>
              <span className="font-body text-caption-tight text-ink-muted">3 items</span>
            </div>
            <div className="mt-1 font-body text-caption-tight text-ink-muted">
              AED <span className="font-semibold text-ink">2,480</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-line pt-3">
        <div className="flex items-center justify-between">
          <span className="font-body text-caption font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Room total
          </span>
          <span className="font-body text-body-m font-semibold text-ink">AED 8,640</span>
        </div>
        <a
          href="#access"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 border border-ink bg-ink px-3 py-2.5 font-body text-caption-tight font-semibold uppercase tracking-[0.14em] text-ink-on-dark transition-colors duration-micro ease-standard hover:bg-[var(--rs-primary-hover)]"
        >
          Unlock the list
          <ArrowRightIcon className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
