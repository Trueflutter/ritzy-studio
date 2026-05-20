"use client";

import { useRef, type ReactNode } from "react";

import { Button } from "./button";

export type DropzoneProgress = { current: number; total: number };

export type ImageDropzoneError = {
  message: string;
  onRetry?: () => void;
};

type ImageDropzoneProps = {
  accept: string;
  multiple?: boolean;
  busy?: boolean;
  icon?: ReactNode;
  prompt: string;
  description?: string;
  hint: string;
  showProgress?: boolean;
  progress?: DropzoneProgress | null;
  error?: ImageDropzoneError | null;
  onFiles: (files: File[]) => void;
};

export function ImageDropzone({
  accept,
  multiple = false,
  busy = false,
  icon,
  prompt,
  description,
  hint,
  showProgress = false,
  progress,
  error,
  onFiles
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function emit(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length > 0) {
      onFiles(files);
    }
  }

  return (
    <div>
      <input
        accept={accept}
        className="sr-only"
        multiple={multiple}
        onChange={(event) => {
          emit(event.target.files);
          event.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />

      <button
        className="flex min-h-[240px] w-full flex-col items-center justify-center border border-dashed border-line-strong bg-surface px-8 py-10 text-center transition-colors duration-micro ease-standard hover:border-accent-deep hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rs-focus-ring)]"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          emit(event.dataTransfer.files);
        }}
        type="button"
      >
        <span className="mb-6 flex size-16 items-center justify-center border border-line-strong bg-page text-ink">
          {icon ?? <ImageIcon />}
        </span>
        <span className="font-display text-display-xs font-light italic text-ink">{prompt}</span>
        {description ? (
          <span className="mt-3 max-w-[42ch] font-body text-body-s text-ink-muted">{description}</span>
        ) : null}
        <span className="mt-3 font-body text-body-s text-ink-muted">{hint}</span>

        {busy && showProgress ? (
          <span aria-live="polite" className="mt-6 w-48">
            <span className="block h-px w-full bg-line">
              <span
                className="block h-px bg-accent transition-[width] duration-standard ease-standard"
                style={{
                  width: progress
                    ? `${Math.max(10, (progress.current / progress.total) * 100)}%`
                    : "100%"
                }}
              />
            </span>
            <span className="mt-3 block font-body text-caption font-medium uppercase text-ink-muted">
              {progress ? `${progress.current} of ${progress.total}` : "refreshing"}
            </span>
          </span>
        ) : null}
      </button>

      {error ? (
        <div className="mt-4 border-t border-error pt-4">
          <p className="font-display text-body-s italic text-error">{error.message}</p>
          {error.onRetry ? (
            <Button className="mt-4" onClick={error.onRetry} variant="secondary">
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ImageIcon() {
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
      <path d="M8.5 8.75h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
