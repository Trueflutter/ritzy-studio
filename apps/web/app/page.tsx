import type { Database } from "@ritzy-studio/db";
import {
  Button,
  ButtonLink,
  DecorativeRule,
  GradientPlaceholder,
  MarketingDisplay,
  MarketingPanel,
  SectionEyebrow,
  StudioHeader,
  Tab,
  Tabs
} from "@ritzy-studio/ui";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];

export const dynamic = "force-dynamic";

function assetStoragePath(asset: unknown): string | null {
  const record = Array.isArray(asset) ? asset[0] : asset;
  if (record && typeof record === "object" && "storage_path" in record) {
    const path = (record as { storage_path?: unknown }).storage_path;
    return typeof path === "string" ? path : null;
  }
  return null;
}

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

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("intended_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.intended_mode === "unknown") {
    redirect("/onboarding");
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

  // Cover imagery — prefer a project's most recent final render, else its selected (or
  // latest) concept image. Read-only; every cover falls back to the honest gradient
  // placeholder when no render exists yet. Signed via the service client, same as the
  // room screens.
  const roomIds = rooms.map((room) => room.id);
  const serviceSupabase = createServiceClient();

  const { data: finalRenderRows = [] } = roomIds.length
    ? await supabase
        .from("room_assets")
        .select("room_id, storage_path, created_at")
        .in("room_id", roomIds)
        .eq("asset_type", "final_render")
        // Hero renders only — multi-angle views (reverse/detail) carry a view_key and
        // must never win the cover slot over the primary render.
        .is("view_key", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: conceptRows = [] } = roomIds.length
    ? await supabase
        .from("concepts")
        .select(
          "room_id, status, created_at, primary_image_asset:room_assets!concepts_primary_image_asset_id_fkey(storage_path)"
        )
        .in("room_id", roomIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const roomsByProject = new Map<string, Set<string>>();
  for (const room of rooms) {
    const set = roomsByProject.get(room.project_id) ?? new Set<string>();
    set.add(room.id);
    roomsByProject.set(room.project_id, set);
  }

  const coverByProject = new Map<string, { signedUrl: string | null; status: string | null }>();
  await Promise.all(
    projects.map(async (project) => {
      const projectRoomIds = roomsByProject.get(project.id) ?? new Set<string>();
      const finalForProject = (finalRenderRows ?? []).find((row) => projectRoomIds.has(row.room_id));
      const conceptsForProject = (conceptRows ?? []).filter((row) => projectRoomIds.has(row.room_id));
      const selectedConcept = conceptsForProject.find((row) => row.status === "selected");
      const storagePath =
        finalForProject?.storage_path ??
        assetStoragePath(selectedConcept?.primary_image_asset) ??
        assetStoragePath(conceptsForProject[0]?.primary_image_asset) ??
        null;
      const status = finalForProject?.storage_path
        ? "final render ready"
        : conceptsForProject.length > 0
          ? "concept in review"
          : projectRoomIds.size > 0
            ? "photographs pending"
            : null;

      let signedUrl: string | null = null;
      if (storagePath) {
        const { data } = await serviceSupabase.storage
          .from("generated-renders")
          .createSignedUrl(storagePath, 60 * 60);
        signedUrl = data?.signedUrl ?? null;
      }
      coverByProject.set(project.id, { signedUrl, status });
    })
  );

  const renderProjectCard = (project: Project, featured: boolean) => {
    const firstRoom = rooms.find((room) => room.project_id === project.id);
    const href = firstRoom
      ? `/projects/${project.id}/rooms/${firstRoom.id}/photos`
      : `/projects/${project.id}/rooms/new`;
    const cover = coverByProject.get(project.id);
    const roomCount = roomCountByProject[project.id] ?? 0;
    const metaParts = [
      `${roomCount} ${roomCount === 1 ? "room" : "rooms"}`,
      formatBudget(project),
      cover?.status
    ].filter(Boolean);
    const coverHeight = featured ? "h-[320px] md:h-[420px] lg:h-[520px]" : "h-[196px]";

    return (
      <Link
        className="group block bg-surface transition-colors duration-micro ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--rs-focus-ring)]"
        href={href}
        key={project.id}
      >
        <article className="flex h-full flex-col border border-line">
          <div className={`overflow-hidden border-b border-line ${coverHeight}`}>
            {cover?.signedUrl ? (
              <Image
                alt={`${project.name} — latest render`}
                className="h-full w-full object-cover"
                height={featured ? 1040 : 392}
                priority={featured}
                src={cover.signedUrl}
                unoptimized
                width={featured ? 1512 : 760}
              />
            ) : (
              <GradientPlaceholder
                caption="photographs pending"
                captionClassName={featured ? "text-[18px]" : "text-body-m"}
                className="h-full w-full"
              />
            )}
          </div>
          <div
            className={`flex flex-1 items-end justify-between gap-6 ${
              featured ? "px-8 pb-7 pt-6" : "px-6 pb-6 pt-5"
            }`}
          >
            <div>
              <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                {project.location ?? "Dubai"}
              </p>
              <h2
                className={`mt-3 font-display font-light tracking-[-0.01em] text-ink ${
                  featured ? "text-[34px] leading-[1.1]" : "text-[26px] leading-[1.1]"
                }`}
              >
                {project.name}
              </h2>
              <p className="mt-[10px] font-body text-body-s text-ink-secondary [font-feature-settings:'tnum','lnum']">
                {metaParts.join(" · ")}
              </p>
            </div>
            {featured ? (
              <span className="whitespace-nowrap font-display text-button-quiet italic text-accent-deep transition-colors duration-micro ease-standard group-hover:text-accent">
                {firstRoom ? "open project →" : "add the first room →"}
              </span>
            ) : null}
          </div>
        </article>
      </Link>
    );
  };

  const featuredProject = projects[0] ?? null;
  const railProjects = projects.slice(1, 3);
  const overflowProjects = projects.slice(3);

  return (
    <main className="min-h-dvh bg-page text-ink">
      <StudioHeader>
        <p className="hidden font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted md:block">
          work · concepts · sourcing · studio
        </p>
        <form action={signOutAction}>
          <Button type="submit" variant="chrome">
            Sign out
          </Button>
        </form>
      </StudioHeader>

      <section className="mx-auto max-w-[1440px] px-5 py-12 md:px-8 lg:px-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
              N° 01 — Studio
            </p>
            <span aria-hidden className="mt-[18px] block h-px w-14 bg-accent" />
            <h1 className="mt-[22px] font-display text-[52px] font-light leading-[0.98] tracking-[-0.015em] text-ink md:text-[68px]">
              Projects, <em className="italic">in progress</em>
            </h1>
          </div>
          <ButtonLink href="/projects/new">Begin a project</ButtonLink>
        </div>

        <div className="mt-8 flex items-center justify-between border-b border-line pb-4">
          <Tabs aria-label="Project status filters">
            <Tab active>all</Tab>
            <Tab>active</Tab>
            <Tab>archived</Tab>
          </Tabs>
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted [font-feature-settings:'tnum','lnum']">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </p>
        </div>

        {projects.length === 0 ? (
          <MarketingPanel
            as="section"
            tone="paper"
            className="mt-20 flex min-h-[420px] flex-col items-center justify-center px-8 py-16 text-center"
          >
            <SectionEyebrow>N° 02 — Begin</SectionEyebrow>
            <DecorativeRule className="mt-5" />
            <MarketingDisplay as="h2" className="mt-6 max-w-[18ch]">
              begin with a client room
            </MarketingDisplay>
            <p className="mt-6 max-w-[48ch] font-body text-body-m text-ink-secondary">
              Create a project and add the first room. Photo upload and brief capture follow in
              the next workflow slices.
            </p>
            <ButtonLink className="mt-10" href="/projects/new">
              Begin a project
            </ButtonLink>
          </MarketingPanel>
        ) : (
          <>
            <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
              {featuredProject ? renderProjectCard(featuredProject, true) : null}
              {railProjects.length > 0 ? (
                <div className="flex flex-col gap-8">
                  {railProjects.map((project) => renderProjectCard(project, false))}
                </div>
              ) : null}
            </div>
            {overflowProjects.length > 0 ? (
              <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {overflowProjects.map((project) => renderProjectCard(project, false))}
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
