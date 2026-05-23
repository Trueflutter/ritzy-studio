# 20 Measurement Intelligence Migration Plan Not Applied

Status: PR F planning only
Date: 2026-05-23
Audience: Chief Architect, Sam
Scope: final proposed Supabase schema/migration design for review. This document does not apply a migration.

## Not Applied

This is not a live database change.

This PR must not add:

- `supabase/migrations/*`
- generated `packages/db/src/types.ts` changes
- Supabase writes
- app, runtime, or UI wiring
- product matching behavior changes
- seed importer writes
- floor-plan parser or external vendor/parser integration

The goal is to make the future migration reviewable before Sam explicitly approves database/schema changes.

## Design Intent

Measurement Intelligence should add a curated Dubai layout library without treating prefills as truth. The future schema should:

- store reviewed structured layout facts separately from user room measurements
- keep source rights, provenance, and confidence explicit
- let the app show prefill candidates without making them fit-safe by default
- preserve existing `room_measurements` as the operational measurement table
- make seed dry-run output from PR E map predictably into database rows
- protect raw floor-plan assets behind private/signed access unless rights-cleared

## Proposed Enums

### `property_library_status`

```sql
create type property_library_status as enum (
  'draft',
  'reviewed',
  'published',
  'retired',
  'blocked'
);
```

Usage:

- `draft`: imported or manually created but not reviewed.
- `reviewed`: source/provenance checked, not yet available in app search.
- `published`: available for authenticated app prefill search.
- `retired`: retained for audit but not proposed for new rooms.
- `blocked`: retained for audit because rights, quality, or source concerns prevent use.

### `property_type`

```sql
create type property_type as enum (
  'villa',
  'townhouse',
  'apartment',
  'penthouse',
  'duplex',
  'other'
);
```

This matches the PR D seed schema.

### `measurement_confidence`

```sql
create type measurement_confidence as enum (
  'unknown',
  'estimated',
  'assumed',
  'prefill',
  'user_confirmed',
  'verified',
  'designer_verified'
);
```

Use a new enum rather than extending the existing generic `confidence_level` unless Sam confirms the existing enum is measurement-only. Conservative policy remains:

- `prefill`, `assumed`, `estimated`, and `unknown` require confirmation.
- `user_confirmed` can support normal product-fit scoring.
- `designer_verified` can support tight-clearance decisions.
- `verified` should be reserved for measured/as-built records with clear provenance.

### `source_rights_status`

```sql
create type source_rights_status as enum (
  'unknown',
  'public_reference_only',
  'structured_facts_only',
  'user_uploaded_private',
  'rights_cleared_internal',
  'partner_licensed',
  'do_not_use'
);
```

Future migration should reject or quarantine `unknown` and `do_not_use` for published layout-library rows.

### `property_layout_source_kind`

```sql
create type property_layout_source_kind as enum (
  'developer_brochure',
  'broker_floor_plan',
  'public_listing',
  'user_upload',
  'designer_upload',
  'internal_research',
  'synthetic_example',
  'partner_feed'
);
```

This matches PR D/PR E seed source kinds.

### `property_layout_alias_kind`

```sql
create type property_layout_alias_kind as enum (
  'community',
  'development',
  'layout_code',
  'marketing_name',
  'legacy_name',
  'user_phrase',
  'broker_phrase'
);
```

PR D seeds currently use the first six values. `broker_phrase` is included for reviewed broker/listing vocabulary.

### `room_measurement_source_status`

```sql
create type room_measurement_source_status as enum (
  'draft',
  'prefilled',
  'user_confirmed',
  'user_edited',
  'designer_verified',
  'superseded'
);
```

This status belongs to a user's selected source path, not the shared layout library.

### Future `measurement_source` Extension

Existing database enum values are:

```text
manual
floor_plan
annotation
estimated
```

Recommended future extension:

```sql
alter type measurement_source add value if not exists 'floor_plan_upload';
alter type measurement_source add value if not exists 'known_developer_layout';
alter type measurement_source add value if not exists 'third_party_scan_import';
alter type measurement_source add value if not exists 'native_room_scan';
alter type measurement_source add value if not exists 'designer_verified';
```

This should happen in the actual migration only after Sam approves enum changes. Removing enum values is awkward, so the migration PR should be reviewed carefully.

## Proposed Tables

