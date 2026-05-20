"use client";

import { SubmitButton } from "@ritzy-studio/ui";
import { useCallback, useMemo, useState } from "react";

import { generateFinalRenderAction } from "@/app/actions";
import { DetailDrawer } from "./detail-drawer";
import { ProductCard, type ProductCardItem } from "./product-card";

export type CategoryGroup = {
  category: string;
  label: string;
  priority: "required" | "supporting";
  quantity: number;
  selectedId: string | null;
  items: ProductCardItem[];
};

type ShoppingListGridProps = {
  projectId: string;
  roomId: string;
  conceptId: string | null;
  shoppingListId: string;
  groups: CategoryGroup[];
  canAccessCommerce: boolean;
};

export function ShoppingListGrid({
  projectId,
  roomId,
  conceptId,
  shoppingListId,
  groups,
  canAccessCommerce
}: ShoppingListGridProps) {
  // One pick per role; the sourced selection seeds the picker.
  const [selectedByCategory, setSelectedByCategory] = useState<Map<string, string>>(
    () => new Map(groups.filter((g) => g.selectedId).map((g) => [g.category, g.selectedId!]))
  );
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<ProductCardItem | null>(null);

  const idToCategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      for (const item of group.items) {
        map.set(item.id, group.category);
      }
    }
    return map;
  }, [groups]);

  const toggleSelected = useCallback(
    (id: string) => {
      const category = idToCategory.get(id);
      if (!category) {
        return;
      }
      setSelectedByCategory((prev) => {
        const next = new Map(prev);
        if (next.get(category) === id) {
          next.delete(category);
        } else {
          next.set(category, id);
        }
        return next;
      });
      // A piece can't be both chosen and rejected.
      setRejectedIds((prev) => {
        if (!prev.has(id)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [idToCategory]
  );

  const toggleRejected = useCallback(
    (id: string) => {
      const category = idToCategory.get(id);
      setRejectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      if (category) {
        setSelectedByCategory((prev) => {
          if (prev.get(category) !== id) {
            return prev;
          }
          const next = new Map(prev);
          next.delete(category);
          return next;
        });
      }
    },
    [idToCategory]
  );

  const openDetail = useCallback((item: ProductCardItem) => setDetailItem(item), []);
  const closeDetail = useCallback(() => setDetailItem(null), []);

  const requiredGroups = useMemo(
    () => groups.filter((group) => group.priority === "required"),
    [groups]
  );
  const optionalCount = groups.length - requiredGroups.length;
  const progressGroups = requiredGroups.length > 0 ? requiredGroups : groups;
  const progressLabel = requiredGroups.length > 0 ? "essentials" : "categories";
  const chosenGroupCount = progressGroups.filter((group) =>
    selectedByCategory.has(group.category)
  ).length;
  const progressPct =
    progressGroups.length > 0 ? (chosenGroupCount / progressGroups.length) * 100 : 0;

  const selectedIds = Array.from(selectedByCategory.values());
  const selectedCount = selectedIds.length;

  // The final render is a commerce feature — say so plainly rather than
  // leaving the button greyed with no reason.
  const renderLockReason = !canAccessCommerce
    ? "The final render is part of the unlocked room — unlock it from the Estimate panel above."
    : conceptId === null
      ? "This room has no selected concept, so the render can't be generated."
      : null;

  const drawerItem = useMemo(() => (detailItem ? detailItem.detail : null), [detailItem]);

  return (
    <div>
      <div aria-live="polite" className="border border-line bg-surface px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
            {chosenGroupCount} of {progressGroups.length} {progressLabel} chosen
          </p>
          {optionalCount > 0 ? (
            <p className="font-body text-body-s text-ink-muted">
              {optionalCount} optional categor{optionalCount === 1 ? "y" : "ies"} below
            </p>
          ) : null}
        </div>
        <div className="mt-3 h-[2px] w-full bg-line">
          <div
            className="h-full bg-ink transition-[width] duration-standard ease-standard"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-4 font-body text-body-s text-ink-secondary">
          Each category offers a few options — pick the one you want, or reject the ones that
          miss.
        </p>
      </div>

      <div className="mt-12 space-y-14">
        {groups.map((group) => {
          const chosenId = selectedByCategory.get(group.category) ?? null;
          return (
            <section key={group.category}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
                <div className="flex items-baseline gap-3">
                  <h2 className="font-display text-display-xs font-light italic capitalize text-ink">
                    {group.label}
                  </h2>
                  <span className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                    {group.priority === "required" ? "Required" : "Optional"}
                    {group.quantity > 1 ? ` · Buy ${group.quantity}` : ""}
                  </span>
                </div>
                <p
                  className={`font-body text-caption font-medium uppercase tracking-[0.32em] ${
                    chosenId ? "text-accent-deep" : "text-ink-muted"
                  }`}
                >
                  {chosenId ? "Chosen" : "Choose one"}
                </p>
              </div>
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => (
                  <ProductCard
                    canAccessCommerce={canAccessCommerce}
                    item={item}
                    key={item.id}
                    onOpenDetail={openDetail}
                    onToggleRejected={toggleRejected}
                    onToggleSelected={toggleSelected}
                    projectId={projectId}
                    rejected={rejectedIds.has(item.id)}
                    roomId={roomId}
                    selected={chosenId === item.id}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div
        aria-live="polite"
        className="mt-14 flex flex-col gap-6 border-t border-line pt-10 md:flex-row md:items-end md:justify-between"
      >
        <div className="max-w-[560px]">
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
            Final render
          </p>
          <h2 className="mt-3 font-display text-display-m font-light italic text-ink">
            {selectedCount > 0
              ? "Confirm selections and generate the grounded render."
              : "Choose pieces to generate the grounded render."}
          </h2>
          <p className="mt-3 font-body text-body-s text-ink-secondary">
            {selectedCount > 0
              ? `${selectedCount} piece${selectedCount === 1 ? "" : "s"} chosen. The render uses them as visual references.`
              : "Pick a piece in each category above. Selection is held locally for now."}
          </p>
        </div>

        {selectedCount > 0 ? (
          renderLockReason ? (
            <p className="shrink-0 border border-line bg-surface px-4 py-3 font-display text-body-m italic text-ink-secondary md:max-w-[320px]">
              {renderLockReason}
            </p>
          ) : (
            <form action={generateFinalRenderAction} className="shrink-0">
              <input name="projectId" type="hidden" value={projectId} />
              <input name="roomId" type="hidden" value={roomId} />
              <input name="conceptId" type="hidden" value={conceptId ?? ""} />
              <input name="shoppingListId" type="hidden" value={shoppingListId} />
              <input name="selectedItemIds" type="hidden" value={selectedIds.join(",")} />
              <SubmitButton pendingLabel="Generating final render...">
                Confirm selections and generate render
              </SubmitButton>
            </form>
          )
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
