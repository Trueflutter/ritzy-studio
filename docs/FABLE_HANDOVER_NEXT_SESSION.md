# Handover: next session (written by Opus 4.8, 2026-07-11, end of session 4)

Read order: this file → `docs/FABLE_PROGRESS.md` (full session log, newest at bottom — the session-4
entry has full detail) → `docs/FABLE_HANDOFF.md` (original brief, still the north star). Conventional
commits, trailer `Co-Authored-By: <your model name> <noreply@anthropic.com>`. Stage files by name.
NEVER merge without Ayo's explicit approval. Goal: launch-ready beta.

## Model note

Opus 4.8 handled session 4 well (deep multi-file reasoning + live verification + stacked PRs). The
remaining work is well-scoped engineering, not research — Opus 4.8 is a fine choice; Fable 5 is
equally capable and has continuity with these `FABLE_*` docs. Either works.

## State (verified this session, not aspirational)

- **Production is UP and green.** `www.ritzystudio.app`: `/` → 307 → /login, `/login` renders the
  sign-in page. Verify a real flow yourself before starting.
- **The definition-of-done pipeline works end-to-end against the real 3,309-product catalogue:**
  photo → concept → 3 mutually-consistent camera angles → budget-adherent, avoid-colour-clean,
  buyable shopping list → **multi-angle FINAL render** (hero + reverse + detail) → client-ready
  presentation. Both the multi-angle CONCEPT and the multi-angle FINAL render requirements are met.
- **Merged this session:** #316 (budget-with-quantity + avoid-colour exclusion + preflight
  bounding/skip + grounding degradation) and #318 (multi-angle final render + review fixes). `main`
  is at the #318 merge. **Note:** PR #317 was the original multi-angle PR; it auto-closed when its
  stacked base branch was deleted on the #316 merge, and was reopened as #318 — don't be confused by
  the gap. No migrations were needed (`room_assets.view_key` + `asset_type: final_render` already
  existed).

## Immediate queue (highest value first)

0. **First:** verify prod (`www.ritzystudio.app` real flow); branch off latest `origin/main`.
   `.env.local` is on LOCAL (default). Switch to `hosted` only for a real-catalogue verification
   pass (`bash scripts/dev-harness/use-env.sh hosted`), then back to local.
1. **Render durability (top priority).** The final render still rides an in-request `after()` task.
   #314 only bounds a stuck render to ~4 min + a retry affordance (`FINAL_RENDER_STALE_MS`,
   `isRenderJobStalled` in `apps/web/lib/render.ts`). Make it truly durable/background — **Vercel
   Queues** is the intended answer. This is the main beta-reliability gap. The multi-angle views run
   in the same `after()` after the hero commits (`generateAndStoreFinalRenderViews` in
   `apps/web/app/actions.ts`), so whatever you build must keep them working (they append to
   `render_jobs.output_asset_ids` and the presentation polls `final_render_views` until terminal).
2. **Cost telemetry.** Thread Evolink `usage.credits_used` → `ai_jobs.cost_estimate_usd`. We spend
   real credits blind. (Deferred deliberately; budget-fit outcome is already visible in
   `shopping_lists.estimated_total_aed`.)
3. **Grants migration.** The local-only grant fixups (service_role grants) are NOT codified in a
   migration — a fresh DB provision would miss them. See FABLE_PROGRESS 2026-07-10.
4. **Concept-prompt token audit** vs Evolink's 4000-token image-prompt cap
   (`buildInitialConceptImagePrompt`) — it runs near the cap; a complex brief could truncate.
5. **Cosmetic:** the `anchor_detail` final-render angle frames close to the hero (the hero is already
   a wide seating-group shot). Tune `conceptViewCameraLanguage`'s `anchor_detail` for a genuinely
   tighter composition.

## Setup / how to verify (green tests are NOT the bar — verify in the running app)

- **The user's Chrome CANNOT reach localhost** — drive the local app with the Playwright harness in
  `scripts/dev-harness`, never claude-in-chrome. (Browser tools CAN reach the hosted prod URL.)
