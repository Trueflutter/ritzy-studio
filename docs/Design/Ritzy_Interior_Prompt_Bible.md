# Ritzy Interior Prompt Bible

Date: 2026-05-20

Status: research synthesis for review before implementation. This document should guide small follow-up PRs; it does not change runtime behavior by itself.

## Purpose

Ritzy should generate rooms that feel directed by a serious interior designer, not by a casual text-to-image prompt. The system should improve taste through compact, composable language: room design modules, richer style modules, global photorealism rules, and product-fidelity rules. The product should still preserve the user's source room, brief, and selected shopping items above all aesthetic ambition.

## Research Base

This synthesis draws from six research lanes:

- Living room design language: editorial/luxury residential layout, layering, rugs, lighting, art, drapery, accessories, and common bad outputs.
- Dining room design language: table/chair proportions, lighting height, sideboards, rug/no-rug logic, tablescape restraint, wall treatments, Dubai luxury, Japandi, Mediterranean, classic, and hotel-residential directions.
- Bedroom design language: bed-wall composition, headboards, layered bedding, rugs, curtains, bedside lighting, warmth, scale, and anti-generic rules.
- Bathroom design language: fixed fixture preservation, vanity-wall composition, wet/dry zones, stone/tile scale, glass, metals, mirror/sconce logic, and camera realism.
- Photorealistic interior / archviz prompting: camera, lens, corrected verticals, lighting behavior, material roughness, texture, imperfections, reflections, exposure, and avoiding fake CGI.
- Product-grounded render fidelity: product reference identity, anchor-item priority, silhouette/color/material/proportion locks, non-substitution language, and representative render disclosure.

Detailed source notes live in `docs/Research/` for dining, bedroom, and bathroom. The living, archviz, and product-fidelity lanes should be kept as source material for the first implementation PR.

## 1. Ritzy Visual Standard

Ritzy's visual target:

- Editorial residential interior photography.
- High-end but livable.
- Layered, warm, tactile, and realistic.
- Designed through proportion, material, light, and restraint.
- Residential in scale, not hotel lobby scale.
- Collected and composed, not fresh-from-one-catalog.
- Specific to the user's room type, architecture, brief, and selected products.

Ritzy should not generate:

- IKEA catalog simplicity.
- CGI showroom smoothness.
- Generic beige luxury.
- Gold-and-marble cliche.
- Overdecorated surfaces.
- Fantasy architecture.
- Impossible furniture or fixture layouts.
- Rendered rooms that ignore the source-room photo.
- Shopping-list renders that visually replace selected products with nicer invented alternatives.

The best output should feel like: a good interior designer set the room, a good photographer shot it, and a practical sourcing assistant grounded it in purchasable products.

## 2. Global Image Rules

Use these rules in both initial concept generation and final grounded render generation.

### Preserve First

- Preserve the source-room architecture: walls, ceiling plane, doors, windows, fixed openings, AC vents, visible switches/sockets, built-ins, ceiling details, and fixed bathroom fixtures.
- Preserve camera perspective and lens feel from the source photo unless the model needs a small correction for natural interior photography.
- Do not invent architectural renovations unless the user explicitly asks for renovation-level changes.
- Do not infer exact dimensions from the photo. Use provided measurements only when available.

### Physical Plausibility

- Use physically plausible scale: furniture proportions, chair heights, table heights, rug sizes, bed dimensions, vanity widths, tile sizes, door heights, countertop thickness, and walking clearance.
- Furniture must sit on the floor with contact shadows. Rugs must have thickness. Glass must have thickness and edge reflections.
- Lighting must have motivated sources: windows, practical lamps, sconces, pendants, cove lighting, recessed lights, or reflected bounce.
- Shadows should follow the visible daylight/practical-light direction, with realistic softness and falloff.
- Screens/TVs should be off, dark, softly reflective, or showing a subtle neutral screen. Do not generate fake UI, text, logos, or random imagery.

### Material Realism

- Use real material language: wool pile, linen weave, boucle texture, velvet nap, leather grain, honed stone, travertine pores, wood grain direction, plaster variation, grout joints, brushed metal, patina, glass reflection.
- Avoid showroom-smooth surfaces. Real interiors have roughness variation, softened bevels, fabric compression, curtain folds, cushion creases, slight asymmetry, and non-repeating texture.
- Avoid plastic-looking wood, rubbery fabric, mirror-polished stone everywhere, and flat color-fill materials.

### Camera And Photorealism

- Describe the output as high-end editorial interior photography, not just "photorealistic."
- Favor a 24-35mm full-frame interior lens for room views and 35-70mm for detail/vignette crops.
- Keep the camera level with corrected verticals and no fisheye distortion.
- Use balanced exposure: preserve window highlight detail where possible, maintain readable shadows, and avoid HDR halos or oversharpening.
- Add restrained photographic post-processing only: natural contrast, mild lens softness, optional subtle film grain.

### Global Avoid List

- No warped furniture, melted decor, duplicated product artifacts, floating tableware, impossible reflections, unmounted sconces, mismatched chair scale, or distorted rugs.
- No labels, prices, retailer logos, watermarks, or fake product labels.
- No AI text in art, books, screens, packaging, or decor.
- No random luxury shorthand: excessive gold, glossy grey marble everywhere, mirror walls, huge chandeliers, nightclub LED strips.

Concise global fragment:

> Preserve the source-room architecture and camera perspective. Generate high-end editorial residential interior photography with physically plausible scale, corrected verticals, motivated daylight/practical lighting, realistic contact shadows, tactile materials, roughness variation, fabric folds, natural reflections, and restrained lived-in imperfection. Avoid CGI showroom smoothness, fantasy architecture, warped objects, fake labels, invented text, impossible reflections, and generic beige luxury.

