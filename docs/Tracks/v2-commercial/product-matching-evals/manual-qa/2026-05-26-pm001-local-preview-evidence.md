# Product Matching V1 PM-001 Local Preview Evidence

Runtime impact: local/dev-only evidence capture. Product Matching Engine V1 remains default-off outside the local process used for this run.

## Scope

Sam approved one local-only controlled Product Matching V1 preview for the current test project, room, user, and email.

| Field | Value |
| --- | --- |
| Ticket | `PM-001` |
| Owner | Product Matching Agent |
| Project | Arabian Ranches 3 |
| Project ID | `7e1f060d-b95d-462d-8cc2-22b6dd0e92a5` |
| Room | Living Room |
| Room ID | `19d312f0-0cd0-4e92-a612-8897767992b3` |
| Room type | Living Room |
| User ID | `87c551bf-8288-49df-99c4-a58b530f32ce` |
| User email | `sam.olatoye@gmail.com` |
| Concept | Traditional Sage & Warm-Walnut Formal Living Room |
| Concept ID | `86a84348-9a98-4dc9-9a41-2d2fd2f44b32` |
| Evidence job | `b218a6f6-55bf-4c49-961d-9812827d6553` |

## Run Boundary

- Date: 2026-05-26.
- Branch: `codex/product-match-local-preview-evidence`.
- Environment: local/dev only.
- App path: direct local harness, not app action execution.
- Product Matching V1 flag: enabled only inside the local process.
- Controlled-preview flag: enabled only inside the local process.
- Allowlist scope: request-scoped to the project, room, user ID, and user email above.
- Gate result: `allowed=true`, `enabled=true`, `configured=true`, `matchedScopes=["project","room","user","email"]`.
- Raw output committed: no.
- Screenshots/contact sheets committed: no.
- Secrets printed, committed, pasted, or stored: no.

Write boundary recorded in `ai_jobs` input and output summaries:

| Boundary | Result |
| --- | --- |
| Deploy | false |
| Catalog writes | false |
| Schema changes | false |
| Shopping-list rows created | false |
| Shopping-list rows refreshed | false |

## Input Summary

| Field | Value |
| --- | ---: |
| Product candidates sent to AI | 36 |
| Blueprint role count | 11 |
| Required role count | 3 |
| Required empty pools | 0 |
| Required weak pools | 3 |
| Required scattered pools | 2 |
| Empty role pools | 1 |
| Weak role pools | 10 |
| Scattered role pools | 9 |
| Manual review suggested | true |

## QA Stop-Rule Result

| Field | Value |
| --- | ---: |
| `passesQaStopRules` | false |
| Blockers | 1 |
| Warnings | 12 |
| Missing required roles | 0 |
| Required closest-available roles | 1 |
| Invalid selections | 0 |
| Required empty pools | 0 |
| Required color mismatches | 0 |
| Required weak evidence | 1 |
| Required partial evidence | 2 |
| Required missing dimensions | 2 |

Stop rule triggered:

| Severity | Code | Role | Message |
| --- | --- | --- | --- |
| blocker | `required_closest_available` | Coffee table | Required role is only closest available. |

## Selected Products

| Role | Product | Retailer | Status | Confidence tier | Evidence | Dimension fit | Freshness | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Anchor seating | Plush Love 4 Seater Sofa - Green | Chattels & More | `strong_match` | `strong` | `partial` | `fits_room` | `fresh` | Strong sage-green anchor match; style or room evidence is missing. |
| Secondary seating | Music Hall Armchair | Chattels & More | `closest_available` | `weak` | `partial` | `missing_product_dimensions` | `fresh` | Supporting role closest-available; no true graphite wingback chair with nailhead trim in pool. |
| Coffee table | Electra Coffee Table, 75Cm | Chattels & More | `closest_available` | `weak` | `partial` | `missing_product_dimensions` | `fresh` | Required-role blocker; round wood top is nearest available, but finish/brass detail does not meet concept. |
| Generous rug | Soloni Looselay Rug Greige - 300X400 cm | 2XL Home | `strong_match` | `strong` | `weak` | `missing_product_dimensions` | `fresh` | Strong visual match, but catalog evidence is weak and dimensions are incomplete. |
| Side or end tables | Lantine Walnut Veneer Side Table with Brass Detail | Chattels & More | `strong_match` | `strong` | `partial` | `fits_room` | `fresh` | Walnut veneer and brass detail align with concept direction. |
| Floor or table lighting | The Natura Lamp - Large | Danube Home | `closest_available` | `weak` | `partial` | `missing_product_dimensions` | `fresh` | Supporting role closest-available; warm lamp differs from preferred antique-brass table or floor lamp. |

## Supporting Role Gaps

The run did not select supporting products for:

- Wall art or focal wall.
- Mirror.
- Curtains or textile layer.
- Cushions, tray, ceramics, and decor.
- TV media console or built-in media unit.

These were warnings, not the blocker. The blocker is the required coffee-table role.

## Outcome

- Local harness completed successfully: yes.
- `ai_jobs` evidence row persisted: yes, `b218a6f6-55bf-4c49-961d-9812827d6553`.
- QA stop rules passed: no.
- Stop-rule blocker: required coffee table is only `closest_available`.
- Shopping-list output use approved by this evidence: no.
- Customer-facing reuse approved by this evidence: no.
- Production rollout/default-on approved by this evidence: no.

## Recommended Next Action

Hold Product Matching at the PM-001 quality gate. The next safe step is Chief/Sam routing for one of:

- A docs-only decision on whether this blocker is acceptable for investor-demo narrative only.
- A narrow domain/test/QA-harness-only quality investigation for required coffee-table matching.
- A separately approved catalog/data-quality follow-up for coffee-table and supporting-role pool quality.

Do not reuse this output for customer-facing decisions unless Sam/Chief explicitly accepts the blocker or approves a narrow fix-and-retest boundary.
