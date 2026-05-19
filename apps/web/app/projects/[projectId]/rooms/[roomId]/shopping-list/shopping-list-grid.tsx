"use client";

import { SubmitButton } from "@ritzy-studio/ui";
import { useCallback, useMemo, useState } from "react";

import { generateFinalRenderAction } from "@/app/actions";
import { DetailDrawer } from "./detail-drawer";
import { ProductCard, type ProductCardItem } from "./product-card";

type ShoppingListGridProps = {
  projectId: string;
  roomId: string;
  conceptId: string | null;
  shoppingListId: string;
  items: ProductCardItem[];
  canAccessCommerce: boolean;
};

export function ShoppingListGrid({
  projectId,
  roomId,
  conceptId,
  shoppingListId,
  items,
  canAccessCommerce
}: ShoppingListGridProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<ProductCardItem | null>(null);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const openDetail = useCallback((item: ProductCardItem) => {
    setDetailItem(item);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailItem(null);
  }, []);

  const selectedCount = selectedIds.size;
  const canRender = selectedCount > 0 && canAccessCommerce && conceptId !== null;

  const drawerItem = useMemo(() => (detailItem ? detailItem.detail : null), [detailItem]);

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <ProductCard
            canAccessCommerce={canAccessCommerce}
            item={item}
            key={item.id}
            onOpenDetail={openDetail}
            onToggleSelected={toggleSelected}
            projectId={projectId}
            roomId={roomId}
            selected={selectedIds.has(item.id)}
          />
        ))}
      </div>

      <div
        aria-live="polite"
        className="mt-12 flex flex-col gap-6 border-t border-line pt-10 md:flex-row md:items-end md:justify-between"
      >
        <div className="max-w-[560px]">
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
            Final render
          </p>
          <h2 className="mt-3 font-display text-display-m font-light italic text-ink">
            {selectedCount > 0
              ? "Confirm selections and generate the grounded render."
              : "Select pieces to generate the grounded render."}
          </h2>
          <p className="mt-3 font-body text-body-s text-ink-secondary">
            {selectedCount > 0
              ? `${selectedCount} piece${selectedCount === 1 ? "" : "s"} chosen. The render uses the selected pieces as visual references.`
              : "Tap Select on any piece you want included in the final render. Selection is held locally for now."}
          </p>
        </div>

        {selectedCount > 0 ? (
          <form action={generateFinalRenderAction} className="shrink-0">
            <input name="projectId" type="hidden" value={projectId} />
            <input name="roomId" type="hidden" value={roomId} />
            <input name="conceptId" type="hidden" value={conceptId ?? ""} />
            <input name="shoppingListId" type="hidden" value={shoppingListId} />
            <SubmitButton
              disabled={!canRender}
              pendingLabel="Generating final render..."
            >
              Confirm selections and generate render
            </SubmitButton>
          </form>
        ) : null}
      </div>

      <DetailDrawer
        canAccessCommerce={canAccessCommerce}
        item={drawerItem}
        onClose={closeDetail}
        open={detailItem !== null}
      />
    </div>
  );
}