## 3. Room-Specific Prompt Modules

### Living Room

Composition rules:

- Build a conversational seating group, not a single sofa pointed at a TV by default.
- Anchor the seating zone with a generous rug. At minimum, front legs of major seating should sit on the rug; luxury rooms often use all-legs-on placement.
- Relate coffee table scale to the sofa: large enough to serve the seating group, close enough to use, with shape chosen to complement the seating.
- Use a focal point beyond the TV where possible: fireplace, view, art, built-ins, sculptural wall, or collected shelving.
- Keep breathing space and circulation; do not push every item against walls.

Must-consider objects:

- Sofa or sectional.
- One or two accent/lounge chairs when space allows.
- Coffee table or upholstered ottoman.
- Side tables.
- Generous rug.
- Floor/table lamps, sconces, picture light, or pendant.
- Full-height curtains/sheers where windows are visible.
- Large-scale art, mirror, built-ins, console, or shelving.
- Coffee-table books, tray, ceramic bowl, branches/flowers, sculptural object, cushions, throw.

Optional styling layers:

- Vintage or patinated element.
- Custom-looking millwork.
- Picture lights.
- Collected ceramics.
- Layered window treatments.
- Ottoman/stool for extra seating.

Lighting strategy:

- Use at least two layers, ideally three: ambient, task, and accent.
- Add warm practical lamps at different heights.
- Use daylight filtered through sheers or curtains when windows exist.

Material/detail language:

- Wool, linen, velvet, boucle, mohair, travertine, marble, walnut, oak, aged bronze, plaster, limewash, rattan/cane, leather, reeded glass.
- Designers' words: anchored, conversational, collected, patinated, tailored, sculptural, focal wall, negative space, tactile, generous drapery, vintage rug, styled vignette.

Common failures:

- Small rug island under coffee table only.
- Furniture shoved against walls.
- TV-facing lineup as the only layout.
- Tiny art above large sofa.
- No side tables or lamps.
- Matching catalog set.
- Gold/marble as the only "luxury" signal.
- Empty coffee table or cluttered coffee table.
- Short curtains, blown-out windows, fake hotel lobby scale.

Concise prompt fragment:

> Design the living room as a layered editorial residential seating group: sofa and lounge chairs arranged for conversation, anchored by a generously sized rug, usable coffee table and side tables, full-height window treatment where visible, layered warm lighting, scaled artwork or focal wall, and restrained styled surfaces with books, ceramics, tray, branches, and tactile cushions. Make it collected-not-matched, materially rich, and residential in scale.

### Dining Room

Composition rules:

- Anchor the room around the table, chairs, over-table light, and circulation.
- Size table and chairs plausibly before styling.
- Keep chair pull-out and walking clearance believable.
- Center the pendant/chandelier over the table, not blindly in the room if the table is offset.
- Use a rug only if it is large enough for pulled-out chairs; otherwise no rug is better.
- Add storage/serving function where wall space allows: sideboard, credenza, buffet, vitrine, bar cabinet, or built-in.

Must-consider objects:

- Dining table.
- Dining chairs with realistic seat height and spacing.
- Over-table pendant/chandelier/linear suspension.
- Secondary light: sconces, picture light, cove light, sideboard lamp.
- Sideboard/credenza where appropriate.
- Art/mirror/wall treatment.
- Tailored window treatment where visible.
- Restrained centerpiece/table styling.

Optional styling layers:

- Low vessel, taper candles, folded napkins, runner, ceramic bowl.
- Built-in bar or display shelving for larger villas.
- Mirror above sideboard only if it reflects light or a meaningful view.

Lighting strategy:

- Over-table fixture roughly related to table width and hung at believable dining height.
- Warm layered lighting on faces, table surface, art, and sideboard.
- Avoid harsh overhead-only light.

Material/detail language:

- Walnut, oak, ash, travertine, limestone, plaster, limewash, linen, boucle, leather, cane, rattan, ceramic, lacquer, fluted wood, brushed bronze, satin brass.
- Designers' words: circulation, clearance, chair pull-out, sightline, axial alignment, destination room, tailored, restrained, tactile, bespoke.

Common failures:

- Table floating in an empty box.
- Chandelier too high, low, tiny, huge, off-center, or unrelated to table.
- Chairs intersecting table legs/walls/sideboard.
- Rug too small for pulled-out chairs.
- Restaurant-like place settings or huge floral centerpieces.
- Sideboard missing on a wall that clearly needs function.
- Generic Dubai cliche: cold grey marble, high-gloss cream floors, gold trim everywhere.

Concise prompt fragment:

> Design a residential dining room around a properly scaled table, realistic chair spacing and pull-out clearance, a sculptural over-table fixture centered on the table, layered warm secondary lighting, and a sideboard or wall focal point where space allows. Use restrained tablescape styling, tactile materials, and residential hosting realism; choose a rug only if it can support pulled-out chairs.

### Bedroom

Composition rules:

- Organize the room through the bed wall first.
- Treat the headboard as an architectural anchor, not a small accessory.
- Scale nightstands, lamps, pillows, bedding, and rug to the bed size.
- Use symmetry for refined hotel/classic calm; use balanced asymmetry for warm minimal/soft residential when appropriate.
- Preserve restfulness: negative space, warm light, and fewer better objects.

Must-consider objects:

