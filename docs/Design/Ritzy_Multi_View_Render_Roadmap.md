# Ritzy Multi-View Render Roadmap

Date: 2026-05-20

Status: roadmap for review. This document does not change runtime behavior.

## Why This Exists

Ritzy should not try to prove an entire room through one overloaded image. A single hero render is emotionally powerful, but it is a weak container for every selected SKU, every lighting layer, every material detail, and every design decision. Professional interior and architectural visualization workflows usually communicate a design through a set of coordinated views: an establishing view, supporting angles, and detail shots that clarify materials, atmosphere, scale, and the parts of the room the client cares about.

This roadmap turns that pattern into a Ritzy product direction:

- one grand reveal image for the whole room
- two to four consistent supporting views
- product-grounded vignettes that focus on fewer selected items at a time
- a presentation sequence that feels like an interior designer's client deck, not a generic AI image result

The goal is not "more renders." The goal is higher trust, stronger product fidelity, and a more premium reveal.

## Research-Informed Principles

The direction is based on a few repeatable patterns from interior design and architectural visualization practice:

- Interior presentations commonly combine mood/material information, furniture selections, floor plans, 3D renderings, lighting, budget, and sign-off material. Ritzy can compress this into a digital reveal, but the underlying logic is still a layered presentation rather than one isolated image.
- Architectural visualization uses different camera roles: wide establishing views for spatial comprehension, medium views for design intent, and detail views for material/furniture proof.
- Interior camera discipline matters. Room views often need a controlled wide interior lens, human eye-level camera height, corrected verticals, believable lighting, and stable perspective. Detail views can use tighter focal lengths to make materials and objects feel more real.
- Vignettes are a premium way to show high-value details that may disappear in a wide room shot: lamp glow, rug pile, chair fabric, table styling, art wall, bedside composition, vanity materials, and joinery.
- A structured rendering workflow keeps the scene stable first, then renders multiple outputs from that stable design state. Ritzy should mimic that by treating the first hero render as the visual anchor for follow-up views.

## Product Direction

### The Client Experience

After the user selects products and taps generate, Ritzy should eventually produce a small presentation set:

1. **Hero Room Reveal**
   - Wide, emotionally persuasive view of the whole room.
   - Uses the original room photo as the architectural anchor.
   - Uses the selected concept image as the design anchor when available.
   - Prioritizes anchor products: sofa/bed/table, rug, coffee or dining table, key chairs, primary light, major art.

2. **Primary Design Angle**
   - A secondary room angle or slightly closer crop that explains the main design move.
   - Example: seating zone from a more human perspective, dining table with sideboard, bedroom bed wall, bathroom vanity wall.
   - Should feel consistent with the hero render, not like a new design.

3. **Material and Styling Vignette**
   - Tighter view focused on tactile realism.
   - Example: rug plus coffee table styling, bedside table and lamp, dining tabletop and chair upholstery, vanity stone and mirror/sconce.
   - Uses fewer product references, improving fidelity.

4. **Functional Detail View**
   - Optional, depending on room type and selected products.
   - Example: reading corner, media wall, art wall, sideboard, console, lighting moment, storage wall.

The shopping list remains the factual source of truth. The render set is a visual design presentation, not a legal guarantee that every SKU is reproduced pixel-perfectly.

## Why This Helps Product Fidelity

The current final render path passes selected product images into one generation call, with a practical limit in code of eight product references. That limit is not a design law; it is a guard against overloading the image model. When too many references compete inside one prompt, the model may:

- ignore smaller products like lamps, art, cushions, side tables, and accessories
- substitute a nicer invented item for a selected product
- preserve the room but lose product identity
- preserve a product but distort the room
- collapse into generic catalog composition

Multi-view rendering solves this by narrowing each view's job.

Example:

- Hero view references sofa, rug, coffee table, armchair, primary art, primary lamp.
- Seating vignette references armchair, side table, floor lamp, cushion, rug.
- Coffee table vignette references coffee table, rug, decor, sofa texture.
- Media/art wall vignette references console, art, lamp, mirror, wall treatment.

Each generation has fewer visual obligations, so the model has a better chance of respecting silhouettes, materials, colors, and proportions.

## Consistency Strategy

The risk is that each generated view becomes a different room. Ritzy should not generate independent random images. The system needs a chained and constrained approach.

### Step 1: Generate The Hero

Inputs:

