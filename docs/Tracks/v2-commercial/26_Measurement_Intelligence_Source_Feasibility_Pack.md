# 26 Measurement Intelligence Source Feasibility Pack

Status: PR source-feasibility pack
Date: 2026-05-25
Audience: Chief Architect, Sam
Scope: docs-only source feasibility for future Measurement Intelligence reviewed seeds. This pack does not approve migrations, generated DB types, Supabase writes, runtime wiring, UI changes, external parsers, or raw floor-plan storage/display.

## Executive Recommendation

Start with a small reviewed structured-facts seed path for:

1. Murooj Al Furjan townhouses and villas.
2. Maple at Dubai Hills Estate townhouses.
3. Elan at Tilal Al Ghaf townhouses.

Keep DAMAC Hills 2 Violet/Natura and Arabian Ranches III Joy/Ruba as secondary candidates until source provenance and rights posture are cleaner.

This recommendation is deliberately conservative. Public web surfaces make layout codes, bedroom counts, BUA ranges, floor levels, and room labels available for several Dubai villa/townhouse products, but most plan images and PDFs should be treated as `public_reference_only` or `structured_facts_only`. Future seeds should store reviewed structured facts, source links, confidence, rights posture, and disclaimers. They should not store or display raw copyrighted plan images unless the source is partner-licensed or rights-cleared.

## Hard Stop Confirmation

This feasibility pack crossed none of the stop rules:

- No DB/schema migration.
- No generated DB types.
- No Supabase connections or writes.
- No runtime/UI/app-action wiring.
- No external parser/vendor integration.
- No private/user floor-plan assets.
- No raw copyrighted plan images.
- No Product Matching or Catalog-First runtime coupling.
- No production flags or deploys.

## Selection Rationale

The candidates below were selected because they are common Dubai family-home products where a layout prefill can reduce onboarding friction:

- townhouse/villa typologies recur across many units
- users and agents commonly refer to stable type codes or phrases such as `Type 2E`, `Layout A`, `TH12-4E`, or `4 bedroom corner`
- public source surfaces expose enough structured facts to assess feasibility before any real seed work
- the homes are likely to have repeated living/dining, bedroom, kitchen, maid, utility, and terrace patterns that can support non-fit-safe measurement prefills

Confidence here means confidence for a future reviewed seed candidate, not truth for product-fit decisions. All unconfirmed developer-layout rows should remain `prefill` and require user/designer confirmation.

## Recommendation Matrix

| Priority | Candidate | Source availability | Coverage | Rights posture | Feasibility confidence | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Murooj Al Furjan townhouses/villas | High: Nakheel context plus public floor-plan PDFs/agent mirrors | Strong for layout labels, BUA, floor levels; moderate room-label coverage | Structured facts only unless source permission is obtained | Medium-high | Proceed to reviewed structured-facts seed |
| 2 | Maple, Dubai Hills Estate | High: Emaar product page, public brochure mirrors, Bayut floorplan pages, agent listings | Strong for type aliases and BUA; room dimensions usually plan-derived | Structured facts only; do not store raw plan images | Medium-high | Proceed to reviewed structured-facts seed |
| 3 | Elan, Tilal Al Ghaf | Medium-high: official Tilal Al Ghaf page plus brochure/floor-plan mirrors | Strong room labels and total area in brochure surfaces; limited exact room dimensions | Structured facts only; seek partner permission for richer use | Medium | Proceed to reviewed structured-facts seed, with rights review |
| 4 | DAMAC Hills 2 Violet/Natura | Medium-high: many public broker/project mirrors; weaker direct-developer source hygiene | Good type codes and floor totals; room-level measurement confidence mixed | Defer for partner/feed/permission unless official source is confirmed | Medium | Defer for partner/feed/permission |
| 5 | Arabian Ranches III Joy/Ruba | Medium: official Emaar product pages and brochure PDFs; fragmented unit detail | Good type family labels; room measurements likely image-derived | Public reference only unless brochure/license reviewed | Medium-low | Proceed only to synthetic/sample seed or defer |

## Candidate 1: Murooj Al Furjan Townhouses And Villas

### Source Availability

Public source signals:

- Nakheel has current Murooj Al Furjan context and describes the community as low-density, with homes designed around generous internal layouts, terraces, balconies, light, flow, and privacy: <https://www.nakheel.com/en/media-centre/blogs/detail/the-strategic-location-of-murooj-al-furjan>
- Nakheel's 2021 launch note says Murooj Al Furjan four- and five-bedroom villas have built-up areas up to 4,042 sq ft and features such as entrance foyer, living/entertainment areas, open/closed kitchen options, maid's room, storage, garage, garden, and landscaped front/side areas: <https://www.nakheel.com/en/media-centre/press-releases/news-detail/2021/05/19/nakheel-launches-418-new-homes-at-al-furjan>
- A Nakheel-hosted brochure/floor-plan PDF is publicly reachable: <https://www.nakheel.com/docs/nakheelcorporatelibraries/default-document-library/murooj-al-furjan.pdf?sfvrsn=50185c16_1>
- Publicly indexed Murooj townhouse floor-plan PDFs/mirrors expose 3- and 4-bedroom townhouse layout labels and floor-area tables, for example: <https://d33om22pidobo4.cloudfront.net/projects/types/floorplans/murooj-al-furjan-townhouse-floor-plans-25ff6459b-57e1-439a-bb10-fab8d150988c.pdf>
- Broker/project pages also expose unit labels such as 4-bedroom townhouse, corner unit, Layout A: <https://www.tanamiproperties.com/Projects/Murooj-Al-Furjan-Townhouses-FloorPlans>

### Likely Layout Identifiers And Aliases

- `Murooj Al Furjan`
- `Murooj Al Furjan West`
- `Al Furjan`
- `Murooj`
- `Murooj Al Furjan 3-bed middle`
- `Murooj Al Furjan 4-bed corner`
- `3 bedroom townhouse middle unit`
- `4 bedroom townhouse corner unit`
- `Layout A`
- `Layout B`
- `4-bedroom villa`
- `5-bedroom villa`

### Rights Posture

Recommended source rights status: `structured_facts_only`.

Rationale:

- Nakheel pages are strong provenance for community/project existence and high-level structured facts.
- Public floor-plan PDFs/mirrors are useful for human review, but raw plan pages should not be stored or displayed unless Nakheel or a licensed partner grants rights.
- If a future seed uses only structured facts such as layout label, floor, BUA, room labels, and approximate dimensions, preserve source URL/provenance and disclaimer.

### Structured Facts Without Raw Images

Feasible. Extractable structured fields likely include:

- community, development, developer
- property type
- bedroom count
- layout/unit label
- corner/middle variant
- BUA/plot range where published
- floor levels
- room labels from plan text
- source disclaimers that dimensions/floor plans are approximate

Do not store the plan image/PDF itself in the shared library.

### Expected Room-Measurement Coverage

Expected coverage: medium.

- Good: floor levels, total areas, living/dining, kitchen, maid, bedrooms, terrace/balcony/porch, garage.
- Mixed: room-level length/width may require human reading from plan graphics or may be absent.
- Fit posture: `prefill`; cannot support tight-clearance decisions without user/designer confirmation.

### Confidence Level

Recommended future layout confidence: `prefill`.

Source feasibility confidence: medium-high.

### Risks And Stop Criteria

Risks:

- Public mirrors may not be official or may be stale.
- Different phases may reuse names but vary layouts.
- PDFs include approximate-plan disclaimers.
- Villas and townhouses should not be mixed in one seed family.

Stop criteria:

- No source URL with defensible provenance for the exact layout.
- Room measurements only visible in raw plan images and cannot be converted to structured facts without rights review.
- Source disclaimer forbids extraction/reuse beyond personal reference.

### Recommendation

Proceed to reviewed structured-facts seed after source review. This is the strongest first real candidate.

## Candidate 2: Maple At Dubai Hills Estate

### Source Availability

Public source signals:

- Emaar's official Maple page confirms Maple at Dubai Hills Estate and describes 3-, 4-, and 5-bedroom townhouses, four home types, maid's room, covered parking, gardens, and 204-251 sq m ranges: <https://www.emaar.com/en/properties/maple/>
- Public floor-plan pages expose Maple 3 4-bedroom townhouse Type/unit `2/2E`: <https://www.bayut.com/floorplans/details-1408.html>
- PSI's project floor-plan summary lists Maple sizes and model names by bedroom count, including Type 2 and Type 3 variants: <https://psinv.net/en/projects/dubai/dubai-hills-estate/dubai-hills-estate3/maple/floor-plan>
- PSI's project floor-plan summary also lists Maple sizes and model names by bedroom count: <https://psinv.net/en/projects/dubai/dubai-hills-estate/dubai-hills-estate3/maple/floor-plan>
- Public PDF mirrors include Maple brochures/floor-plan sheets with Type 2/Unit 2E and cluster diagrams: <https://think-properties.ae/dubai-hills-emaar/maple/type2-cluster4.pdf>

