# F-014 Verification: Product Substitution Loop

## Scope

Implemented line-level product substitution for draft shopping lists.

The designer can now request alternatives for a matched product without changing unrelated selections.

## Files Changed

- `packages/domain/src/product-matching.ts`
- `packages/domain/src/product-matching.test.ts`
- `apps/web/app/actions.ts`
- `apps/web/app/projects/[projectId]/rooms/[roomId]/concepts/page.tsx`

## Implementation Notes

Added substitution modes:

- cheaper option
- closer style
- same retailer
- in stock only

The substitution action:

- targets a single `shopping_list_items` row
- keeps all other draft shopping list rows unchanged
- filters alternatives to the same normalized category
- excludes already selected products
- ranks alternatives using the product matching rubric
- updates the selected row with product ID, price, reason, and fit note
- recalculates the draft shopping list total
- redirects with the price impact

The product card UI now includes a compact swap control for each matched item.

## Verification Commands

Passed:

- `pnpm --filter @ritzy-studio/domain test`
- `pnpm --filter @ritzy-studio/web lint`
- `pnpm --filter @ritzy-studio/web typecheck`
- `pnpm check`

## Review Notes

- Substitution preserves unaffected selections by updating only the requested item row.
- Requests are category-scoped, so a cheaper sofa request cannot replace rugs, lighting, or unrelated products.
- Replacement facts remain catalog-backed.
- Price impact is visible in the redirect message and the updated shopping list total.

## Deferrals

- Free-text substitution requests are deferred. F-014 ships controlled modes first to keep behavior reliable.
- Multi-item category substitutions, such as replacing every armchair line at once, can be added as a follow-up if needed.
