# 19 Measurement Intelligence Seed Dataset Format

Status: PR D proposal and domain validation
Date: 2026-05-23
Audience: Chief Architect, Sam
Scope: repo-managed seed dataset shape only. This document accompanies the pure domain schema in `packages/domain/src/measurement-layout-seed.ts` and the synthetic example in `docs/Tracks/v2-commercial/measurement-layout-seed.example.json`.

## Purpose

PR C proposed future Measurement Intelligence database tables. PR D proves the file format for curated Dubai developer-layout seed data before the team commits to migrations, importers, or runtime behavior.

The seed dataset is intended to be:

- reviewable in git
- dry-run importable in a later PR
- explicit about source rights and confidence
- conservative about measurement trust
- safe to validate without touching Supabase

## Non-Goals

- No Supabase migration.
- No generated DB type changes.
- No runtime app wiring.
- No UI.
- No seed importer.
- No external parser or vendor integration.
- No production data writes.

## Format Overview

The top-level dataset is a JSON object:

```text
version
generatedAt
description
layouts[]
```

Each layout record contains:

```text
id
community
development
propertyType
bedroomCount
unitTypeCode
aliases[]
layoutConfidence
sourceRightsStatus
sources[]
rooms[]
notes
disclaimer
```

The domain schema is the source of truth for validation. This document describes the review intent behind that schema.

## Required Layout Fields

### Community

Community records capture the broad searchable area.

Required fields:

- `slug`
- `name`
- `city`
- `country`
- `aliases`

Example values are Dubai-focused, but the schema does not hard-code a single community.

### Development / Phase

Development records capture the project, sub-community, or phase inside a community.

Required fields:

- `slug`
- `name`
- `developer`
- `aliases`

Optional:

- `phaseName`

### Property Details

Required fields:

- `propertyType`
- `bedroomCount`
- `unitTypeCode`
- `layoutConfidence`
- `sourceRightsStatus`

`propertyType` currently supports:

```text
villa
townhouse
apartment
penthouse
duplex
other
```

`layoutConfidence` currently supports:

```text
unknown
estimated
assumed
prefill
user_confirmed
verified
designer_verified
```

Seed layouts should usually start as `prefill` unless they are backed by measured/as-built verification. Trusted values must not appear without provenance.

## Aliases

Aliases are objects with:

```text
value
kind
```

Alias kinds:

```text
community
development
layout_code
marketing_name
legacy_name
user_phrase
```

The domain helper `normalizedMeasurementLayoutSeedAliases(...)` normalizes aliases through the same `normalizeLayoutAlias(...)` helper used by the Measurement Intelligence domain foundation. This keeps future seed search compatible with PR B's layout matching behavior.

Examples:

- `SYN TH 4E`
- `4 bedroom synthetic end unit`
- `Garden Townhouses Phase 1`

## Sources And Rights

Each layout must include at least one source record.

Source records include:

```text
id
kind
rightsStatus
label
url
publisherName
retrievedAt
disclaimer
notes
```

`rightsStatus` is required and must be explicit. The schema rejects layout-level `sourceRightsStatus: unknown` and source-level `rightsStatus: unknown`.

Rights statuses:

```text
unknown
public_reference_only
structured_facts_only
user_uploaded_private
rights_cleared_internal
partner_licensed
do_not_use
```

The synthetic example uses `rights_cleared_internal` because it is not copied from a real developer or broker floor plan.

## Rooms

Room records include:

```text
id
name
normalizedRoomType
floorLevel
sourceId
measurementConfidence
lengthCm
widthCm
ceilingHeightCm
notes
disclaimer
```

Normalized room types:

```text
living_room
dining_room
bedroom
home_office
majlis
family_room
kitchen
bathroom
other
```

Floor levels:

```text
basement
ground
first
second
third
roof
other
```

Dimensions are optional because many plans omit room-level measurements, but any provided `lengthCm`, `widthCm`, or `ceilingHeightCm` must be positive.

Every room must reference a source from the same layout through `sourceId`. This is deliberately stricter than a loose JSON fixture because future importers should never create trusted-looking measurements without provenance.

## Synthetic Example Policy

The example dataset in this PR is intentionally synthetic.

It must not be treated as:

- a real Dubai developer layout
- a seed candidate for production
- a substitute for rights-reviewed floor-plan research
- proof of real room dimensions

The example exists only to validate shape, naming, confidence, rights status, source linkage, and room dimension constraints.

## Validation Covered In PR D

The domain tests prove:

- required fields are enforced
- alias normalization stays compatible with `normalizeLayoutAlias(...)`
- trusted/prefill measurement records keep source and confidence fields
- source rights status is explicit
- room dimensions are positive where provided
- the synthetic sample dataset parses successfully

## Future Importer Expectations

PR E adds a dry-run importer foundation before any write-capable importer exists.

The dry-run path is intentionally repo-local and deterministic. It validates a proposed seed JSON file with the domain schema, applies extra review checks for duplicate aliases and rooms, and renders a stable text report that reviewers can compare in PR comments or CI logs.

Local usage:

```text
pnpm --filter @ritzy-studio/domain measurement:seed:dry-run -- --proposed ../../docs/Tracks/v2-commercial/measurement-layout-seed.example.json
```

With a current reviewed seed file:

```text
pnpm --filter @ritzy-studio/domain measurement:seed:dry-run -- --current path/to/current.json --proposed path/to/proposed.json
```

The report includes:

- validation status for current and proposed files
- layout additions, removals, changes, and unchanged counts
- normalized alias additions and removals
- room additions, removals, and changed records
- source additions, removals, and changed records
- validation failures with deterministic path/code/message formatting

The dry-run validator rejects:

- schema-invalid seed files
- duplicate normalized aliases within a layout's explicit aliases
- duplicate room ids
- duplicate room labels on the same floor/type
- missing measurement confidence fields
- room source ids that do not reference a source in the same layout
- unknown layout or source rights status
- non-positive room dimensions where dimensions are provided

This foundation is not allowed to connect to Supabase or mutate any app state. It exists so future curated seed files can be inspected safely before Sam or the Chief Architect approve migrations, generated DB types, or any write path.

A later write-capable importer should still:

- read this JSON shape
- validate with `measurementLayoutSeedDatasetSchema`
- report normalized aliases
- report source rights status
- report inserts, updates, and deletes without writing by default
- refuse production writes unless explicitly approved

That write-capable importer is not part of this PR.

## Open Questions Before Real Data

1. Should real reviewed seeds live as one file per layout or grouped by community?
2. Should `rightsStatus: structured_facts_only` be acceptable for public developer/broker-derived facts?
3. Should source URLs be required for non-synthetic public references?
4. Should room geometry, doors, and windows be included in the seed v1 shape, or deferred until the geometry contract is approved?
5. Should imported seed rows preserve stable UUIDs, or should slugs remain the stable identity?
