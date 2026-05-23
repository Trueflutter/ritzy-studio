# Product Matching Engine Agent Comms

## Current PR
None. PR #100 was approved and merged.

## Current stage
Implementing the approved targeted Product Matching confidence normalization fix.

## Blockers
None for the approved scope.

## Chief architect question
ARCHITECT_NOTE:
Lane: Product Matching Engine
Current PR: None. PR #100 merged at 103b2ed.
Current stage: Next targeted Product Matching fix after readiness refresh.
What is complete: PR #97 filled the approved write-free home-office static-image QA evidence gap. PR #100 refreshed the rollout-readiness decision and kept V1 blocked from controlled default-off preview until targeted fixes land.
Decision needed: Should the next PR include a tiny runtime-adjacent web confidence normalization fix, plus tests, so exact supplied role-pool categories like `side_tables` for `bedside tables` remain matchable? Or should the next PR be narrowed to prompt hardening only and explicitly not claim the bedroom bedside contract issue is fixed end to end?
Options: 1. Approve a small runtime-adjacent fix in the default-off Product Matching confidence/QA metadata path: preserve exact role-pool categories for role confidence instead of re-normalizing exact AI role results into broader categories, with focused tests for `side_tables`/bedside tables and supporting storage. 2. Approve prompt-only hardening: tell the model to copy role-pool category/roleLabel exactly and bump the prompt version, but document that it is guidance only and does not close the downstream bedside normalization issue. 3. Pause implementation and ask Sam/chief architect for a broader design on role identity propagation before changing runtime behavior.
Recommendation: Choose option 1. It is the smallest fix that addresses the actual trust hole found by the reviewer, remains behind/default-off QA metadata, and can be tested without DB/schema/UI/prompt rollout or production flag changes. Do not merge it without explicit approval because it is runtime-adjacent, even though the path is default-off metadata.

CHIEF_ARCHITECT_REPLY received: Approved option 1. Proceed with one small runtime-adjacent, default-off confidence normalization fix with tests. Preserve canonical role identity once already known, especially `side_tables`; add regressions for `side_tables`, `bedside table`, `nightstand`, and true `bed`; do not change prompts, default-on flags, DB/schema, UI, catalog-first coupling, live writes, or deploys.

## Last action taken
Received Chief Architect approval, ran adversarial plan review, revised the plan to avoid broad canonical-category preservation, implemented a narrow `side_tables`/bedside table/nightstand precedence fix, and ran domain tests plus web TypeScript.

## Next intended action
Run final diff checks, request implementation review, then stage by file name, commit, push, open PR, and recreate `product-matching-pr-check`.
