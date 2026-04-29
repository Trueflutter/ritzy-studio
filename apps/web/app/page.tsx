import type { Database } from "@ritzy-studio/db";
import { Button, ButtonLink, Card, Tab, Tabs } from "@ritzy-studio/ui";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];

export const dynamic = "force-dynamic";

function formatBudget(project: Project) {
  if (project.budget_min_aed && project.budget_max_aed) {
    return `AED ${Number(project.budget_min_aed).toLocaleString()} – ${Number(project.budget_max_aed).toLocaleString()}`;
  }

  if (project.budget_max_aed) {
    return `up to AED ${Number(project.budget_max_aed).toLocaleString()}`;
  }

  return "budget not set";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: projectRows } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  const projects = projectRows ?? [];

  const projectIds = projects.map((project) => project.id);
  const { data: roomRows } = projectIds.length
    ? await supabase.from("rooms").select("*").in("project_id", projectIds)
    : { data: [] as Room[] };
  const rooms = roomRows ?? [];

  const roomCountByProject = rooms.reduce<Record<string, number>>((counts, room) => {
    counts[room.project_id] = (counts[room.project_id] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <main className="min-h-dvh bg-page text-ink">
      <header className="flex min-h-20 items-center justify-between border-b border-line bg-surface px-5 md:px-8 lg:px-12 xl:px-16">
        <Link className="font-display text-[28px] font-light text-ink" href="/">
          Ri <span className="font-body text-caption font-medium uppercase text-ink-muted">Ritzy Studio</span>
        </Link>
        <div className="flex items-center gap-6">
          <p className="hidden font-body text-caption font-medium uppercase text-ink-muted md:block">
            work · concepts · sourcing · studio
          </p>
          <form action={signOutAction}>
            <Button variant="quiet">sign out</Button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-[1440px] px-5 py-12 md:px-8 lg:px-12 xl:px-16">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-body text-caption font-medium uppercase text-ink-muted">N° 01 — Studio</p>
            <h1 className="mt-6 font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
              Projects, in progress
            </h1>
          </div>
          <ButtonLink href="/projects/new">Begin a project</ButtonLink>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Tabs aria-label="Project status filters">
            <Tab active>all</Tab>
            <Tab>active</Tab>
            <Tab>archived</Tab>
          </Tabs>
          <p className="font-body text-caption font-medium uppercase text-ink-muted">
            {projects.length} projects
          </p>
        </div>

        {projects.length === 0 ? (
          <section className="mt-20 flex min-h-[420px] flex-col items-center justify-center border border-dashed border-line-strong bg-surface px-8 text-center">
            <p className="font-display text-display-s font-light italic text-ink">
              begin with a client room
            </p>
            <p className="mt-5 max-w-[48ch] font-body text-body-m text-ink-secondary">
              Create a project and add the first room. Photo upload and brief capture follow in
              the next workflow slices.
            </p>
            <ButtonLink className="mt-8" href="/projects/new" trailing="→" variant="quiet">
              begin a project
            </ButtonLink>
          </section>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card className="group" key={project.id}>
                <div className="aspect-[4/3] border-b border-line bg-surface-subtle" />
                <div className="p-6">
                  <p className="font-body text-caption font-medium uppercase text-ink-muted">
                    {project.location ?? "Dubai"}
                  </p>
                  <h2 className="mt-5 font-display text-display-s font-light tracking-[-0.01em] text-ink">
                    {project.name}
                  </h2>
                  <p className="mt-4 font-body text-body-s text-ink-secondary">
                    {roomCountByProject[project.id] ?? 0} rooms · {formatBudget(project)}
                  </p>
                  <p className="mt-8 font-display text-button-quiet italic text-accent-deep">
                    open project →
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