### `property_communities`

```sql
create table property_communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  city text not null default 'Dubai',
  country text not null default 'AE',
  status property_library_status not null default 'draft',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_communities_slug_not_blank check (length(trim(slug)) > 0),
  constraint property_communities_name_not_blank check (length(trim(name)) > 0),
  constraint property_communities_country_iso2 check (country ~ '^[A-Z]{2}$')
);
```

Purpose: community-level search and grouping, for example DAMAC Hills 2 or Al Furjan.

### `property_developments`

```sql
create table property_developments (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references property_communities(id) on delete restrict,
  slug text not null,
  name text not null,
  developer_name text,
  phase_name text,
  status property_library_status not null default 'draft',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_developments_slug_not_blank check (length(trim(slug)) > 0),
  constraint property_developments_name_not_blank check (length(trim(name)) > 0),
  unique (community_id, slug)
);
```

Purpose: named development or phase inside a community, for example Murooj Al Furjan.

### `property_layouts`

```sql
create table property_layouts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references property_communities(id) on delete restrict,
  development_id uuid references property_developments(id) on delete restrict,
  slug text not null,
  name text not null,
  property_type property_type not null,
  type_code text,
  bedroom_count integer,
  bathroom_count numeric(4, 1),
  floor_count integer,
  bua_sqft numeric(10, 2),
  plot_sqft numeric(10, 2),
  mirror_of_layout_id uuid references property_layouts(id) on delete set null,
  layout_confidence measurement_confidence not null default 'prefill',
  source_rights_status source_rights_status not null default 'unknown',
  status property_library_status not null default 'draft',
  notes text,
  disclaimer text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_layouts_slug_not_blank check (length(trim(slug)) > 0),
  constraint property_layouts_name_not_blank check (length(trim(name)) > 0),
  constraint property_layouts_disclaimer_not_blank check (length(trim(disclaimer)) > 0),
  constraint property_layouts_bedroom_count_nonnegative check (bedroom_count is null or bedroom_count >= 0),
  constraint property_layouts_floor_count_positive check (floor_count is null or floor_count > 0),
  constraint property_layouts_bua_positive check (bua_sqft is null or bua_sqft > 0),
  constraint property_layouts_plot_positive check (plot_sqft is null or plot_sqft > 0),
  constraint property_layouts_no_self_mirror check (mirror_of_layout_id is null or mirror_of_layout_id <> id),
  unique (community_id, slug)
);
```

Purpose: one reusable layout candidate. `layout_confidence = 'prefill'` remains unconfirmed by default.

### `property_layout_aliases`

```sql
create table property_layout_aliases (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid references property_layouts(id) on delete cascade,
  community_id uuid references property_communities(id) on delete cascade,
  development_id uuid references property_developments(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  alias_kind property_layout_alias_kind not null,
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  constraint property_layout_aliases_one_target check (
    num_nonnulls(layout_id, community_id, development_id) = 1
  ),
  constraint property_layout_aliases_alias_not_blank check (length(trim(alias)) > 0),
  constraint property_layout_aliases_normalized_not_blank check (length(trim(normalized_alias)) > 0)
);
```

Purpose: deterministic search over layout codes, marketing names, legacy names, and user phrases. `normalized_alias` must be generated with the domain `normalizeLayoutAlias(...)` behavior.

Uniqueness recommendation:

```sql
create unique index property_layout_aliases_layout_unique
  on property_layout_aliases(layout_id, normalized_alias, alias_kind)
  where layout_id is not null;

create unique index property_layout_aliases_community_unique
  on property_layout_aliases(community_id, normalized_alias, alias_kind)
  where community_id is not null;

create unique index property_layout_aliases_development_unique
  on property_layout_aliases(development_id, normalized_alias, alias_kind)
  where development_id is not null;
```

Do not make `normalized_alias` globally unique; aliases like "4 bed end unit" can reasonably appear in multiple developments.

### `property_layout_sources`

```sql
create table property_layout_sources (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid not null references property_layouts(id) on delete cascade,
  source_slug text not null,
  source_kind property_layout_source_kind not null,
  rights_status source_rights_status not null default 'unknown',
  source_label text not null,
  source_url text,
  publisher_name text,
  retrieved_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  disclaimer text not null,
  raw_asset_id uuid references room_assets(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_layout_sources_slug_not_blank check (length(trim(source_slug)) > 0),
  constraint property_layout_sources_label_not_blank check (length(trim(source_label)) > 0),
  constraint property_layout_sources_disclaimer_not_blank check (length(trim(disclaimer)) > 0),
  unique (layout_id, source_slug)
);
```

