import { SubmitButton } from "@ritzy-studio/ui";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { saveDesignBriefAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { BriefShell } from "../_components/brief-shell";
import { InspirationUploader } from "../inspiration-uploader";

export const dynamic = "force-dynamic";

export default async function BriefInspirationPage({
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

  const { data: inspirationAssets = [] } = await supabase
    .from("room_assets")
    .select("*")
    .eq("room_id", roomId)
    .eq("asset_type", "inspiration_image")
    .order("created_at", { ascending: true });

  const signedAssets = await Promise.all(
    (inspirationAssets ?? []).map(async (asset) => {
      const { data } = await supabase.storage.from("room-assets").createSignedUrl(asset.storage_path, 60 * 60);
      return { ...asset, signedUrl: data?.signedUrl ?? null };
    })
  );

  return (
    <BriefShell
      backHref={`/projects/${projectId}/rooms/${roomId}/brief/style`}
      currentStep={2}
      eyebrow="N° 05 — Inspiration"
      projectName={project.name}
      roomName={room.name}
      roomType={room.room_type}
      subtitle="Add rooms, palettes, materials, or details you like. The system will analyze them while you continue."
      title="Show us the feeling you want."
    >
      <div className="border border-line bg-surface p-5">
        <InspirationUploader existingCount={signedAssets.length} roomId={roomId} userId={user.id} />
      </div>

      {signedAssets.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {signedAssets.map((asset, index) => (
            <figure className="border border-line bg-surface p-2" key={asset.id}>
              <div className="flex aspect-square items-center justify-center bg-surface-subtle">
                {asset.signedUrl ? (
                  <Image
                    alt={`Inspiration reference ${index + 1}`}
                    className="h-full w-full object-cover"
                    height={220}
                    unoptimized
                    src={asset.signedUrl}
                    width={220}
                  />
                ) : (
                  <p className="font-display text-body-s italic text-error">missing</p>
                )}
              </div>
            </figure>
          ))}
        </div>
      ) : null}

      <form action={saveDesignBriefAction} className="mt-10 flex justify-end border-t border-line pt-8">
        <input name="projectId" type="hidden" value={projectId} />
        <input name="roomId" type="hidden" value={roomId} />
        <input name="roomType" type="hidden" value={room.room_type} />
        <input name="briefStep" type="hidden" value="inspiration" />
        <input name="nextPath" type="hidden" value={`/projects/${projectId}/rooms/${roomId}/brief/details`} />
        <SubmitButton pendingLabel="Saving references...">Continue →</SubmitButton>
      </form>
    </BriefShell>
  );
}
