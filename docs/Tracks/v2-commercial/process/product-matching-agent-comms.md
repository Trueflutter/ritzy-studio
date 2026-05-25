# Product Matching Engine Agent Comms

## Current PR
None. PR #129 (https://github.com/Trueflutter/ritzy-studio/pull/129) merged into `main` at `0d41e6ac9699f9ca52e0a511f01f57a025ae61aa`.

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
Merged PR #129 at `0d41e6ac9699f9ca52e0a511f01f57a025ae61aa` after explicit Chief Architect approval. The merged warning burn-down keeps Product Matching default-off and improves deterministic QA stop-rule warning specificity using existing dimension, evidence completeness, freshness, and supporting-role metadata. No controlled-preview configuration/execution, app action, evidence pass, draft shopping-list row create/refresh, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, new preview target, allowlist expansion, or Catalog-First runtime coupling was performed.

## Next intended action
Implementation agent: open the docs-only preview runbook PR described above, then leave an `ARCHITECT_NOTE:` with PR URL, branch, head commit, files touched, and confirmation that no stop rule was crossed.

Sam: separately answer the controlled-preview approval request with exact scope, environment, allowlist, app-path/write boundary, and stop/rollback rules before any preview configuration or execution.

## Durable next-state handoff after merge
WAITING_FOR_SAM_APPROVAL remains the runtime gate. APPROVED_DOCS_ONLY_PREVIEW_RUNBOOK may proceed as a small docs-only PR under the guardrails above.
