# 16 Measurement Intelligence PRD

## Purpose

Ritzy needs room measurements that are trustworthy enough to protect furniture fit without making onboarding feel like a chore.

The current web flow requires users to manually enter the main wall, room depth, and ceiling height before concept generation. That is correct from a trust standpoint, but it creates friction. Many Dubai villas and townhouses are built from repeatable developer layouts by community, phase, bedroom count, and unit type. Ritzy can use that local structure to prefill likely room dimensions, then ask the user to confirm before sizing furniture.

This PRD defines the Measurement Intelligence track: a confidence-aware system for combining manual measurements, uploaded floor plans, known developer layouts, and future scan/import sources into one trusted room measurement model.

## Product Principle

Measurement prefill is allowed. Silent measurement certainty is not.

Ritzy may say:

> Ritzy may already know your villa or townhouse layout. Select your community and type, then confirm the room dimensions before we size furniture.

Ritzy must not say:

> Ritzy knows the exact as-built dimensions of every Dubai villa.

## Strategic Relationship To Other Tracks

Measurement Intelligence supports both:

- Product Matching Engine: better fit scoring and tighter warnings.
- Catalog-First Room Generation: better bundle assembly before image generation.

This track should not block either track. Its first PRs should be pure domain/data planning until the database model and UX are approved.

## Current State

Existing app support:

- `room_measurements` table already stores wall length, room depth, ceiling height, source, confidence, notes, and optional floor-plan asset.
- `measurement_source` currently supports `manual`, `floor_plan`, `annotation`, and `estimated`.
- Brief details screen now requires measurements before design generation.
- Product matching can already use wall length and room depth for basic dimension fit notes.

Known gap:

- The app treats room measurement as user-entered values, not a source-backed measurement model.
- Floor plan upload is currently room-level and optional, while most users have whole-home floor plans.
- Known Dubai developer layouts are not represented.
- Measurement confidence is too coarse for future fit decisions.

## User Experience Target

The ideal path:

1. User starts a project.
2. Ritzy asks for community/project/type information.
3. If Ritzy has likely layouts, it shows candidate layouts.
4. User selects the closest match or says "not sure."
5. User chooses the room or design zone.
6. Ritzy pre-populates room measurements.
7. User confirms or edits.
8. Product matching and bundle generation use the confirmed measurement source with confidence metadata.

Fallback paths:

- Upload a full-home floor plan.
- Upload a room-only floor plan.
- Enter measurements manually.
- Later, import native scan/third-party scan output.

## Source Types

The system should eventually distinguish:

- `manual`: user typed measurements directly.
- `floor_plan_upload`: user uploaded a plan and confirmed/extracted values.
- `known_developer_layout`: Ritzy prefilled from curated Dubai villa/townhouse layout data.
- `third_party_scan_import`: imported from a vendor/tool such as magicplan, CubiCasa, RoomScan, Canvas, or Polycam.
- `native_room_scan`: future Ritzy native app capture.
- `designer_verified`: confirmed by designer, handover report, or professional measurement.
- `estimated`: low-confidence fallback; should not certify tight fit.

Do not rush this enum migration. It needs a reviewed Supabase migration and generated type update.

## Confidence Model

Suggested confidence tiers:

- `unknown`: no reliable source.
- `low`: estimate, weak parse, or unconfirmed layout.
- `medium`: known developer layout or parsed floor plan not yet verified.
- `high`: user confirmed or edited measurements.
- `verified`: designer/as-built/manual laser/professional verification.

Product use:

| Measurement State | Product Matching Behavior |
|---|---|
| No measurement | Block design/sourcing where fit would be misleading. |
| Estimated/unconfirmed | Allow broad design prefill only; avoid tight-fit claims. |
| Known developer layout, unconfirmed | Prefill only; require confirmation before sizing. |
| User-confirmed known layout | Use for approximate fit; warn on tight clearances. |
| Manual/user measured | Use for fit scoring; still warn where product dimensions are incomplete. |
| Designer verified | Highest trust; usable for tighter fit decisions. |

## Developer Layout Library

Ritzy should build a curated Dubai villa/townhouse layout library as app data.

MVP target:

- 50-100 layouts.
- 5-10 high-volume communities.
- Focus on villas/townhouses, not apartments.
- Capture rooms relevant to Ritzy's current app scope: living rooms, dining rooms, bedrooms, and home offices.

Candidate communities:

- DAMAC Hills 2
- Al Furjan
- Murooj Al Furjan
- Tilal Al Furjan
- Arabian Ranches 3
- Dubai Hills Estate
- Emaar South
- Mudon / Arabella
- Town Square
- Villanova
- Tilal Al Ghaf

## Proposed Data Model

Do not implement this schema without explicit approval. This is the target shape for review.

### `property_communities`

Represents user-facing location groupings.

Key fields:

- `id`
- `country`
- `city`
- `community_name`
- `normalized_slug`
- `developer_name`
- `status`
- `created_at`
- `updated_at`

### `property_developments`

Represents a specific project, phase, cluster, or subcommunity.

Key fields:

- `id`
- `community_id`
- `development_name`
- `phase_name`
- `developer_name`
- `normalized_slug`
- `handover_status`
- `created_at`
- `updated_at`

### `property_layouts`

Represents a known villa/townhouse layout.

Key fields:

- `id`
- `development_id`
- `property_type`: `villa | townhouse | apartment | unknown`
- `bedroom_count`
- `unit_type_code`
- `marketing_type_name`
- `corner_middle_end`
- `facade_variant`
- `mirror_variant`
- `floor_count`
- `built_up_area_sqft`
- `built_up_area_sqm`
- `plot_area_min_sqft`
- `plot_area_max_sqft`
- `source_rights_status`
- `confidence`
- `last_verified_at`
- `notes`

