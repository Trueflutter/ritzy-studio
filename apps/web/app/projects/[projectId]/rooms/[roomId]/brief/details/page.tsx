import { ButtonLink, SubmitButton, TextInput, Textarea } from "@ritzy-studio/ui";
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
      subtitle="A few of these are already filled from your earlier steps — review them, then answer whatever still applies. Nothing here is required."
      title="Complete the design brief."
    >
      {message ? (
        <p className="mb-8 border border-line bg-surface px-4 py-3 font-display text-body-s italic text-ink-secondary">
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
          <div className="mb-9 border border-line bg-surface px-5 py-4">
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-body text-caption font-medium uppercase text-ink-muted">
                Style — from your earlier choices
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

        <Textarea
          defaultValue={colorNotesValue}
          helper={
            colorPrefilled
              ? "Pulled from your inspiration photos — edit anything that's off."
              : "Which colours do you want, and any to avoid?"
          }
          id="colorNotes"
          label="Colour preferences"
          name="colorNotes"
          placeholder="warm neutrals, brushed brass, deep walnut; nothing cold or grey..."
        />

        {project.budget_min_aed || project.budget_max_aed ? (
          <div className="mb-9 border border-line bg-surface px-5 py-4">
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              Budget — from your project setup
            </p>
            <p className="mt-2 font-body text-body-m text-ink">
              {formatBudget(project.budget_min_aed, project.budget_max_aed)}
            </p>
          </div>
        ) : null}

        <Textarea
          defaultValue={designBrief?.functional_requirements ?? ""}
          helper="What does this room need to do day to day?"
          id="functionalRequirements"
          label="Functional requirements"
          name="functionalRequirements"
          placeholder="seating for six, child-safe finishes, blackout curtains, storage for toys..."
        />
        <Textarea
          defaultValue={designBrief?.avoid_notes ?? ""}
          helper="Anything we should keep out of the design?"
          id="avoidNotes"
          label="Avoid"
          name="avoidNotes"
          placeholder="no glass coffee table, no high-pile rug, avoid visible brass..."
        />
        <Textarea
          defaultValue={designBrief?.inspiration_notes ?? ""}
          helper="Anything else about your references we should know — what to copy, what to ignore?"
          id="inspirationNotes"
          label="Inspiration notes"
          name="inspirationNotes"
          placeholder="copy the calm of the second image; ignore the dark wall..."
        />

        <div className="mt-10 border-t border-line pt-8">
          <p className="font-body text-caption font-medium uppercase text-ink-muted">Measurements</p>
          <p className="mt-2 font-display text-body-s italic text-ink-helper">
            Optional — measurements sharpen product sizing and fit. Skip if you don&apos;t have them.
          </p>
          <div className="mt-6 grid gap-x-6 md:grid-cols-3">
            <TextInput
              defaultValue={measurements?.wall_length_cm ?? ""}
              id="wallLengthCm"
              label="Main wall cm"
              min="1"
              name="wallLengthCm"
              placeholder="520"
              type="number"
            />
            <TextInput
              defaultValue={measurements?.room_depth_cm ?? ""}
              id="roomDepthCm"
              label="Room depth cm"
              min="1"
              name="roomDepthCm"
              placeholder="410"
              type="number"
            />
            <TextInput
              defaultValue={measurements?.ceiling_height_cm ?? ""}
              id="ceilingHeightCm"
              label="Ceiling cm"
              min="1"
              name="ceilingHeightCm"
              placeholder="290"
              type="number"
            />
          </div>
        </div>

        <div className="mt-10 border-t border-line pt-8">
          <p className="font-body text-caption font-medium uppercase text-ink-muted">Floor plan</p>
          <p className="mt-2 font-display text-body-s italic text-ink-helper">
            Optional — a plan helps us place built-ins and get proportions right.
          </p>
          <div className="mt-5">
            <FloorPlanUploader existingStoragePath={floorPlan?.storage_path} roomId={roomId} userId={user.id} />
          </div>
        </div>

        <div className="mt-12 flex justify-end border-t border-line pt-8">
          <SubmitButton pendingLabel="Preparing questions...">Continue →</SubmitButton>
        </div>
      </form>
    </BriefShell>
  );
}

function formatBudget(min: number | null, max: number | null) {
  if (min && max) {
    return `AED ${Number(min).toLocaleString("en-AE")} to AED ${Number(max).toLocaleString("en-AE")}`;
  }

  if (max) {
    return `Up to AED ${Number(max).toLocaleString("en-AE")}`;
  }

  return `From AED ${Number(min).toLocaleString("en-AE")}`;
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