### Likely Layout Identifiers And Aliases

- `Maple`
- `Maple 1`
- `Maple 2`
- `Maple 3`
- `Dubai Hills Estate Maple`
- `Emaar Maple`
- `Type 2`
- `Type 2E`
- `Unit 2E`
- `2E`
- `Type 2M`
- `Unit 2M`
- `Type 3M`
- `Type 3E`
- `4 bedroom end unit`
- `4 bedroom Type 2E`

### Rights Posture

Recommended source rights status: `structured_facts_only`.

Rationale:

- Emaar official project page is good for high-level structured facts.
- Bayut floorplan pages and public brochure mirrors can guide review, but plan images/PDFs should not be stored or displayed.
- Agent listings can validate that type aliases are still used in the resale/rental market, but should not be treated as authoritative measurement sources.

### Structured Facts Without Raw Images

Feasible. Extractable structured fields likely include:

- community/development/project
- type codes
- bedroom counts
- BUA by type
- floor levels
- room labels from brochure/floorplan text
- common market aliases from listings

Avoid storing plan images and any proprietary brochure screenshots.

### Expected Room-Measurement Coverage

Expected coverage: medium.

- Good: type code, bedroom count, BUA, floor labels, common room labels.
- Mixed: room dimensions may be plan-image derived rather than text tables.
- Living/dining/kitchen prefills can be useful, but must be marked approximate.

### Confidence Level

Recommended future layout confidence: `prefill`.

Source feasibility confidence: medium-high.

### Risks And Stop Criteria

Risks:

- Multiple Maple subphases and cluster variants may share similar labels.
- Some user-facing pages expose images rather than text measurement tables.
- Upgraded homes may differ materially from original developer layouts.

Stop criteria:

- Cannot map a floorplan to a specific phase/type without ambiguity.
- Room dimensions are only obtainable from copyrighted images without permission.
- Source terms or robots restrictions prevent acceptable reference use.

### Recommendation

Proceed to reviewed structured-facts seed for a narrow first pass: Type 2E and Type 3M/3E only, not the whole Maple universe.

## Candidate 3: Elan At Tilal Al Ghaf

### Source Availability

Public source signals:

- Tilal Al Ghaf's official Elan page confirms 3- and 4-bedroom duplex townhouses and includes a Floor Plans section: <https://www.tilalalghaf.com/en/neighbourhoods/elan>
- Public floor-plan download pages identify Elan townhouses as 3- and 4-bedroom townhouse products: <https://www.tanamiproperties.com/Projects/Elan-Townhouses-Download-FloorPlan>
- Bayut maintains an Elan floorplan surface by bedroom count: <https://www.bayut.com/floorplans/dubai/tilal-al-ghaf/elan/>
- Public brochure mirrors expose 4-bedroom townhouse floor-plan text with labeled rooms and total area around 219 sq m / 2,354 sq ft: <https://pf-ae-documents.s3.ap-southeast-1.amazonaws.com/new-project/brochure-eae157ad.pdf>

### Likely Layout Identifiers And Aliases

- `Elan`
- `Tilal Al Ghaf Elan`
- `Elan 3 bedroom townhouse`
- `Elan 4 bedroom townhouse`
- `3 bedroom duplex townhouse`
- `4 bedroom duplex townhouse`
- `Majid Al Futtaim Elan`
- `Tilal Al Ghaf 4-bed townhouse`

### Rights Posture

Recommended source rights status: `structured_facts_only`, with partner-license exploration.

Rationale:

- Official project page is strong for project existence and high-level facts.
- Brochure/floor-plan mirrors can support human feasibility review but should not be stored/displayed.
- Tilal Al Ghaf/Majid Al Futtaim may be a better partner-permission target than a scrape target if richer room-level facts are needed.

### Structured Facts Without Raw Images

Feasible, but rights review should be explicit.

Candidate structured facts:

