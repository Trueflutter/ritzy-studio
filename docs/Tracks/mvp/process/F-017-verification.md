# F-017 Verification: Client Presentation And Export View

## Scope

Implemented a client-ready presentation route.

## Files Changed

- `apps/web/app/projects/[projectId]/rooms/[roomId]/presentation/page.tsx`
- `apps/web/app/projects/[projectId]/rooms/[roomId]/presentation/print-button.tsx`
- `apps/web/app/projects/[projectId]/rooms/[roomId]/shopping-list/page.tsx`

## Implementation Notes

The presentation view includes:

- project/client context
- room context
- estimated total
- final render where available
- selected concept title and description
- selected product list
- product images
- retailer, category, availability, dimensions, price
- retailer links
- professional caveat notes

Export strategy:

- browser print/save-PDF via `window.print()`
- print-aware layout classes

## Verification Commands

Passed:

- `pnpm --filter @ritzy-studio/web lint`
- `pnpm --filter @ritzy-studio/web typecheck`
- `pnpm check`

## Deferrals

- Founder/designer walk is deferred until the founder can review populated project data.
- Native PDF/PPT export is deferred. The current export path is browser print/save-PDF.
