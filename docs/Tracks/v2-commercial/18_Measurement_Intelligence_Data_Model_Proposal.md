# 18 Measurement Intelligence Data Model Proposal

Status: PR C proposal only
Date: 2026-05-22
Audience: Chief Architect, Sam
Scope: database/model planning for Measurement Intelligence. This document proposes future schema changes but does not add a Supabase migration, generated DB types, runtime wiring, UI, seed importer, or external parsing integration.

## Source Note

The PR C handoff referenced `docs/Tracks/v2-commercial/16_Measurement_Intelligence_PRD.md`, but that file is not present in this checkout after syncing latest `main`. This proposal therefore stays inside the explicitly requested DB/model planning scope and is written to stand alone from tracked repo context.

Related context:

- `docs/Tracks/v2-commercial/03_Data_Model.md`
- `packages/domain/src/measurement-intelligence.ts`
- existing `room_measurements` table in `supabase/migrations/20260429114000_initial_schema.sql`

Working context captured in this proposal:

- Ritzy should treat known Dubai developer layouts as a prefill layer, not as as-built truth.
- Developer and broker plans can be approximate, mirrored, phase-specific, or stale after owner modifications.
- Fit-sensitive measurements need user confirmation; tight-clearance decisions need measured or designer/as-built verification.
- Raw floor plans are sensitive and may be copyrighted, so shared library value should default to reviewed structured facts rather than public plan-image display.
- Future seed/import work should be reviewed, dry-run first, and explicitly approved before any Supabase writes.

## Goals

- Make Dubai developer-layout prefill first-class without treating developer plans as guaranteed as-built truth.
- Preserve `room_measurements` as the active measurement facts used by room generation and product fit.
- Track where a chosen measurement came from, whether the user confirmed it, and whether it is fit-safe.
- Separate structured layout facts from raw copyrighted or user-sensitive floor-plan assets.
- Keep the future migration reviewable, reversible, and easy to type-regenerate.

## Non-Goals

- No migration in this PR.
- No generated `packages/db/src/types.ts` changes in this PR.
- No runtime product matching change.
- No onboarding UI, plan upload UI, or measurement confirmation UI.
- No floor-plan parser, seed importer, OCR, vendor API, or production seed write.

## Proposed Tables

### `property_communities`

Represents a searchable Dubai community such as DAMAC Hills 2, Al Furjan, Arabian Ranches, or Dubai Hills Estate.

Proposed fields:

```text
id uuid primary key default gen_random_uuid()
slug text not null unique
name text not null
city text not null default 'Dubai'
country text not null default 'AE'
status property_library_status not null default 'draft'
metadata_json jsonb not null default '{}'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Notes:

- `slug` should be stable and human-readable for seed diffs.
- `status` allows internal review before a community appears in any user-facing picker.
- Store only community-level metadata here, not floor-plan files.

### `property_developments`

Represents a project, sub-community, phase, or named development within a community, such as Murooj Al Furjan or DAMAC Hills 2 clusters.

Proposed fields:

```text
id uuid primary key default gen_random_uuid()
community_id uuid not null references property_communities(id) on delete restrict
slug text not null
name text not null
developer_name text
phase_name text
status property_library_status not null default 'draft'
metadata_json jsonb not null default '{}'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
unique (community_id, slug)
```

Notes:

- A community can have multiple developments or phases with overlapping type names.
- `developer_name` is plain text initially; a normalized developers table is not needed for MVP.

### `property_layouts`

Represents a reusable villa/townhouse/apartment layout candidate for prefill.

Proposed fields:

```text
id uuid primary key default gen_random_uuid()
community_id uuid not null references property_communities(id) on delete restrict
development_id uuid references property_developments(id) on delete restrict
slug text not null
name text not null
property_type property_type not null
type_code text
bedroom_count integer
bathroom_count numeric(4, 1)
floor_count integer
bua_sqft numeric(10, 2)
plot_sqft numeric(10, 2)
mirror_of_layout_id uuid references property_layouts(id) on delete set null
layout_confidence measurement_confidence not null default 'prefill'
status property_library_status not null default 'draft'
notes text
metadata_json jsonb not null default '{}'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
unique (community_id, slug)
```

Notes:

- `layout_confidence` should describe the structured layout record, not user confirmation.
- `mirror_of_layout_id` can describe left/right variants without duplicating all source provenance.
- `status` controls curation lifecycle: draft, reviewed, published, retired.
- `metadata_json` may hold non-critical source facts such as marketing area labels, plot category, or orientation notes.

### `property_layout_aliases`

Supports search and fuzzy matching across old names, marketing names, type codes, and user phrases.

Proposed fields:

```text
id uuid primary key default gen_random_uuid()
layout_id uuid references property_layouts(id) on delete cascade
community_id uuid references property_communities(id) on delete cascade
development_id uuid references property_developments(id) on delete cascade
alias text not null
normalized_alias text not null
alias_kind property_layout_alias_kind not null
locale text not null default 'en'
created_at timestamptz not null default now()
check (
  num_nonnulls(layout_id, community_id, development_id) = 1
)
```

Candidate `alias_kind` values:

- `community`
- `development`
- `layout_code`
- `marketing_name`
- `legacy_name`
- `user_phrase`
- `broker_phrase`

Notes:

- `normalized_alias` should match the domain normalizer in `measurement-intelligence.ts`.
- Examples: Akoya Oxygen, Damac Hills 2, TH12-4E, 4 bedroom end unit, Murooj Al Furjan 4-bed corner.
- A single alias table avoids three nearly identical alias tables.

### `property_layout_rooms`

Stores structured room-level measurements extracted from reviewed layouts.

Proposed fields:

```text
id uuid primary key default gen_random_uuid()
layout_id uuid not null references property_layouts(id) on delete cascade
source_id uuid references property_layout_sources(id) on delete set null
name text not null
room_type text not null
floor_label text
floor_index integer
wall_length_cm numeric(10, 2)
room_depth_cm numeric(10, 2)
ceiling_height_cm numeric(10, 2)
area_sqft numeric(10, 2)
geometry_json jsonb
doors_json jsonb
windows_json jsonb
measurement_confidence measurement_confidence not null default 'prefill'
notes text
metadata_json jsonb not null default '{}'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Notes:

