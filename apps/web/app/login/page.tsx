import { Button, Panel, TextInput } from "@ritzy-studio/ui";
import { redirect } from "next/navigation";

import { signInAction, signUpAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  const { message } = await searchParams;

  return (
    <main className="min-h-dvh bg-page px-5 py-16 text-ink md:px-8 lg:px-16">
      <section className="mx-auto grid min-h-[calc(100dvh-128px)] max-w-[1180px] border border-line bg-surface lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col justify-between p-8 md:p-16">
          <div>
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              Ritzy Studio
            </p>
            <h1 className="mt-8 max-w-[720px] font-display text-display-xl font-light leading-[0.95] tracking-[-0.02em] text-ink">
              Quiet design work, grounded in real pieces.
            </h1>
          </div>
          <p className="mt-20 max-w-[66ch] font-body text-body-l text-ink-secondary">
            Sign in to manage client rooms, design concepts, and product-grounded project work.
          </p>
        </div>

        <Panel className="border-0 border-s border-line p-8 md:p-12">
          <p className="font-body text-caption font-medium uppercase text-ink-muted">
            Access
          </p>

          {message ? (
            <p className="mt-6 border-t border-error pt-4 font-display text-body-s italic text-error">
              {message}
            </p>
          ) : null}

          <form action={signInAction} className="mt-10">
            <TextInput id="signin-email" label="Email" name="email" required type="email" />
            <TextInput id="signin-password" label="Password" name="password" required type="password" />
            <Button className="mt-4 w-full" type="submit">
              Sign in
            </Button>
          </form>

          <div className="my-10 border-t border-line" />

          <form action={signUpAction}>
            <TextInput id="signup-name" label="Name" name="name" />
            <TextInput id="signup-email" label="Email" name="email" required type="email" />
            <TextInput id="signup-password" label="Password" name="password" required type="password" />
            <Button className="mt-4 w-full" type="submit" variant="secondary">
              Create account
            </Button>
          </form>
        </Panel>
      </section>
    </main>
  );
}