- Bed frame and realistic mattress depth.
- Headboard or bed-wall treatment.
- Layered bedding: sheets, duvet/quilt, coverlet/throw, pillows.
- Two bedside tables or balanced alternatives.
- Bedside lamps, sconces, or pendants.
- Large rug under bed.
- Curtains/sheers/blackout/Roman shade.
- Wall art, mirror, paneling, wallpaper, limewash, or intentional blank wall.
- Optional bench, stool, dresser, wardrobe, reading chair, or full-length mirror if space allows.

Optional styling layers:

- Vintage chair or chest.
- Ceramic lamp.
- Personal books.
- Picture light.
- Grasscloth, linen wallcovering, fluted wood, plaster, or paneling.

Lighting strategy:

- Warm, low, layered light.
- Bedside reading light plus soft ambient and optional art/headboard accent.
- Avoid harsh cool ceiling light and obvious LED-strip outlines.

Material/detail language:

- Linen, cotton percale, sateen, matelasse, quilt, boucle, wool, cashmere, washed cotton, upholstered panel, fluted wood, walnut, travertine, bronze, plaster.
- Designers' words: bed wall, extended headboard, shelter headboard, tailored upholstery, banded bedding, coverlet, euro sham, lumbar, tonal palette, value contrast, dimmable, filtered daylight, stack-back, grounding rug, cocooning.

Common failures:

- Bed floating against blank wall.
- Tiny nightstands or lamps.
- Rug only at foot like a bath mat.
- Bare windows or short curtains.
- All-white bedding with no texture.
- Pillow pyramids.
- Beige-on-beige without value contrast.
- Luxury reduced to gold, marble, mirrors, and chandelier.
- Japandi as empty grey minimalism.
- Hotel as sterile business room.

Concise prompt fragment:

> Design the bedroom around a credible bed wall: scaled headboard, usable bedside tables, warm layered bedside lighting, properly sized rug under the bed, finished window treatments, tactile layered bedding, and restrained art or wall treatment. Make it restful, residential, materially specific, and softly lived-in rather than generic hotel or catalog styling.

### Bathroom

Composition rules:

- Preserve fixed plumbing and architecture first.
- Treat the vanity wall as the main composition: vanity, countertop, basin, mirror, sconces, backsplash, hardware.
- Distinguish wet and dry zones clearly.
- Use stone/tile with believable scale, seams, grout, and terminations.
- Keep toilet secondary unless the source photo forces it.

Must-consider objects:

- Existing toilet, shower/tub, drains, windows, doors, ceiling plane, visible built-ins.
- Vanity cabinet, countertop, basin, tapware.
- Mirror or medicine cabinet.
- Sconces/integrated mirror lighting.
- Shower glass/screen, clips/channels/hinges.
- Tile/stone/plaster wall and floor finish.
- Towel rail/hooks, towels, bath mat.
- Edited tray, vessel, soap, candle, branch/plant, stool/bench if space allows.

Optional styling layers:

- Floating vanity.
- Furniture-style vanity.
- Slab backsplash.
- Shower niche/bench.
- Under-vanity or niche glow.
- Humidity-tolerant plant.
- Artwork outside splash zone.

Lighting strategy:

- Vanity task lighting at face height, not ceiling-only light.
- Ambient ceiling/cove light.
- Wet-rated shower light if shower is visible.
- Warm soft light, controlled highlights, plausible mirror reflection.

Material/detail language:

- Honed marble, travertine, limestone, Taj Mahal quartzite, stone-look porcelain, zellige, large-format tile, mosaic shower floor, brushed nickel, satin brass, unlacquered brass, brushed bronze, white oak, walnut, teak, reeded/fluted wood, low-iron glass, microcement.
- Designers' words: vanity wall, floating vanity, slab backsplash, curbless shower, wet room, dry zone, linear drain, integrated medicine cabinet, flanking sconces, warm dimming, mitered edge, grout joint.

Common failures:

- "Spa-like" with no material specificity.
- Moving drains, toilets, shower, tub, window, or door without permission.
- Adding a freestanding tub where no footprint exists.
- Double vanity without wall/plumbing logic.
- Every surface covered in loud marble.
- Tiny mirror above large vanity.
- Sconces floating or blocked by mirror.
- Shower glass omitted or paper-thin.
- Wet room without drain/slope/glass logic.
- Mirror reflecting impossible duplicate room.

Concise prompt fragment:

> Preserve the existing bathroom layout and fixed fixtures. Upgrade only finishes, vanity/mirror/lighting composition, hardware, glass, towels, and decor unless renovation changes are requested. Resolve the vanity wall as a coherent designer elevation, define wet/dry zones, use believable stone/tile scale and aligned grout/seams, show realistic glass thickness and mirror reflections, and keep styling edited and residential.

## 4. Style Modules

These should replace or augment the current broad visual style options. Each module should be compact enough to compose with room modules.

### Warm Contemporary Gallery

- Intent: contemporary residential rooms with gallery-like clarity, warm materials, and one strong art/focal-wall moment.
- Palette: warm white, chalk, taupe, walnut, tobacco, soft black, muted burgundy or olive accents.
- Materials: plaster, limewash, walnut, travertine, wool, linen, boucle, ceramic, blackened bronze.
- Silhouettes: clean but softened; curved sofa, racetrack table, sculptural chairs, monolithic stone pieces.
- Lighting: picture lights, warm lamps, soft cove/perimeter glow.
- Details: oversized art, negative space, styled books/ceramics, collected object.
- Avoid: cold white gallery, tiny art, generic black-and-white modernism.
- Fragment: `warm contemporary gallery style with plaster walls, walnut, travertine, tactile upholstery, oversized art, sculptural lighting, edited negative space, and collected ceramics`.

### Quiet Luxury Residential

