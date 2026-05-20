"use client";

import type { Database } from "@ritzy-studio/db";
import { ImageDropzone } from "@ritzy-studio/ui";
import { useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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
    for (const file of files) {
      const uploaded = await uploadFile(file);
      if (!uploaded) {
        break;
      }
    }

    startTransition(() => router.refresh());

    void analyzeInspirationAction(roomId)
      .catch(() => null)
      .finally(() => router.refresh());
  }

  return (
    <ImageDropzone
      accept="image/jpeg,image/png,image/webp"
      busy={status === "uploading" || isPending}
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
  );
}
