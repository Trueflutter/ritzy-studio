# Product Matching Engine V1 Release Readiness Map

Runtime impact: none. This is a docs/artifacts-only consolidation after PRs #108-#122.

## Decision Posture

Product Matching Engine V1 is closer to controlled default-off preview readiness, but this document does not approve controlled preview, production rollout, default-on activation, deploys, app actions, live catalog writes, shopping-list writes, DB/schema changes, UI changes, prompt changes, generated DB type changes, or Catalog-First runtime coupling.

The proposed decision is: Product Matching V1 may be considered for a tightly scoped controlled default-off preview only after Sam or Chief Architect explicitly approves that step outside this PR.

## Evidence Set

| Evidence | What it proves |
| --- | --- |
| `manual-qa/2026-05-23-product-matching-engine-v1-evidence.md` | Initial read-only visual QA: living and dining passed required-role gates; bedroom bedside role blocked; home-office had no real selected concept. |
| `manual-qa/2026-05-23-post-105-validation-evidence.md` | Deterministic replay showed the bedroom bedside-table role-result contract blocker cleared after PR #105. |
| `manual-qa/2026-05-23-post-105-fresh-qa.md` | Fresh living and bedroom visual QA passed with warnings; dining and home-office timed out in the original bounded harness. |
| `manual-qa/2026-05-24-timeout-payload-investigation.md` | PR #108 evidence: dining and home-office completed in a targeted read-only run; dining passed with warnings; home-office remained blocked by required desk `closest_available`. |
| `manual-qa/2026-05-25-home-office-desk-role-quality-investigation.md` | PR #109 evidence: deterministic desk role scoring gap fixed without enabling runtime behavior. |
| `manual-qa/2026-05-25-post-109-home-office-read-only-qa.md` | PR #110 evidence: representative home-office read-only visual QA passed with required desk `strong_match` and no required closest-available roles. |
| `manual-qa/2026-05-25-bounded-dining-controlled-preview-evidence.md` | PR #117 evidence: same Dubai South dining target passed required-role QA but surfaced dining-chair manual-review and over-table-lighting `closest_available` quality concerns. |
| `manual-qa/2026-05-25-dining-quality-investigation.md` | PR #119 evidence: deterministic dining chair and over-table-lighting role-quality scoring tightened while staying default-off. |
| `manual-qa/2026-05-25-post-119-dining-re-evidence.md` | PR #121 evidence: same Dubai South dining target passed after PR #119; chair selection moved from stool to dining arm chair and over-table lighting moved from floor lamp `closest_available` to chandelier `strong_match`. |

## Room-by-Room QA Status

| Room | Latest QA status | Blockers cleared | Remaining warnings | Blocks controlled default-off preview? | Evidence |
| --- | --- | --- | --- | --- | --- |
| Living room | Passed required-role QA with warnings. | Beige/cream sofa fidelity held; no olive-sofa regression; required anchor roles passed. | Required dimensions/evidence warnings; supporting wall art, decor, curtains, and TV/media storage remain incomplete or weak. | No, if preview is limited and warnings are visible in review artifacts. Supporting-role gaps should be monitored but are not current required-anchor blockers. | `manual-qa/2026-05-23-product-matching-engine-v1-evidence.md`, `manual-qa/2026-05-23-post-105-fresh-qa.md` |
| Dining room | Passed required-role QA with warnings after same-target post-PR119 re-evidence. | Dining timeout evidence cleared as a harness issue; PR #121 cleared the PR #117 stool-like dining chair selection and over-table-lighting floor-lamp `closest_available` issue for the same Dubai South target. | Required dimension/evidence warnings remain; supporting mirror, restrained table decor, and curtains/textile layer remain missing; lighting still has weak material metadata. | No, if preview reviewers must inspect metadata/supporting warnings before accepting sourced options. | `manual-qa/2026-05-23-product-matching-engine-v1-evidence.md`, `manual-qa/2026-05-24-timeout-payload-investigation.md`, `manual-qa/2026-05-25-bounded-dining-controlled-preview-evidence.md`, `manual-qa/2026-05-25-dining-quality-investigation.md`, `manual-qa/2026-05-25-post-119-dining-re-evidence.md` |
| Bedroom | Passed required-role QA with warnings. | Bedside-table blocker cleared: PR #105 repaired selected-product to role-result satisfaction, and fresh QA did not reproduce the missing required bedside-table issue. | Required bed and bedside table dimension/evidence warnings; supporting headboard, bedside lighting, bedding/textile layer, and curtains/window treatment need manual review. | No, if preview remains human-reviewed and dimension/evidence warnings remain visible. | `manual-qa/2026-05-23-post-105-validation-evidence.md`, `manual-qa/2026-05-23-post-105-fresh-qa.md` |
| Home-office/study | Representative external/static image QA passed with warnings after PR #109. | Timeout blocker cleared by PR #108; required desk `closest_available` blocker cleared by PR #109/#110; post-PR109 read-only QA returned desk `strong_match`, missing required count 0, required closest-available count 0. | Not a full end-to-end Ritzy-generated selected concept; required desk/chair dimension and catalog-evidence warnings remain; supporting desk decor remains missing; task lighting is acceptable, not dedicated desk-lamp fidelity. | Yes for broad preview. No for a narrow explicitly approved preview if Chief Architect accepts representative-static home-office coverage and requires manual review of the remaining warnings. | `manual-qa/2026-05-24-timeout-payload-investigation.md`, `manual-qa/2026-05-25-home-office-desk-role-quality-investigation.md`, `manual-qa/2026-05-25-post-109-home-office-read-only-qa.md` |

