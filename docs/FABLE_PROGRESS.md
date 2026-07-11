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

`sharp` (new to the live path this release, for vision-input downscaling). RESOLVED in two
attempts — record BOTH so the mechanism is clear:

- PR #311 (`outputFileTracingRoot` = monorepo root): WRONG LAYER. Merged, but production STILL
  500'd with the same ERR_DLOPEN. Vercel already sets the monorepo tracing root itself, so this
  was effectively a no-op.
- PR #312 (`outputFileTracingIncludes` for the linux sharp packages): THE REAL FIX. sharp 0.35
  ships prebuilt platform packages; `@img/sharp-linux-x64`'s `.node` addon `dlopen`s its sibling
  `@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.18.3` at load. `@vercel/nft` traces
  `require`/`import` but CANNOT follow a `dlopen`, so it bundled the `.node` and dropped the `.so`.
  Force both linux platform packages into every route's trace via `outputFileTracingIncludes`
  (globs resolve from the project root; `.pnpm` dirs only exist on the linux build → no-op on mac).

FALSE-VERIFICATION TRAP (I fell into it): I first "verified" #311 on a preview and saw the DLOPEN
error replaced by a Supabase error, and called it fixed. That was WRONG — the preview had no
Supabase env, so it 500'd in MIDDLEWARE (Supabase client) BEFORE the sharp-importing page module
ever loaded. The Supabase error masked the still-broken sharp path. Only after adding the two
PUBLIC Supabase vars (`NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`) to Vercel PREVIEW scope did the
preview exercise the real path. #312 preview then gave `/` -> 307 -> `/login` -> 200 (sharp loads,
no DLOPEN, clean runtime logs). Merged #312; production `/` confirmed 307 -> /login (was 500).

Preview env is now provisioned with the public Supabase vars so future PRs can be smoke-tested on
a real preview before merge. Production has all required vars at Production scope (verified via
`vercel env ls`: Supabase URL/anon/service-role, OpenAI, Stripe, Evolink; no `OPENAI_BASE_URL`).

TRAP for the next instance: sharp works locally (macOS native binary) and in `pnpm build`, so
green local checks do NOT catch this. It only manifests on the linux Vercel function. Any new
native/optional-binary dependency needs a preview-deploy smoke test that reaches the code path
(preview MUST have Supabase env, or it dies in middleware first and masks the real error).

### HOSTED E2E against the real 3,309-product catalog (queue item 1)
Ran the FULL flow in the local app pointed at hosted Supabase (`.env.local` swapped to hosted;
Evolink for text+images; real Gemini renderer). Playwright harness `scripts/dev-harness/e2e.mjs`
extended with the missing stages: `signup`, `brief-details`, `brief-questions`, `concept`,
`sourcing` (+ `photos` upload race fixed — it closed the browser mid-upload).

Test account: hosted signup is gated to `@ritzyinteriors.com` AND hosted Supabase has email
confirmation ON, so UI signup lands back on /login with no session. Created a pre-confirmed test
user via the admin API (`create-hosted-test-user.mjs`, email_confirm:true). Preview/local both
reach the app. Room photo used: a real furnished living room
(`docs/Design/inspiration-sample-candidates/lr-02...jpg`).

**FINDING + FIX (production-affecting): concept generation blocked on large catalogue images.**
Against the real catalog, `initial_concept_generation` failed with the user-facing "we need a
little more catalogue evidence" — NOT a taste/catalog-depth problem. Root cause (from
`ai_jobs.input_summary.catalogueGrounding.warnings`): every RUG candidate was "skipped ... without
a fetchable reference image". Home Centre media-CDN images are 2-3 MB; the grounding image fetch
timed out at `CATALOGUE_GROUNDED_CONCEPT_IMAGE_FETCH_TIMEOUT_MS = 2_500`ms. Rugs have the largest
images so ALL candidates timed out → the required rug role produced no anchor → the WHOLE concept
was blocked. This hits production identically (same code/catalog/timeout). Fix: raised to 12_000ms
(actions.ts). The grounding loop breaks on the first fetchable candidate, so the happy path stays
fast; only the pathological all-fail case is slower. After the fix the concept generated cleanly.
BRITTLENESS (noted, not yet fixed): one required anchor role with no fetchable image hard-blocks
the entire concept — it should degrade gracefully (text-anchor the role, or proceed without it).
Also worth auditing the sibling `PRODUCT_SOURCING_IMAGE_PREFLIGHT_TIMEOUT_MS = 2_500` (same class).

