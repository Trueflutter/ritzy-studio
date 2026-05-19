"use client";

import Image from "next/image";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { CloseIcon, LockIcon } from "./icons";

export type DetailDrawerItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  retailerName: string | null;
  category: string;
  priceLabel: string;
  dimensionsLabel: string;
  description: string | null;
  retailerUrl: string | null;
  warning: string | null;
};

type DetailDrawerProps = {
  item: DetailDrawerItem | null;
  open: boolean;
  canAccessCommerce: boolean;
  onClose: () => void;
};

export function DetailDrawer({ item, open, canAccessCommerce, onClose }: DetailDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  if (!open || !item) {
    return null;
  }

  return createPortal(
    <div
      aria-hidden={!open}
      className="fixed inset-0 z-50"
      role="presentation"
    >
      <button
        aria-label="Close detail"
        className="absolute inset-0 bg-[rgba(31,31,29,0.30)] backdrop-blur-[8px] transition-opacity duration-standard ease-standard"
        onClick={onClose}
        type="button"
      />
      <aside
        aria-labelledby={`drawer-title-${item.id}`}
        aria-modal="true"
        className="absolute right-0 top-0 flex h-full w-[min(92vw,480px)] flex-col border-l border-line bg-surface"
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-line px-8 py-6">
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
            Catalog detail
          </p>
          <button
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center border border-transparent text-ink transition-colors duration-micro ease-standard hover:border-line"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="aspect-square border border-line bg-page">
            {item.imageUrl ? (
              <Image
                alt={`${item.name} product image`}
                className="h-full w-full object-cover"
                height={960}
                src={item.imageUrl}
                unoptimized
                width={960}
              />
            ) : (
              <div className="flex h-full items-center justify-center font-display text-body-s italic text-error">
                image missing
              </div>
            )}
          </div>

          <h2
            className="mt-6 font-display text-display-s font-light italic text-ink"
            id={`drawer-title-${item.id}`}
          >
            {item.name}
          </h2>

          {item.retailerName ? (
            <p className="mt-3 font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
              {item.retailerName} · {item.category}
            </p>
          ) : null}

          {item.description ? (
            <p className="mt-6 font-body text-body-m text-ink-secondary">
              {item.description}
            </p>
          ) : null}

          <dl className="mt-8 space-y-5 border-t border-line pt-6">
            <div>
              <dt className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                Price
              </dt>
              <dd className="mt-2 font-display text-body-l font-light italic text-ink">
                {item.priceLabel}
              </dd>
            </div>
            <div>
              <dt className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                Dimensions
              </dt>
              <dd className="mt-2 font-body text-body-s text-ink-secondary">
                {item.dimensionsLabel}
              </dd>
            </div>
            <div>
              <dt className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                Retailer
              </dt>
              <dd className="mt-2">
                {canAccessCommerce && item.retailerUrl ? (
                  <a
                    className="group inline-flex items-center gap-2 font-display text-button-quiet italic text-ink transition-colors duration-micro ease-standard hover:text-accent-deep"
                    href={item.retailerUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open retailer page
                    <span aria-hidden className="text-accent-deep transition-transform duration-standard ease-standard group-hover:translate-x-1">
                      →
                    </span>
                  </a>
                ) : (
                  <span
                    aria-label="Locked. Unlock the room to view the retailer link."
                    className="inline-flex items-center gap-2 font-body text-body-s text-ink-muted"
                    title="Locked — unlock to view retailer"
                  >
                    <LockIcon className="text-ink-muted" />
                    Locked
                  </span>
                )}
              </dd>
            </div>
          </dl>

          {item.warning ? (
            <p className="mt-6 border border-line bg-page px-4 py-3 font-display text-body-s italic text-warning">
              {item.warning}
            </p>
          ) : null}
        </div>
      </aside>
    </div>,
    document.body
  );
}
