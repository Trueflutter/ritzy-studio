# Handover: Render durability (Fable queue item #1)

Written 2026-07-12. For the fresh instance picking up the **top-priority** beta-reliability gap.

Read order: this file → `docs/FABLE_HANDOVER_NEXT_SESSION.md` (queue + traps) →
`docs/FABLE_PROGRESS.md` (session log) → `docs/FABLE_HANDOFF.md` (north star). Conventions:
branch off latest `origin/main` (never work on main — hook-enforced), conventional commits, stage
files by name, trailer `Co-Authored-By: <your model name> <noreply@anthropic.com>`, build + typecheck
+ lint + test green before PR, **never merge without Ayo's explicit approval.**

---

## The one-line problem

The final render (and, with the same shape, the concept renders) runs inside an in-request
Next.js **`after()`** task. If the function is torn down before/while `after()` runs, or a provider
call hangs past the function budget, the `render_jobs` row is stranded in `running` with no
recovery until a user manually retries. **This is the last thing between "works" and "works
reliably for a beta group"** (per `FABLE_HANDOFF.md` definition of done). Make render execution
**durable / background**. The intended answer is **Vercel Queues** (durable, at-least-once,
built on Fluid Compute); evaluate **Vercel Workflow** as an alternative (below).

---

## Exactly how it works today (read these before changing anything)

**`apps/web/app/actions.ts` → `generateFinalRenderAction` (starts line ~4506).**
1. Auth + validates room / concept / shopping list / room photo / selected products.
2. Downloads the room photo and concept image; resolves the selected products.
3. Computes `selectionKey = selectedShoppingItemIds.sort().join(",")` — the idempotency key.
4. Looks up an existing `render_jobs` row for this (room, concept, shoppingList, selectionKey):
   - If `running`/`queued` and **not** stale → redirect to the reveal ("already running").
   - If stale (`Date.now() - created_at > FINAL_RENDER_STALE_MS`) → **atomic CAS** flip to
     `failed` filtered on `.in("status",["running","queued"])`; if 0 rows were updated another
     path already resolved it, so defer (lines ~4656-4692).
   - If `succeeded` with assets and commerce locked → redirect to the reveal ("ready").
5. Inserts a **new `render_jobs` row with `status: "running"`** (line ~4703). A DB unique
   constraint returns `23505` on a duplicate concurrent job → treated as "already running".
