# Catalog Ingestion Agent Comms

## Current PR
PR #154: https://github.com/Trueflutter/ritzy-studio/pull/154

Branch: `codex/catalog-ingestion-marina-home-dry-run-adapter`

Touched files:
- `packages/ingestion/src/adapters/marinahome.ts`
- `packages/ingestion/src/adapters/marinahome.test.ts`
- `packages/ingestion/src/adapters/__fixtures__/marinahome-sitemap.xml`
- `packages/ingestion/src/adapters/__fixtures__/marinahome-product-shell.html`
- `packages/ingestion/src/adapters/__fixtures__/marinahome-category-shell.html`
- `packages/ingestion/src/cli.ts`
- `packages/ingestion/src/cli.test.ts`
- `packages/ingestion/src/index.ts`
- `packages/ingestion/package.json`
- `docs/Tracks/v2-commercial/27_Marina_Home_Ingestion_Feasibility.md`
- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`

## Current stage
DUAL_TRACK:
- `LIVE_INGESTION_BLOCKED_WAITING_FOR_APPROVAL`
- `APPROVED_DRY_RUN_ONLY_MARINA_HOME_ADAPTER_SPIKE`

## Blockers
Live ingestion remains blocked. Do not perform live catalog writes, DB/schema changes, generated DB type changes, production flags, deploys, payment/checkout changes, UI changes, Product Matching runtime coupling, Catalog-First runtime coupling, or broad crawler execution without explicit approval.

## Chief architect routing
ARCHITECT_NOTE: Pan Home, Homes r Us, and IKEA UAE now have dry-run-only adapter coverage. Keep live ingestion paths blocked until a separate explicit approval removes dry-run-only guards.

Do not sit idle while live ingestion is blocked. PR #147 completed the Marina Home feasibility spike and recommended a tightly bounded dry-run-only adapter/parser spike. Start one small Catalog Ingestion PR for Marina Home dry-run-only coverage only:

1. Branch from latest `main`; suggested branch `codex/catalog-ingestion-marina-home-dry-run-adapter`.
2. Implement the smallest dry-run-only Marina Home adapter/parser spike using sitemap-first, metadata-first discovery from the public UAE English sitemap and a tiny hand-curated Ritzy-relevant allowlist.
3. Add saved fixtures for sitemap metadata and one or two clean category/product page samples before parser expansion.
4. Add URL validators that accept only clean `https://www.marinahomeinteriors.com/en-uae/...html` category/product URLs and reject query/hash/search/filter/cart/account/checkout/review/tag/Magento `/catalog/...` paths before fetch.
5. Extract only fields safely proven by public clean fixtures: canonical URL, product name, external SKU/code, image URLs/titles, source category route, conservative color/material hints from slug/image metadata, and source freshness. Leave price, sale price, availability, dimensions, and rich attributes `null` unless the clean fixtures prove them without private APIs or broad execution.
6. Preserve `dryRunOnly` and add/extend static fixtures, unit tests, and dry-run command coverage consistent with existing retailer adapter patterns.
7. Leave a tracked mailbox update pointing to the adapter PR and keeping live ingestion blocked.

Hard stop: this adapter PR must not perform live catalog writes, remove `dryRunOnly`, broaden request volume beyond the tiny allowlist, call private APIs, use auth-only paths, execute headless browser ingestion at scale, use search/filter/query URLs, use cart/account/checkout/review/tag/Magento `/catalog/...` paths, change DB/schema/generated types, alter UI/runtime/app actions/prompts/payment/checkout, change production flags, deploy, couple to Product Matching runtime, or couple to Catalog-First runtime.

## Last action taken
Opened PR #154 for the dry-run-only Marina Home adapter/parser spike from latest `main`. The adapter stays sitemap-first, metadata-first, tiny-allowlist, and dry-run-only; price, sale price, availability, dimensions, and rich attributes remain null unless public clean fixtures prove them.

## Next intended action
Implementation agent: monitor PR #154 for `CHIEF_ARCHITECT_REPLY:` or reviewer feedback, fix only listed blockers if rejected, and merge only if explicitly approved to merge and still dry-run-only with runtime impact none.

Create or keep a Catalog Ingestion heartbeat after starting the PR. The heartbeat should run every 10 minutes and monitor:

- the active Catalog Ingestion PR, if one exists
- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- GitHub checks/mergeability for the active PR

Do not delete the Catalog Ingestion heartbeat just because a PR merged. Delete a PR-specific monitor only after either a lane-level heartbeat is active or this mailbox on `main` points to the next safe action. If the PR merges and this mailbox does not name a specific approved next safe stage, leave an `ARCHITECT_NOTE:` requesting Chief Architect routing instead of going idle.

## Durable next-state handoff after merge
Pan Home and Homes r Us live ingestion remain blocked by adapter `dryRunOnly` plus CLI/runner guards. Keep request volume low for any future dry runs, preserve Homes r Us `Crawl-delay: 10`, and avoid query URLs, `/catalog/` paths, private APIs, auth-only paths, search/filter URLs, and broad crawl behavior.

Recommended next safe stage after the Marina Home dry-run adapter PR merges: `AWAIT_CHIEF_ARCHITECT_RETAILER_ROUTING`. Do not start live ingestion, controlled preview, broader retailer discovery, production flags, deploys, or runtime coupling from this approval.

After any PR merges, the agent must not delete its last monitor and go idle unless this mailbox already points to the next safe action or explicitly records that no docs/domain/dry-run work is approved. If there is no next action, leave an `ARCHITECT_NOTE:` in the mailbox or PR requesting Chief Architect routing.

The Catalog Ingestion lane must maintain a heartbeat while work is active or routed. If the lane has no open PR and no approved safe next action, the heartbeat should leave an `ARCHITECT_NOTE:` requesting routing instead of going silent.
