import { ButtonLink, Panel, SubmitButton, TextInput } from "@ritzy-studio/ui";
import { notFound, redirect } from "next/navigation";

import {
  createDesignerSubscriptionCheckoutAction,
  createRoomAction
} from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewRoomPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { projectId } = await params;
  const { message } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, owner_user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || project.owner_user_id !== user.id) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("intended_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.intended_mode === "unknown") {
    redirect("/onboarding");
  }

  const { data: existingRooms = [] } = await supabase
    .from("rooms")
    .select("id")
    .eq("project_id", project.id);
  const isFirstRoom = (existingRooms ?? []).length === 0;

  const isDesignerMode =
    profile.intended_mode === "designer" || profile.intended_mode === "both";

  const { data: designerAccount } = isDesignerMode
    ? await supabase
        .from("designer_accounts")
        .select("subscription_status")
        .maybeSingle()
    : { data: null };
  const designerIsSubscribed = Boolean(
    designerAccount &&
      (designerAccount.subscription_status === "active" ||
        designerAccount.subscription_status === "trialing")
  );

  const { data: ownerProjects = [] } = isDesignerMode
    ? await supabase.from("projects").select("id").eq("owner_user_id", user.id)
    : { data: [] };
  const ownerProjectIds = (ownerProjects ?? []).map((p) => p.id);
  const { count: ownerRoomCount = 0 } = isDesignerMode && ownerProjectIds.length
    ? await supabase
        .from("rooms")
        .select("id", { count: "exact", head: true })
        .in("project_id", ownerProjectIds)
    : { count: 0 };
  const designerRoomLimitReached =
    isDesignerMode && !designerIsSubscribed && (ownerRoomCount ?? 0) >= 1;

  return (
    <main className="min-h-dvh bg-page px-5 py-16 text-ink md:px-8 lg:px-16">
      <section className="mx-auto max-w-[720px]">
        <p className="font-body text-caption font-medium uppercase text-ink-muted">
          {isFirstRoom ? "N° 02 · Step 2 of 2 — First room" : "New room"}
        </p>
        <h1 className="mt-6 font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
          {isFirstRoom ? "Name the first room." : "Add a room."}
        </h1>
        <p className="mt-6 max-w-[58ch] font-body text-body-m text-ink-secondary">
          {project.name} — give the room a short name and a type, then we&apos;ll move on to
          photographs.
        </p>

        {message ? (
          <p className="mt-8 border-s border-error ps-4 font-display text-body-s italic text-error">
            {message}
          </p>
        ) : null}

        <Panel className="mt-12 rounded-card p-8 md:p-12">
          {designerRoomLimitReached ? (
            <form action={createDesignerSubscriptionCheckoutAction}>
              <input
                name="returnTo"
                type="hidden"
                value={`/projects/${project.id}/rooms/new`}
              />
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
            <form action={createRoomAction} className="space-y-2">
              <input name="projectId" type="hidden" value={project.id} />
              <TextInput
                autoComplete="off"
                id="name"
                label="Room name"
                name="name"
                narrative
                placeholder="Living room"
                required
              />
              <TextInput
                autoComplete="off"
                id="roomType"
                label="Room type"
                name="roomType"
                placeholder="Living, bedroom, dining"
                required
              />

              <div className="mt-4 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
                <ButtonLink href="/" variant="chrome">
                  {isFirstRoom ? "Add room later" : "Cancel"}
                </ButtonLink>
                <SubmitButton pendingLabel="Saving room...">Continue</SubmitButton>
              </div>
            </form>
          )}
        </Panel>
      </section>
    </main>
  );
}