- community/development/developer
- 3- and 4-bedroom townhouse products
- duplex/floor-level information
- total area
- room labels: living, dining, kitchen, bedroom, bath, lobby, utility, maid, master bath, parking, garden/deck/terrace where listed

### Expected Room-Measurement Coverage

Expected coverage: medium.

- Good: room labels and total area.
- Mixed: exact room length/width may require plan-image interpretation.
- Useful for initial room list and approximate living/dining scale, not for fit decisions.

### Confidence Level

Recommended future layout confidence: `prefill`.

Source feasibility confidence: medium.

### Risks And Stop Criteria

Risks:

- Official page confirms floor plans but may not expose text-rich dimensions.
- Brochure mirrors may be redistributed without explicit rights.
- Different clusters/building rows may use mirrored or subtly different layouts.

Stop criteria:

- Need to store brochure pages or images to make the seed useful.
- Cannot confirm whether 3- and 4-bedroom variants share room labels/floor structure.
- Source review says public brochure facts cannot be reused even as structured facts.

### Recommendation

Proceed to reviewed structured-facts seed only after a narrow legal/source review. Otherwise defer for partner/feed/permission.

## Candidate 4: DAMAC Hills 2 Violet / Natura Townhouses

### Source Availability

Public source signals:

- Public project/floor-plan pages for DAMAC Hills 2 Violet Phase 4 list 4-bedroom townhouses, unit codes `TH12-4E` and `TH12-4M`, and sizes around 2,352-2,415 sq ft: <https://www.tanamiproperties.com/Projects/Violet-Phase-4-at-Damac-Hills-2-FloorPlans>
- Other project surfaces repeat `TH12-4E & TH12-4M` and the 2,415.33 sq ft figure: <https://habicoproperties.com/project/dubai-townhouse-violet-4-phase-2-at-damac-hills-2/>
- Metropolitan's Violet page confirms 4-bedroom townhouses in DAMAC Hills 2, area from 2,352 sq ft, and handover timing: <https://metropolitan.realestate/damac-hills-2/violet/>
- Public brochure/floor-plan mirrors expose `TH12-4E/TH12-4M`, ground/first/roof floors, and total-area tables: <https://investindxb.com/wp-content/uploads/2024/06/DAMAC-HILLS-2-VIOLET-BROCHURE-investindxb.pdf>

### Likely Layout Identifiers And Aliases

- `DAMAC Hills 2`
- `Akoya Oxygen`
- `Violet`
- `Violet Phase 4`
- `Violet 4`
- `Natura`
- `TH12-4E`
- `TH12-4M`
- `TH12-E`
- `TH12-M`
- `4BR townhouse`
- `4 bedroom townhouse + maid`
- `roof floor`

### Rights Posture

Recommended source rights status: `public_reference_only` until partner/source permission is clearer.

Rationale:

- Source abundance is high, but much of it is broker/off-plan marketing redistribution.
- The exact authoritative DAMAC floor-plan source should be confirmed before reviewed structured-facts seeds.
- If only type code, area, and floor labels are used, `structured_facts_only` may become reasonable after review.

### Structured Facts Without Raw Images

Partly feasible.

Likely facts:

- community
- cluster/project
- 4-bedroom townhouse
- type codes `TH12-4E` / `TH12-4M`
- total floor areas
- roof floor/future expansion labels
- common ground/first/roof structure

Room-level facts are riskier unless sourced from a clear official PDF or partner feed.

### Expected Room-Measurement Coverage

Expected coverage: low-medium.

- Strong for total area and type identifiers.
- Moderate for floor structure.
- Weak for reliable room length/width unless plan tables are text-extractable and rights-reviewed.

### Confidence Level

Recommended future layout confidence: `prefill`.

Source feasibility confidence: medium.

### Risks And Stop Criteria

Risks:

- DAMAC Hills 2 has many clusters and product releases with similar codes.
- Public source pages may mix Violet, Violet 2/3/4, Natura, and other DH2 releases.
- Off-plan plans may change before handover.

Stop criteria:

- Cannot pin `TH12-4E` and `TH12-4M` to a specific cluster/release.
- Only broker-mirrored plan images are available.
- Source review cannot classify facts beyond `public_reference_only`.

### Recommendation

Defer for partner/feed/permission or narrow to synthetic/sample seed only. Do not start reviewed structured-facts seed until source provenance improves.

