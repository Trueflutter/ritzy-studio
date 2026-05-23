# Product Matching Engine V1 Rollout Readiness Decision

Runtime impact: none. This is a docs-only decision record.

## Decision

Product Matching Engine V1 needs targeted fixes before controlled default-off preview testing.

Do not enable Product Matching Engine V1 by default. Do not treat the May 23 manual QA evidence as approval for production rollout, broader preview use, or live catalog writes.

## Basis

This decision is based on:

- `PR_E_Runtime_Rollout_QA.md`
- `manual-qa/2026-05-23-product-matching-engine-v1-evidence.md`
- `manual-qa/2026-05-23-home-office-external-image-qa.md`
- `12_Product_Matching_Engine_PRD.md`

The manual QA pass was useful and directionally positive, but it did not satisfy the rollout stop rules.

## Evidence Summary

| Area | Result | Readiness impact |
| --- | --- | --- |
| Living room beige/cream sofa fidelity | Passed | The known olive-sofa regression did not reproduce. |
| Dining chair role fidelity | Passed with review note | Dining chairs stayed inside the chair-compatible pool and did not select bulky armchairs. |
| Dining sideboard/storage | Partially passed | A low walnut TV-unit/console-like product was selected, but storage role metadata still needs review. |
| Bedroom required roles | Blocked | `roleConfidenceGate.passesQaStopRules=false` because bedside tables were marked missing by the role contract. |
| Home office | Representative static-image probe passed with warnings | External/public image QA passed the gate with no blockers, but it was not a full end-to-end Ritzy-generated project and exposed supporting-role issues for lighting/decor. |
| Catalog/measurement metadata | Warning-heavy | Required roles frequently had missing room measurements or partial/weak catalog evidence. |

## Stop Rules Triggered

The May 23 evidence triggers rollout stop rules:

- Required anchor/support role failure: bedroom bedside tables were required but marked missing by role confidence metadata.
- `roleConfidenceGate.passesQaStopRules=false` for the bedroom scenario.
- Home office now has visual arbitration coverage only through a public/static external image, not a real selected Ritzy-generated concept.
- Required-role catalog evidence and dimension metadata produced warnings that should remain visible before wider preview.
- Supporting-role adherence remains weak in the home-office probe: task lighting was closest-available rather than a strong match, and desk decor was marked missing despite candidate coverage.

The bedroom result is not just a catalog miss. The selected product list contained a plausible bedside table, but the model returned role result metadata outside the exact role pool contract. The stricter validator correctly treated that role as missing. That is the behavior we want from the gate, but it means the current prompt/runtime contract is not ready for broader preview testing.

## Readiness Checklist

| Gate | Status | Notes |
| --- | --- | --- |
| Product Matching Engine V1 remains default-off | Pass | No production flag activation is authorized. |
| Runtime logging exists for role pools, confidence, and QA gate metadata | Pass | Existing default-off metadata is sufficient for local/manual review. |
| Living room representative QA completed | Pass | Beige/cream sofa and lighting were covered. |
| Dining room representative QA completed | Pass | Quantity-sensitive dining chairs and sideboard/storage were covered. |
| Bedroom representative QA completed | Blocked | Required bedside-table role failed the QA gate. |
| Home office representative QA completed | Partial | Static external-image QA passed with warnings, but no real selected Ritzy-generated home-office concept has been tested. |
| Required roles pass QA stop rules | Blocked | Bedroom `roleConfidenceGate` failed. |
| Evidence contains no prompt/runtime/UI/DB change | Pass | Evidence and this decision are docs/artifacts only. |

## Recommended Next Steps

1. Fix role-result contract adherence so model output mirrors supplied role pools exactly, especially category/role labels for bedroom bedside tables and supporting storage roles.
2. Improve supporting-role adherence for lighting, storage/shelving, and decor so models do not overuse closest-available lighting or mark populated supporting pools missing.
3. Continue catalog evidence and measurement enrichment so required anchor warnings become less frequent, especially office dimensions/material/color metadata.
4. Add or approve a real Ritzy-generated home-office QA scenario when writes are explicitly approved, then rerun visual arbitration against a selected concept image.
5. Rerun the manual QA report after targeted fixes and require all four room types to pass the QA gate before controlled default-off preview testing.

## NOT Approved

- No prompt changes in this PR.
- No runtime behavior changes in this PR.
- No default-on activation.
- No app-action wiring changes.
- No catalog-first coupling changes.
- No DB/schema changes.
- No live catalog writes, deployments, production flags, or paid/customer-facing rollout.

## Coordination Note

This decision does not pause the Product Matching Engine behind the catalog-first track. The evidence points to targeted Product Matching fixes and a remaining full-E2E home-office QA gap, not a need to wait for catalog-first generation.