Purpose: provenance and rights review for every reusable layout fact. `raw_asset_id` should remain private and optional.

### `property_layout_rooms`

```sql
create table property_layout_rooms (
  id uuid primary key default gen_random_uuid(),
  layout_id uuid not null references property_layouts(id) on delete cascade,
  source_id uuid references property_layout_sources(id) on delete set null,
  room_slug text not null,
  name text not null,
  room_type text not null,
  floor_label text,
  floor_index integer,
  wall_length_cm numeric(10, 2),
  room_depth_cm numeric(10, 2),
  ceiling_height_cm numeric(10, 2),
  area_sqft numeric(10, 2),
  geometry_json jsonb,
  doors_json jsonb,
  windows_json jsonb,
  measurement_confidence measurement_confidence not null default 'prefill',
  notes text,
  disclaimer text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_layout_rooms_slug_not_blank check (length(trim(room_slug)) > 0),
  constraint property_layout_rooms_name_not_blank check (length(trim(name)) > 0),
  constraint property_layout_rooms_type_not_blank check (length(trim(room_type)) > 0),
  constraint property_layout_rooms_length_positive check (wall_length_cm is null or wall_length_cm > 0),
  constraint property_layout_rooms_depth_positive check (room_depth_cm is null or room_depth_cm > 0),
  constraint property_layout_rooms_ceiling_positive check (ceiling_height_cm is null or ceiling_height_cm > 0),
  constraint property_layout_rooms_area_positive check (area_sqft is null or area_sqft > 0),
  unique (layout_id, room_slug)
);
```

Purpose: structured room-level candidate measurements. Values are nullable because public plans often omit room-level dimensions.

### `room_measurement_sources`

```sql
create table room_measurement_sources (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  room_measurement_id uuid references room_measurements(id) on delete set null,
  property_layout_id uuid references property_layouts(id) on delete set null,
  property_layout_room_id uuid references property_layout_rooms(id) on delete set null,
  source measurement_source not null,
  confidence measurement_confidence not null default 'unknown',
  selection_status room_measurement_source_status not null default 'draft',
  user_confirmed_at timestamptz,
  user_edited_at timestamptz,
  designer_verified_at timestamptz,
  superseded_at timestamptz,
  notes text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_measurement_sources_layout_room_requires_layout check (
    property_layout_room_id is null or property_layout_id is not null
  ),
  constraint room_measurement_sources_superseded_status_consistent check (
    (selection_status = 'superseded') = (superseded_at is not null)
  )
);
```

Purpose: records why a user's active room measurement exists, including whether it came from a developer-layout prefill, manual edit, floor-plan upload, or designer verification.

Recommended active-source constraint:

```sql
create unique index room_measurement_sources_one_active_per_room
  on room_measurement_sources(room_id)
  where superseded_at is null and selection_status <> 'superseded';
```

This table should not replace `room_measurements`. It links selected provenance to the existing operational measurement row.

## Proposed Indexes

```sql
create index property_developments_community_id_idx on property_developments(community_id);
create index property_layouts_community_id_idx on property_layouts(community_id);
create index property_layouts_development_id_idx on property_layouts(development_id);
create index property_layouts_property_type_bedroom_idx on property_layouts(property_type, bedroom_count);
create index property_layouts_status_idx on property_layouts(status);
create index property_layout_aliases_normalized_alias_idx on property_layout_aliases(normalized_alias);
create index property_layout_aliases_layout_id_idx on property_layout_aliases(layout_id);
create index property_layout_aliases_community_id_idx on property_layout_aliases(community_id);
create index property_layout_aliases_development_id_idx on property_layout_aliases(development_id);
create index property_layout_sources_layout_id_idx on property_layout_sources(layout_id);
create index property_layout_sources_rights_status_idx on property_layout_sources(rights_status);
create index property_layout_rooms_layout_id_idx on property_layout_rooms(layout_id);
create index property_layout_rooms_layout_type_idx on property_layout_rooms(layout_id, room_type);
create index room_measurement_sources_room_id_idx on room_measurement_sources(room_id);
create index room_measurement_sources_room_measurement_id_idx on room_measurement_sources(room_measurement_id);
create index room_measurement_sources_property_layout_id_idx on room_measurement_sources(property_layout_id);
create index room_measurement_sources_property_layout_room_id_idx on room_measurement_sources(property_layout_room_id);
```

