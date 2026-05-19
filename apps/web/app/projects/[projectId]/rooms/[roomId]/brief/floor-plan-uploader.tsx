"use client";

import type { Database } from "@ritzy-studio/db";
import { Button } from "@ritzy-studio/ui";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type UploadStatus = "idle" | "uploading" | "complete" | "error";

function slugFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function readImageSize(file: File): Promise<{ width: number | null; height: number | null }> {
  if (!file.type.startsWith("image/")) {
    return { width: null, height: null };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ width: null, height: null });
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function FloorPlanUploader({
  existingStoragePath,
  roomId,
  userId
}: {
  existingStoragePath?: string | null;
  roomId: string;
  userId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState(
    existingStoragePath ? "Floor plan attached" : "Add the floor plan for this room only"
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
    <div>
      <input
        accept="image/jpeg,image/png,application/pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void uploadFile(file);
          }
          event.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />
      <button
        className="flex min-h-40 w-full flex-col items-center justify-center border border-dashed border-line-strong bg-page px-6 text-center transition-colors duration-micro ease-standard hover:border-accent-deep hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)]"
        disabled={status === "uploading" || isPending}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files?.[0];
          if (file) {
            void uploadFile(file);
          }
        }}
        type="button"
      >
        <span className="mb-5 flex size-14 items-center justify-center border border-line-strong bg-surface text-ink">
          <FloorPlanIcon />
        </span>
        <span className="font-display text-body-l font-light italic text-ink">
          {status === "error" ? "floor plan could not upload" : message}
        </span>
        <span className="mt-3 max-w-[36ch] font-body text-body-s text-ink-muted">
          Add the floor plan for this room only — not the whole property.
        </span>
        <span className="mt-2 font-body text-caption font-medium uppercase text-ink-muted">
          JPG, PNG, or PDF · up to 10 MB
        </span>
      </button>

      {status === "error" ? (
        <div className="mt-4 border-t border-error pt-4">
          <p className="font-display text-body-s italic text-error">{message}</p>
          {lastFile ? (
            <Button className="mt-4" onClick={() => void uploadFile(lastFile)} variant="secondary">
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
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
