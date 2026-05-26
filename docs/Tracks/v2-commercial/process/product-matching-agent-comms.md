# Product Matching Engine Agent Comms

## Current PR
None. PR #181 (https://github.com/Trueflutter/ritzy-studio/pull/181) merged the docs-only Product Matching investor demo runbook into `main`.

## Current stage
DUAL_TRACK:
- `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`
- `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` remains the runtime gate

## Blockers
Controlled default-off preview configuration/execution remains blocked until Sam explicitly approves the exact scope, environment, allowlist, app path, write boundary, and stop/rollback rules.

Product Matching Engine V1 is still not approved for controlled-preview configuration/execution, app actions, runtime allowlist expansion, draft shopping-list/catalog writes, live catalog writes, DB/schema changes, generated DB types, runtime/UI redesign/prompt changes, payment/checkout changes, production flags/deploys, default-on activation, production rollout, selection/scoring changes, Catalog-First runtime coupling, new preview targets, or broader allowlist expansion without a new approval.

## Chief architect routing
ARCHITECT_NOTE: PR #181 adds the docs-only investor demo runbook at `docs/Tracks/v2-commercial/product-matching-evals/2026-05-26-investor-demo-runbook.md`. It explains the pitch-safe Product Matching story after PR #176 and PR #173, what can be shown without controlled preview, what must not be claimed, future bounded-preview approval fields, and the fallback if asked whether this can run live today. It does not approve or perform controlled-preview configuration/execution, app actions, runtime allowlist expansion, writes, runtime/schema/UI/prompt/payment/checkout changes, production flags/deploys, default-on activation, production rollout, selection/scoring changes, or Catalog-First runtime coupling.

ARCHITECT_NOTE: PR #176 merged into `main` and completed the docs/artifacts-only Product Matching pitch-readiness package after PR #173. The package confirms the product-sourcing image-resilience fix is present on main, summarizes what is now safer for investor-demo readiness, and keeps controlled-preview execution blocked pending explicit Sam/Chief approval of the execution boundary.

ARCHITECT_NOTE: PR #173 merged into `main` at `f86d902e7bdf648b15453ad2345de3128b27a773` and the product-sourcing image-resilience fix is present on `origin/main`. The fix improves image preflight safety in the existing product-sourcing path, but it does not approve Product Matching controlled-preview configuration/execution, app actions, runtime allowlist expansion, writes, runtime/schema/UI/prompt/payment/checkout changes, production flags/deploys, default-on activation, production rollout, selection/scoring changes, or Catalog-First runtime coupling.

ARCHITECT_NOTE: PR #142 completed the one Sam-approved bounded local QA / read-only manual harness evidence pass for the two approved targets only. PR #148 completed the docs-only post-evidence warning triage. PR #153 completed the QA-harness-only warning report improvement. Do not run or configure any further controlled preview until Sam/Chief explicitly approves the next bounded execution.

ARCHITECT_NOTE: PR #160 completed the docs-only controlled-preview execution-boundary approval package. PR #170 completed mailbox hygiene that cleared stale PR #160 state while keeping the lane parked at `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`, with `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` still the runtime gate. It does not approve, configure, or execute controlled preview.

Hard stop: no controlled-preview configuration/execution, app actions, runtime allowlist expansion, draft shopping-list/catalog writes, live catalog writes, DB/schema/generated types, runtime/env default changes, runtime/UI/prompt/payment/checkout changes, production flags/deploys, default-on activation, production rollout, selection/scoring changes, or Catalog-First runtime coupling without explicit Sam/Chief approval.

## Last action taken
PR #181 created `docs/Tracks/v2-commercial/product-matching-evals/2026-05-26-investor-demo-runbook.md` and updated this mailbox. No controlled-preview configuration/execution, app action, evidence pass, draft shopping-list row create/refresh, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, new preview target, allowlist expansion, default-on activation, production rollout, selection/scoring behavior change, or Catalog-First runtime coupling was performed.

