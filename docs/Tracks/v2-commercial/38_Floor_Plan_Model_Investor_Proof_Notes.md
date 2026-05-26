# 38 Floor Plan Model Investor Proof Notes

Status: docs-only floor-plan/model proof notes
Date: 2026-05-26
Audience: Sam, Chief Architect, investor-pitch preparation
Inputs:

- PR #179: `docs/Tracks/v2-commercial/34_Floor_Plan_Model_Decision_Brief.md`
- PR #182: `docs/Tracks/v2-commercial/36_Measurement_Intelligence_Investor_Demo_Script.md`
- Existing default-off reviewed structured-facts framing from PR #177 and reviewed seed candidates

## Scope

This note provides only the floor-plan/model section for the investor proof narrative.

It does not approve or add DB migrations, generated DB types, Supabase connections or writes, seed writes, runtime/UI/app actions, OCR/vendor/parser integration, private/user floor-plan assets, raw copyrighted plan storage/display, Product Matching runtime coupling, Catalog-First runtime coupling, production flags, deploys, payment/checkout changes, or live customer-facing behavior.

## Floor-Plan Proof Point

The safe proof is not "Ritzy parses floor plans automatically." The safe proof is that Ritzy has a governed floor-plan strategy:

- known Dubai villa/townhouse layouts can provide reviewed structured facts;
- structured facts can reduce blank-page onboarding without storing raw plan assets;
- confidence, provenance, rights posture, and disclaimers travel with the prefill;
- fit-critical dimensions remain manual/user/designer-confirmed;
- parser/vendor/OCR work is future evaluation only and blocked until approved.

Investor-safe one-liner:

> We use reviewed layout facts to make measurement capture faster, then confirm the dimensions that matter before furniture-fit decisions.

## Demo-Safe Floor-Plan Talk Track

> Floor plans are valuable, but they are also sensitive and often copyrighted. Our current approach is intentionally conservative: we do not need to show or store raw plans to prove the workflow. We can start with reviewed structured facts from repeated Dubai layout families, use them as confidence-labeled prefills, and ask the customer or designer to confirm the few dimensions that affect fit. Future extraction from uploaded plans is an approval-gated path, not something we claim as live today.

## Sensitive Floor-Plan Handling Principles

- Treat floor plans as high-sensitivity residential data.
- Do not store or display raw copyrighted plan images in the shared library.
- Do not use private/user floor plans as shared seed material.
- Prefer source URLs, reviewed facts, rights posture, confidence labels, and disclaimers over raw asset storage.
- Keep public developer/broker references at `structured_facts_only` unless rights are explicitly cleared.
- Do not send user/private plans to parser, OCR, or vendor services without explicit consent and approval.
- Require confirmation before any fit-sensitive product claim.

## Claims To Avoid

Avoid these statements:

- "Ritzy automatically parses floor plans today."
- "Ritzy stores customer floor plans for shared intelligence."
- "Ritzy knows exact as-built measurements."
- "Public floor-plan images can be reused freely."
- "Developer floor plans are enough for tight-clearance fit."
- "Product Matching can certify fit from a prefilled layout alone."
- "OCR/vendor/parser integration is already implemented."

Use these instead:

- "reviewed structured facts"
- "prefill"
- "confidence-labeled"
- "confirmation-gated"
- "manual measurement fallback"
- "future extraction evaluation"

## What Remains Blocked

Blocked until explicit Chief Architect/Sam approval:

- DB/schema migrations.
- Generated DB type changes.
- Supabase connections or writes.
- Seed importer writes or real seed writes.
- Runtime/UI/app-action wiring.
- Production data processing.
- OCR, parser, vendor SDK, CAD, RoomPlan, scan, or partner-feed integration.
- Private/user floor-plan assets.
- Raw copyrighted floor-plan storage or display.
- Product Matching or Catalog-First runtime coupling.
- Production flags, deploys, payment/checkout changes, or live customer-facing behavior.

## Closing Proof Line

> The floor-plan story is credible because it is restrained: reviewed facts reduce friction, confirmed measurements protect fit, and sensitive/raw plan handling stays blocked until the right approvals exist.
