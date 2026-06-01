# Design Spatial Rules Corpus

**Status:** Research corpus for later implementation. Documentation only.
**Date:** 2026-06-01
**Scope:** Living rooms, combined living + dining spaces, dining rooms, bedrooms, and home offices as secondary scope.
**Primary trigger:** Sam's living-room failure case: the room looked aesthetically good, but seating did not correctly face or relate to the focal wall / TV / sofa relationship.

This corpus translates professional space-planning guidance into Ritzy-friendly rules that can later become clarifying questions, prompt guidance, structured warnings, and manual QA checks. It intentionally does **not** implement code, change prompts, change image-generation behavior, or propose DB schema changes as the first move.

## Source Register

Use these source IDs in the rule cards below.

| ID | Source | Useful evidence |
| --- | --- | --- |
| S1 | [Rayon Design: Living room layout rules](https://www.rayon.design/knowledge-base/living-room/rules) | Living-room circulation, coffee-table spacing, rug anchoring, TV distance, focal-point/framing guidance. |
| S2 | [Room Sketch 3D: Furniture Spacing Guidelines](https://www.roomsketch3d.com/learn/traffic-flow-spacing/furniture-spacing-guidelines) | Practical furniture-spacing thresholds: coffee table distance, walkway width, dining clearance, conversation distance, side-table height. |
| S3 | [ADA 2010 Standards: accessible-route width](https://www.ada.gov/law-and-regs/design-standards/2010-stds/) | 36 in / 915 mm accessible-route width as a conservative circulation reference, not a residential design mandate. |
| S4 | [RTINGS: TV size to distance calculator](https://www.rtings.com/tv/reviews/by-size/size-to-distance-relationship) | Viewing-distance logic based on field of view; 30-degree mixed-use and 40-degree cinema-style references. |
| S5 | [Rayon Design: Dining room layout rules](https://www.rayon.design/knowledge-base/dining-room/rules) | Dining circulation, table/chair spacing, clearance around table, table-to-kitchen flow, rug/zone treatment. |
| S6 | [U.S. Department of Energy: Lighting Principles and Terms](https://www.energy.gov/energysaver/lighting-principles-and-terms) | Residential lighting uses, including ambient/task/accent lighting, glare, color temperature, and residential CRI guidance. |
| S7 | [OSHA: Computer workstation components](https://www.osha.gov/etools/computer-workstations/components) | Workstation ergonomics: monitor in front of user, distance, posture, input-device support. |
| S8 | [Sisterly Interior: Living room interior design in Dubai](https://sisterlyinterior.com/living-room-interior-design-dubai/) | Dubai open-plan living/dining/kitchen context, harsh daylight, storage, zoning, majlis and villa/apartment differences. |
| S9 | [BG Interior Arabia: Villa space planning in Dubai](https://bginteriorarabia.ae/blog/villa-space-planning-interior-dubai/) | Dubai villa zoning, circulation, focal placement, dining near kitchen, bedroom planning cues. |
| S10 | [Kat Black Design Studio: Majlis Interior Design Dubai](https://katblackuae.com/majlis-interior-design-dubai/) | UAE majlis as a formal hospitality room with L-shaped/U-shaped perimeter seating, host orientation, and guest-capacity planning. |
| S11 | [Lowe's: What Is the Right Size Rug?](https://www.lowes.com/pdf/What_is_the_Right_Size_Rug-.pdf) | Living/dining/bedroom rug anchoring conventions and proportional rug selection. |

## Checkability Definitions

- **Hard-checkable:** Can be checked from data Ritzy can plausibly hold today or in the beta slice: room type, `design_briefs.structured_json`, current room measurements, generated role lists, and selected product dimensions when present. Hard checks must return `needs_measurement` or `not_applicable` when confidence is insufficient.
- **Prompt-checkable:** Can be expressed as future additive design language and tested by inspecting the assembled prompt string, but cannot be proven from current structured data alone.
- **Vision-QA-only:** Requires a human or vision model to inspect the generated image because Ritzy does not currently know object positions, wall/window/door locations, TV location, lighting positions, or exact circulation paths.

Important: with the current measurement model, exact seating orientation, focal-wall alignment, door/window blockage, rug placement, and table clearance are **not** truly hard-checkable. They should not be represented as deterministic pass/fail checks until geometry, openings, focal-wall coordinates, and furniture placement data exist.

## Suggested Additive Intent Shape

Do not add schema first. If implementation proceeds later, store this under an additive key such as `design_briefs.structured_json.spatialIntent` and let the domain layer normalize it.

```ts
type SpatialIntent = {
  layoutMode?: "living_only" | "living_plus_dining" | "dining_only" | "bedroom" | "home_office" | "unknown";
  focalPoint?: "tv_media_wall" | "view_window" | "fireplace" | "art_display_wall" | "conversation" | "bed_wall" | "workstation" | "unknown";
  focalPointConfidence?: "user_selected" | "assumed" | "unknown";
  seatingPriority?: "tv_viewing" | "conversation" | "family_lounging" | "formal_hosting" | "majlis_hosting" | "mixed" | "unknown";
  diningNeeded?: boolean;
  diningSeatCount?: number | null;
  hostingMode?: "daily_family" | "formal_guests" | "large_gatherings" | "unknown";
  workMode?: "daily_work" | "occasional_admin" | "video_calls" | "study" | "unknown";
  mustKeepClear?: string[];
  existingPiecesToKeep?: string[];
  assumptions?: string[];
};
```

## Living Room Rules

### L1. Primary Seating Addresses the Focal Point

- **Room type:** Living room; combined living zone.
- **Design rationale:** A living room needs a hierarchy. The main sofa should clearly relate to the selected focal point, whether that is the TV/media wall, view, fireplace, art/display wall, or conversation center. This is the anchor fix for Sam's issue.
- **Checkability:** Vision-QA-only.
- **Required inputs:** `focalPoint`, `seatingPriority`, known/assumed focal wall, sofa/chair placement in the render.
- **Suggested clarifying question:** "What should the main seating face first: TV/media wall, view/window, fireplace, art/display wall, or conversation?"
- **Suggested structured field:** `spatialIntent.focalPoint`; `spatialIntent.focalPointConfidence`.
- **Example good layout:** Sofa faces the TV/media wall; chairs angle toward the sofa and coffee table so TV viewing and conversation both read clearly.
- **Example failure:** Sofa floats sideways to the media wall while accent chairs face unrelated directions; the room has nice furniture but no primary relationship.
- **Beta-safe implementation note:** Guarantee focal-point capture and produce a warning/assumption if skipped. Do not claim this is hard-checked until wall/furniture positions exist.
- **Sources:** S1, S2, S8, S9.

### L2. Seating Forms a Conversation Zone

- **Room type:** Living room; combined living zone; majlis/formal hosting variant.
- **Design rationale:** Seating should address a shared center and support face-to-face use. Professional layouts avoid isolated display seating that looks good in a still image but fails socially.
- **Checkability:** Vision-QA-only.
- **Required inputs:** `seatingPriority`, seating role list, sofa/chair positions, coffee table/ottoman center.
- **Suggested clarifying question:** "Should this room prioritize TV viewing, conversation, family lounging, formal hosting, or a balanced mix?"
- **Suggested structured field:** `spatialIntent.seatingPriority`.
- **Example good layout:** Sofa and two lounge chairs form a U or L around a coffee table; chairs are angled toward the sofa.
- **Example failure:** Sofa faces a wall while chairs face a window and no one in the group naturally faces another seated person.
- **Beta-safe implementation note:** Use manual QA wording: "Do the main seats relate to each other and to the declared focal point?"
- **Sources:** S1, S2, S10.

### L3. Conversation Distance Is Comfortable

- **Room type:** Living room; majlis/formal hosting variant.
- **Design rationale:** Seating that is too far apart feels staged; seating that is too tight blocks movement. Practical guidance commonly keeps conversational seating within a roughly human speaking distance.
- **Checkability:** Prompt-checkable.
- **Required inputs:** `seatingPriority`; room dimensions; generated/selected furniture footprints if available.
- **Suggested clarifying question:** "Will this room be used for intimate family lounging, formal guests, or larger gatherings?"
- **Suggested structured field:** `spatialIntent.hostingMode`.
- **Example good layout:** Sofa and chairs sit close enough to talk across the coffee table, with clear side circulation.
- **Example failure:** Chairs are placed at distant corners or across the room solely for symmetry.
- **Beta-safe implementation note:** Prompt language can request conversational grouping; exact distances require object placement data.
- **Sources:** S2, S10.

### L4. Coffee Table Is Reachable From Primary Seating

- **Room type:** Living room; combined living zone.
- **Design rationale:** Coffee tables are functional, not just decorative. Sources cluster around roughly 14-24 in / 35-60 cm between sofa and coffee table, depending on source and room size.
- **Checkability:** Prompt-checkable.
- **Required inputs:** Seating positions, coffee-table position, table size, room dimensions.
- **Suggested clarifying question:** Usually not needed; inferred from living-room use unless user requests no coffee table.
- **Suggested structured field:** `spatialIntent.assumptions[] = "Coffee table should be usable from primary seating."`
- **Example good layout:** Coffee table sits centered in front of sofa, reachable without blocking legroom.
- **Example failure:** Coffee table is a tiny decorative object far from the sofa or pushed into the circulation path.
- **Beta-safe implementation note:** Hard-check only a rough "coffee table role exists when living room supports it"; reach itself is vision QA until placement data exists.
- **Sources:** S1, S2.

### L5. Rug Anchors the Seating Group

- **Room type:** Living room; combined living zone.
- **Design rationale:** A rug should collect the seating pieces into one spatial unit. Common professional guidance places at least the front legs of sofa/chairs on the rug; too-small rugs make pieces look disconnected.
- **Checkability:** Vision-QA-only.
- **Required inputs:** Rug dimensions, seating positions, room image.
- **Suggested clarifying question:** "Do you want a rug-led lounge zone, or should flooring stay mostly visible for maintenance/children/pets?"
- **Suggested structured field:** `spatialIntent.rugPreference` only if later useful; not a beta minimum.
- **Example good layout:** Rug extends under the front legs of sofa and chairs and contains the coffee table.
- **Example failure:** Small rug floats under only the coffee table with all seating legs off-rug.
- **Beta-safe implementation note:** Keep as prompt/QA language; do not block generation on rug sizing without selected rug dimensions.
- **Sources:** S1, S2, S11.

### L6. Main Circulation Avoids Cutting Through the Conversation Core

- **Room type:** Living room; combined living zone.
- **Design rationale:** Good living rooms let people move to entries, balcony doors, dining zones, and corridors without walking between the sofa and TV or through the coffee-table zone. 30-36 in / 760-915 mm is a practical circulation target; 36 in is a conservative accessible-route reference.
- **Checkability:** Prompt-checkable.
- **Required inputs:** Entry/door/window positions, balcony/terrace door, circulation path, seating/table positions.
- **Suggested clarifying question:** "Which door, balcony, window, or wall must stay clear?"
- **Suggested structured field:** `spatialIntent.mustKeepClear`.
- **Example good layout:** A clear path runs behind the sofa or around the group, leaving the sofa-TV/coffee-table relationship undisturbed.
- **Example failure:** The path from entry to balcony slices between sofa and coffee table or directly in front of the TV.
- **Beta-safe implementation note:** Record must-keep-clear text now; exact circulation solving requires geometry/opening data.
- **Sources:** S1, S2, S3, S8, S9.

### L7. TV Viewing Distance and Angle Are Plausible

- **Room type:** Living room; combined living zone when TV is present.
- **Design rationale:** TV rooms need credible viewing distance and a low off-axis angle. RTINGS summarizes field-of-view guidance around 30 degrees for mixed use and 40 degrees for a cinematic feel.
- **Checkability:** Prompt-checkable.
- **Required inputs:** TV presence, TV size, TV location, sofa location, viewing distance, seating priority.
- **Suggested clarifying question:** "Is TV viewing a primary use, a secondary use, or not needed in this room?"
- **Suggested structured field:** `spatialIntent.seatingPriority`; optional future `spatialIntent.tvNeeded`.
- **Example good layout:** Sofa faces TV/media wall at a plausible distance; secondary chairs angle inward rather than blocking the TV.
- **Example failure:** TV appears on a side wall while the sofa faces elsewhere, or seating is dramatically too close/far for the implied screen.
- **Beta-safe implementation note:** Use as assumption/warning and manual QA. Hard TV checks require TV size and actual sofa-to-screen distance.
- **Sources:** S1, S4.

### L8. Side Tables and Lighting Support Real Seats

- **Room type:** Living room; combined living zone; bedroom lounge corner.
- **Design rationale:** Side tables, task lights, and lamps should serve actual seated positions. They should not be decorative islands divorced from seating.
- **Checkability:** Vision-QA-only.
- **Required inputs:** Seating positions, side-table/lamp positions, lighting needs.
- **Suggested clarifying question:** "Will this room be used for reading, hosting, TV, or mainly display?"
- **Suggested structured field:** `spatialIntent.activities` as a future optional field; not a beta minimum.
- **Example good layout:** Sofa end has a reachable side table and lamp; reading chair has a nearby light source.
- **Example failure:** Lamps sit behind seating without useful reach or glare onto the TV.
- **Beta-safe implementation note:** Include in manual QA checklist; do not create a deterministic blocker.
- **Sources:** S2, S6.

### L9. Windows, Views, and Daylight Are Respected

- **Room type:** Living room; Dubai apartments/villas; combined living zone.
- **Design rationale:** Dubai homes often have strong daylight, balcony doors, view walls, and AC/window-treatment constraints. If the view is the focal point, seating should share it; if not, the layout still should not block doors, daylight, curtains, or AC flow.
- **Checkability:** Vision-QA-only.
- **Required inputs:** Window/balcony/AC positions, focal-point intent, render image.
- **Suggested clarifying question:** "Is the window/view the main feature, and are any balcony doors or curtain runs required to stay clear?"
- **Suggested structured field:** `spatialIntent.focalPoint`; `spatialIntent.mustKeepClear`.
- **Example good layout:** Seating is oriented to enjoy the view while leaving balcony access and curtain stack space open.
- **Example failure:** Tall furniture blocks a window wall or sofa blocks a balcony door.
- **Beta-safe implementation note:** Flag as data gap when window/door locations are missing.
- **Sources:** S8, S9.

### L10. Living Furniture Scale Fits the Measured Envelope

- **Room type:** Living room; combined living zone.
- **Design rationale:** Even without placement data, Ritzy can avoid implausible overfurnishing by comparing room dimensions to anchor roles and selected product dimensions.
- **Checkability:** Hard-checkable.
- **Required inputs:** `wallLengthCm`, `roomDepthCm`, measurement confidence, product dimensions or standard role footprint assumptions.
- **Suggested clarifying question:** "Are these measurements verified, estimated, or still unknown?"
- **Suggested structured field:** Existing `structured_json.measurements`; optional `spatialIntent.assumptions`.
- **Example good layout:** Room dimensions support an anchor sofa plus circulation and a coffee table at realistic scale.
- **Example failure:** A large sectional, two armchairs, oversized coffee table, and console are proposed for a narrow small room.
- **Beta-safe implementation note:** Return `needs_measurement` unless `fitConfidenceUsePolicy.canSupportProductFit` is true; do not infer exact layout clearances.
- **Sources:** S1, S2, S3.

### L11. Dubai Formal Hosting / Majlis Mode Changes the Seating Logic

- **Room type:** Living room; majlis; villa formal reception; optional combined public zone.
- **Design rationale:** In UAE homes, formal hosting can prioritize guest capacity, perimeter seating, symmetry, and face-to-face social visibility over TV-first lounging.
- **Checkability:** Prompt-checkable.
- **Required inputs:** `seatingPriority`, `hostingMode`, cultural/use preference.
- **Suggested clarifying question:** "Is this a casual family lounge, a formal guest/majlis space, or a mixed-use living room?"
- **Suggested structured field:** `spatialIntent.seatingPriority = "formal_hosting" | "majlis_hosting"`; `spatialIntent.hostingMode`.
- **Example good layout:** Perimeter or U-shaped seating supports guest conversation and leaves a clear central zone.
- **Example failure:** A TV-first sectional blocks guest flow in a room intended for formal hosting.
- **Beta-safe implementation note:** Ask only when room name or brief mentions majlis, formal guests, villa reception, or large gatherings.
- **Sources:** S8, S9, S10.

## Combined Living + Dining Rules

### C1. Living-Only vs Living + Dining Must Be Explicit

- **Room type:** Living room when ambiguous; open-plan spaces.
- **Design rationale:** A combined room is not just a larger living room. It needs zone allocation, dining roles, separate circulation, and often different focal logic.
- **Checkability:** Hard-checkable.
- **Required inputs:** User answer or explicit assumption.
- **Suggested clarifying question:** "Is this a living-only room, or a combined living + dining space?"
- **Suggested structured field:** `spatialIntent.layoutMode`.
- **Example good layout:** The app knows before generation that the space needs both a lounge zone and a dining zone.
- **Example failure:** A room that should include dining is treated as a single lounge, or dining is crammed in after concept generation.
- **Beta-safe implementation note:** This is a guaranteed beta question for living rooms where the room name, measurements, or source image does not make the mode obvious.
- **Sources:** S5, S8, S9.

### C2. Zones Are Distinct but Cohesive

- **Room type:** Combined living + dining.
- **Design rationale:** Open-plan rooms need visual zoning so living and dining read as intentional areas while sharing style, palette, and circulation.
- **Checkability:** Vision-QA-only.
- **Required inputs:** `layoutMode`, zone positions, rug/lighting/furniture orientation, render image.
- **Suggested clarifying question:** "Should the living and dining areas feel open and continuous, or more clearly separated?"
- **Suggested structured field:** Optional future `spatialIntent.zoningPreference`; not a beta minimum.
- **Example good layout:** Lounge is anchored by a rug and sofa orientation; dining is anchored by table and pendant, with coherent materials across both.
- **Example failure:** Sofa, table, rug, and chairs scatter across the room without readable zones.
- **Beta-safe implementation note:** Manual QA check only until furniture positions and zones exist.
- **Sources:** S5, S8, S9.

### C3. Each Zone Has Its Own Anchor

- **Room type:** Combined living + dining.
- **Design rationale:** Living zone usually anchors around TV/view/conversation; dining anchors around table, pendant, and sometimes sideboard/art wall. One room may have two focal hierarchies.
- **Checkability:** Prompt-checkable.
- **Required inputs:** `focalPoint`, `diningNeeded`, dining seat count, zone intent.
- **Suggested clarifying question:** "Should the dining area have its own visual moment, such as a pendant, sideboard, art wall, or remain secondary?"
- **Suggested structured field:** `spatialIntent.focalPoint`; future `spatialIntent.diningAnchor`.
- **Example good layout:** Living sofa addresses the media/view wall; dining table has centered pendant and sideboard wall.
- **Example failure:** Dining chairs face the TV as if the table were part of the lounge, or the dining table blocks the living focal wall.
- **Beta-safe implementation note:** Store living focal point now; defer dining anchor unless user chooses combined mode.
- **Sources:** S1, S5, S8, S9.

### C4. Circulation Spine Connects Entry, Living, Dining, and Kitchen

- **Room type:** Combined living + dining.
- **Design rationale:** Open-plan rooms often fail when the path from entry to kitchen/balcony/dining cuts through the sofa-TV axis or table pull-out area.
- **Checkability:** Prompt-checkable.
- **Required inputs:** Entry, kitchen, balcony, door locations; table/sofa placement; must-keep-clear constraints.
- **Suggested clarifying question:** "Which routes must stay clear: entry to kitchen, entry to balcony, living to dining, or another path?"
- **Suggested structured field:** `spatialIntent.mustKeepClear`.
- **Example good layout:** Circulation runs along the side or behind zones; neither coffee table nor dining chair pull-out blocks the route.
- **Example failure:** Users must squeeze between TV and sofa or behind dining chairs to reach the kitchen.
- **Beta-safe implementation note:** Requires wall/opening/adjacency data for hard checking. Current beta can only capture constraints and QA visually.
- **Sources:** S2, S3, S5, S8, S9.

### C5. Sofa, Console, Rugs, or Lighting Can Define the Boundary

- **Room type:** Combined living + dining.
- **Design rationale:** A sofa back, slim console, rug edge, or pendant axis can separate zones without a wall.
- **Checkability:** Vision-QA-only.
- **Required inputs:** Sofa/table/rug/lighting placement.
- **Suggested clarifying question:** "Is an open visual boundary acceptable, or should the zones feel more separated?"
- **Suggested structured field:** Optional future `spatialIntent.zoningPreference`.
- **Example good layout:** Sofa back and console define the lounge edge; dining table sits beyond the boundary with enough pull-out room.
- **Example failure:** Sofa back blocks the only circulation path or dining chairs collide with the lounge rug edge.
- **Beta-safe implementation note:** Manual QA only; no deterministic solver.
- **Sources:** S5, S8, S9.

### C6. Combined Role Set Is Scaled, Not Duplicated

- **Room type:** Combined living + dining.
- **Design rationale:** Combined rooms require a union of living and dining roles, but scaled to footprint. A small apartment should not receive full living-room and full dining-room product loads.
- **Checkability:** Hard-checkable.
- **Required inputs:** `layoutMode`, room dimensions, measurement confidence, role list, product dimensions when available, `diningSeatCount`.
- **Suggested clarifying question:** "How many people should the dining area seat day-to-day?"
- **Suggested structured field:** `spatialIntent.diningSeatCount`.
- **Example good layout:** Compact apartment gets sofa, slim media unit, small dining table, four chairs, one rug, and light support.
- **Example failure:** Full sectional, two lounge chairs, coffee table, side tables, six-seat table, large sideboard, and multiple rugs crowd the same narrow room.
- **Beta-safe implementation note:** A pure domain role-union and rough scale warning is a good first hard check.
- **Sources:** S2, S5, S8, S9.

### C7. Dining Belongs Near Kitchen or Service Flow When Known

- **Room type:** Combined living + dining.
- **Design rationale:** Dining usually works best near kitchen/service access. In Dubai apartments, living/dining/kitchen are often an open-plan chain; in villas, formal dining may still need service access.
- **Checkability:** Prompt-checkable.
- **Required inputs:** Kitchen adjacency or plan topology; dining zone position.
- **Suggested clarifying question:** "Is the dining area meant to sit near the kitchen/service side, near the view, or as a formal central zone?"
- **Suggested structured field:** Future `spatialIntent.diningLocationPreference`; not beta minimum.
- **Example good layout:** Dining table sits near the kitchen side with clear chair pull-out and no conflict with lounge seating.
- **Example failure:** Dining table is placed far from service flow and blocks the living focal wall.
- **Beta-safe implementation note:** Hard-check impossible without adjacency data.
- **Sources:** S5, S8, S9.

## Dining Room Rules

### D1. Dining Table Has Adequate Pull-Out Clearance

- **Room type:** Dining room; combined dining zone.
- **Design rationale:** Chairs need enough room to pull out and for people to circulate. Practical sources converge around 36 in / 900 mm as a baseline clearance from table edge to wall/obstruction, with more when circulation passes behind seated chairs.
- **Checkability:** Hard-checkable.
- **Required inputs:** Room dimensions, table dimensions, chair count, measurement confidence. Exact placement still requires geometry.
- **Suggested clarifying question:** "How many seats should this table support day-to-day and for guests?"
- **Suggested structured field:** `spatialIntent.diningSeatCount`; `spatialIntent.hostingMode`.
- **Example good layout:** Table size leaves a realistic chair-pull-out zone and at least one clear circulation side.
- **Example failure:** Six-seat table fills the room edge-to-edge, making chairs unusable.
- **Beta-safe implementation note:** Hard-check only a minimum envelope: table dimensions plus clearance against room dimensions. Return `needs_measurement` on weak measurements.
- **Sources:** S2, S3, S5.

### D2. Chair Count Matches Hosting Intent and Table Size

- **Room type:** Dining room; combined dining zone.
- **Design rationale:** Dining quality depends on real seating capacity, not only a pretty table. Chair count should fit user intent and table dimensions.
- **Checkability:** Hard-checkable.
- **Required inputs:** `diningSeatCount`, table dimensions, chair width assumptions or product dimensions.
- **Suggested clarifying question:** "How many people should this dining area seat most days, and what is the maximum guest count?"
- **Suggested structured field:** `spatialIntent.diningSeatCount`; `spatialIntent.hostingMode`.
- **Example good layout:** Four-person daily table in apartment; expandable or six/eight-person option for formal villa dining where dimensions support it.
- **Example failure:** Six chairs packed around a table that visually/physically supports four.
- **Beta-safe implementation note:** Use role quantity and product dimensions where available; otherwise produce a warning rather than fail.
- **Sources:** S5.

### D3. Pendant or Over-Table Fixture Centers on the Table

- **Room type:** Dining room; combined dining zone.
- **Design rationale:** A dining pendant visually anchors the table. If lighting is off-axis, the dining zone feels accidental.
- **Checkability:** Vision-QA-only.
- **Required inputs:** Table position, light position, render image.
- **Suggested clarifying question:** Usually not needed unless user has an existing chandelier point to preserve.
- **Suggested structured field:** `spatialIntent.existingPiecesToKeep` or `mustKeepClear` if fixture is fixed.
- **Example good layout:** Pendant or chandelier centers over table and aligns with the dining zone.
- **Example failure:** Pendant floats between table and sofa or is centered in the room but not on the table.
- **Beta-safe implementation note:** Manual QA item; hard-check requires fixture coordinates and table coordinates.
- **Sources:** S5.

### D4. Dining Rug Fits Pulled-Out Chairs

- **Room type:** Dining room; combined dining zone.
- **Design rationale:** Dining rugs should extend beyond the table so chairs remain on the rug when pulled out. Too-small rugs snag chairs and visually shrink the table zone.
- **Checkability:** Prompt-checkable.
- **Required inputs:** Table dimensions, rug dimensions, chair pull-out allowance.
- **Suggested clarifying question:** "Do you want a rug under the dining table, or should dining remain rug-free for easy maintenance?"
- **Suggested structured field:** Optional future `spatialIntent.diningRugPreference`.
- **Example good layout:** Rug extends around the table enough for chairs to sit and pull out on the rug.
- **Example failure:** Chair back legs fall off the rug when pulled out.
- **Beta-safe implementation note:** Prompt/QA only unless selected rug and table dimensions are known.
- **Sources:** S2, S5, S11.

### D5. Sideboard Does Not Block Dining Circulation

- **Room type:** Dining room; larger combined dining zone.
- **Design rationale:** Sideboards add storage and a wall focal point, but only when they do not steal chair pull-out or primary circulation.
- **Checkability:** Prompt-checkable.
- **Required inputs:** Room dimensions, sideboard dimensions, table placement, circulation route.
- **Suggested clarifying question:** "Do you need dining storage or a serving sideboard in this room?"
- **Suggested structured field:** Future `spatialIntent.diningStorageNeeded`; not beta minimum.
- **Example good layout:** Sideboard sits on a clear wall with enough walking space between it and pulled-out chairs.
- **Example failure:** Sideboard narrows the only path behind dining chairs.
- **Beta-safe implementation note:** Use warning language when room envelope is too tight for sideboard plus table.
- **Sources:** S5.

## Bedroom Rules

### B1. Bed Sits on a Credible Primary Wall

- **Room type:** Bedroom.
- **Design rationale:** The bed is the anchor. It should sit against a stable primary wall, with a clear relationship to entry, windows, wardrobes, and bedside support.
- **Checkability:** Vision-QA-only.
- **Required inputs:** Door/window/wardrobe positions, bed wall, render image.
- **Suggested clarifying question:** "Is there a wall the bed must use or avoid because of windows, wardrobes, AC, or existing outlets?"
- **Suggested structured field:** `spatialIntent.mustKeepClear`; `spatialIntent.existingPiecesToKeep`.
- **Example good layout:** Bed centers on the primary wall with credible clearance to wardrobe and door.
- **Example failure:** Bed blocks a wardrobe, sits awkwardly under a window where curtains cannot function, or faces the door with no side clearance.
- **Beta-safe implementation note:** Manual QA until opening and fixed-element positions exist.
- **Sources:** S9, S11.

### B2. Bed Size and Side Clearances Fit the Room

- **Room type:** Bedroom.
- **Design rationale:** Bedroom usability depends on walking paths around the bed and access to wardrobes/ensuite. A rough 24-30 in / 600-760 mm side clearance is a practical target where space allows.
- **Checkability:** Hard-checkable.
- **Required inputs:** Room dimensions, bed dimensions, bedside dimensions, measurement confidence.
- **Suggested clarifying question:** "What bed size is required: queen, king, super king, twin pair, or flexible?"
- **Suggested structured field:** Future `spatialIntent.bedSizePreference`; not beta minimum unless bedroom slice proceeds.
- **Example good layout:** Bed and bedside tables fit with usable side approaches.
- **Example failure:** King bed and wide nightstands leave no walking path.
- **Beta-safe implementation note:** Hard-check only the minimum footprint envelope; exact side placement and door conflicts require geometry.
- **Sources:** S2, S9.

### B3. Bedside Tables and Lighting Serve Both Used Sides

- **Room type:** Bedroom.
- **Design rationale:** Bedside support is part of function. Symmetry is common, but smaller rooms may use one table, wall sconces, or integrated shelves.
- **Checkability:** Prompt-checkable.
- **Required inputs:** Bed size, occupancy, room dimensions, bedside dimensions.
- **Suggested clarifying question:** "Does the bed need two usable sides for two sleepers, or can one side sit closer to a wall?"
- **Suggested structured field:** Future `spatialIntent.bedAccess = "both_sides" | "one_side"`.
- **Example good layout:** Both sides have reachable table/lighting where space supports it.
- **Example failure:** One side is blocked but the room is presented as a two-person primary bedroom.
- **Beta-safe implementation note:** Prompt/QA unless implementing bedroom-specific intent.
- **Sources:** S6, S9.

### B4. Wardrobe, Ensuite, and Door Paths Stay Clear

- **Room type:** Bedroom.
- **Design rationale:** Bedrooms fail when beds, benches, rugs, or side tables block wardrobe doors, bathroom access, or entry swing.
- **Checkability:** Vision-QA-only.
- **Required inputs:** Door/wardrobe/ensuite positions, swing/slider type, bed/bench placement.
- **Suggested clarifying question:** "Which wardrobe, ensuite, balcony, or door paths must remain clear?"
- **Suggested structured field:** `spatialIntent.mustKeepClear`.
- **Example good layout:** Bed wall and bench placement preserve a clean route to wardrobe and ensuite.
- **Example failure:** Bench blocks wardrobe clearance or bed cuts across the ensuite route.
- **Beta-safe implementation note:** Flag as not representable without door/wardrobe geometry.
- **Sources:** S2, S3, S9.

### B5. Bedroom Rug Is Proportional to Bed

- **Room type:** Bedroom.
- **Design rationale:** Bedroom rugs should relate to the bed, usually extending beyond bed sides/foot enough to step onto. Tiny foot rugs or misplaced runners weaken the composition.
- **Checkability:** Vision-QA-only.
- **Required inputs:** Bed size, rug size, rug placement.
- **Suggested clarifying question:** Usually not needed; ask only if low-maintenance/no-rug preference matters.
- **Suggested structured field:** Optional future `spatialIntent.rugPreference`.
- **Example good layout:** Rug sits under lower two-thirds of the bed or large enough under the bed grouping to create a soft landing.
- **Example failure:** Rug floats at the foot, too small to connect to the bed.
- **Beta-safe implementation note:** Manual QA; no hard check without rug/bed coordinates.
- **Sources:** S11.

## Home Office Rules

### O1. Desk Orientation Supports Work, Sightline, and Video Calls

- **Room type:** Home office; study nook.
- **Design rationale:** A useful office considers door/window sightlines, glare, task focus, and video-call background. It should not place the desk only where it looks decorative.
- **Checkability:** Prompt-checkable.
- **Required inputs:** Work mode, door/window locations, video-call need, desk position.
- **Suggested clarifying question:** "Is this office for daily work, occasional admin, study, or video calls?"
- **Suggested structured field:** `spatialIntent.workMode`.
- **Example good layout:** Desk has useful light without screen glare and a credible backdrop for calls.
- **Example failure:** Desk faces harsh window glare or leaves a cluttered/awkward video background when video calls are primary.
- **Beta-safe implementation note:** Secondary scope; only include if home-office planning slice proceeds.
- **Sources:** S6, S7.

### O2. Desk and Chair Have Roll-Back Clearance

- **Room type:** Home office.
- **Design rationale:** A chair needs space to pull back and move; cramped desk layouts are visually plausible but unusable.
- **Checkability:** Hard-checkable.
- **Required inputs:** Room dimensions, desk depth/width, chair clearance assumption or dimensions, measurement confidence.
- **Suggested clarifying question:** "Does the office need a full task chair and daily-work setup, or a compact occasional desk?"
- **Suggested structured field:** `spatialIntent.workMode`.
- **Example good layout:** Desk and chair fit with clear pull-back space and access to storage.
- **Example failure:** Desk fills the alcove so the chair cannot pull out.
- **Beta-safe implementation note:** Envelope hard-check only; actual chair path requires placement data.
- **Sources:** S2, S7.

### O3. Storage and Task Lighting Are Reachable

- **Room type:** Home office.
- **Design rationale:** Storage, shelving, and lighting should support the working position rather than decorate unused walls.
- **Checkability:** Vision-QA-only.
- **Required inputs:** Desk/chair position, storage/lighting positions, work mode.
- **Suggested clarifying question:** "Do you need visible shelving, closed storage, printer/storage, or mainly a clean desk?"
- **Suggested structured field:** Future `spatialIntent.officeStorageNeeded`.
- **Example good layout:** Task lamp and storage are within easy reach or on the work wall.
- **Example failure:** Shelving is behind the chair with no reachable storage, or light placement creates monitor glare.
- **Beta-safe implementation note:** Manual QA only.
- **Sources:** S6, S7.

## Room-Intent Questions Before Concept Generation

These are the beta-safe questions most likely to prevent costly layout mistakes before image generation.

### Living Rooms

1. **Layout mode:** "Is this a living-only room, or a combined living + dining space?" -> `spatialIntent.layoutMode`.
2. **Primary focal point:** "What should the main seating face first: TV/media wall, view/window, fireplace, art/display wall, or conversation?" -> `spatialIntent.focalPoint`.
3. **Seating priority:** "Should seating prioritize TV viewing, conversation, family lounging, formal hosting/majlis, or a balanced mix?" -> `spatialIntent.seatingPriority`.
4. **Must-keep-clear:** "Which doors, windows, balcony access, walls, or existing pieces must stay clear?" -> `spatialIntent.mustKeepClear`; `spatialIntent.existingPiecesToKeep`.

### Combined Living + Dining

1. **Dining need:** "Do you need a dining area in this same room?" -> `spatialIntent.diningNeeded`.
2. **Dining seat count:** "How many people should the dining area seat day-to-day?" -> `spatialIntent.diningSeatCount`.
3. **Circulation priority:** "Which routes must stay clear: entry to kitchen, entry to balcony, living to dining, or another route?" -> `spatialIntent.mustKeepClear`.

### Dining Rooms

1. **Seat count:** "How many people should this dining room seat daily and for guests?" -> `spatialIntent.diningSeatCount`; `spatialIntent.hostingMode`.
2. **Storage:** "Do you need a sideboard or serving/storage wall?" -> future optional field.
3. **Existing fixture:** "Is there an existing chandelier/pendant point that must stay?" -> `spatialIntent.existingPiecesToKeep`.

### Bedrooms

1. **Bed size:** "What bed size is required?" -> future `bedSizePreference`.
2. **Access:** "Does the bed need two usable sides?" -> future `bedAccess`.
3. **Clear paths:** "Which wardrobes, balcony doors, ensuite paths, or windows must stay clear?" -> `spatialIntent.mustKeepClear`.

### Home Offices

1. **Work mode:** "Is this for daily work, occasional admin, study, or video calls?" -> `spatialIntent.workMode`.
2. **Storage:** "Do you need closed storage, visible shelving, printer/storage, or a clean desk only?" -> future optional field.
3. **Glare/backdrop:** "Should the desk prioritize daylight, view, privacy, or video-call background?" -> future optional field.

## Checkability Matrix

| Bucket | Rules | Can do in beta? | Notes |
| --- | --- | --- | --- |
| Hard-checkable now | C1, C6, D1 envelope, D2 partial, L10, B2 envelope, O2 envelope | Yes, with measurement confidence gates | These can evaluate intent presence, role quantities, rough footprint envelopes, and product dimensions where known. |
| Prompt-checkable only | L3, L4, L6, L7, L11, C3, C4, C7, D4, D5, B3, O1 | Later, only after explicit prompt approval | Tests can inspect additive language; behavior changes only when flag/approval allows prompt integration. |
| Vision-QA-only | L1, L2, L5, L8, L9, C2, C5, D3, B1, B4, B5, O3 | Yes as manual QA checklist | These require render inspection until object/wall/opening positions exist. |
| Requires new geometry/topology data | Exact focal-wall alignment, exact sofa-to-TV distance, door/window blockage, true circulation path, dining chair pull-out around obstacles, rug-leg anchoring, pendant-to-table centering | No | Needs wall/window/door coordinates, fixed fixtures, furniture placement coordinates, rug dimensions, lighting points, and sometimes kitchen/entry adjacency. |

## Data Ritzy Does Not Currently Collect

Flag any rule that needs the following as not hard-checkable:

- Wall topology and named walls.
- Door, balcony, wardrobe, and window coordinates.
- Fixed TV/media/fireplace/art wall location.
- Kitchen/entry/balcony adjacency for open-plan living+dining.
- Exact furniture placement coordinates and orientation.
- Rug, coffee table, dining table, side table, and lighting coordinates.
- Pendant/chandelier point location.
- AC vents/returns and curtain stack space.
- Seat-to-TV distance and TV size.
- Chair pull-out conflict with exact obstacles.
- User's formal hosting / majlis needs unless asked.

## Manual QA Checklist for Beta

Use this on generated concepts/renders; it is especially important for Sam's failing case.

1. Does the main sofa clearly address the declared or assumed focal point?
2. Do chairs angle toward the sofa/conversation center rather than facing unrelated directions?
3. Does the coffee table sit within usable reach of the primary seating?
4. Does the living rug anchor the seating group rather than floating too small?
5. Is the TV/view/fireplace/art wall readable as the intended focal point?
6. Is a clear circulation route visible without cutting through the sofa/coffee-table/TV core?
7. If combined living + dining, are the living and dining zones distinct but cohesive?
8. If combined, does dining have enough implied chair pull-out and a clear route to kitchen/entry/balcony where visible?
9. Are doors, balcony access, windows, wardrobes, curtains, and AC vents visibly respected?
10. Are side tables, lamps, task lights, and storage serving real seats/work positions?

## Designer Warning Language

These warnings are safe before prompt/runtime changes because they describe assumptions and limits.

- **Focal-point assumption:** "We assumed the TV/media wall is the primary focal point. Confirm if the view, fireplace, art wall, or conversation should lead instead."
- **Living vs combined ambiguity:** "This room may be a combined living + dining space. Confirm before concept generation so dining roles and circulation are planned, not added later."
- **Measurement confidence:** "Measurements are not reliable enough for tight clearance checks. Treat scale guidance as directional."
- **Circulation data gap:** "Door/window/balcony locations are not captured, so circulation and blockage need manual QA."
- **Dining clearance warning:** "Dining role count may overfill the measured room. Consider fewer seats, a round/extendable table, or removing sideboard."
- **Bedroom clearance warning:** "Bed size may leave limited side access. Confirm bed size and wardrobe/door positions."
- **Dubai daylight/access warning:** "Confirm balcony, curtain, window, and AC constraints before approving placement near glazing."

## Recommended Next Implementation Slice

The next slice should be **beta-safe intent capture and warnings**, not prompt integration.

1. **Guarantee two living-room planning questions:** living-only vs combined living + dining, and primary focal point. Add seating priority if the question cap or micro-step allows it.
2. **Store structured intent additively:** use `design_briefs.structured_json.spatialIntent` or an equivalent additive object. Do not add a DB table or generated type first.
3. **Add concept/layout warning language:** surface assumptions and measurement/data-gap warnings from the corpus without changing concept or render prompts.
4. **Add a manual QA checklist:** include Sam's focal-wall/seating failure as the primary regression check.
5. **Add hard checks only where honest:** intent presence, combined-role scaling, and rough envelope checks gated by measurement confidence.
6. **Keep prompt integration behind explicit approval:** only after the corpus and intent shape are accepted should a future flagged slice add spatial layout language to concept prompts.

This minimum closes Sam's missing-question gap and creates visible design-review guardrails without changing runtime image generation behavior.
