# 17 Measurement Intelligence Executor Prompt

Use this prompt for a fresh implementation instance.

---

You are taking over the Measurement Intelligence track for Ritzy Studio.

Read these first:

1. `apps/web/AGENTS.md`
2. `docs/Vision/05_Brand_and_Design_System.md`
3. `docs/Tracks/v2-commercial/16_Measurement_Intelligence_PRD.md`
4. `docs/Research/measurement-capture-options.md`
5. `docs/Research/dubai-villa-type-measurement-prefill-feasibility.md`
6. `docs/Tracks/v2-commercial/03_Data_Model.md`
7. `supabase/migrations/20260429114000_initial_schema.sql`, especially `room_measurements`
8. `packages/db/src/types.ts`, especially `room_measurements` and `measurement_source`
9. `packages/domain/src/product-matching.ts`, especially measurement fit logic
10. `apps/web/app/actions.ts`, especially measurement saving and generation gating

Context:

- Ritzy requires room measurements before design generation because product recommendations can become misleading without them.
- Manual entry is safe but creates friction.
- Dubai villas/townhouses often have repeatable developer layouts by community, phase, bedroom count, and unit type.
- Ritzy should build a confidence-aware measurement system that can prefill likely dimensions from known layouts, uploaded plans, and future scan/import sources.
- Prefill is not truth. User/designer confirmation is still required before fit-sensitive recommendations.

Operating constraints:

- Do not merge anything.
- Do not deploy.
- Do not make runtime behavior changes unless explicitly requested.
- Do not add or apply database migrations unless Sam explicitly approves.
- Keep PRs small and reviewable.
- Every PR must include:
  - `## Summary`
  - `## Test plan`
  - `## NOT in this PR`
- Stage files by name only. Never use `git add .`.
- Preserve the commit trailer:
  `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Do not stage unrelated untracked local research/assets.

Chief architect direction:

This is a new track. It should not interfere with:

- Product Matching Engine work.
- Catalog-First Room Generation work.
- Live measurement UI.
- Supabase schema until explicitly approved.

## Immediate Target: PR B - Pure Domain Measurement Types

Create the pure domain foundation for Measurement Intelligence.

Expected module:

- `packages/domain/src/measurement-intelligence.ts`
- `packages/domain/src/measurement-intelligence.test.ts`

If the domain package has a better local pattern, follow it.

Expected types:

- measurement source kind
- measurement confidence
- property community/development/layout
- property layout alias
- property layout room
- property layout source/provenance
- room measurement source selection
- fit confidence/use policy

Expected helpers:

- `measurementSourceRequiresConfirmation(source, confidence)`
- `measurementCanSupportProductFit(source, confidence)`
- `measurementCanSupportTightClearance(source, confidence)`
- `normalizeLayoutAlias(value)`
- `rankLayoutCandidates(input, layouts)` if simple enough for PR B

Expected fixtures:

- small Dubai-style layout examples for:
  - DAMAC Hills 2 townhouse
  - Al Furjan villa/townhouse
  - Arabian Ranches or Dubai Hills villa
- include aliases such as:
  - `Akoya Oxygen`
  - `Damac Hills 2`
  - `TH12-4E`
  - `4 bedroom end unit`
  - `Murooj Al Furjan 4-bed corner`

Tests must prove:

- known developer layout without user confirmation requires confirmation.
- manual/user-measured dimensions can support normal product-fit scoring.
- designer-verified measurements can support tight-clearance decisions.
- estimated measurements cannot support tight-clearance decisions.
- alias normalization handles case, punctuation, and common spacing.
- candidate ranking can match obvious aliases if you implement the helper.

Non-goals for PR B:

- No UI.
- No Supabase migration.
- No generated DB type changes.
- No changes to `apps/web/app/actions.ts`.
- No changes to product matching runtime.
- No floor-plan parsing.
- No seed importer.
- No external API/vendor integration.

Verification:

- `pnpm --filter @ritzy-studio/domain test`
- `pnpm --filter @ritzy-studio/domain typecheck` if available
- `pnpm typecheck` if package exports change
- `git diff --check`

## Suggested PR Sequence After PR B

### PR C: Schema Proposal Draft

- Add a proposed Supabase migration for layout tables/enums.
- Keep it review-only unless Sam approves applying it.
- Include RLS policies.
- Include generated type update instructions.

### PR D: Seed Dataset Format

- Add repo-managed seed dataset format for curated layouts.
- Add schema validation and sample fixture.
- Avoid copyrighted plan images unless rights are clear.

### PR E: Import/Curation Dry Run

- Add dry-run CLI that validates seed data and prints a summary.
- No database writes by default.

### PR F: Default-Off Layout Prefill UI

- Add a feature-flagged "Find my layout" path.
- User must confirm or edit dimensions before generation.

### PR G: Measurement Confidence Runtime Integration

- Product matching and bundle logic use measurement confidence.
- Tight clearance recommendations require stronger verification.

## Review Format Expected From Chief Architect

- `approved`
- or `rejected` with required fixes and code comments.

When PR B is ready, ask for review. Do not merge. Do not proceed to PR C until PR B is reviewed or the chief architect explicitly says to continue in parallel.
