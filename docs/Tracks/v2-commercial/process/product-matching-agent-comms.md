# Product Matching Engine Agent Comms

## Current PR
Drafting docs/artifacts-only validation evidence PR after PR #103 and PR #100.

## Current stage
Post-PR103 default-off validation evidence found a remaining role-result contract blocker.

## Blockers
No active implementation blocker. Product Matching Engine V1 is still not approved for default-on activation, production rollout, live catalog writes, DB/schema changes, UI changes, prompt changes, or Catalog-First runtime coupling.

## Chief architect question
ARCHITECT_NOTE:
Lane: Product Matching Engine
Current PR: In progress on `codex/product-match-post-103-validation`.
Current branch/main commit: `main` at `f61b4e2027762c023a14663649936cefbec42db5` after `git fetch origin main` and `git pull --ff-only`.
Current stage: Stop-rule finding from the approved docs/artifacts-only validation evidence pass.
What is complete: PR #100 recorded that Product Matching Engine V1 still needed targeted fixes before controlled default-off preview testing. PR #103 fixed the category normalization issue where `side_tables`, `bedside table`, and `nightstand` role metadata could collapse into `beds`; it also preserves non-bed bedroom-adjacent roles such as `bedside lighting` and `bedroom rug`. The post-PR103 validation evidence now documents that the previous bedroom bedside-table blocker is not fully cleared: retained QA evidence normalizes the bedside category correctly to `side_tables`, but the role result still reports `missing_required` with `productId=null` even though `selectedProducts` contains a plausible side table. Product Matching Engine V1 remains default-off and blocked for controlled preview.
Recommended next PR scope: A narrowly approved prompt-only role-contract hardening PR, unless the Chief Architect prefers a separate default-off runtime validation contract fix. Prompt-only scope would tell visual sourcing to copy each supplied role pool's `category` and `roleLabel` exactly into `roleResults`, and require any selected product to have a matching role result with the same product id. Runtime fix scope, if chosen instead, should be separately approved and test-backed.
Non-goals: No default-on activation, production flags, deploys, live writes, catalog writes, DB/schema changes, UI changes, prompt changes, app-action flow changes, Catalog-First runtime coupling, or production rollout decision in the validation PR.
Checks I will run for this evidence PR: `git diff --check`; docs secret/signed-URL scan for committed evidence; `pnpm --filter @ritzy-studio/domain test`; `pnpm --filter @ritzy-studio/domain typecheck`; and no web typecheck unless web/app code changes unexpectedly.
Exact decision needed from Chief Architect: After this evidence PR is reviewed, approve the next small implementation scope: option 1 prompt-only role-contract hardening, option 2 default-off runtime validation contract fix with tests, or option 3 pause.

CHIEF_ARCHITECT_REPLY:
Approved. Proceed with the recommended docs/artifacts-only default-off validation evidence PR.

Scope:
- Run a local/preview QA validation pass with Product Matching Engine V1 enabled only for the QA process.
- Cover representative living room, dining room, bedroom, and home office/study scenarios.
- Capture selected products, screenshots/contact sheets where safe, missing/weak roles, role confidence, QA gate status, evidence completeness, dimension/catalog freshness notes, and whether the previous bedroom bedside-table blocker is cleared.
- Update the manual QA evidence/readiness docs with explicit comparison against the prior blockers.
- Keep the output as docs/artifacts only.

Hard non-goals:
- No default-on activation.
- No production flags.
- No deploys.
- No live writes, catalog writes, or shopping-list writes.
- No DB/schema changes.
- No UI changes.
- No prompt changes.
- No app-action flow changes.
- No Catalog-First runtime coupling.
- No production rollout decision in this PR.

Stop rule:
If validation exposes a deterministic code issue, role/category normalization bug, prompt issue, or runtime behavior problem, do not quietly fix it inside the evidence PR. Stop, document the finding, and ask for the next scoped PR.

Expected checks:
- `git diff --check`
- secret/signed-URL scan for committed evidence
- domain tests/typecheck
- web typecheck only if any web/app imports or code unexpectedly change.

## Last action taken
Ran adversarial plan review, created `codex/product-match-post-103-validation`, reviewed retained manual QA artifacts through current post-PR103 normalization behavior, and documented the stop-rule finding in the Product Matching evidence/readiness docs.

## Next intended action
Run checks, request implementation review, open the docs/artifacts-only evidence PR if review passes, then recreate `product-matching-pr-check`.
