"use client";

import type { Database } from "@ritzy-studio/db";
import { ImageDropzone } from "@ritzy-studio/ui";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { readImageSize, slugFileName } from "@/lib/upload";

type UploadStatus = "idle" | "uploading" | "complete" | "error";

export function FloorPlanUploader({
  existingStoragePath,
  roomId,
  userId
}: {
  existingStoragePath?: string | null;
  roomId: string;
  userId: string;
}) {
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState(
    existingStoragePath ? "Floor plan attached" : "Drag the floor plan here, or click to upload"
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function uploadFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setStatus("error");
      setMessage("Use a JPG, PNG, or PDF up to 10 MB.");
      return false;
    }

    setLastFile(file);
    setStatus("uploading");
    setMessage("Uploading floor plan...");

    const supabase = createClient();
    const extension = file.name.split(".").pop() ?? "pdf";
    const storagePath = `${userId}/${roomId}/floor-plan/${crypto.randomUUID()}-${slugFileName(file.name) || `floor-plan.${extension}`}`;
    const size = await readImageSize(file);

    const { data: existingAssets = [] } = await supabase
      .from("room_assets")
      .select("id, storage_path")
      .eq("room_id", roomId)
      .eq("asset_type", "floor_plan");

    const { error: uploadError } = await supabase.storage
      .from("room-assets")
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type || "application/octet-stream",
        upsert: false
      });

    if (uploadError) {
      setStatus("error");
      setMessage(uploadError.message);
      return false;
    }

    if (existingAssets && existingAssets.length > 0) {
      const paths = existingAssets.map((asset) => asset.storage_path).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from("room-assets").remove(paths);
      }
      await supabase.from("room_assets").delete().in(
        "id",
        existingAssets.map((asset) => asset.id)
      );
    }

    const { error: rowError } = await supabase.from("room_assets").insert({
      room_id: roomId,
      asset_type: "floor_plan",
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      width_px: size.width,
      height_px: size.height,
      is_primary: false
    } satisfies Database["public"]["Tables"]["room_assets"]["Insert"]);

    if (rowError) {
      setStatus("error");
      setMessage(rowError.message);
      return false;
    }

    setStatus("complete");
    setMessage("Floor plan attached");
    startTransition(() => router.refresh());
    return true;
  }

  return (
    <ImageDropzone
      accept="image/jpeg,image/png,application/pdf"
      busy={status === "uploading" || isPending}
      description="Add the floor plan for this room only — not the whole property."
      error={
        status === "error"
          ? { message, onRetry: lastFile ? () => void uploadFile(lastFile) : undefined }
          : null
      }
      hint="JPG, PNG, or PDF · up to 10 MB"
      icon={<FloorPlanIcon />}
      onFiles={(files) => {
        const file = files[0];
        if (file) {
          void uploadFile(file);
        }
      }}
      prompt={status === "error" ? "floor plan could not upload" : message}
    />
  );
}

function FloorPlanIcon() {
  return (
    <svg aria-hidden="true" className="size-7" fill="none" viewBox="0 0 24 24">
      <path d="M5 4.75h14v14.5H5z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 10h5V4.75M10 19.25V14h4M19 12h-5v7.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 9h1.8M8.2 14H10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}
