# Product Matching Engine V1 Rollout Readiness Decision

Runtime impact: none. This is a docs-only decision record.

## Current Decision

Product Matching Engine V1 is not approved for default-on activation, production rollout, live catalog writes, shopping-list writes, deployments, production flags, app-action flow changes, prompt changes, UI changes, DB/schema changes, generated DB type changes, or Catalog-First runtime coupling.

After PRs #108-#110, the earlier PR #103-era blockers have been reduced to warning and decision-gate items:

- Bedroom bedside-table required-role blocker: cleared by PR #105 validation and fresh bedroom QA.
- Dining/home-office timeout ambiguity: cleared as a QA-harness evidence issue by PR #108.
- Home-office required desk `closest_available` blocker: cleared for the representative read-only external/static image probe by PRs #109 and #110.

Controlled default-off preview is still not approved inside this PR. The current evidence is sufficient to prepare a controlled-preview decision, but Sam or Chief Architect must approve that preview separately.

For the consolidated room-by-room map, proposed preview plan, remaining warnings, exact gates, and stop/rollback rules, see `2026-05-25-release-readiness-map.md`.

## Basis

This decision is based on:

- `PR_E_Runtime_Rollout_QA.md`
- `2026-05-25-release-readiness-map.md`
- `manual-qa/2026-05-23-product-matching-engine-v1-evidence.md`
- `manual-qa/2026-05-23-home-office-external-image-qa.md`
- `manual-qa/2026-05-23-post-103-validation-evidence.md`
- `manual-qa/2026-05-23-post-105-validation-evidence.md`
- `manual-qa/2026-05-23-post-105-fresh-qa.md`
- `manual-qa/2026-05-24-timeout-payload-investigation.md`
- `manual-qa/2026-05-25-home-office-desk-role-quality-investigation.md`
- `manual-qa/2026-05-25-post-109-home-office-read-only-qa.md`
- `12_Product_Matching_Engine_PRD.md`

## Evidence Summary

| Area | Latest result | Readiness impact |
| --- | --- | --- |
| Living room beige/cream sofa fidelity | Passed with warnings | No olive-sofa regression in retained evidence; supporting roles and metadata still need review. |
| Dining chair role fidelity | Passed with warnings | Dining chairs stayed inside the chair-compatible pool and did not select bulky armchairs; lighting/storage warnings remain. |
| Bedroom required roles | Passed with warnings | Bed and bedside tables pass required-role gates; dimension and catalog-evidence warnings remain. |
| Home-office/study required desk | Representative probe passed with warnings | Required desk resolved as `strong_match` after PR #109/#110; full E2E selected Ritzy-generated home-office concept coverage remains pending. |
| Timeout evidence | Investigated | PR #108 reduced the dining/home-office timeout issue to QA-harness evidence quality rather than a stable runtime defect. |
| Catalog/measurement metadata | Warning-heavy | Required roles frequently have missing room measurements or partial/weak catalog evidence. This is warning-only for decision prep, but not acceptable for default-on/production. |

## Remaining Gates Before Controlled Preview

Controlled default-off preview must wait for explicit Sam or Chief Architect approval and must honor the gates in `2026-05-25-release-readiness-map.md`.

The minimum gates are:

1. Product Matching V1 remains default-off outside the approved preview or QA process.
2. Required roles in preview evidence must be `strong_match` or `acceptable_match`.
3. No required role may be missing, closest-available, invalid, outside its candidate pool, or materially contradictory.
4. Dimension, catalog evidence, and supporting-role warnings must be visible to reviewers and not silently treated as production-safe.
5. No live writes, deploys, flags, schema changes, UI changes, prompt changes, app-action flow changes, Catalog-First runtime coupling, or shopping-list writes are included without separate approval.

## NOT Approved

- No controlled default-off preview approval in this PR.
- No production rollout.
- No default-on activation.
- No prompt changes.
- No runtime behavior changes.
- No app-action wiring changes.
- No Catalog-First coupling changes.
- No DB/schema or generated DB type changes.
- No UI changes.
- No live catalog writes, shopping-list writes, deployments, production flags, or paid/customer-facing rollout.

## Coordination Note

Catalog-First and Measurement should wait on the explicit gates listed in `2026-05-25-release-readiness-map.md`. They can continue docs/domain dry-run work, but should not wire runtime behavior, duplicate Product Matching retrieval/ranking/visual arbitration, strengthen fit decisions beyond available measurement confidence, or write live data before the controlled-preview decision is approved separately.
