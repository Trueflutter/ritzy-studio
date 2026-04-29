# F-003 Verification: Database Schema And Auth Foundation

## Feature

`F-003 Database Schema And Auth Foundation`

## Scope

Created the Supabase database/auth foundation for the MVP.

Boundaries touched:

- `packages/db`
- `packages/domain`
- `packages/config`
- `apps/web`
- `supabase`
- `docs`

## Implementation Summary

- Initialized Supabase local configuration.
- Moved Ritzy local Supabase ports to the `553xx` range to avoid another local project using default ports.
- Added initial database migration:
  - user profiles
  - projects
  - rooms
  - room assets
  - measurements
  - design briefs
  - clarifying questions
  - concepts
  - critiques
  - retailers
  - products
  - product dimensions
  - product images
  - product embeddings
  - ingestion runs
  - shopping lists
  - shopping list items
  - render jobs
  - AI jobs
- Added `pgvector` extension.
- Added private storage buckets:
  - `room-assets`
  - `generated-renders`
- Enabled RLS on all public MVP tables.
- Added owner-scoped RLS policies for project/room data.
- Added service-role policies for catalog and AI job writes.
- Added private storage policies using user-id-prefixed object paths.
- Added generated Supabase TypeScript database types in `packages/db`.
- Added basic domain validation schemas in `packages/domain`.
- Added Supabase browser, server, and proxy helpers using `@supabase/ssr`.
- Used Next.js 16 `proxy.ts` convention instead of deprecated root `middleware.ts`.
- Added RLS/privacy posture documentation.

## Verification Commands

Passed:

```bash
supabase start
supabase db reset
supabase gen types typescript --local > packages/db/src/types.ts
pnpm typecheck
pnpm check
OPENAI_API_KEY=test NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test SUPABASE_SERVICE_ROLE_KEY=test NEXT_PUBLIC_APP_URL=http://localhost:3001 pnpm validate-env
```

Database inspection through the local Postgres container confirmed:

- 19 public tables exist.
- RLS is enabled on all 19 public tables.
- `room-assets` and `generated-renders` storage buckets exist.

## Notes

- Host `psql` is not installed, so verification queries were run via `docker exec supabase_db_ritzy-studio psql`.
- Supabase CLI v2.75.0 is installed locally. It reports v2.95.4 is available, but the current installed version successfully applied and reset migrations.
- Local Supabase ports were changed to avoid conflict with another local Supabase project.

## Result

Passed.

## Deferrals

- Auth screens and protected app routes are deferred to the project workflow slices.
- Team/collaborator access is deferred.
- Hosted Supabase project linking and production type generation remain future deployment tasks.
