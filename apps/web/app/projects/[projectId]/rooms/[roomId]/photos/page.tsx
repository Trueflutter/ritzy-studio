import { Button, ButtonLink } from "@ritzy-studio/ui";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { RoomPhotoUploader } from "./room-photo-uploader";

export const dynamic = "force-dynamic";

export default async function RoomPhotosPage({
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
        <ButtonLink href="/" trailing="→" variant="quiet">
          back to studio
        </ButtonLink>
      </header>

      <section className="mx-auto max-w-[720px] px-5 py-12 md:px-8 lg:px-0">
        <p className="font-body text-caption font-medium uppercase text-ink-muted">
          Project — Photos — Brief — Generate — Critique — Match
        </p>
        <div className="mt-3 h-px w-32 bg-ink" />

        <p className="mt-12 font-body text-caption font-medium uppercase text-ink-muted">
          N° 03 — Photographs
        </p>
        <h1 className="mt-6 font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
          Place the room you would like to redesign.
        </h1>
        <p className="mt-6 font-body text-body-m text-ink-secondary">
          {project.name} · {room.name} · {room.room_type}
        </p>

        <div className="mt-12">
          <RoomPhotoUploader existingCount={signedAssets.length} roomId={roomId} userId={user.id} />
        </div>

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
              </figure>
            ))}
          </div>
        ) : null}

        <div className="mt-12 flex items-center justify-end gap-6">
          <ButtonLink href="/" trailing="→" variant="quiet">
            skip — I&apos;ll add later
          </ButtonLink>
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