6. **`after(async () => { … })` (line ~4730-4940)** does the heavy lifting:
   - Build the prompt with up to 8 product image references, call the image provider
     (Evolink/Gemini or gpt-image-2), run spatial QA + at most one corrective regen.
   - Upload the hero to the `generated-renders` bucket, insert a `final_render` `room_assets` row
     (its `view_key` is **null** — that's the hero discriminator; multi-angle views set `view_key`).
   - **CAS success write** (lines ~4862-4890): update the job to `succeeded` with
     `output_asset_ids: [heroAssetId]`, filtered `.eq("id", jobId).eq("status","running")`. **If 0
     rows** matched, a stale-retry reclaimed the job → delete the just-made asset + storage object
     and return (never resurrect a reclaimed job). **This CAS is the idempotency guarantee — keep it.**
   - `rooms.status → "rendering"`, `revalidatePath(revealPath)`.
   - Best-effort **`generateAndStoreFinalRenderViews`** (defined ~line 318): creates an
     `ai_jobs` row (`job_type: "final_render_views"`), generates reverse/detail angles, and
     **appends** their ids so `render_jobs.output_asset_ids = [hero, ...views]` (line ~426). Its own
     try/catch keeps view failures off the hero's success path.
   - **CAS failure write** (lines ~4929-4937): on throw, update to `failed` filtered
     `.eq("id", jobId).eq("status","running")` so a reclaimed/finalised job is never overwritten.
7. After scheduling `after()`, `revalidatePath` + redirect to
   `…/presentation?renderJobId=<jobId>&message=Final render started.`

**`apps/web/lib/render.ts`** — the current mitigations (NOT durability):
- `FINAL_RENDER_STALE_MS = 4 min`, `isRenderJobStalled(status, createdAt)` → the action fails a
  stalled job on the next attempt; the presentation drops its spinner into a retry affordance.
- `FINAL_RENDER_VIEWS_WINDOW_MS = 5 min`, `isWithinFinalRenderViewsWindow(createdAt)` → bounds how
  long the presentation polls for the angle views.

**`…/presentation/page.tsx` + `presentation/render-refresh.tsx`** — the client contract:
- Reads the job by `?renderJobId` (routed) or by `selectionKey` (latest for the selection).
- `RenderRefresh` calls `router.refresh()` every 12 s while `showRenderProgress || showViewProgress`.
- Hero = `output_asset_ids[0]`; additional views = the rest. `AnimatedStatus` shows phase progress.
- **Any durability rework must keep this contract**: land the client on the reveal with the job id,
  keep `render_jobs.status` transitions and `output_asset_ids` shape, and keep `revalidatePath`ing
  the reveal so the poll picks up the result.

Same `after()` pattern (same gap, migrate as a **follow-up**, not in PR 1):
`generateInitialConceptAction` (`after()` ~line 2498) and `reviseConceptAction` (~line 5209).

---

## Invariants that MUST survive the rework

1. **`render_jobs` is the durable source of truth.** All status is on that row; the client polls it.
2. **At-least-once delivery ⇒ the consumer must be idempotent.** The existing
   `.eq("status","running")` CAS on both the success and failure writes already delivers this —
   preserve it, and additionally **no-op if the job is already `succeeded`**. A redelivery must not
   produce a second asset or a second `succeeded` job.
3. **`output_asset_ids[0]` is the hero (`view_key IS NULL`); the rest are angle views.** The
   dashboard cover and product-matching hero now depend on `view_key IS NULL` (PR #320) — don't
   regress that.
4. **Views are best-effort** and append to `output_asset_ids`; never let a view failure fail the hero.
5. **`rooms.status → "rendering"`** and **`revalidatePath(revealPath)`** after the hero commits.
6. **The reveal URL carries `?renderJobId`** so the client lands on the right job.
7. Provider selection via `RITZY_IMAGE_PROVIDER` (default `openai`; verify with `evolink` = real
   Gemini). Don't hardcode a provider.

---

## Recommended direction

**Primary: Vercel Queues** (durable event streaming, at-least-once, on Fluid Compute — public beta).
Load the Vercel skills first (`vercel:workflow`, and the session-injected Vercel knowledge on
Queues) and read the current docs — the API is beta and moving; do not code from memory.

Concrete migration (PR 1 = final render only):
1. **Extract** the `after()` body (actions.ts ~4730-4940) into a standalone, idempotent
   `runFinalRender({ renderJobId })` in a new module (e.g. `apps/web/lib/render-runner.ts`). It
   **re-fetches** everything it needs from the `render_jobs` row + related tables. **Do not put
   image blobs on the queue** — pass only `{ renderJobId }` (+ maybe the reveal path) and re-download
   in the consumer. Keep both CAS writes and the views call verbatim.
2. **`generateFinalRenderAction`**: insert the job as `status: "queued"`, **enqueue
   `{ renderJobId }`**, then redirect to the reveal (unchanged URL contract). Remove the `after()`.
3. **Consumer**: a Vercel Function subscribed to the queue calls `runFinalRender`. Set
   `maxDuration` ≥ 300 s (a Gemini render can take 3–5 min; 300 s is the current default — confirm it
   covers hero + QA + regen, and let the views run inside or as a chained message). Handle at-least-once
   by leaning on the CAS + the "already succeeded → no-op" guard.
4. **Retries**: let Queues redeliver on failure with a capped attempt count; on final failure do the
   CAS `failed` write. Once queue retries are proven, you can **relax** the 4-min in-action stale
   reclamation, but **keep `isRenderJobStalled` as a safety net** until then (don't rip it out in PR 1).
5. Leave concept renders on `after()` for now; migrate them in a PR 2 with the same runner pattern.

**Alternative to weigh: Vercel Workflow** (durable multi-step). The render is genuinely multi-step
(hero → spatial QA → optional regen → commit → 3 angle views); a durable workflow with checkpointed
steps models that cleanly and survives a restart *between* steps. If the beta API is ergonomic, it
may beat a single long queue consumer. Decide after reading both docs.

---

## Verify (green tests are NOT the bar — verify the real behaviour)

- **The user's Chrome cannot reach localhost** — drive the local app with the Playwright harness in
  `scripts/dev-harness`, never claude-in-chrome. Browser tools CAN reach the hosted prod URL.
  See `[[project-local-dev-stack]]` and `scripts/dev-harness/README.md`.
- Harness: `render-multiview.mjs` (trigger a render, keep the browser alive until the angle views
  land), `read-ai-job.mjs [roomId]` (dump `render_jobs` / `ai_jobs` status). Render against the real
  renderer: `RITZY_IMAGE_PROVIDER=evolink`, never gpt-image-2.
- **Vercel Queues/Workflow only run on Vercel infra.** Locally you can exercise the *enqueue* path and
  a directly-invoked `runFinalRender`; verify the true durable path on a **preview deploy** that
  reaches the consumer. Preview has the public Supabase vars — confirm the **service-role key** is in
  the preview env (the consumer does service-role writes) before relying on it.
- **The durability proof:** start a render, then kill/abandon the originating request (or simulate a
  teardown) and confirm the queued job **still completes**. Then confirm **idempotency**: force a
  redelivery and confirm no duplicate `final_render` asset and no second `succeeded` job.
- If the runner touches `sharp`: native/optional binaries **fail only on the Vercel linux function**,
  never locally or in `pnpm build`. Verify on a preview that hits the code path; `sharp` needs
  `outputFileTracingIncludes`. See `[[project-native-dep-vercel-trace]]`.

## Traps (still true)

- **Production moves ONLY via merge to `main`.** A bash-guard hook blocks manual `vercel --prod`
  (even `vercel ls --prod` false-triggers it). Rollback: `vercel promote <last-good-deployment>`.
- PostgREST embeds on concepts↔room_assets MUST name the FK
  (`room_assets!concepts_primary_image_asset_id_fkey`) or pages fail **silently** (empty data).
- Evolink image prompts cap at 4000 tokens; every `client.responses.create` sets
  `max_output_tokens`; vision inputs are inlined data URLs.
- Hosted service-role queries that print user emails/IDs/secret prefixes trip the sandbox PII guard —
  query only what you need (`render_jobs`, `ai_jobs`, your own test data).
- **Never merge without Ayo's explicit approval.** Open the PR and present the URL.

## Scope / definition of done for this work

A final render survives the originating request being torn down and completes in the background;
retries are automatic and idempotent (no duplicate assets/jobs); the multi-angle views still land
and the presentation still reveals them; the 4-min manual-retry crutch is no longer the primary
recovery path. Proven on a preview deploy. Concept-render migration is an explicit follow-up.
