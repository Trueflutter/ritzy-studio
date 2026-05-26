# 36 Measurement Intelligence Investor Demo Script

Status: docs-only investor demo script
Date: 2026-05-26
Audience: Sam, Chief Architect, investor-demo preparation
Inputs:

- PR #177: `docs/Tracks/v2-commercial/35_Measurement_Intelligence_Investor_Readiness_Pack.md`
- PR #179: `docs/Tracks/v2-commercial/34_Floor_Plan_Model_Decision_Brief.md`

## Scope

This script turns the completed Measurement Intelligence and Floor Plan Model planning artifacts into a safe investor-demo talk track.

It does not approve or add parser/vendor/OCR integration, migrations, generated DB types, Supabase connections or writes, seed importer writes, runtime/UI/app actions, private/user floor-plan assets, raw copyrighted assets, production flags, deploys, payment/checkout changes, or live customer-facing behavior.

## Safe Measurement Intelligence Claim

Ritzy is building a governed Measurement Intelligence layer for repeated Dubai villa and townhouse layouts.

Safe claims:

- We have identified a practical source of onboarding leverage: repeated developer layout families in Dubai communities.
- We already have a repo-managed reviewed seed-candidate shape for two narrow examples: Murooj Al Furjan and Maple at Dubai Hills Estate.
- These records are default-off, prefill-only, and `structured_facts_only`.
- Provenance, rights posture, confidence, and disclaimers are part of the data model from the start.
- Reviewed layout facts can help prefill likely community, layout, floor, and room context.
- Fit-sensitive measurements still require user or designer confirmation before furniture sizing claims.

Investor-safe phrasing:

> We can reduce measurement friction by starting from reviewed Dubai layout facts, then asking the customer to confirm the dimensions that matter for furniture fit.

## Demo Flow

Use this sequence in the investor demo:

1. Show the user entering a community or known layout phrase, such as a Dubai townhouse community and bedroom count.
2. Explain that Ritzy can use reviewed structured facts to suggest likely room context where the home belongs to a repeatable layout family.
3. Show manual measurement capture as the trust anchor: wall length, room depth, ceiling height, and any fit-critical constraints.
4. Label every suggested value as prefill until confirmed.
5. Show that Product Matching or furniture sizing should only make stronger fit statements after confirmed measurements exist.
6. Explain that future floor-plan extraction is an evaluation lane, not a current runtime dependency.

Demo-safe screen narration:

> The product does not need to pretend it can see through walls. It can start with a likely layout, ask for the few dimensions that affect fit, and carry confidence forward so the recommendation engine knows what is trusted and what is only suggested.

## Manual Measurements Plus Reviewed Structured Facts

Manual measurements are the demo-safe source of truth for fit-sensitive dimensions.

Reviewed structured facts are useful for:

- likely community and development identity;
- layout aliases users may type;
- floor labels;
- room labels;
- property type and bedroom count;
- BUA or area ranges when source-backed;
- provenance URLs and source labels;
- confidence and rights posture.

Manual measurements are required for:

- wall length;
- room depth;
- ceiling height;
- tight clearance;
- product width/depth/height fit;
- uncertain openings, stair positions, wardrobes, and renovated conditions.

The pitch value is the combination:

> Structured facts reduce blank-page onboarding; manual confirmation keeps furniture-fit claims honest.

## Floor-Plan Claims To Avoid

Do not say:

- "Ritzy automatically parses floor plans today."
- "We have a live floor-plan OCR pipeline."
- "We store customer floor plans for shared layout intelligence."
- "We can guarantee exact as-built room dimensions."
- "Developer floor plans are enough for tight furniture clearance."
- "The system certifies product fit from a prefilled layout."
- "We can display or reuse public floor-plan images freely."
- "Parser/vendor/OCR integration is already implemented."
- "The layout seed candidates are live production data."

Use instead:

- "reviewed structured facts"
- "prefill"
- "confidence-labeled"
- "confirmation-gated"
- "manual measurement fallback"
- "future parser/vendor evaluation"

## Future Milestones And Approval Gates

### Milestone 1: Demo-Safe Measurement Capture

Allowed story:

- user-entered measurements;
- reviewed structured facts;
- confidence labels;
- clear warnings when fit cannot be checked.

Approval gate:

- no additional approval needed for the narrative, but runtime/UI changes still require their own scoped PR.

### Milestone 2: More Reviewed Structured-Facts Seeds

Allowed only after explicit routing:

- additional default-off reviewed seed candidates;
- source-rights review;
- conservative confidence and disclaimers.

Approval gate:

- Chief Architect/Sam must approve each next seed scope.

### Milestone 3: Parser/Vendor/OCR Evaluation

Allowed only after explicit routing:

- synthetic or rights-cleared fixtures;
- dry-run evaluation;
- output contract review;
- privacy, retention, and rights assessment.

Approval gate:

- Sam must approve any use of private/user assets, vendor processing, or parser/OCR integration.

### Milestone 4: DB/Runtime Write Path

Blocked until separately approved:

- Supabase migrations;
- generated DB types;
- seed importer writes;
- live measurement-library reads;
- runtime/UI/app-action wiring;
- Product Matching fit behavior that uses prefilled measurements.

Approval gate:

- explicit Sam approval for schema, writes, and user-facing behavior.

## Short Founder / Investor Talk Track

> One of the hard parts of interiors is that style is subjective, but dimensions are unforgiving. Ritzy is approaching measurement as a trust layer, not a magic trick. For Dubai villas and townhouses, many homes repeat the same developer layout families, so we can use reviewed structured facts to prefill likely room context and reduce onboarding friction. But we do not treat that prefill as truth. The customer or designer confirms the measurements that affect furniture fit, and every downstream recommendation carries that confidence. Today the safe demo is manual measurements plus reviewed structured facts. The future path is a consented extraction layer for floor plans, evaluated behind strict privacy, copyright, and accuracy gates before anything touches production.

## Closing Line

> The promise is not "we know every home automatically." The promise is "we make measurement easier, transparent, and safer before furniture decisions become expensive."

## Not In This PR

- Parser/vendor/OCR integration.
- Migrations or generated DB types.
- Supabase connections or writes.
- Seed importer writes.
- Runtime/UI/app actions.
- Production data processing.
- Private/user floor-plan assets.
- Raw copyrighted asset storage or display.
- Product Matching or Catalog-First runtime coupling.
- Production flags, deploys, payment/checkout changes, or live behavior.