- Intent: expensive through proportion, restraint, material quality, and tailoring.
- Palette: ivory, stone, mushroom, camel, walnut, bronze, soft charcoal.
- Materials: honed stone, oak/walnut, linen, wool, silk/cotton blends, brushed bronze, leather, plaster.
- Silhouettes: tailored upholstery, substantial tables, softened edges, bespoke-looking joinery.
- Lighting: warm layered practicals, discreet architectural light, sconces/picture lights.
- Details: custom millwork, generous drapery, restrained art, subtle patina.
- Avoid: loud logos, gold excess, glossy marble everywhere, bland beige monotony.
- Fragment: `quiet luxury residential style: tailored proportions, warm neutrals, honed stone, walnut, linen, wool, brushed bronze, layered warm lighting, custom-looking joinery, restrained styling`.

### Soft Modern Mediterranean

- Intent: Mediterranean material warmth translated for contemporary homes, not theme decor.
- Palette: warm white, chalk, sand, terracotta, olive, dark wood, aged bronze.
- Materials: limewash, plaster, limestone, terracotta, travertine, dark oak, iron/bronze, linen, woven fiber, handmade ceramic.
- Silhouettes: arches/niches where architecture supports them, chunky wood tables, woven chairs, soft linen upholstery.
- Lighting: lantern-like pendants, warm sconces, filtered daylight.
- Details: handmade ceramics, branches, textured walls, stone thresholds.
- Avoid: blue-and-white seaside cliche, fake villa arches, rustic clutter.
- Fragment: `soft modern Mediterranean style with limewashed plaster, warm stone, dark wood, woven texture, aged bronze, handmade ceramics, filtered daylight, and restrained architectural warmth`.

### Japandi Atelier

- Intent: calm crafted minimalism with warmth, utility, and natural material discipline.
- Palette: warm white, greige, clay, pale oak, walnut, muted green, soft black.
- Materials: oak, ash, walnut, linen, wool, natural fiber, matte plaster, ceramic, paper/fabric shades.
- Silhouettes: low, balanced, visually light, concealed storage, simple craft forms.
- Lighting: filtered daylight, indirect warm light, paper/fabric lamps.
- Details: handmade pottery, sparse branches, concealed storage, negative space.
- Avoid: empty beige box, cold grey minimalism, tiny furniture, shiny metal.
- Fragment: `Japandi atelier style with low balanced furniture, pale oak and walnut, matte plaster, linen, wool, handmade ceramics, concealed storage, soft filtered daylight, and warm sparse styling`.

### Parisian Contemporary

- Intent: classic architectural bones with modern art, sculptural furniture, and collected tension.
- Palette: warm white, cream, black, walnut, aged brass, muted rose/green/blue accents.
- Materials: plaster, molding, parquet/wood, velvet, linen, marble/travertine, aged brass, lacquer.
- Silhouettes: curved upholstery, vintage side pieces, modern table forms, antique mirror/art.
- Lighting: chandelier or sculptural pendant plus lamps/sconces/picture lights.
- Details: wall molding, oversized art, antique mirror, collected objects.
- Avoid: fake Versailles, over-ornamented gold, cafe-theme cliches.
- Fragment: `Parisian contemporary style with classic wall molding, warm plaster, modern sculptural upholstery, vintage accents, aged brass lighting, oversized art, and collected restraint`.

### New Classic Dubai

- Intent: Dubai villa elegance with classic proportion and contemporary restraint.
- Palette: warm white, sand, mushroom, walnut, bronze, ivory, muted green or blue.
- Materials: limestone, travertine, walnut, fluted/reeded wood, tailored upholstery, satin brass/bronze, plaster.
- Silhouettes: symmetrical but softened; upholstered dining chairs, tailored sofas, statement but controlled lighting.
- Lighting: cove/perimeter glow, sculptural chandelier, sconces, sideboard lamps.
- Details: wall panels, bespoke joinery, generous drapery, quiet stone.
- Avoid: mirror walls, cold grey marble, shiny gold trim, palace pastiche.
- Fragment: `New Classic Dubai style with warm neutrals, limestone/travertine, walnut joinery, tailored upholstery, brushed bronze, soft paneling, integrated cove lighting, and calm villa-scale luxury`.

### Organic Modern

- Intent: modern rooms softened by natural forms, texture, and grounded materials.
- Palette: ivory, oatmeal, clay, taupe, olive, warm wood, charcoal.
- Materials: oak, walnut, travertine, plaster, jute, wool, linen, boucle, leather, ceramic.
- Silhouettes: rounded sofas, organic tables, chunky stools, irregular ceramics.
- Lighting: soft diffused daylight, warm lamps, woven/fabric shades.
- Details: branches, handmade vessels, tactile rugs, natural stone.
- Avoid: shapeless beige blobs, too many plants, generic boho styling.
- Fragment: `organic modern style with rounded silhouettes, tactile neutrals, natural wood, travertine, plaster, linen, wool, handmade ceramics, and soft diffused light`.

### Contemporary Hotel Residence

- Intent: hospitality-level polish translated to a home.
- Palette: ivory, mushroom, warm grey, walnut, bronze, charcoal, muted jewel accent.
- Materials: tailored upholstery, walnut, stone, glass, bronze, wallcovering, heavy drapery.
- Silhouettes: generous chairs, integrated bed walls, oval/stone tables, substantial sideboards.
- Lighting: layered dimmable warm light, cove, bedside/sconce, picture light, table lamps.
- Details: impeccable spacing, sideboard lamps, bed-wall systems, plush but edited textiles.
- Avoid: restaurant/lobby scale, sterile business hotel, excessive floral arrangements.
- Fragment: `contemporary hotel-residence style with hospitality polish, residential scale, tailored upholstery, walnut, honed stone, layered warm lighting, full-height drapery, and edited luxury details`.

