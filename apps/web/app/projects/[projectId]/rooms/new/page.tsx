import { canonicalRoomTypes } from "@ritzy-studio/domain";
import {
  ButtonLink,
  DecorativeRule,
  MarketingPanel,
  Panel,
  SectionEyebrow,
  SubmitButton,
  TextInput
} from "@ritzy-studio/ui";
import { notFound, redirect } from "next/navigation";

import {
  createDesignerSubscriptionCheckoutAction,
  createRoomAction
} from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { RoomTypeSelector } from "./room-type-selector";

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
        <SectionEyebrow>{isFirstRoom ? "N° 04 — Room" : "Room"}</SectionEyebrow>
        <DecorativeRule className="mt-5" />
        <h1 className="mt-6 font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
          Set up the room.
        </h1>
        <p className="mt-6 max-w-[58ch] font-body text-body-m text-ink-secondary">
          Pick what you&apos;re designing. Photographs come next.
        </p>

        {message ? (
          <p className="mt-8 border-s border-error ps-4 font-display text-body-s italic text-error">
            {message}
          </p>
        ) : null}

        {designerRoomLimitReached ? (
          <Panel className="mt-12 rounded-card p-8 md:p-12">
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
          </Panel>
        ) : (
          <MarketingPanel tone="paper" elevation="flat" className="mt-12 p-8 md:p-12">
            <form action={createRoomAction} className="space-y-2">
              <input name="projectId" type="hidden" value={project.id} />
              <RoomTypeSelector roomTypes={canonicalRoomTypes} />
              <TextInput
                autoComplete="off"
                id="name"
                label="Label this room (optional)"
                name="name"
                narrative
                placeholder="Master bedroom"
              />

              <div className="mt-4 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
                <ButtonLink href="/" variant="chrome">
                  {isFirstRoom ? "Back to studio" : "Cancel"}
                </ButtonLink>
                <SubmitButton pendingLabel="Saving room...">Continue</SubmitButton>
              </div>
            </form>
          </MarketingPanel>
        )}
      </section>
    </main>
  );
}
