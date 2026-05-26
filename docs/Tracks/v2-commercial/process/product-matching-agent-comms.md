# Product Matching Engine Agent Comms

## Current PR
PR #160: https://github.com/Trueflutter/ritzy-studio/pull/160

Branch: `codex/product-match-preview-execution-boundary`

## Current stage
DUAL_TRACK:
- `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION`
- `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION` after PR #160 merges

## Blockers
Controlled default-off preview configuration/execution remains blocked until Sam explicitly approves the exact scope, environment, allowlist, app path, write boundary, and stop/rollback rules.

Product Matching Engine V1 is still not approved for controlled-preview configuration/execution, app actions, runtime allowlist expansion, draft shopping-list/catalog writes, live catalog writes, DB/schema changes, generated DB types, runtime/UI redesign/prompt changes, payment/checkout changes, production flags/deploys, default-on activation, production rollout, selection/scoring changes, Catalog-First runtime coupling, new preview targets, or broader allowlist expansion without a new approval.

## Chief architect routing
ARCHITECT_NOTE: PR #142 completed the one Sam-approved bounded local QA / read-only manual harness evidence pass for the two approved targets only. PR #148 completed the docs-only post-evidence warning triage. PR #153 completed the QA-harness-only warning report improvement. Do not run or configure any further controlled preview until Sam/Chief explicitly approves the next bounded execution.

ARCHITECT_NOTE: PR #160 prepares the docs-only controlled-preview execution-boundary approval package. After PR #160 merges, it completes that docs-only package and leaves the lane at `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`. It does not approve, configure, or execute controlled preview.

Hard stop: this docs-only PR must not run or configure preview, invoke app actions, expand allowlists in runtime config, create/refresh draft shopping-list or catalog rows, change runtime/env defaults, DB/schema/generated types, UI, prompts, payment/checkout, production flags, deploys, live catalog writes, default-on activation, production rollout, selection/scoring behavior, or Catalog-First runtime coupling.

## Last action taken
Opened PR #160 as the docs-only controlled-preview execution-boundary package after PR #153. The branch prepares approval fields for proposed scope, project/room/user allowlist, environment, app path, write boundary, stop rules, rollback rules, owner, expiration, and evidence artifacts. No controlled-preview configuration/execution, app action, evidence pass, draft shopping-list row create/refresh, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, new preview target, allowlist expansion, default-on activation, production rollout, selection/scoring behavior change, or Catalog-First runtime coupling was performed.

## Next intended action
Implementation agent: monitor PR #160 review/checks and respond only within docs-only controlled-preview execution-boundary scope. After merge, wait for Sam/Chief to explicitly approve or decline the prepared execution boundary before starting any further Product Matching implementation or execution stage.

Create or keep a Product Matching heartbeat after starting the PR. The heartbeat should run every 10 minutes and monitor:

- the active Product Matching PR, if one exists
- `docs/Tracks/v2-commercial/process/product-matching-agent-comms.md`
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- GitHub checks/mergeability for the active PR

Do not delete the Product Matching heartbeat just because a PR merged. Delete a PR-specific monitor only after either a lane-level heartbeat is active or this mailbox on `main` points to the next safe action. If the PR merges and this mailbox does not name a specific approved next safe stage, leave an `ARCHITECT_NOTE:` requesting Chief Architect routing instead of going idle.

Sam/Chief: separately review whether the PR #142 two-target evidence is sufficient for a next bounded preview step. Any further execution requires a new explicit approval with scope, project/room/user allowlist, environment, app path, write boundary, stop rules, rollback rules, evidence artifacts, owner, and expiration.

## Durable next-state handoff after merge
After PR #160 merges, the docs-only controlled-preview execution-boundary package is complete and the lane state is `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`. `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` remains the runtime gate. Do not start controlled-preview configuration/execution, app actions, allowlist expansion in runtime config, draft shopping-list/catalog writes, DB/schema/generated type changes, runtime/UI/prompt/payment/checkout work, live catalog writes, production flags/deploys, default-on activation, production rollout, Product Matching selection/scoring changes, or Catalog-First runtime coupling without explicit Sam/Chief approval.