PR #176 merged the docs/artifacts-only pitch-readiness package. It added `docs/Tracks/v2-commercial/product-matching-evals/2026-05-26-pitch-readiness-status.md` and updated this mailbox. No controlled-preview configuration/execution, app action, evidence pass, draft shopping-list row create/refresh, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, new preview target, allowlist expansion, default-on activation, production rollout, selection/scoring behavior change, or Catalog-First runtime coupling was performed.

PR #173 completed the product-sourcing image-resilience hotfix on `main`. `apps/web/app/product-image-preflight.ts` and `apps/web/app/product-image-preflight.test.ts` are present on `origin/main`, and merge commit `f86d902e7bdf648b15453ad2345de3128b27a773` is included in `origin/main`.

PR #160 completed the docs-only controlled-preview execution-boundary package after PR #153. The package prepares approval fields for proposed scope, project/room/user allowlist, environment, app path, write boundary, stop rules, rollback rules, owner, expiration, and evidence artifacts. No controlled-preview configuration/execution, app action, evidence pass, draft shopping-list row create/refresh, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, new preview target, allowlist expansion, default-on activation, production rollout, selection/scoring behavior change, or Catalog-First runtime coupling was performed.

PR #170 merged to clean stale mailbox state after PR #160 merged. This was docs/mailbox only.

## Next intended action
Implementation agent: wait for explicit Sam/Chief approval, edits, or rejection of the prepared execution boundary before starting any further Product Matching implementation or execution stage. Do not start implementation or execution from PR #160, PR #173, PR #176, or PR #181 alone.

Keep the Product Matching lane heartbeat active. It must not be deleted after merges. The heartbeat should run every 10 minutes and monitor:

- `docs/Tracks/v2-commercial/process/product-matching-agent-comms.md`
- Product Matching PRs, if any appear
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- this thread for explicit Sam/Chief approval, edits, or rejection

Do not delete the Product Matching heartbeat just because a PR merged. If the mailbox does not name a specific approved next safe implementation stage, keep the lane parked and wait for Sam/Chief routing.

Sam/Chief: separately review whether the PR #142 two-target evidence is sufficient for a next bounded preview step. Any further execution requires a new explicit approval with scope, project/room/user allowlist, environment, app path, write boundary, stop rules, rollback rules, evidence artifacts, owner, and expiration.

## Durable next-state handoff after merge
PR #181 merged the docs-only Product Matching investor demo runbook at `docs/Tracks/v2-commercial/product-matching-evals/2026-05-26-investor-demo-runbook.md`. The lane state remains `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`. `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` remains the runtime gate. Do not start controlled-preview configuration/execution, app actions, allowlist expansion in runtime config, draft shopping-list/catalog writes, DB/schema/generated type changes, runtime/UI/prompt/payment/checkout work, live catalog writes, production flags/deploys, default-on activation, production rollout, Product Matching selection/scoring changes, or Catalog-First runtime coupling without explicit Sam/Chief approval.

PR #176 is merged and the docs/artifacts-only Product Matching pitch-readiness package is complete. The lane state remains `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`. `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` remains the runtime gate. Do not start controlled-preview configuration/execution, app actions, allowlist expansion in runtime config, draft shopping-list/catalog writes, DB/schema/generated type changes, runtime/UI/prompt/payment/checkout work, live catalog writes, production flags/deploys, default-on activation, production rollout, Product Matching selection/scoring changes, or Catalog-First runtime coupling without explicit Sam/Chief approval.

PR #160 is merged and the docs-only controlled-preview execution-boundary package is complete. The lane state is `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`. `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` remains the runtime gate. Do not start controlled-preview configuration/execution, app actions, allowlist expansion in runtime config, draft shopping-list/catalog writes, DB/schema/generated type changes, runtime/UI/prompt/payment/checkout work, live catalog writes, production flags/deploys, default-on activation, production rollout, Product Matching selection/scoring changes, or Catalog-First runtime coupling without explicit Sam/Chief approval.
