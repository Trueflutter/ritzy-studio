# 28 Measurement Intelligence Seed Candidate Shortlist

Status: docs-only seed-candidate shortlist
Date: 2026-05-25
Audience: Chief Architect, Sam
Source pack: `docs/Tracks/v2-commercial/26_Measurement_Intelligence_Source_Feasibility_Pack.md`

This document converts the source-feasibility pack into the smallest safe shortlist for a future reviewed structured-facts seed PR. It does not add seed data, migrations, generated DB types, Supabase writes, runtime wiring, UI, external parsers, private/user floor-plan assets, or raw copyrighted plan storage/display.

## Executive Recommendation

Proceed with a future repo-managed reviewed seed JSON candidate for only two layout families:

1. Murooj Al Furjan townhouse 4-bedroom corner/middle variants.
2. Maple at Dubai Hills Estate townhouse 4-bedroom Type 2E.

Do not include DAMAC Hills 2, Arabian Ranches III, or broader Elan variants in the first reviewed seed candidate. They remain useful research targets, but their source provenance or room-measurement coverage is weaker for the first real seed shape.

The next PR may add a reviewed seed JSON candidate only if it remains repo-local, structured-facts only, and default-off. It must not write to Supabase or expose raw plan assets.

## Selection Criteria

The shortlist favors candidates with:

- recognizable market aliases that users are likely to type
- stable community/development identity
- source posture that supports structured facts without republishing raw plan images
- enough room-label coverage to reduce onboarding friction
- conservative confidence defaults that keep prefills out of tight-clearance decisions
- clear stop criteria before any real seed file is accepted

## Candidate 1: Murooj Al Furjan 4-Bedroom Townhouse

### Proposed Stable Slugs

Recommended first seed slug:

- `murooj-al-furjan-townhouse-4br-corner-layout-a`

Possible follow-up slug after review:

- `murooj-al-furjan-townhouse-4br-middle-layout-a`

Do not mix villas and townhouses under these slugs. Villas need separate source review and separate slugs.

### Proposed Aliases

- `Murooj Al Furjan`
- `Murooj Al Furjan West`
- `Al Furjan Murooj`
- `Murooj 4 bedroom townhouse`
- `Murooj Al Furjan 4-bed corner`
- `Murooj Al Furjan 4 bedroom corner unit`
- `4 bedroom townhouse corner unit`
- `4BR corner townhouse`
- `Layout A`

### Source-Rights Status

Recommended rights status: `structured_facts_only`.

Use public sources as review references for structured facts such as community, developer, bedroom count, townhouse/corner variant, floor labels, room labels, BUA/area ranges, disclaimers, and source URLs. Do not store or display raw plan pages, screenshots, or brochure images unless a later rights-cleared source is obtained.

### Confidence Defaults

- Layout confidence: `prefill`
- Room measurement confidence: `prefill`
- Measurement source kind: `known_developer_layout`
- Fit policy: may support normal room-shape onboarding friction reduction only after user/designer confirmation gates remain visible
- Tight-clearance policy: not allowed

### Required Disclaimers

Every future seed record should carry disclaimers equivalent to:

- Developer and broker floor plans may be approximate and subject to change.
- This prefill is not an as-built measurement.
- User or designer confirmation is required before product-fit decisions.
- Raw floor-plan assets were not stored or republished.

### Expected Room Rows

Likely useful room rows for a first reviewed structured-facts seed:

| Floor | Room label | Normalized room type | Dimensions | Notes |
| --- | --- | --- | --- | --- |
| Ground | Living / dining | `living_room` or `open_living_dining` | Unknown or approximate only | Useful for room-list prefill; do not infer tight fit |
| Ground | Kitchen | `kitchen` | Unknown or approximate only | Preserve open/closed kitchen note if sourced |
| Ground | Maid's room | `maids_room` | Unknown | Include only if source confirms |
| Ground | Powder / bath | `bathroom` | Unknown | Optional support row |
| Ground | Storage / utility | `utility` | Unknown | Include only if source confirms |
| First | Master bedroom | `bedroom` | Unknown or approximate only | Mark primary/master label in notes, not as fit truth |
| First | Bedroom 2 | `bedroom` | Unknown or approximate only | No product-fit assumptions |
| First | Bedroom 3 | `bedroom` | Unknown or approximate only | No product-fit assumptions |
| First | Bedroom 4 | `bedroom` | Unknown or approximate only | No product-fit assumptions |
| First | Family / lobby | `family_room` or `hallway` | Unknown | Include only if source confirms |
| Exterior | Terrace / balcony / garden | `outdoor_area` | Unknown | Do not use for interior furnishing fit |

### Known Missing Measurements

- Exact length/width for most rooms.
- Ceiling heights.
- As-built wall offsets, openings, wardrobes, columns, and stair clearances.
- Renovation or handover variation by unit.
- Whether the corner and middle variants share identical room labels.

### Stop Criteria

Stop before adding this to a reviewed seed file if:

- the future source review cannot pin the record to townhouse, not villa
- the corner/middle variant is ambiguous
- room labels require storing or displaying raw floor-plan images to be useful
- source rights cannot be classified at least as `structured_facts_only`
- source disclaimers prohibit reuse of structured facts
- reviewers need Supabase writes, migrations, generated DB types, runtime wiring, or parser/OCR work

### Go / No-Go

Go for the next repo-managed reviewed seed JSON candidate, limited to structured facts and conservative confidence. This is the best first candidate.

## Candidate 2: Maple At Dubai Hills Estate 4-Bedroom Type 2E

### Proposed Stable Slug

- `maple-dubai-hills-townhouse-4br-type-2e`