### `property_layout_aliases`

Supports fuzzy user input and messy naming.

Key fields:

- `id`
- `property_layout_id`
- `alias`
- `normalized_alias`
- `alias_source`
- `confidence`

### `property_layout_rooms`

Stores structured room-level measurements.

Key fields:

- `id`
- `property_layout_id`
- `floor_level`
- `room_name`
- `normalized_room_type`
- `length_cm`
- `width_cm`
- `ceiling_height_cm`
- `area_sqm`
- `geometry_json`
- `doors_json`
- `windows_json`
- `confidence`
- `notes`

### `property_layout_sources`

Stores provenance and rights metadata.

Key fields:

- `id`
- `property_layout_id`
- `source_url`
- `source_type`: `developer_pdf | developer_page | broker_pdf | portal_page | user_upload | partner_feed | manual_entry`
- `source_title`
- `source_rights_status`: `internal_reference_only | rights_cleared | user_owned_upload | partner_supplied | unknown`
- `extracted_at`
- `reviewed_at`
- `reviewed_by`
- `notes`

### `room_measurement_sources`

Links an actual room to the chosen measurement source.

Key fields:

- `id`
- `room_id`
- `property_layout_id`
- `property_layout_room_id`
- `floor_plan_asset_id`
- `source`
- `confidence`
- `user_confirmed_at`
- `user_edited_at`
- `designer_verified_at`
- `metadata_json`

## Minimum Geometry Model

MVP should not attempt full CAD.

MVP required:

- length
- width/depth
- ceiling height where known
- floor level
- room label
- normalized room type
- source confidence
- notes/disclaimer

V2:

- door/window positions as structured JSON.
- built-ins/immovable features.
- open-plan design zone dimensions.
- mirrored layout flag.
- approximate polygon for non-rectangular rooms.

Geometry should be additive. The first implementation should not block on perfect floor-plan parsing.

## Fit Rules

Product matching should treat measurements by confidence:

- Generous clearance: confirmed developer layout may be acceptable.
- Tight clearance: require manual or designer-verified measurement.
- Missing product dimensions: show warning even if room measurements are strong.
- Unconfirmed developer layout: prefill only, do not present as safe-to-buy fit.

Future matching copy examples:

- "Estimated from your selected villa layout. Please confirm before buying."
- "Verified by you."
- "Designer verified."
- "This item is close to the available clearance. Recheck measurements before purchase."

## Legal And Privacy Rules

Floor-plan images are sensitive and likely copyrighted.

Rules:

- Store structured facts by default.
- Store raw floor-plan files only when user-uploaded, rights-cleared, or private/internal.
- Do not publicly display scraped or third-party floor-plan images without rights.
- Use source URLs and source rights status internally.
- Treat full-home plans as high-sensitivity user data.
- Use private storage and signed URLs.
- Do not send full-home floor plans to retailers.
- Disclose any third-party parser before upload.
- Ask explicit consent before using user-uploaded plans to improve shared datasets.

## Curation Workflow

The measurement library should become a reviewed data product.

Required curation steps:

1. Add source.
2. Capture community/development/type metadata.
3. Extract room labels and dimensions.
4. Add aliases.
5. Mark source rights status.
6. Assign confidence.
7. Human review.
8. Publish to app dataset.
9. Track last verified date.

No automated scraper should be allowed to silently write trusted measurements into production.

## Implementation Sequence

### PR A: PRD And Executor Prompt

- Add this PRD.
- Add executor prompt.
- No runtime changes.
- No database changes.

### PR B: Pure Domain Measurement Types

- Add domain types for measurement sources, confidence, property layouts, layout rooms, aliases, and fit confidence.
- Add fixtures for a small Dubai-style layout set.
- Add tests for source/confidence behavior.
- No runtime changes.

### PR C: Schema Proposal And Migration Draft

- Propose Supabase migration for reviewed tables/enums.
- Do not apply to production until Sam approves.
- Include RLS posture.
- Include generated type update plan.

### PR D: Seed Dataset Format

- Add repo-managed seed dataset format for curated layouts.
- Include a small sample dataset only if source rights are safe.
- Add validation tests.

### PR E: Import/Curation CLI

- Add dry-run importer that validates and summarizes seed data.
- No writes by default.
- Include duplicate/alias/confidence warnings.

### PR F: Default-Off Layout Prefill UI

- Add "Find my layout" behind a default-off flag.
- No production enablement.
- User must confirm values before continuing.

### PR G: Measurement Confidence Integration

- Product matching and catalog-first bundle logic use source confidence.
- Tight clearances require stronger verification.
- User-facing warnings are calm and clear.

## Acceptance Criteria

- Measurements are never silently treated as exact unless verified.
- Known developer layouts can prefill room dimensions with source/confidence metadata.
- Users must confirm or edit prefilled measurements before product sizing.
- Product matching can distinguish manual, known-layout, parsed-plan, scan-import, and designer-verified sources.
- Floor-plan assets remain private and rights-aware.
- Seeded layout data is reviewed, versioned, and source-backed.
- The system improves onboarding speed without undermining furniture-fit trust.

## Open Questions

- Should layout prefill happen at project creation or before room creation?
- Should known-layout search be available only for villas/townhouses at first?
- What is the minimum dataset size before this becomes user-facing?
- Should designers have a separate "verified measurement" workflow?
- How much of the plan thumbnail can be shown if source rights are unclear?
- Should open-plan living/dining zones be user-marked on a plan, or captured as separate known layout rooms?
- Should verified measurements expire or be rechecked after a certain time?
