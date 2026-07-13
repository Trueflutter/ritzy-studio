# Render durability: move the final render onto Vercel Queues

Date: 2026-07-12. Author: Claude Fable 5. Branch: `fable/render-durability-queue`. Base: `origin/main` (17cb0cc).
Risk tier: HIGH (beta-blocker path, new platform primitive, touches the money path end of the funnel).
Source brief: `docs/FABLE_HANDOVER_RENDER_DURABILITY.md` (file:line map, invariants, verification bar).

## Problem

The final render runs inside an in-request Next.js `after()` task
(`apps/web/app/actions.ts:4730-4940`). If the function is torn down before/while `after()` runs,
or a provider call hangs past the function budget, the `render_jobs` row strands in `running`.
Recovery today is a 4-minute staleness heuristic + a manual retry affordance — a crutch, not
durability. Reproduced live (session 3, `render-alive.mjs`): close the tab ~6s after triggering
and the render never starts server-side.

## Decision: Vercel Queues (not Vercel Workflow)

- **Queues** is the handover's primary recommendation: durable, at-least-once, push-mode consumer
  on Fluid Compute. Integration surface is small: one SDK (`@vercel/queue`), one air-gapped
  consumer route, one `vercel.json` entry, `send()` in the action.
- **Workflow** (evaluated, rejected for this PR): it models the multi-step render nicely, but it
  requires the Workflow DevKit build integration (`withWorkflow` next.config wrapper + a compiler
  transform over the app) — a much larger blast radius on Next 16.2.4 for a launch blocker. Its
  step-checkpointing adds little here because our idempotency is already carried by DB CAS
  writes, and Workflows is itself built on Queues. Revisit post-beta if the render grows more steps.
- Facts confirmed from current docs (2026-06/07): push consumers are configured via
  `vercel.json` `experimentalTriggers` (`type: "queue/v2beta"`), have **no public URL** (no auth
  needed in the route), `handleCallback` auto-extends the visibility lease while the handler runs
  (default `visibilityTimeoutSeconds: 300`), retries are controllable via a `retry` callback with
  `metadata.deliveryCount`, and topics are **partitioned by deployment ID** — a preview deploy
  consumes its own messages, and during production rollouts the old deployment drains its own.

## Design

### State machine (render_jobs.status)

```
insert "queued" ──enqueue──▶ consumer claims: CAS {queued,running}→running
                                   │
                     success CAS running→succeeded (unchanged, verbatim)
                     failure: see the explicit error contract below
```

### Runner error contract (explicit — the two modes differ)

`runFinalRender({ renderJobId, attempt })` where `attempt` is
`{ mode: "inline" } | { mode: "queue", deliveryCount: number }`. On a thrown error past the claim:

- **inline**: CAS `running→failed` immediately with the real `error_message` (today's catch,
  verbatim) and return. No rethrow — there is no redelivery in `after()`; rethrowing would strand
  the job in `running` behind a 4-minute spinner.
- **queue, `deliveryCount >= 3`**: CAS `running→failed` with the real `error_message`, return
  normally ⇒ `handleCallback` acks. The `retry` callback's `{ acknowledge: true }` at the same
  threshold is the belt-and-braces backstop, not the primary mechanism.
- **queue, `deliveryCount < 3`**: leave the job `running` and **rethrow** ⇒ Queues redelivers
  after 60s. Accepted cost (documented, not fixed here): a deterministic provider failure burns up
  to 3 render attempts (~2 extra minutes + spend) before the user sees `failed`; reliable
  transient-vs-permanent classification of provider errors isn't feasible in this PR and the cap
  bounds the cost.

- The action inserts the job as `status: "queued"` (was `"running"`). The presentation page and
  `isRenderJobStalled` already treat `queued` as in-progress (`presentation/page.tsx:186`,
  `lib/render.ts:18`), and the action's dedup guard already checks both statuses. No client change.
