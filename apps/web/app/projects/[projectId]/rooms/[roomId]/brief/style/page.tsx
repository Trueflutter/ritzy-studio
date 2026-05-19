import { visualStyleOptions } from "@ritzy-studio/domain";
import { SubmitButton } from "@ritzy-studio/ui";
import { notFound, redirect } from "next/navigation";

import { saveDesignBriefAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { BriefShell } from "../_components/brief-shell";
import { VisualStyleSelector } from "../visual-style-selector";

export const dynamic = "force-dynamic";

export default async function BriefStylePage({
  params
}: {
  params: Promise<{ projectId: string; roomId: string }>;
}) {
  const { projectId, roomId } = await params;
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

  const selectedStyleSlugs = stringArrayFromStructuredJson(designBrief?.structured_json, "likedStyleSlugs");
  const avoidedStyleSlugs = stringArrayFromStructuredJson(designBrief?.structured_json, "avoidedStyleSlugs");

  return (
    <BriefShell
      backHref={`/projects/${projectId}/rooms/${roomId}/photos`}
      currentStep={1}
      eyebrow="N° 04 — Visual Style"
      projectName={project.name}
      roomName={room.name}
      roomType={room.room_type}
      subtitle="Pick the visual directions that feel closest. You can refine the language later."
      title="Choose the rooms that feel right."
    >
      <form action={saveDesignBriefAction}>
        <input name="projectId" type="hidden" value={projectId} />
        <input name="roomId" type="hidden" value={roomId} />
        <input name="roomType" type="hidden" value={room.room_type} />
        <input name="briefStep" type="hidden" value="style" />
        <input
          name="nextPath"
          type="hidden"
          value={`/projects/${projectId}/rooms/${roomId}/brief/inspiration`}
        />
        <VisualStyleSelector
          avoidedStyleSlugs={avoidedStyleSlugs}
          selectedStyleSlugs={selectedStyleSlugs}
          styles={visualStyleOptions}
        />
        <textarea className="sr-only" defaultValue={designBrief?.style_notes ?? ""} id="styleNotes" name="styleNotes" />
        <div className="mt-10 flex justify-end border-t border-line pt-8">
          <SubmitButton pendingLabel="Saving style...">Continue →</SubmitButton>
        </div>
      </form>
    </BriefShell>
  );
}

function stringArrayFromStructuredJson(value: unknown, key: "likedStyleSlugs" | "avoidedStyleSlugs") {
  if (!value || typeof value !== "object" || !("visualPreferences" in value)) {
    return [];
  }

  const visualPreferences = (value as { visualPreferences?: unknown }).visualPreferences;
  if (!visualPreferences || typeof visualPreferences !== "object" || !(key in visualPreferences)) {
    return [];
  }

  const possibleValues = (visualPreferences as Record<string, unknown>)[key];
  return Array.isArray(possibleValues)
    ? possibleValues.filter((item): item is string => typeof item === "string")
    : [];
}
