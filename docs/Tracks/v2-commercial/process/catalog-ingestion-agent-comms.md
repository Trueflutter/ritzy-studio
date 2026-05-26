# Catalog Ingestion Agent Comms

## Current PR
PR #157: https://github.com/Trueflutter/ritzy-studio/pull/157

Branch: `codex/catalog-ingestion-premium-route-verification`

Touched files:
- `docs/Tracks/v2-commercial/29_Premium_Retailer_Route_Verification.md`
- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`

Runtime impact: none / docs-only

## Current stage
`APPROVED_DOCS_ONLY_THE_ONE_UAE_ROUTE_FEASIBILITY`

## Blockers
Live ingestion remains blocked.

Do not perform live catalog writes, remove `dryRunOnly`, widen request volume, use private APIs, use auth-only paths, use checkout/cart/account/search/filter/query URLs, use Magento `/catalog/...` paths, change DB/schema/generated types, change UI/runtime/app actions, change prompts, change payment/checkout behavior, enable production flags, deploy, couple to Product Matching runtime, or couple to Catalog-First runtime without a separate explicit approval.

Preserve Homes r Us `Crawl-delay: 10`.

## Chief Architect Routing
ARCHITECT_NOTE:
Lane: Catalog Ingestion
Current PR: PR #157 completes docs-only premium-retailer route verification for West Elm UAE and Pottery Barn UAE
Current stage: `APPROVED_DOCS_ONLY_THE_ONE_UAE_ROUTE_FEASIBILITY`
What is complete: Pan Home, Homes r Us, IKEA UAE, and Marina Home have dry-run-only adapter coverage. PR #156 records Crate & Barrel UAE as promising but blocked on robots access plus clean category/product fetchability. This route-verification stage records West Elm UAE and Pottery Barn UAE as partner-first/no-adapter candidates because official UAE domains currently serve closure pages.
Decision: After PR #157 merges, start the next small safe stage: docs-only route feasibility for The One UAE from latest `main`.

Approved next stage:
`APPROVED_DOCS_ONLY_THE_ONE_UAE_ROUTE_FEASIBILITY`

Scope for the next stage:

1. Branch from latest `main`; suggested branch `codex/catalog-ingestion-the-one-route-feasibility`.
2. Create or update a docs-only route feasibility note for The One UAE.
3. Verify official UAE URL(s), robots/terms posture if safely readable, public category/product URL shapes from official public pages or tiny manual checks only, partner/feed evidence, and whether a later dry-run-only technical feasibility is warranted or whether The One should stay partner-first.
4. Use only read-only public research and tiny manually bounded checks. Do not run crawler-scale discovery, do not implement an adapter, do not add parser fixtures/scripts, do not run dry-run ingestion commands, and do not fetch broad category/product sets.
5. Preserve live-ingestion blockers: no live catalog writes, no `dryRunOnly` removal, no private APIs, no auth-only paths, no checkout/cart/account/search/filter/query URLs, no Magento/internal paths, no DB/schema/generated type changes, no UI/runtime/app-action changes, no prompts/payment/checkout changes, no production flags/deploys, no Product Matching runtime coupling, and no Catalog-First runtime coupling.
6. Keep the Catalog Ingestion heartbeat active after merge and monitor this mailbox plus PR comments; do not delete the lane monitor just because PR-specific work closes.

Recommendation: do not proceed to West Elm UAE or Pottery Barn UAE adapter work. Route only the docs-only The One UAE route feasibility stage next.

Keep live-ingestion blockers: no live catalog writes, no `dryRunOnly` removal, no private APIs, no auth-only paths, no checkout/cart/account/search/filter/query URLs, no Magento/internal paths, no DB/schema/generated type changes, no UI/runtime/app-action changes, no prompts/payment/checkout changes, no production flags/deploys, no Product Matching runtime coupling, and no Catalog-First runtime coupling.

## Last Action Taken
Opened PR #157 for the routed docs-only premium-retailer route verification stage from latest `main`.

The route verification note records tiny manually bounded public checks for West Elm UAE and Pottery Barn UAE. Both official UAE domains returned closure pages, including for `robots.txt`, so robots posture is not readable and old category/product index records should be treated as stale route evidence.

## Next Intended Action
After PR #157 is approved and merged, sync latest `main` and start the docs-only The One UAE route feasibility PR from latest `main`.

Do not start live ingestion, controlled preview, adapter implementation, parser fixtures/scripts, broad discovery, production flag, deploy, runtime coupling, or write path from this approval.

## Heartbeat
Keep the Catalog Ingestion heartbeat active while the lane is routed or awaiting routing. With no open active PR, the heartbeat should monitor:

- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`
- recent PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- PR #157 and the next The One UAE route feasibility PR once opened
- follow-up PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`

If PR #157 is rejected, fix only listed docs blockers. If it is approved and explicitly approved to merge, merge only if runtime impact remains none/docs-only and no hard stop was crossed, then proceed only to the docs-only The One UAE route feasibility stage described above.
