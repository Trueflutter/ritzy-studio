"use client";

import type { Database } from "@ritzy-studio/db";
import { ImageDropzone } from "@ritzy-studio/ui";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { readImageSize, slugFileName } from "@/lib/upload";

type UploadStatus = "idle" | "uploading" | "complete" | "error";

export function RoomPhotoUploader({
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
  const [message, setMessage] = useState<string>("Drag a room photo here, or click to upload");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function uploadFile(file: File, isPrimary: boolean) {
    setLastFile(file);
    setStatus("uploading");

    const supabase = createClient();
    const extension = file.name.split(".").pop() ?? "jpg";
    const storagePath = `${userId}/${roomId}/${crypto.randomUUID()}-${slugFileName(file.name) || `room.${extension}`}`;
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
      asset_type: "room_photo",
      storage_path: storagePath,
      mime_type: file.type,
      width_px: size.width,
      height_px: size.height,
      is_primary: isPrimary
    } satisfies Database["public"]["Tables"]["room_assets"]["Insert"]);

    if (rowError) {
      setStatus("error");
      setMessage(rowError.message);
      return false;
    }

    setStatus("complete");
    setMessage("Room photo uploaded");
    return true;
  }

  async function uploadFiles(files: File[]) {
    let uploadedCount = existingCount;
    setProgress({ current: 0, total: files.length });

    for (const [index, file] of files.entries()) {
      setMessage(`Uploading photo ${index + 1} of ${files.length}...`);
      setProgress({ current: index + 1, total: files.length });
      const uploaded = await uploadFile(file, uploadedCount === 0);
      if (!uploaded) {
        break;
      }
      uploadedCount += 1;
    }

    setProgress(null);
    startTransition(() => router.refresh());
  }

  return (
    <ImageDropzone
      accept="image/jpeg,image/png,image/webp"
      busy={status === "uploading" || isPending}
      error={
        status === "error"
          ? {
              message,
              onRetry: lastFile
                ? () => void uploadFile(lastFile, existingCount === 0)
                : undefined
            }
          : null
      }
      hint="JPG, PNG, or WEBP · up to 10 MB"
      multiple
      onFiles={(files) => void uploadFiles(files)}
      progress={progress}
      prompt={status === "error" ? "image could not load" : message}
      showProgress
    />
  );
}
