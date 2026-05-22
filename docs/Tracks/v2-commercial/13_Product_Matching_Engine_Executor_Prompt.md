# 13 Product Matching Engine Executor Prompt

Use this prompt for the fresh implementation instance.

---

You are taking over implementation for the Ritzy Product Matching Engine track.

Read these first:

1. `apps/web/AGENTS.md`
2. `docs/Vision/05_Brand_and_Design_System.md`
3. `docs/Tracks/v2-commercial/12_Product_Matching_Engine_PRD.md`
4. `docs/Tracks/mvp/04_Product_Matching_Rubric.md`
5. `packages/domain/src/product-matching.ts`
6. `packages/domain/src/product-matching.test.ts`
7. `apps/web/app/actions.ts`, especially `groundProductsAction`
8. `packages/ai/src/index.ts`, especially `sourceProductsFromConcept`
9. `packages/prompts/src/index.ts`, especially `conceptProductSourcingPrompt`

Context:

- The catalog now includes multiple retailers and thousands of products.
- That is good for coverage, but it makes false positives more likely.
- The recent failure: Bolaji's beige concept sofa produced an olive sofa because visual sourcing failed or returned no usable role brief, then the system fell back to static text/category ranking.
- PR #60 added a guard so missing visual roles are not silently backfilled.
- That guard is not the full solution. The long-term solution is a dedicated matching engine.

Operating constraints:

- Do not merge anything.
- Do not deploy.
- Do not add database migrations unless explicitly approved by Sam.
- Keep implementation PRs small and reviewable.
- Every PR must include `## Summary`, `## Test plan`, and `## NOT in this PR`.
- Stage files by name only. Never use `git add .`.
- Preserve the commit trailer:
  `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Do not stage untracked local research/assets unless the PR explicitly requires them.

Chief architect direction:

Build this as a sequence of PRs. Do not jump straight into the whole engine.

## PR B Target: Role-Scoped Retrieval API

Create pure domain helpers that prepare candidate pools per room role before AI visual arbitration.

Expected shape:

- Input:
  - room type
  - role specs
  - concept text / role visual briefs
  - product candidates
  - budget and room measurements
- Output:
  - one candidate pool per role
  - candidate counts
  - rejection/weakness reasons where useful

Requirements:

- No runtime behavior change unless behind a default-off flag.
- Keep logic in `packages/domain` where possible.
- Add tests for:
  - living room sofa, armchairs, rug, TV/media storage, lighting
  - dining table, dining chairs, sideboard/console, lighting
  - bedroom bed, bedside tables, lighting, rug
  - home office desk, office chair, storage/shelving, task lighting
- Add regression coverage for:
  - beige sofa concepts should prefer beige/cream sofas over olive when beige candidates exist
  - dining chair roles should not prefer bulky armchairs
  - TV media console roles should prefer media/storage units over generic bookcases when available

Non-goals for PR B:

- Do not change the live shopping-list runtime.
- Do not change AI prompts.
- Do not add product image embeddings.
- Do not add UI.
- Do not add database migrations.

Verification:

- `pnpm --filter @ritzy-studio/domain test`
- If web imports change, also run `pnpm exec tsc -p tsconfig.json --noEmit` from `apps/web`.

Review format expected from chief architect:

- `approved`
- or `rejected` with required fixes and code comments.

After PR B is ready, ask for review. Do not proceed to PR C until PR B is approved or the chief architect explicitly says to continue in parallel.
