import { Panel, SubmitButton } from "@ritzy-studio/ui";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  setUserModeAction,
  signOutAction
} from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-dvh bg-page text-ink">
      <header className="flex min-h-20 items-center justify-between border-b border-line bg-surface px-5 md:px-8 lg:px-12 xl:px-16">
        <Link className="font-display text-[28px] font-light text-ink" href="/">
          Ri <span className="font-body text-caption font-medium uppercase text-ink-muted">Ritzy Studio</span>
        </Link>
        <form action={signOutAction}>
          <SubmitButton pendingLabel="Signing out..." variant="quiet">
            sign out
          </SubmitButton>
        </form>
      </header>

      <section className="mx-auto max-w-[1120px] px-5 py-12 md:px-8 lg:px-12 xl:px-16">
        <div className="max-w-[780px]">
          <p className="font-body text-caption font-medium uppercase text-ink-muted">
            N° 01 — First use
          </p>
          <h1 className="mt-6 max-w-[780px] font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
            Tell us how you want to design.
          </h1>
          <p className="mt-6 max-w-[58ch] font-body text-body-m text-ink-secondary">
            Ritzy can stay simple for a single home room or open into a fuller client studio for
            professional work. Choose the path that matches this account, then create the first
            room on the next screen.
          </p>

          {message ? (
            <p className="mt-8 border-s border-error ps-4 font-display text-body-s italic text-error">
              {message}
            </p>
          ) : null}

          <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2">
            <Panel className="flex h-full flex-col p-8">
              <p className="font-body text-caption font-medium uppercase text-ink-muted">
                Homeowner
              </p>
              <h2 className="mt-5 font-display text-display-s font-light italic text-ink">
                My own space
              </h2>
              <p className="mt-4 font-body text-body-s text-ink-secondary">
                Create one personal room, shape the brief, and unlock shopping links only when the
                plan is ready.
              </p>
              <form action={setUserModeAction} className="mt-auto pt-10">
                <input name="intendedMode" type="hidden" value="homeowner" />
                <SubmitButton className="w-full" pendingLabel="Preparing room flow..." variant="secondary">
                  Homeowner mode
                </SubmitButton>
              </form>
            </Panel>

            <Panel className="flex h-full flex-col p-8">
              <p className="font-body text-caption font-medium uppercase text-ink-muted">
                Designer
              </p>
              <h2 className="mt-5 font-display text-display-s font-light italic text-ink">
                Client studio
              </h2>
              <p className="mt-4 font-body text-body-s text-ink-secondary">
                Create one client room, shape the brief, and subscribe only when sourcing is ready.
              </p>
              <form action={setUserModeAction} className="mt-auto pt-10">
                <input name="intendedMode" type="hidden" value="designer" />
                <SubmitButton className="w-full" pendingLabel="Preparing studio...">
                  Designer mode
                </SubmitButton>
              </form>
            </Panel>
          </div>
        </div>
      </section>
    </main>
  );
}