- original room photo
- approved concept image if available
- selected anchor products
- room-specific design-language module
- selected style-language module
- global photorealism module

Output:

- `final_render_hero`
- revised prompt
- render job metadata
- visual consistency summary

The visual consistency summary should be generated by text model after or before the hero, and should capture:

- camera perspective
- palette
- dominant materials
- lighting mood
- key furniture placements
- wall/floor/ceiling treatments
- product roles visible in the hero
- what must remain consistent in follow-up views

### Step 2: Generate Planned View Briefs

Before generating more images, create a small JSON plan:

```json
{
  "views": [
    {
      "type": "hero",
      "purpose": "whole-room reveal",
      "camera": "wide room view, corrected verticals",
      "productRoles": ["anchor seating", "rug", "coffee table", "primary art", "primary lamp"]
    },
    {
      "type": "vignette_seating",
      "purpose": "show seating material, side table, lamp, and rug texture",
      "camera": "closer human-eye view angled across the seating corner",
      "productRoles": ["accent chair", "side table", "floor lamp", "rug", "cushions"]
    }
  ]
}
```

This plan lets the product decide which views are worth generating and prevents arbitrary duplicate angles.

### Step 3: Generate Supporting Views From The Hero

Each supporting view should use:

- original room photo
- hero render as the visual continuity reference
- selected subset of product images for that view
- view brief
- consistency summary

Prompt intent:

> Use the hero render as the design source of truth. Create a consistent supporting view of the same room, same palette, same materials, same lighting mood, same furniture family, and same selected products for this view. Do not redesign the room.

This should reduce drift while still allowing the image model to focus on detail.

## View Types By Room

### Living Room

Default set:

- hero seating reveal
- seating/detail angle
- coffee table/rug/material vignette
- media/art/console wall if relevant

Product priority:

- sofa or sectional
- accent chairs
- rug
- coffee table
- side tables
- floor/table lamps
- art/mirror/console
- cushions/decor

Detail opportunities:

- lamp glow against wall finish
- rug pile and coffee table styling
- cushion fabric and sofa upholstery
- art scale above console
- curtain fullness and daylight

### Dining Room

Default set:

- hero dining reveal
- table and chair angle
- sideboard/wall/lighting vignette
- tabletop material and styling detail

Product priority:

- dining table
- dining chairs
- over-table pendant/chandelier
- sideboard or console
- rug if selected and properly scaled
- art/mirror/wall treatment
- table styling

Detail opportunities:

- chair fabric/leather/cane
- pendant height over table
- sideboard lamps or wall sconces
- tabletop finish and restrained centerpiece

### Bedroom

Default set:

- hero bed-wall reveal
- bedside/lighting vignette
- bedding/rug/material detail
- dressing/console/reading corner if relevant

Product priority:

- bed/headboard
- bedside tables
- bedside lamps or sconces
- rug
- bedding/textiles
- curtains
- art/mirror/bench

Detail opportunities:

- layered bedding
- lamp warmth
- headboard texture
- rug under bed
- curtain stack and soft daylight

### Bathroom

Default set:

- hero vanity or wet-zone reveal
- vanity/mirror/sconce detail
- shower/bath material detail if relevant
- storage/towel/styling vignette

Product priority:

- vanity
- mirror
- sconces/pendants
- stone/tile material
- storage
- towel/decor
- bath/shower fittings where catalog-supported

Detail opportunities:

- stone veining
- tile scale and grout
- glass thickness and reflection
- metal finish consistency
- towel softness and realistic styling

## Data Model Direction

The existing `render_jobs` and `room_assets` model can probably support this incrementally, but future implementation should avoid ambiguity.

Recommended metadata additions, either inside `render_jobs.input_summary` first or later as schema columns:

- `renderSetId`
- `viewType`
- `viewPurpose`
- `sourceHeroRenderJobId`
- `sourceHeroAssetId`
- `selectionKey`
- `productSubsetIds`
- `viewIndex`
- `consistencySummary`

Recommended asset types:

- `final_render_hero`
- `final_render_vignette`

If schema changes are postponed, use existing `asset_type = final_render` and store view metadata in the render job. But long-term, explicit asset/view typing will make presentation ordering much cleaner.

## Prompt Architecture

Do not solve this with one giant prompt.

Add composable prompt helpers in `packages/prompts`, likely beside the proposed interior prompt bible modules:

