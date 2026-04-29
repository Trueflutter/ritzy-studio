# F-018 Verification: MVP Hardening And Review Passes

## Scope

Final MVP hardening and review pass across code, docs, design, UX, and operational readiness.

## Automated Verification

Passed:

- `pnpm --filter @ritzy-studio/domain test`
- `pnpm --filter @ritzy-studio/prompts test`
- `pnpm --filter @ritzy-studio/ai test`
- `pnpm --filter @ritzy-studio/ingestion test`
- `pnpm validate-env`
- `pnpm check`

`pnpm check` includes:

- web lint
- repo typecheck
- web production build

## Design Guardian Pass

Completed against `docs/Vision/05_Brand_and_Design_System.md`.

Checks performed:

- no forbidden `#000000` or `#FFFFFF` use found in app/UI files
- no decorative gradient use found in app/UI files
- square/hairline visual language preserved
- 52px button system preserved
- data-dense shopping list uses table layout rather than decorative card layout
- product and presentation views keep SKU caveats visible

Finding:

- No blocking design drift found.

## UX Guardian Pass

Completed on the implemented workflow:

1. auth
2. project/room creation
3. photo upload
4. brief and clarifying questions
5. concept generation
6. critique/revision
7. selected concept
8. product matching
9. product substitution
10. final grounded render
11. shopping list
12. presentation/print view

Finding:

- No blocking flow gaps found in the implemented path.

## Code Review Pass

Reviewed the main runtime risk areas:

- OpenAI image generation/edit helpers
- product ingestion adapters
- product enrichment and embeddings
- product matching and substitution
- final render provenance
- shopping list and presentation pages
- Supabase RLS-aligned write paths

Finding:

- No blocking code defects found in static review.

## Operational Deferrals

Supabase project link:

- `supabase migration list` failed because the repo is not linked to a Supabase project.
- Exact CLI result: `Cannot find project ref. Have you run supabase link?`
- This means migrations have been authored and checked into the repo, but not applied from this workspace.

Live founder/designer walk:

- Deferred until a populated Supabase project exists with at least one authenticated user, room photo, selected concept, ingested products, shopping list, and final render.

Live final render:

- Deferred for the same reason. The code path is implemented and type/build verified, but an end-to-end generation needs populated runtime data.

## Known Risks

- Retailer public-page adapters can break if retailer HTML or schema changes.
- Prices and stock can become stale and must be rechecked before purchase.
- Final rendered imagery is best-effort and may not exactly reproduce each SKU.
- Product fit is only as reliable as retailer dimensions and manually entered room measurements.

## Result

MVP implementation slices F-001 through F-018 are closed in the documentation chain.
