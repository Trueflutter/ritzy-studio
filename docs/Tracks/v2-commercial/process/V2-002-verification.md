# V2-002 Verification

## Feature

`V2-002 User Mode And Entitlement Schema`

## Scope

Added commercial entitlement foundation for:

- user mode/profile state
- designer account shell
- designer subscriptions
- homeowner room unlocks
- entitlement event ledger
- server-side commerce access helpers

## Files Changed

- `supabase/migrations/20260504103000_v2_entitlements.sql`
- `packages/db/src/types.ts`
- `packages/domain/src/entitlements.ts`
- `packages/domain/src/entitlements.test.ts`
- `packages/domain/src/index.ts`
- `packages/domain/package.json`
- `docs/Tracks/v2-commercial/02_Feature_List.json`
- `docs/Tracks/v2-commercial/10_RLS_and_Privacy_Posture.md`
- `docs/Tracks/v2-commercial/process/progress.md`

## Database Verification

Ran:

```sh
supabase db push --dry-run
```

Result:

- confirmed only `20260504103000_v2_entitlements.sql` was pending

Ran:

```sh
supabase db push --yes
```

Result:

- migration applied successfully to linked Supabase project

Service-role smoke check:

- `user_profiles`: queryable, 1 row
- `designer_accounts`: queryable, 0 rows
- `subscriptions`: queryable, 0 rows
- `room_unlocks`: queryable, 0 rows
- `entitlement_events`: queryable, 0 rows
- existing user backfilled with `intended_mode = designer`

## Domain Verification

Ran:

```sh
pnpm --filter @ritzy-studio/domain test
pnpm --filter @ritzy-studio/domain typecheck
pnpm --filter @ritzy-studio/db typecheck
```

Result:

- passed

## Notes

- No billing provider is integrated in this slice.
- No paywall UI is implemented in this slice.
- Later slices should use `can_access_room_commerce(room_id)` before exposing tracked retailer links.
