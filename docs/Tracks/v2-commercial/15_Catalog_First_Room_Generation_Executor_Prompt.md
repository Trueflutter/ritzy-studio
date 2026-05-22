# 15 Catalog-First Room Generation Executor Prompt

Use this prompt for a fresh implementation instance.

---

You are taking over the Catalog-First Room Generation architecture track for Ritzy Studio.

Read these first:

1. `apps/web/AGENTS.md`
2. `docs/Vision/05_Brand_and_Design_System.md`
3. `docs/Tracks/v2-commercial/12_Product_Matching_Engine_PRD.md`
4. `docs/Tracks/v2-commercial/14_Catalog_First_Room_Generation_PRD.md`
5. `packages/domain/src/product-matching.ts`
6. `packages/domain/src/product-matching.test.ts`
7. `packages/ai/src/index.ts`
8. `packages/prompts/src/interior-design-language.ts`
9. `apps/web/app/actions.ts`, especially `groundProductsAction` and concept generation actions

Context:

- Ritzy currently generates an inspiration image first, then tries to find matching real catalog products.
- That flow is being repaired by the Product Matching Engine track, but it will always have a structural weakness: generated rooms can contain products the catalog cannot match closely.
- The future direction is catalog-first generation:
  - select real catalog products first
  - assemble premium and budget bundles
  - generate concepts using those products as anchors
  - make the shopping list immediately available after approval

Operating constraints:

- Do not merge anything.
- Do not deploy.
- Do not make runtime behavior changes unless explicitly asked.
- Do not add database migrations unless Sam explicitly approves.
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

This is a parallel future-flow track. Do not disrupt the active Product Matching Engine implementation.

The current matching engine should continue to make the existing image-first flow trustworthy. Your catalog-first work should reuse that engine when it is stable, not force it to change scope.

## Immediate Target: PR B - Bundle Domain Types And Fixtures

Create pure domain foundations for catalog-first bundles.

Expected scope:

- Add TypeScript types for:
  - room bundle role
  - product bundle item
  - product bundle
  - bundle score
  - bundle assembly input/output
  - premium/budget tier
- Add deterministic room role blueprints for:
  - living room
  - dining room
  - bedroom
  - home office
- Add fixtures for bundle tests.
- Add tests proving:
  - living room defaults include sofa, rug, coffee table, TV/media console, lighting
  - dining room defaults include dining table, dining chairs, lighting, sideboard/console where supported
  - bedroom defaults include bed, bedside tables, lighting, rug/textile layer
  - home office defaults include desk, office chair, task lighting, storage/shelving
  - quantity-aware roles are represented, especially dining chairs, bedside tables, lamps, cushions

Preferred module:

- `packages/domain/src/catalog-first-room-generation.ts`
- `packages/domain/src/catalog-first-room-generation.test.ts`

If there is an existing better module pattern in `packages/domain`, follow it.

Non-goals for PR B:

- No app UI.
- No AI prompt changes.
- No runtime switch.
- No database schema.
- No catalog ingestion changes.
- No product matching behavior changes.
- No actual premium/budget image generation yet.

Verification:

- `pnpm --filter @ritzy-studio/domain test`
- `pnpm --filter @ritzy-studio/domain typecheck` if available
- `pnpm typecheck` if cross-package exports change
- `git diff --check`

## Sync Note For Product Matching Agent

Tell the Product Matching Engine agent:

> Catalog-first room generation is now a future orchestration track. Please continue the current matching-engine scope: role-scoped retrieval, attribute scoring, visual arbitration, eval harness, and runtime rollout for the existing image-first flow. Do not pivot your PRs to catalog-first generation. The catalog-first track will later reuse your role/category compatibility, attribute scoring, and eval fixtures as lower-level capabilities.

## Suggested PR Sequence After PR B

### PR C: Bundle Assembly V1

- Given product candidates and room role blueprint, assemble one premium and one budget bundle.
- Reuse matching-engine helpers if already merged.
- Add tests for role coverage, budget split, quantity totals, and no incompatible categories.

### PR D: Aesthetic Compatibility Scoring

- Score color/material/style harmony across bundle items.
- Add tests for coherent vs incoherent bundles.

### PR E: Bundle-To-Image Prompt Builder

- Create prompt composition for Gemini/OpenAI image generation using selected bundle anchors.
- Keep test-only.

### PR F: Local Feature-Flag Prototype

- Add a default-off local flag.
- Generate premium/budget concepts from bundle.
- No production rollout without Sam's manual visual approval.

Review format expected from chief architect:

- `approved`
- or `rejected` with required fixes and code comments.

When PR B is ready, ask for review. Do not merge.