## Blockers Cleared Since The Old PR #103 State

- Bedroom role category identity: PR #103 fixed `side_tables`, `bedside lighting`, and `bedroom rug` category normalization.
- Bedroom required bedside-table role satisfaction: PR #105 cleared the retained selected-product/role-result contract blocker under deterministic replay; fresh post-PR105 bedroom QA passed required-role gates.
- Dining/home-office timeout ambiguity: PR #108 showed both scenarios complete in a clean targeted run; the prior timeout is treated as QA harness evidence quality, not a stable runtime defect.
- Home-office required desk quality: PR #109 fixed the deterministic wood/oak/writing desk scoring gap; PR #110 fresh read-only QA confirmed required desk `strong_match`.
- Dining chair and over-table-lighting quality: PR #119 tightened deterministic role-quality scoring; PR #121 confirmed the same target moved from stool-like chair to dining arm chair and from floor-lamp `closest_available` to chandelier `strong_match`. Chief Architect accepted this as clearing the dining quality blocker for controlled default-off preview readiness in PR #122.

## Remaining Warnings

| Warning | Current interpretation | Blocks controlled default-off preview? |
| --- | --- | --- |
| Required role dimensions are often missing because room measurements are absent. | Product fit cannot be fully checked, especially for anchor furniture. Preview reviewers must treat this as a visible warning and not a fit guarantee. | No for controlled default-off preview; yes for production/default-on or any unattended shopping-list write. |
| Required catalog evidence is partial or weak for some selected products. | Product card metadata is good enough for QA, but not enough to promise durable stock/fit certainty. | No for controlled preview with human review; yes for production/default-on. |
| Supporting roles can be missing or acceptable rather than strong. | Decor, wall/background, TV/media storage, curtains, mirror, desk decor, and some lighting metadata need manual review and future quality passes. Dining over-table lighting no longer has the same-target `closest_available` floor-lamp blocker after PR #121. | No if supporting gaps are surfaced and do not block required anchors; yes if Sam requires complete-room sourcing before preview. |
| Home-office coverage is representative/static-image, not a real Ritzy-generated selected concept. | The required desk blocker is cleared for the representative probe, but full E2E home-office evidence is still missing. | Blocks broad preview. A narrow controlled preview can proceed only if explicitly accepted by Sam/Chief Architect with this caveat. |
| QA harness is still ad hoc for fresh visual runs. | Evidence has been produced safely, but a reproducible QA-only runner would reduce future ambiguity. | No for decision prep; recommended before repeated preview cycles. |

## Exact Remaining Gates Before Controlled Preview

Controlled default-off preview must not begin until all are true:

