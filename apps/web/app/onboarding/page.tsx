import { ButtonLink, Panel, SubmitButton, TextInput } from "@ritzy-studio/ui";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createDesignerSubscriptionCheckoutAction,
  createHomeownerRoomAction,
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

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("intended_mode")
    .eq("user_id", user.id)
    .maybeSingle();
  const isHomeowner = profile?.intended_mode === "homeowner";

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

      <section className="mx-auto grid max-w-[1280px] gap-12 px-5 py-12 md:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.7fr)] lg:px-12 xl:px-16">
        <div>
          <p className="font-body text-caption font-medium uppercase text-ink-muted">
            N° 01 — First use
          </p>
          <h1 className="mt-6 max-w-[780px] font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
            Tell us how you want to design.
          </h1>
          <p className="mt-6 max-w-[58ch] font-body text-body-m text-ink-secondary">
            Ritzy can stay simple for a single home room or open into a fuller client studio for
            professional work. Choose the path that matches this account.
          </p>

          {message ? (
            <p className="mt-8 border-s border-error ps-4 font-display text-body-s italic text-error">
              {message}
            </p>
          ) : null}

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Panel className="p-6">
              <p className="font-body text-caption font-medium uppercase text-ink-muted">
                Homeowner
              </p>
              <h2 className="mt-5 font-display text-display-s font-light italic text-ink">
                My own space
              </h2>
              <p className="mt-4 font-body text-body-s text-ink-secondary">
                A guided room flow with visual style choices, fewer questions, and a paid room
                unlock when the shopping plan is ready.
              </p>
              <form action={setUserModeAction} className="mt-8">
                <input name="intendedMode" type="hidden" value="homeowner" />
                <SubmitButton pendingLabel="Preparing room flow..." variant="secondary">
                  Use homeowner mode
                </SubmitButton>
              </form>
            </Panel>

            <Panel className="p-6">
              <p className="font-body text-caption font-medium uppercase text-ink-muted">
                Designer
              </p>
              <h2 className="mt-5 font-display text-display-s font-light italic text-ink">
                Client studio
              </h2>
              <p className="mt-4 font-body text-body-s text-ink-secondary">
                A professional workspace for client projects, richer briefs, product swaps,
                presentations, and the USD 99 monthly designer plan.
              </p>
              <form action={createDesignerSubscriptionCheckoutAction} className="mt-8">
                <SubmitButton pendingLabel="Opening secure checkout...">
                  Start designer plan
                </SubmitButton>
              </form>
              <form action={setUserModeAction} className="mt-5">
                <input name="intendedMode" type="hidden" value="designer" />
                <SubmitButton pendingLabel="Opening studio..." variant="quiet">
                  Continue without subscribing
                </SubmitButton>
              </form>
            </Panel>
          </div>
        </div>

        <Panel className="p-6 md:p-8">
          <p className="font-body text-caption font-medium uppercase text-ink-muted">
            Start a home room
          </p>
          <h2 className="mt-5 font-display text-display-m font-light leading-tight text-ink">
            Create the first area.
          </h2>
          <p className="mt-4 font-body text-body-s text-ink-secondary">
            This creates a simple room workspace. The next screen asks for photographs, then style
            and colour preferences.
          </p>

          <form action={createHomeownerRoomAction} className="mt-8">
            <TextInput
              id="roomName"
              label="Room name"
              name="roomName"
              narrative
              placeholder="family living room"
              required
            />
            <TextInput
              id="roomType"
              label="Room type"
              name="roomType"
              placeholder="living room"
              required
            />
            <TextInput id="location" label="Location" name="location" placeholder="Dubai" />
            <TextInput
              id="budgetMaxAed"
              inputMode="numeric"
              label="Approximate budget"
              name="budgetMaxAed"
              placeholder="AED"
            />

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-display text-body-s italic text-warning">
                Payment is not required until the shopping links and final room plan are ready.
              </p>
              <SubmitButton
                disabled={!isHomeowner && profile?.intended_mode !== "unknown" && Boolean(profile)}
                pendingLabel="Creating room..."
              >
                Continue
              </SubmitButton>
            </div>
          </form>

          {!isHomeowner && profile?.intended_mode === "designer" ? (
            <div className="mt-8 border-t border-line pt-6">
              <p className="font-body text-body-s text-ink-secondary">
                This account is currently in designer mode.
              </p>
              <ButtonLink className="mt-5" href="/" variant="secondary">
                Return to studio
              </ButtonLink>
            </div>
          ) : null}
        </Panel>
      </section>
    </main>
  );
}