- **Claim** in the runner: `update({status:"running"}).eq("id",jobId).in("status",["queued","running"])`.
  0 rows ⇒ job is terminal (succeeded/failed/reclaimed) ⇒ **no-op ack** (invariant 2's
  "already succeeded ⇒ no-op", strengthened to "already terminal ⇒ no-op").
- **Success CAS** and **failure CAS** keep the existing `.eq("status","running")` filter verbatim,
  including the discard-orphaned-asset branch on a lost race.
- **Attempt-unique storage paths** (fixes a real race the current code would corrupt under
  redelivery): today the hero uploads to `final-${jobId}.png` with `upsert: true`, so two
  deliveries of the same message share ONE storage object — the CAS loser would overwrite the
  committed winner's PNG and its asset insert would die on the `unique (storage_path)` constraint
  before the discard branch ever ran. Fix: suffix the hero and view upload paths with a
  per-invocation nonce (`final-${jobId}-${nonce}.png`, `crypto.randomUUID()` slice). Each delivery
  owns its object; the loser's asset insert succeeds, it loses the success CAS, and the existing
  discard branch deletes its own asset + object without touching the winner's. Orphaned objects on
  a crash between upload and CAS are possible and accepted (same exposure as today's
  upload-then-insert gap).
- **Retries**: per the error contract above; the consumer's `retry` callback
  (`deliveryCount >= 3 ⇒ acknowledge`) is the backstop. Between attempts the job stays `running`;
  the existing 4-minute stale-reclaim + presentation retry affordance remain as the user-visible
  safety net (deliberately NOT relaxed in this PR, per handover step 4). Known, accepted race that
  is now MORE likely: attempt 1 + backoff can exceed 4 minutes, so a user can hit "retry" while a
  queue attempt is in flight — the reclaim flips the job to `failed`, the in-flight attempt loses
  its success CAS and discards its own render (wasted spend, zero corruption, no duplicates). This
  exact race gets a verification criterion below.
- **Views polling window**: `isWithinFinalRenderViewsWindow` currently measures 5 min from job
  `created_at`; under queue retries the hero can commit later than that and the views would never
  auto-reveal. Change the presentation call site to measure from `completed_at` (fallback
  `created_at`) — views poll for 5 min after the hero commits. Client contract otherwise unchanged.

### Module extraction

New `apps/web/lib/render-runner.ts` (plain server module, no `"use server"`):

- `runFinalRender({ renderJobId, attempt })` — re-fetches everything from the DB
  (render_jobs row → room, project owner, concept + primary image via the **named FK embed**,
  first room_photo, shopping_list_items by `input_summary.selectedShoppingItemIds` with product
  embeds), downloads the two source images, then executes the current `after()` body verbatim:
  prompt build with ≤8 product references, provider call, spatial QA + ≤1 corrective regen,
  hero upload + `room_assets` insert (`view_key` **null** = hero discriminator), success CAS,
  `rooms.status → "rendering"`, `revalidatePath(revealPath)`, best-effort
  `generateAndStoreFinalRenderViews` (moved here too), failure CAS.
- The queue message carries **only `{ renderJobId }`** — no blobs, no derived state. `userId`
  (storage path prefix) and `revealPath` are stashed additively in `input_summary` at insert time
  AND re-derivable from the row (rooms→projects.owner_user_id; project/room ids) as fallback for
  robustness.
