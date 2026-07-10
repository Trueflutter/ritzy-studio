# Dubai Villa-Type Measurement Prefill Feasibility

Date: 2026-05-22  
Audience: Chief Architect  
Context: Ritzy Studio is a web-first interior design app for Dubai homeowners. The product needs accurate-enough room dimensions for furniture sizing while keeping onboarding friction low. Many Dubai villas and townhouses are built from standardized developer layouts, for example by community, project phase, bedroom count, and villa/townhouse type.

## Executive Summary

It is feasible and strategically useful for Ritzy Studio to build a curated library of Dubai villa and townhouse floor plans by community and unit type, then use that library to prefill room dimensions during onboarding.

The right product claim is:

> Ritzy may already know your villa or townhouse layout. Select your community and type, then confirm the room dimensions before we size furniture.

The wrong product claim is:

> Ritzy knows the exact as-built measurements of every Dubai villa.

This distinction matters. Public developer plans and broker floor plans are useful for reducing friction, but they are often approximate, may differ by phase or mirrored layout, and can vary at handover or after owner modifications. Ritzy should use known layouts to prefill and accelerate the brief, not to guarantee fit without confirmation.

## Recommendation

Build this as a staged data product:

1. MVP: Curated floor-plan library for the top Dubai villa/townhouse communities, with user confirmation before product matching.
2. V2: User-uploaded floor plans feed a consent-based data flywheel, improving the library over time.
3. V3: Developer, broker, or handover-service partnerships provide cleaner canonical plans and metadata.
4. Future native app: Combine known villa-type layouts with RoomPlan or scan verification for as-built accuracy.

This is a strong fit for Dubai because the housing stock is standardized enough to make prefill valuable, but not standardized enough to skip user confirmation.

## Why This Exists

The measurement-capture research found that browser-first room scanning is not reliable enough today for furniture fit. Native tools such as Apple RoomPlan, magicplan, CubiCasa, Canvas, RoomScan, and Polycam can help, but they add user friction and often require mobile apps or LiDAR devices.

Dubai has a separate advantage: many villas and townhouses are sold from repeatable floor-plan types. If Ritzy can identify the user's community and unit type, it can often infer a likely plan before asking the user to upload or scan anything.

This creates a lower-friction measurement path:

1. User selects community.
2. User selects project/phase.
3. User selects bedroom count and villa/townhouse type.
4. Ritzy shows likely layouts.
5. User confirms the room or uploads their plan if no match exists.
6. Ritzy pre-populates room measurements with confidence labels.

## Feasibility By Scope

| Scope | Feasibility | Reason |
|---|---:|---|
| Top 10-20 villa/townhouse communities | High | Public floor plans are discoverable, and manual/semi-automated curation is realistic. |
| Top 100 projects/phases | Medium | Requires source tracking, naming normalization, extraction QA, and ongoing maintenance. |
| All Dubai villas/townhouses | Low initially | Too many developers, phases, variants, mirrored layouts, and incomplete public sources. |
| Exact furniture-fit dimensions without confirmation | Not safe | Public plans are frequently approximate and may differ from as-built conditions. |

## Evidence From Public Sources

### DAMAC Hills 2

Public floor-plan pages show repeatable villa/townhouse type codes, bedroom counts, areas, and plan images. Examples include type-code patterns such as `TH12-4E` and `TH12-4M`.

Sources:

- https://www.binayah.com/dubai/floor-plans/damac-hills-2/
- https://www.bayut.com/floorplans/dubai/damac-hills-2-akoya-by-damac/

### Al Furjan / Nakheel

Al Furjan and related Nakheel communities have public brochures and floor-plan PDFs for villas and townhouses. These often include layouts and areas, but also include important disclaimers that floor plans, dimensions, and square footage are approximate and may vary.

Sources:

- https://alfurjan-dubai.ae/Al-Furjan-brochure.pdf
- https://www.nakheel.com/docs/nakheelcorporatelibraries/default-document-library/welcome-to-tilal-al-furjanc7027000-a9ec-499f-a97c-328abea58570.pdf

### Dubai Hills / Arabian Ranches / Emaar-Style Developments

