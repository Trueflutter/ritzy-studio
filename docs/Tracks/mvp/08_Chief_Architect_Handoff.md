# 08 Chief Architect Handoff

## Current State

Ritzy Studio has completed the first implementation foundation slice.

The repository now contains:

- documentation control layer
- pnpm workspace
- Next.js TypeScript app in `apps/web`
- `packages/config` environment validation
- package boundary placeholders
- root command documentation

The locked design system exists at:

`docs/Vision/05_Brand_and_Design_System.md`

The MVP documentation control layer has been created under:

`docs/Tracks/mvp/`

## Source Of Truth Order

Use this order:

1. `docs/Tracks/mvp/02_Feature_List.json`
2. `docs/Tracks/mvp/process/progress.md`
3. `docs/Tracks/mvp/08_Chief_Architect_Handoff.md`
4. supporting track docs
5. actual codebase

For visual implementation, `docs/Vision/05_Brand_and_Design_System.md` is locked and canonical.

## Current Canonical Slice

`F-004 Project And Room Creation`

Status: not started.

Expected boundaries:

- `apps/web`
- `packages/ui`
- `packages/domain`
- `packages/db`

## Locked Product Workflow

1. Designer uploads room photos and writes a brief.
2. System generates initial concept directions first.
3. Designer critiques and refines concepts.
4. After concept approval, system searches automated retailer catalog data.
5. Designer reviews and substitutes real products.
6. System generates final grounded render.
7. Shopping list is produced from selected product records.

## Key Constraints

- Do not introduce a designer-facing CSV product upload workflow.
- Do not treat generated images as product truth.
- Do not imply exact SKU rendering.
- Do not certify product fit from photo-only dimensions.
- Do not drift from the locked design system.

## Suggested Next Action

Begin F-004:

- build project dashboard and new project flow
- require authenticated Supabase user for project operations
- create server actions or route handlers for project/room creation
- keep within design system project dashboard and new project blueprints
- verify against local Supabase

## Open Questions

- Confirm export format before F-017.
