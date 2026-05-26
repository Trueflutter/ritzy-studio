# Catalog Ingestion Agent Comms

## Current PR
PR #159: https://github.com/Trueflutter/ritzy-studio/pull/159

Branch: `codex/catalog-ingestion-the-one-route-feasibility`

Touched files:
- `docs/Tracks/v2-commercial/30_The_One_UAE_Route_Feasibility.md`
- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`

Runtime impact: none / docs-only

## Current stage
`APPROVED_DRY_RUN_ONLY_THE_ONE_FIXTURE_PARSER_SPIKE`

## Blockers
Live ingestion remains blocked.

Do not perform live catalog writes, remove `dryRunOnly`, widen request volume, use private APIs, use auth-only paths, use checkout/cart/account/search/filter/query URLs, use Magento `/catalog/...` paths, change DB/schema/generated types, change UI/runtime/app actions, change prompts, change payment/checkout behavior, enable production flags, deploy, couple to Product Matching runtime, or couple to Catalog-First runtime without a separate explicit approval.

Preserve Homes r Us `Crawl-delay: 10`.

## Chief Architect Routing
ARCHITECT_NOTE:
Lane: Catalog Ingestion
Current PR: PR #159 completes docs-only route feasibility for The One UAE
Current stage: `APPROVED_DRY_RUN_ONLY_THE_ONE_FIXTURE_PARSER_SPIKE`
What is complete: Pan Home, Homes r Us, IKEA UAE, and Marina Home have dry-run-only adapter coverage. PR #156 records Crate & Barrel UAE as promising but blocked on robots access plus clean category/product fetchability. PR #157 records West Elm UAE and Pottery Barn UAE as partner-first/no-adapter because official UAE domains serve closure pages. PR #159 records The One UAE as route-feasible for a later dry-run-only fixture/parser spike. Live ingestion remains blocked.
Decision: After PR #159 merges, start the next small safe stage: a tiny dry-run-only The One UAE fixture/parser spike from latest `main`.

Approved next stage:
`APPROVED_DRY_RUN_ONLY_THE_ONE_FIXTURE_PARSER_SPIKE`

Scope for the next stage:

1. Branch from latest `main`; suggested branch `codex/catalog-ingestion-the-one-fixture-parser`.
2. Add a tiny dry-run-only The One UAE fixture/parser spike.
3. Add strict URL validators for `https://www.theone.com/robots.txt`, `https://www.theone.com/sitemap.xml`, clean `/category/...` URLs, and clean `/product/...-<numeric-sku>` URLs.
4. Use a tiny hand-curated allowlist and saved fixtures only for approved sample pages.
5. Add static parser tests for Product JSON-LD, SKU, AED price, availability, image, canonical URL, and breadcrumb categories where present.
6. Keep explicit low request limits, at least 1 second pacing, cached responses within the run, and `dryRunOnly` guards.
7. Preserve hard blockers: no live catalog writes, no `dryRunOnly` removal, no crawler-scale discovery, no broad sitemap/category/product traversal, no private APIs, no auth-only paths, no search/filter/query/cart/checkout/account/order/payment/wishlist/producttag URLs, no headless browser execution at ingestion scale, no DB/schema/generated type changes, no UI/runtime/app-action changes, no prompts/payment/checkout changes, no production flags/deploys, no Product Matching runtime coupling, and no Catalog-First runtime coupling.

Keep live-ingestion blockers: no live catalog writes, no `dryRunOnly` removal, no private APIs, no auth-only paths, no checkout/cart/account/search/filter/query URLs, no Magento/internal paths, no DB/schema/generated type changes, no UI/runtime/app-action changes, no prompts/payment/checkout changes, no production flags/deploys, no Product Matching runtime coupling, and no Catalog-First runtime coupling.

## Last Action Taken
Opened PR #159 for the routed docs-only The One UAE route feasibility stage from latest `main`.

The route feasibility note records tiny manually bounded public checks for The One UAE. It found readable robots, public sitemap, clean category/product URL shapes, UAE/AED cookie defaults, and one public product page with Product JSON-LD.

## Next Intended Action
If PR #159 is approved and explicitly approved to merge, merge only if runtime impact remains none/docs-only and no hard stop was crossed. After merge, sync latest `main` and proceed only to the routed tiny dry-run-only The One UAE fixture/parser spike from latest `main`.

Do not start live ingestion, controlled preview, broad discovery, production flag, deploy, runtime coupling, or write path from this approval.

## Heartbeat
Keep the Catalog Ingestion heartbeat active while the lane is routed or awaiting routing. With no open active PR, the heartbeat should monitor:

- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`
- recent PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- PR #159 and the next The One UAE fixture/parser spike PR once opened
- follow-up PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`

If PR #159 is rejected, fix only listed docs blockers. If it is approved and explicitly approved to merge, merge only if runtime impact remains none/docs-only and no hard stop was crossed, then proceed only to the routed tiny dry-run-only The One UAE fixture/parser spike from latest `main`. Keep the Catalog Ingestion heartbeat active after merge.
