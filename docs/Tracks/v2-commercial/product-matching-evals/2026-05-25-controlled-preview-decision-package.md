# Product Matching Engine V1 Controlled Preview Decision Package

Runtime impact: none. This is a docs/artifacts-only go/no-go package updated after PR #122.

## Recommended Decision

Recommend: approve a tightly scoped controlled default-off preview for Product Matching Engine V1, subject to explicit Sam or Chief Architect approval outside this PR.

Rationale:

- Required-role blockers from the old PR #103 state have been cleared in the latest evidence chain.
- Living, dining, bedroom, and representative home-office/study evidence now pass required-role QA stop rules with warnings.
- Chief Architect accepted PR #121 as clearing the dining chair and over-table-lighting quality blocker for controlled default-off preview readiness in PR #122.
- The remaining warnings are visible review constraints, not current required-anchor blockers for a controlled internal preview.
- Product Matching V1 remains unsuitable for default-on, production rollout, unattended shopping-list writes, or customer-facing promises because dimensions, catalog evidence, supporting roles, and full home-office selected-concept coverage still need review.

This PR does not approve, enable, deploy, or wire the preview. It prepares the decision only.

## Preview Objective

Validate whether Product Matching V1 can support human-reviewed internal sourcing flows while default-off, with enough metadata for reviewers to accept, reject, or stop each run.

The preview should answer:

- Do required roles remain `strong_match` or `acceptable_match` across real room scenarios?
- Are missing/closest/invalid required roles caught before downstream use?
- Are warnings clear enough for an operator to decide whether product options need manual review?
- Does the existing fallback path remain available if the V1 run fails stop rules?

## Eligible Scenarios

Eligible only after explicit approval:

- Internal or Sam-approved projects only.
- One reviewed room per canonical type: living room, dining room, bedroom, and home-office/study.
- Rooms with an approved selected concept image and enough catalog candidates to build role-scoped pools.
- Local/preview QA process or explicitly approved preview environment only.
- Product Matching V1 enabled only for the approved preview execution path; normal runtime remains default-off.

## Excluded Scenarios

Do not include:

- Paid/customer-facing production sourcing.
- Any default-on or broad preview activation.
- App actions that write product selections, shopping-list rows, catalog records, or project state.
- Rooms with missing concept images.
- Rooms where required role pools are empty before visual sourcing.
- Scenarios that require prompt changes, UI changes, DB/schema changes, generated DB type changes, deploys, production flags, live writes, or Catalog-First runtime coupling.
- Any full E2E home-office selected-concept claim unless a real selected Ritzy-generated home-office concept is approved and passes the same stop rules.

## Operator Checklist

Before each run:

- Confirm approval source and preview scope.
- Confirm Product Matching V1 is still default-off outside the approved QA/preview process.
- Load only the approved local/preview QA credentials needed for reads and AI sourcing.
- Do not print, paste, commit, screenshot, or store secret values.
- Confirm no app action, catalog write, shopping-list write, DB/schema change, UI change, prompt change, deploy, production flag, or Catalog-First coupling is part of the run.
- Capture the room type, concept title/id when available, catalog candidate count, role pool count, and whether the concept image is real selected Ritzy output or representative/static evidence.

During review:

- Inspect `roleCandidateCounts`, `rolePoolDiversity`, `rolePoolQuality`, and `rolePoolQaRollup`.
- Inspect `roleStatuses`, `roleConfidence`, and `roleConfidenceGate`.
- Confirm required roles are `strong_match` or `acceptable_match`.
- Confirm selected required products are inside their role candidate pools.
- Confirm warnings are visible: dimensions, evidence completeness, freshness, material/color concerns, and supporting-role issues.
- Save only non-secret evidence in docs/artifacts.

After each run:

- Record pass/fail, blockers, warnings, selected required products, missing roles, and any retry use.
- Do not use preview output for shopping-list writes.
- If stop rules trigger, record the blocker and ask Chief Architect whether the next stage is docs-only, QA-harness-only, or a narrow scoring/runtime fix.

## Acceptable Warnings

These do not block a controlled default-off preview if they remain visible to operators:

- Missing room measurements causing required product dimension fit to be incomplete.
- Partial or weak catalog evidence for otherwise plausible required products.
- Supporting roles missing, acceptable, or closest-available when required anchors pass.
- Supporting lighting/decor/storage needing manual review.
- Same-target dining lighting no longer has the PR #117 `closest_available` floor-lamp blocker after PR #121, but lighting metadata can still be weak and must remain visible to operators.
- Home-office/study evidence still relying on a representative/static image, if the preview decision explicitly accepts that caveat.
- QA harness reproducibility work still pending, if runs are isolated and evidence is documented.

## Blocking Warnings And Stop Rules

Stop immediately if any occur:

