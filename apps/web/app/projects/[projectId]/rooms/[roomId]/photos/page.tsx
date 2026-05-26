import {
  Button,
  ButtonLink,
  DecorativeRule,
  MarketingPanel,
  SectionEyebrow,
  SubmitButton
} from "@ritzy-studio/ui";
import Image from "next/image";
import Link from "next/link";
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

  return (
    <main className="min-h-dvh bg-page text-ink">
      <header className="flex min-h-20 items-center justify-between border-b border-line bg-surface px-5 md:px-8 lg:px-12 xl:px-16">
        <Link className="font-display text-[28px] font-light text-ink" href="/">
          Ri <span className="font-body text-caption font-medium uppercase text-ink-muted">Ritzy Studio</span>
        </Link>
        <ButtonLink href="/" leading="←" variant="chrome">
          Back to studio
        </ButtonLink>
      </header>

      <section className="mx-auto max-w-[720px] px-5 py-8 md:px-8 lg:px-0">
        <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
          Project — Photos — Brief — Generate — Critique — Match
        </p>
        <div className="mt-3 h-px w-32 bg-ink" />

        <SectionEyebrow className="mt-8">N° 05 — Photos</SectionEyebrow>
        <DecorativeRule className="mt-5" />
        <h1 className="mt-6 font-display text-display-m font-light leading-[1.05] tracking-[-0.015em] text-ink">
          Upload the room you want to redesign.
        </h1>
        <p className="mt-4 font-body text-body-s text-ink-muted">
          {project.name} · {room.name}
          {room.name === room.room_type ? null : ` · ${room.room_type}`}
        </p>
        <p className="mt-3 max-w-[62ch] font-body text-body-s text-ink-secondary">
          Use a current room photo, or an empty-room photo if you want the system to ignore existing
          furniture.
        </p>

        {message ? (
          <p className="mt-6 border border-line bg-surface px-4 py-3 font-display text-body-s italic text-ink-secondary">
            {message}
          </p>
        ) : null}

        <MarketingPanel className="mt-8 p-6 md:p-8" elevation="float" tone="paper">
          <RoomPhotoUploader existingCount={signedAssets.length} roomId={roomId} userId={user.id} />
        </MarketingPanel>

        {signedAssets.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
            {signedAssets.map((asset, index) => (
              <figure className="border border-line bg-surface p-3" key={asset.id}>
                <div className="flex aspect-square items-center justify-center bg-page">
                  {asset.signedUrl ? (
                    <Image
                      alt={`${room.name} room photograph ${index + 1}`}
                      className="max-h-full max-w-full object-contain"
                      height={320}
                      unoptimized
                      src={asset.signedUrl}
                      width={320}
                    />
                  ) : (
                    <p className="font-display text-body-s italic text-error">
                      image could not load
                    </p>
                  )}
                </div>
                <figcaption className="mt-3 font-body text-caption-tight font-medium uppercase text-ink-muted">
                  photograph {String(index + 1).padStart(2, "0")}
                </figcaption>
                <form action={deleteRoomPhotoAction} className="mt-3">
                  <input name="projectId" type="hidden" value={projectId} />
                  <input name="roomId" type="hidden" value={roomId} />
                  <input name="assetId" type="hidden" value={asset.id} />
                  <SubmitButton className="h-10 w-full px-4" pendingLabel="Removing..." variant="destructive">
                    Remove
                  </SubmitButton>
                </form>
              </figure>
            ))}
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-end gap-6">
          {signedAssets.length > 0 ? (
            <ButtonLink href={`/projects/${projectId}/rooms/${roomId}/brief`}>
              Continue to brief
            </ButtonLink>
          ) : (
            <Button disabled>Continue to brief</Button>
          )}
        </div>
      </section>
    </main>
  );
}
