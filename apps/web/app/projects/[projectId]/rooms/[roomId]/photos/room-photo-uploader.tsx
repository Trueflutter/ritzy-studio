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
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.onerror = () => {
        resolve({ width: null, height: null });
      };
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function RoomPhotoUploader({
  existingCount,
  roomId,
  userId
}: {
  existingCount: number;
  roomId: string;
  userId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
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
    <div>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) {
            void uploadFiles(files);
          }
          event.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />

      <button
        className="flex min-h-[240px] w-full flex-col items-center justify-center border border-dashed border-line-strong bg-surface px-8 py-10 text-center transition-colors duration-micro ease-standard hover:border-accent-deep hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)]"
        disabled={status === "uploading" || isPending}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          const files = Array.from(event.dataTransfer.files ?? []);
          if (files.length > 0) {
            void uploadFiles(files);
          }
        }}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <span className="mb-6 flex size-16 items-center justify-center border border-line-strong bg-page text-ink">
          <ImageUploadIcon />
        </span>
        <span className="font-display text-display-xs font-light italic text-ink">
          {status === "error" ? "image could not load" : message}
        </span>
        <span className="mt-3 font-body text-body-s text-ink-muted">
          JPG, PNG, or WEBP · up to 10 MB
        </span>
        {status === "uploading" || isPending ? (
          <span className="mt-6 w-48" aria-live="polite">
            <span className="block h-px w-full bg-line">
              <span
                className="block h-px bg-accent transition-[width] duration-standard ease-standard"
                style={{
                  width: progress ? `${Math.max(10, (progress.current / progress.total) * 100)}%` : "100%"
                }}
              />
            </span>
            <span className="mt-3 block font-body text-caption font-medium uppercase text-ink-muted">
              {progress ? `${progress.current} of ${progress.total}` : "refreshing"}
            </span>
          </span>
        ) : null}
      </button>

      {status === "error" ? (
        <div className="mt-4 border-t border-error pt-4">
          <p className="font-display text-body-s italic text-error">{message}</p>
          {lastFile ? (
            <Button className="mt-4" onClick={() => void uploadFile(lastFile, existingCount === 0)} variant="secondary">
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ImageUploadIcon() {
  return (
    <svg aria-hidden="true" className="size-7" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.75 6.75A2 2 0 0 1 6.75 4.75h10.5a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2H6.75a2 2 0 0 1-2-2V6.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m7.25 16.25 3.2-3.2a1.25 1.25 0 0 1 1.77 0l.73.73 1.62-1.62a1.25 1.25 0 0 1 1.77 0l2.41 2.41"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M8.5 8.75h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}