Consider `pg_trgm` later for fuzzy alias search, but do not add it in the first migration unless product search requirements justify the extension.

## RLS Assumptions

Enable RLS on all new tables.

### Shared Layout Library Tables

Recommended read posture:

- authenticated users can read `published` structured rows
- `draft`, `reviewed`, `retired`, and `blocked` rows stay service-role only
- write access is service-role only
- raw source assets are not exposed through client policies

Tables:

- `property_communities`
- `property_developments`
- `property_layouts`
- `property_layout_aliases`
- `property_layout_rooms`

Policy shape:

```sql
create policy "published communities readable by authenticated users"
  on property_communities
  for select
  to authenticated
  using (status = 'published');
```

Child-table policies should join back to published parents or use `exists` clauses. Keep this explicit in the migration rather than relying on application filters.

### `property_layout_sources`

Recommended posture:

- service-role only by default
- optional future limited read policy for source labels/disclaimers attached to published layouts
- never expose `raw_asset_id` to unauthenticated or broad client access

If source transparency is needed in the UI, prefer a safe view that exposes only:

```text
layout_id
source_kind
rights_status
source_label
publisher_name
retrieved_at
disclaimer
```

### `room_measurement_sources`

This is user/project data and should follow room ownership.

Assumption:

- room owners can read rows for rooms they own
- designers/admin users follow the existing designer/project access model
- writes should initially be service-action only, not broad direct client writes

The migration should reuse the existing `rooms` ownership predicate used by `room_measurements`. If that predicate is not reusable as a helper function, create policies with explicit `exists` checks against `rooms` and project ownership.

## Mapping PR E Dry-Run Seed Records To Future Tables

PR E validates a dataset with `layouts[]`. A future importer should transform each validated layout as follows.

### Community

Seed:

```text
layout.community.slug
layout.community.name
layout.community.city
layout.community.country
layout.community.aliases[]
```

Future rows:

- upsert `property_communities` by `slug`
- insert community aliases into `property_layout_aliases` with `community_id`
- compute `normalized_alias` with the domain normalizer
- set `status = 'draft'` or `reviewed` by importer mode, never `published` automatically

### Development

Seed:

```text
layout.development.slug
layout.development.name
layout.development.phaseName
layout.development.developer
layout.development.aliases[]
```

Future rows:

- upsert `property_developments` by `(community_id, slug)`
- map `developer` to `developer_name`
- map `phaseName` to `phase_name`
- insert development aliases into `property_layout_aliases` with `development_id`

### Layout

Seed:

```text
layout.id
layout.propertyType
layout.bedroomCount
layout.unitTypeCode
layout.layoutConfidence
layout.sourceRightsStatus
layout.notes
layout.disclaimer
layout.aliases[]
```

Future rows:

- map `id` to `property_layouts.slug`
- derive `name` from `unitTypeCode`, first marketing alias, or a reviewed importer-provided label
- map `propertyType` to `property_type`
- map `bedroomCount` to `bedroom_count`
- map `unitTypeCode` to `type_code`
- map `layoutConfidence` to `layout_confidence`
- map `sourceRightsStatus` to `source_rights_status`
- insert layout aliases into `property_layout_aliases` with `layout_id`

Do not publish automatically from seed import. Publication requires human review and explicit approval.

### Sources

Seed:

```text
source.id
source.kind
source.rightsStatus
source.label
source.url
source.publisherName
source.retrievedAt
source.disclaimer
source.notes
```

Future rows:

- map `id` to `property_layout_sources.source_slug`
- map `kind` to `source_kind`
- map `rightsStatus` to `rights_status`
- map `label` to `source_label`
- map `url`, `publisherName`, `retrievedAt`, and `disclaimer` directly
- map `notes` into `metadata_json` or a future `notes` column if Sam wants source notes queryable

Raw floor-plan files are not part of the PR D/PR E seed shape and should not be inferred from source URLs.

### Rooms

