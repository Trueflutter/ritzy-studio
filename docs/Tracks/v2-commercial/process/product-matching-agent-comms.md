# Product Matching Engine Agent Comms

## Current PR
Draft PR #135: https://github.com/Trueflutter/ritzy-studio/pull/135 on branch `codex/product-match-preview-runbook`.

## Current stage
DUAL_TRACK:
- `WAITING_FOR_SAM_APPROVAL` for controlled default-off preview configuration/execution.
- `APPROVED_DOCS_ONLY_PREVIEW_RUNBOOK` for the next small non-runtime PR.

## Blockers
Controlled default-off preview configuration/execution remains blocked until Sam explicitly approves the exact scope, environment, allowlist, app path, write boundary, and stop/rollback rules.

Product Matching Engine V1 is still not approved for default-on activation, production rollout, broad deploy/production flag changes, live catalog writes, DB/schema changes, generated DB types, UI redesign, prompt changes, payment/checkout changes, Catalog-First runtime coupling, new preview targets, app-action execution, draft shopping-list creates/refreshes, controlled-preview configuration/execution, or broader allowlist expansion without a new approval.

## Chief architect routing
ARCHITECT_NOTE: PR #129 completed the approved non-runtime warning-burn-down pass. Do not run or configure controlled preview until Sam explicitly approves the exact scope, environment, allowlist, app path, write boundary, and stop/rollback rules.

Do not sit idle while waiting for that approval. Start one docs-only Product Matching PR that prepares the controlled-preview execution package without executing it:

1. Branch from latest `main`; suggested branch `codex/product-match-preview-runbook`.
2. Add or update a runbook/checklist under `docs/Tracks/v2-commercial/product-matching-evals/` that Sam can approve or edit.
3. Include exact required approval fields: scope, project/room/user allowlist, environment, app path, write boundary, stop rules, rollback rules, evidence artifacts, owner, and expiration.
4. Include the post-PR #129 warning-burn-down state and explicitly note that warning specificity improved but does not itself approve preview execution.
5. Leave a tracked mailbox update pointing to the runbook PR and keeping preview execution blocked.

Hard stop: this runbook PR must not configure or execute controlled preview, invoke app actions, expand allowlists, create/refresh draft shopping-list or catalog rows, change runtime/env defaults, DB/schema/generated types, UI, prompts, payment/checkout, production flags, deploys, live catalog writes, or Catalog-First runtime coupling.

## Last action taken
Merged PR #129 at `0d41e6ac9699f9ca52e0a511f01f57a025ae61aa` after explicit Chief Architect approval. The merged warning burn-down keeps Product Matching default-off and improves deterministic QA stop-rule warning specificity using existing dimension, evidence completeness, freshness, and supporting-role metadata. Then started the approved docs-only preview runbook PR from latest `main`; the runbook prepares Sam approval fields but does not configure or execute preview. No controlled-preview configuration/execution, app action, evidence pass, draft shopping-list row create/refresh, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, new preview target, allowlist expansion, or Catalog-First runtime coupling was performed.

## Next intended action
Implementation agent: open/review the docs-only preview runbook PR, then leave an `ARCHITECT_NOTE:` with PR URL, branch, head commit, files touched, verification run, and confirmation that no stop rule was crossed.

Create or keep a Product Matching heartbeat after opening the PR. The heartbeat should run every 10 minutes and monitor:

- the active Product Matching PR, if one exists
- `docs/Tracks/v2-commercial/process/product-matching-agent-comms.md`
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- GitHub checks/mergeability for the active PR

Do not delete the Product Matching heartbeat just because a PR merged. Delete a PR-specific monitor only after either a lane-level heartbeat is active or this mailbox on `main` points to the next safe action. If the PR merges and the next safe action is already in this mailbox, immediately start that next safe action instead of waiting for Sam or Chief Architect.

Sam: separately answer the controlled-preview approval request with exact scope, environment, allowlist, app-path/write boundary, and stop/rollback rules before any preview configuration or execution.

## Durable next-state handoff after merge
WAITING_FOR_SAM_APPROVAL remains the runtime gate. APPROVED_DOCS_ONLY_PREVIEW_RUNBOOK may proceed as a small docs-only PR under the guardrails above.

The Product Matching lane must maintain a heartbeat while work is active or routed. If the lane has no open PR and no approved safe next action, the heartbeat should leave an `ARCHITECT_NOTE:` requesting routing instead of going silent.