Do not broaden the first seed to all Maple phases. Treat `Maple 1`, `Maple 2`, and `Maple 3` aliases as matching hints only until source review confirms phase-specific applicability.

### Proposed Aliases

- `Maple`
- `Maple Dubai Hills`
- `Dubai Hills Estate Maple`
- `Emaar Maple`
- `Maple 4 bedroom townhouse`
- `Maple 4BR Type 2E`
- `Type 2E`
- `Unit 2E`
- `2E`
- `4 bedroom Type 2E`
- `4 bedroom end unit`

### Source-Rights Status

Recommended rights status: `structured_facts_only`.

Use Emaar and reviewed public source pages for structured facts such as development, bedroom count, unit/type label, BUA/area range, floor labels, aliases, source URLs, and disclaimers. Do not store raw plan images, brochure screenshots, or proprietary PDFs.

### Confidence Defaults

- Layout confidence: `prefill`
- Room measurement confidence: `prefill`
- Measurement source kind: `known_developer_layout`
- Fit policy: may help assemble an initial room list and approximate room context only
- Tight-clearance policy: not allowed

### Required Disclaimers

Every future seed record should carry disclaimers equivalent to:

- Type 2E developer plans and public sources may be approximate.
- Maple subphases and upgraded homes may vary.
- This is a prefill, not an as-built measurement.
- User or designer confirmation is required before product-fit decisions.
- Raw floor-plan assets were not stored or republished.

### Expected Room Rows

Likely useful room rows for a first reviewed structured-facts seed:

| Floor | Room label | Normalized room type | Dimensions | Notes |
| --- | --- | --- | --- | --- |
| Ground | Living / dining | `living_room` or `open_living_dining` | Unknown or approximate only | First seed should not require exact dimensions |
| Ground | Kitchen | `kitchen` | Unknown or approximate only | Include only source-backed labels |
| Ground | Maid's room | `maids_room` | Unknown | Common source-backed Maple feature |
| Ground | Powder / bath | `bathroom` | Unknown | Optional support row |
| Ground | Storage / laundry | `utility` | Unknown | Include only if source confirms |
| First | Master bedroom | `bedroom` | Unknown or approximate only | Note master/primary semantics separately |
| First | Bedroom 2 | `bedroom` | Unknown or approximate only | No product-fit assumptions |
| First | Bedroom 3 | `bedroom` | Unknown or approximate only | No product-fit assumptions |
| First | Bedroom 4 | `bedroom` | Unknown or approximate only | No product-fit assumptions |
| Exterior | Garden / terrace / balcony | `outdoor_area` | Unknown | Do not use for interior furnishing fit |

### Known Missing Measurements

- Exact room length/width in machine-readable form.
- Ceiling heights.
- Phase-specific construction or upgrade variation.
- Exact distinction between `Type 2`, `Type 2E`, and market shorthand `2E` across all Maple subphases.
- As-built constraints such as door swings, window walls, stair landings, and wardrobe locations.

### Stop Criteria

Stop before adding this to a reviewed seed file if:

- the future source review cannot confirm `Type 2E` as a stable 4-bedroom end-unit townhouse label
- the record would need to rely on an unreachable or non-HTTPS floor-plan mirror
- room rows require raw plan-image storage/display
- source rights cannot be classified at least as `structured_facts_only`
- the seed would imply exact fit safety before confirmation
- reviewers need Supabase writes, migrations, generated DB types, runtime wiring, or parser/OCR work

### Go / No-Go

Go for the next repo-managed reviewed seed JSON candidate, but only after Murooj or in the same tiny PR if reviewers want exactly two records. Keep the first seed limited to Type 2E rather than the whole Maple catalog.

## Deferred Candidates

### Elan At Tilal Al Ghaf

Reason to defer: good candidate, but rights review should be explicit before room-level facts are promoted into a reviewed seed. It may be the next candidate after Murooj/Maple if partner/source permission becomes clearer.

Recommendation: defer for source-rights review or partner/feed/permission.

### DAMAC Hills 2 Violet / Natura

Reason to defer: useful aliases such as `Akoya Oxygen`, `TH12-4E`, and `TH12-4M` exist, but the source pack found weaker direct-developer source hygiene and higher risk of cluster/release ambiguity.

Recommendation: defer for partner/feed/permission or synthetic-only examples.

### Arabian Ranches III Joy / Ruba

Reason to defer: official project pages confirm the products and type families, but room-level measurements are likely image-derived and the previously reviewed Joy mirror was de-scoped.

Recommendation: defer or use only synthetic/sample examples.

## Recommendation For Next PR

Next PR recommendation: add a repo-managed reviewed seed JSON candidate for one or two records only:

1. `murooj-al-furjan-townhouse-4br-corner-layout-a`
2. optionally `maple-dubai-hills-townhouse-4br-type-2e`

The next PR should remain domain/data-file only and default-off. It should use the already approved seed dataset format and validation paths. It should not add a seed importer, database migration, generated DB type changes, Supabase writes, runtime wiring, UI, product matching coupling, parser/OCR integration, raw plan assets, or production data writes.

If reviewers want one more planning step before a seed JSON candidate, keep the next PR docs-only and require a line-by-line source review checklist for Murooj and Maple.

## Stop Rules

Do not proceed beyond this shortlist if the next step requires:

- DB/schema migration.
- Generated DB types.
- Supabase connections or writes.
- Runtime/UI/app-action wiring.
- Seed importer writes.
- Production data.
- External parser/vendor/OCR integration.
- Private/user floor-plan assets.
- Raw copyrighted plan images.
- Product Matching or Catalog-First runtime coupling.
- Production flags or deploys.
- Live customer-facing behavior.
