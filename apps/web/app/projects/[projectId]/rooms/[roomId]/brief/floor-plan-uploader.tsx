"use client";

import type { Database } from "@ritzy-studio/db";
import { ImageDropzone } from "@ritzy-studio/ui";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { readFloorPlanAction } from "@/app/actions";
import { readImageSize, slugFileName } from "@/lib/upload";

import { useFloorPlanActivity } from "./floor-plan-activity";

type UploadStatus = "idle" | "uploading" | "reading" | "error";

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
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { setReplacing } = useFloorPlanActivity();

  // Once nothing is in flight, what this panel says about the plan comes from
  // the page, which read it off the rows. A first version kept it in state,
  // which made it a snapshot of the plan from before the upload: it said
  // "Floor plan attached" over a plan the read had just refused, and "Attached,
  // but we cannot read it" over a readable plan that replaced a refused one
  // (PR review).
  const settledPrompt = existingStoragePath
    ? planState === "unusable"
      ? "Attached, but we cannot read it"
      : "Floor plan attached"
    : "Drop a floor plan or click to upload";

  async function uploadFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setStatus("error");
      setErrorMessage("Use a JPG or PNG up to 10 MB.");
      return false;
    }

    setLastFile(file);
    setStatus("uploading");
    // From here until the refreshed page arrives, the rooms listed beneath
    // belong to the plan being replaced, so they come off the screen.
    setReplacing(true);

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
      setErrorMessage(uploadError.message);
      setReplacing(false);
      return false;
    }

    // The new row lands BEFORE the old plan is retired. The other order
    // deletes the object and the row first, so an insert that then fails
    // leaves the room with no plan at all, the previous one unrecoverable and
    // the new one orphaned in storage (cross-model gate). Worst case now is a
    // stale row that loses to the newer one on every read.
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
      setErrorMessage(rowError.message);
      setReplacing(false);
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

    // The read is triggered here, by the upload, and never by a render: a page
    // that read on load would spend on every visit. The same shape the
    // inspiration images use (S5b).
    //
    // Its answer is not used here. By the time the call returns, every outcome
    // is on a row, a read on its job and a refusal on the plan's own row, so
    // the refreshed page says it. A call that throws opened no row, and the page
    // offers to read the plan rather than claiming it is being read.
    if (file.type.startsWith("image/")) {
      setStatus("reading");
      await readFloorPlanAction(roomId).catch(() => null);
    }

    // Idle inside the transition, so the in-flight wording holds until the
    // refreshed page arrives instead of the settled wording from before it.
    startTransition(() => {
      setStatus("idle");
      setReplacing(false);
      router.refresh();
    });
    return true;
  }

  const prompt =
    status === "error"
      ? "floor plan could not upload"
      : status === "uploading"
        ? "Uploading floor plan..."
        : status === "reading"
          ? "Reading your floor plan..."
          : settledPrompt;

  return (
    <ImageDropzone
      accept="image/jpeg,image/png"
      // Busy while the read runs too. A second plan dropped mid-read throws
      // away a read already paid for, and the two uploads would take turns
      // saying what is in flight.
      busy={status === "uploading" || status === "reading" || isPending}
      description={
        existingStoragePath
          ? "Drop another file here to replace it."
          : "The whole home's plan is fine. We will find the rooms on it and you pick this one."
      }
      error={
        status === "error"
          ? { message: errorMessage, onRetry: lastFile ? () => void uploadFile(lastFile) : undefined }
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
      prompt={prompt}
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
