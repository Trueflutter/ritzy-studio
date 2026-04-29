# F-016 Verification: Shopping List And Cost Estimate

## Scope

Implemented a dedicated shopping list and cost estimate page.

## Files Changed

- `apps/web/app/projects/[projectId]/rooms/[roomId]/shopping-list/page.tsx`
- `apps/web/app/projects/[projectId]/rooms/[roomId]/concepts/page.tsx`

## Implementation Notes

The shopping list page shows:

- product image
- product name
- retailer
- category
- line price
- dimensions
- availability
- retailer URL
- estimated total
- stale price/stock warning
- missing dimensions warning
- dimension fit warning where available

The concepts page now links to the shopping list when a draft shopping list exists.

## Verification Commands

Passed:

- `pnpm --filter @ritzy-studio/web lint`
- `pnpm --filter @ritzy-studio/web typecheck`
- `pnpm check`

## Review Notes

- Line items are sourced from `shopping_list_items` joined to `products`, `retailers`, and `product_dimensions`.
- No generated image output is used as a shopping-list fact source.
- The layout uses a dense table for scan/comparison behavior rather than decorative cards.

## Deferrals

- Export/download behavior is deferred to F-017.
