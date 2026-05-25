# Product Matching Engine Agent Comms

## Current PR
None. PR #125 merged.

## Current stage
DUAL_TRACK:
- `WAITING_FOR_SAM_APPROVAL` for controlled default-off preview configuration/execution.
- `APPROVED_NON_RUNTIME_WARNING_BURN_DOWN` for the next small implementation/docs PR.

## Blockers
Controlled default-off preview configuration/execution remains blocked until Sam explicitly approves the exact scope, environment, allowlist, app path, write boundary, and stop/rollback rules.

Product Matching Engine V1 is still not approved for default-on activation, production rollout, broad deploy/production flag changes, live catalog writes, DB/schema changes, generated DB types, UI redesign, prompt changes, payment/checkout changes, Catalog-First runtime coupling, new preview targets, app-action execution, draft shopping-list creates/refreshes, controlled-preview configuration/execution, or broader allowlist expansion without a new approval.

## Chief architect routing
ARCHITECT_NOTE: Do not sit idle while the preview activation gate waits for Sam. Start the next smallest Product Matching PR that does not cross the activation boundary:

1. Read the current readiness docs and latest QA evidence only.
2. Identify the remaining warning classes from PR #123/#125, especially metadata/supporting evidence completeness and dimension/catalog freshness warnings.
3. Propose and implement one narrow default-off warning-burn-down improvement that stays inside domain/test/docs or QA-harness-only code.
4. Prefer a change that improves warning specificity, evidence reporting, or deterministic QA visibility without invoking app actions or creating/refreshing shopping-list/catalog rows.
5. Open a small PR and include before/after evidence from local tests or static fixtures.

If the warning-burn-down pass discovers that the next useful improvement requires controlled-preview execution, app actions, draft shopping-list writes, DB/schema/generated types, UI/prompt/payment/checkout changes, production flags, live catalog writes, or Catalog-First runtime coupling, stop and ask Chief Architect instead of widening the PR.

## Last action taken
Merged PR #125 at `1315a4c` after explicit implementation-agent merge instruction. The docs-only Sam decision request is tracked on `main` at `docs/Tracks/v2-commercial/product-matching-evals/2026-05-25-sam-controlled-preview-approval-request.md`. Existing app action was not invoked, no evidence pass was run, no preview configuration/execution was performed, no draft shopping-list rows were created/refreshed, and no DB/live catalog writes were performed.

## Next intended action
Implementation agent: start `APPROVED_NON_RUNTIME_WARNING_BURN_DOWN` from latest `main`, using a branch such as `codex/product-match-warning-burn-down`. Keep the PR small and default-off. Do not run or configure controlled preview.

Chief Architect/Sam: separately answer the controlled-preview approval request with exact scope, environment, allowlist, app-path/write boundary, and stop/rollback rules.

## Durable next-state handoff after merge
The preview activation gate remains `WAITING_FOR_SAM_APPROVAL`. The non-runtime warning-burn-down lane may proceed in a small PR under the guardrails above.
