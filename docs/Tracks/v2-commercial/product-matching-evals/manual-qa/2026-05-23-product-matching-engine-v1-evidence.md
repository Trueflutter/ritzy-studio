# Product Matching Engine V1 Manual QA Evidence

Runtime impact: none. This is a docs/artifacts-only evidence pass.

## Run Details

- Date: 2026-05-23
- Reviewer: Product Matching Engine agent
- Environment: local read-only harness against hosted Supabase reads
- Branch / commit: `codex/product-match-manual-qa-evidence`
- Product Matching Engine V1 flag value: `true` in local process only
- App action used: no
- DB writes: none
- Catalog candidates loaded: 975
- AI sourcing calls completed: 3
- Raw local harness output: `/tmp/product-matching-manual-qa-2026-05-23.json` (not committed because it contains expiring signed concept image URLs)

## Coverage Summary

| Room type | Real selected concept? | Visual arbitration run? | QA gate | Notes |
| --- | --- | --- | --- | --- |
| Living Room | Yes | Yes | Passed | Covered lamps/lighting and warm beige sofa fidelity. |
| Dining Room | Yes | Yes | Passed | Covered quantity-sensitive dining chairs and sideboard/storage. |
| Bedroom | Yes | Yes | Blocked | Required bedside-table role was marked missing by role-contract metadata. |
| Home Office | No | No | Not run | No home-office/study/workspace room or selected concept exists in the read-only project data. Pool-only probe is recorded below. |

Contact sheet screenshot:

![Product Matching Engine V1 manual QA contact sheet](assets/2026-05-23/contact-sheet.png)

## Living Room Scenario

- Project / room: Mirdiff / Living Room
- Room ID: `933aa166-5c19-4ff3-807e-6e482f5d42c4`
- Concept ID: `8d412f7c-1271-46f7-b609-026185b9dc60`
- Concept title: Warm Traditional Conversation Lounge - Warm Ivory, Light Oak & Aged Brass
- Required roles expected: anchor seating, coffee table, generous rug
- Supporting roles expected: secondary seating, side/end tables, floor/table lighting, wall art, mirror, curtains, decor, TV media console/storage
- Input metadata: `candidateCount=36`, `blueprintRoleCount=11`, `rolePoolQaRollup.manualReviewSuggested=true`
- Output metadata: `selectedProductCount=6`, `missingRoleCount=12`, `roleConfidenceGate.passesQaStopRules=true`, `blockerCount=0`, `warningCount=13`

| Role | Product ID | Status | Confidence tier | Evidence | Dimension fit | Freshness | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Anchor seating | `0f114058-311c-41f3-b348-566fdcdd041f` | `strong_match` | `strong` | `partial` | `missing_room_measurements` | `fresh` | Beige fabric sofa was selected over non-beige alternatives; no olive-sofa regression observed. |
| Coffee table | `6c36e42b-2db2-4ce9-9462-547e5b682b1e` | `acceptable_match` | `acceptable` | `partial` | `missing_room_measurements` | `fresh` | Warm wood table is plausible but not as refined as the concept table. |
| Generous rug | `c3fb4a11-4113-41be-9753-e5e8befc6679` | `strong_match` | `strong` | `weak` | `missing_room_measurements` | `fresh` | Greige rug fits the warm neutral direction; catalog evidence is weak. |

Supporting concerns: the selected list included cream armchairs, a beige/oak side table, and a beige raffia lamp, but several supporting role results were missing because the model did not return valid statuses for every role pool. The TV/media console role remained missing even though the pool had storage candidates.

## Dining Room Scenario

- Project / room: Dubai South / Ground Floor Dining Room
- Room ID: `1da580bf-9ad4-40fa-8ee6-420efbbc8ffb`
- Concept ID: `b31cf586-629f-46db-9bae-db116533328c`
- Concept title: Refined Traditional Dining - Warm Neutrals with Aged-Brass Accents
- Required roles expected: dining table, dining chairs
- Supporting roles expected: over-table lighting, sideboard/credenza, dining rug, art/mirror, mirror, table decor, curtains
- Input metadata: `candidateCount=36`, `blueprintRoleCount=9`, `rolePoolQaRollup.manualReviewSuggested=true`
- Output metadata: `selectedProductCount=5`, `missingRoleCount=10`, `roleConfidenceGate.passesQaStopRules=true`, `blockerCount=0`, `warningCount=10`

| Role | Product ID | Status | Confidence tier | Evidence | Dimension fit | Freshness | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dining table | `4a0b7733-d570-46d7-a465-91756259fa49` | `strong_match` | `strong` | `weak` | `missing_room_measurements` | `fresh` | Six-seater table matched the concept shape/material direction. |
| Dining chairs | `582d7bce-5103-4e4c-b51c-56712294e328` | `acceptable_match` | `acceptable` | `partial` | `missing_room_measurements` | `fresh` | Chose a cream dining/stool product, not a bulky lounge armchair. Quantity remains role-level `6`. |

Supporting concerns: sideboard/storage selected `f457808c-5eeb-4f76-bfe8-636c73f394db` (Lantine Walnut Veneer TV Unit) and looked closer to a low console than a generic bookcase. However, role confidence for the sideboard role was `not_evaluated` because the returned role label/category did not line up cleanly with the role pool contract.