Public brochures and third-party hosted PDFs often include floor plans with imperial and metric dimensions, but they also tend to include construction-tolerance and final-dimension disclaimers.

Example source:

- https://www.hmshomes.com/wp-content/uploads/2018/02/Club_Villas_Floorplan.pdf

### Property Portals And Aggregators

Portals such as Bayut publish community-level floor-plan pages. There are also unofficial APIs and data products that advertise access to portal data, but these should be treated carefully. If an API or source is unofficial, scraper-based, or unclear on rights, Ritzy should not build a production dependency on it without legal review.

Example source:

- https://bayutapi.dev/about

### Dubai REST / DLD

Dubai REST and Dubai Land Department services are useful official data ecosystems, but they should not be assumed to provide a reusable floor-plan geometry database for Ritzy. Their public services are primarily oriented around property services, ownership, transactions, project status, and official documents, not a ready-to-ingest room-dimension API.

Source:

- https://dubailand.gov.ae/en/eservices/dubai-rest/

## Data Acquisition Paths

### 1. Manual Curated Seed Library

Best for MVP.

Process:

1. Choose 10-20 high-volume villa/townhouse communities.
2. Collect public developer brochures, floor-plan PDFs, and reputable portal references.
3. Extract type names, bedroom counts, floor levels, room labels, visible dimensions, and plan images.
4. Normalize community/project/type aliases.
5. QA each extracted layout.
6. Store source URL, extraction date, and confidence.

Pros:

- Fastest path to product value.
- Keeps scope controlled.
- Allows human QA before affecting furniture-fit logic.

Cons:

- Does not scale automatically.
- Needs ongoing maintenance as new phases launch.

### 2. Semi-Automated PDF/Image Extraction

Best for scaling after the first manual library.

Use OCR and floor-plan parsing to extract:

- room labels
- printed dimensions
- floor names
- wall outlines
- door/window symbols where possible
- type names from brochure headings or nearby text

This should still have human review. Automated parsing can accelerate curation, but it should not silently create trusted measurements.

Relevant companion research:

- `docs/Research/measurement-capture-options.md`

### 3. User-Upload Data Flywheel

Best long-term asset.

Flow:

1. User enters community/project/type.
2. Ritzy asks whether the suggested layout matches.
3. If not, user uploads their developer floor plan or handover plan.
4. Ritzy extracts and uses the plan for that user's project.
5. With explicit permission, Ritzy uses anonymized structured data to improve the layout library.

This is likely more defensible and more accurate than broad scraping.

### 4. Partnerships

Best for scale and legal clarity.

Potential partners:

- developers
- brokerages
- property-management firms
- handover inspection companies
- renovation/interior-fitout firms

Partnership value:

- cleaner source files
- explicit rights
- more accurate type metadata
- access to handover/as-built plan variants
- possible lead-generation relationships

## Core Technical Challenge: Identity Resolution

The hardest problem is mapping messy user language to the correct layout.

A user might enter:

- "Damac Hills 2, 5 bed, Type 4"
- "Akoya Oxygen, cluster X, 5BR"
- "TH12-4E"
- "4 bedroom end unit"
- "Murooj Al Furjan 4-bed corner"
- "Tilal Al Furjan Type B"
- "Arabian Ranches 3 Elie Saab 5BR"

These may differ by:

- developer
- project phase
- cluster
- bedroom count
- corner/end/middle unit
- facade option
- plot size
- mirrored layout
- floor count
- handover revision
- post-handover modification

Ritzy should treat matching as a ranked selection problem, not a single autocomplete.

## Recommended User Flow

1. Ask for location/community.
2. Ask for project/subcommunity/phase.
3. Ask for property type and bedroom count.
4. Ask for villa/townhouse type if known.
5. Show likely matches with small plan thumbnails and key metadata.
6. Let user choose "this looks like mine" or "not sure."
7. Ask which room they want to design.
8. Prefill measurements for the selected room.
9. Require user confirmation or correction.
10. Mark measurement confidence in the database.

Suggested UI copy:

