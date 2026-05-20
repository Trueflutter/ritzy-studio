"use client";

import type { Database } from "@ritzy-studio/db";
import { ImageDropzone } from "@ritzy-studio/ui";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { analyzeInspirationAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { readImageSize, slugFileName } from "@/lib/upload";

type UploadStatus = "idle" | "uploading" | "complete" | "error";

export function InspirationUploader({
  existingCount,
  roomId,
  userId
}: {
  existingCount: number;
  roomId: string;
  userId: string;
}) {
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("Drag an inspiration photo here, or click to upload");
  const [previews, setPreviews] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const awaitingRefresh = useRef(false);
  const router = useRouter();

  // The previews are local object URLs shown the instant a file is uploaded.
  // Once the server refresh lands, the real thumbnails are on screen, so the
  // previews are dropped and their object URLs released.
  useEffect(() => {
    if (isPending) {
      awaitingRefresh.current = true;
      return;
    }
    if (awaitingRefresh.current && previews.length > 0) {
      awaitingRefresh.current = false;
      previews.forEach((url) => URL.revokeObjectURL(url));
      setPreviews([]);
    }
  }, [isPending, previews]);

  async function uploadFile(file: File) {
    setLastFile(file);
    setStatus("uploading");
    setMessage("Uploading inspiration photo...");

    const supabase = createClient();
    const extension = file.name.split(".").pop() ?? "jpg";
    const storagePath = `${userId}/${roomId}/inspiration/${crypto.randomUUID()}-${slugFileName(file.name) || `reference.${extension}`}`;
    const size = await readImageSize(file);

    const { error: uploadError } = await supabase.storage
      .from("room-assets")
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      setStatus("error");
      setMessage(uploadError.message);
      return false;
    }

    const { error: rowError } = await supabase.from("room_assets").insert({
      room_id: roomId,
      asset_type: "inspiration_image",
      storage_path: storagePath,
      mime_type: file.type,
      width_px: size.width,
      height_px: size.height,
      is_primary: existingCount === 0
    } satisfies Database["public"]["Tables"]["room_assets"]["Insert"]);

    if (rowError) {
      setStatus("error");
      setMessage(rowError.message);
      return false;
    }

    setStatus("complete");
    setMessage("Inspiration photo uploaded");
    return true;
  }

  async function uploadFiles(files: File[]) {
    const uploaded: File[] = [];
    for (const file of files) {
      const ok = await uploadFile(file);
      if (!ok) {
        break;
      }
      uploaded.push(file);
    }

    if (uploaded.length === 0) {
      return;
    }

    setPreviews(uploaded.map((file) => URL.createObjectURL(file)));
    startTransition(() => router.refresh());

    void analyzeInspirationAction(roomId)
      .catch(() => null)
      .finally(() => router.refresh());
  }

  return (
    <div>
      <ImageDropzone
        accept="image/jpeg,image/png,image/webp"
        busy={status === "uploading"}
        error={
          status === "error"
            ? { message, onRetry: lastFile ? () => void uploadFile(lastFile) : undefined }
            : null
        }
        hint="JPG, PNG, or WEBP · up to 10 MB"
        multiple
        onFiles={(files) => void uploadFiles(files)}
        prompt={status === "error" ? "reference could not upload" : message}
      />

      {previews.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {previews.map((url) => (
            <figure className="border border-line bg-surface p-2" key={url}>
              <div className="flex aspect-square items-center justify-center bg-surface-subtle">
                <Image
                  alt="Inspiration reference, just uploaded"
                  className="h-full w-full object-cover"
                  height={220}
                  src={url}
                  unoptimized
                  width={220}
                />
              </div>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}