### Sculptural Minimal

- Intent: minimal rooms where shape, proportion, texture, and light carry the design.
- Palette: warm white, chalk, stone, black, pale oak, taupe.
- Materials: plaster, microcement, oak, honed stone, linen, wool, brushed metal.
- Silhouettes: monolithic tables, low sofas, simple beds, strong chair profiles, clean storage.
- Lighting: indirect light, one sculptural fixture, soft daylight.
- Details: few objects, excellent spacing, one art or material focal point.
- Avoid: empty cold room, tiny furniture, lack of texture, decorative clutter.
- Fragment: `sculptural minimal style with generous negative space, monolithic forms, warm plaster, honed stone, pale wood, tactile textiles, one sculptural light, and precise proportions`.

### Textured Neutral

- Intent: neutral interiors with depth from value contrast and surface texture.
- Palette: ivory, oatmeal, taupe, mushroom, camel, chocolate, soft black.
- Materials: boucle, linen, wool, sisal, oak, walnut, travertine, plaster, leather, aged metal.
- Silhouettes: soft upholstery, wood casegoods, stone tables, woven rugs.
- Lighting: warm lamps, filtered daylight, picture lights.
- Details: layered textiles, rug pile, curtain folds, ceramic/stone objects.
- Avoid: one-note beige, no contrast, synthetic smoothness.
- Fragment: `textured neutral style with layered ivory, taupe, camel and walnut tones, boucle, linen, wool, travertine, plaster, warm lamps, and visible textile/material depth`.

### Collected Eclectic

- Intent: curated mix of periods, provenance, art, and personal objects while staying refined.
- Palette: controlled base with two or three richer accents.
- Materials: vintage wood, patterned rug, linen, velvet, ceramic, brass/bronze, framed art.
- Silhouettes: mix contemporary anchor seating/table with vintage side pieces and distinctive chairs.
- Lighting: lamps and sconces with character, picture lights, warm glow.
- Details: books, framed art, ceramics, antique/vintage accent, meaningful asymmetry.
- Avoid: clutter, random color, boho overload, thrift-store chaos.
- Fragment: `collected eclectic style with a controlled palette, contemporary anchor pieces, vintage accents, layered art, patterned rug, warm lamps, books, ceramics, and refined asymmetry`.

### Refined Coastal

- Intent: light, relaxed, sophisticated coastal without beach-theme props.
- Palette: warm white, sand, driftwood, linen, pale oak, muted blue-grey/green, soft black.
- Materials: linen, cotton, oak, rattan/cane, sisal/jute, limestone, ceramic, brushed nickel/bronze.
- Silhouettes: slipcovered or tailored soft seating, woven chairs, pale wood tables.
- Lighting: filtered daylight, fabric/woven shades, warm lamps.
- Details: breezy curtains, natural fiber rug, ceramics, branches, subtle blue/green accents.
- Avoid: shells, anchors, rope cliches, nautical stripes everywhere.
- Fragment: `refined coastal style with warm whites, linen, pale oak, natural fiber rugs, limestone, woven accents, filtered daylight, soft blue-grey notes, and no nautical theme decor`.

### Modern Arabic Luxury

- Intent: regional warmth, craft, and geometry handled tastefully for contemporary residences.
- Palette: warm white, sand, date brown, walnut, bronze, muted clay, deep green/blue accent.
- Materials: plaster, limestone, travertine, walnut, bronze, carved/reeded wood, woven textiles, ceramic, subtle geometric screens/pattern.
- Silhouettes: contemporary furniture with softened edges, low lounge notes where appropriate, bespoke joinery.
- Lighting: warm lantern/sconce influence, cove lighting, patterned shadow only when subtle.
- Details: geometric craft used as texture, not costume; regional ceramic/textile notes; generous hospitality seating.
- Avoid: orientalist cliches, excessive mashrabiya everywhere, gold overload, palace/fantasy styling.
- Fragment: `modern Arabic luxury style with warm plaster, limestone, walnut, bronze, subtle geometric craft, bespoke joinery, generous hospitality-minded seating, warm layered light, and contemporary restraint`.

## 5. Prompt Assembly Strategy

Preferred implementation path:

- Add `packages/prompts/src/interior-design-language.ts`.
- Export compact functions:
  - `roomDesignLanguage(roomType)`
  - `styleDesignLanguage(styleSlugs)`
  - `globalPhotorealismLanguage()`
  - `sourceRoomPreservationLanguage(roomType)`
  - `finalRenderProductFidelityLanguage()`
  - `productRoleLanguage(roomType)`
- Keep each fragment concise. Target 80-180 words per room/style/global module.
- Compose modules in `packages/ai/src/index.ts`, not inside giant static strings.
- Bump prompt versions when integrated.
- Add snapshot tests for assembled prompt fragments before wiring into image generation.

Recommended composition:

Initial concept text direction:

1. Existing `initialConceptPrompt.system`.
2. `sourceRoomPreservationLanguage(roomType)`.
3. `globalPhotorealismLanguage()`.
4. `roomDesignLanguage(roomType)`.
5. `styleDesignLanguage(styleSlugs/styleNotes)` when structured slugs are available.
6. User brief, inspiration analysis, avoid notes, and measurements.

Initial concept image edit prompt:

1. Model-produced `generationPrompt`.
2. Source-room preservation fragment.
3. Room module fragment.
4. Global photorealism fragment.
5. User inspiration reminder.
6. Avoid labels/text/SKU claims.

