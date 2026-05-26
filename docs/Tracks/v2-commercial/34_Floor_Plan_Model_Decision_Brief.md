# 34 Floor Plan Model Decision Brief

Status: docs-only investor-readiness decision brief
Date: 2026-05-26
Audience: Sam, Chief Architect, investor narrative reviewers
Related docs:

- `docs/Tracks/v2-commercial/18_Measurement_Intelligence_Data_Model_Proposal.md`
- `docs/Tracks/v2-commercial/20_Measurement_Intelligence_Migration_Plan_Not_Applied.md`
- `docs/Tracks/v2-commercial/26_Measurement_Intelligence_Source_Feasibility_Pack.md`
- `docs/Tracks/v2-commercial/28_Measurement_Intelligence_Seed_Candidate_Shortlist.md`
- `docs/Tracks/v2-commercial/measurement-layout-seed.reviewed-candidates.json`

## Scope

This brief clarifies the floor-plan path for investor-readiness. It is planning and evaluation only.

This PR does not add a parser, vendor SDK, OCR integration, Supabase migration, generated DB types, runtime wiring, UI, seed importer write path, user/private floor-plan asset handling, production flags, deploys, or live customer-facing behavior.

## Executive Decision

Ritzy can safely describe a conservative, credible floor-plan strategy today:

1. Use known Dubai developer-layout structured facts to reduce onboarding friction.
2. Treat every developer-layout match as a prefill, not as as-built truth.
3. Ask the user or designer to confirm fit-sensitive measurements before product-fit claims.
4. Keep raw floor-plan images and PDFs out of the shared layout library unless rights and privacy are explicitly cleared.
5. Evaluate parser/vendor/OCR options behind a consented, non-runtime pilot before approving any production integration.

The investor-safe demo fallback is:

> Ritzy can start from user-entered measurements and reviewed structured layout facts, then clearly label confidence and ask for confirmation before sizing furniture.

That is a strong enough story for a pitch because it shows the path to lower-friction measurement capture without implying that the product already parses private floor plans or guarantees exact furniture fit.

## What We Can Safely Claim Now

- Ritzy has a documented Measurement Intelligence strategy for Dubai villa/townhouse layouts.
- Public developer and broker sources can support reviewed structured facts such as community, development, bedroom count, layout/type aliases, floor labels, room labels, built-up area ranges, provenance URLs, rights posture, and disclaimers.
- The current reviewed seed candidates are default-off, prefill-only, and `structured_facts_only`.
- The current posture explicitly avoids storing or displaying raw copyrighted plan images.
- Product-fit confidence should remain bounded by the best available measurement source.
- User-entered or designer-confirmed measurements can be demoed as the reliable path for fit-sensitive dimensions.
- Floor-plan parser/vendor/OCR evaluation can be framed as a future acceleration layer, not a dependency for the investor demo.

Recommended pitch wording:

> We are building a measurement intelligence layer that can prefill likely room context from reviewed Dubai layout facts, then asks the customer to confirm fit-critical dimensions before furniture recommendations.

## What We Cannot Claim Yet

Do not claim:

- Ritzy automatically parses arbitrary floor-plan PDFs/images in production.
- Ritzy has integrated a floor-plan parser, OCR vendor, CAD engine, RoomPlan capture flow, or partner feed.
- Ritzy stores private user floor plans or copyrighted developer plan images safely in production.
- Ritzy has a live Supabase-backed layout library or importer write path.
- Ritzy knows exact as-built measurements for Dubai homes.
- Developer/broker floor plans are accurate enough for tight furniture clearance without confirmation.
- Product Matching can certify fit from a prefilled layout alone.
- Raw plan images can be displayed, redistributed, or used as marketing assets without rights review.

Recommended investor-safe boundary:

> Today this is a reviewed structured-facts and manual-confirmation path. Automated extraction is a planned evaluation lane, not a shipped runtime feature.

## Privacy And Copyright Risk

Floor plans are high-sensitivity residential data. They can reveal entrances, windows, doors, room usage, family routines, security-relevant circulation, and sometimes possessions or renovation details.