- Dimensions should stay nullable because many public plans omit room-level dimensions.
- `geometry_json`, `doors_json`, and `windows_json` should be optional until a minimum geometry contract is approved.
- Room rows are prefill candidates only until selected and confirmed by the user or designer.

### `property_layout_sources`

Tracks provenance, rights posture, and source-review state for layout facts.

Proposed fields:

```text
id uuid primary key default gen_random_uuid()
layout_id uuid references property_layouts(id) on delete cascade
source_kind property_layout_source_kind not null
rights_status source_rights_status not null default 'unknown'
source_label text not null
source_url text
publisher_name text
retrieved_at timestamptz
reviewed_by uuid references auth.users(id) on delete set null
reviewed_at timestamptz
disclaimer text
raw_asset_id uuid references room_assets(id) on delete set null
metadata_json jsonb not null default '{}'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Candidate `source_kind` values:

- `developer_brochure`
- `broker_floor_plan`
- `public_listing`
- `user_upload`
- `designer_upload`
- `internal_research`
- `partner_feed`

Notes:

- `raw_asset_id` is optional and should only point at rights-cleared, user-uploaded, or private/internal assets.
- Public source URLs can support auditability without republishing plan images.
- A source can be kept private while structured facts are used for matching/prefill.

### `room_measurement_sources`

Links a user's room to the selected measurement source or prefill path.

Proposed fields:

```text
id uuid primary key default gen_random_uuid()
room_id uuid not null references rooms(id) on delete cascade
room_measurement_id uuid references room_measurements(id) on delete set null
property_layout_id uuid references property_layouts(id) on delete set null
property_layout_room_id uuid references property_layout_rooms(id) on delete set null
source measurement_source not null
confidence measurement_confidence not null default 'unknown'
selection_status room_measurement_source_status not null default 'draft'
user_confirmed_at timestamptz
user_edited_at timestamptz
designer_verified_at timestamptz
superseded_at timestamptz
notes text
metadata_json jsonb not null default '{}'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Candidate `selection_status` values:

- `draft`
- `prefilled`
- `user_confirmed`
- `user_edited`
- `designer_verified`
- `superseded`

Notes:

- This table answers "why do these room measurements exist?" without overloading `room_measurements`.
- `room_measurement_id` points to the actual selected measurement row once dimensions are written.
- `property_layout_room_id` preserves which library room was used for prefill.
- Only one non-superseded source should be active per room at a time. A future partial unique index can enforce this:

```text
unique (room_id) where superseded_at is null and selection_status <> 'superseded'
```

## Proposed Enum Changes

### `measurement_source`

Existing enum:

```text
manual | floor_plan | annotation | estimated
```

Proposed future enum:

```text
manual
floor_plan
floor_plan_upload
annotation
known_developer_layout
third_party_scan_import
native_room_scan
designer_verified
estimated
```

Notes:

- Keep `floor_plan` for backward compatibility if existing rows use it.
- Add `floor_plan_upload` for user-uploaded plan assets.
- Add `known_developer_layout` for curated Dubai prefill data.
- Add scan/import sources separately because their privacy, vendor, and confidence stories differ.

### `source_rights_status`

Candidate values:

```text
unknown
public_reference_only
structured_facts_only
user_uploaded_private
rights_cleared_internal
partner_licensed
do_not_use
```

Usage:

