# Handover: next session (written by Opus 4.8, 2026-07-11, mid session 3)

Read order: this file → `docs/FABLE_PROGRESS.md` (full session log, newest at bottom) →
`docs/FABLE_HANDOFF.md` (original brief, still the north star). Conventional commits, trailer
`Co-Authored-By: <your model name> <noreply@anthropic.com>`. Stage files by name. NEVER merge
without Ayo's explicit approval. Goal: launch-ready beta.

## State (verified this session, not aspirational)

- **Production is UP.** `www.ritzystudio.app` serves (`/` → 307 → /login, all routes healthy).
  It had been fully 500'ing (sharp native module) after the #310 merge; fixed and re-verified.
- **Merged:** #312 (sharp libvips trace fix — the prod hotfix), #313 (concept-unblock: catalogue
  image-fetch timeout 2.5s→12s + an overall 90s grounding fetch budget; plus harness), #314 (render
  durability — stalled-render recovery: `FINAL_RENDER_STALE_MS`=4min + `isRenderJobStalled`, the
  presentation page drops the infinite spinner for a retry affordance, and the stale-retry failover
  is an error-checked compare-and-swap with an after()-completion reclamation guard so a slow render
  can't resurrect a reclaimed job or delete a valid one). Prod re-verified green after each.
  Remaining render work: a truly durable/background render (Vercel Queues) — #314 only bounds the
  stuck window to ~4min with recovery.
- **Full E2E works against the hosted 3,309-product catalogue** (definition-of-done pipeline):
  signup → onboarding → project → room → real room photo → brief → 5 clarifying questions →
  concept (Gemini via Evolink, architecture preserved, on-brief, **avoid-color held**) → 2
  consistent camera views → sourcing/matching (class-correct, palette-coherent) → final grounded
  render (succeeded, spatial QA `pass`). Evidence + per-fix detail: FABLE_PROGRESS.md session-3.

## Immediate queue (highest value first)

0. **First:** branch off latest `origin/main`; verify prod (`www.ritzystudio.app` real flow); run
   `bash scripts/dev-harness/use-env.sh local` state is already the default — switch to `hosted`
   only for a real-catalogue verification pass, then back.
