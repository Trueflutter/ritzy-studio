# Catalog Ingestion Agent Comms

## Current PR
None. PR #131 merged the post-Homes r Us mailbox update.

## Current stage
DUAL_TRACK:
- `LIVE_INGESTION_BLOCKED_WAITING_FOR_APPROVAL`
- `APPROVED_DOCS_ONLY_COVERAGE_READINESS_MAP`

## Blockers
Live ingestion remains blocked. Do not perform live catalog writes, DB/schema changes, generated DB type changes, production flags, deploys, payment/checkout changes, UI changes, Product Matching runtime coupling, Catalog-First runtime coupling, or broad crawler execution without explicit approval.

## Chief architect routing
ARCHITECT_NOTE: Pan Home and Homes r Us now have dry-run-only adapter coverage. Keep both live ingestion paths blocked until a separate explicit approval removes the dry-run-only guards.

Do not sit idle while live ingestion is blocked. Start one docs-only Catalog Ingestion PR that prepares the coverage/readiness map without running ingestion:

1. Branch from latest `main`; suggested branch `codex/catalog-ingestion-coverage-readiness`.
2. Add or update `docs/Tracks/v2-commercial/24_Catalog_Ingestion_Coverage_Readiness_Map.md`.
3. Summarize current dry-run adapter coverage for Home Centre, Chattels, Danube Home, 2XL, Pan Home, and Homes r Us.
4. List remaining gaps by retailer: source surface, robots/terms constraints, known parser/normalization gaps, dry-run command, and whether live writes remain blocked.
5. Include the next-retailer decision section with Homes r Us completed, Pan Home completed, and the next candidate requiring Chief/Sam routing before implementation.
6. Leave a tracked mailbox update pointing to the readiness-map PR and keeping live ingestion blocked.

Hard stop: this docs-only PR must not execute crawlers, remove `dryRunOnly`, perform live catalog writes, change DB/schema/generated types, alter UI/runtime/app actions/prompts/payment/checkout, change production flags, deploy, widen request volume, use private APIs, couple to Product Matching runtime, or couple to Catalog-First runtime.

## Last action taken
PR #131 updated the mailbox after PR #130 added the Homes r Us dry-run ingestion adapter. The lane is now routed to a docs-only coverage/readiness map while live ingestion remains blocked.

## Next intended action
Implementation agent: open the docs-only coverage/readiness PR described above, then leave an `ARCHITECT_NOTE:` with PR URL, branch, head commit, files touched, and confirmation that no stop rule was crossed.

## Durable next-state handoff after merge
Pan Home and Homes r Us live ingestion remain blocked by adapter `dryRunOnly` plus CLI/runner guards. Keep request volume low for any future dry runs, preserve Homes r Us `Crawl-delay: 10`, and avoid query URLs, `/catalog/` paths, private APIs, auth-only paths, search/filter URLs, and broad crawl behavior.

After any PR merges, the agent must not delete its last monitor and go idle unless this mailbox already points to the next safe action or explicitly records that no docs/domain/dry-run work is approved. If there is no next action, leave an `ARCHITECT_NOTE:` in the mailbox or PR requesting Chief Architect routing.
