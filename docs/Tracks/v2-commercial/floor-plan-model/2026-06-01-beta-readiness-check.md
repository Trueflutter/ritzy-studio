# Floor Plan Model Beta Readiness Check

Date: 2026-06-01
Owner: Floor Plan Model Agent
Ticket: FP-001
Launch target: Wednesday 2026-06-03 operational beta
State: parked

## Question

Does the designer-path beta flow depend on floor-plan model output before the Wednesday operational beta?

## Evidence Reviewed

- `docs/Tracks/v2-commercial/process/active-agent-control-board.md` keeps FP-001 parked with no allowed implementation scope and explicitly forbids user/private floor-plan assets, raw copyrighted floor-plan storage/display, OCR/vendor/parser integrations, runtime UI/app-action wiring, DB/schema/generated type changes, live writes, deploys, and feature flags.
- `docs/Tracks/v2-commercial/process/beta-launch-coordination-board.md` routes active beta risk through BL-001 Designer Path QA, BL-002 shopping preview/unlock UX, BL-003 Product Matching variety/fit, BL-004 sourcing retest, and BL-005 Stripe/deployment smoke. No beta ticket currently requires floor-plan model output.
- PR #288 Designer Path QA evidence reports passing project creation, first designer room creation, photo evidence, brief details/measurements, concept generation, product matching, locked shopping list, designer plan paywall, and room preview. Its listed blockers are concept completion spinner clarity and native file-picker fidelity, not floor-plan extraction or model output.
- The room brief details screen requires manual measurements: main wall, room depth, and ceiling height. The floor-plan section is labeled optional and frames upload as reference only.
- `saveDesignBriefAction` stores measurements with `source: "manual"` and `confidence: "verified"` when the designer enters dimensions.
- Concept generation gates on the presence of required `room_measurements`; it does not require floor-plan parsing or developer-layout prefill.

## Beta Readiness Finding

No beta-critical floor-plan model blocker is visible for the Wednesday operational beta.

The beta path can proceed with:

- user-entered room measurements
- optional floor-plan upload as reference only
- no floor-plan parser/OCR/vendor model dependency
- no claims that uploaded plans are extracted, normalized, or used to certify fit
- no layout-confidence automation required before room creation, concept generation, shopping-list preview, or presentation preview

## Risks To Keep Explicit

- If a designer expects uploaded floor plans to auto-fill dimensions, the current beta copy should be treated as a promise boundary: upload is reference-only, and measurements are still entered manually.
- Product fit remains bounded by manually entered room dimensions and catalog product dimensions. Do not claim exact fit certification without verified measurements and review.
- Floor-plan extraction, room-label detection, developer-layout prefill, and layout confidence remain future Measurement Intelligence/Floor Plan Model work, not beta launch functionality.
- Native file-picker fidelity in PR #288 remains a Designer Path QA follow-up, not a floor-plan model blocker.

## Stop Rules Honored

This check did not add or approve:

- model/runtime behavior changes
- OCR, parser, vendor SDKs, or external floor-plan integrations
- DB/schema/generated type changes
- Supabase writes or seed writes
- runtime UI/app-action changes
- private/user floor-plan asset review or storage beyond existing app behavior
- raw copyrighted plan storage/display
- controlled-preview expansion
- final-render execution
- production deploys, flags, or live behavior changes

## Next Action

Keep FP-001 parked. Reopen only if Sam/Chief routes a narrow safe follow-up, such as:

- docs-only beta copy audit for floor-plan promise boundaries
- local/dev QA confirmation that optional floor-plan upload remains reference-only
- dry-run-only Measurement Intelligence artifact that does not touch runtime, schema, private assets, parser/OCR/vendor integrations, or live data
