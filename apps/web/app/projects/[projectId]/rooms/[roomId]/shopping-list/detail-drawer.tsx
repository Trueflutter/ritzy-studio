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
        className="absolute inset-0 bg-[rgba(31,31,29,0.45)] backdrop-blur-[10px] transition-opacity duration-standard ease-standard"
        onClick={onClose}
        type="button"
      />
      <div
        aria-labelledby={`drawer-title-${item.id}`}
        aria-modal="true"
        className="absolute inset-0 overflow-y-auto px-4 py-6 md:px-8 md:py-8"
        role="dialog"
      >
        <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col items-center justify-center">
          <button
            aria-label="Close detail"
            className="fixed right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white text-ink shadow-[0_2px_18px_rgba(0,0,0,0.18)] transition-colors duration-micro ease-standard hover:bg-page"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>

          <div className="flex w-full items-center justify-center">
            {item.imageUrl ? (
              <Image
                alt={`${item.name} product image`}
                className="max-h-[72dvh] w-auto max-w-full object-contain"
                height={1400}
                src={item.imageUrl}
                unoptimized
                width={1400}
              />
            ) : (
              <div className="flex min-h-[420px] w-full max-w-[720px] items-center justify-center border border-line bg-surface font-display text-body-s italic text-error">
                image missing
              </div>
            )}
          </div>

          <section className="mt-6 w-full max-w-[760px] bg-surface px-5 py-5 text-center shadow-[0_16px_60px_rgba(0,0,0,0.18)] md:px-8 md:py-7">
            <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
              Catalog detail
            </p>
            <h2
              className="mt-4 font-display text-display-s font-light italic text-ink"
              id={`drawer-title-${item.id}`}
            >
              {item.name}
            </h2>

            {item.description ? (
              <p className="mx-auto mt-5 max-w-[620px] font-body text-body-m text-ink-secondary">
                {item.description}
              </p>
            ) : null}

            <dl className="mt-7 grid gap-5 border-t border-line pt-6 text-left md:grid-cols-3">
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
              <p className="mt-6 border border-line bg-page px-4 py-3 text-left font-display text-body-s italic text-warning">
                {item.warning}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
}
