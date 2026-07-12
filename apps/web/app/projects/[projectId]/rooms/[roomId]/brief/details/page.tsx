import { ButtonLink, SubmitButton } from "@ritzy-studio/ui";
import { parseSpatialIntent, spatialLayoutModeForRoomType } from "@ritzy-studio/domain";
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

  const spatialIntent = parseSpatialIntent(designBrief?.structured_json, room.room_type);
  const layoutMode = spatialLayoutModeForRoomType(room.room_type);
  const showSeatingPlanning = layoutMode === "living_only" || layoutMode === "living_plus_dining";
  const showDiningPlanning = layoutMode === "living_plus_dining" || layoutMode === "dining_only";

  const inspirationAnalysis = inspirationAnalysisFromStructuredJson(designBrief?.structured_json);
  const selectedStyles = selectedStylesFromStructuredJson(designBrief?.structured_json);
  const palette = palettePlaceholder(inspirationAnalysis);
  const colorNotes = designBrief?.color_notes?.trim() ?? "";
  const colorNotesValue = colorNotes || palette;
  const colorPrefilled = !colorNotes && palette.length > 0;

  // Editorial field styling — questions read as italic prompts; answers sit on a hairline.
  const questionClass = "block font-display text-[20px] font-light italic leading-snug text-ink";
  const underlineField =
    "mt-3 block w-full resize-y border-0 border-b border-[var(--rs-border-strong)] bg-transparent px-0 pb-3 font-body text-body-m text-ink outline-none transition-colors duration-micro ease-standard placeholder:italic placeholder:text-[var(--rs-text-disabled)] focus:border-[var(--rs-accent-deep)]";

  return (
    <BriefShell
      backHref={`/projects/${projectId}/rooms/${roomId}/brief/inspiration`}
      currentStep={3}
      eyebrow="N° 06 — The brief"
      projectName={project.name}
      roomName={room.name}
      roomType={room.room_type}
      subtitle="Grouped so you can move through them in order — the vision first, then how the room lives, then the measurements. Answer what you know; skip the rest — we will note the assumption."
      title="The questions a designer would ask."
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

        {selectedStyles.liked.length > 0 ? (
          <div className="mb-10 flex flex-col gap-2 border-l border-accent pl-5 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <p className="font-body text-caption-tight font-medium uppercase tracking-[0.28em] text-accent-deep">
                Style — pulled from earlier
              </p>
              <p className="mt-2 font-body text-body-m text-ink">{selectedStyles.liked.join(", ")}</p>
              {selectedStyles.avoided.length > 0 ? (
                <p className="mt-1 font-body text-body-s text-ink-muted">
                  Avoiding: {selectedStyles.avoided.join(", ")}
                </p>
              ) : null}
            </div>
            <ButtonLink
              href={`/projects/${projectId}/rooms/${roomId}/brief/style`}
              trailing="→"
              variant="quiet"
            >
              change
            </ButtonLink>
          </div>
        ) : null}

        {/* GROUP 01 · the vision — the lead question, full width */}
        <div>
          <div className="flex items-center gap-[14px]">
            <span className="font-body text-caption font-medium uppercase tracking-[0.28em] text-accent-deep">
              01
            </span>
            <span className="font-body text-caption font-medium uppercase tracking-[0.28em] text-ink">
              The look you are after
            </span>
            <span aria-hidden className="h-px flex-1 bg-line" />
          </div>
          <div className="mt-5 max-w-[960px] border-t-2 border-ink pt-6">
            <label className="font-display text-[30px] font-light italic leading-[1.2] text-ink" htmlFor="colorNotes">
              Which colours and materials do you want — and any to avoid?
            </label>
            <textarea
              className={`${underlineField} min-h-[64px]`}
              defaultValue={colorPrefilled ? colorNotesValue : ""}
              id="colorNotes"
              name="colorNotes"
              placeholder={colorPrefilled ? undefined : "warm neutrals, brushed brass, deep walnut; nothing cold or grey..."}
            />
            {colorPrefilled ? (
              <p className="mt-[10px] font-body text-caption-tight font-medium uppercase tracking-[0.24em] text-accent-deep">
                pulled from your inspiration · edit freely
              </p>
            ) : null}
          </div>
        </div>

        {/* GROUP 02 · how the room lives — supporting prompts */}
        <div className="mt-12">
          <div className="flex items-center gap-[14px]">
            <span className="font-body text-caption font-medium uppercase tracking-[0.28em] text-accent-deep">
              02
            </span>
            <span className="font-body text-caption font-medium uppercase tracking-[0.28em] text-ink">
              How the room lives
            </span>
            <span aria-hidden className="h-px flex-1 bg-line" />
          </div>
          <div className="mt-6 grid gap-x-[72px] gap-y-8 md:grid-cols-2">
            <div>
              <label className={questionClass} htmlFor="functionalRequirements">
                What does this room need to do, day to day?
              </label>
              <textarea
                className={`${underlineField} min-h-[56px]`}
                defaultValue={designBrief?.functional_requirements ?? ""}
                id="functionalRequirements"
                name="functionalRequirements"
                placeholder="seating for six, child-safe finishes, blackout curtains, storage for toys..."
              />
            </div>
            <div>
              <label className={questionClass} htmlFor="avoidNotes">
                Anything we should keep out of the design?
              </label>
              <textarea
                className={`${underlineField} min-h-[56px]`}
                defaultValue={designBrief?.avoid_notes ?? ""}
                id="avoidNotes"
                name="avoidNotes"
                placeholder="no glass coffee table, no high-pile rug, avoid visible brass..."
              />
            </div>
            <div>
              <label className={questionClass} htmlFor="inspirationNotes">
                Your references — what to copy, what to ignore?
              </label>
              <textarea
                className={`${underlineField} min-h-[56px]`}
                defaultValue={designBrief?.inspiration_notes ?? ""}
                id="inspirationNotes"
                name="inspirationNotes"
                placeholder="copy the calm of the second image; ignore the dark wall..."
              />
            </div>
          </div>
        </div>

        {/* GROUP 03 · room planning — tinted block, structured inputs */}
        <div className="mt-12 border border-line bg-surface p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-x-[14px] gap-y-2">
            <span className="font-body text-caption font-medium uppercase tracking-[0.28em] text-accent-deep">
              03
            </span>
            <span className="font-body text-caption font-medium uppercase tracking-[0.28em] text-ink">
              Room planning
            </span>
            <span className="font-display text-button-quiet italic text-ink-subtle">
              where the furniture goes, not just what it looks like
            </span>
          </div>

          {showSeatingPlanning || showDiningPlanning ? (
            <div className="mt-6 grid gap-x-12 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
              {showSeatingPlanning ? (
                <div>
                  <label className={questionClass} htmlFor="focalPoint">
                    What should the seating face?
                  </label>
                  <select
                    className="mt-3 block w-full border-0 border-b border-[var(--rs-border-strong)] bg-transparent px-0 pb-2 font-body text-body-m text-ink outline-none transition-colors duration-micro ease-standard focus:border-[var(--rs-accent-deep)]"
                    defaultValue={spatialIntent.focalPoint ?? "unknown"}
                    id="focalPoint"
                    name="focalPoint"
                  >
                    <option value="unknown">Let the designer decide</option>
                    <option value="tv_media_wall">The TV / media wall</option>
                    <option value="view_window">The window / view</option>
                    <option value="fireplace">The fireplace</option>
                    <option value="art_display_wall">An art or display wall</option>
                    <option value="conversation">Each other — conversation first</option>
                  </select>
                </div>
              ) : null}
              {showSeatingPlanning ? (
                <div>
                  <label className={questionClass} htmlFor="seatingPriority">
                    How is the room mostly used?
                  </label>
                  <select
                    className="mt-3 block w-full border-0 border-b border-[var(--rs-border-strong)] bg-transparent px-0 pb-2 font-body text-body-m text-ink outline-none transition-colors duration-micro ease-standard focus:border-[var(--rs-accent-deep)]"
                    defaultValue={spatialIntent.seatingPriority ?? "unknown"}
                    id="seatingPriority"
                    name="seatingPriority"
                  >
                    <option value="unknown">Let the designer decide</option>
                    <option value="tv_viewing">Watching TV together</option>
                    <option value="conversation">Entertaining and conversation</option>
                    <option value="family_lounging">Relaxed family lounging</option>
                    <option value="formal_hosting">Formal hosting</option>
                    <option value="majlis_hosting">Majlis-style hosting</option>
                  </select>
                </div>
              ) : null}
              {showDiningPlanning ? (
                <div>
                  <label className={questionClass} htmlFor="diningSeatCount">
                    Day-to-day dining seats
                  </label>
                  <input
                    className="mt-3 block w-full border-0 border-b border-[var(--rs-border-strong)] bg-transparent px-0 pb-2 font-body text-body-m text-ink outline-none transition-colors duration-micro ease-standard placeholder:italic placeholder:text-[var(--rs-text-disabled)] focus:border-[var(--rs-accent-deep)] [font-feature-settings:'tnum','lnum']"
                    defaultValue={spatialIntent.diningSeatCount ?? ""}
                    id="diningSeatCount"
                    max="16"
                    min="2"
                    name="diningSeatCount"
                    placeholder="6"
                    type="number"
                  />
                </div>
              ) : null}
              <div>
                <label className={questionClass} htmlFor="mustKeepClear">
                  Anything that must stay clear?
                </label>
                <input
                  className="mt-3 block w-full border-0 border-b border-[var(--rs-border-strong)] bg-transparent px-0 pb-2 font-body text-body-m text-ink outline-none transition-colors duration-micro ease-standard placeholder:italic placeholder:text-[var(--rs-text-disabled)] focus:border-[var(--rs-accent-deep)]"
                  defaultValue={spatialIntent.mustKeepClear?.[0] ?? ""}
                  id="mustKeepClear"
                  name="mustKeepClear"
                  placeholder="keep the balcony door clear"
                  type="text"
                />
              </div>
            </div>
          ) : null}

          <div className="mt-8 border-t border-line pt-6">
            <p className="font-body text-caption font-medium uppercase tracking-[0.28em] text-ink-muted">
              Room measurements
              <span className="ml-3 font-body text-caption-tight font-medium normal-case tracking-[0.24em] text-warning">
                strongly recommended — sizes furniture honestly
              </span>
            </p>
            <div className="mt-5 grid gap-x-12 gap-y-8 md:grid-cols-3">
              <div>
                <label className={questionClass} htmlFor="wallLengthCm">
                  Main wall cm
                </label>
                <input
                  className="mt-3 block w-full border-0 border-b border-[var(--rs-border-strong)] bg-transparent px-0 pb-2 font-body text-body-m text-ink outline-none transition-colors duration-micro ease-standard placeholder:italic placeholder:text-[var(--rs-text-disabled)] focus:border-[var(--rs-accent-deep)] [font-feature-settings:'tnum','lnum']"
                  defaultValue={measurements?.wall_length_cm ?? ""}
                  id="wallLengthCm"
                  min="1"
                  name="wallLengthCm"
                  placeholder="520"
                  type="number"
                />
              </div>
              <div>
                <label className={questionClass} htmlFor="roomDepthCm">
                  Room depth cm
                </label>
                <input
                  className="mt-3 block w-full border-0 border-b border-[var(--rs-border-strong)] bg-transparent px-0 pb-2 font-body text-body-m text-ink outline-none transition-colors duration-micro ease-standard placeholder:italic placeholder:text-[var(--rs-text-disabled)] focus:border-[var(--rs-accent-deep)] [font-feature-settings:'tnum','lnum']"
                  defaultValue={measurements?.room_depth_cm ?? ""}
                  id="roomDepthCm"
                  min="1"
                  name="roomDepthCm"
                  placeholder="410"
                  type="number"
                />
              </div>
              <div>
                <label className={questionClass} htmlFor="ceilingHeightCm">
                  Ceiling cm
                </label>
                <input
                  className="mt-3 block w-full border-0 border-b border-[var(--rs-border-strong)] bg-transparent px-0 pb-2 font-body text-body-m text-ink outline-none transition-colors duration-micro ease-standard placeholder:italic placeholder:text-[var(--rs-text-disabled)] focus:border-[var(--rs-accent-deep)] [font-feature-settings:'tnum','lnum']"
                  defaultValue={measurements?.ceiling_height_cm ?? ""}
                  id="ceilingHeightCm"
                  min="1"
                  name="ceilingHeightCm"
                  placeholder="290"
                  type="number"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-line pt-6">
            <p className="font-body text-caption font-medium uppercase tracking-[0.28em] text-ink-muted">
              Floor plan
              <span className="ml-3 font-body text-caption-tight font-medium normal-case tracking-[0.24em] text-ink-subtle">
                optional — upload a plan as a reference
              </span>
            </p>
            <div className="mt-5">
              <FloorPlanUploader existingStoragePath={floorPlan?.storage_path} roomId={roomId} userId={user.id} />
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-end border-t border-line-strong pt-8">
          <SubmitButton pendingLabel="Preparing questions..." trailing="→">
            Continue to concepts
          </SubmitButton>
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