- "We found likely layouts for your community."
- "Choose the plan that looks closest to your home."
- "These dimensions come from a developer floor plan and may vary. Confirm before we size furniture."
- "Not seeing your layout? Upload your floor plan."

## Suggested Data Model

```text
property_layouts
  id
  country
  city
  community
  subcommunity
  developer
  project_or_phase
  handover_status
  property_type
  bedroom_count
  unit_type_code
  marketing_type_name
  corner_middle_end
  facade_variant
  mirror_variant
  floor_count
  built_up_area_sqft
  built_up_area_sqm
  plot_area_min_sqft
  plot_area_max_sqft
  source_url
  source_type
  source_rights_status
  confidence
  last_verified_at
  notes
```

```text
property_layout_aliases
  id
  property_layout_id
  alias
  alias_source
```

```text
property_layout_rooms
  id
  property_layout_id
  floor_level
  room_name
  normalized_room_type
  length_cm
  width_cm
  ceiling_height_cm
  area_sqm
  geometry_json
  doors_json
  windows_json
  confidence
  notes
```

```text
user_room_measurement_sources
  id
  room_id
  property_layout_id
  source
  confidence
  user_confirmed_at
  user_edited_at
```

Measurement source enum should include:

- `manual`
- `floor_plan_upload`
- `known_developer_layout`
- `third_party_scan_import`
- `native_room_scan`
- `designer_verified`

## Accuracy And Trust Model

Developer plans are useful but not final truth.

Reasons:

- Brochures often say dimensions are approximate.
- Final handover dimensions can vary.
- Mirrored variants may be confused.
- Owners may modify walls, doors, joinery, kitchens, storage, or flooring.
- Open-plan zones may not map cleanly to one labeled room.
- Some plans show total area but not every room's usable internal dimensions.

Recommended confidence levels:

| Source | Suggested Confidence | Product Use |
|---|---:|---|
| Known developer layout, unconfirmed | Medium | Prefill only; require confirmation before fit-sensitive buying. |
| User-uploaded floor plan, parsed | Medium | Prefill; user confirms. |
| User-confirmed developer layout | Medium-high | Use for design and approximate product fit. |
| User-measured dimensions | High | Use for product fit, with normal designer review. |
| Designer/as-built verified | Highest | Best source for tight clearances. |

Shopping-list fit rule:

- If clearance is generous, a confirmed developer layout may be acceptable.
- If clearance is tight, request measured confirmation.
- Never label a tight fit as safe based only on an unconfirmed developer plan.

## Legal And Rights Considerations

Floor-plan images are likely copyrighted. Public availability does not automatically mean Ritzy can store, republish, or use them in the product.

Safer approach:

- Use public sources to identify common layouts during research.
- Store extracted structured facts where legally permissible.
- Keep source URLs and attribution internally.
- Avoid public display of copyrighted plan images unless rights are clear.
- Prefer user-uploaded plans for that user's own project.
- Ask explicit consent before using uploads to improve the shared library.
- Pursue direct partnerships for reusable floor-plan image libraries.

Legal review is required before productionizing scraped or third-party floor-plan images.

## Privacy And Security

Home floor plans are sensitive. They reveal entrances, windows, room layout, family routines, and potential security vulnerabilities.

Ritzy should:

- Treat full-home plans as high-sensitivity user data.
- Use signed URLs and private storage.
- Separate raw floor-plan files from extracted room measurements.
- Minimize sharing with third-party vendors.
- Disclose third-party parsing before upload.
- Allow users to delete floor-plan files.
- Avoid sending full-home plans to retailers.
- Keep only room-level measurement context where possible.

## MVP Build Plan

### Phase 1: Seed Dataset

Target 50-100 high-volume layouts across 5-10 communities.

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

For each layout, capture:

- community
- project/phase
- developer
- bedroom count
- type code and aliases
- floor count
- BUA/plot area where available
- floor-plan source
- room labels
- visible dimensions for living, dining, bedrooms, majlis/family room, home office, and other common design targets
- confidence/disclaimer

### Phase 2: Onboarding Match UI

Add a "Find my layout" path:

