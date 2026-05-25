# Controlled Preview Execution Runbook

Status: approval checklist only. This document does not approve, configure, or execute Product Matching controlled preview.

## Purpose

Prepare the exact fields Sam must approve or edit before Product Matching Engine V1 can run in controlled default-off preview.

PR #129 improved deterministic warning specificity for future QA artifacts. That improves review clarity for dimensions, catalog evidence completeness, catalog freshness, and supporting-role warnings, but it does not change the activation gate and does not approve preview execution.

## Approval Record For Sam

Sam must approve or edit every field below before any controlled-preview configuration or execution.

| Field | Proposed value for Sam to approve or edit | Required before execution |
| --- | --- | --- |
| Scope | Controlled default-off Product Matching V1 preview limited to already evidenced living and dining targets only. Bedroom and home-office/study remain out of this first execution package unless Sam explicitly adds them with exact project/room/user boundaries. | Yes |
| Project/room/user allowlist | Project IDs: `f66beecc-c011-43c7-9db7-ed59af879820` and `c0c9c62e-1062-409f-a624-18db550e7a69`. Room IDs: `45edb758-735b-4666-bb4b-b00b7cd61de5` and `1da580bf-9ad4-40fa-8ee6-420efbbc8ffb`. User/account allowlist: Sam must name the exact user ID, account ID, or email, or explicitly say `none` if the harness path does not require a user/account allowlist. | Yes |
| Environment | Recommended: `local QA only`. Sam may instead name `Vercel preview` or another explicit environment. No environment is approved until Sam chooses one. | Yes |
| App path | Recommended: `read-only/manual harness only`. Any app action path requires Sam to name the exact action and permission boundary. | Yes |
| Write boundary | Recommended: no draft shopping-list create/refresh writes; catalog writes forbidden; DB/schema/generated type changes forbidden; no other writes. Any permitted write must name the exact table/action and stop rule. | Yes |
| Stop rules | Stop immediately if any required role is missing, `closest_available`, invalid, outside its candidate pool, materially contradictory in color/material/category/scale when matching alternatives exist, or if QA artifacts do not include role pools, candidate counts, role status, confidence, dimension fit, evidence completeness, freshness, and warning details. | Yes |
| Rollback rules | Keep or reset Product Matching V1 and controlled-preview env values to false/empty; stop the preview run; do not reuse failed output for customer-facing shopping-list decisions; record the blocker in the next evidence note; ask Chief Architect for the next docs-only, QA-harness-only, or narrow scoring follow-up. | Yes |
| Evidence artifacts | Commit only evidence notes under `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/`, with selected products, role statuses, warning/blocker counts, role confidence, evidence completeness, dimension fit, catalog freshness, stop-rule outcome, and safe screenshots/contact sheets where approved. Raw local output may stay uncommitted if it contains unsafe or sensitive data. | Yes |
| Owner | Sam or a Sam-designated implementation owner must be named before execution. Chief Architect remains review/decision owner for post-run PR verdicts. | Yes |
| Expiration | Recommended: approval expires after one execution pass or 24 hours, whichever comes first. Sam may name a different expiration or review date. | Yes |

## Target Allowlist Details

The proposed first execution package is intentionally smaller than the full room readiness map. It uses only the two already evidenced targets from the Sam approval request:

| Target | Project | Project ID | Room | Room ID | Room type | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Living target | Claret Villa | `f66beecc-c011-43c7-9db7-ed59af879820` | Ground floor Lounge | `45edb758-735b-4666-bb4b-b00b7cd61de5` | Living Room | `manual-qa/2026-05-25-bounded-controlled-preview-evidence.md` |
| Dining target | Dubai South | `c0c9c62e-1062-409f-a624-18db550e7a69` | Ground Floor Dining Room | `1da580bf-9ad4-40fa-8ee6-420efbbc8ffb` | Dining Room | `manual-qa/2026-05-25-post-119-dining-re-evidence.md` |

Sam must explicitly confirm whether the preview is limited to these targets. If Sam wants a Claret Villa dining target instead of the evidenced Dubai South dining target, Sam must provide the exact Claret dining project ID, room ID, and concept/evidence reference before any configuration or execution.

## Post-PR #129 Warning State

PR #129 left Product Matching default-off and improved deterministic QA stop-rule warning specificity. Future QA artifacts should now surface:

- dimension warning detail, including missing product dimensions or oversized dimensions;
- catalog evidence completeness detail, including missing material, style/room, price, availability, or dimension fields;
- catalog freshness detail, including stale age/threshold or invalid timestamp text;
- supporting-role detail distinguishing missing supporting selection, closest-available fallback, empty pool, or color mismatch.

This warning burn-down improves reviewer visibility only. It does not clear the Sam approval gate, does not configure preview, does not execute preview, and does not permit app actions or writes.

## Non-Approval Defaults

Until every approval field is explicit:

- No controlled-preview configuration.
- No controlled-preview execution.
- No app-action execution.
- No allowlist expansion.
- No new preview targets.
- No draft shopping-list create/refresh.
- No catalog row writes.
- No runtime/env-default changes.
- No production flags or deploys.
- No DB/schema/generated type changes.
- No UI/prompt/payment/checkout changes.
- No Catalog-First runtime coupling.

## Pre-Execution Checklist

Before execution:

- Confirm Sam approval names scope, project IDs, room IDs, user/account allowlist, environment, app path, write boundary, stop rules, rollback rules, evidence artifacts, owner, and expiration.
- Confirm Product Matching remains default-off outside the named scope.
- Confirm environment and allowlist match the approval exactly.
- Confirm evidence artifact paths are ready and safe to commit.
- Confirm rollback owner and stop rules are understood.
- Confirm any raw output path will not be committed if it contains unsafe data or secrets.

During execution:

- Capture selected products, role confidence, warning/blocker counts, evidence completeness, dimension fit, catalog freshness, role pools, and candidate counts.
- Capture screenshots/contact sheets only where safe and within the approved environment.
- Stop immediately if a blocker appears outside the approved tolerance.
- Do not widen scope mid-run.
- Do not perform unapproved writes.

After execution:

- Record results in `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/`.
- Update `docs/Tracks/v2-commercial/process/product-matching-agent-comms.md`.
- Open a small evidence PR.
- Do not change runtime defaults, production flags, prompts, UI, schema, or Catalog-First coupling.

## Chief Architect Review Points

- Did the run stay within Sam's exact approval?
- Were any live writes performed?
- Did any required role regress to missing, `closest_available`, invalid, outside-pool, or contradictory?
- Are PR #129 warning details visible and specific in the evidence artifacts?
- Is a follow-up docs-only, QA-harness-only, or narrow scoring fix needed before any broader preview?