## Candidate 5: Arabian Ranches III Joy / Ruba Townhouses

### Source Availability

Public source signals:

- Emaar's official Joy page confirms Joy at Arabian Ranches III, 3- and 4-bedroom townhouses, and design types `Type 1`, `Type 2`, and `Type 3`: <https://properties.emaar.com/en/properties/joy/>
- Emaar's 2019 Joy launch release confirms 3- and 4-bedroom townhouses in three design types: <https://properties.emaar.com/en/press-release-listing/following-strong-response-to-sun-at-arabian-ranches-iii-emaar-launches-joy-townhouse-community/>
- Public floor-plan mirrors for Joy exist, but this pack does not rely on them because reviewed HTTPS reachability was not reliable. Keep Joy evidence anchored to Emaar official pages unless a future source review finds a stable rights-reviewed source.
- Public Emaar brochure PDFs for Arabian Ranches III communities expose floor-plan marketing pages, for example Joy and Caya brochures: <https://properties.emaar.com/wp-content/uploads/2020/03/brochure-joy-en.pdf> and <https://properties.emaar.com/wp-content/uploads/2021/08/BROCHURE_CAYA_ARIII_EN.pdf>
- Public Ruba floor-plan PDF mirrors are indexed but source rights should be reviewed: <https://drehomes.com/admin_xcs6iwyiueuu8wd/assets/media/project/pdf/proj_floorplan_3712_RUBA_ARABIAN_RANCHES_III_floor-plan_portal_compressed_removed.pdf>

### Likely Layout Identifiers And Aliases

- `Arabian Ranches III`
- `Arabian Ranches 3`
- `ARIII`
- `Joy`
- `Ruba`
- `3 bedroom townhouse`
- `4 bedroom townhouse`
- `Type 1`
- `Type 2`
- `Type 3`
- `Unit Type 3`
- `4 bedroom townhouse unit type 3`

### Rights Posture

Recommended source rights status: `public_reference_only` for floor-plan images/PDFs, `structured_facts_only` for official Emaar text facts after review.

Rationale:

- Emaar official pages are solid for project/type existence.
- Exact floor-plan dimensions are likely embedded in brochure images/PDFs.
- Raw floor-plan pages should not be stored or displayed.

### Structured Facts Without Raw Images

Feasible for high-level facts; limited for room measurements.

Likely safe facts:

- community
- development/project
- bedroom count
- type family labels
- broad room labels if text is present

Room dimensions likely require more rights review.

### Expected Room-Measurement Coverage

Expected coverage: low-medium.

- Good: type labels and bedroom counts.
- Mixed: BUA and room labels depending on brochure text extraction.
- Weak: exact room length/width without raw plan interpretation.

### Confidence Level

Recommended future layout confidence: `prefill` for any seed.

Source feasibility confidence: medium-low.

### Risks And Stop Criteria

Risks:

- Several Arabian Ranches III subcommunities may use overlapping type numbers.
- Third-party floor-plan mirrors are not sufficient provenance alone.
- Plan pages may be illustrative and approximate.

Stop criteria:

- Cannot uniquely associate type code with community/subcommunity.
- Room-level dimensions are only image-derived.
- Emaar source review does not support structured-facts reuse.

### Recommendation

Proceed only to synthetic/sample seed for testing adapter shape, or defer until partner/feed/permission improves.

## Cross-Candidate Source And Rights Rules

Future reviewed seeds should follow these rules:

1. Store structured facts only: slugs, aliases, type codes, bedroom counts, floor labels, room labels, approximate dimensions, source URL, confidence, rights posture, and disclaimers.
2. Do not store or display raw plan images/PDFs unless rights-cleared or partner-licensed.
3. Do not infer tight-clearance-safe measurements from developer/broker plans.
4. Keep `layoutConfidence = prefill` and room `measurementConfidence = prefill` unless measurements are user-confirmed, designer-verified, or otherwise as-built verified.
5. Preserve all source disclaimers that plans, dimensions, and areas are approximate or subject to change.
6. Treat broker/listing pages as alias/supporting evidence, not primary measurement truth.
7. Prefer exact developer/project/phase/type mapping over broad community seeds.

## Suggested First Seed Slice

If the Chief Architect approves a follow-up docs/domain-only seed candidate PR, start with:

