"use client";

import Image from "next/image";

import { CheckIcon, ExpandIcon, LockIcon } from "./icons";
import type { DetailDrawerItem } from "./detail-drawer";

export type ProductCardItem = {
  id: string;
  shoppingListId: string;
  detail: DetailDrawerItem;
  warning: string | null;
};

type ProductCardProps = {
  item: ProductCardItem;
  selected: boolean;
  canAccessCommerce: boolean;
  onSelect: (id: string) => void;
  onOpenDetail: (item: ProductCardItem) => void;
};

export function ProductCard({
  item,
  selected,
  canAccessCommerce,
  onSelect,
  onOpenDetail
}: ProductCardProps) {
  const detail = item.detail;
  const handleSelect = () => {
    if (!selected) {
      onSelect(item.id);
    }
  };

  return (
    <article
      className={`relative flex h-full cursor-pointer flex-col border bg-surface p-[14px] transition-colors duration-micro ease-standard ${
        selected ? "border-ink" : "border-line hover:bg-surface-subtle"
      }`}
      onClick={handleSelect}
    >
      {selected ? (
        <span
          aria-hidden
          className="absolute right-[18px] top-[18px] z-10 flex h-6 w-6 items-center justify-center border border-ink bg-ink text-surface"
        >
          <CheckIcon className="text-surface" />
        </span>
      ) : null}

      <div className="group/image relative block aspect-square w-full overflow-hidden border border-line bg-page text-left">
        {detail.imageUrl ? (
          <Image
            alt={`${detail.name} product image`}
            className="h-full w-full object-cover transition-transform duration-standard ease-standard hover:scale-[1.02]"
            height={720}
            src={detail.imageUrl}
            unoptimized
            width={720}
          />
        ) : (
          <div className="flex h-full items-center justify-center font-display text-body-s italic text-error">
            image missing
          </div>
        )}
        <button
          aria-label={`Open larger view for ${detail.name}`}
          className="pointer-events-none absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white text-ink opacity-0 shadow-[0_2px_16px_rgba(0,0,0,0.18)] transition-[opacity,background-color] duration-micro ease-standard hover:bg-page focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/image:pointer-events-auto group-hover/image:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onOpenDetail(item);
          }}
          type="button"
        >
          <ExpandIcon className="text-ink" />
        </button>
      </div>

      <div className="mt-5 flex flex-1 flex-col px-[6px] pb-[6px]">
        <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
          {canAccessCommerce ? `${detail.retailerName ?? "Retailer"} · ${detail.category}` : "Retailer · locked"}
        </p>
        <h3 className="mt-3 font-display text-display-xs font-light italic leading-snug text-ink">
          {detail.name}
        </h3>

        <div className="mt-4 flex-1 space-y-2 font-body text-body-s text-ink-secondary">
          <p>
            <span className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
              Price ·{" "}
            </span>
            <span className="font-display text-body-l font-light italic text-ink">
              {detail.priceLabel}
            </span>
          </p>
          <p>
            <span className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
              Dimensions ·{" "}
            </span>
            {detail.dimensionsLabel}
          </p>
          <p className="flex items-center gap-2">
            <span className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
              Retailer ·{" "}
            </span>
            {canAccessCommerce && detail.retailerUrl ? (
              <a
                className="font-display text-button-quiet italic text-ink transition-colors duration-micro ease-standard hover:text-accent-deep"
                href={detail.retailerUrl}
                onClick={(event) => event.stopPropagation()}
                rel="noreferrer"
                target="_blank"
              >
                open page →
              </a>
            ) : (
              <span
                aria-label="Locked. Unlock the room to view the retailer link."
                className="inline-flex items-center gap-1.5 text-ink-muted"
                title="Locked — unlock to view retailer"
              >
                <LockIcon className="text-ink-muted" />
                locked
              </span>
            )}
          </p>
        </div>

        {item.warning ? (
          <p className="mt-4 border border-line bg-page px-3 py-2 font-display text-body-s italic text-warning">
            {item.warning}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <button
            aria-pressed={selected}
            className={`inline-flex h-[44px] items-center justify-center gap-2 border px-5 font-body text-button font-medium uppercase tracking-[0.18em] transition-colors duration-micro ease-standard ${
              selected
                ? "border-ink bg-ink text-surface hover:bg-primary-hover"
                : "border-line-strong bg-transparent text-ink hover:border-ink"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(item.id);
            }}
            type="button"
          >
            {selected ? "Selected" : "Select"}
          </button>

        </div>
      </div>
    </article>
  );
}
