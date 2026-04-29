# 08 Chief Architect Handoff

## Current State

Ritzy Studio has completed the first six MVP implementation slices.

The repository now contains:

- documentation control layer
- pnpm workspace
- Next.js TypeScript app in `apps/web`
- `packages/config` environment validation
- Supabase auth, schema, RLS, and storage foundation
- protected project, room, photo upload, and brief flows
- `packages/prompts` and `packages/ai`
- versioned OpenAI clarifying-question generation

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

`F-007 Room Analysis And Initial Concept Generation`

Status: not started.

Expected boundaries:

- `apps/web`
- `packages/prompts`
- `packages/ai`
- `packages/db`
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

Begin F-007:

- verify current official OpenAI Image 2 / image editing capabilities before implementation
- analyze uploaded room photos for fixed architecture and uncertainty
- generate initial concept directions and images from room photos and saved brief
- store generated image assets and concept records
- log AI job metadata, prompt version, model, and uncertainty

## Open Questions

- Confirm the hosted Supabase migration path before deploying beyond local development.
- Confirm export format before F-017.
