export default function Home() {
  return (
    <main className="min-h-dvh bg-[var(--rs-page)] px-5 py-16 text-[var(--rs-text)] md:px-12 lg:px-16">
      <section className="mx-auto flex min-h-[calc(100dvh-128px)] max-w-6xl flex-col justify-between border border-[var(--rs-border)] bg-[var(--rs-surface)] p-8 md:p-16">
        <header className="flex items-center justify-between border-b border-[var(--rs-border)] pb-6">
          <p className="font-ui text-caption text-[var(--rs-text-muted)]">N° 001</p>
          <p className="font-ui text-caption text-[var(--rs-text-muted)]">MVP Scaffold</p>
        </header>

        <div className="max-w-3xl py-20">
          <p className="mb-6 font-ui text-caption text-[var(--rs-text-muted)]">
            Ritzy Studio
          </p>
          <h1 className="font-display text-[56px] leading-none tracking-[-0.015em] text-[var(--rs-text)] md:text-[84px]">
            Quiet Gallery workspace initialized.
          </h1>
          <p className="mt-8 max-w-2xl font-ui text-[17px] leading-[1.7] text-[var(--rs-text-secondary)]">
            The project scaffold is ready for the first implementation slice. Product UI,
            authentication flows, and AI workflows begin after the foundation is verified.
          </p>
        </div>

        <footer className="grid gap-4 border-t border-[var(--rs-border)] pt-6 font-ui text-[13.5px] leading-[1.55] text-[var(--rs-text-muted)] md:grid-cols-3">
          <p>Stack: Next.js, TypeScript, Supabase, OpenAI.</p>
          <p>Design source: Quiet Gallery.</p>
          <p>Next slice: locked tokens and app shell.</p>
        </footer>
      </section>
    </main>
  );
}
