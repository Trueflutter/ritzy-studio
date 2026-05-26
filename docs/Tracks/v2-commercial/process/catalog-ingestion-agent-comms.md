# Catalog Ingestion Agent Comms

## Current PR
PR #159: https://github.com/Trueflutter/ritzy-studio/pull/159 merged.

Active local branch for the routed next stage: `codex/catalog-ingestion-the-one-fixture-parser`

Current stage: `APPROVED_DRY_RUN_ONLY_THE_ONE_FIXTURE_PARSER_SPIKE`

Touched files:
- `packages/ingestion/src/adapters/theone.ts`
- `packages/ingestion/src/adapters/theone.test.ts`
- `packages/ingestion/src/adapters/__fixtures__/theone-category.html`
- `packages/ingestion/src/adapters/__fixtures__/theone-product.html`
- `packages/ingestion/src/adapters/__fixtures__/theone-product-missing-fields.html`
- `packages/ingestion/src/cli.ts`
- `packages/ingestion/src/cli.test.ts`
- `packages/ingestion/src/index.ts`
- `packages/ingestion/package.json`
- `docs/Tracks/v2-commercial/31_The_One_UAE_Fixture_Parser_Spike.md`
- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`

Runtime impact: none / dry-run-only

## Current stage
`APPROVED_DRY_RUN_ONLY_THE_ONE_FIXTURE_PARSER_SPIKE`

## Blockers
Live ingestion remains blocked.

Do not perform live catalog writes, remove `dryRunOnly`, widen request volume, use private APIs, use auth-only paths, use checkout/cart/account/search/filter/query URLs, use Magento `/catalog/...` paths, change DB/schema/generated types, change UI/runtime/app actions, change prompts, change payment/checkout behavior, enable production flags, deploy, couple to Product Matching runtime, or couple to Catalog-First runtime without a separate explicit approval.

Preserve Homes r Us `Crawl-delay: 10`.

## Chief Architect Routing
ARCHITECT_NOTE:
Lane: Catalog Ingestion
Current PR: pending PR for the tiny dry-run-only The One UAE fixture/parser spike
Current stage: `APPROVED_DRY_RUN_ONLY_THE_ONE_FIXTURE_PARSER_SPIKE`
What is complete: PR #159 completed docs-only route feasibility for The One UAE and routed this next tiny dry-run-only fixture/parser spike. This stage adds strict URL validators, saved fixtures, parser tests, CLI aliases, and one low-limit dry-run verification path. Live ingestion remains blocked.
Decision: Wait for Chief Architect review on the fixture/parser PR after it is opened.

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
Started the routed The One UAE fixture/parser spike from latest `main` after PR #159 merged.

Verification run locally:

- `pnpm --filter @ritzy-studio/ingestion test`
- `pnpm --filter @ritzy-studio/ingestion typecheck`
- `pnpm --filter @ritzy-studio/ingestion exec tsx src/cli.ts theone --dry-run --limit=1`

## Next Intended Action
Open the fixture/parser spike PR, leave an `ARCHITECT_NOTE:`, then monitor review/checks.

Do not start live ingestion, controlled preview, broad discovery, production flag, deploy, runtime coupling, or write path from this approval.

## Heartbeat
Keep the Catalog Ingestion heartbeat active while the lane is routed or awaiting routing. With no open active PR, the heartbeat should monitor:

- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`
- recent PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- the next The One UAE fixture/parser spike PR once opened
- follow-up PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`

If the fixture/parser PR is rejected, fix only listed blockers. If it is approved and explicitly approved to merge, merge only if runtime impact remains none/dry-run-only and no hard stop was crossed. Keep the Catalog Ingestion heartbeat active after merge unless the mailbox records a complete next safe action.
