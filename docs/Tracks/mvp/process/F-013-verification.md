# F-013 Verification: Product Search And Matching

## Scope

Implemented the first concept-to-product grounding workflow.

The designer can now:

- select a generated concept
- trigger product matching from the concept page
- see real product cards from catalog records
- inspect price, retailer, URL, availability, dimensions, estimated total, and warnings

## Files Changed

- `packages/domain/src/product-matching.ts`
- `packages/domain/src/product-matching.test.ts`
- `packages/domain/src/index.ts`
- `packages/domain/package.json`
- `apps/web/app/actions.ts`
- `apps/web/app/projects/[projectId]/rooms/[roomId]/concepts/page.tsx`

## Implementation Notes

Added a deterministic product matching rubric that ranks candidates using:

- room category fit
- concept text/tag overlap
- image availability
- stated budget fit
- availability
- entered room measurements where available
- stale price/stock warnings

The product grounding action:

- requires a selected concept
- reads catalog products from `products`
- ranks candidates with the domain rubric
- creates or refreshes a draft shopping list
- writes `shopping_list_items` from real product records only
- updates the room to `sourcing`

The concept page now includes a product grounding section with:

- match trigger
- estimated catalog total
- product image
- product name
- retailer
- category
- price
- stock
- dimensions
- retailer URL
- fit/staleness warnings

## Verification Commands

Passed:

- `pnpm --filter @ritzy-studio/domain test`
- `pnpm --filter @ritzy-studio/web lint`
- `pnpm --filter @ritzy-studio/web typecheck`
- `pnpm check`

## Review Notes

- Product shopping facts are read from product/catalog tables, not generated image pixels.
- Missing dimensions are surfaced as warnings instead of hidden.
- Stale product data is warned when `last_checked_at` is missing or older than seven days.
- Ranking scores are internal only; the UI does not show percentages.

## Deferrals

- Product substitution controls are deferred to F-014.
- Vector search RPC is not required for this slice. F-013 ranks with structured catalog fields and model-enriched tags. Embeddings from F-012 remain available for a future vector retrieval upgrade.
