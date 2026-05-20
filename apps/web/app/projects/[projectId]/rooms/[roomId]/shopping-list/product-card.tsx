"use client";

import Image from "next/image";
import { SubmitButton } from "@ritzy-studio/ui";
import { useState } from "react";

import { substituteProductAction } from "@/app/actions";
import { CheckIcon, LockIcon } from "./icons";
import type { DetailDrawerItem } from "./detail-drawer";

export type ProductCardItem = {
  id: string;
  shoppingListId: string;
  detail: DetailDrawerItem;
  warning: string | null;
};

type ProductCardProps = {
  item: ProductCardItem;
  projectId: string;
  roomId: string;
  selected: boolean;
  rejected: boolean;
  selectionDisabled: boolean;
  canAccessCommerce: boolean;
  onToggleSelected: (id: string) => void;
  onToggleRejected: (id: string) => void;
  onOpenDetail: (item: ProductCardItem) => void;
};

export function ProductCard({
  item,
  projectId,
  roomId,
  selected,
  rejected,
  selectionDisabled,
  canAccessCommerce,
  onToggleSelected,
  onToggleRejected,
  onOpenDetail
}: ProductCardProps) {
  const [showSwap, setShowSwap] = useState(false);
  const detail = item.detail;
  const showSwapForm = !selected && !rejected && canAccessCommerce && showSwap;

  return (
    <article
      className={`relative flex h-full flex-col border bg-surface p-[14px] transition-colors duration-micro ease-standard ${
        rejected
          ? "border-line opacity-60"
          : selected
            ? "border-ink"
            : "border-line hover:bg-surface-subtle"
      }`}
    >
      {selected ? (
        <span
          aria-hidden
          className="absolute right-[18px] top-[18px] z-10 flex h-6 w-6 items-center justify-center border border-ink bg-ink text-surface"
        >
          <CheckIcon className="text-surface" />
        </span>
      ) : null}

      <button
        aria-label={`Open detail for ${detail.name}`}
        className="block aspect-square w-full overflow-hidden border border-line bg-page text-left"
        onClick={() => onOpenDetail(item)}
        type="button"
      >
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
      </button>

      <div className="mt-5 flex flex-1 flex-col px-[6px] pb-[6px]">
        <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
          {detail.retailerName ?? "Retailer"} · {detail.category}
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
          {rejected ? (
            <>
              <span className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                Rejected
              </span>
              <button
                className="inline-flex items-center gap-1 font-display text-button-quiet italic text-ink transition-colors duration-micro ease-standard hover:text-accent-deep"
                onClick={() => onToggleRejected(item.id)}
                type="button"
              >
                Undo
              </button>
            </>
          ) : (
            <>
              <button
                aria-pressed={selected}
                className={`inline-flex h-[44px] items-center justify-center gap-2 border px-5 font-body text-button font-medium uppercase tracking-[0.18em] transition-colors duration-micro ease-standard ${
                  selected
                    ? "border-ink bg-ink text-surface hover:bg-primary-hover"
                    : selectionDisabled
                      ? "cursor-not-allowed border-line bg-transparent text-ink-muted"
                      : "border-line-strong bg-transparent text-ink hover:border-ink"
                }`}
                disabled={!selected && selectionDisabled}
                onClick={() => onToggleSelected(item.id)}
                title={
                  !selected && selectionDisabled
                    ? "This category's picks are full — deselect one to swap."
                    : undefined
                }
                type="button"
              >
                {selected ? "Selected" : "Select"}
              </button>

              {selected ? null : (
                <button
                  className="inline-flex items-center gap-1 font-display text-button-quiet italic text-ink-muted transition-colors duration-micro ease-standard hover:text-ink"
                  onClick={() => onToggleRejected(item.id)}
                  type="button"
                >
                  Reject
                </button>
              )}

              {!selected && canAccessCommerce ? (
                <button
                  aria-expanded={showSwap}
                  className="inline-flex items-center gap-1 font-display text-button-quiet italic text-ink transition-colors duration-micro ease-standard hover:text-accent-deep"
                  onClick={() => setShowSwap((prev) => !prev)}
                  type="button"
                >
                  {showSwap ? "Cancel swap" : "Swap"}
                  <span aria-hidden className="text-accent-deep">
                    →
                  </span>
                </button>
              ) : null}
            </>
          )}
        </div>

        {showSwapForm ? (
          <form
            action={substituteProductAction}
            className="mt-4 border-t border-line pt-4"
          >
            <input name="projectId" type="hidden" value={projectId} />
            <input name="roomId" type="hidden" value={roomId} />
            <input name="shoppingListId" type="hidden" value={item.shoppingListId} />
            <input name="itemId" type="hidden" value={item.id} />
            <label
              className="mb-2 block font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted"
              htmlFor={`swap-mode-${item.id}`}
            >
              Swap request
            </label>
            <select
              className="h-[44px] w-full border border-line-strong bg-transparent px-3 font-body text-body-s text-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ring"
              defaultValue="cheaper"
              id={`swap-mode-${item.id}`}
              name="mode"
            >
              <option value="cheaper">cheaper option</option>
              <option value="closer_style">closer style</option>
              <option value="same_retailer">same retailer</option>
              <option value="in_stock">in stock only</option>
            </select>
            <SubmitButton
              className="mt-3 w-full"
              pendingLabel="Finding substitute..."
              variant="secondary"
            >
              Swap this item
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </article>
  );
}
