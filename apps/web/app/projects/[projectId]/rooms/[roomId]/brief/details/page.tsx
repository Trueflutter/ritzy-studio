import { ButtonLink, SubmitButton } from "@ritzy-studio/ui";
import { notFound, redirect } from "next/navigation";

import { saveDesignBriefAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { BriefShell } from "../_components/brief-shell";
import { FloorPlanUploader } from "../floor-plan-uploader";

export const dynamic = "force-dynamic";

export default async function BriefDetailsPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string; roomId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { projectId, roomId } = await params;
  const { message } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  if (!project || !room) {
    notFound();
  }

  const { data: designBrief } = await supabase
    .from("design_briefs")
    .select("*")
    .eq("room_id", roomId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: floorPlan } = await supabase
    .from("room_assets")
    .select("*")
    .eq("room_id", roomId)
    .eq("asset_type", "floor_plan")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const inspirationAnalysis = inspirationAnalysisFromStructuredJson(designBrief?.structured_json);
  const selectedStyles = selectedStylesFromStructuredJson(designBrief?.structured_json);
  const palette = palettePlaceholder(inspirationAnalysis);
  const colorNotes = designBrief?.color_notes?.trim() ?? "";
  const colorNotesValue = colorNotes || palette;
  const colorPrefilled = !colorNotes && palette.length > 0;

  return (
    <BriefShell
      backHref={`/projects/${projectId}/rooms/${roomId}/brief/inspiration`}
      currentStep={3}
      eyebrow="N° 06 — Details"
      projectName={project.name}
      roomName={room.name}
      roomType={room.room_type}
      subtitle="Review the design notes, then add the room measurements we need to size the furniture honestly."
      title="Complete the design brief."
    >
      {message ? (
        <p className="mb-10 border border-line bg-surface px-4 py-3 font-body text-body-s text-ink-secondary">
          {message}
        </p>
      ) : null}

      <form action={saveDesignBriefAction}>
        <input name="projectId" type="hidden" value={projectId} />
        <input name="roomId" type="hidden" value={roomId} />
        <input name="roomType" type="hidden" value={room.room_type} />
        <input name="briefStep" type="hidden" value="details" />
        <input
          name="budgetNotes"
          type="hidden"
          value={project.budget_max_aed ? `AED ${Number(project.budget_max_aed).toLocaleString("en-AE")} maximum` : ""}
        />

        <div className="flex flex-col gap-4">
          {selectedStyles.liked.length > 0 ? (
            <div className="border border-line bg-surface p-5">
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-body text-caption font-medium uppercase text-ink-muted">
                  Style — from earlier
                </p>
                <ButtonLink
                  href={`/projects/${projectId}/rooms/${roomId}/brief/style`}
                  trailing="→"
                  variant="quiet"
                >
                  change
                </ButtonLink>
              </div>
              <p className="mt-2 font-body text-body-m text-ink">{selectedStyles.liked.join(", ")}</p>
              {selectedStyles.avoided.length > 0 ? (
                <p className="mt-1 font-body text-body-s text-ink-muted">
                  Avoiding: {selectedStyles.avoided.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {colorPrefilled ? (
            <div className="border border-line bg-surface p-5">
              <label
                className="block font-body text-caption font-medium uppercase text-ink-muted"
                htmlFor="colorNotes"
              >
                Colour preferences — pulled from your inspiration
              </label>
              <textarea
                className="mt-3 block min-h-[64px] w-full resize-y border-0 bg-transparent p-0 font-body text-body-m text-ink outline-none placeholder:text-[var(--rs-text-placeholder)]"
                defaultValue={colorNotesValue}
                id="colorNotes"
                name="colorNotes"
              />
            </div>
          ) : (
            <div className="border border-line bg-surface p-5">
              <label className="block font-body text-body-l text-ink" htmlFor="colorNotes">
                Which colours do you want, and any to avoid?
              </label>
              <textarea
                className="mt-4 block min-h-[88px] w-full resize-y border-0 bg-transparent p-0 font-body text-body-m text-ink outline-none placeholder:text-[var(--rs-text-placeholder)]"
                defaultValue=""
                id="colorNotes"
                name="colorNotes"
                placeholder="warm neutrals, brushed brass, deep walnut; nothing cold or grey..."
              />
            </div>
          )}

          <div className="border border-line bg-surface p-5">
            <label className="block font-body text-body-l text-ink" htmlFor="functionalRequirements">
              What does this room need to do day to day?
            </label>
            <textarea
              className="mt-4 block min-h-[88px] w-full resize-y border-0 bg-transparent p-0 font-body text-body-m text-ink outline-none placeholder:text-[var(--rs-text-placeholder)]"
              defaultValue={designBrief?.functional_requirements ?? ""}
              id="functionalRequirements"
              name="functionalRequirements"
              placeholder="seating for six, child-safe finishes, blackout curtains, storage for toys..."
            />
          </div>

          <div className="border border-line bg-surface p-5">
            <label className="block font-body text-body-l text-ink" htmlFor="avoidNotes">
              Anything we should keep out of the design?
            </label>
            <textarea
              className="mt-4 block min-h-[88px] w-full resize-y border-0 bg-transparent p-0 font-body text-body-m text-ink outline-none placeholder:text-[var(--rs-text-placeholder)]"
              defaultValue={designBrief?.avoid_notes ?? ""}
              id="avoidNotes"
              name="avoidNotes"
              placeholder="no glass coffee table, no high-pile rug, avoid visible brass..."
            />
          </div>

          <div className="border border-line bg-surface p-5">
            <label className="block font-body text-body-l text-ink" htmlFor="inspirationNotes">
              Anything else about your references — what to copy, what to ignore?
            </label>
            <textarea
              className="mt-4 block min-h-[88px] w-full resize-y border-0 bg-transparent p-0 font-body text-body-m text-ink outline-none placeholder:text-[var(--rs-text-placeholder)]"
              defaultValue={designBrief?.inspiration_notes ?? ""}
              id="inspirationNotes"
              name="inspirationNotes"
              placeholder="copy the calm of the second image; ignore the dark wall..."
            />
          </div>
        </div>

        <section className="mt-12">
          <h2 className="font-display text-display-xs font-light tracking-[-0.01em] text-ink">
            Measurements
            <span className="ml-3 align-middle font-body text-caption font-medium uppercase tracking-wider text-ink-helper">
              · Required
            </span>
          </h2>
          <p className="mt-4 max-w-[72ch] font-body text-body-s text-ink-muted">
            Add the main wall, room depth, and ceiling height before moving ahead. These dimensions keep
            sofa, table, chair, lighting, and rug recommendations from becoming misleading.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="border border-line bg-surface p-5">
              <label className="block font-body text-body-l text-ink" htmlFor="wallLengthCm">
                Main wall cm
              </label>
              <p className="mt-2 font-body text-body-s text-ink-muted">
                The longest usable wall in the room.
              </p>
              <input
                aria-required="true"
                className="mt-4 block w-full border-0 border-b border-[var(--rs-border)] bg-transparent px-0 pb-2 font-body text-body-m text-ink outline-none transition-colors duration-micro ease-standard placeholder:text-[var(--rs-text-placeholder)] focus:border-[var(--rs-accent-deep)]"
                defaultValue={measurements?.wall_length_cm ?? ""}
                id="wallLengthCm"
                min="1"
                name="wallLengthCm"
                placeholder="520"
                required
                type="number"
              />
            </div>
            <div className="border border-line bg-surface p-5">
              <label className="block font-body text-body-l text-ink" htmlFor="roomDepthCm">
                Room depth cm
              </label>
              <p className="mt-2 font-body text-body-s text-ink-muted">
                From that wall to the opposite side.
              </p>
              <input
                aria-required="true"
                className="mt-4 block w-full border-0 border-b border-[var(--rs-border)] bg-transparent px-0 pb-2 font-body text-body-m text-ink outline-none transition-colors duration-micro ease-standard placeholder:text-[var(--rs-text-placeholder)] focus:border-[var(--rs-accent-deep)]"
                defaultValue={measurements?.room_depth_cm ?? ""}
                id="roomDepthCm"
                min="1"
                name="roomDepthCm"
                placeholder="410"
                required
                type="number"
              />
            </div>
            <div className="border border-line bg-surface p-5">
              <label className="block font-body text-body-l text-ink" htmlFor="ceilingHeightCm">
                Ceiling cm
              </label>
              <p className="mt-2 font-body text-body-s text-ink-muted">
                Your best measured ceiling height.
              </p>
              <input
                aria-required="true"
                className="mt-4 block w-full border-0 border-b border-[var(--rs-border)] bg-transparent px-0 pb-2 font-body text-body-m text-ink outline-none transition-colors duration-micro ease-standard placeholder:text-[var(--rs-text-placeholder)] focus:border-[var(--rs-accent-deep)]"
                defaultValue={measurements?.ceiling_height_cm ?? ""}
                id="ceilingHeightCm"
                min="1"
                name="ceilingHeightCm"
                placeholder="290"
                required
                type="number"
              />
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-display-xs font-light tracking-[-0.01em] text-ink">
            Floor plan
            <span className="ml-3 align-middle font-body text-caption font-medium uppercase tracking-wider text-ink-helper">
              · Optional
            </span>
          </h2>
          <p className="mt-4 max-w-[72ch] font-body text-body-s text-ink-muted">
            If you have a plan, upload it here as a reference. Project-level floor-plan extraction and
            room labels are the next measurement upgrade.
          </p>
          <div className="mt-6">
            <FloorPlanUploader existingStoragePath={floorPlan?.storage_path} roomId={roomId} userId={user.id} />
          </div>
        </section>

        <div className="mt-12 flex justify-end border-t border-line pt-8">
          <SubmitButton pendingLabel="Preparing questions...">Continue →</SubmitButton>
        </div>
      </form>
    </BriefShell>
  );
}

function inspirationAnalysisFromStructuredJson(value: unknown) {
  if (!value || typeof value !== "object" || !("inspirationAnalysis" in value)) {
    return null;
  }

  const analysis = (value as { inspirationAnalysis?: unknown }).inspirationAnalysis;
  if (!analysis || typeof analysis !== "object") {
    return null;
  }

  const possibleAnalysis = analysis as {
    styleDirection?: unknown;
    palette?: unknown;
  };

  return typeof possibleAnalysis.styleDirection === "string"
    ? {
        styleDirection: possibleAnalysis.styleDirection,
        palette: Array.isArray(possibleAnalysis.palette)
          ? possibleAnalysis.palette.filter((item): item is string => typeof item === "string")
          : []
      }
    : null;
}

function palettePlaceholder(analysis: { palette: string[] } | null) {
  return analysis?.palette.length ? analysis.palette.join(", ") : "";
}

function selectedStylesFromStructuredJson(value: unknown): { liked: string[]; avoided: string[] } {
  const empty = { liked: [] as string[], avoided: [] as string[] };
  if (!value || typeof value !== "object" || !("visualPreferences" in value)) {
    return empty;
  }

  const prefs = (value as { visualPreferences?: unknown }).visualPreferences;
  if (!prefs || typeof prefs !== "object") {
    return empty;
  }

  const { likedStyles, avoidedStyles } = prefs as {
    likedStyles?: unknown;
    avoidedStyles?: unknown;
  };

  const names = (input: unknown): string[] =>
    Array.isArray(input)
      ? input
          .map((item) =>
            item && typeof item === "object" && "name" in item
              ? (item as { name?: unknown }).name
              : null
          )
          .filter((name): name is string => typeof name === "string")
      : [];

  return { liked: names(likedStyles), avoided: names(avoidedStyles) };
}