Final grounded render prompt:

1. `finalGroundedRenderPrompt.system`.
2. Source room preservation.
3. Approved concept intent.
4. Product-fidelity module.
5. Room module.
6. Global photorealism module.
7. Product summary ordered by priority.

Do not create one huge "make it beautiful" prompt. The system should assemble small, testable taste clauses.

## 6. Product Role Improvements

Current state observed:

- `packages/domain/src/product-matching.ts` already defines room category hints and static room roles.
- Living room roles include sofas, armchairs, coffee tables, side tables, rugs, lighting, wall_art, decor.
- Bedroom roles include beds, side_tables, rugs, lighting, wall_art, decor.
- Dining roles include dining_tables, chairs, rugs, lighting, wall_art, decor.
- Bathroom roles are conservative: mirrors, lighting, decor.
- `composeRoomProductOptions` can build role option pools, and app actions merge AI-detected needs with static fallback roles.

Recommended direction:

- Keep role sets room-specific and layered, not exhaustive.
- Distinguish `anchor`, `supporting`, and `styling` roles.
- Keep hard furniture as anchors, but give lighting/textiles/decor enough priority to make rooms feel designed.
- Do not force every room to include every layer; instead define "must consider" and "include when catalog supports / space allows" roles.

Recommended living roles:

- Anchor seating: sofa/sectional.
- Secondary seating: accent chairs or ottoman/stool where space allows.
- Coffee table.
- Side/end table.
- Rug.
- Lighting: floor/table lamp, sconce, pendant when available.
- Wall art or mirror/focal wall.
- Window/textile layer if catalog supports curtains.
- Cushions/throw/decor.
- Console/media/storage when room needs a wall anchor.

Recommended dining roles:

- Dining table.
- Dining chairs.
- Over-table lighting.
- Sideboard/credenza/bar cabinet when wall space allows.
- Rug only when enough size/low pile is available.
- Wall art or mirror.
- Table styling/decor.
- Curtains/window textile where visible/catalog supports.

Recommended bedroom roles:

- Bed/bed frame.
- Headboard when separately sourced or bed lacks one.
- Bedside tables.
- Bedside lighting.
- Rug.
- Bedding/textile layer when catalog supports it.
- Curtains/window treatment.
- Bench/stool/chair only when space allows.
- Wall art/mirror.
- Decor/book/ceramic styling.

Recommended bathroom roles:

- Mirror/medicine cabinet.
- Vanity lighting/sconces.
- Towels/bath mat.
- Stool/bench if space allows.
- Decor tray/vessel/plant.
- Do not source hard plumbing, toilets, tubs, shower fixtures, or vanities unless the catalog explicitly supports them and the user flow is renovation-safe.

Implementation note:

- Add role metadata such as `importance: "anchor" | "supporting" | "styling"` and `includeWhen?: "always" | "space_allows" | "catalog_supports" | "brief_mentions"`.
- Use role priority to order final render product images and summaries.
- Avoid using category alone as role identity; two products in the same category may serve different design roles.

## 7. Fidelity Improvements

Current final render behavior:

- `generateFinalGroundedRender` passes original room, optional concept image, and only the first 8 selected product images.
- Product summary includes category, name, retailer, role label, price, dimensions, and selection reason.
- Prompt says product references should correspond by room role, silhouette, color family, and material where possible.
- The app currently fetches `selectedProducts.slice(0, 8)` for render images, so image priority depends on selected row order.

Risks:

- Eight product images may be too limiting for layered rooms, especially living/dining rooms where sofa, chairs, coffee table, rug, lighting, art, side tables, and decor all matter.
- If image order is not anchor-first, the model may preserve decorative items while drifting on the sofa/table/bed.
- "Correspond by room role, silhouette, color family, and material where possible" is good but not strict enough for anchor products.
- Product summaries do not explicitly name distinctive visual features unless `visualMatchReason` happens to include them.

Recommendations:

- Prioritize product images by role importance: anchor products first, then supporting, then styling.
- For each product, generate a compact fidelity line:
  - `Product 1 anchor sofa: preserve silhouette, rounded arms, low back, cream boucle texture, short dark legs.`
  - If distinctive features are unknown, say `preserve visible silhouette, color family, material family, and proportions from the reference image`.
- Add final render prompt language:
  - Product images are visual evidence, not inspiration.
  - Do not substitute selected products with similar invented alternatives.
  - Adapt room design around anchor products; do not restyle products to fit the room.
  - Product 1-N ordering indicates fidelity priority.
  - Anchor items must remain clearly recognizable.
  - Secondary/styling items should remain recognizable where visible, but architecture and anchor items outrank decor.
  - If exact SKU reproduction is unreliable, produce a representative render without inventing brand-specific details or promising exactness.
- Consider raising image limit if the model/API supports more inputs reliably. If not, keep 8 but ensure the 8 are the most visually important: sofa/bed/table first, then chairs, rug, coffee/side tables, lighting, art/mirror, decor.
- Keep the shopping list/product cards as the source of truth. The render is a best-effort visualization.

Concise product-fidelity fragment:

> Treat selected product images as commerce-critical visual references, not mood-board inspiration. Product order indicates priority. Preserve anchor products most strictly: silhouette, color family, material, proportions, and visible distinctive features. Do not substitute, recolor, merge, or restyle selected products into nicer invented alternatives. Adapt the room around the products. If exact SKU reproduction is not reliable, create a representative room render and do not imply exact product accuracy.

## 8. Evaluation Harness

Do not rely only on unit tests. Prompt quality needs manual visual evaluation.

Recommended lightweight eval:

