# Product Matching Engine V1 Bounded Controlled Preview Evidence

Runtime impact: evidence capture only. Product Matching Engine V1 remains default-off globally.

## Scope

This is the smallest bounded controlled-preview evidence pass after PR #114.

Sources of truth:

- PR #112 controlled-preview decision package.
- PR #113 controlled-preview allowlist gate.
- PR #114 tracked mailbox approval handoff.

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
- Branch / commit: `codex/product-match-bounded-preview-evidence` from `31b8797`.
- Env source checked: `/Users/ayoolatoye/Documents/projects/ritzy-studio/.env.local`.
- Required variable names present: `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Secrets printed, committed, pasted, screenshotted, or stored: no.
- Product Matching V1 flag: `true` only inside the local QA process.
- Controlled-preview flag: `true` only inside the local QA process.
- Allowlist scope: one project id and one room id.
- Gate result: `configured=true`, `enabled=true`, `allowed=true`, `matchedScopes=["project","room"]`.
- Raw local output: `/tmp/product-matching-controlled-preview-evidence-2026-05-25.json` (not committed).

## Request Scope

| Field | Value |
| --- | --- |
| Project | Claret Villa |
| Project ID | `f66beecc-c011-43c7-9db7-ed59af879820` |
| Room | Ground floor Lounge |
| Room ID | `45edb758-735b-4666-bb4b-b00b7cd61de5` |
| Room type | Living Room |
| Concept | Warm-Contemporary Plan: Dining Behind the Sofa - Balanced Daylight & Sightlines |
| Concept ID | `ff561a77-0e31-41a2-95a9-d66be9782991` |

## Input Metadata

| Field | Value |
| --- | ---: |
| Catalog rows queried | 1000 |
| Eligible catalog candidates after filtering | 975 |
| Sourcing candidates sent to AI | 36 |
| Blueprint role count | 11 |
| Role-scoped pools supplied | 11 |
| Required role pools | 3 |
| Required empty pools | 0 |
| Required weak pools | 3 |
| Required scattered pools | 2 |
| Manual review suggested by pool rollup | true |
| AI elapsed | 96.4s |
| Model | `gpt-5-mini` |
| Prompt key/version | `sourcing.concept_visual_product_match` / `2026-05-22.1` |

## QA Stop-Rule Result

| Field | Value |
| --- | ---: |
| `passesQaStopRules` | true |
| Blockers | 0 |
| Warnings | 13 |
| Missing required roles | 0 |
| Required closest-available roles | 0 |
| Invalid selections | 0 |
| Required color mismatches | 0 |
| Required weak material matches | 1 |
| Required missing dimensions | 3 |
| Required partial evidence | 2 |
| Required weak evidence | 1 |
| Required empty pools | 0 |

Required-role warnings:

- Anchor seating: dimensions missing; partial catalog evidence.
- Coffee table: weak material match; dimensions missing; partial catalog evidence.
- Generous rug: dimensions missing; weak catalog evidence.

Supporting-role warnings:

- Floor/table lighting: weak material match.
- Wall art/focal wall: missing supporting.
- Mirror: missing supporting.
- Curtains/textile layer: missing supporting.
- Cushions/tray/ceramics/decor: missing supporting.
- TV media console or built-in media unit: missing supporting.

## Selected Required Products

| Required role | Product | Retailer | Status | Confidence tier | Evidence | Dimension fit | Freshness | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Anchor seating | Lugano Modular Sofa - Beige, Spacious Design & Soft Upholstery | Chattels & More | `strong_match` | `strong` | `partial` | `missing_product_dimensions` | `fresh` | Visually fits the warm neutral modular sofa anchor, but dimensions and style/room evidence need reviewer confirmation. |
| Coffee table | Colonial Coffee Table Bar in Brown Polyurethane-Coated Textile, 120x75cm | Chattels & More | `acceptable_match` | `acceptable` | `partial` | `missing_product_dimensions` | `fresh` | Low scale and warm tone fit; material is not a close walnut/travertine match, so manual review is required. |
| Generous rug | Soloni Looselay Rug Greige - 300X400 cm | 2XL Home | `strong_match` | `strong` | `weak` | `missing_product_dimensions` | `fresh` | Scale and greige/taupe direction fit; catalog evidence is weak and dimensions need confirmation despite the product title size. |

## Supporting Products And Gaps

| Supporting role | Status | Notes |
| --- | --- | --- |
| Secondary seating | `strong_match` | Cream rounded swivel chair selection was strong, but material/color metadata still raised warnings. |
| Side or end tables | `strong_match` | Travertine side-table selection was strong, with metadata warnings. |
| Floor or table lighting | `acceptable_match` | Arched LED floor lamp is compatible but not an exact brass directional/task-lighting match. |
| Wall art or focal wall | `missing_supporting` | No wall-art candidates were supplied in the role pool. |
| Mirror | `missing_supporting` | No mirror candidates were supplied. |
| Curtains or textile layer | `missing_supporting` | No curtain/textile candidates were supplied. |
| Cushions, tray, ceramics, and decor | `missing_supporting` | Accessories/decor require better candidate coverage. |
| TV media console or built-in media unit | `missing_supporting` | Media-console/storage needs better candidate coverage before any complete-room claim. |

## Decision

- QA outcome: pass for this one allowlisted living-room controlled-preview evidence run, with warnings.
- Required anchors: pass; no required role was missing or closest-available.
- Controlled preview expansion allowed by this report: no.
- Production rollout allowed by this report: no.
- Default-on activation allowed by this report: no.
- Live catalog writes allowed by this report: no.
- Shopping-list output use allowed by this report: no.

## Rollback And Stop Recommendation

Rollback remains simple: keep or reset `RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED=false`, keep or reset `RITZY_PRODUCT_MATCHING_ENGINE_V1_CONTROLLED_PREVIEW_ENABLED=false`, and clear the preview allowlist env values.

Recommended next decision: Chief Architect should decide whether the next Product Matching stage is:

- another bounded evidence run for dining, bedroom, or home-office/study;
- a QA-harness-only reproducibility script for this controlled-preview evidence path;
- a narrow supporting-role catalog/pool-quality investigation for wall art, curtains, decor, and media storage;
- or lane pause until Sam wants broader controlled-preview coverage.
