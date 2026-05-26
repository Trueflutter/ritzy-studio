# Catalog Ingestion Agent Comms

## Current PR
PR #164: https://github.com/Trueflutter/ritzy-studio/pull/164

Branch: `codex/catalog-ingestion-the-one-normalization-gap`

Current stage: `APPROVED_DRY_RUN_ONLY_THE_ONE_CATEGORY_NORMALIZATION_GAP_REVIEW`

Touched files:
- `packages/ingestion/src/adapters/theone.ts`
- `packages/ingestion/src/adapters/theone.test.ts`
- `docs/Tracks/v2-commercial/33_The_One_UAE_Category_Normalization_Gap_Review.md`
- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`

Runtime impact: none / dry-run-only adapter seed normalization

## Current stage
`APPROVED_DRY_RUN_ONLY_THE_ONE_CATEGORY_NORMALIZATION_GAP_REVIEW`

## Blockers
Live ingestion remains blocked.

Do not perform live catalog writes, remove `dryRunOnly`, widen request volume, use private APIs, use auth-only paths, use checkout/cart/account/search/filter/query URLs, use Magento `/catalog/...` paths, change DB/schema/generated types, change UI/runtime/app actions, change prompts, change payment/checkout behavior, enable production flags, deploy, couple to Product Matching runtime, or couple to Catalog-First runtime without a separate explicit approval.

Preserve Homes r Us `Crawl-delay: 10`.

## Chief Architect Routing
ARCHITECT_NOTE:
Lane: Catalog Ingestion
Current PR: PR #164 completes The One UAE category-normalization gap review
Current stage: `THE_ONE_CATEGORY_NORMALIZATION_GAP_REVIEW_COMPLETE_WAITING_FOR_CHIEF_SAM_ROUTING`
Routing evidence: Chief Architect explicitly routed this exact next stage after PR #162 merged: dry-run-only category-normalization gap review for The One UAE using only the four existing manual seeds and saved evidence from PR #162; docs plus, if needed, parser/normalizer tests or dry-run-only adapter normalization logic only; no live ingestion, seed expansion, broad crawling, controlled preview, Product Matching runtime coupling, or Catalog-First runtime coupling.
What is complete: PR #159 completed docs-only route feasibility for The One UAE. PR #161 completed the tiny dry-run-only fixture/parser spike and kept The One dry-run-only/manual-seed-only. PR #162 completed the dry-run-only The One UAE multi-category sample QA report and surfaced category-normalization gaps for the dining-table and bedside-table seeds. PR #164 completes the routed category-normalization gap review using only the four existing manual seeds and saved PR #162 evidence. The One remains dry-run-only/manual-seed-only. Live ingestion remains blocked.
Decision needed after merge: Chief Architect/Sam routing for whether to pause, add more saved fixtures, pursue partner/feed approval, define another narrow dry-run-only QA step, or keep The One parked.

Do not start more fixture work, partner/feed work, controlled preview, live ingestion, Product Matching work, Catalog-First work, or any new PR unless that exact next stage is separately approved.

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
Started the routed The One UAE category-normalization gap review from latest `main` after PR #162 merged.

Verification run locally:

- `pnpm --filter @ritzy-studio/ingestion test`
- `pnpm --filter @ritzy-studio/ingestion typecheck`
- `pnpm --filter @ritzy-studio/ingestion exec tsx src/cli.ts theone --dry-run --limit=4`

## Next Intended Action
If PR #164 is rejected, fix only listed dry-run-only/docs blockers. If PR #164 is approved and explicitly approved to merge, merge only if runtime impact remains none/dry-run-only and no hard stop was crossed. After merge, keep the lane at `THE_ONE_CATEGORY_NORMALIZATION_GAP_REVIEW_COMPLETE_WAITING_FOR_CHIEF_SAM_ROUTING` unless Chief Architect/Sam explicitly routes a specific safe next stage.

Do not start live ingestion, controlled preview, broad discovery, production flag, deploy, runtime coupling, or write path from this approval.

## Heartbeat
Keep the Catalog Ingestion heartbeat active while the lane is routed or awaiting routing. With no open active PR, the heartbeat should monitor:

- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`
- recent PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- PR #164
- follow-up PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`

If PR #164 is rejected, fix only listed blockers. If it is approved and explicitly approved to merge, merge only if runtime impact remains none/dry-run-only and no hard stop was crossed. After merge, do not start a new PR unless Chief Architect/Sam explicitly routes a specific safe next stage. Keep the Catalog Ingestion heartbeat active.