- A required role is `missing_required`.
- A required role is `closest_available`.
- A required selected product is outside its supplied role candidate pool.
- A required selected product has contradictory category, color, material, or scale when matching alternatives exist.
- A required role pool is empty or unexpectedly weak without a documented catalog reason.
- `roleConfidenceGate.passesQaStopRules` is false.
- Required anchor freshness, evidence, dimensions, or availability are too weak for operator confidence.
- Evidence lacks enough metadata to reconstruct role pools, candidate counts, role statuses, role confidence, and warnings.
- Running the scenario would require live writes, deploys, production flags, DB/schema changes, generated DB types, UI changes, prompt changes, app-action flow changes, Catalog-First runtime coupling, live catalog writes, or shopping-list writes without separate approval.

## Required Env And Credential Handling

- Use only the approved local/preview QA credential source.
- Load only variables needed for the QA/preview process.
- Do not print, paste, commit, screenshot, or store secret values.
- Do not include secret values in docs, PR bodies, comments, screenshots, raw artifacts, mailbox files, or logs.
- Treat service-role credentials as read-only by process discipline: use selects/read-only QA code paths only, never writes.
- If the safe env source is missing, stop and report only which files/worktrees were checked, without revealing values.

## Evidence Links

| Evidence | Decision use |
| --- | --- |
| `2026-05-25-release-readiness-map.md` | Consolidated room-by-room status, warnings, gates, stop/rollback rules, and Catalog-First/Measurement wait states. |
| `manual-qa/2026-05-24-timeout-payload-investigation.md` | PR #108: dining and home-office completed in targeted read-only QA; timeout issue reduced to harness evidence quality. |
| `manual-qa/2026-05-25-home-office-desk-role-quality-investigation.md` | PR #109: deterministic desk scoring gap fixed while staying default-off. |
| `manual-qa/2026-05-25-post-109-home-office-read-only-qa.md` | PR #110: representative home-office/study QA passed with required desk `strong_match`, no required closest-available roles, and warnings. |
| `manual-qa/2026-05-25-bounded-dining-controlled-preview-evidence.md` | PR #117: same-target Dubai South dining evidence passed stop rules but exposed stool-like chair and over-table-lighting closest-available quality concerns. |
| `manual-qa/2026-05-25-dining-quality-investigation.md` | PR #119: narrow deterministic dining chair and over-table-lighting role-quality scoring fix. |
| `manual-qa/2026-05-25-post-119-dining-re-evidence.md` | PR #121: same-target dining re-evidence cleared the stool-like chair and floor-lamp closest-available concerns; accepted by Chief Architect in PR #122. |
| `manual-qa/2026-05-23-post-105-fresh-qa.md` | Fresh living and bedroom required-role pass evidence with warnings. |
| `manual-qa/2026-05-23-product-matching-engine-v1-evidence.md` | Initial living/dining/bedroom evidence and original blocker context. |
| `manual-qa/2026-05-23-post-105-validation-evidence.md` | Bedroom bedside-table blocker cleared under deterministic replay. |

## Downstream Sequencing

Next explicit approval gate: Sam or Chief Architect must decide whether to authorize controlled default-off preview configuration/execution from this evidence set. That decision must name the exact scope, environment, allowlist, app-path/writes boundary, and stop/rollback rules.

If Sam/Chief Architect approves controlled default-off preview:

1. Run the preview as evidence-gathering only.
2. Keep Product Matching V1 default-off outside the approved process.
3. Do not write shopping-list rows or catalog data from preview output.
4. Produce one evidence note per preview run.
5. Ask for a separate approval before any runtime wiring, app action, deployment, production flag, UI, prompt, DB/schema, generated DB type, or live write work.

If Sam/Chief Architect does not approve controlled default-off preview:

1. Keep V1 in local/manual QA only.
2. Prefer a QA-harness-only reproducibility PR next.
3. Only start a scoring/runtime fix if the decision identifies a specific blocker that requires it.

Catalog-First should wait until:

- controlled preview is explicitly approved or declined;
- Product Matching has a stable approved lower-level interface for retrieval, ranking, visual arbitration, confidence, and warning metadata;
- a specific Catalog-First runtime/integration scope is approved separately.

Measurement Intelligence should wait until:

- Sam approves any migrations, generated DB types, seed importer writes, or runtime prefill wiring;
- the controlled-preview decision states whether missing dimensions remain warning-only for internal preview;
- measurement confidence/provenance rules are reviewed enough to avoid overstating product fit.

## Not Approved Here

- No controlled-preview activation.
- No runtime wiring.
- No default-on activation.
- No production rollout.
- No production flags.
- No deploys.
- No app actions.
- No live writes.
- No catalog writes.
- No shopping-list writes.
- No DB/schema changes.
- No generated DB type changes.
- No UI changes.
- No prompt changes.
- No Catalog-First runtime coupling.
