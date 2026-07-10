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

## 2026-07-10 (session 2 — after Ayo cleared blockers)

### State changes
- Hosted Supabase restored (DNS back; 3,309 real products). BUT the two new migrations
  (20260710120000_concept_view_assets, 20260710153000_concept_palette) are NOT applied there —
  Ayo must run them (SQL in the migration files) via dashboard SQL editor or `supabase db push`.
  Until then the hosted app will fail on concept views and palette selects.
- Evolink approved for OpenAI-SDK routing: .env.local sets OPENAI_BASE_URL=https://api.evolink.ai/v1,
  OPENAI_API_KEY=<evolink key>, OPENAI_TEXT_MODEL=gpt-5.1. Model decision: GPT-5.6 family is not
  yet on Evolink (API GA 2026-07-09); recommendation is gpt-5.6-luna ($1/$6, 82.5 vs GPT-5.5's
  83.4) once available; gpt-5.1 today. Vercel CLI is authenticated + linked (env updates possible).
- PR #310 review findings all addressed (required references, parallel+tracked concept views,
  revision views, dev-harness gitignore). Whitespace claim did not reproduce
  (`git diff main...HEAD --check` clean).

### LIVE E2E COMPLETED (local stack + Evolink text/images, real Gemini renderer)
Full flow verified in the running app: login -> onboarding -> project -> room -> photo -> brief
(with room-planning questions) -> clarifying questions (gpt-5.1) -> catalogue-grounded concept
(real Gemini render, architecture preserved, on-palette) -> two consistent concept views (live,
excellent identity consistency incl. anchored products) -> palette extraction (cached, accurate)
-> product grounding -> shopping list -> final render (in flight at writing).

Validated live: PM-001 traps ALL excluded (office chair, office table, bathroom mirror);
selected picks mostly palette-coherent; palette_json cached on concept.

### Failure classes found live and FIXED (each was a real production risk)
1. PostgREST embed ambiguity from the new concept_id FK silently emptied the concepts and
   product-matching pages (named-FK embeds now).
2. Provider-side image downloads flake (CDN rate limits, non-public hosts): ALL vision inputs now
   downscaled (sharp 1024px JPEG) + inlined as data URLs, incl. sourcing candidates (fetched
   app-side with retry) and catalogue references.
3. Gateway cost estimator rejects unbounded calls: every Responses call now sets
   max_output_tokens (4k-32k by call type).
4. Evolink references: verified live that data URLs ARE accepted (handoff Appendix A said
   otherwise); references now prefer public URLs and inline compressed (1280px JPEG) data URLs as
   fallback, so required room/concept references can never be dropped. Double-provider failures
   now surface both errors.
5. Final render prompt exceeded Evolink's 4000-token image-model prompt cap: product summary
   slimmed to visual facts (selection rationales removed), concept description truncated.
6. Evolink balance: image generation reserves credits; 402 "insufficient balance" was topped up
   by Ayo mid-session. Cost telemetry worth adding later.

### RESOLVED (was: open quality bug) — the purple-sofa anchor
Fixed and live-verified in three steps: (1) avoid-color phrases ("avoid purple") no longer read
as positive cue tokens (stripped + enforced via avoidColorTags); (2) anchor-loop skips are now
recorded as warnings (the silent skip was hiding the mechanism); (3) instrumentation showed the
real veto: style-module prose ("curved forms") gave the straight-armed ivory sofa a silhouette
"conflict" that hasHardCatalogueGroundingContradiction escalated into a hard skip — silhouette
reasons are now soft-only. Fresh-room verification: anchors = Ivory Linen sofa, Ivory Boucle
armchair, Walnut coffee table, Natural Jute rug. Exactly on-brief.

### Full E2E completed through FINAL RENDER + QA
Final grounded render succeeded via Evolink Gemini with spatialQaVerdict=pass, [] issues. The
render reproduced every shopping-list product faithfully (truth separation held). Remaining
known-soft spots: visual sourcing timed out once (text fallback engaged as designed — tune
PRODUCT_SOURCING_AI_TIMEOUT_MS vs gateway latency); concept image prompt is near Evolink's
4000-token image-prompt cap (render prompt was slimmed; concept prompt worth auditing).

### FORMER open bug notes (kept for history)
The catalogue-grounding ANCHOR loop picked the Royal Purple Vega sofa (attribute score 36, with
"colour cue lacks positive catalogue evidence") as the concept anchor even though the pool ranked
ivory/camel sofas far higher (240/166) and the brief said "avoid purple". The anchor then
propagated: concept was designed "around" it and sourcing preselected it (selected sofa = purple;
selected rug = the anchored burgundy Persian). Where to look: the anchor selection loop in
buildCatalogueGroundedConceptPlan (apps/web/app/actions.ts ~5205-5280) — why the top-ranked
candidates were skipped (hasHardCatalogueGroundingContradiction on cue-conflict weaknesses is the
suspect: ivory/camel likely flagged "conflicts" against some cue token while purple only got the
softer "lacks positive evidence"), plus consider hard avoid-color enforcement at anchor time
(cheap: pass brief avoid colors into the plan as avoidColorTags — the scorer already supports it).
Also: visual sourcing TIMED OUT (text fallback used, telemetry recorded); tune
PRODUCT_SOURCING_AI_TIMEOUT_MS vs Evolink latency or trim candidate images.

### Retailer scraping status (for catalog depth work)
- Home Centre, Danube, IKEA AE: 403 (TLS-fingerprint bot protection — even browser UA via curl
  fails). 2XL: 405. The One: adapter works but is dry-run-only by compliance gate. Catalog depth
  work likely needs either the hosted DB's existing catalog or a headless-browser ingestion
  approach; do not burn time on plain-fetch scraping.

## 2026-07-10 (session 3 — Opus 4.8, verifying the merged beta on production)

### PRODUCTION WAS DOWN — sharp native module 500 (PR #311, hotfix)
Branched `fable/beta-e2e-hosted` off origin/main. First action per brief: verify the #310
production deploy. It is BROKEN. `/` and the entire authenticated flow return 500; `/login`
returns 200 (it does not import the actions module). Runtime log root cause:

    Could not load the "sharp" module using the linux-x64 runtime
    ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared object file

`sharp` (new to the live path this release, for vision-input downscaling) is auto-externalized
by Next, so it is `require`d at runtime. In this pnpm monorepo sharp + its platform packages
(`@img/sharp-linux-x64`, `@img/sharp-libvips-linux-x64` carrying the `.so`) hoist to the repo-root
`.pnpm` store, OUTSIDE `apps/web`. Next output-file-tracing defaults to the project dir and
dropped those native files from the deployed function. Fix: set `outputFileTracingRoot` to the
monorepo root in `apps/web/next.config.ts` (the fix Next's own monorepo docs prescribe).

Verified on the PREVIEW deployment (linux-x64, identical runtime): after the fix the sharp DLOPEN
error is GONE. Preview then 500s on a DIFFERENT, pre-existing, preview-scoped issue — Supabase
public vars (`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`) are scoped Production-only, so preview has no
Supabase client. Production has all required vars at Production scope (confirmed via
`vercel env ls`; Supabase URL/anon/service-role, OpenAI, Stripe, Evolink; no `OPENAI_BASE_URL`),
so merging #311 restores production. Awaiting Ayo's merge approval, then confirm prod `/` != 500.

TRAP for the next instance: sharp works locally (macOS native binary) and in `pnpm build`, so
green local checks do NOT catch this. It only manifests on the linux Vercel function. Any new
native/optional-binary dependency needs a preview-deploy smoke test, not just `pnpm check`.