- Add `docs/Design/evals/` or `packages/prompts/evals/`.
- Create 8-12 fixed test scenarios across room types/styles.
- For each scenario, save:
  - room type
  - style slug(s)
  - brief text
  - avoid notes
  - measurement notes if relevant
  - selected products or product-role fixtures where relevant
  - assembled prompt output
  - OpenAI `revised_prompt` where available
  - generated image path when manually run
  - scorecard

Suggested scenarios:

1. Living room, Warm Contemporary Gallery, awkward existing windows, needs conversational seating.
2. Living room, Quiet Luxury Residential, TV present, must not make TV the only focal point.
3. Dining room, New Classic Dubai, formal villa dining, sideboard and chandelier required.
4. Dining room, Japandi Atelier, small apartment dining, rug/no-rug decision.
5. Bedroom, Contemporary Hotel Residence, primary bedroom with bed wall and curtains.
6. Bedroom, Soft Modern Mediterranean, warm restful room with layered bedding.
7. Bathroom, Quiet Luxury Residential, preserve existing shower/toilet/window layout.
8. Bathroom, Organic Modern, upgrade vanity/mirror/lighting without moving plumbing.
9. Final render, living room with selected sofa/chairs/rug/coffee table/lighting/art.
10. Final render, bedroom with selected bed/nightstands/lamps/rug/bedding.
11. Final render, dining room with selected table/chairs/pendant/sideboard.
12. Adversarial final render with missing decor images but strong anchor products.

Manual score rubric, 1-5:

- Photorealism.
- Interior design quality.
- Style specificity.
- Product fidelity.
- Architecture preservation.
- Lighting/material detail.
- Non-generic feel.

Score meanings:

- 1: fails the criterion; visibly unusable.
- 2: weak; noticeable drift or generic output.
- 3: acceptable baseline; not embarrassing but not Ritzy quality.
- 4: strong; clearly designed and mostly faithful.
- 5: excellent; editorial, specific, plausible, and commercially safe.

Minimum release gate suggestion:

- Concept generation average 4.0+ across photorealism, design quality, style specificity, architecture preservation, and non-generic feel.
- Final render average 4.0+ with no anchor product below 4 for fidelity.
- Any score of 1 in architecture preservation, product fidelity, or photorealism blocks release.

## 9. Implementation Plan

Implement only after this doc is approved.

### PR A: Design-Language Prompt Modules

- Add `packages/prompts/src/interior-design-language.ts`.
- Add room modules, style modules, global photorealism, source preservation, and product fidelity fragments.
- Export from `packages/prompts/src/index.ts`.
- Add tests/snapshots for each room/style/global function and a few assembled examples.
- No image-generation behavior changes yet.

### PR B: Initial Concept Integration

- Compose room/style/global modules into `generateInitialConcept`.
- Include selected style language from richer style slugs.
- Keep user brief and source-room preservation as top priority.
- Bump `initialConceptPrompt.version`.
- Add tests/snapshots for prompt assembly.

### PR C: Final Grounded Render Integration

- Compose global photorealism, room module, and product-fidelity language into `generateFinalGroundedRender`.
- Add anchor-first product summary language.
- Bump `finalGroundedRenderPrompt.version`.
- Preserve the no-exact-SKU-promise rule.

### PR D: Product-Role Coverage

- Extend product role specs with `importance` and inclusion guidance.
- Add richer role definitions for lighting, textiles, art/mirrors, sideboards/consoles, decor, and bathroom-safe layers.
- Prioritize product image ordering for final render by role importance.
- Add tests for role order and no-overforcing behavior.

### PR E: Evaluation Fixtures

- Add lightweight eval fixture docs or script.
- Save assembled prompt output and manual scorecards.
- Include guidance for storing `revised_prompt` and generated image paths.
- Keep it developer-operated; do not block production on automated visual scoring yet.

## 10. Guardrails

- Keep prompts powerful but not bloated.
- Do not add generic style fluff.
- Do not overfit Ritzy to one aesthetic.
- Preserve the user's brief, source room, and fixed architecture above taste modules.
- Preserve selected shopping items above design idealization.
- Never promise exact SKU reproduction unless the system can technically guarantee it.
- Do not force every product role into every room.
- Make missing catalog coverage explicit instead of inventing layers.
- Make Ritzy outputs feel designed, sourced, and photographable.

## 11. Source Appendix

Use these as the research trail for review and for future prompt-module changes. They are not source copy; they informed the synthesis above.

Living room:

