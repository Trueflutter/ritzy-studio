# Product Matching Engine V1 Post-119 Dining Re-Evidence

Runtime impact: evidence capture only. Product Matching Engine V1 remains default-off globally.

## Scope

This is the one bounded same-target dining re-evidence pass selected by Chief Architect in PR #120 after the narrow dining role-quality changes in PR #119.

Hard boundaries honored:

- Same target only: Dubai South / Ground Floor Dining Room from PR #117.
- Controlled-preview env was configured only in the local QA process.
- Allowlist was limited to one project id and one room id.
- Existing app action was not invoked.
- No draft shopping-list rows were created or refreshed.
- No production rollout.
- No default-on activation.
- No broad deploy or production flag change.
- No live catalog writes.
- No DB/schema changes.
- No generated DB types.
- No UI changes.
- No prompt changes.
- No payment or checkout changes.
- No Catalog-First runtime coupling.

## Environment And Allowlist

- Date: 2026-05-25.
- Branch / base: `codex/product-match-dining-re-evidence` from `main` at PR #120 merge commit `0b86be3`.
- Env source checked: `/Users/ayoolatoye/Documents/projects/ritzy-studio/.env.local`.
- Required variable names present: `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Secrets printed, committed, pasted, screenshotted, or stored: no.
- Product Matching V1 flag: `true` only inside the local QA process.
- Controlled-preview flag: `true` only inside the local QA process.
- Allowlist scope: one project id and one room id.
- Gate result: `configured=true`, `enabled=true`, `allowed=true`, `matchedScopes=["project","room"]`.
- Raw local output: `/tmp/product-matching-dining-re-evidence-2026-05-25.json` (not committed).

## Request Scope

| Field | Value |
| --- | --- |
| Project | Dubai South |
| Project ID | `c0c9c62e-1062-409f-a624-18db550e7a69` |
| Room | Ground Floor Dining Room |
| Room ID | `1da580bf-9ad4-40fa-8ee6-420efbbc8ffb` |
| Room type | Dining Room |
| Concept | Refined Traditional Dining - Warm Neutrals with Aged-Brass Accents |
| Concept ID | `b31cf586-629f-46db-9bae-db116533328c` |

## Input Metadata

| Field | Value |
| --- | ---: |
| Catalog rows queried | 1000 |
| Eligible catalog candidates after filtering | 975 |
| Sourcing candidates sent to AI | 36 |
| Blueprint role count | 9 |
| Role-scoped pools supplied | 9 |
| Required role pools | 2 |
| Required empty pools | 0 |
| Required weak pools | 1 |
| Required scattered pools | 1 |
| Manual review suggested by pool rollup | true |
| AI elapsed | 43.0s |
| Model | `gpt-5-mini` |
| Prompt key/version | `sourcing.concept_visual_product_match` / `2026-05-22.1` |

## QA Stop-Rule Result

| Field | Value |
| --- | ---: |
| `passesQaStopRules` | true |
| Blockers | 0 |
| Warnings | 8 |
| Missing required roles | 0 |
| Required closest-available roles | 0 |
| Invalid selections | 0 |
| Required color mismatches | 0 |
| Required weak material matches | 0 |
| Required missing dimensions | 2 |
| Required partial evidence | 0 |
| Required weak evidence | 2 |
| Required empty pools | 0 |

Required-role warnings:

- Dining table: dimensions missing; weak catalog evidence.
- Dining chairs: room measurements missing, so fit cannot be checked; weak catalog evidence.

Supporting-role warnings:

- Over-table lighting: weak material metadata warning remains, but status is `strong_match` and the selected product is a chandelier.
- Mirror: missing supporting.
- Restrained table decor: missing supporting.
- Curtains/textile layer: missing supporting.

## Selected Required Products

| Required role | Product | Retailer | Status | Confidence tier | Evidence | Dimension fit | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dining table | Odren 6 seater dining table | 2XL Home | `strong_match` | `strong` | `weak` | `missing_product_dimensions` | Same required table anchor as PR #117; catalog evidence and dimensions still need reviewer confirmation. |
| Dining chairs | Lourin Dining Arm Chair | 2XL Home | `acceptable_match` | `acceptable` | `weak` | `missing_room_measurements` | The previous stool/bench-like selection is no longer selected. Chair role still carries metadata weakness reasons from the role pool, so manual QA remains useful before order-ready use. |

## Supporting Products And Gaps

| Supporting role | Status | Product / gap | Notes |
| --- | --- | --- | --- |
| Over-table lighting | `strong_match` | Javi 6-Lights Linen Chandelier, 2XL Home | Closest-available floor-lamp warning from PR #117 is cleared for this same target. Metadata still reports weak material evidence because catalog fields are incomplete. |
| Sideboard, credenza, or dining console | `strong_match` | Lantine Walnut Veneer TV Unit, Large Size, Chattels & More | Still visually plausible, with metadata warnings. |
| Dining rug | `strong_match` | Soloni Looselay Rug Greige - 300X400 cm, 2XL Home | Still aligned with the concept direction, with metadata warnings. |
| Art or mirror | `strong_match` | Souq DESIGNS Wooden Wall Panel White - Set of 3 Large Wood Panels, Danube Home | Still plausible as a warm neutral wall treatment, with metadata warnings. |
| Mirror | `missing_supporting` | Gap | Needs better candidate coverage or deliberate omission. |
| Restrained table decor | `missing_supporting` | Gap | Needs tabletop decor/accessory candidate coverage. |
| Curtains or textile layer | `missing_supporting` | Gap | Needs curtain/textile candidate coverage. |

## Comparison Against PR #117

| Check | PR #117 evidence | Post-PR119 re-evidence |
| --- | --- | --- |
| QA stop rules | Passed with 0 blockers and 8 warnings | Passed with 0 blockers and 8 warnings |
| Required closest-available roles | 0 | 0 |
| Dining chair selected product | Salamanca Stool in Cream Pine and Medium Density Fibreboard, Chattels & More | Lourin Dining Arm Chair, 2XL Home |
| Dining chair status | `acceptable_match`; manual review required because product name/shape read stool or bench-like | `acceptable_match`; stool/bench selection cleared, but weak catalog evidence and missing room measurements remain warnings |
| Over-table lighting selected product | Floor lamp; `closest_available`; not order-ready over-table lighting | Javi 6-Lights Linen Chandelier; `strong_match`; closest-available floor-lamp issue cleared |
| Missing supporting roles | Mirror, restrained table decor, curtains/textile layer | Mirror, restrained table decor, curtains/textile layer |

## Decision

- QA outcome: pass for this one allowlisted dining-room re-evidence run, with warnings.
- Dining chair blocker/warning under review: improved. The prior stool/bench-like selection is cleared on the same target.
- Over-table-lighting closest-available warning under review: improved. The prior floor-lamp closest-available result is cleared on the same target.
- Remaining warnings are metadata/supporting coverage warnings, not controlled default-off preview blockers by themselves.
- Controlled preview expansion allowed by this report: no.
- Production rollout allowed by this report: no.
- Default-on activation allowed by this report: no.
- Live catalog writes allowed by this report: no.
- Shopping-list output use allowed by this report: no.

## Recommended Next State

Recommended next durable state after this PR: `WAITING_FOR_CHIEF_ARCHITECT`.

Chief Architect should decide whether the post-PR119 same-target dining evidence is sufficient to clear the dining quality blocker for controlled default-off preview readiness, or whether another bounded evidence pass or a docs-only readiness update is needed.

Rollback remains simple: keep or reset `RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED=false`, keep or reset `RITZY_PRODUCT_MATCHING_ENGINE_V1_CONTROLLED_PREVIEW_ENABLED=false`, and clear the preview allowlist env values.
