# Product Matching Engine Agent Comms

## Current PR
None. PR #148 (https://github.com/Trueflutter/ritzy-studio/pull/148) merged into `main`.

## Current stage
DUAL_TRACK:
- `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION`
- `APPROVED_QA_HARNESS_ONLY_WARNING_REPORT_IMPROVEMENT`

## Blockers
Controlled default-off preview configuration/execution remains blocked until Sam explicitly approves the exact scope, environment, allowlist, app path, write boundary, and stop/rollback rules.

Product Matching Engine V1 is still not approved for default-on activation, production rollout, broad deploy/production flag changes, live catalog writes, DB/schema changes, generated DB types, UI redesign, prompt changes, payment/checkout changes, Catalog-First runtime coupling, new preview targets, app-action execution, draft shopping-list creates/refreshes, controlled-preview configuration/execution, or broader allowlist expansion without a new approval.

## Chief architect routing
ARCHITECT_NOTE: PR #142 completed the one Sam-approved bounded local QA / read-only manual harness evidence pass for the two approved targets only. PR #148 completed the docs-only post-evidence warning triage. Do not run or configure any further controlled preview until Sam/Chief explicitly approves the next bounded execution.

Do not sit idle while execution is blocked. Start one QA-harness-only Product Matching PR for deterministic warning visibility:

1. Branch from latest `main`; suggested branch `codex/product-match-qa-warning-reporting`.
2. Preserve current Product Matching selection behavior, scoring, stop rules, and runtime defaults.
3. Improve the QA report generation/display layer only so warning classes are counted and grouped consistently by role, severity, and product.
4. Split dimension warnings into `missing structured dimensions`, `title-derived dimensions present`, `missing room measurements`, and `fit checked`.
5. Split catalog evidence warnings into missing color, material, style/room, dimension, price, availability, and image fields where the existing evidence model supports it.
6. Add a static fixture or replay test using PR #142-shaped output so the warning report remains deterministic without invoking app actions or controlled-preview execution.
7. Leave a tracked mailbox update pointing to the PR and keeping controlled-preview execution blocked.

Hard stop: this QA-harness-only PR must not run or configure preview, invoke app actions, expand allowlists, create/refresh draft shopping-list or catalog rows, change runtime/env defaults, DB/schema/generated types, UI, prompts, payment/checkout, production flags, deploys, live catalog writes, default-on activation, production rollout, selection/scoring behavior, or Catalog-First runtime coupling.

## Last action taken
PR #148 merged the docs-only post-evidence warning triage package into `main`. It grouped living and dining warnings from PR #142 and recommended a non-execution QA-harness-only report improvement for deterministic warning visibility. No further controlled-preview configuration/execution, app action, evidence pass, draft shopping-list row create/refresh, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, new preview target, allowlist expansion, default-on activation, production rollout, or Catalog-First runtime coupling was performed.

## Next intended action
Implementation agent: start the QA-harness-only warning report improvement described above, open a small PR, and leave an `ARCHITECT_NOTE:` with PR URL, branch, head commit, files touched, tests/verification run, fixture/replay coverage, and confirmation that no stop rule was crossed.

Create or keep a Product Matching heartbeat after starting the PR. The heartbeat should run every 10 minutes and monitor:

- the active Product Matching PR, if one exists
- `docs/Tracks/v2-commercial/process/product-matching-agent-comms.md`
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- GitHub checks/mergeability for the active PR

Do not delete the Product Matching heartbeat just because a PR merged. Delete a PR-specific monitor only after either a lane-level heartbeat is active or this mailbox on `main` points to the next safe action. If the PR merges and this mailbox does not name a specific approved next safe stage, leave an `ARCHITECT_NOTE:` requesting Chief Architect routing instead of going idle.

Sam/Chief: separately review whether the PR #142 two-target evidence is sufficient for a next bounded preview step. Any further execution requires a new explicit approval with scope, project/room/user allowlist, environment, app path, write boundary, stop rules, rollback rules, evidence artifacts, owner, and expiration.

## Durable next-state handoff after merge
CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION remains the runtime gate. Recommended next safe stage after this routing PR merges: `APPROVED_QA_HARNESS_ONLY_WARNING_REPORT_IMPROVEMENT`.