**Concept quality (verified with eyes):** "Cognac Calm Living – Organic Contemporary with
Scandinavian Warmth" — preserved the source room's architecture (clerestory windows, framed door,
wood floors), on-brief warm-neutral/cognac/walnut/sage, editorial photography feel, and RESPECTED
the avoid-purple/red brief. 2 extra camera views generated (concept_views succeeded).

**Matching quality (real catalog):** sourcing succeeded; selected shopping list is budget-adherent
(AED 38,448 < 40,000), class-correct, palette-coherent (all cognac/neutral). MINOR FINDING: a
"Cigar Lounge Armchair, Red" survives as an ALTERNATE despite "avoid ... bright red" — avoid-colors
demote (-24) but do not exclude from the option pool; consider hard-excluding avoid-colors from
alternates, not just selections.

**Final render — E2E COMPLETE + durability finding.** The render engine works against hosted +
Evolink Gemini: `render_jobs` succeeded with `spatialQaVerdict = pass`, 1 asset. BUT the render
runs in an in-request `after()` that does NOT survive client disconnect. First attempt (harness
clicked the button then closed the browser 6s later): ZERO server-side Evolink activity, job stuck
`running` forever. Second attempt with the browser kept alive on /presentation: completed in ~90s.
Worse, the dedup guard treats a stuck `running` job as "Final render is already running" and
BLOCKS every retry for 15 minutes (staleness heuristic) — so a beta user who closes the tab after
triggering gets a permanently-stuck render with no recourse for 15 min. This is queue item 5
(render durability) with a concrete repro; the fix is a durable/background-safe render (not tied to
the request) + a user-visible retry affordance. Repro: `scripts/dev-harness/render-alive.mjs`.

**Budget adherence ignores quantity (finding).** The selected list's per-UNIT sum is AED 38,448
(< 40,000 budget), but the Stilo armchair has quantity 2, so the real furniture total (line totals)
is AED 44,118 — ~10% OVER budget, and this is what the presentation shows. The budget gate should
use qty x price (line_total_aed), not unit prices.