1. **Budget adherence ignores quantity** (finding, task #8). Selected per-UNIT sum was AED 38,448
   (< 40k budget) but real line total (an armchair at qty 2) was AED 44,118 — ~10% over, and that
   over-budget number is what the presentation shows. The budget gate should use `line_total_aed`
   (qty × price), not unit prices. Find the budget filter in the sourcing/grounding path.
3. **Sibling timeout** `PRODUCT_SOURCING_IMAGE_PREFLIGHT_TIMEOUT_MS = 2_500` (actions.ts) is the
   same class as the #313 concept-blocker (large Home Centre images). Audit/raise + bound it the
   same way the grounding fetch now is.
4. **Avoid-colors in alternates** (finding, task #9, minor). A "Cigar Lounge Armchair, Red" survived
   as an ALTERNATE despite brief "avoid bright red"; `avoidColorTags` (−24) demotes but doesn't
   exclude from the visible option pool. Consider hard-excluding avoid-colors from alternates.
5. **Grounding brittleness.** One required anchor role with no fetchable image hard-blocks the whole
   concept (`buildCatalogueGroundedConceptPlan` blockers). Degrade gracefully (text-anchor the role
   or proceed without it) instead of blocking the entire concept.
6. **Original queue items still open:** concept-prompt token audit vs Evolink's 4000-token image
   cap (`buildInitialConceptImagePrompt`); multi-angle FINAL render (concept already has views;
   extend `generateConceptView` pattern to final_render + view_key); cost telemetry (Evolink
   `usage.credits_used` → ai_jobs.cost_estimate_usd); grants migration.
7. **Render: truly durable** (beyond #314's 4-min recovery). #314 bounds the stuck state and gives a
   retry, but the render still rides an in-request `after()`. Vercel Queues / a background job is the
   robust long-term answer.

## Setup to reproduce the hosted E2E

- Local dev stack already stood up last session: colima + `supabase start` (:55321). The app dev
  server (`pnpm dev`, :3000) was left running pointed at HOSTED Supabase.
- **`.env.local` is currently pointed at HOSTED** (backup at the session scratchpad
  `env.local.backup`; the swap is reversible — each hosted key has a `# LOCAL (swapped out...)`
  comment above it). Revert to local when done with hosted verification. Text + images route through
  Evolink; `RITZY_IMAGE_PROVIDER=evolink`.
- **Playwright:** installed in an ISOLATED dir last session (`<scratchpad>/pw`) and symlinked to
  `scripts/dev-harness/node_modules` (both gone next session). Reinstall: `npm i playwright` in an
  isolated dir WITH ITS OWN package.json (do NOT `npm install` inside the repo — npm walks up to the
  monorepo root package.json and tries to install the whole workspace, corrupting pnpm). Browsers
  are cached in `~/Library/Caches/ms-playwright` (use `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`).
- **Harness** `scripts/dev-harness/e2e.mjs` now has stages: signup, login, onboarding, project,
  room, photos, brief-style, brief-inspiration, brief-details, brief-questions, concept, sourcing,
  render, inspect. Helpers: `create-hosted-test-user.mjs` (admin-API pre-confirmed account),
  `read-ai-job.mjs` (dump ai_jobs/render diagnostics for a room), `render-alive.mjs` (render repro).
  Test account creds are in `scripts/dev-harness/e2e-state.json` (gitignored).
- **Hosted test account:** signup is gated to `@ritzyinteriors.com` AND hosted has email
  confirmation ON, so UI signup can't auto-login — use the admin-API pre-confirmed account script.

## Traps the next instance must not rediscover

- **Native/optional-binary deps (sharp) fail ONLY on the Vercel linux function**, never locally or
  in `pnpm build`. Verify any such change on a PREVIEW deploy that reaches the code path. Preview now
  has the public Supabase vars (added this session) so it doesn't die in middleware first. `sharp`
  needs `outputFileTracingIncludes` (the `.node` dlopen's a sibling libvips `.so` that nft can't
  trace). See `[[project-native-dep-vercel-trace]]` memory.
- **Hosted DB queries via service-role trip the sandbox's PII/credential guards** if you print user
  emails/IDs or even partial secret values. Query only what you need (ai_jobs, render_jobs, your own
  test data); never enumerate users or print key prefixes.
- PostgREST embeds involving concepts↔room_assets MUST name the FK
  (`room_assets!concepts_primary_image_asset_id_fkey`) or pages fail SILENTLY (empty data).
- Vision inputs must be inlined data URLs (`visionImageDataUrl`); Evolink image prompts cap at 4000
  tokens; every `client.responses.create` must set `max_output_tokens`.
- "avoid X" phrases must never enter cue/matching text as positive tokens (`splitAvoidColorCues`);
  `hasHardCatalogueGroundingContradiction` must not hard-veto on soft styling/silhouette signals.
- Grounding diagnostics live in `ai_jobs.input_summary.catalogueGrounding.warnings` — READ THEM
  before guessing why a concept blocked.
- The user's Chrome CANNOT reach localhost — drive the local app with the Playwright harness, never
  claude-in-chrome. (Production is a real hosted URL, so browser tools CAN reach it.)
- Harness closes the browser between stages; anything client-side-async (photo upload, the render
  after()) needs a live browser until it completes, or it silently doesn't persist/run.

## Definition of done (unchanged, from FABLE_HANDOFF.md)

Real person, real photo → spatially sound, beautiful, on-brief design from ≥3 mutually consistent
angles, matched to real non-repeating buyable furniture, client-ready presentation, reliably. The
multi-angle CONCEPT requirement is met; the FINAL render is still a single angle (queue).
