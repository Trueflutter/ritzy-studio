# Catalog Ingestion Agent Comms

## Current PR
None. PR #130 merged Homes r Us dry-run ingestion adapter.

## Current stage
DRY_RUN_RETAILER_ADAPTERS_READY_BLOCKED_FOR_LIVE_INGESTION.

## Blockers
Live ingestion remains blocked. Do not perform live catalog writes, DB/schema changes, generated DB type changes, production flags, deploys, payment/checkout changes, UI changes, Product Matching runtime coupling, Catalog-First runtime coupling, or broad crawler execution without explicit approval.

## Chief architect routing
ARCHITECT_NOTE: Pan Home and Homes r Us now have dry-run-only adapter coverage. Keep both live ingestion paths blocked until a separate explicit approval removes the dry-run-only guards.

Next safe work should be docs/planning/eval-only unless Sam/coordinator explicitly approves another dry-run retailer adapter or an approval package for controlled ingestion. Do not remove `dryRunOnly` from Pan Home or Homes r Us in this mailbox state.

## Last action taken
PR #130 added Homes r Us dry-run ingestion adapter and was merged at `2710e84`.

## Next intended action
Pause retailer ingestion implementation until Chief Architect/Sam assigns the next specific docs-only, dry-run-only, or controlled-ingestion stage.

## Durable next-state handoff after merge
Pan Home and Homes r Us live ingestion remain blocked by adapter `dryRunOnly` plus CLI/runner guards. Keep request volume low for any future dry runs, preserve Homes r Us `Crawl-delay: 10`, and avoid query URLs, `/catalog/` paths, private APIs, auth-only paths, search/filter URLs, and broad crawl behavior.
