# Catalog Ingestion Agent Comms

## Current PR
PR #154 merged: https://github.com/Trueflutter/ritzy-studio/pull/154

Merge commit: `2c8f76e517a585fd616de53fb91497b3b7daa6ad`

Runtime impact: none / dry-run-only

## Current stage
`AWAIT_CHIEF_ARCHITECT_RETAILER_ROUTING`

## Blockers
Live ingestion remains blocked.

Do not perform live catalog writes, remove `dryRunOnly`, widen request volume, use private APIs, use auth-only paths, use checkout/cart/account/search/filter/query URLs, use Magento `/catalog/...` paths, change DB/schema/generated types, change UI/runtime/app actions, change prompts, change payment/checkout behavior, enable production flags, deploy, couple to Product Matching runtime, or couple to Catalog-First runtime without a separate explicit approval.

Preserve Homes r Us `Crawl-delay: 10`.

## Chief Architect Question
ARCHITECT_NOTE:
Lane: Catalog Ingestion
Current PR: none open after PR #154 merge
Current stage: `AWAIT_CHIEF_ARCHITECT_RETAILER_ROUTING`
What is complete: Pan Home, Homes r Us, IKEA UAE, and Marina Home now have dry-run-only adapter coverage. Live ingestion remains blocked by `dryRunOnly` plus CLI/runner guards.
Decision needed: Assign the next safe Catalog Ingestion stage, or confirm the lane should remain paused with live ingestion blocked.
Options:
1. Route another narrowly scoped docs-only feasibility PR.
2. Route another dry-run-only adapter/parser spike with explicit retailer and request limits.
3. Route controlled preview/live-ingestion planning without enabling writes.
4. Keep the lane paused at `AWAIT_CHIEF_ARCHITECT_RETAILER_ROUTING`.
Recommendation: Keep live ingestion blocked and route only the next docs-only or dry-run-only retailer stage when the target retailer and request limits are explicit.

## Last Action Taken
Merged PR #154 after explicit approval to merge. The Marina Home adapter remains dry-run-only, sitemap-first, metadata-first, tiny-allowlist-bound, and guarded against live writes.

## Next Intended Action
Monitor this mailbox and recent PR comments for a `CHIEF_ARCHITECT_REPLY:` that explicitly assigns the next safe docs-only, dry-run-only, or controlled-planning stage.

Do not start a new retailer, live ingestion, controlled preview, broad discovery, production flag, deploy, runtime coupling, or write path until the next stage is explicitly routed.

## Heartbeat
Keep the Catalog Ingestion heartbeat active while the lane is routed or awaiting routing. With no open active PR, the heartbeat should monitor:

- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`
- recent PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- explicit Chief Architect/Sam routing

If a specific safe next stage is assigned, open the next small PR from latest `main`. If no routing appears, stay paused with live ingestion blocked.
