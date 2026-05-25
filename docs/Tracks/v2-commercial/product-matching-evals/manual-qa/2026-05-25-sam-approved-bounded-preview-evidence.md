# Product Matching Engine V1 Sam-Approved Bounded Preview Evidence

Runtime impact: evidence capture only. Product Matching Engine V1 remains default-off globally.

## Scope

Sam approved one bounded local QA / read-only manual harness execution pass for the two already evidenced targets only:

| Target | Project | Project ID | Room | Room ID | Room type |
| --- | --- | --- | --- | --- | --- |
| Living target | Claret Villa | `f66beecc-c011-43c7-9db7-ed59af879820` | Ground floor Lounge | `45edb758-735b-4666-bb4b-b00b7cd61de5` | Living Room |
| Dining target | Dubai South | `c0c9c62e-1062-409f-a624-18db550e7a69` | Ground Floor Dining Room | `1da580bf-9ad4-40fa-8ee6-420efbbc8ffb` | Dining Room |

This evidence pass did not configure production preview, invoke app actions, create or refresh draft shopping-list rows, write catalog data, change DB/schema/generated types, change runtime/env defaults, change UI/prompts/payment/checkout, deploy, change production flags, expand allowlists, or add Catalog-First runtime coupling.

## Environment And Run Boundary