- [Architectural Digest: living room design ideas](https://www.architecturaldigest.com/story/living-room-design-ideas)
- [Architectural Digest: rug sizes](https://www.architecturaldigest.com/story/rug-sizes-how-to-figure-out-the-best-area-rug-for-your-space)
- [Architectural Digest: cocktail table decor](https://www.architecturaldigest.com/gallery/cocktail-table-decor-ideas-designers)
- [Homes & Gardens: principles of interior design](https://www.homesandgardens.com/interior-design/the-principles-of-interior-design)
- [Homes & Gardens: layering in interior design](https://www.homesandgardens.com/interior-design/layering-in-interior-design)
- [Livingetc: layering in interior design](https://www.livingetc.com/advice/layering-in-interior-design)
- [Livingetc: dated living room layouts](https://www.livingetc.com/advice/dated-living-room-layouts-2026)
- [Houzz: furniture arrangement rules](https://www.houzz.com/magazine/how-to-get-your-furniture-arrangement-right-stsetivw-vs~18262852)

Dining room:

- [Architectural Digest: modern dining room ideas](https://www.architecturaldigest.com/gallery/modern-dining-room-ideas-straight-out-of-entertaining-dreams)
- [Architectural Digest: dining room ideas](https://www.architecturaldigest.com/gallery/dining-room-ideas-from-statement-wallcoverings-to-nontraditional-tables)
- [Dimensions.com: dining room clearances](https://www.dimensions.com/element/dining-room-clearances)
- [Ballard Designs: dining chandelier sizing](https://www.ballarddesigns.com/howtodecorate/2011/07/selecting-the-right-size-chandelier/)
- [Homes & Gardens: dining room lighting formula](https://www.homesandgardens.com/interior-design/designers-say-this-is-the-perfect-formula-for-lighting-a-dining-room)
- [Living Cozy: dining room rug size](https://www.livingcozy.com/blog/dining-room-rug-size)
- [Jo & Co: Dubai villa interior trends](https://www.joandco.ae/blog/villa-interior-design-dubai.html)
- [24 West Studio: Dubai villa design trends](https://24weststudio.com/villa-interior-design-trends-in-dubai/)

Bedroom:

- [Architectural Digest: how to decorate bedrooms](https://www.architecturaldigest.com/story/how-to-decorate-bedrooms)
- [Homes & Gardens: traditional bedroom ideas](https://www.homesandgardens.com/ideas/traditional-bedroom-ideas)
- [Ideal Home: bedroom rug rules](https://www.idealhome.co.uk/all-rooms/bedroom/bedroom-rug-rules)
- [Ideal Home: Japandi bedroom](https://www.idealhome.co.uk/all-rooms/bedroom/room-recipe-japandi-bedroom)
- [Inside Out Contracts: hotel headboards](https://insideoutcontracts.com/blog/hotel-headboards-design-ideas-wall-mounted-options-and-lighted-styles)
- [IKEA Business: hotel room lighting guidance](https://www.ikea.com/us/en/ikea-business/how-to/how-to-design-a-hotel-room-for-day-and-night-in-5-easy-steps-pub7ad47980/)
- [Livingetc: lightbulb and lighting temperature guide](https://www.livingetc.com/advice/a-guide-to-understanding-lightbulbs)

Bathroom:

- [NKBA: 2026 Bath Trends Report](https://nkba.org/press/nkba-kbis-releases-annual-2026-bath-trends-report/)
- [Houzz: 2025 Bathroom Trends Study PDF](https://st.hzcdn.com/static/econ/2025_US_Houzz_Bathroom_Trends_Study_.pdf)
- [Houzz: bathroom trends shaping remodels](https://www.houzz.com/magazine/5-big-picture-bathroom-trends-shaping-remodels-in-2025-stsetivw-vs~183189788)
- [Architectural Digest: bathroom archive](https://www.architecturaldigest.com/ad-it-yourself/bathroom)
- [Veranda: 2026 bathroom trends](https://www.veranda.com/home-decorators/design-trends/a70158354/2026-bathroom-design-trends/)
- [Homes & Gardens: bathroom tile trends](https://www.homesandgardens.com/bathrooms/bathroom-tile-trends-2026)
- [Lumens: vanity lighting guide](https://the-edit.lumens.com/the-guides/bathroom-vanity-lighting-buyers-guide/)
- [Morsale: luxury bathroom lighting guide](https://morsale.com/blogs/buying-guides/luxury-bathroom-lighting-designers-guide)

Photorealistic interior / archviz:

- [Chaos: architectural rendering basics for interiors](https://www.chaos.com/blog/architectural-rendering-basics-interiors)
- [Chaos: lighting renderings for photorealism](https://www.chaos.com/blog/tips-for-lighting-renderings-to-boost-photorealism)
- [Chaos docs: V-Ray interior render settings](https://docs.chaos.com/display/VMAX/Interior%2BRender%2BSettings)
- [Blender manual: cameras](https://docs.blender.org/manual/en/4.1/render/cameras.html)
- [Blender manual: Principled BSDF](https://docs.blender.org/manual/en/4.4/render/shader_nodes/shader/principled.html)
- [Architextures: PBR settings](https://architextures.org/page/pbr-settings)
- [Curved Axis: photorealistic architectural renders](https://www.curvedaxis.com/news/11-tips-for-photorealistic-architectural-renders)
- [Austin LaRue: interior photography focal length](https://www.austinlaruephotography.com/architecturalphotographyblog/how-wide-is-too-wide-choosing-the-right-focal-length-for-interior-design-photography)

Product-grounded render fidelity:

- [OpenAI: image generation guide](https://platform.openai.com/docs/guides/image-generation)
- [OpenAI: Images API reference](https://platform.openai.com/docs/api-reference/images)
- [OpenAI Cookbook: image evals for generation and editing](https://cookbook.openai.com/examples/multimodal/image_evals)
- [Google Gemini: image generation prompting tips](https://blog.google/products-and-platforms/products/gemini/image-generation-prompting-tips/)
- [Adobe Firefly: structure image reference](https://developer.adobe.com/firefly-services/docs/firefly-api/guides/concepts/structure-image-reference/)
- [Adobe Firefly: reference images for styling](https://helpx.adobe.com/firefly/generate-images-with-text-to-image/customize-generated-images/reference-images-for-styling.html)
- [Google Merchant Center: product image link rules](https://support.google.com/merchants/answer/6324350)
- [Google Merchant Center: AI-generated content rules](https://support.google.com/merchants/answer/14743464)
- [Amazon: product photography guidance](https://sell.amazon.com/blog/product-photos)
- [Baymard: product thumbnail consistency](https://baymard.com/blog/consistent-experience-with-product-thumbnails)
- [Shopify: product photography](https://help.shopify.com/en/manual/products/product-media/product-photography)