- `public_reference_only`: source may guide research but raw images should not be stored or displayed.
- `structured_facts_only`: extracted facts can be used, but raw plan display is not permitted.
- `user_uploaded_private`: user-provided plan for that user's project only.
- `partner_licensed`: source is available under a commercial or direct license.

### `property_type`

Candidate values:

```text
villa
townhouse
apartment
penthouse
duplex
other
```

MVP can use only villa, townhouse, apartment, and other if the team wants to stay narrower.

### `measurement_confidence`

The database currently has `confidence_level` with:

```text
verified | assumed | estimated | unknown
```

Future options:

1. Extend `confidence_level` with measurement-specific values.
2. Add a new `measurement_confidence` enum.

Recommended future enum:

```text
unknown
estimated
assumed
prefill
user_confirmed
verified
designer_verified
```

Recommendation:

- Prefer a new `measurement_confidence` enum if the existing `confidence_level` is used outside measurement semantics.
- If the existing enum is measurement-only in practice, extending it may be simpler.
- Whichever path is chosen, unconfirmed `unknown`, `estimated`, `assumed`, and `prefill` values should not support product-fit decisions.

### Supporting Enums

Candidate `property_library_status`:

```text
draft
reviewed
published
retired
blocked
```

Candidate `property_layout_source_kind`:

```text
developer_brochure
broker_floor_plan
public_listing
user_upload
designer_upload
internal_research
partner_feed
```

Candidate `room_measurement_source_status`:

```text
draft
prefilled
user_confirmed
user_edited
designer_verified
superseded
```

## Mapping To Existing `room_measurements`

Existing `room_measurements` should remain the operational measurement table.

Current relevant fields:

```text
room_id
source
wall_length_cm
room_depth_cm
ceiling_height_cm
floor_plan_asset_id
confidence
notes
created_at
```

Proposed mapping:

- `property_layout_rooms` stores reusable candidate dimensions.
- `room_measurement_sources` stores the chosen source and confirmation state for a specific user's room.
- `room_measurements` stores the active room dimensions that generation and product matching already know how to consume.

Example flow:

1. User picks `Murooj Al Furjan 4-bed corner`.
2. App creates a `room_measurement_sources` row with `source = known_developer_layout`, `confidence = prefill`, and references to `property_layout_id` and `property_layout_room_id`.
3. User confirms or edits the dimensions.
4. App writes a `room_measurements` row with `source = known_developer_layout` or `manual`, `confidence = user_confirmed` or `verified`.
5. `room_measurement_sources.room_measurement_id` points to that row.
6. If the user later enters manual dimensions, the prior source is superseded and a new measurement/source pair becomes active.

Design principle:

- `room_measurements` is the fact table used by runtime.
- `room_measurement_sources` is the provenance and trust table.
- Developer-library rows should never be treated as active fit-safe facts until the user confirms or edits them.

## RLS Posture

### Library Read Rules

Options:

1. Public read for published structured rows only.
2. Authenticated read for published structured rows only.
3. Service/API-mediated read only.

Recommendation:

- Use authenticated read for `published` library rows in the app.
- Keep `draft`, `reviewed`, `retired`, and `blocked` rows service-role only.
- Avoid public unauthenticated read until rights, scraping, and abuse considerations are reviewed.

Candidate policy posture:

```text
property_communities: authenticated users can read status = published
property_developments: authenticated users can read status = published and parent community is published
property_layouts: authenticated users can read status = published and parent community/development is published
property_layout_aliases: authenticated users can read aliases attached to published entities
property_layout_rooms: authenticated users can read rooms attached to published layouts
property_layout_sources: service-role only by default, with optional limited source labels for published layouts
```

### Service-Role Write Rules

Recommendation:

- All library writes should be service-role only.
- Future admin/curation tooling should write through server actions or service-role jobs, not direct client policies.
- Seed importers should dry-run by default and require explicit production write approval.

### Room-Owner Access

`room_measurement_sources` is user/project data and should follow room ownership.

Candidate posture:

- Room owners can read measurement source rows for rooms they own.
- Room owners can create/update source rows only through server actions that enforce confirmation rules.
- Direct client update can be deferred until the runtime flow exists.
- Designers/admins may need separate access once designer account roles are finalized.

The existing `room_measurements` RLS pattern should guide this table. The future migration should reuse the same room-owner predicate where possible.

### Raw Floor-Plan Asset Protection

Raw floor plans are sensitive. They reveal entrances, windows, room layout, family routines, and security-relevant details.

Recommendation:

- Raw user uploads stay in private storage.
- Access uses short-lived signed URLs.
- Do not expose raw floor-plan assets through public library reads.
- `property_layout_sources.raw_asset_id` should stay service-role only unless the asset is user-owned or explicitly rights-cleared.
- Retailers should never receive full-home plans; only product quantities/SKUs and non-sensitive room context.

