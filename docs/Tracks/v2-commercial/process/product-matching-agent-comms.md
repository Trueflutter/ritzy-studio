# Product Matching Engine Agent Comms

## Current PR
None. PR #153 (https://github.com/Trueflutter/ritzy-studio/pull/153) merged into `main` at `917b8b5`.

## Current stage
`CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION`

## Blockers
Controlled default-off preview configuration/execution remains blocked until Sam explicitly approves the exact scope, environment, allowlist, app path, write boundary, and stop/rollback rules.

Product Matching Engine V1 is still not approved for default-on activation, production rollout, broad deploy/production flag changes, live catalog writes, DB/schema changes, generated DB types, UI redesign, prompt changes, payment/checkout changes, Catalog-First runtime coupling, new preview targets, app-action execution, draft shopping-list creates/refreshes, controlled-preview configuration/execution, or broader allowlist expansion without a new approval.

## Chief architect routing
ARCHITECT_NOTE: PR #142 completed the one Sam-approved bounded local QA / read-only manual harness evidence pass for the two approved targets only. PR #148 completed the docs-only post-evidence warning triage. PR #153 completed the QA-harness-only warning report improvement. Do not run or configure any further controlled preview until Sam/Chief explicitly approves the next bounded execution.

ARCHITECT_NOTE: No explicit next safe Product Matching implementation stage is currently routed. Product Matching should remain blocked at the controlled-preview expansion decision gate until Sam/Chief provides the next bounded scope.

Hard stop: this QA-harness-only PR must not run or configure preview, invoke app actions, expand allowlists, create/refresh draft shopping-list or catalog rows, change runtime/env defaults, DB/schema/generated types, UI, prompts, payment/checkout, production flags, deploys, live catalog writes, default-on activation, production rollout, selection/scoring behavior, or Catalog-First runtime coupling.

## Last action taken
Merged PR #153 at `917b8b5` after Sam/Chief approval. The PR added deterministic QA warning grouping over existing role-confidence metadata plus a static PR #142-shaped fixture test. No further controlled-preview configuration/execution, app action, evidence pass, draft shopping-list row create/refresh, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, new preview target, allowlist expansion, default-on activation, production rollout, selection/scoring behavior change, or Catalog-First runtime coupling was performed.

## Next intended action
Implementation agent: wait for explicit Sam/Chief routing before starting any further Product Matching implementation work. If routing appears, resume only within that bounded scope. If ambiguity appears, leave an `ARCHITECT_NOTE:` with the exact blocker and recommended next action.

Create or keep a Product Matching heartbeat after starting the PR. The heartbeat should run every 10 minutes and monitor:

- the active Product Matching PR, if one exists
- `docs/Tracks/v2-commercial/process/product-matching-agent-comms.md`
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- GitHub checks/mergeability for the active PR

Do not delete the Product Matching heartbeat just because a PR merged. Delete a PR-specific monitor only after either a lane-level heartbeat is active or this mailbox on `main` points to the next safe action. If the PR merges and this mailbox does not name a specific approved next safe stage, leave an `ARCHITECT_NOTE:` requesting Chief Architect routing instead of going idle.

Sam/Chief: separately review whether the PR #142 two-target evidence is sufficient for a next bounded preview step. Any further execution requires a new explicit approval with scope, project/room/user allowlist, environment, app path, write boundary, stop rules, rollback rules, evidence artifacts, owner, and expiration.

## Durable next-state handoff after merge
CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION remains the runtime gate. QA_HARNESS_ONLY_WARNING_REPORT_IMPROVEMENT is complete. Do not start controlled preview, app actions, allowlist expansion, DB/schema/generated type changes, runtime/UI/prompt/payment/checkout work, live catalog writes, production flags, deploys, default-on activation, production rollout, selection/scoring changes, or Catalog-First runtime coupling without explicit Sam/Chief approval.
