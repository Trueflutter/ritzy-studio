# PR D: Product Reference Ordering And Role Coverage

Status: implementation note for review.

## Scope

This PR adds richer product-role coverage helpers and optional final-render product-reference ordering.

Runtime ordering is behind the default-off server flag:

`RITZY_PRODUCT_REFERENCE_ORDERING_V2_ENABLED=false`

No DB/schema changes and no UI changes are included.

## Status (2026-09-05, slice S4)

The final render now sorts the selected products by render priority unconditionally (`apps/web/lib/render-inputs.ts`); `RITZY_PRODUCT_REFERENCE_ORDERING_V2_ENABLED` no longer gates it and setting it changes nothing. The config entry stays until the retired flags are removed together. The two sections below describe the pre-S4 behaviour.

## Default Behavior

When `RITZY_PRODUCT_REFERENCE_ORDERING_V2_ENABLED` is unset or `false`, final render product references keep the existing selected shopping-item order.

The new enhanced room-role helper functions are available and tested, but they do not change product matching or shopping-list selection behavior by default.

## Flag-On Behavior

When `RITZY_PRODUCT_REFERENCE_ORDERING_V2_ENABLED=true`, selected products are sorted before the final render fetches its first eight product images.

Sorting prioritizes visually important references first:

- anchor furniture
- room-defining tables, chairs, beds, sofas, and rugs
- supporting lighting, mirrors, art, and storage
- styling/decor last

The sort is stable within equal priority, so equivalent products keep their existing order.

## Role Coverage

The new `enhancedProductRolesForRoom(roomType)` helper defines richer role coverage for:

- living rooms
- dining rooms
- bedrooms
- bathrooms and powder rooms
- default rooms

Roles include importance metadata (`anchor`, `supporting`, `styling`) and inclusion guidance (`always`, `space_allows`, `catalog_supports`, `brief_mentions`).

## Not Included

- No change to product matching selection logic by default.
- No change to shopping-list UI.
- No new product categories or database schema.
- No final render prompt wording changes beyond the PR C base.

## Rollback

Set:

`RITZY_PRODUCT_REFERENCE_ORDERING_V2_ENABLED=false`

or unset the variable.

No database rollback is required. No UI rollback is required. No saved user data shape changes are required.

## Verification

Required checks:

- `pnpm --filter @ritzy-studio/domain test`
- `pnpm --filter @ritzy-studio/domain typecheck`
- `pnpm --filter @ritzy-studio/config typecheck`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