## Bedroom Scenario

- Project / room: Studio Hills / Bedroom
- Room ID: `c8127271-b870-4d7d-afa7-ec6987e648ed`
- Concept ID: `1faee4bb-9f5a-47ee-a463-9a3d691f815f`
- Concept title: New-Classic Warm Ivory Bedroom - tailored headboard, layered textiles, and aged-
- Required roles expected: bed or bed frame, bedside tables
- Supporting roles expected: headboard, bedside lighting, bedroom rug, bedding, curtains, wall art/mirror, decor
- Input metadata: `candidateCount=36`, `blueprintRoleCount=9`, `rolePoolQaRollup.manualReviewSuggested=true`
- Output metadata: `selectedProductCount=6`, `missingRoleCount=9`, `roleConfidenceGate.passesQaStopRules=false`, `blockerCount=1`, `warningCount=8`

| Role | Product ID | Status | Confidence tier | Evidence | Dimension fit | Freshness | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bed or bed frame | `ed6e9ad5-1ece-401d-b02b-34343340fc1e` | `strong_match` | `strong` | `partial` | `missing_room_measurements` | `fresh` | Ivory upholstered bed matched the concept well. |
| Bedside tables | `a2ff2134-46d4-41db-aeab-59b86e6a68bd` | Selected product present, role result missing | `missing` | n/a | n/a | n/a | The model selected a plausible Lantine walnut side table, but its role result used the wrong category, so the role contract correctly marked bedside tables missing. |

This is useful evidence that the conservative gate is doing its job: the selected product list alone looked plausible, but role-scoped validation still blocked the required bedside-table role because the role result was not valid for that pool.

## Home Office Coverage Gap

No existing home-office, study, or workspace room/concept was found in read-only project data. Creating a representative home-office room or selected concept would require writes, which are outside this PR's approved scope.

Pool-only probe against Home Office roles did find candidates:

| Role | Candidate count | Pool quality | Notes |
| --- | ---: | --- | --- |
| Desk | 6 | `weak` | Top candidates are white/black electric office desks; material match weak for warm-oak concept text. |
| Ergonomic task chair | 6 | `weak` | Uses compatible fallback categories and has scattered material/color signals. |
| Storage/shelving/credenza | 6 | `weak` | Top storage candidates skew bookcase/shelving, so future office QA should inspect this closely. |
| Task lamp/layered lighting | 6 | `weak` | Table/floor lamp candidates exist. |
| Rug/textile layer | 6 | `healthy` | Neutral rug candidates exist. |

## Visual Review

- Required anchors visually match object type: yes for living, dining, and bed anchor roles.
- Required anchors visually match color/material direction: mostly yes; living sofa stayed beige/cream, dining chairs stayed cream, bed stayed ivory.
- Required anchors avoid contradictory silhouette or scale: mostly yes; dining chair product may need human review because it is labeled as a stool despite matching the cream upholstered dining role more closely than bulky armchairs.
- Dining chairs are not bulky lounge chairs: passed.
- TV media console roles prefer media/storage units over generic bookcases when available: partially passed. Dining selected a TV/console-like unit; living TV/media console remained missing in role results.
- Beige/cream sofa concepts avoid olive/green sofas when beige options exist: passed in the living scenario.

## Issues

| Severity | Role | Metadata field | Finding | Required follow-up |
| --- | --- | --- | --- | --- |
| P1 | Bedroom bedside tables | `roleConfidenceGate.blockers` | Required role blocked because the model selected a side table but returned role result metadata outside the exact role contract. | Prompt/runtime follow-up should make role result labels/categories mirror supplied role pools exactly; no fix in this PR. |
| P2 | Home office | Coverage | No real selected home-office concept exists for read-only QA. | Seed or create a representative home-office QA scenario with explicit approval for writes, then rerun visual arbitration. |
| P2 | Catalog evidence | `roleConfidenceGate.warnings` | Required roles often had missing room measurements or partial/weak product evidence. | Continue catalog enrichment and measurement capture before wider preview. |
| P2 | Living TV/media console | `roleStatuses` | Living storage/media role had candidates but was returned as missing supporting. | Inspect prompt role adherence for supporting storage/media roles in a later PR. |

## Comparison Against Prior Failure Mode

The engine improved the known random-feeling sourcing class in the exercised scenarios:

- The beige living concept selected a beige fabric sofa and cream secondary seating, not an olive/green sofa.
- The dining-chair role stayed inside the chair-compatible pool and did not select bulky armchairs.
- The sideboard/storage case selected a low walnut TV-unit/console-like product where available instead of a generic bookcase.

The remaining weakness is role-result contract fidelity, not broad category drift: selected products can be visually plausible while role metadata still fails the stricter role pool contract. That argues for targeted prompt/runtime follow-up, not default-on rollout yet.

## Decision

- QA outcome: needs targeted fixes before controlled default-off preview testing.
- Production rollout allowed by this report: No.
- Follow-up PR or catalog action needed: yes, for role-result contract adherence and a seeded home-office QA scenario.
- Chief architect / Sam decision needed: approve the next docs-only rollout readiness decision record, then decide whether the following implementation PR should address role-result contract prompting or seed missing QA scenarios.
