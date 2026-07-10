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

### Local stack stood up (2026-07-10 afternoon)
- colima + docker + supabase CLI installed; local Supabase on port 55321 (analytics disabled in
  supabase/config.toml — vector cannot mount the docker socket under colima).
- Migrations apply cleanly; two local-only grant fixups were needed (the hosted project evidently
  carries grants that are NOT in migrations — worth codifying in a migration later):
  `grant all on all tables in schema public to service_role` etc., and
  `grant execute on all functions in schema public to service_role`.
- Test user fable-test@ritzy.local / fable-test-passw0rd (local only).
- Synthetic 60-product catalog seeded (scripts/local-catalog-seed; includes trap products).
- Playwright E2E driver in the session scratchpad (e2e.mjs), staged: login/onboarding/project/
  room/photos/brief-style/brief-inspiration all pass. The user's Chrome cannot reach localhost
  (proxy?) — headless Playwright is the way to drive the app here.
- Dev-only observations to fix later: hydration mismatch warning on hidden form inputs
  (caret-color style) triggers the dev overlay; style-step tiles render with empty images.

### Vision-input robustness fix (committed)
- All OpenAI vision inputs now receive data URLs built from bytes already in memory instead of
  signed storage URLs (expiry + non-public-host failures). Evolink references get a separate
  `roomPhotoReferenceUrl` plus a `publicReferenceUrl` guard (drops data:/localhost URLs) so the
  URL-based provider falls back cleanly. This surfaced from a real failure locally.

### BLOCKERS needing Ayo (updated)
1. **Hosted Supabase is gone** (`baevldudfqfnzczbvooz.supabase.co` NXDOMAIN). Restore from the
   Supabase dashboard or provision a new project + update env. Without it there is no hosted
   catalog, auth, or storage — and no public storage URLs, which the Evolink reference contract
   needs.
2. **OpenAI API key quota exhausted (429 "check your plan and billing")**. Every text/vision call
   (clarifying questions, concept direction, sourcing selection, enrichment) is down. Top up
   billing, or:
3. **Decision: may local/dev traffic route OpenAI-SDK calls through the Evolink gateway?**
   Evolink serves the full Responses API incl. strict json_schema and data-URL vision (verified
   live; gpt-5.1/5.2/5.5 available, no gpt-5-mini). Env-only change
   (OPENAI_BASE_URL=https://api.evolink.ai/v1 + key + OPENAI_TEXT_MODEL=gpt-5.1). The sandbox
   policy correctly refused to make that call mine — same data already flows to Evolink for image
   generation, but routing ALL text through them is Ayo's call.
4. Sandbox also (correctly) blocked exposing local Supabase via a public tunnel; without it,
   URL-based image references cannot be tested end-to-end locally (they fall back to OpenAI
   image gen). Design-fidelity work verifies against Gemini via the direct Evolink harness
   (fable-evidence POC) until hosted Supabase returns.
5. Confirm Evolink as production image provider for beta (static key), Vertex as fallback.

### Matching quality work (committed)
- Cross-project demotion: `recentlyUsedProductIds` on the match request; -30 in both rankers;
  grounding action fetches the user's selected items from other rooms and threads it through
  sourcing plan, visual ranking, retry, and option pools. Unit-tested (twin-sofa fixture).
- Concept-image palette coherence: `extractConceptImagePalette` (packages/ai, cached in new
  `concepts.palette_json`), `conceptPaletteMatchingText` + structured `avoidColorTags` penalty
  (-24) in domain. Dominant colors/materials join concept text; avoid colors NEVER enter the
  text (would count as token matches). Palette prompt validated against the real concept image
  via the Evolink harness: returns exactly the right families.
- Engine v1 is ON locally (.env.local RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED=true). Flipping
  the production default awaits a real-flow validation run (blocked on OpenAI quota).
- Deliberate deferrals: global-ranker tie-break rotation (role-scoped pools already rotate
  product families; engine-on makes that the live path), and pgvector embedding recall.

### Multi-view concepts (committed)
- Migration `room_assets.concept_id` + `view_key`; `generateConceptView` in packages/ai with
  per-room-type camera language (`conceptViewCameraLanguage`); after() task generates
  reverse_wide + anchor_detail views after the hero lands; concepts page shows the pair.
  POC evidence: docs/Tracks/v2-commercial/fable-evidence/2026-07-10-multiangle-poc/.

### Spatial intelligence wired (committed)
- Brief details: room-planning section (focal point, seating priority, dining seats,
  must-keep-clear) -> design_briefs.structured_json.spatialIntent; layout mode derives from the
  chosen room type. Measurements now Strongly Recommended, not a hard gate — skipping records a
  directional-scale assumption instead of dead-ending.
- `parseSpatialIntent`/`spatialLayoutModeForRoomType` (domain), `spatialLayoutLanguage`
  (prompts) injected into concept image prompt + both final-render variants; real measurements
  now reach the image model; floor plan image feeds the direction model as a vision input.
- `deriveSpatialDesignerWarnings` runs pre-generation; assumptions/warnings land in the
  concept's What we assumed section.

### Multi-photo in (committed)
- Concept generation consumes up to 3 room photos (all to the direction model, 2 extra as
  generation references, prompt anchors on photo 1's perspective). Photos page guides
  corner-by-corner capture.

### Post-render spatial QA (committed + live-calibrated)
- `assessRenderSpatialQuality` (focal orientation, anchor alignment/anti-cant, scale+rug
  anchoring, composition integrity, combined zoning) with strict-judgment rubric. Final render
  regenerates once on a hard fail with QA issues as corrective prompt lines; verdict stored on
  render_jobs.input_summary (spatialQaVerdict/Issues/Regenerated).
- Rubric calibrated against the real renderer via the Evolink harness: good concept passes; a
  deliberately under-scaled bath-mat rug fails with a precise issue (was a false negative
  before tightening). Evidence: fable-evidence/2026-07-10-multiangle-poc/qa-flawed-rug-sample.png.

### Verification state (end of Fable session 1)
- `pnpm check` (lint+typecheck+build) green; all package tests green.
- Runtime-verified against the real Gemini renderer via direct harness: multi-angle consistency,
  palette extraction, spatial QA rubric.
- NOT yet runtime-verified through the app UI: everything past the brief (concept -> matching ->
  render), because the OpenAI key is out of quota and hosted Supabase is gone (see BLOCKERS).
  The local stack (supabase + seeded catalog + Playwright driver) is ready to run the moment
  quota/routing is resolved: `node <scratchpad>/e2e.mjs` stages, or rebuild from
  scripts/local-catalog-seed.

### Suggested next steps for the next session
1. Resolve BLOCKERS 1-3 with Ayo, then run the full E2E (Playwright driver stages exist) and
   fix whatever the real flow surfaces; screenshot evidence into fable-evidence/.
2. Flip RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED default after validating on the real catalog.
3. Final-render durability (after()+15min staleness is fragile) — consider a queue or at
   minimum idempotent retry; then multi-angle for the final render (generateConceptView pattern
   applies directly; presentation UI already renders view assets for concepts).
4. Concept-hero QA surface (verdict recorded for renders only today).
5. Catalog depth: needs hosted DB back or a headless-browser ingestion approach (plain fetch is
   bot-blocked for Home Centre/Danube/IKEA/2XL).

### Retailer scraping status (for catalog depth work)
- Home Centre, Danube, IKEA AE: 403 (TLS-fingerprint bot protection — even browser UA via curl
  fails). 2XL: 405. The One: adapter works but is dry-run-only by compliance gate. Catalog depth
  work likely needs either the hosted DB's existing catalog or a headless-browser ingestion
  approach; do not burn time on plain-fetch scraping.
