# Product Matching Engine V1 Controlled Preview Activation Wiring

Runtime posture: Product Matching Engine V1 remains default-off. This PR prepares the controlled-preview gate only; it does not approve preview execution, deploy, production rollout, live catalog writes, shopping-list writes, prompt changes, UI changes, DB/schema changes, generated DB types, payment/checkout/app-action flow changes, or Catalog-First runtime coupling.

Source-of-truth decision package: `docs/Tracks/v2-commercial/product-matching-evals/2026-05-25-controlled-preview-decision-package.md` from PR #112.

## What This PR Wires

- Adds a controlled-preview allowlist gate around Product Matching V1 enablement.
- Keeps `RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED=false` as the default state.
- Requires explicit controlled-preview allowlist match when preview env is configured.
- Records non-secret gate metadata in the existing product sourcing `ai_jobs.input_summary` when the product sourcing action runs.
- Documents the operator checklist, stop/rollback rules, env handling, and evidence links for the next approval step.

This gate is deliberately request-scoped. It can match any of:

- project id
- room id
- user id
- user email

## Env Handling

Default state:

```bash
RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED=false
RITZY_PRODUCT_MATCHING_ENGINE_V1_CONTROLLED_PREVIEW_ENABLED=false
```

Controlled-preview configuration, only after separate Sam/Chief Architect approval:

```bash
RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED=true
RITZY_PRODUCT_MATCHING_ENGINE_V1_CONTROLLED_PREVIEW_ENABLED=true
RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_PROJECT_IDS=approved-project-id
RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_ROOM_IDS=approved-room-id
RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_USER_IDS=approved-user-id
RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_USER_EMAILS=approved-user@example.com
```

The allowlist variables are comma-separated. At least one project, room, user id, or user email must match for Product Matching V1 to activate when controlled-preview env is configured.

Do not print, paste, commit, screenshot, log, or store secret values in docs, PR comments, artifacts, mailbox files, or screenshots. The allowlist values above are examples only.

## Operator Checklist

Before enabling env:

- Confirm Sam/Chief Architect approval for the exact preview execution.
- Confirm the approved project, room, and operator identity.
- Confirm the execution environment is approved for controlled default-off preview.
- Confirm no production rollout, default-on activation, deploy, production flag, live catalog write, shopping-list write, DB/schema change, generated DB type change, UI redesign, prompt change, payment/checkout/app-action flow change, or Catalog-First runtime coupling is included.
- Load only the required env values from the approved source.
- Confirm `RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED` and `RITZY_PRODUCT_MATCHING_ENGINE_V1_CONTROLLED_PREVIEW_ENABLED` are not set outside the approved preview environment.

Before any run:

- Confirm the existing product sourcing path is allowed for that run. The current app product-grounding flow creates/refreshes draft shopping-list data after sourcing. This PR does not approve executing that write path.
- If shopping-list writes are not separately approved, use only read-only QA evidence paths and do not run the app action.
- Confirm the selected concept image exists and the room belongs to the approved project.
- Confirm evidence capture will omit secrets, signed URLs, and raw credentials.

During review:

- Inspect `productMatchingPreviewGate` in `ai_jobs.input_summary` if an approved run occurs.
- Confirm `productMatchingEngineEnabled` is true only for the allowlisted request.
- Inspect `roleCandidateCounts`, `rolePoolDiversity`, `rolePoolQuality`, `rolePoolQaRollup`, `roleStatuses`, `roleConfidence`, and `roleConfidenceGate`.
- Confirm required roles are `strong_match` or `acceptable_match`.
- Confirm no required role is `closest_available`, `missing_required`, invalid, contradictory, or outside its candidate pool.
- Treat dimensions, evidence completeness, freshness, material/color, and supporting-role issues as visible warnings unless they trigger the stop rules below.

After review:

- Save only non-secret evidence links and summaries.
- Do not reuse failed preview output for shopping-list or customer-facing decisions.
- Ask for a separate decision before widening scope, enabling default-on, deploying, writing catalog data, writing shopping-list data, changing prompts, changing UI, changing DB/schema/types, changing app-action/payment/checkout flow, or coupling Catalog-First runtime.

## Stop And Rollback Rules

Stop immediately if:

- A required role is `missing_required` or `closest_available`.
- A selected required product is outside its role candidate pool.
- A selected required product has contradictory category, color, material, or scale when matching alternatives exist.
- Required role pools are empty or unexpectedly weak without documented catalog reason.
- Required anchor freshness, evidence, dimensions, or availability are too weak for review confidence.
- `roleConfidenceGate.passesQaStopRules` is false.
- Evidence lacks enough metadata to reconstruct role pools, candidate counts, role statuses, role confidence, and warnings.
- Any requested next step requires production rollout, default-on activation, deploy, live catalog writes, shopping-list writes, DB/schema changes, generated DB types, UI redesign, prompt changes, payment/checkout/app-action flow changes, or Catalog-First runtime coupling without separate approval.

Rollback:

- Set or keep `RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED=false`.
- Set or keep `RITZY_PRODUCT_MATCHING_ENGINE_V1_CONTROLLED_PREVIEW_ENABLED=false`.
- Clear allowlist env values from the preview environment.
- Stop using any failed preview output.
- Record the blocker and ask Chief Architect whether the next step is docs-only, QA-harness-only, or a narrow scoring/runtime fix.

## Evidence Links

| Evidence | Use |
| --- | --- |
| `2026-05-25-controlled-preview-decision-package.md` | PR #112 source-of-truth decision package. |
| `2026-05-25-release-readiness-map.md` | Room-by-room rollout-readiness status and remaining gates. |
| `manual-qa/2026-05-23-post-105-fresh-qa.md` | Fresh living/bedroom required-role pass evidence with warnings. |
| `manual-qa/2026-05-24-timeout-payload-investigation.md` | Dining and home-office timeout clarification. |
| `manual-qa/2026-05-25-home-office-desk-role-quality-investigation.md` | Required desk role-quality fix evidence. |
| `manual-qa/2026-05-25-post-109-home-office-read-only-qa.md` | Representative home-office/study read-only QA evidence after PR #109. |

## Next Decision After Merge

WAITING_FOR_SAM_APPROVAL: after this PR merges, Sam/Chief Architect must explicitly approve whether to configure the controlled-preview env and whether any execution may use an app path that writes draft shopping-list data. If not approved, keep Product Matching V1 in read-only/local QA only.
