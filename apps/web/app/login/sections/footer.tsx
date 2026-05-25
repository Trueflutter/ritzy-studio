import { ArrowRightIcon } from "./icons";

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-line bg-page text-ink">
      <div className="mx-auto max-w-[1440px] px-5 py-14 md:px-8 lg:px-12 xl:px-16">
        <div className="grid gap-10 border-b border-line pb-12 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1fr]">
          <div>
            <p className="font-display text-[1.95rem] font-light uppercase tracking-[0.2em] text-ink">
              Ritzy Studio
            </p>
            <p className="mt-5 max-w-[22rem] font-body text-body-m text-ink-muted">
              AI-assisted residential interior design for the homes and studios of Dubai. Designed quickly. Sourced for real.
            </p>
          </div>

          <FooterColumn
            heading="Product"
            links={[
              { label: "How it works", href: "#how-it-works" },
              { label: "Styles", href: "#styles" },
              { label: "Shop the room", href: "#concept-to-cart" },
              { label: "Pricing", href: "#pricing" }
            ]}
          />
          <FooterColumn
            heading="For designers"
            links={[
              { label: "Designer subscription", href: "#pricing" },
              { label: "Studio enquiries", href: "mailto:hello@ritzy.studio" },
              { label: "Sign in", href: "#access" }
            ]}
          />

          <div>
            <p className="font-body text-caption font-semibold uppercase tracking-[0.18em] text-[var(--rs-accent-deep)]">
              Stay updated
            </p>
            <p className="mt-4 max-w-[22rem] font-body text-body-s text-ink-muted">
              New style drops, retailer partnerships, and Ritzy product notes. No spam.
            </p>

            {/* NOTE: Newsletter backend not wired in this PR — visual only. */}
            <form
              className="mt-5 flex border border-line-strong bg-surface"
              action="#"
              method="post"
              onSubmit={(event) => event.preventDefault()}
            >
              <label htmlFor="footer-newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="footer-newsletter-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Email address"
                className="min-w-0 flex-1 bg-transparent px-4 font-body text-body-s text-ink placeholder:text-[var(--rs-text-placeholder)] focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex h-[44px] shrink-0 items-center gap-2 border-l border-line-strong bg-ink px-4 font-body text-caption font-semibold uppercase tracking-[0.14em] text-ink-on-dark transition-colors duration-micro ease-standard hover:bg-[var(--rs-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)]"
              >
                Join
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-7 font-body text-body-s text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Ritzy Studio. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-5">
            <a href="#" className="transition-colors duration-micro ease-standard hover:text-ink">Privacy</a>
            <a href="#" className="transition-colors duration-micro ease-standard hover:text-ink">Terms</a>
            <a href="#" className="transition-colors duration-micro ease-standard hover:text-ink">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  heading,
  links
}: {
  heading: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="font-body text-caption font-semibold uppercase tracking-[0.18em] text-[var(--rs-accent-deep)]">
        {heading}
      </p>
      <ul className="mt-4 space-y-3 font-body text-body-s text-ink-muted">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="transition-colors duration-micro ease-standard hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)]"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
