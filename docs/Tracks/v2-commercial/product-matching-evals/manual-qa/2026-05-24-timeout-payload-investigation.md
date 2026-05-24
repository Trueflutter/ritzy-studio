# Product Matching Engine V1 Timeout/Payload Investigation

Runtime impact: none. This is a docs/artifacts-only QA investigation report.

## Scope

This pass investigated why the fresh post-PR105 QA report timed out for dining room and home office/study under the local harness' 90-second per-scenario timeout.

Hard boundaries honored:

- No default-on activation.
- No production flags.
- No deploys.
- No app-action writes.
- No DB writes.
- No catalog writes.
- No shopping-list writes.
- No DB/schema changes.
- No UI changes.
- No prompt changes.
- No app-action flow changes.
- No Catalog-First runtime coupling.
- No controlled-preview or production rollout approval.

## Run Details

- Date: 2026-05-24
- Lane: Product Matching Engine
- Base `main`: `0c0d8c0`
- Branch: `codex/product-match-timeout-investigation`
- Environment: local read-only harness using hosted Supabase reads and OpenAI visual sourcing
- Product Matching Engine V1 flag: `true` only in the QA process
- QA-only timeout cap: 210 seconds per targeted scenario
- App action used: no
- DB writes: none
- Catalog writes: none
- Shopping-list writes: none
- Catalog candidates loaded: 975
- Raw local harness output: `/tmp/product-matching-timeout-investigation.json` (not committed because it includes signed concept image metadata and full product IDs)
- Screenshots/contact sheet: not refreshed; this investigation measured timeout/payload behavior only

## Summary

The previous dining and home-office timeouts did not reproduce in a clean targeted run.

Both scenarios completed well under the 210-second QA-only cap:

| Scenario | Previous bounded result | Investigation result | AI elapsed | QA gate |
| --- | --- | --- | --- | --- |
| Dining room | Timed out at 90s | Completed | 60s | Passed with warnings |
| Home office/study | Timed out at 90s | Completed | 41s | Blocked |

The most likely cause of the previous timeout evidence is the temporary local harness behavior, not a deterministic Product Matching runtime defect. The prior harness wrapped calls in `Promise.race` but did not cancel the underlying OpenAI request after a timeout. A timed-out AI call could therefore continue running while later scenarios started, creating local QA concurrency and confusing the evidence.

## Payload Comparison

The targeted scenarios used the same flat candidate limit and the same model image input shape:

| Scenario | Roles | Required roles | Flat candidates | Model image inputs | Unique role candidates | Role candidate refs | Empty pools | Weak pools | Concept image |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Dining room | 9 | 2 | 36 | 37 | 36 | 36 | 1 | 7 | Signed generated render URL |
| Home office/study | 7 | 2 | 36 | 37 | 36 | 36 | 0 | 4 | Public static image URL |

Observed planning time was small in both cases:

- Dining room runtime plan build: 41ms.
- Home office/study runtime plan build: 21ms.

The payloads are image-heavy because the current visual sourcing call sends the concept image plus up to 36 product images at high detail. That is expected for the current local QA path and remains a cost/latency consideration, but this investigation did not show candidate count, role count, or public-vs-signed concept image source as a deterministic timeout trigger.

## Dining Room Result

- Status: completed.
- AI elapsed: 60.3s.
- Selected product count: 6.
- Missing role count: 6.
- `roleConfidenceGate.passesQaStopRules`: `true`.
- Blockers: 0.
- Warnings: 8.

Selected products:

| Role | Product | Status |
| --- | --- | --- |
| Dining table | Odren 6 seater dining table | `strong_match` |
| Dining chairs | Salamanca Stool in Cream Pine and Medium Density Fibreboard, 127x82cm | `acceptable_match` |
| Over-table lighting | The Natura Lamp - Large | `closest_available` |
| Sideboard, credenza, or dining console | Lantine Walnut Veneer TV Unit, Large Size | `strong_match` |
| Dining rug | Soloni Looselay Rug Greige - 300X400 cm | `strong_match` |
| Art or mirror | Souq DESIGNS Wooden Wall Panel White - Set of 3 Large Wood Panels For Wall | `strong_match` |

Notes:

- Quantity-sensitive dining chair sourcing stayed in the chair-compatible role pool and did not select a bulky armchair.
- Sideboard/storage sourcing selected a storage/media-console-like unit rather than a generic bookcase.
- Dining passed stop rules, but the lighting role remained `closest_available` and dimension/evidence warnings remain.

## Home Office/Study Result

- Status: completed.
- AI elapsed: 40.7s.
- Selected product count: 6.
- Missing role count: 2.
- `roleConfidenceGate.passesQaStopRules`: `false`.
- Blockers: 1.
- Warnings: 6.

Selected products:

| Role | Product | Status |
| --- | --- | --- |
| Desk | Smart Black Metal Office Desk, Adjustable Height, 120x70cm | `closest_available` |
| Ergonomic task chair | Rouven Office Chair, 100Cm | `strong_match` |
| Storage, shelving, or credenza | Charley Travertine Top sideboard | `acceptable_match` |
| Task lamp or layered lighting | Leti G9 15-Lights Glass Chandelier | `closest_available` |
| Rug or textile layer | Knoll Looselay Rug Greige - 200X290 cm | `acceptable_match` |
| Art, pinboard, or styled background | Ayana Wall Mirror - 114X165 CM | `acceptable_match` |

Notes:

- The home-office timeout blocker is cleared as a timeout issue, but the scenario still fails the QA stop rules.
- The blocker is a required desk role returned as `closest_available`.
- Supporting lighting still selects a chandelier as closest available rather than a task lamp.
- The result reinforces the prior home-office caveat: the external/static image probe is representative evidence only, not a full end-to-end Ritzy-generated home-office project.

## Findings

1. The previous 90-second timeout evidence is not stable enough to diagnose a deterministic Product Matching runtime issue.
2. The temporary local QA harness should avoid non-canceling `Promise.race` timeouts for sequential visual sourcing runs, or it should run scenarios one at a time in separate processes.
3. A 90-second local QA timeout is too tight for reliable evidence when the request includes 37 high-detail image inputs and OpenAI service latency varies.
4. Dining room is no longer blocked by timeout and passes QA stop rules with warnings.
5. Home office/study is no longer blocked by timeout, but it remains blocked by match quality because the required desk role is only `closest_available`.

## Decision Impact

- Product Matching Engine V1 production rollout allowed: no.
- Controlled default-off preview activation approved by this report: no.
- Timeout blocker status: reduced from rollout blocker to QA harness evidence-quality issue.
- Home-office quality blocker status: still open.

Recommended next action: ask Chief Architect whether to proceed with a narrow home-office role-quality investigation/fix, a QA-harness-only executable script improvement, or a docs-only readiness update that keeps controlled preview blocked until home-office required roles pass.