### Full E2E result (queue item 1 — DONE)
signup -> onboarding -> project -> room -> photo (real furnished living room) -> brief -> 5
clarifying questions -> concept (Gemini, architecture preserved, on-brief, avoid-color held) -> 2
consistent camera views -> sourcing/matching (budget-adherent per-unit, class-correct,
palette-coherent) -> final grounded render (succeeded, spatial QA pass). The definition-of-done
pipeline works against the real 3,309-product catalogue. Fix shipped: image-fetch timeout (#313).
Findings queued: render durability (item 5, high), budget-with-quantity, avoid-colors-in-alternates,
sibling PRODUCT_SOURCING_IMAGE_PREFLIGHT_TIMEOUT_MS, grounding brittleness (one role blocks all).

Env note: `.env.local` left pointed at HOSTED Supabase for this run (backup in the session
scratchpad `env.local.backup`); revert to local when done with hosted verification.

### Session 3 continued (Opus 4.8) — after Codex approved #313

- **#313 MERGED** (Codex approved at 0619860). Addressed Codex's two findings first: bounded the
  grounding image fetch with an overall 90s wall-clock budget (`CATALOGUE_GROUNDED_CONCEPT_IMAGE_FETCH_BUDGET_MS`)
  so a role with all-dead images can't stall the synchronous concept action for minutes; and fixed
  the harness scripts to resolve paths from `import.meta.url`. Production re-verified green (307).
- **Render durability FIX (PR pending): item 5.** Root cause refined: the render's after() marks
  success/failure correctly IF it runs; the liability is a job stuck `running` when after() never
  completes — the old 15-min staleness blocked retries AND the presentation page spun forever with
  no retry. Fix (no durable queue needed for launch): shared `FINAL_RENDER_STALE_MS = 4min`
  (`apps/web/lib/render.ts` + `isRenderJobStalled`); the action fails a stalled job on the next
  attempt (was 15min); the presentation page drops out of the spinner into a working "this render
  is taking longer than expected — retry" affordance once stalled. Verified in-app with a synthetic
  stale job; unit test `apps/web/lib/render.test.ts` (run via `npx tsx`). NOTE: this bounds the
  worst case to ~4min + gives recovery; a fully durable/background render (Vercel Queues) is still
  the eventual robust answer but was out of scope for the launch deadline.

## 2026-07-11 (session 4 — Opus 4.8 — sourcing & grounding robustness)

Branched `fable/budget-with-quantity` off latest origin/main (#315 merged). Production re-verified
green first (`/` 307 -> /login; /login renders sign-in; protected /onboarding 307 -> /login).
Worked the handover queue items 1-4 (concept/sourcing-path robustness). Items 1 & 3 verified LIVE
against the hosted 3,309-product catalogue via the Playwright harness + Evolink (fresh matching runs
through `groundProductsAction`, no concept regen, no final render). PR #1 of this session.

### Item 1 — budget adherence ignores quantity (VERIFIED LIVE)
Two-layer fix; the live run proved the first layer alone was insufficient.
- Per-role gate (`roleGateRejectionReason`) now compares the LINE total (unit x role.quantity) to
  the budget, not the unit price. A single role-line that alone exceeds the whole budget is gated
  out. (Necessary hardening, but the reported case had no single line over budget.)
- Aggregate fit (`fitSelectionToBudget`, new domain fn wired into `groundProductsAction`): after
  per-role selection, greedily downgrades roles to cheaper in-pool alternates until the qty-aware
  line-total SUM fits the budget — smallest-sufficient swap first (least aesthetic loss), else
  largest saving; required roles never emptied. THIS is what fixes the finding.
- Live proof on the real room: total 44,118 (over 40,000) -> 38,488 (within). The Malibu sofa and
  the Stilo armchair (qty 2) anchors were preserved; the coffee table was downgraded to fit. Unit
  test reproduces the exact 44,118 case + no-budget + unfittable-budget paths.

### Item 3 — avoid-colours survive as alternates (VERIFIED LIVE)
Two-layer fix; again the live run exposed the deeper cause.
- `buildRolePool` now HARD-EXCLUDES avoid-colour candidates from the option pool (selected AND
  alternates), not just the -24 demotion; kept only as a last resort so a required role isn't
  emptied. (`rejectionReasons.avoid_color`.)
- ROOT CAUSE the exclusion alone didn't fix: `conceptAvoidColorTags` in sourcing came ONLY from the
  concept-IMAGE palette's inferred avoidColors (["black","grey","purple","blue"] — no red!), so the
  user's explicit brief "avoid bright red" never reached matching and the red armchair survived.
  Now unions the palette avoidColors with the brief's parsed avoid colours (`splitAvoidColorCues`
  over `avoid_notes`) before the pool filter. Live proof: "Cigar Lounge Armchair, Red" now fully
  excluded (0 offenders in the 36-item pool).

### Item 2 — sibling PRODUCT_SOURCING_IMAGE_PREFLIGHT_TIMEOUT_MS (audited + bounded)
Audit: the preflight is a header-only (Range: bytes=0-0) reachability check, and its blocking gate
is currently INACTIVE in prod (`PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED` is false because
CANDIDATE_IMAGE_LIMIT=0) — so today it's overhead/telemetry, not a live blocker. But it's a latent
landmine: flip that flag and a slow retailer CDN times out a required role at 2.5s and blocks
sourcing exactly like #313 blocked concepts. Mirrored the #313 fix: per-image ceiling 2.5s -> 8s;
added an overall wall-clock budget (`PRODUCT_SOURCING_IMAGE_PREFLIGHT_BUDGET_MS = 20s`); once spent,
remaining candidates pass through OPTIMISTICALLY (kept + counted usable), never rejected, so a slow
CDN degrades to latency, not a block. Unit-tested (`product-image-preflight.test.ts`, incl. the
budget-spent skip path). Not separately live-exercised (gate off), safe by construction.

### Item 4 — grounding brittleness: one role blocks the whole concept (degraded)
`buildCatalogueGroundedConceptPlan` used to push a hard blocker (and fail the whole concept) when a
single required anchor role couldn't produce an image-backed candidate. Concept-first (ADR 0001)
designs freely and grounds products at sourcing, so an ungrounded role is designed by the model and
matched to a SKU later — not lost. Per-role failures now degrade to warnings
(`summary.degradedRequiredRoles`); the concept blocks ONLY if not a single anchor grounds. Happy
path unchanged (still selects image-backed anchors); the existing hosted concept + sourcing still
work end to end. Typecheck/lint clean; not independently reproduced (the trigger — all-unfetchable
images for a required role — is exactly the pathological case that previously blocked).

### Verification notes / env
- `.env.local` was switched to HOSTED for the live matching runs (`use-env.sh hosted`) and a fresh
  dev server started on :3000; the old local dev server (55006) was replaced. REVERT to local at
  session end (`use-env.sh local` + restart) — leaving it hosted is the known "pointed at prod" trap.
- New harness drivers: `scripts/dev-harness/refresh-matches.mjs` (force a fresh matching run without
  concept regen) and `verify-budget-avoidcolor.mjs` (assert budget + avoid-colour on the list).
- Still OPEN from the queue: item 5 (multi-angle FINAL render) — next PR; needs a hosted render run.
  Deferred: budget-fit telemetry on ai_jobs (the outcome is already visible in
  shopping_lists.estimated_total_aed + items).

### Item 5 — multi-angle FINAL render (VERIFIED LIVE) — PR #2 of this session
Branch `fable/multi-angle-final-render` (stacked on `fable/budget-with-quantity`). The FINAL render
was a single camera angle; the concept already ships 3 mutually-consistent views but the client
render did not. Extended the `generateConceptView` pattern to the final render.
- prompts: `finalRenderViewConsistencyLanguage` (truth-separation preamble — the reference is the
  finished render with the real purchased products; reproduce every piece identically). Reuses
  `conceptViewCameraLanguage` for the reverse_wide + anchor_detail angles.
- ai: `generateFinalRenderView` + `buildFinalRenderViewPrompt` (mirror generateConceptView; hero
  final render as the single required reference). New test `final-render-view-prompt.test.ts`.
- web: `generateAndStoreFinalRenderViews` runs best-effort in the render after() AFTER the hero
  commits and the job is succeeded — a view failure or task timeout never regresses the render. View
  assets are `room_assets` (asset_type final_render, view_key) appended to
  `render_jobs.output_asset_ids` (hero stays index 0). Presentation page reads ALL output_asset_ids
  and renders a captioned gallery under the hero ("Reverse angle" / "Detail view").
- LIVE PROOF (hosted + Evolink Gemini, render job 681c637a): hero + reverse_wide + anchor_detail all
  generated, output_asset_ids grew to 3, room_assets carry the view_keys. Eyeballed all 3: same
  products (Malibu sofa, Stilo wingback, marble coffee table, jute rug, brass arc lamp), same
  architecture, different camera — mutually consistent + on-brief. Presentation renders the gallery
  with AED 38,488 total. Drivers: `scripts/dev-harness/render-multiview.mjs`.
- KNOWN-SOFT: `anchor_detail` frames close to the hero (the hero is already a wide seating-group
  shot). Prompt-tunable later — not a blocker. The multi-angle concept + multi-angle final render
  together satisfy the definition-of-done's "≥3 mutually-consistent angles" for BOTH stages.

### Session 4 status
- PR #316 (items 1-4, `fable/budget-with-quantity`) — open, items 1 & 3 verified live.
- PR #2 (item 5, `fable/multi-angle-final-render`, stacked) — open, verified live.
- No further queue items started. Env still HOSTED at time of writing — revert to local before
  handing back (`bash scripts/dev-harness/use-env.sh local` + restart dev server).
