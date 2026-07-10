# Fable Progress Log

Living log for the 72-hour beta push. If you are a future model instance resuming this work:
read `docs/FABLE_HANDOFF.md` first, then `plans/2026-07-10_fable-beta-world-class.md`, then this
file top to bottom. Newest entries at the bottom. Keep this file updated after every increment.

## Ground rules being followed
- Branch: `fable/beta-world-class` off main (split into PR branches per slice when opening PRs).
- Conventional commits, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Never merge without Ayo's approval. Stage files by name, never `git add .` (untracked scratch
  dirs exist, e.g. `.codex-evidence/`).
- Verify against the real Gemini renderer via Evolink (`RITZY_IMAGE_PROVIDER=evolink` in
  `.env.local`), never tune against gpt-image-2.

## 2026-07-10

### Evolink image provider wired (commit d8fc005)
- `packages/config`: `RITZY_IMAGE_PROVIDER` enum + `evolink`; `EVOLINK_API_KEY`,
  `EVOLINK_IMAGE_MODEL` (default gemini-3.1-flash-image-preview), `EVOLINK_IMAGE_QUALITY`
  (default 1K).
- `packages/ai/src/index.ts`: `generateEvolinkImage` (submit POST /v1/images/generations, poll
  GET /v1/tasks/{id} every 3s, 300s cap, fetch result URL to base64). `ImageGenerationReference`
  gained optional `url` (Evolink takes `image_urls`, not inline bytes). Provider branch falls back
  to OpenAI on error, mirroring the Gemini branch.
- Callers thread URLs: initial concept (roomPhotoUrl + product primaryImageUrl), concept revision
  (roomPhotoUrl), final render (new optional roomPhotoUrl/conceptImageUrl/products[].imageUrl,
  signed in `generateFinalRenderAction`'s after() block).
- Live contract probe succeeded: submit -> `task-...` id, poll -> `completed`, `results[0]` URL,
  ~17s at 1K. Verified with a throwaway prompt before writing code.
- Typecheck, lint, ai+config package tests green.

### BLOCKER discovered: hosted Supabase is gone
- `baevldudfqfnzczbvooz.supabase.co` is NXDOMAIN on public DNS (1.1.1.1, 8.8.8.8) — paused or
  deleted project. All auth/DB/storage against it fails; the app renders but no flow works.
- Ayo must restore it from the Supabase dashboard (or provision a new project + update env).
- Mitigation in progress: local Supabase via colima+docker+supabase CLI (brew install running),
  then `supabase start`, apply `supabase/migrations`, seed user + catalog subset via
  `packages/ingestion`. All app work continues locally and transfers when hosted returns.

### Recon notes (grounded against current main)
- Provider routing: `packages/ai/src/index.ts` `generateImageWithConfiguredProvider` (~line 538
  pre-edit). Initial concept takes exactly ONE room photo (`roomPhotoUrl`/`roomPhotoBytes`);
  concept action selects the room photo with order-by-created_at limit 1 (same for final render
  action, `apps/web/app/actions.ts` ~3970).
- Spatial rules engine `packages/domain/src/spatial-design-rules.ts` is complete + tested:
  rule table (L*/C*/D*/B*/O*), 7 hard-checkable evaluators (C1 layout mode, C6 combined scale,
  D1/D2 dining, L10 living envelope, B2 bed, O2 desk), `deriveSpatialDesignerWarnings`. Nothing
  imports it in apps/web — confirmed dormant.
- Prompt language: `packages/prompts/src/interior-design-language.ts` has focal-placement,
  anti-cant, combined-hall-zoning guardrails baked into `roomLanguage`/`roomBlueprintLanguage`.
  Concept prompt composition arrays live in `packages/ai/src/index.ts` (search for
  `sourceRoomPreservationLanguage`).
- Matching flags: `RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED` default false; controlled-preview
  cohort gate in `packages/config` (`productMatchingControlledPreviewGate`).
- `pnpm check` = lint + typecheck + build. Package tests run per-package (`pnpm --filter
  @ritzy-studio/ai test` etc., plain tsx scripts, no vitest).

### Open questions for Ayo
1. Restore/replace the hosted Supabase project (BLOCKER for hosted beta).
2. Confirm Evolink is acceptable as the production image provider for beta (static key, stable),
   with Vertex as fallback config rather than default.
