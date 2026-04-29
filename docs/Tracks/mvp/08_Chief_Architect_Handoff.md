# 08 Chief Architect Handoff

## Current State

Ritzy Studio is pre-implementation. The repository currently contains documentation and one retained style exploration.

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

`F-001 Project Scaffold And Environment Validation`

Status: not started.

Expected boundaries:

- `apps/web`
- `packages/config`
- `docs`

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

Begin F-001:

- scaffold Next.js TypeScript app
- create target package directories
- add environment validation
- document baseline commands
- create F-001 verification doc
- update progress and feature list only after verification

## Open Questions

- Confirm Supabase as backend before creating migrations.
- Confirm auth requirement for first implementation.
- Confirm first retailer ingestion target before F-010.
- Confirm export format before F-017.
