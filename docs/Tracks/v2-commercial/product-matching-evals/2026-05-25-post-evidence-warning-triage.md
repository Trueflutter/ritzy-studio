# Product Matching Post-Evidence Warning Triage

Status: docs-only decision package. This file does not approve, configure, or execute any further controlled-preview activity.

## Source Evidence

| Source | Scope | Result |
| --- | --- | --- |
| PR #142 | Sam-approved local QA / read-only manual harness pass for Claret Villa / Ground floor Lounge and Dubai South / Ground Floor Dining Room only | Both targets passed stop rules with 0 blockers. |
| `manual-qa/2026-05-25-sam-approved-bounded-preview-evidence.md` | Committed evidence note from the one approved pass | Living had 13 warnings; dining had 8 warnings. |

The PR #142 pass used the approval once. It did not approve another execution pass, preview configuration, app actions, writes, allowlist expansion, production rollout, default-on activation, or runtime coupling.

## Warning Summary

| Target | Stop-rule result | Blockers | Warnings | Selected products | Required role outcome |
| --- | ---: | ---: | ---: | ---: | --- |
| Claret Villa / Ground floor Lounge | Pass | 0 | 13 | 6 | No missing, closest-available, invalid, empty-pool, or required color-mismatch roles. |
| Dubai South / Ground Floor Dining Room | Pass | 0 | 8 | 6 | No missing, closest-available, invalid, empty-pool, or required color-mismatch roles. |

The remaining issues are warning-class review work, not current QA stop-rule blockers for the two approved targets.

## Required-Role Warnings

| Target | Required role | Current selection | Warning class | Decision impact |
| --- | --- | --- | --- | --- |
| Living | Anchor seating | Lugano Modular Sofa | Missing product dimensions; partial catalog evidence. | Does not block by itself, but reviewer must confirm scale before customer-facing use. |
| Living | Coffee table | Colonial Coffee Table Bar | Weak material match; missing product dimensions; partial catalog evidence. | Watch item because material differs from the walnut/travertine cue. |
| Living | Generous rug | Soloni Looselay Rug Greige 300x400 cm | Missing dimensions in structured catalog fields; weak catalog evidence. | Likely visually plausible, but structured evidence is weak despite title size. |
| Dining | Dining table | Odren 6 seater dining table | Missing product dimensions; weak catalog evidence. | Does not block by itself, but table scale and evidence need review. |
| Dining | Dining chairs | Lourin Dining Arm Chair | Missing room measurements for fit check; weak color/material/style-room evidence. | Watch item because the chair is acceptable, not strong, and brass-detail fidelity is incomplete. |

No required role is currently missing, `closest_available`, invalid, outside its candidate pool, or materially contradictory when matching alternatives are visible in the committed evidence.

## Supporting-Role Warnings

| Target | Supporting role | Warning class | Decision impact |
| --- | --- | --- | --- |
| Living | Floor/table lighting | Weak material match. | Acceptable as a preview warning; review before use in a client-facing shopping list. |
| Living | Wall art/focal wall | No supporting product selected. | Non-blocking for required-role QA, but weakens room completeness. |
| Living | Mirror | No supporting product selected. | Non-blocking completeness warning. |
| Living | Curtains/textile layer | No supporting product selected. | Non-blocking completeness warning. |
| Living | Cushions/tray/ceramics/decor | No supporting product selected. | Non-blocking completeness warning. |
| Living | TV media console or built-in media unit | No supporting product selected. | Non-blocking completeness warning, but important for living-room usefulness. |
| Dining | Over-table lighting | Weak material match. | Improved versus earlier quality blockers, but material metadata still needs review. |
| Dining | Mirror | No supporting product selected. | Non-blocking completeness warning. |
| Dining | Restrained table decor | No supporting product selected. | Non-blocking completeness warning. |
| Dining | Curtains/textile layer | No supporting product selected. | Non-blocking completeness warning. |

The dominant supporting-role pattern is incomplete optional room dressing, especially wall decor, curtains/textiles, decor, and storage/media pieces.

## Dimension-Fit Warnings

