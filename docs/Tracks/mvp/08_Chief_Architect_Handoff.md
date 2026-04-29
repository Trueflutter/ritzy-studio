# 08 Chief Architect Handoff

## Current State

Ritzy Studio has completed the first fifteen MVP implementation slices.

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
- product enrichment prompt, text embedding helper, and enrichment provenance schema
- selected-concept product grounding with draft shopping list candidates
- line-level product substitution for draft shopping list items
- final grounded render generation with product reference images and render-job provenance

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

`F-016 Shopping List And Cost Estimate`

Status: not started.

Expected boundaries:

- `apps/web`
- `apps/web`
- `packages/domain`
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

Begin F-016:

- create a data-dense shopping list and cost estimate view
- show product name, retailer, category, price, dimensions, image, URL, and availability where available
- keep stale and missing data visible
- calculate totals from selected product records only
- follow design system section 13 for data-dense UI

## Open Questions

- Confirm the hosted Supabase migration path before deploying beyond local development.
- Confirm export format before F-017.