1. Community search.
2. Project/phase picker.
3. Bedroom count.
4. Unit type picker or "I don't know."
5. Candidate plan cards.
6. Room selector.
7. Measurement confirmation.

Fallbacks:

- Upload floor plan.
- Enter measurements manually.
- Use designer review.

### Phase 3: Measurement Integration

Connect confirmed prefilled measurements to the existing `room_measurements` flow so product matching and design generation can use them.

Important behavior:

- Store source as `known_developer_layout` or equivalent.
- Preserve whether user confirmed or edited the prefilled values.
- Use confidence in product-fit warnings.

### Phase 4: Curation Tooling

Build an internal admin tool or import pipeline:

- upload/source a floor-plan PDF
- extract candidate rooms/dimensions
- normalize community/type
- review and approve
- generate aliases
- record source/disclaimer
- publish to the searchable library

## Practical Effort Estimate

Pilot effort:

- Research and collect first 50-100 plans: 1-2 weeks.
- Normalize and QA dataset: 1 week.
- Build lightweight matching UI and database tables: 1-2 weeks.
- Integrate with measurement confirmation and product-fit confidence: 1 week.

Total for a useful pilot: roughly 4-6 weeks, assuming one engineer plus one research/ops person or designer doing curation.

Expansion effort:

- Ongoing curation as new communities/phases are launched.
- Best handled as an internal content/data operations process, not a one-time engineering project.

## Major Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Incorrect type match | Furniture fit recommendations become unreliable | Show ranked candidates, thumbnails, and require user confirmation. |
| Approximate developer dimensions | Tight products may not fit | Confidence labels and measured-confirmation gate. |
| Copyrighted plan images | Legal exposure | Store structured data, avoid republishing images without rights, pursue partnerships. |
| Naming inconsistency | User cannot find layout | Alias table and fuzzy search. |
| Coverage gaps | User loses trust if expected layout is missing | Position as "we may have your layout"; offer upload/manual fallback. |
| As-built modifications | Prefill differs from home | Ask user to confirm room dimensions and immovable features. |
| Multi-purpose open-plan spaces | Wrong design zone | Let user mark the target zone or select room region. |

## Chief Architect Questions

1. Should known developer layouts become a first-class source in the `room_measurements` model?
2. Should the library store only structured measurements, or also floor-plan assets where rights permit?
3. What confidence fields are needed so product matching can treat unconfirmed developer measurements differently from user-measured values?
4. Should this live as app data in Supabase, or as a versioned repo-managed dataset with an ingestion job?
5. What is the minimum geometry representation needed for doors/windows and open-plan zones?
6. How should we handle aliases and fuzzy matching without making onboarding feel like a property portal?
7. What internal tooling is needed to make curation safe and repeatable?

## Final Position

Ritzy should pursue a Dubai villa/townhouse layout library.

It is not a replacement for measurement verification. It is a low-friction prefill layer that can make onboarding feel locally intelligent and materially reduce effort for users in standardized developer communities.

The right architecture is confidence-aware:

- known layout for prefill
- user confirmation for design
- measured/as-built verification for tight furniture fit

This gives Ritzy a defensible Dubai-specific advantage without overclaiming accuracy.

## Related Research

- `docs/Research/measurement-capture-options.md`

## Sources

- DAMAC Hills 2 floor plans via Binayah: https://www.binayah.com/dubai/floor-plans/damac-hills-2/
- DAMAC Hills 2 floor plans via Bayut: https://www.bayut.com/floorplans/dubai/damac-hills-2-akoya-by-damac/
- Al Furjan brochure PDF: https://alfurjan-dubai.ae/Al-Furjan-brochure.pdf
- Tilal Al Furjan brochure PDF: https://www.nakheel.com/docs/nakheelcorporatelibraries/default-document-library/welcome-to-tilal-al-furjanc7027000-a9ec-499f-a97c-328abea58570.pdf
- Dubai Hills Club Villas floor plan PDF: https://www.hmshomes.com/wp-content/uploads/2018/02/Club_Villas_Floorplan.pdf
- BayutAPI disclaimer/about page: https://bayutapi.dev/about
- Dubai REST: https://dubailand.gov.ae/en/eservices/dubai-rest/
