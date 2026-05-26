# Catalog Ingestion Agent Comms

## Current PR
None. PR #164 is merged: https://github.com/Trueflutter/ritzy-studio/pull/164

Branch: none active.

Current stage: `THE_ONE_CATEGORY_NORMALIZATION_GAP_REVIEW_COMPLETE_WAITING_FOR_CHIEF_SAM_ROUTING`

Runtime impact: none / docs-only mailbox hygiene. The One remains dry-run-only and manual-seed-only.

## Current stage
`THE_ONE_CATEGORY_NORMALIZATION_GAP_REVIEW_COMPLETE_WAITING_FOR_CHIEF_SAM_ROUTING`

## Blockers
Live ingestion remains blocked.

Do not perform live catalog writes, remove `dryRunOnly`, expand The One seeds beyond explicitly approved manual seeds, widen request volume, run broad sitemap/category/product traversal, use private APIs, use auth-only paths, use search/filter/query/cart/checkout/account/payment URLs, use Magento/internal `/catalog` paths, change DB/schema/generated types, change UI/runtime/app actions, change prompts, change payment/checkout behavior, enable production flags, deploy, couple to Product Matching runtime, or couple to Catalog-First runtime without a separate explicit approval.

Preserve Homes r Us `Crawl-delay: 10`.

## Chief Architect Routing
ARCHITECT_NOTE:
Lane: Catalog Ingestion
Current PR: none. PR #164 merged.
Current stage: `THE_ONE_CATEGORY_NORMALIZATION_GAP_REVIEW_COMPLETE_WAITING_FOR_CHIEF_SAM_ROUTING`
Routing evidence: Chief Architect explicitly routed PR #164 as the exact dry-run-only The One UAE category-normalization gap review after PR #162 merged, limited to the four existing manual seeds and saved PR #162 evidence.
What is complete: PR #164 completed the routed The One UAE category-normalization gap review using only the existing manual seeds and saved evidence. The One remains dry-run-only/manual-seed-only. Live ingestion remains blocked.
Decision needed: Chief Architect/Sam routing for the next exact safe stage, if any.

Do not start more fixture work, partner/feed work, controlled preview, live ingestion, Product Matching work, Catalog-First work, or any new PR unless that exact next stage is approved.

## Last Action Taken
PR #164 completed the routed The One UAE category-normalization gap review using only the existing manual seeds and saved evidence from PR #162.

## Next Intended Action
Wait for explicit Chief Architect/Sam routing.

Do not start more fixture work, partner/feed work, controlled preview, live ingestion, Product Matching work, Catalog-First work, or any new PR unless that exact next stage is approved.

## Heartbeat
Keep the Catalog Ingestion lane heartbeat active while this lane is awaiting routing. With no open active Catalog Ingestion PR, the heartbeat should monitor:

- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`
- open Catalog Ingestion PRs
- recent PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`

If a specific docs-only or dry-run-only next stage is assigned, adopt it from latest `main` and open the next small PR. If no routing appears, keep the lane parked; live ingestion remains blocked.
