"use client";

import type { Database } from "@ritzy-studio/db";
import { ImageDropzone } from "@ritzy-studio/ui";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { readFloorPlanAction } from "@/app/actions";
import { readImageSize, slugFileName } from "@/lib/upload";

type UploadStatus = "idle" | "uploading" | "complete" | "error";

export function FloorPlanUploader({
  existingStoragePath,
  planState,
  roomId,
  userId
}: {
  existingStoragePath?: string | null;
  // What the app has managed to do with the plan that is attached. Without it
  // this panel says "Floor plan attached" over a plan the app cannot use, and
  // the refusal underneath reads as the quieter of two contradictory claims
  // (design review).
  planState?: "usable" | "unusable";
  roomId: string;
  userId: string;
}) {
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const attachedMessage =
    planState === "unusable" ? "Attached, but we cannot read it" : "Floor plan attached";
  const [message, setMessage] = useState(
    existingStoragePath ? attachedMessage : "Drop a floor plan or click to upload"
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function uploadFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setStatus("error");
      setMessage("Use a JPG or PNG up to 10 MB.");
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

    // The read is triggered here, by the upload, and never by a render: a page
    // that read on load would spend on every visit. The same shape the
    // inspiration images use (S5b).
    if (file.type.startsWith("image/")) {
      setMessage("Reading your floor plan...");
      const result = await readFloorPlanAction(roomId);
      setMessage(result?.message ?? attachedMessage);
    }

    startTransition(() => router.refresh());
    return true;
  }

  return (
    <ImageDropzone
      accept="image/jpeg,image/png"
      busy={status === "uploading" || isPending}
      description={
        existingStoragePath
          ? "Drop another file here to replace it."
          : "The whole home's plan is fine. We will find the rooms on it and you pick this one."
      }
      error={
        status === "error"
          ? { message, onRetry: lastFile ? () => void uploadFile(lastFile) : undefined }
          : null
      }
      // PDF is off the list until the slice that can rasterise one: advertising
      // a format the reader then refuses is the contradiction the design review
      // found sixty pixels apart in this panel. And once a refusal is showing
      // below, the hint drops its advice, because the refusal is already
      // giving it fifty pixels down.
      hint={
        planState === "unusable"
          ? "JPG or PNG · up to 10 MB"
          : "JPG or PNG · up to 10 MB. A photograph or screenshot of a PDF plan works."
      }
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