- **Reinstall Playwright in an ISOLATED dir** with its own `package.json` — do NOT `npm install`
  inside the repo (npm walks up to the monorepo root and corrupts pnpm). Browsers cache in
  `~/Library/Caches/ms-playwright` (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`).
- **Env switch:** `bash scripts/dev-harness/use-env.sh hosted|local`, then restart `pnpm dev`.
  Revert to local when done — leaving it on hosted is the known "pointed at prod" trap.
- Verify against the **real Gemini renderer via Evolink** (`RITZY_IMAGE_PROVIDER=evolink`), never
  gpt-image-2.
- Harness drivers (read own test data only): `e2e.mjs` (staged flow), `refresh-matches.mjs` (fresh
  matching run without concept regen), `verify-budget-avoidcolor.mjs` (assert budget + avoid-colour
  on the list), `render-multiview.mjs` (trigger a render and keep the browser alive until the angle
  views land), `read-ai-job.mjs` (dump ai_jobs/grounding diagnostics). Hosted test user + state in
  `scripts/dev-harness/e2e-state.json` (gitignored).

## Traps the next instance must not rediscover

- **Production moves ONLY via merge to `main`.** A bash-guard hook blocks manual `vercel --prod`
  (even `vercel ls --prod` false-triggers it). For rollback: `vercel promote <last-good-deployment>`.
- **Native/optional-binary deps (sharp) fail ONLY on the Vercel linux function**, never locally or in
  `pnpm build`. Verify any such change on a PREVIEW deploy that reaches the code path (preview has
  the public Supabase vars). `sharp` needs `outputFileTracingIncludes`. See
  `[[project-native-dep-vercel-trace]]`.
- **Stacked PRs:** if you stack PR-B on PR-A's branch, RETARGET PR-B to `main` BEFORE merging PR-A —
  merging PR-A with `--delete-branch` auto-closes PR-B and you cannot reopen it against a deleted
  base (session 4 hit this; had to recreate #317 as #318).
- PostgREST embeds on concepts↔room_assets MUST name the FK
  (`room_assets!concepts_primary_image_asset_id_fkey`) or pages fail SILENTLY (empty data).
- Evolink image prompts cap at 4000 tokens; every `client.responses.create` must set
  `max_output_tokens`; vision inputs must be inlined data URLs (`visionImageDataUrl`).
- "avoid X" phrases must never enter cue/matching text as positive tokens (`splitAvoidColorCues`).
  Sourcing avoid-colours now UNION the concept-image-palette avoidColors with the brief's parsed
  avoid colours (`avoid_notes`) — keep that; the palette alone missed the user's explicit "avoid red".
- Hosted service-role queries that print user emails/IDs/secret prefixes trip the sandbox PII guard.
  Query only what you need (ai_jobs, render_jobs, your own test data); never enumerate users.
- Grounding diagnostics live in `ai_jobs.input_summary.catalogueGrounding.warnings` — READ THEM
  before guessing why a concept blocked.

## Conventions

Branch off latest `origin/main` (never work on main — hook-enforced). Conventional commits, stage
files by name (untracked scratch dirs exist). Build/typecheck/lint/test all green before PR
(lint+typecheck from `apps/web`: `./node_modules/.bin/tsc -p tsconfig.json --noEmit` and
`./node_modules/.bin/eslint .`; package tests are plain `tsx` scripts, e.g. `pnpm --filter
@ritzy-studio/domain test`). Open PRs and present the URL. **Never merge without Ayo's explicit
approval.**

## Definition of done (unchanged, from FABLE_HANDOFF.md)

Real person, real photo → spatially sound, beautiful, on-brief design from ≥3 mutually consistent
angles, matched to real non-repeating buyable furniture within budget, client-ready presentation,
reliably. All of this is met EXCEPT the reliability bar under load — the final render still rides an
in-request `after()` (queue item 1). That is the last thing standing between "works" and "works
reliably for a beta group."
