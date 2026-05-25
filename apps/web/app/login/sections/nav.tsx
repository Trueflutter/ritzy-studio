import Link from "next/link";

export function Nav() {
  return (
    <header className="relative z-20 w-full">
      <nav className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-5 py-7 md:px-8 lg:px-12 xl:px-16">
        <Link
          className="font-display text-[1.85rem] font-light uppercase tracking-[0.2em] text-ink sm:text-[2.05rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)]"
          href="#top"
        >
          Ritzy Studio
        </Link>

        <div className="hidden items-center gap-10 font-body text-[14px] font-medium text-ink-secondary lg:flex xl:gap-12">
          <a href="#how-it-works" className="transition-colors duration-micro ease-standard hover:text-ink">
            How it works
          </a>
          <a href="#styles" className="transition-colors duration-micro ease-standard hover:text-ink">
            Styles
          </a>
          <a href="#concept-to-cart" className="transition-colors duration-micro ease-standard hover:text-ink">
            Shop the room
          </a>
          <a href="#pricing" className="transition-colors duration-micro ease-standard hover:text-ink">
            Pricing
          </a>
          <a href="#for-designers" className="transition-colors duration-micro ease-standard hover:text-ink">
            For designers
          </a>
        </div>

        <div className="flex items-center gap-5">
          <a
            href="#access"
            className="hidden font-body text-[14px] font-medium text-ink-secondary transition-colors duration-micro ease-standard hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)] sm:inline-flex"
          >
            Sign in
          </a>
          <a
            href="#access"
            className="inline-flex h-[44px] items-center justify-center border border-ink bg-ink px-6 font-body text-button font-medium uppercase tracking-[0.06em] text-ink-on-dark transition-colors duration-micro ease-standard hover:bg-[var(--rs-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)]"
          >
            Get started
          </a>
        </div>
      </nav>
    </header>
  );
}
