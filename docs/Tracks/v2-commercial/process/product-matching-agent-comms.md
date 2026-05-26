# Product Matching Engine Agent Comms

## Current PR
PR #170: https://github.com/Trueflutter/ritzy-studio/pull/170

Branch: `codex/product-match-mailbox-hygiene`

## Current stage
DUAL_TRACK:
- `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`
- `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` remains the runtime gate

## Blockers
Controlled default-off preview configuration/execution remains blocked until Sam explicitly approves the exact scope, environment, allowlist, app path, write boundary, and stop/rollback rules.

Product Matching Engine V1 is still not approved for controlled-preview configuration/execution, app actions, runtime allowlist expansion, draft shopping-list/catalog writes, live catalog writes, DB/schema changes, generated DB types, runtime/UI redesign/prompt changes, payment/checkout changes, production flags/deploys, default-on activation, production rollout, selection/scoring changes, Catalog-First runtime coupling, new preview targets, or broader allowlist expansion without a new approval.

## Chief architect routing
ARCHITECT_NOTE: PR #142 completed the one Sam-approved bounded local QA / read-only manual harness evidence pass for the two approved targets only. PR #148 completed the docs-only post-evidence warning triage. PR #153 completed the QA-harness-only warning report improvement. Do not run or configure any further controlled preview until Sam/Chief explicitly approves the next bounded execution.

ARCHITECT_NOTE: PR #160 completed the docs-only controlled-preview execution-boundary approval package. PR #170 is mailbox hygiene that clears stale PR #160 state while keeping the lane parked at `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`, with `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` still the runtime gate. It does not approve, configure, or execute controlled preview.

Hard stop: no controlled-preview configuration/execution, app actions, runtime allowlist expansion, draft shopping-list/catalog writes, live catalog writes, DB/schema/generated types, runtime/env default changes, runtime/UI/prompt/payment/checkout changes, production flags/deploys, default-on activation, production rollout, selection/scoring changes, or Catalog-First runtime coupling without explicit Sam/Chief approval.

## Last action taken
PR #160 completed the docs-only controlled-preview execution-boundary package after PR #153. The package prepares approval fields for proposed scope, project/room/user allowlist, environment, app path, write boundary, stop rules, rollback rules, owner, expiration, and evidence artifacts. No controlled-preview configuration/execution, app action, evidence pass, draft shopping-list row create/refresh, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, new preview target, allowlist expansion, default-on activation, production rollout, selection/scoring behavior change, or Catalog-First runtime coupling was performed.

PR #170 opened to clean stale mailbox state after PR #160 merged. This is docs/mailbox only.

## Next intended action
Implementation agent: wait for explicit Sam/Chief approval, edits, or rejection of the prepared execution boundary before starting any further Product Matching implementation or execution stage. Do not start implementation or execution from PR #160 alone.

Keep the Product Matching lane heartbeat active. It must not be deleted after merges. The heartbeat should run every 10 minutes and monitor:

- `docs/Tracks/v2-commercial/process/product-matching-agent-comms.md`
- Product Matching PRs, if any appear
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- this thread for explicit Sam/Chief approval, edits, or rejection

Do not delete the Product Matching heartbeat just because a PR merged. If the mailbox does not name a specific approved next safe implementation stage, keep the lane parked and wait for Sam/Chief routing.

Sam/Chief: separately review whether the PR #142 two-target evidence is sufficient for a next bounded preview step. Any further execution requires a new explicit approval with scope, project/room/user allowlist, environment, app path, write boundary, stop rules, rollback rules, evidence artifacts, owner, and expiration.

## Durable next-state handoff after merge
PR #160 is merged and the docs-only controlled-preview execution-boundary package is complete. The lane state is `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`. `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` remains the runtime gate. Do not start controlled-preview configuration/execution, app actions, allowlist expansion in runtime config, draft shopping-list/catalog writes, DB/schema/generated type changes, runtime/UI/prompt/payment/checkout work, live catalog writes, production flags/deploys, default-on activation, production rollout, Product Matching selection/scoring changes, or Catalog-First runtime coupling without explicit Sam/Chief approval.
