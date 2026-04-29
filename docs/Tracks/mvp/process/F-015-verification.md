# F-015 Verification: Final Grounded Render Generation

## Scope

Implemented final grounded render generation from:

- original room photo
- selected concept
- selected shopping list products
- selected product images where fetchable

## Files Changed

- `packages/prompts/src/index.ts`
- `packages/ai/src/index.ts`
- `packages/db/src/types.ts`
- `supabase/migrations/20260429174000_render_job_provenance.sql`
- `apps/web/app/actions.ts`
- `apps/web/app/projects/[projectId]/rooms/[roomId]/concepts/page.tsx`

## Implementation Notes

Added:

- `render.final_grounded_room` prompt
- final grounded render AI helper
- multiple-image edit call with original room photo as the first image
- selected product images as additional references where fetchable
- render job product provenance
- render job prompt provenance
- final render upload to `generated-renders`
- final render asset records with `asset_type = final_render`
- failure/retry behavior through a repeatable render action
- final render review UI on the concept page

The UI explicitly states:

- product images are visual references where available
- exact SKU reproduction is not guaranteed
- the shopping list remains the source of truth

## Database Change

Added to `public.render_jobs`:

- `prompt_key text`
- `product_ids uuid[]`
- `input_summary jsonb`

## Verification Commands

Passed:

- `pnpm --filter @ritzy-studio/ai typecheck`
- `pnpm --filter @ritzy-studio/web lint`
- `pnpm --filter @ritzy-studio/web typecheck`
- `pnpm check`

## Deferrals

- A live final render was not generated in this slice because it requires a fully populated local project with selected concept, room photo, and draft shopping list products. The action is wired for that runtime path and stores failed render jobs if generation fails.
- Masks are still deferred. The prompt preserves architecture, but mask-specific protection is a later enhancement.
