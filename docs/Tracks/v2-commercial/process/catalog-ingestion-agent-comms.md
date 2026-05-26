# Catalog Ingestion Agent Comms

## Current PR
PR #161: https://github.com/Trueflutter/ritzy-studio/pull/161 merged.

Active local branch for routed sample QA: `codex/catalog-ingestion-the-one-sample-qa`

Current stage: `APPROVED_DRY_RUN_ONLY_THE_ONE_MULTI_CATEGORY_SAMPLE_QA`

Touched files:
- `docs/Tracks/v2-commercial/32_The_One_UAE_Multi_Category_Sample_QA.md`
- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`

Runtime impact: none / docs-only dry-run QA report

## Current stage
`APPROVED_DRY_RUN_ONLY_THE_ONE_MULTI_CATEGORY_SAMPLE_QA`

## Blockers
Live ingestion remains blocked.

Do not perform live catalog writes, remove `dryRunOnly`, widen request volume, use private APIs, use auth-only paths, use checkout/cart/account/search/filter/query URLs, use Magento `/catalog/...` paths, change DB/schema/generated types, change UI/runtime/app actions, change prompts, change payment/checkout behavior, enable production flags, deploy, couple to Product Matching runtime, or couple to Catalog-First runtime without a separate explicit approval.

Preserve Homes r Us `Crawl-delay: 10`.

## Chief Architect Routing
ARCHITECT_NOTE:
Lane: Catalog Ingestion
Current PR: pending PR for The One UAE multi-category sample QA
Current stage: `APPROVED_DRY_RUN_ONLY_THE_ONE_MULTI_CATEGORY_SAMPLE_QA`
What is complete: PR #159 completed docs-only route feasibility for The One UAE. PR #161 completed the tiny dry-run-only fixture/parser spike and kept The One dry-run-only/manual-seed-only. This sample QA stage ran the existing adapter with the existing tiny manual seed set only, `--dry-run --limit=4`, and captured normalized sample output, category coverage, parser gaps, and stop-rule observations. Live ingestion remains blocked.
Decision needed after this PR: Chief Architect/Sam routing for whether to pause, address category normalization gaps, add more saved fixtures, pursue partner/feed approval, or define another narrow dry-run-only QA step.

Completed scope:

1. Branched from latest `main` after PR #159 merged.
2. Added a tiny dry-run-only The One UAE fixture/parser spike.
3. Added strict URL validators for `https://www.theone.com/robots.txt`, `https://www.theone.com/sitemap.xml`, clean `/category/...` URLs, and clean `/product/...-<numeric-sku>` URLs.
4. Used a tiny hand-curated allowlist and saved fixtures only for approved sample page shapes.
5. Added static parser tests for Product JSON-LD, SKU, AED price, availability, image, canonical URL, and breadcrumb categories where present.
6. Kept explicit low request limits, at least 1 second pacing, cached responses within the run, and `dryRunOnly` guards.
7. Preserved hard blockers: no live catalog writes, no `dryRunOnly` removal, no crawler-scale discovery, no broad sitemap/category/product traversal, no private APIs, no auth-only paths, no search/filter/query/cart/checkout/account/order/payment/wishlist/producttag URLs, no headless browser execution at ingestion scale, no DB/schema/generated type changes, no UI/runtime/app-action changes, no prompts/payment/checkout changes, no production flags/deploys, no Product Matching runtime coupling, and no Catalog-First runtime coupling.

Keep live-ingestion blockers: no live catalog writes, no `dryRunOnly` removal, no private APIs, no auth-only paths, no checkout/cart/account/search/filter/query URLs, no Magento/internal paths, no DB/schema/generated type changes, no UI/runtime/app-action changes, no prompts/payment/checkout changes, no production flags/deploys, no Product Matching runtime coupling, and no Catalog-First runtime coupling.

## Last Action Taken
Started the routed The One UAE multi-category sample QA stage from latest `main` after PR #161 merged.

Verification run locally:

- `pnpm --filter @ritzy-studio/ingestion exec tsx src/cli.ts theone --dry-run --limit=4`

## Next Intended Action
Open the sample QA report PR and request Chief Architect review/routing. If approved and explicitly approved to merge, merge only if runtime impact remains none/docs-only dry-run QA report and no hard stop was crossed.

Do not start live ingestion, controlled preview, broad discovery, production flag, deploy, runtime coupling, or write path from this approval.

## Heartbeat
Keep the Catalog Ingestion heartbeat active while the lane is routed or awaiting routing. With no open active PR, the heartbeat should monitor:

- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`
- recent PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- the The One UAE multi-category sample QA PR once opened
- follow-up PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`

If the sample QA PR is rejected, fix only listed blockers. If it is approved and explicitly approved to merge, merge only if runtime impact remains none/docs-only dry-run QA report and no hard stop was crossed. After merge, proceed only if Chief Architect/Sam explicitly routes a specific safe next stage; otherwise leave an `ARCHITECT_NOTE:` requesting routing and keep the Catalog Ingestion heartbeat active.
