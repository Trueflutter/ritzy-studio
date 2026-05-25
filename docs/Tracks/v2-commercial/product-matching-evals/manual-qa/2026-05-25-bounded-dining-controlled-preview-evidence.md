# Product Matching Engine V1 Bounded Dining Controlled Preview Evidence

Runtime impact: evidence capture only. Product Matching Engine V1 remains default-off globally.

## Scope

This is the one additional bounded controlled-preview dining evidence pass selected by Chief Architect in PR #116.

Hard boundaries honored:

- Controlled-preview env was configured only in the local QA process.
- Allowlist was limited to one project and one room.
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
- Existing app action was not invoked; no draft shopping-list rows were created or refreshed by this evidence run.

## Environment And Allowlist

- Date: 2026-05-25.
- Branch / commit: `codex/product-match-dining-preview-evidence` from `175e6b9`.
- Env source checked: `/Users/ayoolatoye/Documents/projects/ritzy-studio/.env.local`.
- Required variable names present: `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Secrets printed, committed, pasted, screenshotted, or stored: no.
- Product Matching V1 flag: `true` only inside the local QA process.
- Controlled-preview flag: `true` only inside the local QA process.
- Allowlist scope: one project id and one room id.
- Gate result: `configured=true`, `enabled=true`, `allowed=true`, `matchedScopes=["project","room"]`.
- Raw local output: `/tmp/product-matching-dining-preview-evidence-2026-05-25.json` (not committed).

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
| AI elapsed | 50.8s |
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
| Required partial evidence | 1 |
| Required weak evidence | 1 |
| Required empty pools | 0 |

Required-role warnings:

- Dining table: dimensions missing; weak catalog evidence.
- Dining chairs: room measurements missing, so fit cannot be checked; partial catalog evidence.

Supporting-role warnings:

- Over-table lighting: `closest_available`; selected product is a floor lamp, not a ceiling-mounted aged-brass chandelier.
- Mirror: missing supporting.
- Restrained table decor: missing supporting.
- Curtains/textile layer: missing supporting.

## Selected Required Products

| Required role | Product | Retailer | Status | Confidence tier | Evidence | Dimension fit | Freshness | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dining table | Odren 6 seater dining table | 2XL Home | `strong_match` | `strong` | `weak` | `missing_product_dimensions` | `fresh` | Model matched the marble top, cylindrical pedestal, and six-seat scale; catalog evidence and dimensions need reviewer confirmation. |
| Dining chairs | Salamanca Stool in Cream Pine and Medium Density Fibreboard, 127x82cm | Chattels & More | `acceptable_match` | `acceptable` | `partial` | `missing_room_measurements` | `fresh` | Cream upholstery direction fits, but the product name/shape reads stool or bench-like and lacks the exact high-back aged-brass chair detail; manual review is required before any use. |

## Supporting Products And Gaps

| Supporting role | Status | Notes |
| --- | --- | --- |
| Over-table lighting | `closest_available` | Floor lamp is not the specified aged-brass chandelier; do not treat as order-ready lighting. |
| Sideboard, credenza, or dining console | `strong_match` | Walnut console is visually plausible, with metadata warnings. |
| Dining rug | `strong_match` | Greige rug aligns with the concept direction, with metadata warnings. |
| Art or mirror | `strong_match` | Warm neutral carved wall panel is plausible as a traditional wall treatment. |
| Mirror | `missing_supporting` | Needs better candidate coverage or deliberate omission. |
| Restrained table decor | `missing_supporting` | Needs tabletop decor/accessory candidate coverage. |
| Curtains or textile layer | `missing_supporting` | Needs curtain/textile candidate coverage. |

## Decision

- QA outcome: pass for this one allowlisted dining-room controlled-preview evidence run, with warnings.
- Required anchors: pass; no required role was missing or closest-available.
- Controlled preview expansion allowed by this report: no.
- Production rollout allowed by this report: no.
- Default-on activation allowed by this report: no.
- Live catalog writes allowed by this report: no.
- Shopping-list output use allowed by this report: no.

## Rollback And Stop Recommendation

Rollback remains simple: keep or reset `RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED=false`, keep or reset `RITZY_PRODUCT_MATCHING_ENGINE_V1_CONTROLLED_PREVIEW_ENABLED=false`, and clear the preview allowlist env values.

Recommended next decision: Chief Architect should decide whether the next Product Matching stage is:

- another bounded evidence run for bedroom or home-office/study;
- a QA-harness-only reproducibility script for the controlled-preview evidence path;
- a narrow dining chair/supporting-lighting pool-quality investigation;
- or lane pause until Sam wants broader controlled-preview coverage.
