import {
  Button,
  ButtonLink,
  DecorativeRule,
  JourneyNav,
  SectionEyebrow,
  StepRail,
  StudioHeader,
  SubmitButton
} from "@ritzy-studio/ui";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { deleteRoomPhotoAction } from "@/app/actions";
import { RoomPhotoUploader } from "./room-photo-uploader";

export const dynamic = "force-dynamic";

export default async function RoomPhotosPage({
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

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  if (!project || !room) {
    notFound();
  }

  const { data: assets = [] } = await supabase
    .from("room_assets")
    .select("*")
    .eq("room_id", roomId)
    .eq("asset_type", "room_photo")
    .order("created_at", { ascending: true });

  const signedAssets = await Promise.all(
    (assets ?? []).map(async (asset) => {
      const { data } = await supabase.storage
        .from("room-assets")
        .createSignedUrl(asset.storage_path, 60 * 60);

      return {
        ...asset,
        signedUrl: data?.signedUrl ?? null
      };
    })
  );

  const photoCount = signedAssets.length;
  const footerNote =
    photoCount === 0
      ? "Add your first photo to begin."
      : `${photoCount === 1 ? "One photo" : `${photoCount} photos`} added. Add another or move on — `;

  return (
    <main className="flex min-h-dvh flex-col bg-page text-ink">
      <StudioHeader>
        <JourneyNav current="photos" />
      </StudioHeader>

      <section className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 py-10 md:px-8 lg:px-12">
        <StepRail
          aside="one thing to do here — add your photos"
          steps={[
            { numeral: 1, label: "Add your photos", state: "active" },
            { numeral: 2, label: "The brief comes next", state: "todo" }
          ]}
        />

        <div className="mt-10 grid gap-12 lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-14">
          <div>
            <SectionEyebrow>Step 01 · N° 05 — The room as it is</SectionEyebrow>
            <DecorativeRule className="mt-5" />
            <h1 className="mt-6 font-display text-[44px] font-light leading-[1.05] tracking-[-0.015em] text-ink">
              Photograph the room you want to <em className="italic">redesign.</em>
            </h1>
            <p className="mt-5 max-w-[44ch] font-body text-body-s leading-[1.7] text-ink-secondary">
              Two or three photos from different corners give the design real spatial coverage — walls
              and openings one frame cannot see. Empty rooms read most accurately; a furnished room
              works too.
            </p>
            <div className="mt-6 flex flex-col gap-[10px]">
              {[
                "Stand in a corner, capture the widest view",
                "Cross the room, shoot back",
                "Optional — the wall the first photo missed"
              ].map((line, index) => (
                <p className="font-body text-body-s text-ink-muted" key={index}>
                  <span className="font-body text-caption font-medium tracking-[0.2em] text-accent-deep">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  &nbsp;&nbsp;{line}
                </p>
              ))}
            </div>
          </div>

          <div>
            {message ? (
              <p className="mb-6 border border-line bg-surface px-4 py-3 font-display text-body-s italic text-ink-secondary">
                {message}
              </p>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {signedAssets.map((asset, index) => (
                <figure key={asset.id}>
                  <div className="h-[300px] overflow-hidden border border-line bg-page sm:h-[340px]">
                    {asset.signedUrl ? (
                      <Image
                        alt={`${room.name} room photograph ${index + 1}`}
                        className="h-full w-full object-cover"
                        height={680}
                        unoptimized
                        src={asset.signedUrl}
                        width={510}
                      />
                    ) : (
                      <p className="flex h-full items-center justify-center font-display text-body-s italic text-error">
                        image could not load
                      </p>
                    )}
                  </div>
                  <figcaption className="mt-[10px] flex items-baseline justify-between">
                    <span className="font-body text-caption-tight font-medium uppercase tracking-[0.28em] text-ink-muted">
                      Photograph {String(index + 1).padStart(2, "0")}
                    </span>
                    <form action={deleteRoomPhotoAction}>
                      <input name="projectId" type="hidden" value={projectId} />
                      <input name="roomId" type="hidden" value={roomId} />
                      <input name="assetId" type="hidden" value={asset.id} />
                      <SubmitButton
                        className="h-8 border-none bg-transparent px-0 font-display text-button-quiet normal-case italic tracking-normal text-error hover:bg-transparent hover:text-accent-deep"
                        pendingLabel="Removing…"
                        variant="destructive"
                      >
                        remove
                      </SubmitButton>
                    </form>
                  </figcaption>
                </figure>
              ))}

              <div className="[&_label]:min-h-[300px] sm:[&_label]:min-h-[340px]">
                <RoomPhotoUploader
                  existingCount={signedAssets.length}
                  roomId={roomId}
                  userId={user.id}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-col items-start justify-between gap-6 border-t border-line-strong pt-7 sm:flex-row sm:items-center">
          <p className="font-body text-body-s text-ink-muted">
            {footerNote}
            {photoCount > 0 ? (
              <span className="text-ink">that is everything for this step.</span>
            ) : null}
          </p>
          {photoCount > 0 ? (
            <ButtonLink href={`/projects/${projectId}/rooms/${roomId}/brief`} trailing="→">
              Continue to the brief
            </ButtonLink>
          ) : (
            <Button disabled trailing="→">
              Continue to the brief
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}