- `multiViewRenderSystem()`
- `heroRenderViewLanguage(roomType)`
- `supportingViewLanguage(viewType, roomType)`
- `renderConsistencyLanguage()`
- `productSubsetFidelityLanguage()`

The final grounded render prompt should become aware of mode:

- hero mode: whole-room reveal
- supporting mode: same-room detail or secondary angle

Hero prompt should say:

- create the definitive room reveal
- prioritize spatial composition and design emotion
- include anchor products visibly
- maintain source architecture
- do not overstuff every selected product into view

Supporting prompt should say:

- use hero render as source of truth
- do not redesign
- show this one part of the room
- focus on this product subset
- preserve palette, lighting, materials, and styling language

## Product Selection Strategy

The product subset should be deterministic and design-aware.

Hero selection:

1. required anchor role for room
2. largest furniture by visual mass
3. rug/floor anchor
4. primary table
5. primary lighting
6. art/mirror/focal wall
7. one or two styling layers

Vignette selection:

- choose products that actually belong together spatially
- keep each view to roughly three to six product references
- avoid unrelated combinations like dining pendant plus bedroom side table
- include material-critical items in close views

This can start as a pure helper in `packages/domain`:

- `planRenderViewsForRoom({ roomType, selectedItems })`
- returns view specs with ordered product ids and role labels

## Implementation Phases

### PR 1: Documentation And Planning

- Add this roadmap.
- Add or complete the Ritzy Interior Prompt Bible.
- No runtime behavior change.

### PR 2: View Planning Helper

- Add a pure domain helper that turns selected items into planned views.
- Unit test living, dining, bedroom, and bathroom.
- Keep output small and deterministic.

### PR 3: Prompt Modules

- Add multi-view prompt modules in `packages/prompts`.
- Add snapshot-style tests for assembled prompt fragments.
- Do not call the image API in tests.

### PR 4: Hero Render Metadata

- Keep generating only one image, but tag it as hero in render metadata.
- Store consistency summary in `render_jobs.input_summary`.
- Presentation remains visually the same.

### PR 5: Supporting View Generation

- Add optional generation of one supporting vignette after hero.
- Start with living room only or one generic supporting view.
- Show it below the hero on presentation.
- Do not block hero reveal while supporting views finish.

### PR 6: Full Presentation Set

- Generate 2-4 views depending on room type and selected product count.
- Add presentation layout for hero plus detail views.
- Add graceful loading states per view.
- Keep shopping list locked until checkout as currently planned.

## UX Direction

Presentation page should feel like:

1. Grand reveal at top.
2. Estimate elegantly visible.
3. Detail views below, each with a quiet label:
   - "Seating detail"
   - "Material palette"
   - "Lighting moment"
   - "Dining detail"
4. Then single CTA:
   - "Generate shopping list"

Avoid:

- showing loading boxes for all views at once before the hero is ready
- making users wait for every vignette before seeing value
- cluttering the reveal with technical labels
- making the page feel like an image gallery detached from the shopping list

Best flow:

- Hero appears first.
- Supporting views can continue loading below.
- User can still proceed to shopping-list unlock once hero is ready.

## Open Questions

- Should multi-view generation be part of the AED 500 unlock, or should at least one supporting view be pre-paywall?
- Should all users get one hero plus one detail, while paid users get the full presentation set?
- Should vignettes use the original room image, the hero image, or both as inputs?
- How many extra renders are acceptable from a cost and wait-time perspective?
- Should users be able to regenerate a single view without regenerating the whole set?

## Recommendation

Do not build the full multi-view system immediately.

First improve the single hero render and prompt language. Then add the internal view planner and metadata. Then ship one supporting view as a test.

The best first production version is:

- one hero render
- one automatically generated detail vignette
- both consistent through hero-as-reference prompting
- supporting view does not block the hero reveal

If that produces noticeably better trust and premium feel, expand to the full presentation set.

## References For Future Research

- Cedreo interior presentation board overview: https://cedreo.com/blog/interior-design-presentation-board/
- Maxon architectural rendering camera/perspective guidance: https://www.maxon.net/ja/article/architectural-rendering-techniques
- Cylind architectural rendering process overview: https://www.cylind.com/articles/architectural-rendering-process
- Autodesk cinematography in architectural visualization handout: https://static.au-uw2-prd.autodesk.com/Class_Handout_AS323037_Stephen_Gabriel.pdf
