"use client";

import { SubmitButton } from "@ritzy-studio/ui";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

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
  clientName: string | null;
  roomType: string | null;
  showRenderCta?: boolean;
};

const VISIBLE_PER_ROLE = 3;

export function ShoppingListGrid({
  projectId,
  roomId,
  conceptId,
  shoppingListId,
  groups,
  canAccessCommerce,
  clientName,
  roomType,
  showRenderCta = true
}: ShoppingListGridProps) {
  // Optimistic picks for instant feedback; every change persists in the
  // background, so the server stays the source of truth on reload.
  const [selectedByCategory, setSelectedByCategory] = useState<Map<string, string>>(
    () =>
      new Map(
        groups
          .map((group) => {
            const defaultId = group.selectedId ?? group.items[0]?.id ?? null;
            return defaultId ? ([group.category, defaultId] as const) : null;
          })
          .filter((entry): entry is readonly [string, string] => entry !== null)
      )
  );
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<ProductCardItem | null>(null);
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const persistedDefaultsRef = useRef(false);

  useEffect(() => {
    if (persistedDefaultsRef.current) {
      return;
    }

    const defaultItemIds = groups
      .filter((group) => !group.selectedId && group.items[0])
      .map((group) => group.items[0].id);

    if (defaultItemIds.length === 0) {
      return;
    }

    persistedDefaultsRef.current = true;
    startTransition(async () => {
      for (const itemId of defaultItemIds) {
        await selectShoppingItemAction({ projectId, roomId, shoppingListId, itemId });
      }
    });
  }, [groups, projectId, roomId, shoppingListId, startTransition]);

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

  const progressGroups = groups;
  const chosenGroupCount = groups.filter((group) =>
    selectedByCategory.has(group.category)
  ).length;
  const progressPct =
    progressGroups.length > 0 ? (chosenGroupCount / progressGroups.length) * 100 : 0;
  const allGroupsChosen = groups.every((group) => selectedByCategory.has(group.category));

  const selectedIds = Array.from(selectedByCategory.values());
  const selectedCount = selectedIds.length;
  const canGenerate = selectedCount > 0 && allGroupsChosen;
  const generationUnavailableReason =
    conceptId === null
      ? "This room has no selected concept, so the render can't be generated."
      : !canGenerate
        ? "Choose a piece in every category to generate the render."
        : null;
  const roomLabel = formatRoomLabel(clientName, roomType);
  const renderCtaProps = {
    canGenerate,
    conceptId,
    generationUnavailableReason,
    projectId,
    roomId,
    roomLabel,
    selectedCount,
    selectedIds,
    shoppingListId
  };

  const drawerItem = useMemo(() => (detailItem ? detailItem.detail : null), [detailItem]);

  return (
    <div>
      <div aria-live="polite" className="border border-line bg-surface px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
            {chosenGroupCount} of {progressGroups.length} categories chosen
          </p>
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

      {showRenderCta ? (
        <RenderCta className="mt-6" placement="top" {...renderCtaProps} />
      ) : null}

      <div className="mt-12 space-y-14">
        {groups.map((group) => {
          const available = group.items.filter((item) => !rejectedIds.has(item.id));
          const chosenId = selectedByCategory.get(group.category) ?? null;
          const chosenItem = chosenId ? available.find((item) => item.id === chosenId) : null;
          const visibleOptions = available.slice(0, VISIBLE_PER_ROLE);
          const shown =
            chosenItem && !visibleOptions.some((item) => item.id === chosenId)
              ? [...visibleOptions.slice(0, VISIBLE_PER_ROLE - 1), chosenItem]
              : visibleOptions;
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
                    {group.priority === "required" ? "Core" : "Recommended"}
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

      {showRenderCta ? (
        <RenderCta className="mt-14 border-t border-line pt-10" placement="bottom" {...renderCtaProps} />
      ) : null}

      <DetailDrawer
        canAccessCommerce={canAccessCommerce}
        item={drawerItem}
        onClose={closeDetail}
        open={detailItem !== null}
      />
    </div>
  );
}

type RenderCtaProps = {
  canGenerate: boolean;
  className?: string;
  conceptId: string | null;
  generationUnavailableReason: string | null;
  placement: "top" | "bottom";
  projectId: string;
  roomId: string;
  roomLabel: string;
  selectedCount: number;
  selectedIds: string[];
  shoppingListId: string;
};

function RenderCta({
  canGenerate,
  className,
  conceptId,
  generationUnavailableReason,
  placement,
  projectId,
  roomId,
  roomLabel,
  selectedCount,
  selectedIds,
  shoppingListId
}: RenderCtaProps) {
  const selectedLabel = `${selectedCount} piece${selectedCount === 1 ? "" : "s"} selected.`;
  const title = canGenerate
    ? `Generate ${roomLabel} with selected pieces.`
    : `Choose the remaining pieces for ${roomLabel}.`;
  const description = canGenerate
    ? `${selectedLabel} The final render uses them as visual references.`
    : generationUnavailableReason ?? "Choose a piece in every category to generate the render.";

  return (
    <div
      aria-live="polite"
      className={`flex flex-col gap-5 border border-line bg-surface px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6 ${className ?? ""}`}
    >
      <div className="max-w-[640px]">
        <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
          Final render
        </p>
        <h2
          className={
            placement === "top"
              ? "mt-3 font-display text-display-xs font-light italic text-ink"
              : "mt-3 font-display text-display-m font-light italic text-ink"
          }
        >
          {title}
        </h2>
        <p className="mt-3 font-body text-body-s text-ink-secondary">{description}</p>
      </div>

      <RenderCtaForm
        canGenerate={canGenerate}
        conceptId={conceptId}
        projectId={projectId}
        roomId={roomId}
        selectedIds={selectedIds}
        shoppingListId={shoppingListId}
      />
    </div>
  );
}

function RenderCtaForm({
  canGenerate,
  conceptId,
  projectId,
  roomId,
  selectedIds,
  shoppingListId
}: {
  canGenerate: boolean;
  conceptId: string | null;
  projectId: string;
  roomId: string;
  selectedIds: string[];
  shoppingListId: string;
}) {
  const button = (
    <SubmitButton
      className="w-full md:w-auto"
      disabled={!canGenerate || conceptId === null}
      pendingLabel="Generating render..."
    >
      Generate render
    </SubmitButton>
  );

  if (!canGenerate || conceptId === null) {
    return <div className="shrink-0 md:min-w-[220px]">{button}</div>;
  }

  return (
    <form action={generateFinalRenderAction} className="shrink-0 md:min-w-[220px]">
      <input name="projectId" type="hidden" value={projectId} />
      <input name="roomId" type="hidden" value={roomId} />
      <input name="conceptId" type="hidden" value={conceptId} />
      <input name="shoppingListId" type="hidden" value={shoppingListId} />
      <input name="selectedItemIds" type="hidden" value={selectedIds.join(",")} />
      {button}
    </form>
  );
}

function formatRoomLabel(clientName: string | null, roomType: string | null) {
  const firstName = clientName?.trim().split(/\s+/)[0];
  const possessiveName = firstName ? `${firstName}${firstName.endsWith("s") ? "'" : "'s"}` : "your";
  const normalizedRoomType = roomType?.trim().toLowerCase() || "room";

  return `${possessiveName} ${normalizedRoomType}`;
}
