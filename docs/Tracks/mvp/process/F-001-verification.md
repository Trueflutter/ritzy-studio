# F-001 Verification: Project Scaffold And Environment Validation

## Feature

`F-001 Project Scaffold And Environment Validation`

## Scope

Created the initial application scaffold and workspace foundation.

Boundaries touched:

- `apps/web`
- `packages/config`
- `docs`

## Implementation Summary

- Initialized a pnpm workspace.
- Created a Next.js TypeScript app in `apps/web`.
- Added root package scripts for `dev`, `lint`, `typecheck`, `build`, `validate-env`, and `check`.
- Added `packages/config` with Zod-backed environment validation.
- Added `.env.example` with required OpenAI and Supabase variables.
- Created package boundary placeholders for future packages:
  - `packages/ai`
  - `packages/db`
  - `packages/domain`
  - `packages/ingestion`
  - `packages/prompts`
  - `packages/ui`
- Replaced the default Next.js marketing screen with a minimal Ritzy scaffold screen that does not implement product UI.
- Removed generated dark-mode styling and Next marketing copy from the starter page.
- Added root README command and environment documentation.

## Verification Commands

Passed:

```bash
pnpm lint
pnpm typecheck
OPENAI_API_KEY=test NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=test SUPABASE_SERVICE_ROLE_KEY=test NEXT_PUBLIC_APP_URL=http://localhost:3000 pnpm validate-env
pnpm build
pnpm check
```

## Notes

- `pnpm check` intentionally excludes `validate-env` so the repository can build in environments where real secrets are not present.
- Environment validation remains available through `pnpm validate-env`.
- Supabase is confirmed as the MVP database/auth/storage stack.
- Auth is confirmed as part of the product from the start, but auth screens are not implemented in F-001.
- Home Centre is confirmed as the first retailer adapter target for the catalog phase.

## Deferrals

- Full design token implementation is deferred to F-002.
- Supabase schema and auth implementation are deferred to F-003.
- Retailer ingestion begins in F-009/F-010.

## Result

Passed.
