"use client";

import { SubmitButton } from "@ritzy-studio/ui";
import { useCallback, useMemo, useState, useTransition } from "react";

import {
  findMoreShoppingOptionsAction,
  generateFinalRenderAction,
  refreshShoppingOptionsAction,
  selectShoppingItemAction
} from "@/app/actions";
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

const VISIBLE_PER_ROLE = 3;

export function ShoppingListGrid({
  projectId,
  roomId,
  conceptId,
  shoppingListId,
  groups,
  canAccessCommerce
}: ShoppingListGridProps) {
  // Optimistic picks for instant feedback; every change persists in the
  // background, so the server stays the source of truth on reload.
  const [selectedByCategory, setSelectedByCategory] = useState<Map<string, string>>(
    () => new Map(groups.filter((g) => g.selectedId).map((g) => [g.category, g.selectedId!]))
  );
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<ProductCardItem | null>(null);
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const idToCategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      for (const item of group.items) {
        map.set(item.id, group.category);
      }
    }
    return map;
  }, [groups]);

  const handleSelect = useCallback(
    (id: string) => {
      const category = idToCategory.get(id);
      if (!category || selectedByCategory.get(category) === id) {
        return;
      }
      setPendingCategory(null);
      setSelectedByCategory((prev) => new Map(prev).set(category, id));
      setRejectedIds((prev) => {
        if (!prev.has(id)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      startTransition(async () => {
        await selectShoppingItemAction({ projectId, roomId, shoppingListId, itemId: id });
      });
    },
    [idToCategory, selectedByCategory, projectId, roomId, shoppingListId]
  );

  const handleFindMore = useCallback(
    (category: string) => {
      setPendingCategory(category);
      startTransition(async () => {
        await findMoreShoppingOptionsAction({ projectId, roomId, shoppingListId, category });
      });
    },
    [projectId, roomId, shoppingListId]
  );

  const handleRefreshOptions = useCallback(
    (category: string, visibleOptionIds: string[]) => {
      setPendingCategory(category);
      setRejectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleOptionIds) {
          next.add(id);
        }
        return next;
      });
      startTransition(async () => {
        await refreshShoppingOptionsAction({ projectId, roomId, shoppingListId, category });
      });
    },
    [projectId, roomId, shoppingListId]
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
  const allRequiredChosen = requiredGroups.every((group) =>
    selectedByCategory.has(group.category)
  );

  const selectedIds = Array.from(selectedByCategory.values());
  const selectedCount = selectedIds.length;
  const canGenerate = selectedCount > 0 && allRequiredChosen;

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
          Each category offers a few options — click a card to choose it, or refresh the
          category to replace the unselected options.
        </p>
      </div>

      <div className="mt-12 space-y-14">
        {groups.map((group) => {
          const available = group.items.filter((item) => !rejectedIds.has(item.id));
          const chosenId = selectedByCategory.get(group.category) ?? null;
          const chosenItem = chosenId ? available.find((item) => item.id === chosenId) : null;
          const shown = chosenItem
            ? [
                chosenItem,
                ...available
                  .filter((item) => item.id !== chosenId)
                  .slice(0, VISIBLE_PER_ROLE - 1)
              ]
            : available.slice(0, VISIBLE_PER_ROLE);
          const needsMore = available.length < VISIBLE_PER_ROLE;
          const finding = isPending && pendingCategory === group.category;
          const refreshableIds = shown
            .filter((item) => item.id !== chosenId)
            .map((item) => item.id);
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
                {chosenId ? (
                  <button
                    className="font-body text-caption font-medium uppercase tracking-[0.32em] text-accent-deep transition-colors duration-micro ease-standard hover:text-ink disabled:text-ink-muted"
                    disabled={finding || refreshableIds.length === 0}
                    onClick={() => handleRefreshOptions(group.category, refreshableIds)}
                    type="button"
                  >
                    {finding ? "Refreshing..." : "Refresh options"}
                  </button>
                ) : (
                  <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                    Choose one
                  </p>
                )}
              </div>

              {shown.length > 0 ? (
                <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {shown.map((item) => (
                    <ProductCard
                      canAccessCommerce={canAccessCommerce}
                      item={item}
                      key={item.id}
                      onOpenDetail={openDetail}
                      onSelect={handleSelect}
                      selected={chosenId === item.id}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-6 font-display text-body-m italic text-ink-muted">
                  Every option here was rejected.
                </p>
              )}

              {needsMore ? (
                <button
                  className="mt-5 inline-flex items-center gap-1.5 font-display text-button-quiet italic text-ink transition-colors duration-micro ease-standard hover:text-accent-deep disabled:text-ink-muted"
                  disabled={finding}
                  onClick={() => handleFindMore(group.category)}
                  type="button"
                >
                  {finding ? "Finding more options..." : "Find more options"}
                  {finding ? null : (
                    <span aria-hidden className="text-accent-deep">
                      →
                    </span>
                  )}
                </button>
              ) : null}
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
            {canGenerate
              ? "Confirm selections and generate the grounded render."
              : "Choose a piece for every required category."}
          </h2>
          <p className="mt-3 font-body text-body-s text-ink-secondary">
            {canGenerate
              ? `${selectedCount} piece${selectedCount === 1 ? "" : "s"} chosen. The render uses them as visual references.`
              : "Pick a piece in every required category to generate the render."}
          </p>
        </div>

        {canGenerate ? (
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