1. Sam or Chief Architect explicitly approves the next controlled default-off preview gate in a separate decision.
2. Product Matching V1 remains default-off in normal runtime and is enabled only for the approved preview surface or QA process.
3. Preview scope is limited to internal/Sam-approved projects, not paid/customer-facing production rollout.
4. No app-action writes, shopping-list writes, live catalog writes, DB/schema changes, generated DB type changes, prompt changes, UI changes, deploys, production flags, or Catalog-First runtime coupling are included unless separately approved.
5. Reviewer-facing evidence includes role pools, selected products, missing roles, role statuses, role confidence, QA stop-rule output, dimension fit, catalog evidence completeness, freshness, and warnings.
6. Required roles must be `strong_match` or `acceptable_match`; no required role may be `missing_required`, `closest_available`, invalid, outside its candidate pool, or contradictory in color/material when alternatives exist.
7. Any generated home-office selected-concept preview must be treated as fresh evidence and must pass the same required-role gates before it is cited as full E2E home-office coverage.
8. A rollback path exists: unset/keep false `RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED`, stop the preview, and fall back to the existing non-V1 sourcing path.

## Proposed Controlled Default-Off Preview Plan

This plan is a proposal only. It does not enable preview.

1. Keep `RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED=false` by default.
2. Select one internal/Sam-approved project per room type: living, dining, bedroom, and home-office/study. If no real home-office selected concept exists, either defer home-office full E2E proof or ask for explicit approval before creating/seeding one.
3. Run Product Matching V1 only in a controlled local/preview QA process or explicitly approved preview environment.
4. Capture one evidence report per run using `MANUAL_QA_REPORT_TEMPLATE.md`.
5. Stop immediately if any required role is missing, closest-available, invalid/outside-pool, or materially contradictory.
6. Treat supporting-role issues as visible manual review warnings unless they affect required anchors or Sam decides complete-room sourcing is required.
7. Do not write shopping-list rows from preview output. Product choices remain review artifacts until a separate shopping-list write approval exists.
8. After the preview pass, publish a decision record that either approves the next preview increment, requests a QA-harness-only improvement, or assigns a narrow supporting-role quality fix.

## Recommended Next Explicit Approval Gate

Recommended next gate: `WAITING_FOR_SAM_APPROVAL`.

Sam or Chief Architect should explicitly decide whether to authorize a controlled default-off preview configuration/execution plan using the current evidence set. That approval must name the exact scope, environment, allowlist, whether any app path may be used, and whether writes remain prohibited. Until then, Product Matching V1 remains docs/QA evidence only.

## Stop And Rollback Rules

Stop preview or QA escalation immediately if:

- A required role is `missing_required` or `closest_available`.
- A selected required product is outside its role candidate pool.
- A selected required product has contradictory category, color, material, or scale when matching alternatives exist.
- Required role pools are empty or unexpectedly weak without documented catalog reason.
- Required anchor freshness, evidence, dimensions, or availability are too weak for review confidence.
- `roleConfidenceGate.passesQaStopRules` is false.
- `ai_jobs` or QA artifacts do not include enough metadata to reconstruct role pools, candidate counts, role statuses, role confidence, and warnings.
- Any path would require live catalog writes, shopping-list writes, production flags, DB/schema changes, UI changes, prompt changes, app-action flow changes, deploys, or Catalog-First runtime coupling without explicit approval.

Rollback means:

- Keep or reset `RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED=false`.
- Do not reuse failed preview output for shopping-list or customer-facing decisions.
- Record the blocker in the next evidence note.
- Ask Chief Architect whether the next follow-up is docs-only, QA-harness-only, or a narrow scoring/runtime fix.

## Catalog-First And Measurement Wait State

Catalog-First should wait on:

- explicit approval for a runtime/integration PR;
- a stable Product Matching interface for role-scoped retrieval, ranking, visual arbitration, confidence, and warning metadata;
- a controlled preview decision that confirms Product Matching V1 is acceptable as the lower-level matching layer;
- a no-write boundary unless shopping-list/catalog writes are separately approved.

Catalog-First should not duplicate Product Matching retrieval, ranking, visual arbitration, confidence, or fallback logic while this decision is pending.

Measurement Intelligence should wait on:

- explicit approval before migrations, generated DB types, seed importer writes, or runtime measurement-prefill wiring;
- a decision about whether missing dimensions remain warning-only for controlled preview or become preview blockers for specific room/product classes;
- reviewed measurement source/provenance rules before any fit-sensitive default behavior.

Measurement work can continue in docs/domain dry-run form, but it should not make Product Matching fit decisions stronger than the available room measurements justify.
