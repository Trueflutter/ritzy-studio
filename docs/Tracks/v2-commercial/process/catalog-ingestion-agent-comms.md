# Catalog Ingestion Agent Comms

## Current PR
PR #159: https://github.com/Trueflutter/ritzy-studio/pull/159

Branch: `codex/catalog-ingestion-the-one-route-feasibility`

Touched files:
- `docs/Tracks/v2-commercial/30_The_One_UAE_Route_Feasibility.md`
- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`

Runtime impact: none / docs-only

## Current stage
`AWAIT_CHIEF_ARCHITECT_THE_ONE_ROUTING`

## Blockers
Live ingestion remains blocked.

Do not perform live catalog writes, remove `dryRunOnly`, widen request volume, use private APIs, use auth-only paths, use checkout/cart/account/search/filter/query URLs, use Magento `/catalog/...` paths, change DB/schema/generated types, change UI/runtime/app actions, change prompts, change payment/checkout behavior, enable production flags, deploy, couple to Product Matching runtime, or couple to Catalog-First runtime without a separate explicit approval.

Preserve Homes r Us `Crawl-delay: 10`.

## Chief Architect Routing
ARCHITECT_NOTE:
Lane: Catalog Ingestion
Current PR: pending PR completes docs-only route feasibility for The One UAE
Current stage: `AWAIT_CHIEF_ARCHITECT_THE_ONE_ROUTING`
What is complete: Pan Home, Homes r Us, IKEA UAE, and Marina Home have dry-run-only adapter coverage. PR #156 records Crate & Barrel UAE as promising but blocked on robots access plus clean category/product fetchability. PR #157 records West Elm UAE and Pottery Barn UAE as partner-first/no-adapter because official UAE domains serve closure pages. This route-feasibility stage records The One UAE as route-feasible for a later dry-run-only technical feasibility, but no adapter work is approved in this PR.
Decision needed after merge: route the next safe Catalog Ingestion stage, or confirm the lane should pause with live ingestion blocked.

Recommended next options:

1. Route a tiny dry-run-only The One UAE fixture/parser spike with strict URL validators, saved fixtures, low request limits, and `dryRunOnly` guards.
2. Route a docs-only partner/feed outreach planning doc for The One UAE, Crate & Barrel UAE, West Elm UAE, and Pottery Barn UAE.
3. Route a controlled live-ingestion planning doc for already-covered dry-run adapters without enabling writes.
4. Keep the lane paused at `AWAIT_CHIEF_ARCHITECT_THE_ONE_ROUTING` with live ingestion blocked.

Recommendation: if Chief Architect wants another technical step, route only a tiny dry-run-only The One fixture/parser spike. Otherwise route partner/feed planning or pause the lane. Do not start adapter implementation or live ingestion from this docs-only approval.

Keep live-ingestion blockers: no live catalog writes, no `dryRunOnly` removal, no private APIs, no auth-only paths, no checkout/cart/account/search/filter/query URLs, no Magento/internal paths, no DB/schema/generated type changes, no UI/runtime/app-action changes, no prompts/payment/checkout changes, no production flags/deploys, no Product Matching runtime coupling, and no Catalog-First runtime coupling.

## Last Action Taken
Started the routed docs-only The One UAE route feasibility stage from latest `main`.

The route feasibility note records tiny manually bounded public checks for The One UAE. It found readable robots, public sitemap, clean category/product URL shapes, UAE/AED cookie defaults, and one public product page with Product JSON-LD.

## Next Intended Action
Open the docs-only The One UAE route feasibility PR, leave an `ARCHITECT_NOTE:` with PR URL, branch, head commit, files touched, verification, and hard-stop confirmation, then wait for Chief Architect review.

Do not start live ingestion, controlled preview, adapter implementation, parser fixtures/scripts, broad discovery, production flag, deploy, runtime coupling, or write path from this approval.

## Heartbeat
Keep the Catalog Ingestion heartbeat active while the lane is routed or awaiting routing. With no open active PR, the heartbeat should monitor:

- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`
- recent PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- the active The One UAE route feasibility PR once opened
- follow-up PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`

If the PR is rejected, fix only listed docs blockers. If it is approved and explicitly approved to merge, merge only if runtime impact remains none/docs-only and no hard stop was crossed. After merge, keep the heartbeat active and wait for explicit routing unless the mailbox has been updated with a specific next safe stage.
