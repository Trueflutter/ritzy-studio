# 08 Chief Architect Handoff

## Current State

Ritzy Studio has completed the first eleven MVP implementation slices.

The repository now contains:

- documentation control layer
- pnpm workspace
- Next.js TypeScript app in `apps/web`
- `packages/config` environment validation
- Supabase auth, schema, RLS, and storage foundation
- protected project, room, photo upload, and brief flows
- `packages/prompts` and `packages/ai`
- versioned OpenAI clarifying-question generation
- initial OpenAI `gpt-image-2` concept generation
- concept critique, selection, and revision generation
- catalog ingestion package, adapter contract, normalization, and ingestion run helper
- retailer adapters: Home Centre UAE, 2XL Home, and Chattels & More

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

`F-012 Product Enrichment And Embeddings`

Status: not started.

Expected boundaries:

- `packages/ai`
- `packages/prompts`
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

Begin F-012:

- add product enrichment prompts and services
- derive style, room, color, and material search tags without inventing factual product data
- add product text embeddings for search
- store enrichment provenance/source hashes to avoid unnecessary rework
- cover missing-data and confidence behavior with tests

## Open Questions

- Confirm the hosted Supabase migration path before deploying beyond local development.
- Confirm export format before F-017.
