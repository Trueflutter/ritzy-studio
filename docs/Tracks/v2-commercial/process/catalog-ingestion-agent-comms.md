# Catalog Ingestion Agent Comms

## Current PR
PR #157: https://github.com/Trueflutter/ritzy-studio/pull/157

Branch: `codex/catalog-ingestion-premium-route-verification`

Touched files:
- `docs/Tracks/v2-commercial/29_Premium_Retailer_Route_Verification.md`
- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`

Runtime impact: none / docs-only

## Current stage
`AWAIT_CHIEF_ARCHITECT_PREMIUM_RETAILER_ROUTING`

## Blockers
Live ingestion remains blocked.

Do not perform live catalog writes, remove `dryRunOnly`, widen request volume, use private APIs, use auth-only paths, use checkout/cart/account/search/filter/query URLs, use Magento `/catalog/...` paths, change DB/schema/generated types, change UI/runtime/app actions, change prompts, change payment/checkout behavior, enable production flags, deploy, couple to Product Matching runtime, or couple to Catalog-First runtime without a separate explicit approval.

Preserve Homes r Us `Crawl-delay: 10`.

## Chief Architect Routing
ARCHITECT_NOTE:
Lane: Catalog Ingestion
Current PR: pending PR completes docs-only premium-retailer route verification for West Elm UAE and Pottery Barn UAE
Current stage: `AWAIT_CHIEF_ARCHITECT_PREMIUM_RETAILER_ROUTING`
What is complete: Pan Home, Homes r Us, IKEA UAE, and Marina Home have dry-run-only adapter coverage. PR #156 records Crate & Barrel UAE as promising but blocked on robots access plus clean category/product fetchability. This route-verification stage records West Elm UAE and Pottery Barn UAE as partner-first/no-adapter candidates because official UAE domains currently serve closure pages.
Decision needed after merge: route the next safe Catalog Ingestion stage, or confirm the lane should stay paused with live ingestion blocked.

Recommended next options:

1. Route a docs-only feasibility stage for another premium retailer, such as The One UAE, if Chief Architect wants another public-route candidate.
2. Route a partner/feed outreach planning doc for West Elm/Pottery Barn/Crate & Barrel if these brands remain commercially important.
3. Route a controlled live-ingestion planning doc for already-covered dry-run adapters without enabling writes.
4. Keep the lane paused at `AWAIT_CHIEF_ARCHITECT_PREMIUM_RETAILER_ROUTING` with live ingestion blocked.

Recommendation: do not proceed to West Elm UAE or Pottery Barn UAE adapter work. Route either another docs-only retailer feasibility target or a partner/feed outreach plan.

Keep live-ingestion blockers: no live catalog writes, no `dryRunOnly` removal, no private APIs, no auth-only paths, no checkout/cart/account/search/filter/query URLs, no Magento/internal paths, no DB/schema/generated type changes, no UI/runtime/app-action changes, no prompts/payment/checkout changes, no production flags/deploys, no Product Matching runtime coupling, and no Catalog-First runtime coupling.

## Last Action Taken
Started the routed docs-only premium-retailer route verification stage from latest `main`.

The route verification note records tiny manually bounded public checks for West Elm UAE and Pottery Barn UAE. Both official UAE domains returned closure pages, including for `robots.txt`, so robots posture is not readable and old category/product index records should be treated as stale route evidence.

## Next Intended Action
Open the docs-only premium-retailer route verification PR, leave an `ARCHITECT_NOTE:` with PR URL, branch, head commit, files touched, verification, and hard-stop confirmation, then wait for Chief Architect review.

Do not start live ingestion, controlled preview, adapter implementation, parser fixtures/scripts, broad discovery, production flag, deploy, runtime coupling, or write path from this approval.

## Heartbeat
Keep the Catalog Ingestion heartbeat active while the lane is routed or awaiting routing. With no open active PR, the heartbeat should monitor:

- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`
- recent PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- the active premium-retailer route verification PR once opened
- follow-up PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`

If the PR is rejected, fix only listed docs blockers. If it is approved and explicitly approved to merge, merge only if runtime impact remains none/docs-only and no hard stop was crossed. After merge, keep the heartbeat active and wait for explicit routing unless the mailbox has been updated with a specific next safe stage.
