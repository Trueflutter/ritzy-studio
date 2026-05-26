# Product Matching Controlled Preview Execution Boundary

Status: docs-only approval package. This file does not approve, configure, or execute controlled preview.

## Purpose

Prepare the exact Sam/Chief approval fields required before any Product Matching controlled-preview execution. Product Matching remains blocked at `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` until Sam/Chief explicitly approves every field below.

## Readiness Basis

| Source | Readiness signal | Remaining boundary |
| --- | --- | --- |
| PR #142 / `manual-qa/2026-05-25-sam-approved-bounded-preview-evidence.md` | One Sam-approved local QA / read-only manual harness pass completed for two targets. Both passed QA stop rules with 0 blockers. Living had 13 warnings; dining had 8 warnings. | Approval was single-use and expired by execution. It does not approve another pass. |
| PR #148 / `2026-05-25-post-evidence-warning-triage.md` | Warning classes were grouped by required role, supporting role, dimension fit, catalog evidence completeness, catalog freshness, and candidate-pool quality. | Recommended non-execution QA report improvement before broader activity. |
| PR #153 / `manual-qa/2026-05-25-qa-warning-reporting.md` | QA-harness-only warning reporting now supports deterministic grouping by severity, issue code, role, product, dimension group, evidence field, and freshness status. | Reporting clarity improved; execution approval is still blocked. |

## Proposed Approval Fields

Sam/Chief must approve or edit every row before any controlled-preview execution.

| Field | Proposed value | Required approval |
| --- | --- | --- |
| Scope | Product Matching V1 controlled default-off evidence pass for the two already evidenced targets only. | Yes |
| Project allowlist | `f66beecc-c011-43c7-9db7-ed59af879820` (Claret Villa) and `c0c9c62e-1062-409f-a624-18db550e7a69` (Dubai South). | Yes |
| Room allowlist | `45edb758-735b-4666-bb4b-b00b7cd61de5` (Ground floor Lounge / Living Room) and `1da580bf-9ad4-40fa-8ee6-420efbbc8ffb` (Ground Floor Dining Room / Dining Room). | Yes |
| User/account allowlist | No user/account allowlist proposed for read-only/manual harness execution. If an app path or preview deployment is approved, Sam/Chief must name exact user/account IDs before execution. | Yes |
| Environment | Proposed default: local QA only. Preview deployment is not approved unless Sam/Chief explicitly chooses it and names environment variables, access controls, and operator. | Yes |
| App path | Proposed default: read-only/manual harness only. No app action execution unless separately approved by Sam/Chief with exact action name and write boundary. | Yes |
| Write boundary | Proposed default: no writes. No draft shopping-list create/refresh. No catalog writes. No DB/schema/generated type changes. | Yes |
| Runtime/config boundary | No runtime/env default changes. Any controlled-preview variables may be set only inside the approved local QA process for the approved pass, if Sam/Chief approves execution. No production flags. | Yes |
| Evidence artifacts | Commit only safe evidence notes under `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/`. Do not commit raw output if it contains sensitive data, expiring URLs, secrets, or unsafe customer data. | Yes |
| Owner | Product Matching implementation agent owns execution and evidence capture. Chief Architect reviews the resulting PR. Sam/Chief owns approval of the execution boundary. | Yes |
| Expiration | Approval should expire after one execution pass or 24 hours, whichever comes first. | Yes |

## Proposed Target Package

| Target | Project ID | Room ID | Room type | Prior evidence |
| --- | --- | --- | --- | --- |
| Claret Villa / Ground floor Lounge | `f66beecc-c011-43c7-9db7-ed59af879820` | `45edb758-735b-4666-bb4b-b00b7cd61de5` | Living Room | PR #142 passed with 0 blockers, 13 warnings, 6 selected products. |
| Dubai South / Ground Floor Dining Room | `c0c9c62e-1062-409f-a624-18db550e7a69` | `1da580bf-9ad4-40fa-8ee6-420efbbc8ffb` | Dining Room | PR #142 passed with 0 blockers, 8 warnings, 6 selected products. |

No bedroom, home-office/study, new project, new room, new user/account, or broader allowlist is proposed in this package.

## Proposed Stop Rules

Stop immediately if any of these occur:

- any required role is missing, `closest_available`, invalid, outside its candidate pool, or materially contradictory in color/material/category/scale when matching alternatives exist;
- any approved target is not exactly the approved project/room pair;
- any app action is invoked without explicit approval;
- any draft shopping-list row, catalog row, DB/schema, generated type, runtime default, production flag, deploy, UI, prompt, payment/checkout path, or Catalog-First runtime coupling change is required;
- QA artifacts do not include role pools, candidate counts, role status, confidence, dimension fit, evidence completeness, freshness, warning details, and stop-rule outcome;
- artifacts include secrets, unsafe customer data, expiring signed URLs, or raw output that should not be committed;
- Product Matching would need to run outside the approved environment or after the approval expires.

## Proposed Rollback Rules

If any stop rule triggers:

- stop the pass immediately;
- keep Product Matching default-off globally;
- do not reuse failed output for customer-facing shopping-list decisions;
- do not create or refresh draft shopping-list rows;
- do not write catalog data;
- record the blocker in the evidence notes;
- leave an `ARCHITECT_NOTE:` requesting Chief Architect routing for the next docs-only, QA-harness-only, or narrow data-quality/scoring follow-up.

## Evidence Requirements

The resulting evidence PR, if execution is later approved, must include:

- selected products by role;
- required/supporting role statuses;
- blocker and warning counts;
- role confidence;
- role pools and candidate counts;
- dimension-fit groups, including missing structured dimensions, title-derived dimension text, missing room measurements, fit checked, and oversized dimensions where applicable;
- catalog evidence field groups, including color, material, style/room, dimension, price, availability, image, and canonical URL where available;
- catalog freshness status;
- stop-rule outcome;
- safe screenshots/contact sheets only if separately approved and non-sensitive.

## Explicit Non-Approval

This PR does not approve or perform:

- controlled-preview configuration or execution;
- app action execution;
- allowlist expansion in runtime config;
- draft shopping-list or catalog writes;
- live catalog writes;
- DB/schema/generated type changes;
- runtime/env default changes;
- UI, prompt, payment, or checkout changes;
- production flags or deploys;
- default-on activation;
- production rollout;
- Product Matching selection/scoring changes;
- Catalog-First runtime coupling.

## Decision Needed

Sam/Chief should either:

1. approve or edit every approval field above for one bounded execution pass; or
2. decline execution and route the next docs-only, QA-harness-only, data-quality, or scoring follow-up.

Until that answer exists, Product Matching remains blocked at `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION`.
