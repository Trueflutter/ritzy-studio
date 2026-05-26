import {
  ButtonLink,
  DecorativeRule,
  MarketingPanel,
  SectionEyebrow,
  SubmitButton,
  TextInput
} from "@ritzy-studio/ui";
import { redirect } from "next/navigation";

import { createProjectAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { MoneyInput } from "./money-input";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
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

  if (!profile || profile.intended_mode === "unknown") {
    redirect("/onboarding");
  }

  return (
    <main className="min-h-dvh bg-page px-5 py-16 text-ink md:px-8 lg:px-16">
      <section className="mx-auto max-w-[720px]">
        <SectionEyebrow>N° 03 — Project</SectionEyebrow>
        <DecorativeRule className="mt-5" />
        <h1 className="mt-6 font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
          Create the project.
        </h1>
        <p className="mt-6 max-w-[58ch] font-body text-body-m text-ink-secondary">
          A project is a single home — it can hold one room or many. Start with the basics;
          you&apos;ll add the first room next.
        </p>

        {message ? (
          <p className="mt-8 border-s border-error ps-4 font-display text-body-s italic text-error">
            {message}
          </p>
        ) : null}

        <MarketingPanel tone="paper" elevation="flat" className="mt-12 p-8 md:p-12">
          <form action={createProjectAction} className="space-y-2">
            <TextInput
              autoComplete="off"
              id="name"
              label="Project name"
              name="name"
              narrative
              placeholder="Al Barsha villa"
              required
            />
            <TextInput
              autoComplete="name"
              id="clientName"
              label="Your name"
              name="clientName"
              placeholder="Layla Hassan"
            />
            <TextInput
              autoComplete="address-level2"
              id="location"
              label="Location"
              name="location"
              placeholder="Dubai"
            />

            <div className="grid gap-x-8 md:grid-cols-2">
              <MoneyInput
                id="budgetMinAed"
                label="Budget minimum"
                name="budgetMinAed"
                placeholder="35,000"
              />
              <MoneyInput
                id="budgetMaxAed"
                label="Budget maximum"
                name="budgetMaxAed"
                placeholder="100,000"
              />
            </div>

            <div className="mt-4 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
              <ButtonLink href="/" variant="chrome">
                Cancel
              </ButtonLink>
              <SubmitButton pendingLabel="Saving project...">Continue</SubmitButton>
            </div>
          </form>
        </MarketingPanel>
      </section>
    </main>
  );
}