| Target | Dimension issue | Affected selections | Suggested non-execution follow-up |
| --- | --- | --- | --- |
| Living | Missing product dimensions | Anchor seating, coffee table, generous rug, floor/table lighting. | QA-harness-only report improvement should separate missing structured dimensions from dimensions present in title text. |
| Living | Fit confirmed | Side or end tables. | No follow-up needed for this specific selection. |
| Dining | Missing product dimensions | Dining table, over-table lighting, sideboard/console, dining rug. | QA-harness-only report improvement should surface whether title-derived size exists even when structured fields are empty. |
| Dining | Missing room measurements | Dining chairs, art or mirror. | Docs-only decision should define whether missing room measurements can remain a preview warning for manually reviewed targets. |

Dimension warnings remain the clearest systematic issue. They do not currently show an oversized or impossible fit; they show insufficient structured evidence for confident automated fit checks.

## Catalog Evidence Completeness

| Target | Evidence pattern | Affected selections | Suggested follow-up |
| --- | --- | --- | --- |
| Living | Partial evidence | Anchor seating, secondary seating, coffee table, side/end table, floor/table lighting. | Improve reporting so missing fields are listed consistently by product and role. |
| Living | Weak evidence | Generous rug. | Data-quality follow-up may be useful if rugs repeatedly carry weak structured evidence despite useful title data. |
| Dining | Weak evidence | Dining table, dining chairs, over-table lighting, dining rug. | Highest-value burn-down candidate if Sam/Chief wants a non-execution QA/data-quality PR. |
| Dining | Partial evidence | Sideboard/console, art or mirror. | Lower priority than weak required-role evidence. |

The evidence has enough selected-product detail for human review, but it is not rich enough to support unattended shopping-list acceptance.

## Catalog Freshness Status

All selected products in the PR #142 evidence are marked `fresh`.

Catalog freshness is not the next blocker for the two approved targets. The more useful near-term burn-down is dimension and evidence completeness visibility, not freshness.

## Candidate-Pool Quality

| Target | Pool signal | Interpretation |
| --- | --- | --- |
| Living | 11 role-scoped pools, 3 required pools, 0 required empty pools, 3 weak required pools, 2 scattered required pools, manual review suggested. | Required coverage exists, but pool quality is mixed enough that human review should remain mandatory. |
| Dining | 9 role-scoped pools, 2 required pools, 0 required empty pools, 1 weak required pool, 1 scattered required pool, manual review suggested. | Required coverage exists; warning load is smaller than living but still not ready for unattended acceptance. |

Both targets have enough required-role candidate coverage to avoid stop-rule blockers in the approved evidence pass.

## Recommended Next Smallest Follow-Up

Recommended next step: **QA-harness-only report improvement**, default-off and non-execution, focused on deterministic warning visibility.

Suggested scope:

- Preserve current Product Matching behavior and stop rules.
- Improve committed or generated QA reports so warning classes are counted and grouped consistently by role, severity, and product.
- Split dimension warnings into `missing structured dimensions`, `title-derived dimensions present`, `missing room measurements`, and `fit checked`.
- Split catalog evidence warnings into missing color, material, style/room, dimension, price, availability, and image fields.
- Add a static fixture or replay test using PR #142-shaped output so the report stays deterministic.

Why this instead of another execution pass:

- Sam's one-pass approval has been used.
- Both approved targets passed stop rules, so there is no immediate narrow scoring blocker.
- The remaining risk is reviewer comprehension and evidence completeness, which can be reduced without app actions, writes, preview configuration, or new targets.

## Decision Guidance

| Option | Recommendation | Reason |
| --- | --- | --- |
| Docs-only decision | Acceptable if Sam/Chief only needs to decide whether warnings are tolerable. | Lowest risk, but does not improve future artifact quality. |
| QA-harness-only report improvement | Recommended. | Burns down the largest remaining warning-review risk without preview execution. |
| Narrow scoring/data-quality fix | Not recommended yet. | No current required-role stop-rule blocker from PR #142 requires scoring changes. |
| Wait for Sam | Required for any further controlled-preview execution/configuration. | The one approved pass is complete and expired by use. |

## Stop Rules

Do not run or configure preview, invoke app actions, expand allowlists, create or refresh draft shopping-list/catalog rows, change runtime/env defaults, DB/schema/generated types, UI, prompts, payment/checkout, production flags, deploys, live catalog writes, default-on activation, production rollout, or Catalog-First runtime coupling.