Seed:

```text
room.id
room.name
room.normalizedRoomType
room.floorLevel
room.sourceId
room.measurementConfidence
room.lengthCm
room.widthCm
room.ceilingHeightCm
room.notes
room.disclaimer
```

Future rows:

- map `id` to `property_layout_rooms.room_slug`
- map `normalizedRoomType` to `room_type`
- map `floorLevel` to `floor_label`
- map `sourceId` to the matching `property_layout_sources.id`
- map `measurementConfidence` to `measurement_confidence`
- map `lengthCm` to `wall_length_cm`
- map `widthCm` to `room_depth_cm`
- map `ceilingHeightCm` to `ceiling_height_cm`
- map room `notes` and `disclaimer` directly

Room dimensions remain prefill candidates until a user confirms or edits them into `room_measurements`.

## Mapping To Existing `room_measurements`

No runtime behavior changes are approved in PR F.

Future intended flow:

1. User selects or is matched to a published `property_layout`.
2. App creates `room_measurement_sources` rows with `source = 'known_developer_layout'`, `confidence = 'prefill'`, and references to the shared layout/room rows.
3. User confirms or edits dimensions.
4. App writes `room_measurements` using the existing columns:
   - `source`
   - `wall_length_cm`
   - `room_depth_cm`
   - `ceiling_height_cm`
   - `floor_plan_asset_id` when relevant
   - `confidence`
   - `notes`
5. `room_measurement_sources.room_measurement_id` points to the selected measurement row.
6. Later manual or designer-verified measurements supersede the earlier source row.

Principle:

- shared library rows are candidates
- `room_measurements` are operational facts
- `room_measurement_sources` explains provenance and confirmation state

## Forward Compatibility Notes

- Keep stable slugs in seed files so generated UUIDs are not the only identity.
- Keep `metadata_json` on library tables for non-critical future attributes, but do not hide required rights/confidence fields there.
- Keep geometry/doors/windows nullable until the geometry contract is approved.
- Add `synthetic_example` to source kinds so internal test fixtures can remain explicit and non-production.
- Treat `property_layout_sources.raw_asset_id` as optional to avoid forcing raw asset storage.
- Keep publication status separate from confidence so a published row can still be only `prefill`.
- Use adapter prep in PR G only after this row shape is reviewed.

## Rollback Notes

Because this document is not applied, rollback is not needed for PR F.

For the eventual migration:

- New tables can be dropped if no runtime writes depend on them.
- New enum types can be dropped only after dependent tables are dropped.
- Extending the existing `measurement_source` enum is not easily reversible; approve those values carefully.
- If rollback flexibility matters, ship new tables and new enums before extending existing enums.
- Seed imports should be reversible by stable slugs and should avoid hard-coded generated UUID assumptions.
- Runtime code must not depend on new tables until migration and generated DB types are merged.

## Open Questions For Sam Before DB Approval

1. Should the first applied migration create a new `measurement_confidence` enum, or extend the existing `confidence_level` enum?
2. Should `measurement_source` receive `known_developer_layout` in the same migration as the new tables?
3. Should published layout-library rows be readable by all authenticated users, or only through service/API-mediated search?
4. Should source labels and URLs be visible to users, or internal-only for audit?
5. What exact room-owner predicate should `room_measurement_sources` use to match existing RLS?
6. Should `property_layout_rooms.room_type` remain text for compatibility with current domain room types, or become an enum?
7. Are `geometry_json`, `doors_json`, and `windows_json` approved as nullable placeholders, or should they be deferred entirely?
8. Should `reviewed_by` point only to `auth.users`, or to a future admin/designer profile table?
9. Should rights statuses `public_reference_only` and `structured_facts_only` be allowed for published structured facts?
10. Should seed publication be a separate approval step after dry-run import, or can reviewed seeds become `published` in the same approved migration/import workflow?

## Future PR Boundary

Do not proceed to actual migration implementation until Sam explicitly approves DB/schema changes.

Recommended next step after this plan is reviewed:

- PR G: pure adapter prep from validated seed/domain records to the documented row shapes, with no app wiring and no Supabase writes.

Actual migration implementation should remain a separate later PR with:

- `supabase/migrations/*`
- generated `packages/db/src/types.ts`
- migration-only checks
- no UI/runtime/product matching behavior changes
