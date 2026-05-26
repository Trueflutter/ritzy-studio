# 35 Measurement Intelligence Investor Readiness Pack

Status: docs/domain-only investor readiness pack
Date: 2026-05-26
Audience: Sam, Chief Architect, investor-demo preparation
Related artifacts:
- `docs/Tracks/v2-commercial/process/measurement-intelligence-agent-comms.md`
- `docs/Tracks/v2-commercial/measurement-layout-seed.reviewed-candidates.json`
- `docs/Tracks/v2-commercial/26_Measurement_Intelligence_Source_Feasibility_Pack.md`
- `docs/Tracks/v2-commercial/28_Measurement_Intelligence_Seed_Candidate_Shortlist.md`
- PR #158: <https://github.com/Trueflutter/ritzy-studio/pull/158>

## Executive Summary

Measurement Intelligence has reached a pitch-useful, low-risk proof point: Ritzy now has a repo-managed reviewed seed-candidate shape for repeated Dubai townhouse layouts, with two default-off `structured_facts_only` candidates and no live database/runtime exposure.

This is not a product-fit guarantee and not an as-built measurement source. The current value is investor-visible domain readiness:

- the team can identify repeatable UAE home layout families;
- reviewed structured facts can reduce onboarding friction later;
- provenance, rights posture, confidence, and disclaimers are first-class;
- future DB/runtime work has clear approval gates and hard stops.

## State After PR #158

PR #158 completed the Maple at Dubai Hills Estate 4-bedroom Type 2E reviewed structured-facts seed JSON candidate and merged it into `main`.

Current durable state:

- Current active Measurement Intelligence PR: none.
- Current stage: `MAPLE_REVIEWED_SEED_CANDIDATE_COMPLETE_WAITING_FOR_CHIEF_SAM_ROUTING`.
- DB/runtime stage: `DB_SCHEMA_RUNTIME_BLOCKED_WAITING_FOR_SAM_APPROVAL`.
- Live ingestion/import/write path: blocked.
- Runtime/UI/app wiring: blocked.
- Private/user floor-plan assets: blocked.

## Completed Seed Candidates

The reviewed seed candidate file currently contains two default-off candidates. They are repo-local reviewed facts only; they are not imported, not written to Supabase, and not exposed in runtime behavior.

| Candidate | Community | Source posture | Confidence posture | Room coverage | Runtime status |
| --- | --- | --- | --- | --- | --- |
| `murooj-al-furjan-townhouse-4br-corner-layout-a` | Al Furjan | `structured_facts_only` | `prefill`; not fit-safe | 9 room-label rows, no as-built dimensions | Default-off candidate only |
| `maple-dubai-hills-townhouse-4br-type-2e` | Dubai Hills Estate | `structured_facts_only` | `prefill`; not fit-safe | 9 room-label rows, no as-built dimensions | Default-off candidate only |

Completed coverage is deliberately narrow:

- stable community/development identifiers;
- aliases users may type;
- developer/layout-family labels where reviewed;
- floor-level room labels;
- source links and rights posture;
- conservative notes and disclaimers;
- no raw plan images, screenshots, PDFs, or user/private assets.

## Structured-Facts-Only Policy

Measurement Intelligence should continue to use public and reviewed sources only for structured facts, not for raw asset republishing.

Allowed in the current posture:

- community, developer, bedroom count, property type, and layout-family labels;
- known aliases such as `Layout A`, `Type 2E`, or `4BR corner townhouse`;
- BUA/area ranges when source-backed;
- floor labels and room labels when source-backed;
- source URLs, source labels, rights status, notes, and disclaimers;
- conservative confidence markers such as `prefill`.

Not allowed without separate rights and implementation approval:

- storing raw floor-plan images, screenshots, PDFs, or brochure pages;
- displaying raw copyrighted floor-plan assets;
- treating public plan images as exact as-built measurements;
- deriving tight-clearance product-fit decisions from these seeds;
- using private user-uploaded floor plans as shared-library source material.

## Provenance And Confidence Posture

The pitch posture is "credible prefill, never silent truth."

Every reviewed candidate should remain grounded in:

- source provenance: URLs and labels for reviewed public sources;
- rights posture: `structured_facts_only` unless a stronger partner/license grant exists;
- measurement confidence: `prefill`, not confirmed/as-built;
- explicit disclaimers: user or designer confirmation required before product-fit decisions;
- omission discipline: dimensions stay omitted unless reviewed sources prove structured facts.

This keeps Measurement Intelligence useful for investor storytelling without overstating accuracy. The product promise is not "we know every wall"; it is "we can safely bootstrap repeated home-layout context, then require confirmation before fit decisions."

## Future DB/Runtime Phase Requirements

A future DB/runtime phase should require a separate approved PR sequence. At minimum, it needs:

1. Sam approval for database/schema work and the user-facing behavior.
2. A reviewed migration plan that defines layout seed tables, source provenance, rights status, confidence, publication state, and audit fields.
3. Supabase migrations and generated DB type updates in a dedicated PR.
4. A dry-run importer that proves reviewed seed candidates can map to future rows without writes.
5. Explicit approval before any Supabase writes or seed publication.
6. Runtime gates that keep prefills default-off or confirmation-gated until enabled.
7. UI copy that clearly separates suggested layout prefills from as-built measurements.
8. QA for false-positive alias matching, variant ambiguity, missing dimensions, and user override behavior.

Until that sequence is approved, the reviewed candidate JSON remains a repo-local planning and validation artifact only.

## Explicitly Blocked

This pack does not approve and must not be used to justify:

- Supabase migrations;
- generated DB type updates;
- Supabase connections or writes;
- seed importer writes;
- production data imports;
- runtime/UI/app-action wiring;
- floor-plan parser, OCR, vendor, or partner-feed integrations;
- user/private floor-plan assets;
- raw copyrighted floor-plan image/PDF storage or display;
- Product Matching runtime coupling;
- Catalog-First runtime coupling;
- production flags, deploys, or live customer-facing behavior;
- payment/checkout changes.

## Next Candidate Posture

There is no low-risk next reviewed seed candidate approved in durable mailbox state after PR #158.

Already documented future candidates include Elan at Tilal Al Ghaf, DAMAC Hills 2 Violet/Natura, and Arabian Ranches III Joy/Ruba, but they remain deferred or require source-rights review. They should not be implemented as reviewed seed records without explicit Chief Architect/Sam routing.

If the team wants visible progress without runtime risk, the next safest scope would be docs-only routing for one of these:

- a source-rights review checklist for Elan at Tilal Al Ghaf;
- a partner/license evidence checklist for richer floor-plan use;
- an investor-demo narrative showing how Murooj and Maple reduce onboarding friction while staying confirmation-gated.

Those are proposals only. No next seed implementation is approved by this document.

## Investor Talk Track

Measurement Intelligence is ready to describe as a governed capability in progress:

- "We are building a reviewed UAE layout intelligence layer, starting with repeated townhouse communities."
- "The first candidates are structured facts only, not raw floor-plan redistribution."
- "Confidence and provenance travel with every prefill."
- "Runtime use will require confirmation gates before any product-fit decision."
- "The next phase is ready to scope, but DB writes and live behavior remain approval-gated."

This shows progress while preserving legal, privacy, data-quality, and product-safety boundaries.