Copyright risk is also material. Developer brochures, broker floor-plan images, and PDF mirrors may be publicly accessible but still not licensed for storage, redistribution, model training, or user-facing display.

Operational rules:

- Separate raw assets from structured facts.
- Prefer source URLs, reviewed facts, rights posture, confidence labels, and disclaimers over raw image/PDF storage.
- Do not send user/private plans to third-party parsers without explicit disclosure and consent.
- Do not use private/user plans as shared-library seed material.
- Do not use raw plan images in pitch demos unless they are synthetic, owned, licensed, or explicitly permissioned.
- Treat public source facts as `structured_facts_only` unless rights review approves a stronger posture.
- Preserve deletion expectations for any future user-uploaded asset and its derived measurements.
- Keep all prefilled facts out of tight-clearance or order-ready claims until confirmed.

## Recommended Future Architecture

The recommended architecture is layered, consent-first, and confidence-aware.

### Layer 1: Manual And Confirmed Measurements

Source: user or designer enters wall length, room depth, ceiling height, key openings, and fit constraints.

Use for:

- investor demo
- product-fit checks where dimensions are present
- tight-clearance decisions only when measurements are confirmed

Confidence:

- `user_confirmed` after explicit user confirmation
- `verified` only after designer/as-built verification

### Layer 2: Reviewed Structured Layout Facts

Source: repo-reviewed seed candidates and future reviewed library records.

Use for:

- community/development/type matching
- room-list prefill
- likely floor and room labels
- approximate room context
- onboarding friction reduction

Confidence:

- `prefill`
- never enough alone for tight-clearance claims

Raw asset posture:

- do not store/display raw copyrighted plan images
- keep provenance URLs and disclaimers
- classify rights as `structured_facts_only` unless explicitly cleared

### Layer 3: Consented User Upload Extraction

Source: user uploads a PDF/image plan and explicitly consents to extraction.

Future processing boundary:

- create a private raw asset record only after storage and deletion policy are approved
- run parser/OCR in an isolated evaluation or approved runtime service
- extract structured facts and candidate measurements
- show extracted values for confirmation before they become operational measurements
- store parser confidence and source provenance separately from active room measurements

This layer is not approved for implementation in this PR.

### Layer 4: Parser/Vendor/OCR Evaluation Harness

Source: synthetic or rights-cleared plans, later consented test uploads.

Evaluation harness should be offline or dry-run first:

- no Supabase writes
- no production user data
- no runtime product-fit decisions
- no automatic shared-library publication
- deterministic outputs for review
- parser output normalized into the future row-shape plan rather than directly into runtime tables

### Layer 5: Production Import Path

This is blocked until Sam approves DB/schema/runtime work.

Before production:

- migration and RLS must be approved
- generated DB types must be regenerated through the normal process
- user consent, retention, deletion, and vendor data-processing posture must be documented
- fallback behavior must be available when extraction is low-confidence
- product-fit gates must remain conservative

## Parser/Vendor/OCR Evaluation Criteria

Any parser/vendor/OCR option should be evaluated against these criteria before integration.

### Input Coverage

- PDF, JPG, PNG, and scanned brochure support.
- Handles multi-floor villa/townhouse plans.
- Handles mirrored layouts, type variants, and phase-specific naming.
- Handles imperial and metric labels.
- Handles rotated, low-resolution, watermarked, or broker-compressed plans.
- Can process synthetic and rights-cleared test fixtures without live uploads.

### Extracted Output Quality

- Room labels and floor labels.
- Wall length and room depth where printed.
- Area, BUA, and plot size where present.
- Door/window/opening recognition.
- Stair, corridor, terrace, balcony, and garden boundaries.
- Units and scale calibration.
- Confidence per extracted field.
- Source bounding boxes or audit metadata for human review.
- Deterministic JSON/CSV export suitable for dry-run diffs.

### Accuracy And Fit Safety