## Privacy And Rights Posture

Structured data and raw assets should be treated differently.

Structured facts:

- Community name, development name, type code, bedroom count, and room dimensions can be stored as reviewed structured facts where legally permissible.
- Source URL and publisher can be retained for audit and attribution.
- Confidence and disclaimer fields should be mandatory for developer/broker-derived data.

Raw floor-plan assets:

- Do not publicly display copyrighted plan images unless rights-cleared.
- Do not store scraped or broker plan images as reusable public product assets without legal review.
- User uploads can be stored for that user's own project with private/signed access.
- Partner-provided assets require explicit license terms in `source_rights_status` and metadata.

Operational posture:

- Prefer structured facts for shared library value.
- Prefer private storage for user-uploaded raw plans.
- Disclose any future third-party parser before upload.
- Keep deletion support in mind for user-provided assets and derived measurements.

## Seed Data Approach

Recommended path:

1. Keep reviewed seed files in the repo before any production writes.
2. Use stable slugs and normalized aliases so diffs are reviewable.
3. Include provenance, confidence, rights status, and disclaimers in every seed row.
4. Build a dry-run importer later that prints inserts/updates/deletes without writing.
5. Require explicit approval before any importer writes to dev or production Supabase.

Possible repo shape for a future PR:

```text
data/measurement-intelligence/
  communities.json
  developments.json
  layouts.json
  aliases.json
  rooms.json
  sources.json
```

This PR does not add those files. The shape above is only a proposal.

Dry-run importer expectations for a later PR:

- Validate enum values.
- Validate alias normalization.
- Validate source rights status.
- Validate dimensions are plausible.
- Print a row-level diff.
- Refuse production writes unless an explicit write flag and environment confirmation are present.

## Migration Plan

### Proposed Sequence

1. Add enums and library tables.
2. Add `room_measurement_sources`.
3. Add indexes and unique constraints.
4. Add RLS policies.
5. Regenerate `packages/db/src/types.ts`.
6. Add domain/db adapter tests if needed.
7. Add seed dry-run tooling in a separate PR.
8. Add runtime onboarding/confirmation flow only after migration, typegen, and seed approach are approved.

### Indexes To Consider

```text
property_communities(slug)
property_developments(community_id, slug)
property_layouts(community_id, slug)
property_layouts(development_id)
property_layouts(property_type, bedroom_count)
property_layout_aliases(normalized_alias)
property_layout_aliases(layout_id)
property_layout_rooms(layout_id, room_type)
property_layout_sources(layout_id)
room_measurement_sources(room_id)
room_measurement_sources(room_measurement_id)
room_measurement_sources(property_layout_id)
room_measurement_sources(property_layout_room_id)
```

### Rollback Considerations

- Adding new tables is straightforward to roll back if no runtime writes depend on them.
- Extending Postgres enums is not trivially reversible. If rollback flexibility matters, consider new enums over extending shared enums.
- Adding values to existing `measurement_source` must be planned carefully because enum value removal is awkward.
- Runtime code should not depend on new enum values until migrations and generated DB types are merged.
- Seed writes should be reversible by stable slug, not only by generated UUID.

### Generated DB Type Update Plan

The migration PR, not this proposal PR, should:

1. Apply migration locally or against the agreed dev schema.
2. Regenerate `packages/db/src/types.ts`.
3. Review generated diff for only expected enum/table additions.
4. Run DB package typecheck and workspace typecheck.
5. Keep migration and generated types in the same PR.

## Open Questions

For Sam and the chief architect:

1. Should published layout-library structured rows be readable by all authenticated users, or only through service/API-mediated search?
2. Should `property_layout_sources` expose source labels/URLs to users, or stay internal-only?
3. Should measurement confidence extend the existing `confidence_level` enum or use a new `measurement_confidence` enum?
4. Should `room_measurements.source` eventually receive `known_developer_layout`, or should selected developer layouts always write as `manual` after user confirmation with provenance only in `room_measurement_sources`?
5. What is the minimum approved `geometry_json`, `doors_json`, and `windows_json` contract for open-plan Dubai living/dining zones?
6. Should mirrored layouts be represented by `mirror_of_layout_id`, duplicated room rows, or a transformation field?
7. Is a reviewed repo-managed seed dataset acceptable, or should all curated layouts be entered through admin tooling from the start?
8. What rights status is acceptable for using public developer/broker plans as structured facts?
9. Should designer/as-built verification be represented by a confidence value, a source value, a timestamp, or all three?
10. What audit trail is required when a user edits a prefilled developer-layout measurement?

## Recommended PR Boundary After Approval

If this proposal is approved, the next PR should be a migration-only PR with generated DB types and no runtime behavior changes. The seed importer, runtime confirmation flow, product-fit warnings, and external parsing integrations should remain separate follow-up PRs.
