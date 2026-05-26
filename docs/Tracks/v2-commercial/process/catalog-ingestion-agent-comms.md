# Catalog Ingestion Agent Comms

## Current PR
PR #156: https://github.com/Trueflutter/ritzy-studio/pull/156

Branch: `codex/catalog-ingestion-crate-barrel-feasibility`

Touched files:
- `docs/Tracks/v2-commercial/28_Crate_And_Barrel_UAE_Category_Discovery_Feasibility.md`
- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`

Runtime impact: none / docs-only

## Current stage
`APPROVED_DOCS_ONLY_PREMIUM_RETAILER_ROUTE_VERIFICATION`

## Blockers
Live ingestion remains blocked.

Do not perform live catalog writes, remove `dryRunOnly`, widen request volume, use private APIs, use auth-only paths, use checkout/cart/account/search/filter/query URLs, use Magento `/catalog/...` paths, change DB/schema/generated types, change UI/runtime/app actions, change prompts, change payment/checkout behavior, enable production flags, deploy, couple to Product Matching runtime, or couple to Catalog-First runtime without a separate explicit approval.

Preserve Homes r Us `Crawl-delay: 10`.

## Chief Architect Routing
ARCHITECT_NOTE:
Lane: Catalog Ingestion
Current PR: PR #156 completes the Crate & Barrel UAE docs-only category-discovery feasibility stage
Current stage: `APPROVED_DOCS_ONLY_PREMIUM_RETAILER_ROUTE_VERIFICATION`
What is complete: Pan Home, Homes r Us, IKEA UAE, and Marina Home have dry-run-only adapter coverage. PR #156 records Crate & Barrel UAE as a promising premium candidate, but adapter work is blocked until robots access and clean category/product fetchability are proved. Live ingestion remains blocked by `dryRunOnly` plus CLI/runner guards.
Decision: After PR #156 merges, start the next small safe stage: docs-only premium-retailer route verification for West Elm UAE and Pottery Barn UAE.

Approved next stage:
`APPROVED_DOCS_ONLY_PREMIUM_RETAILER_ROUTE_VERIFICATION`

Scope for the next stage:

1. Branch from latest `main`; suggested branch `codex/catalog-ingestion-premium-route-verification`.
2. Create or update a docs-only route verification note for West Elm UAE and Pottery Barn UAE.
3. Verify official UAE URLs, robots/terms posture if safely readable, public category/product URL shapes if visible from public index or tiny manual checks, partner/affiliate route evidence, and whether either retailer is a candidate for a later technical feasibility stage or should stay partner-first.
4. Use only read-only public research and existing partner-network evidence. Do not run crawler-scale discovery, do not implement an adapter, do not add parser fixtures/scripts, and do not fetch broad category/product sets.
5. Preserve live-ingestion blockers: no live catalog writes, no `dryRunOnly` removal, no private APIs, no auth-only paths, no checkout/cart/account/search/filter/query URLs, no Magento/internal paths, no DB/schema/generated type changes, no UI/runtime/app-action changes, no prompts/payment/checkout changes, no production flags/deploys, no Product Matching runtime coupling, and no Catalog-First runtime coupling.
6. Keep the Catalog Ingestion heartbeat active after merge and monitor this mailbox plus PR comments; do not delete the lane monitor just because PR-specific work closes.

Why this stage: Crate & Barrel is promising, but PR #156 correctly finds that robots/fetchability are unresolved gates. The next safe work is not a parser. It is docs-only route verification for the next premium candidates called out in existing research before choosing another adapter target.

## Last Action Taken
Opened PR #156 for the routed Crate & Barrel UAE docs-only category discovery feasibility stage from latest `main`.

The feasibility note records a tiny manually bounded public check. It found promising clean category and product URL shapes through public index evidence, but direct `robots.txt` and storefront fetches timed out from this environment, so robots posture and clean category fetchability remain unresolved gates before any adapter work.

## Next Intended Action
After PR #156 is approved and merged, sync latest `main` and start the docs-only premium-retailer route verification PR for West Elm UAE and Pottery Barn UAE from latest `main`.

Do not start live ingestion, controlled preview, adapter implementation, parser fixtures/scripts, broad discovery, production flag, deploy, runtime coupling, or write path from this approval.

## Heartbeat
Keep the Catalog Ingestion heartbeat active while the lane is routed or awaiting routing. With no open active PR, the heartbeat should monitor:

- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`
- recent PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- PR #156 and the next premium-retailer route verification PR once opened
- follow-up PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`

If PR #156 is rejected, fix only listed docs blockers. If it is approved and explicitly approved to merge, merge only if runtime impact remains none/docs-only and no hard stop was crossed, then proceed only to the docs-only premium-retailer route verification stage described above.
