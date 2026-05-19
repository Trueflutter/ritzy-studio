import { SubmitButton, TextInput, Textarea } from "@ritzy-studio/ui";
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
  const inferredStyleNotes = !designBrief?.style_notes?.trim() ? inspirationAnalysis?.styleDirection : null;
  const styleNotes = designBrief?.style_notes || inferredStyleNotes || "";

  return (
    <BriefShell
      backHref={`/projects/${projectId}/rooms/${roomId}/brief/inspiration`}
      currentStep={3}
      eyebrow="N° 06 — Details"
      projectName={project.name}
      roomName={room.name}
      roomType={room.room_type}
      subtitle="Add the details that change product choices, fit, and the final design direction."
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

        {inferredStyleNotes ? (
          <p className="mb-3 font-display text-body-s italic text-ink-secondary">
            Inferred from your inspiration images — edit anything.
          </p>
        ) : null}
        <Textarea
          defaultValue={styleNotes}
          id="styleNotes"
          label="Style direction"
          name="styleNotes"
          placeholder="quiet contemporary, warm editorial, tailored villa, family-friendly luxury..."
        />
        <Textarea
          defaultValue={designBrief?.color_notes ?? palettePlaceholder(inspirationAnalysis)}
          id="colorNotes"
          label="Colour preferences"
          name="colorNotes"
          placeholder="Tell us the colours you want, and anything to avoid..."
        />
        {project.budget_min_aed || project.budget_max_aed ? (
          <div className="mb-9 border border-line bg-surface px-5 py-4">
            <p className="font-body text-caption font-medium uppercase text-ink-muted">Budget</p>
            <p className="mt-2 font-body text-body-m text-ink">
              {formatBudget(project.budget_min_aed, project.budget_max_aed)}
            </p>
          </div>
        ) : null}
        <Textarea
          defaultValue={designBrief?.functional_requirements ?? ""}
          id="functionalRequirements"
          label="Functional requirements"
          name="functionalRequirements"
          placeholder="seating for six, child-safe finishes, blackout curtains, storage for toys..."
        />
        <Textarea
          defaultValue={designBrief?.avoid_notes ?? ""}
          id="avoidNotes"
          label="Avoid"
          name="avoidNotes"
          placeholder="no glass coffee table, no high-pile rug, avoid visible brass..."
        />
        <Textarea
          defaultValue={designBrief?.inspiration_notes ?? ""}
          id="inspirationNotes"
          label="Inspiration notes"
          name="inspirationNotes"
          placeholder="Anything else about the references: what to copy, what to ignore, what matters most..."
        />

        <div className="mt-10 border-t border-line pt-8">
          <p className="font-body text-caption font-medium uppercase text-ink-muted">Measurements</p>
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
          <Textarea
            defaultValue={measurements?.notes ?? ""}
            id="measurementNotes"
            label="Measurement notes"
            name="measurementNotes"
            placeholder="window wall estimated; ceiling height confirmed by contractor..."
          />
        </div>

        <div className="mt-10 border-t border-line pt-8">
          <p className="font-body text-caption font-medium uppercase text-ink-muted">Floor plan</p>
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
