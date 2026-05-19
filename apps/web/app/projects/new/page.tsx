import { ButtonLink, Panel, SubmitButton, TextInput } from "@ritzy-studio/ui";
import { redirect } from "next/navigation";

import {
  createDesignerSubscriptionCheckoutAction,
  createProjectWithRoomAction
} from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

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

  const { data: projects = [] } = await supabase.from("projects").select("id");
  const projectIds = (projects ?? []).map((project) => project.id);
  const { count: roomCount = 0 } = projectIds.length
    ? await supabase
        .from("rooms")
        .select("id", { count: "exact", head: true })
        .in("project_id", projectIds)
    : { count: 0 };
  const { data: designerAccount } =
    profile.intended_mode === "designer" || profile.intended_mode === "both"
      ? await supabase
          .from("designer_accounts")
          .select("subscription_status, current_period_end")
          .maybeSingle()
      : { data: null };
  const designerIsSubscribed = Boolean(
    designerAccount &&
      (designerAccount.subscription_status === "active" || designerAccount.subscription_status === "trialing")
  );
  const designerRoomLimitReached =
    (profile.intended_mode === "designer" || profile.intended_mode === "both") &&
    !designerIsSubscribed &&
    (roomCount ?? 0) >= 1;

  return (
    <main className="min-h-dvh bg-page px-5 py-16 text-ink md:px-8 lg:px-16">
      <section className="mx-auto max-w-[720px]">
        <p className="font-body text-caption font-medium uppercase text-ink-muted">
          N° 02 — New project
        </p>
        <h1 className="mt-6 font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
          Create the project.
        </h1>
        <p className="mt-6 max-w-[58ch] font-body text-body-m text-ink-secondary">
          Start with the project details, then name the first room before uploading photographs.
        </p>

        {message ? (
          <p className="mt-8 border-s border-error ps-4 font-display text-body-s italic text-error">
            {message}
          </p>
        ) : null}

        <Panel className="mt-12 p-8 md:p-12">
          {designerRoomLimitReached ? (
            <form action={createDesignerSubscriptionCheckoutAction}>
              <input name="returnTo" type="hidden" value="/projects/new" />
              <p className="font-body text-caption font-medium uppercase text-ink-muted">
                Designer plan required
              </p>
              <h2 className="mt-5 font-display text-display-s font-light italic text-ink">
                Your free room is already in progress.
              </h2>
              <p className="mt-4 font-body text-body-s text-ink-secondary">
                Designers can create one room before subscribing. Start the designer plan to add
                another client room and unlock sourcing, presentations, product swaps, and final
                renders.
              </p>
              <SubmitButton className="mt-8" pendingLabel="Opening secure checkout...">
                Start designer plan
              </SubmitButton>
            </form>
          ) : (
            <form action={createProjectWithRoomAction} className="space-y-12">
              <section>
                <p className="font-body text-caption font-medium uppercase text-ink-muted">
                  Create project
                </p>
                <div className="mt-8 space-y-3">
                  <TextInput
                    id="name"
                    label="Project name"
                    name="name"
                    narrative
                    placeholder="Al Barsha villa..."
                    required
                  />
                  <TextInput id="clientName" label="Your name" name="clientName" placeholder="Ayo Olatoye..." />
                  <TextInput id="location" label="Location" name="location" placeholder="Dubai..." />
                </div>

                <div className="mt-2 grid gap-x-8 gap-y-3 md:grid-cols-2">
                  <TextInput
                    id="budgetMinAed"
                    inputMode="numeric"
                    label="Budget minimum"
                    name="budgetMinAed"
                    placeholder="AED 35,000..."
                  />
                  <TextInput
                    id="budgetMaxAed"
                    inputMode="numeric"
                    label="Budget maximum"
                    name="budgetMaxAed"
                    placeholder="AED 100,000..."
                  />
                </div>
              </section>

              <section className="border-t border-line pt-10">
                <p className="font-body text-caption font-medium uppercase text-ink-muted">
                  Create first room
                </p>
                <div className="mt-8">
                  <TextInput
                    id="roomName"
                    label="Room name"
                    name="roomName"
                    narrative
                    placeholder="Living room..."
                    required
                  />
                  <TextInput
                    id="roomType"
                    label="Room type"
                    name="roomType"
                    placeholder="Living room..."
                    required
                  />
                </div>
              </section>

              <div className="flex flex-col-reverse gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
                <ButtonLink href="/" variant="quiet">
                  Cancel
                </ButtonLink>
                <SubmitButton pendingLabel="Creating project...">Continue</SubmitButton>
              </div>
            </form>
          )}
        </Panel>
      </section>
    </main>
  );
}
