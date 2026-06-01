# Measurement Intelligence Operational Beta Check

ARCHITECT_NOTE: Measurement Intelligence Agent docs-only beta-readiness check for Wednesday 2026-06-03 operational beta. Scope is read-only inspection of latest `origin/main` at `6561054`, merged PR #288 Designer Path QA evidence, and existing Measurement/Floor Plan confidence docs. No runtime, UI, schema, generated type, Supabase write, seed write, floor-plan parser/OCR/vendor, private floor-plan asset, production flag, deploy, payment/checkout, Product Matching execution, or Catalog-First runtime-coupling work was performed.

## Scope

This note answers the beta-critical Measurement Intelligence question only:

1. Did designer-path QA uncover measurement-related blockers?
2. Is current measurement/confidence behavior acceptable for operational beta?
3. Are there beta-blocking ambiguities in room dimensions, confidence labels, or designer expectations?
4. What is the smallest safe follow-up, if any?

## Evidence Inspected

- `docs/Tracks/v2-commercial/process/active-agent-control-board.md` on `origin/main`
- `docs/Tracks/v2-commercial/process/beta-launch-coordination-board.md` on `origin/main`
- `docs/Tracks/v2-commercial/process/measurement-intelligence-agent-comms.md` on `origin/main`
- PR #288 Designer Path QA evidence and review comments
- `apps/web/app/projects/[projectId]/rooms/[roomId]/brief/details/page.tsx`
- `apps/web/app/actions.ts`
- `apps/web/app/projects/[projectId]/rooms/[roomId]/brief/floor-plan-uploader.tsx`
- `apps/web/app/projects/[projectId]/rooms/[roomId]/shopping-list/page.tsx`
- `packages/domain/src/measurement-intelligence.ts`
- `packages/domain/src/measurement-layout-seed.ts`
- `packages/domain/src/product-matching-confidence.ts`
- Existing docs-only Measurement/Floor Plan proof notes, including `34_Floor_Plan_Model_Decision_Brief.md`, `35_Measurement_Intelligence_Investor_Readiness_Pack.md`, `36_Measurement_Intelligence_Investor_Demo_Script.md`, `37_Measurement_Intelligence_Investor_Proof_Appendix.md`, and `38_Floor_Plan_Model_Investor_Proof_Notes.md`

## Findings

No measurement-related P0 or P1 blocker was found for the Wednesday operational beta.

Designer-path QA in PR #288 records the brief details/measurements step as passing. The only follow-up issues called out there are a P2 concept-completion spinner ambiguity and a P2 native file-picker fidelity gap for room photo upload automation. Neither is a Measurement Intelligence blocker.

Current room setup requires manual room measurements on the brief details step before the flow can proceed. The UI asks for main wall, room depth, and ceiling height in centimeters, labels the section required, and explains that these values keep sofa, table, chair, lighting, and rug recommendations from becoming misleading.

Server behavior reinforces that requirement. `saveDesignBriefAction` redirects back to details when wall length, room depth, or ceiling height is missing on the details step. Concept generation also checks the latest `room_measurements` row and redirects to details if required room size is absent.

The current confidence posture is conservative enough for beta. Saved manual measurements are recorded as source `manual` with confidence `verified`; reviewed layout seeds remain default-off structured facts, with `prefill` confidence and explicit disclaimers that they are not as-built dimensions or tight-clearance truth.

Floor-plan behavior is acceptable for beta because it is optional reference upload only. The live brief copy says project-level extraction and room labels are the next measurement upgrade; current code uploads a room-level floor-plan asset but does not parse it or use it as a sizing source.

Product-fit confidence behavior is bounded. Product Matching receives manual room measurements where available, emits dimension-fit confidence metadata, and surfaces missing or non-verified dimension warnings in shopping-list UI instead of silently claiming exact fit.

## Beta-Blocking Ambiguity

None found for operational beta, assuming beta positioning remains manual-measurement-first.

The main expectation risk is wording, not implementation: designers must understand that current beta fit confidence comes from manual entered dimensions, not automatic floor-plan extraction or native room scanning. Existing details-page copy and investor docs mostly preserve that boundary.

The optional floor-plan upload may invite some users to assume extraction is happening. The current copy already says extraction and room labels are a future upgrade, so this is not beta-blocking. Keep that wording intact for beta.

## Smallest Safe Follow-Up

No immediate code or schema follow-up is required for Measurement Intelligence before the operational beta.

If Sam wants one extra beta guardrail, the smallest safe follow-up is docs-only: add a one-line beta runbook note for designers and support saying, "Measurements are manual and required; floor plans are reference-only in this beta and are not parsed for sizing."

Do not widen into floor-plan model implementation, native measurement capture, browser measurement research, DB/schema/type changes, production behavior changes, or Product Matching/Catalog-First runtime coupling without explicit Sam approval.