- Helpers that move out of `actions.ts` (a `"use server"` module can't export non-async symbols)
  into `apps/web/lib/`: `fetchRemoteImage`(+`fetchRemoteImageOnce`, `CatalogueReferenceImage`,
  its timeout consts), `visionImageDataUrl`, `bytesToDataUrl` (if coupled),
  `formatProductDimensionsForRender`, `roleLabelFromSelectionReason`,
  `localSkuFidelityModeEnabled` (+ the reference-limit const), `productReferenceOrderingV2Enabled`,
  `CONCEPT_VIEW_KEYS`, `configuredImageProvider`, `configuredImageModel`,
  `generateAndStoreFinalRenderViews`. `actions.ts` imports them back. Pure moves, no logic edits —
  the diff must read as extraction, verified by typecheck + the harness run.

### Execution mode (local dev must keep working)

Queues only run on Vercel infra. New helper `renderExecutionMode(): "queue" | "inline"` in
`packages/config`:

- `RITZY_RENDER_EXECUTION=queue|inline` explicit override (also the production kill-switch);
- default: `queue` when `process.env.VERCEL` is set, else `inline`.

`generateFinalRenderAction` after the job insert:

- **queue**: `await send("final-render", { renderJobId })`. If `send` throws (misconfigured beta,
  missing permission), log loudly, record `executionPath: "inline-fallback"` in `input_summary`,
  and fall back to the inline path — a queue outage degrades to today's behaviour, never a dead job.
- **inline**: `after(() => runFinalRender({ renderJobId }))` — the current behaviour, now through
  the shared runner, used by local dev and the Playwright harness.

### Consumer route

`apps/web/app/api/queues/final-render/route.ts`:

```ts
import { handleCallback } from "@vercel/queue";
import { runFinalRender } from "@/lib/render-runner";

export const maxDuration = 800; // hero + QA + regen + QA + views worst case ≈ 10 min

export const POST = handleCallback(
  async (message, metadata) => {
    await runFinalRender({
      renderJobId: message.renderJobId,
      attempt: { mode: "queue", deliveryCount: metadata.deliveryCount }
    });
  },
  { retry: (_error, metadata) => (metadata.deliveryCount >= 3 ? { acknowledge: true } : { afterSeconds: 60 }) }
);
```

`vercel.json` gains:

```json
"functions": {
  "apps/web/app/api/queues/final-render/route.ts": {
    "experimentalTriggers": [{ "type": "queue/v2beta", "topic": "final-render", "retryAfterSeconds": 60 }]
  }
}
```

(Route is air-gapped by the trigger — no public URL, no auth logic needed. `maxDuration` via the
route export; the `retry` callback in `handleCallback` is the attempt cap.)

`sharp` note: the runner uses `visionImageDataUrl` (sharp). `outputFileTracingIncludes` in
`next.config.ts` already forces the linux sharp packages into **every** route's trace (`"/**"`),
which covers the new route. Still preview-verified per the native-dep trap.

## Invariants preserved (handover list, point by point)

1. `render_jobs` stays the durable source of truth; client polls it — unchanged.
2. At-least-once ⇒ idempotent consumer: claim CAS + success/failure CAS + terminal no-op ack.
3. `output_asset_ids[0]` = hero (`view_key IS NULL`); views appended after — code moved verbatim.
4. Views best-effort, never fail the hero — moved verbatim (own try/catch).
5. `rooms.status → "rendering"` + `revalidatePath(revealPath)` after hero commit — moved verbatim
   (`revalidatePath` is legal in route handlers).
6. Reveal URL carries `?renderJobId` — redirect unchanged.
7. Provider via `RITZY_IMAGE_PROVIDER` — untouched.

## Steps (one commit each, roughly)

1. `packages/config`: `renderExecutionMode()` + env plumbing + package test.
2. Extract helpers from `actions.ts` into `apps/web/lib/render-image-helpers.ts` (pure move) +
   re-import. Typecheck-clean checkpoint.
3. `apps/web/lib/render-runner.ts`: `runFinalRender` + moved `generateAndStoreFinalRenderViews`;
   `actions.ts` `after()` body becomes a call into the runner (inline mode); insert flips to
   `status:"queued"`; enqueue branch + fallback.
4. Consumer route + `vercel.json` trigger + `@vercel/queue` dependency.
5. Docs: refresh FABLE_PROGRESS + handover state.

## Verification (green tests are NOT the bar)

- Local (inline mode, real behaviour): full render via the Playwright harness
  (`scripts/dev-harness/render-multiview.mjs`, `RITZY_IMAGE_PROVIDER=evolink`, local stack) —
  proves the extraction didn't change behaviour: hero + 2 views land, `output_asset_ids` = 3,
  presentation reveals.
- Local unit: existing `apps/web/lib/render.test.ts` still green; add a small test for
  `renderExecutionMode` defaults.
- Preview deploy (the durable path only exists there):
  1. Branch-scope `SUPABASE_SERVICE_ROLE_KEY` + `OPENAI_API_KEY` to this branch's preview env
     (values already in the project's Production scope; added via authenticated CLI, never printed).
  2. Confirm the queue trigger registered (build output / deployment summary) and
     `RITZY_RENDER_EXECUTION` resolves to queue.
  3. **Durability proof**: drive the preview URL with the harness (hosted test user), trigger a
     final render, kill the browser ~5s later (the session-3 repro that stranded the job), and
     confirm from `render_jobs` that the job still reaches `succeeded` with hero + views.
  4. **Idempotency proof**: force a redelivery against a terminal job (temporary
     preview-only debug enqueue route on a verification commit, dropped before merge-ready; or
     rerun `runFinalRender` for a succeeded job) and confirm: no second `succeeded` job, no
     duplicate `final_render` hero asset, storage object count unchanged.
  5. Confirm the stale-reclaim retry path still works (synthetic stale job, as in session 3).
  6. **Stale-reclaim vs in-flight attempt race**: reclaim a job while a queue attempt is mid-render
     (or simulate by CAS-failing it during a run) and confirm the in-flight attempt discards its own
     render — no duplicate hero asset, the winner (the user's new job) unaffected.
  7. Confirm the effective function duration cap on the deployed consumer (800 needs Fluid on
     Pro/Enterprise; if the plan caps lower, drop `maxDuration` to the plan's max and re-check the
     worst-case render fits).
- `pnpm check` + `tsc --noEmit` + `eslint .` from `apps/web` green before the PR.

**Merge gate (explicit):** the PR is merge-ready ONLY after the durable path is proven live on a
preview deploy — `send()` accepted, consumer invoked by the queue, teardown survival (step 3) and
idempotency (step 4) both observed. If Queues beta enablement stalls, the PR PARKS (inline fallback
keeps behaviour safe but ships zero durability — do not merge it as if it did), and the named plan B
is a GA `vercel.json` cron reaper that claims `queued`/stale-`running` jobs every minute through the
same `runFinalRender` + claim CAS (identical idempotency machinery, ~60s dispatch latency, no beta
dependency).

## Risks / unknowns

- **Queues beta enablement**: docs flag "Permissions Required: Vercel Queues". If the team lacks
  the beta/permission, `send()` fails ⇒ inline fallback keeps renders working while the PR PARKS
  (see merge gate) — enablement goes on Ayo's consolidated list and plan B is the cron reaper.
- **`vercel.json` functions glob in the monorepo**: the path may need to be relative to the
  project root (`apps/web/...`) — verified on the preview deploy; adjusted if the trigger doesn't
  register.
- **Double-render cost under rare duplicate delivery**: accepted; CAS discards the loser. Cheaper
  than a distributed lock, and bounded by Queues' near-exactly-once behaviour.
- **`revalidatePath` from the consumer** invalidates cache on the consumer's own deployment;
  the presentation additionally self-refreshes every 12s (`RenderRefresh`), so reveal freshness
  never depends on it.
- **Stripe env absent on general Preview**: irrelevant to this path (no Stripe in the render flow).

## Rollback

Set `RITZY_RENDER_EXECUTION=inline` (env-only, no deploy needed beyond redeploy-to-apply) — the
action reverts to the exact pre-PR `after()` behaviour through the shared runner. Full revert =
revert the merge commit; no schema changes anywhere in this PR.

## NOT in this PR

- Concept-render migration (`generateInitialConceptAction` / `reviseConceptAction` `after()`
  blocks) — explicit follow-up PR with the same runner pattern.
- Relaxing/removing `FINAL_RENDER_STALE_MS` or the retry affordance — stays as safety net until
  queue retries are proven in production.
- Dead-letter alerting/telemetry beyond the existing `render_jobs`/`ai_jobs` rows.
- Any schema change (deliberately none; `input_summary` additions are JSON-additive).
