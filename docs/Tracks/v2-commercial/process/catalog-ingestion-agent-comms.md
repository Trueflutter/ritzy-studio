# Catalog Ingestion Agent Comms

## Current PR
None. PR #143 (https://github.com/Trueflutter/ritzy-studio/pull/143) merged into `main`.

## Current stage
DUAL_TRACK:
- `LIVE_INGESTION_BLOCKED_WAITING_FOR_APPROVAL`
- `APPROVED_DOCS_ONLY_MARINA_HOME_FEASIBILITY_SPIKE`

## Blockers
Live ingestion remains blocked. Do not perform live catalog writes, DB/schema changes, generated DB type changes, production flags, deploys, payment/checkout changes, UI changes, Product Matching runtime coupling, Catalog-First runtime coupling, or broad crawler execution without explicit approval.

## Chief architect routing
ARCHITECT_NOTE: Pan Home and Homes r Us now have dry-run-only adapter coverage. Keep both live ingestion paths blocked until a separate explicit approval removes the dry-run-only guards.

Do not sit idle while live ingestion is blocked. PR #143 completed the dry-run-only IKEA UAE adapter. Start one docs-only Catalog Ingestion PR for Marina Home UAE feasibility only:

1. Branch from latest `main`; suggested branch `codex/catalog-ingestion-marina-home-feasibility`.
2. Add or update `docs/Tracks/v2-commercial/27_Marina_Home_Ingestion_Feasibility.md`.
3. Inspect only public documentation/source metadata and lightweight public pages needed to assess feasibility; do not run an ingestion crawler.
4. Record canonical host, clean UAE category/product URL shapes, robots/terms notes, request pacing, accepted/rejected surfaces, static parser fields likely available, known gaps, and go/no-go criteria for a future dry-run-only adapter PR.
5. Include a recommendation: proceed to dry-run-only adapter, defer for partner/feed access, or stop.
6. Leave a tracked mailbox update pointing to the feasibility PR and keeping live ingestion blocked.

Hard stop: this docs-only PR must not execute crawlers, implement an adapter, add fixtures/tests/scripts, remove `dryRunOnly`, perform live catalog writes, change DB/schema/generated types, alter UI/runtime/app actions/prompts/payment/checkout, change production flags, deploy, widen request volume, use private APIs, bypass access controls, couple to Product Matching runtime, or couple to Catalog-First runtime.

## Last action taken
Merged PR #143 for the dry-run-only IKEA UAE adapter. IKEA remains dry-run-only and live writes remain blocked by adapter and CLI/runner guards.

## Next intended action
Implementation agent: open the docs-only Marina Home feasibility PR described above, update this mailbox with PR URL after creation, then leave an `ARCHITECT_NOTE:` with PR URL, branch, head commit, files touched, verification run, recommendation, and confirmation that no stop rule was crossed.

Create or keep a Catalog Ingestion heartbeat after opening the PR. The heartbeat should run every 10 minutes and monitor:

- the active Catalog Ingestion PR, if one exists
- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- GitHub checks/mergeability for the active PR

Do not delete the Catalog Ingestion heartbeat just because a PR merged. Delete a PR-specific monitor only after either a lane-level heartbeat is active or this mailbox on `main` points to the next safe action. If the PR merges and this mailbox does not name a specific approved next safe stage, leave an `ARCHITECT_NOTE:` requesting Chief Architect routing instead of going idle.

## Durable next-state handoff after merge
Pan Home and Homes r Us live ingestion remain blocked by adapter `dryRunOnly` plus CLI/runner guards. Keep request volume low for any future dry runs, preserve Homes r Us `Crawl-delay: 10`, and avoid query URLs, `/catalog/` paths, private APIs, auth-only paths, search/filter URLs, and broad crawl behavior.

Recommended next safe stage after this routing PR merges: `APPROVED_DOCS_ONLY_MARINA_HOME_FEASIBILITY_SPIKE`. Do not start live ingestion, controlled preview, broader IKEA discovery, or another retailer without explicit Chief Architect/Sam routing.

After any PR merges, the agent must not delete its last monitor and go idle unless this mailbox already points to the next safe action or explicitly records that no docs/domain/dry-run work is approved. If there is no next action, leave an `ARCHITECT_NOTE:` in the mailbox or PR requesting Chief Architect routing.

The Catalog Ingestion lane must maintain a heartbeat while work is active or routed. If the lane has no open PR and no approved safe next action, the heartbeat should leave an `ARCHITECT_NOTE:` requesting routing instead of going silent.
