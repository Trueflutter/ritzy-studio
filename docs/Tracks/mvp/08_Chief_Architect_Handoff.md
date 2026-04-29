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

`F-002 Locked Design Tokens And App Shell`

Status: not started.

Expected boundaries:

- `apps/web`
- `packages/ui`

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

Begin F-002:

- read `docs/Vision/05_Brand_and_Design_System.md` sections 4, 5, 6, 8, 17, 19, and 20
- implement locked CSS variables/Tailwind tokens
- install/configure Cormorant Garamond and DM Sans strategy
- create base app shell primitives
- keep UI scope minimal and foundational
- run design compliance checklist

## Open Questions

- Confirm export format before F-017.