- Measures against a rights-cleared truth set.
- Reports tolerance by field type, not just one aggregate score.
- Distinguishes printed dimensions from inferred dimensions.
- Fails closed when scale is unknown.
- Flags missing or ambiguous units.
- Does not promote inferred values to `user_confirmed` or `verified`.
- Supports a manual review workflow before values affect fit claims.

### Privacy And Security

- Clear data retention controls.
- Explicit deletion support.
- Region, subprocessors, and data-processing terms reviewed.
- No training on user uploads unless explicitly permitted.
- Private assets not exposed through public library reads.
- Audit trail for who uploaded, reviewed, confirmed, edited, or deleted extracted data.

### Rights And Commercial Terms

- License allows the intended processing and storage of derived structured facts.
- Terms do not restrict extracting facts from plans the user has rights to submit.
- Clear posture for public developer/broker plan references.
- No hidden requirement to display vendor watermarks or host user assets externally.
- Predictable pricing at demo, pilot, and production volume.

### Engineering Fit

- Stable API and documented schemas.
- Supports dry-run mode and saved fixtures.
- Does not require runtime coupling before evaluation.
- Can be wrapped behind a provider interface.
- Emits useful error codes for manual fallback.
- Can map cleanly into future Measurement Intelligence row shapes.
- Does not require Product Matching, Catalog-First, or UI changes for initial evaluation.

### Stop Criteria

Stop the vendor/parser path if:

- rights or retention terms are unclear
- uploads are used for training without acceptable opt-out
- extracted values cannot provide per-field confidence
- outputs are non-deterministic without audit traces
- room dimensions are mostly inferred from low-quality images
- the vendor requires production data before evaluation
- integration requires DB/schema/runtime/UI changes before Sam approval
- the parser encourages exact fit claims without confirmation

## Demo-Safe Fallback

The fallback should be the primary investor demo path until parser/vendor work is approved.

### Flow

1. User selects or enters community, development, and property type.
2. Ritzy suggests likely room labels from reviewed structured facts when available.
3. User enters key measurements for the active room.
4. Ritzy labels values as user-entered or prefill.
5. Product-fit messaging uses confirmed measurements only.
6. Unknown or prefill-only dimensions produce clear warnings instead of fit guarantees.

### Demo Copy

Use:

- "Likely layout prefill"
- "Confirm before furniture sizing"
- "Measurement confidence: prefill"
- "User-entered measurement"
- "Fit check unavailable until dimensions are confirmed"

Avoid:

- "Auto-measured"
- "As-built verified"
- "Exact fit"
- "AI parsed this floor plan"
- "Ritzy knows your villa dimensions"

## Investor Narrative

Investor-safe narrative:

> The current product can demonstrate the trust loop: capture the customer's room context, use reviewed structured facts where available, and require confirmation before sizing furniture. The next technical milestone is an evaluation harness for floor-plan extraction providers, using synthetic or rights-cleared fixtures before any private user uploads, vendor processing, or live database writes.

Why this is credible:

- It avoids overclaiming a hard computer-vision problem.
- It aligns with the existing Measurement Intelligence data model plan.
- It turns floor plans into a controlled confidence/provenance layer rather than a black-box promise.
- It preserves a practical demo path today through user-entered measurements and reviewed structured facts.

## Recommended Next Steps

1. Keep investor demo on manual measurements plus reviewed structured facts.
2. Prepare a separate, explicitly approved parser/vendor evaluation PR only after Sam approves the evaluation scope.
3. Use synthetic or rights-cleared floor-plan fixtures for the first extraction benchmark.
4. Define the parser output contract before any SDK/vendor integration.
5. Keep DB/schema/runtime/importer work blocked until Sam approves it separately.

## Not Applied

This brief does not apply, implement, or approve:

- floor-plan parser integration
- OCR or vendor SDKs
- RoomPlan, CAD, or scan imports
- Supabase migrations
- generated DB types
- Supabase connections or writes
- seed importer writes
- runtime/UI/app-action wiring
- production data processing
- private/user floor-plan assets
- raw copyrighted floor-plan image storage or display
- Product Matching or Catalog-First runtime coupling
- production flags, deploys, payment/checkout changes, or live customer-facing behavior
