# Product Matching Engine Runtime Rollout QA

## Purpose

PR E keeps the Product Matching Engine V1 off by default while making it safe to run in local/manual QA.

## Local Enablement

Set this only in a local or preview QA environment:

```bash
RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED=true
```

Production must remain unset or explicitly `false` until Sam approves visual QA.

For controlled preview after PR #112, also require the request-scoped allowlist gate:

```bash
RITZY_PRODUCT_MATCHING_ENGINE_V1_CONTROLLED_PREVIEW_ENABLED=true
RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_PROJECT_IDS=approved-project-id
RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_ROOM_IDS=approved-room-id
RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_USER_IDS=approved-user-id
RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_USER_EMAILS=approved-user@example.com
```

At least one allowlist value must match the request project, room, user id, or user email. Do not execute any app path that writes draft shopping-list data unless Sam/Chief Architect separately approves that execution. For no-write evidence, use only the approved read-only QA path.

## Executable Gates

Run:

```bash
pnpm --filter @ritzy-studio/domain test
pnpm --filter @ritzy-studio/ai test
```

The domain test includes fixed rollout scenarios for:

- beige or cream linen sofa over olive velvet sofa
- dining chairs over bulky lounge armchairs
- TV media console over generic bookcase
- ivory upholstered bedroom bed
- oak home office desk

See `README.md` in this directory for the expanded deterministic eval harness and scorecard semantics.

The AI test includes the wrong-role product ID gate: a globally valid product ID returned for the wrong role is treated as missing for that role.

## Manual QA Checks

After a local sourcing run, inspect the latest `ai_jobs` row for `job_type = product_visual_sourcing`.

Check `input_summary`:

- `productMatchingEngineEnabled` is `true`
- `roleCandidateCounts` exists
- `rolePoolDiversity` exists and required pools are not unexpectedly `scattered`
- `rolePoolQuality` exists and required pools are not `empty` or unexpectedly `weak`
- `rolePoolQaRollup` exists; `manualReviewSuggested` is a logging convenience, not an automatic stop rule
- required role pools have candidate counts above zero
- rejection and weakness reasons look plausible

Check `output_summary`:

- `roleStatuses` exists
- `roleConfidence` exists
- `roleConfidenceGate` exists and `passesQaStopRules` is `true`
- required anchor roles are `strong_match` or `acceptable_match`
- missing roles are explicit
- selected products with `invalid_selection`, `missing`, or `hasColorMismatch` are treated as QA blockers for required anchors
- selected products with `hasWeakMaterialMatch` are reviewed as QA warnings unless Sam decides the material is contradictory
- selected products with oversized or missing `selectedProductDimensionFit` metadata are reviewed as QA warnings; they do not automatically block Product Matching Engine V1 while the gate remains in local/manual QA
- selected products with partial or weak `selectedProductEvidenceCompleteness` metadata are reviewed as QA warnings; the field is a catalog-evidence completeness check, not a freshness or dimension-fit replacement
- selected products with stale, missing, or invalid `selectedProductFreshness` are catalog timestamp warnings; they do not prove live retailer stock
- retry paths are visible when used

## Stop Rules

Do not enable production if any of these occur:

- required anchors are `missing_required`
- required anchors are only `closest_available`
- a role status references a product outside that role's candidate pool
- anchor color or material contradicts the concept when matching alternatives exist
- required role pools are empty
- catalog coverage is stale, unavailable, or too weak for anchor products
- selected anchor product dimensions are missing or appear oversized for the entered room measurements
- selected anchor products lack enough catalog evidence for price, availability, image, color, material, style, room, or dimensions
- `roleConfidenceGate.passesQaStopRules` is `false` for required anchors
- `ai_jobs` logs do not show candidate counts, role pool diversity, role pool quality, role pool QA rollup, missing roles, retry use, selected statuses, role confidence, evidence completeness, dimension fit, catalog timestamp freshness, and QA stop-rule status clearly