- Date: 2026-05-25.
- Execution branch/base: `codex/product-match-sam-approved-evidence` from `origin/main` at `a50bcca`; branch was fast-forwarded to `d7a38c0` before opening the evidence PR.
- Environment: local QA only.
- App path: read-only/manual harness only.
- Env source checked: `/Users/ayoolatoye/Documents/projects/ritzy-studio/.env.local`.
- Required variable names present: `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Secrets printed, committed, pasted, screenshotted, or stored: no.
- Product Matching V1 flag: `true` only inside the local QA process.
- Controlled-preview flag: `true` only inside the local QA process.
- Allowlist scope: exactly the two approved project IDs and two approved room IDs.
- User/account allowlist: none used by the read-only manual harness; project and room scopes matched.
- Gate result for each target: `configured=true`, `enabled=true`, `allowed=true`, `matchedScopes=["project","room"]`.
- Raw local output: `/tmp/product-matching-sam-approved-evidence-2026-05-25.json` (not committed).
- Screenshots/contact sheets: not captured or committed.

## Pass Summary

| Target | QA stop rules | Blockers | Warnings | Selected products | AI elapsed | Prompt |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Living target | Pass | 0 | 13 | 6 | 61.0s | `sourcing.concept_visual_product_match` / `2026-05-22.1` |
| Dining target | Pass | 0 | 8 | 6 | 50.8s | `sourcing.concept_visual_product_match` / `2026-05-22.1` |

The pass completed both approved targets. No stop rule triggered.

## Living Target

Request scope:

| Field | Value |
| --- | --- |
| Project | Claret Villa |
| Room | Ground floor Lounge |
| Room type | Living Room |
| Concept | Warm-Contemporary Plan: Dining Behind the Sofa - Balanced Daylight & Sightlines |
| Concept ID | `ff561a77-0e31-41a2-95a9-d66be9782991` |

Input metadata:

| Field | Value |
| --- | ---: |
| Catalog rows queried | 1500 |
| Eligible catalog candidates after filtering | 975 |
| Sourcing candidates sent to AI | 36 |
| Blueprint role count | 11 |
| Role-scoped pools supplied | 11 |
| Required role pools | 3 |
| Required empty pools | 0 |
| Required weak pools | 3 |
| Required scattered pools | 2 |
| Manual review suggested by pool rollup | true |
| Model | `gpt-5-mini` |

QA stop-rule result:

| Field | Value |
| --- | ---: |
| `passesQaStopRules` | true |
| Blockers | 0 |
| Warnings | 13 |
| Missing required roles | 0 |
| Required closest-available roles | 0 |
| Invalid selections | 0 |
| Required color mismatches | 0 |
| Required empty pools | 0 |

Required-role warnings:

- Anchor seating: dimensions missing; partial catalog evidence with missing style/room and dimension evidence.
- Coffee table: weak material match; dimensions missing; partial catalog evidence with missing style/room and dimension evidence.
- Generous rug: dimensions missing; weak catalog evidence with missing color, material, style/room, and dimension evidence.

Supporting-role warnings:

- Floor/table lighting: weak material match.
- Wall art/focal wall: no supporting product selected.
- Mirror: no supporting product selected.
- Curtains/textile layer: no supporting product selected.
- Cushions/tray/ceramics/decor: no supporting product selected.
- TV media console or built-in media unit: no supporting product selected.

Selected products:

| Role | Product | Retailer | Status | Confidence | Evidence | Dimension fit | Freshness | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Anchor seating | Lugano Modular Sofa - Beige, Spacious Design & Soft Upholstery | Chattels & More | `strong_match` | `strong` | `partial` | `missing_product_dimensions` | `fresh` | Beige modular sofa matches the low, rounded, warm contemporary anchor. |
| Secondary seating | Coco Swivel Chair, Cream | Chattels & More | `strong_match` | `strong` | `partial` | `missing_product_dimensions` | `fresh` | Rounded cream lounge chair aligns with the sculptural secondary seating direction. |
| Coffee table | Colonial Coffee Table Bar in Brown Polyurethane-Coated Textile, 120x75cm | Chattels & More | `acceptable_match` | `acceptable` | `partial` | `missing_product_dimensions` | `fresh` | Scale and warmth fit; material differs from the walnut/travertine concept direction. |
| Generous rug | Soloni Looselay Rug Greige - 300X400 cm | 2XL Home | `strong_match` | `strong` | `weak` | `missing_product_dimensions` | `fresh` | Large greige rug fits the layered living/dining plan; catalog evidence remains weak. |
| Side or end tables | Tivoli Lamp Table - Beige, Marble Top Construction, Solid Base Support & Compact Contemporary Accent Table | Chattels & More | `strong_match` | `strong` | `partial` | `fits_room` | `fresh` | Beige travertine-look side table matches the warm stone accent direction. |
| Floor or table lighting | The Opus Lamp | Danube Home | `acceptable_match` | `acceptable` | `partial` | `missing_product_dimensions` | `fresh` | Warm rattan/metal lamp works tonally, but differs from the slim brass directional lamp in the concept. |

## Dining Target

Request scope:

| Field | Value |
| --- | --- |
| Project | Dubai South |
| Room | Ground Floor Dining Room |
| Room type | Dining Room |
| Concept | Refined Traditional Dining - Warm Neutrals with Aged-Brass Accents |
| Concept ID | `b31cf586-629f-46db-9bae-db116533328c` |

Input metadata:

| Field | Value |
| --- | ---: |
| Catalog rows queried | 1500 |
| Eligible catalog candidates after filtering | 975 |
| Sourcing candidates sent to AI | 36 |
| Blueprint role count | 9 |
| Role-scoped pools supplied | 9 |
| Required role pools | 2 |
| Required empty pools | 0 |
| Required weak pools | 1 |
| Required scattered pools | 1 |
| Manual review suggested by pool rollup | true |
| Model | `gpt-5-mini` |

QA stop-rule result:

| Field | Value |
| --- | ---: |
| `passesQaStopRules` | true |
| Blockers | 0 |
| Warnings | 8 |
| Missing required roles | 0 |
| Required closest-available roles | 0 |
| Invalid selections | 0 |
| Required color mismatches | 0 |
| Required empty pools | 0 |

Required-role warnings:

- Dining table: dimensions missing; weak catalog evidence with missing color, material, style/room, and dimension evidence.
- Dining chairs: room measurements missing for fit check; weak catalog evidence with missing color, material, and style/room evidence.

Supporting-role warnings:

- Over-table lighting: weak material match.
- Mirror: no supporting product selected.
- Restrained table decor: no supporting product selected.
- Curtains/textile layer: no supporting product selected.

Selected products:

| Role | Product | Retailer | Status | Confidence | Evidence | Dimension fit | Freshness | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dining table | Odren 6 seater dining table | 2XL Home | `strong_match` | `strong` | `weak` | `missing_product_dimensions` | `fresh` | Marble-look top and central pedestal align with the concept table direction. |
| Dining chairs | Lourin Dining Arm Chair | 2XL Home | `acceptable_match` | `acceptable` | `weak` | `missing_room_measurements` | `fresh` | Cream upholstered arm chair fits the silhouette broadly; aged-brass back ring/base detail is missing. |
| Over-table lighting | Javi 6-Lights Linen Chandelier | 2XL Home | `strong_match` | `strong` | `weak` | `missing_product_dimensions` | `fresh` | Brass chandelier with linen shades directly matches the warm formal lighting direction. |
| Sideboard, credenza, or dining console | Lantine Walnut Veneer TV Unit, Large Size | Chattels & More | `strong_match` | `strong` | `partial` | `missing_product_dimensions` | `fresh` | Walnut veneer and long low profile fit the sideboard/console need. |
| Dining rug | Soloni Looselay Rug Greige - 300X400 cm | 2XL Home | `strong_match` | `strong` | `weak` | `missing_product_dimensions` | `fresh` | Greige 300x400 rug is suitable for chair pull-out around a six-seater. |
| Art or mirror | Souq DESIGNS Wooden Wall Panel White - Set of 3 Large Wood Panels For Wall | Danube Home | `strong_match` | `strong` | `partial` | `missing_room_measurements` | `fresh` | White carved wall panels align with the refined traditional wall treatment. |

## Stop And Rollback Outcome

- Stop rule triggered: no.
- Rollback needed: no.
- Failed output reused for customer-facing decisions: no.
- Shopping-list output use approved by this evidence: no.
- Controlled preview expansion approved by this evidence: no.
- Production rollout/default-on approved by this evidence: no.

Rollback remains unchanged if future stop rules trigger: keep Product Matching default-off, do not reuse failed output for customer-facing decisions, record the blocker in evidence notes, and request Chief Architect routing for the next docs-only, QA-harness-only, or narrow scoring follow-up.

## Next Review Question

Chief Architect should review whether this Sam-approved two-target local read-only evidence pass is sufficient to prepare the next Sam decision, or whether another docs-only/QA-harness-only follow-up is needed before any broader controlled-preview activity.