1. `murooj-al-furjan-townhouse-4br-corner-layout-a`
2. `murooj-al-furjan-townhouse-3br-middle-layout-a`
3. `maple-dubai-hills-townhouse-4br-type-2e`
4. `elan-tilal-al-ghaf-townhouse-4br`

Keep all records synthetic-safe or reviewed structured-facts only. Do not include raw plan images. Mark all dimensions as `prefill` and include source disclaimers.

## Stop Criteria Before Any Real Seed

Stop before seed creation if any of the following is true:

- A layout cannot be mapped to a stable community/development/type identifier.
- A source is only a private listing, user upload, WhatsApp file, or broker-shared plan.
- The team would need to store or display a raw floor-plan image to make the seed useful.
- The source rights posture is `do_not_use` or cannot be classified.
- Room-level measurement extraction would require OCR/parser/vendor integration.
- The next step requires Supabase writes, generated DB types, runtime wiring, or a migration.

## Sources Reviewed

- Emaar Maple official page: <https://www.emaar.com/en/properties/maple/>
- Bayut Maple 3 Type/unit 2/2E floorplan page: <https://www.bayut.com/floorplans/details-1408.html>
- PSI Maple floor-plan summary: <https://psinv.net/en/projects/dubai/dubai-hills-estate/dubai-hills-estate3/maple/floor-plan>
- Nakheel Murooj Al Furjan blog/context page: <https://www.nakheel.com/en/media-centre/blogs/detail/the-strategic-location-of-murooj-al-furjan>
- Nakheel Murooj launch press release: <https://www.nakheel.com/en/media-centre/press-releases/news-detail/2021/05/19/nakheel-launches-418-new-homes-at-al-furjan>
- Nakheel Murooj public brochure PDF: <https://www.nakheel.com/docs/nakheelcorporatelibraries/default-document-library/murooj-al-furjan.pdf?sfvrsn=50185c16_1>
- Murooj townhouse floor-plan public PDF mirror: <https://d33om22pidobo4.cloudfront.net/projects/types/floorplans/murooj-al-furjan-townhouse-floor-plans-25ff6459b-57e1-439a-bb10-fab8d150988c.pdf>
- Murooj Al Furjan Tanami floor-plan page: <https://www.tanamiproperties.com/Projects/Murooj-Al-Furjan-Townhouses-FloorPlans>
- Tilal Al Ghaf Elan official page: <https://www.tilalalghaf.com/en/neighbourhoods/elan>
- Elan Tanami floor-plan download page: <https://www.tanamiproperties.com/Projects/Elan-Townhouses-Download-FloorPlan>
- Bayut Elan floorplans: <https://www.bayut.com/floorplans/dubai/tilal-al-ghaf/elan/>
- Elan public brochure mirror: <https://pf-ae-documents.s3.ap-southeast-1.amazonaws.com/new-project/brochure-eae157ad.pdf>
- DAMAC Hills 2 Violet public floor-plan page: <https://www.tanamiproperties.com/Projects/Violet-Phase-4-at-Damac-Hills-2-FloorPlans>
- DAMAC Hills 2 Violet Habico project page: <https://habicoproperties.com/project/dubai-townhouse-violet-4-phase-2-at-damac-hills-2/>
- Metropolitan Violet by DAMAC page: <https://metropolitan.realestate/damac-hills-2/violet/>
- DAMAC Hills 2 Violet public brochure mirror: <https://investindxb.com/wp-content/uploads/2024/06/DAMAC-HILLS-2-VIOLET-BROCHURE-investindxb.pdf>
- Emaar Joy official page: <https://properties.emaar.com/en/properties/joy/>
- Emaar Joy launch release: <https://properties.emaar.com/en/press-release-listing/following-strong-response-to-sun-at-arabian-ranches-iii-emaar-launches-joy-townhouse-community/>
- Emaar Joy public brochure PDF: <https://properties.emaar.com/wp-content/uploads/2020/03/brochure-joy-en.pdf>
- Emaar Caya public brochure PDF: <https://properties.emaar.com/wp-content/uploads/2021/08/BROCHURE_CAYA_ARIII_EN.pdf>
- Ruba public floor-plan PDF mirror: <https://drehomes.com/admin_xcs6iwyiueuu8wd/assets/media/project/pdf/proj_floorplan_3712_RUBA_ARABIAN_RANCHES_III_floor-plan_portal_compressed_removed.pdf>
