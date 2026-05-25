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
- `manual-qa/2026-05-23-post-103-validation-evidence.md`
- `manual-qa/2026-05-23-post-105-validation-evidence.md`
- `manual-qa/2026-05-23-post-105-fresh-qa.md`
- `manual-qa/2026-05-24-timeout-payload-investigation.md`
- `12_Product_Matching_Engine_PRD.md`

The manual QA pass was useful and directionally positive, but it did not satisfy the rollout stop rules.

Post-PR103 update: the bedside/side-table normalization fix correctly preserves bedroom-adjacent role categories such as `side_tables`, `bedside lighting`, and `bedroom rug`. The bedroom bedside-table blocker is still not cleared in retained QA evidence because the role result remains `missing_required` with `productId=null`. Product Matching Engine V1 therefore still needs a targeted role-result contract fix before controlled default-off preview testing.

Post-PR105 update: the selected-product to role-result contract repair clears that retained bedroom bedside-table blocker under deterministic replay. This does not change the rollout decision by itself because a complete fresh post-PR105 visual QA pass has not completed across all required room types and home-office coverage remains representative/static-image only.

Fresh post-PR105 QA update: living room and bedroom completed and passed the QA gate with warnings. The bedroom bedside-table blocker did not recur. Dining room and home-office/study timed out in the bounded local harness, so controlled default-off preview testing is still not approved.

Post-PR107 timeout investigation update: dining room and home-office/study both completed in a clean targeted local run with a QA-only 210-second timeout cap. Dining passed with warnings. Home office/study completed but still failed the QA stop rules because the required desk role was only `closest_available`. Controlled default-off preview testing is still not approved.

Post-option-1 desk role-quality update: the deterministic role-scoped desk scorer now rewards wood/oak/writing desk cues and penalizes metal/glass-only desks when those cues are requested. This clears a local scoring gap where a black metal office desk could outrank an oak writing desk for a wood home-office concept. Controlled default-off preview testing is still not approved until fresh read-only visual QA confirms the required desk role is no longer `closest_available` and the QA stop rules pass.

Post-PR109 home-office read-only QA update: fresh representative home-office/study visual QA against the external/static image probe passed the QA stop rules with warnings. The required desk role resolved as `strong_match`, required closest-available count was 0, missing required role count was 0, and blockers were 0. This clears the retained required-desk blocker for the representative read-only probe, but controlled default-off preview testing is still not approved because the run is not a full end-to-end Ritzy-generated selected concept and supporting decor plus required dimension/evidence warnings remain.

## Evidence Summary

| Area | Result | Readiness impact |
| --- | --- | --- |
| Living room beige/cream sofa fidelity | Passed | The known olive-sofa regression did not reproduce. |
| Dining chair role fidelity | Passed with review note | Dining chairs stayed inside the chair-compatible pool and did not select bulky armchairs. |
| Dining sideboard/storage | Partially passed | A low walnut TV-unit/console-like product was selected, but storage role metadata still needs review. |
| Bedroom required roles | Passed with warnings | Fresh post-PR105 QA selected both the bed and bedside tables with no QA blockers; dimension and catalog-evidence warnings remain. |
| Home office | Representative static-image probe passed with warnings | Post-PR109 external/static image QA passed the gate with the required desk as `strong_match`, but it is still not a full end-to-end Ritzy-generated project. |
| Fresh post-PR105 timeout coverage | Investigated | Dining and home-office/study completed in a clean targeted rerun; the prior timeout looks like QA harness evidence quality rather than a stable runtime defect. |
| Home-office required role quality | Representative probe cleared | Post-PR109 read-only QA confirmed the required desk role as `strong_match` with no required closest-available roles. Full E2E home-office coverage remains pending. |
| Catalog/measurement metadata | Warning-heavy | Required roles frequently had missing room measurements or partial/weak catalog evidence. |

## Stop Rules Triggered

The May 23 evidence triggers rollout stop rules:

- The original bedroom evidence triggered a required anchor/support role failure because bedside tables were required but marked missing by role confidence metadata.
- PR #103 fixed the category identity portion of the bedroom issue; PR #105 clears the retained role-result satisfaction issue under deterministic replay.
- The fresh post-PR105 bedroom run passed with warnings and selected the bedside tables successfully.
- The fresh post-PR105 dining and home-office/study runs timed out in the original bounded harness. A targeted follow-up rerun completed both scenarios, but home-office/study still failed because a required role was only `closest_available`. Post-PR109 read-only QA cleared that required-desk blocker for the representative external/static image probe.
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
| Bedroom representative QA completed | Pass with warnings | Fresh post-PR105 run selected bed and bedside tables with no QA blockers; dimension/evidence warnings remain. |
| Home office representative QA completed | Pass with warnings | Static external-image QA now passes after PR #109, with required desk `strong_match`; no real selected Ritzy-generated home-office concept has been tested. |
| Required roles pass QA stop rules | Partial/pass with warnings | Living, dining, bedroom, and representative home-office evidence now pass required-role stop rules with warnings. Full E2E home-office selected-concept coverage remains pending. |
| Evidence contains no prompt/runtime/UI/DB change | Pass with narrow scorer exception | The option-1 follow-up changes default-off domain role-scoped scoring only; no prompt, app-action, UI, DB/schema, production flag, deployment, live write, or Catalog-First coupling changes are approved. |

## Recommended Next Steps

1. Decide whether to add a QA-harness-only executable script improvement so future manual runs avoid non-canceling timeout evidence and can be reproduced without ad hoc `/tmp` runners.
2. Improve supporting-role adherence for lighting, storage/shelving, and decor if those remain closest-available or missing despite candidate coverage.
3. Continue catalog evidence and measurement enrichment so required anchor warnings become less frequent, especially office dimensions/material/color metadata.
4. Add or approve a real Ritzy-generated home-office QA scenario when writes are explicitly approved, then rerun visual arbitration against a selected concept image.
5. Require all four room types to complete and pass the QA gate before controlled default-off preview testing.

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
