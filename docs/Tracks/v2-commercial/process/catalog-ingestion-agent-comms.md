# Catalog Ingestion Agent Comms

## Current PR
None. PR #138 (https://github.com/Trueflutter/ritzy-studio/pull/138) merged into `main`.

## Current stage
DUAL_TRACK:
- `LIVE_INGESTION_BLOCKED_WAITING_FOR_APPROVAL`
- `APPROVED_DRY_RUN_ONLY_IKEA_UAE_ADAPTER`

## Blockers
Live ingestion remains blocked. Do not perform live catalog writes, DB/schema changes, generated DB type changes, production flags, deploys, payment/checkout changes, UI changes, Product Matching runtime coupling, Catalog-First runtime coupling, or broad crawler execution without explicit approval.

## Chief architect routing
ARCHITECT_NOTE: Pan Home and Homes r Us now have dry-run-only adapter coverage. Keep both live ingestion paths blocked until a separate explicit approval removes the dry-run-only guards.

Do not sit idle while live ingestion is blocked. PR #138 completed the IKEA UAE feasibility spike and recommended a separate dry-run-only adapter PR if Chief Architect/Sam explicitly route it.

Chief Architect routing: start one small dry-run-only IKEA UAE adapter PR:

1. Branch from latest `main`; suggested branch `codex/ikea-uae-ingestion-dry-run`.
2. Implement an IKEA UAE adapter that is explicitly `dryRunOnly`.
3. Use only the clean public URL surfaces approved by PR #138: `/ae/en/cat/...` category pages and `/ae/en/p/...` product pages.
4. Add saved static fixtures and parser/unit tests for one category page and one product page before any live page reads in tests.
5. Add CLI aliases only if they are dry-run-only and blocked from live writes by existing runner/CLI guards.
6. Keep discovery tiny and hand-seeded; do not follow pagination, sitemap breadth, search/filter/query URLs, cart/account/checkout/customer paths, `/catalog/`, `/iows/`, `/retail/`, `/m3/`, `/cdn-cgi/`, recommendation/private module paths, private APIs, or auth-only surfaces.
7. Preserve low request volume, at least a 1 second delay between public page reads, response caching within a run, and hard URL rejection before fetch.
8. Update `docs/Tracks/v2-commercial/25_IKEA_UAE_Ingestion_Feasibility.md` or add a separate IKEA dry-run note with the final adapter scope, dry-run command, fixtures, known gaps, and live-write blockers.
9. Leave a tracked mailbox update pointing to the adapter PR and keeping live ingestion blocked.

Hard stop: this PR must not remove `dryRunOnly`, perform live catalog writes, change DB/schema/generated types, alter UI/runtime/app actions/prompts/payment/checkout, change production flags, deploy, widen request volume beyond the tiny dry-run scope, use private APIs, bypass access controls, use auth-only/search/filter/query/cart/checkout/account URLs, use `/catalog/` or other internal storefront paths, follow pagination/sitemap breadth, couple to Product Matching runtime, or couple to Catalog-First runtime.

## Last action taken
Merged PR #138 for the docs-only IKEA UAE feasibility spike. This update did not execute crawlers, run ingestion commands, run dry-run ingestion commands, perform live writes, remove `dryRunOnly`, widen request volume beyond the tiny feasibility request set, implement an adapter, or touch runtime coupling.

## Next intended action
Implementation agent: open the dry-run-only IKEA UAE adapter PR described above, update this mailbox with the PR URL after creation, then leave an `ARCHITECT_NOTE:` with PR URL, branch, head commit, files touched, verification run, dry-run command, and confirmation that no stop rule was crossed.

Create or keep a Catalog Ingestion heartbeat after opening the PR. The heartbeat should run every 10 minutes and monitor:

- the active Catalog Ingestion PR, if one exists
- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- GitHub checks/mergeability for the active PR

Do not delete the Catalog Ingestion heartbeat just because a PR merged. Delete a PR-specific monitor only after either a lane-level heartbeat is active or this mailbox on `main` points to the next safe action. If the PR merges and this mailbox does not name a specific approved next safe stage, leave an `ARCHITECT_NOTE:` requesting Chief Architect routing instead of going idle.

## Durable next-state handoff after merge
Pan Home and Homes r Us live ingestion remain blocked by adapter `dryRunOnly` plus CLI/runner guards. Keep request volume low for any future dry runs, preserve Homes r Us `Crawl-delay: 10`, and avoid query URLs, `/catalog/` paths, private APIs, auth-only paths, search/filter URLs, and broad crawl behavior.

Recommended next safe stage after this routing PR merges: `APPROVED_DRY_RUN_ONLY_IKEA_UAE_ADAPTER`. Do not start live ingestion, controlled preview, or runtime coupling from this approval.

After any PR merges, the agent must not delete its last monitor and go idle unless this mailbox already points to the next safe action or explicitly records that no docs/domain/dry-run work is approved. If there is no next action, leave an `ARCHITECT_NOTE:` in the mailbox or PR requesting Chief Architect routing.

The Catalog Ingestion lane must maintain a heartbeat while work is active or routed. If the lane has no open PR and no approved safe next action, the heartbeat should leave an `ARCHITECT_NOTE:` requesting routing instead of going silent.
