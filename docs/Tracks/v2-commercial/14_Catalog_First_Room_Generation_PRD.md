# 14 Catalog-First Room Generation PRD

## Purpose

Ritzy's current concept-to-shopping-list flow is image-first:

1. Generate an inspiration room.
2. Ask the user to approve it.
3. Search the catalog for products that resemble the generated room.

That flow can produce beautiful images, but product matching remains fragile. If the image model invents a green velvet sofa, brass floor lamp, carved sideboard, or unusual dining chair silhouette that the catalog cannot match closely, the shopping list can feel random even when the room image is excellent.

This PRD defines a future catalog-first flow:

1. Understand the user's room, measurements, budget, style, and exclusions.
2. Select real catalog products first.
3. Compose one or more coherent product bundles.
4. Generate room concepts using those selected products as visual anchors.
5. Present the room and shopping list from the same source of truth.

The goal is to make the image and shopping list feel inseparable: the generated room already contains real purchasable products.

## Product Principle

Do not generate a dream room and hope the catalog can catch up.

Generate the room from products Ritzy can actually source.

## Strategic Relationship To Product Matching Engine

This track must not interrupt the current Product Matching Engine work.

The current matching engine track remains necessary because:

- It fixes today's live image-first flow.
- It provides role-scoped retrieval, category compatibility, attribute scoring, visual arbitration, and eval fixtures.
- Those capabilities become the foundation for catalog-first bundle generation.

Catalog-first room generation should reuse the matching engine once it is stable, but it should not force the matching agent to change PR scope.

## User Experience Target

The user should feel:

- "Ritzy designed a beautiful room for me."
- "The furniture list was instantly ready."
- "The products look like they genuinely belong together."
- "I can choose premium or budget without losing the design direction."

The user should not feel:

- "The shopping list was reverse-engineered badly."
- "The products are random category matches."
- "The app found similar items only after the render."
- "The budget version is ugly."

## Proposed Flow

### Step 1: User Provides Room Inputs

Inputs:

- project details
- room type
- room measurements
- uploaded room photos
- floor plan/measurement source where available
- budget range
- style direction
- household constraints
- exclusions, for example "no TV," "no leather," "no glass table"

Room type should be deterministic, not free text.

### Step 2: System Builds Product Role Blueprint

For each room type, define required and supporting roles.

Living room default roles:

- sofa or sectional
- rug
- coffee table
- TV/media console
- lighting
- side/console tables where spatially plausible
- secondary seating where spatially plausible
- art/mirror/wall decor
- plants/decor/textiles as styling layers

Dining room default roles:

- dining table
- dining chairs with quantity
- pendant/chandelier or lighting
- sideboard/console where spatially plausible
- rug where appropriate
- art/mirror/wall decor
- centerpiece/decor

Bedroom default roles:

- bed
- bedside tables
- bedside/task lighting
- rug/textile layer
- dresser/storage where spatially plausible
- mirror/art/wall decor
- soft furnishings

Home office default roles:

- desk
- office/task chair
- task lighting
- storage/shelving
- rug/textile layer where appropriate
- decor/plant/wall art

### Step 3: Build Coherent Product Bundles

The bundle engine selects real products before image generation.

Each bundle must include:

- role coverage
- product IDs
- role labels
- quantities
- dimensions
- retailer names
- product URLs
- image references
- total estimated cost
- confidence metadata
- why each item belongs in the bundle

Bundle selection should optimize for:

- role correctness
- aesthetic harmony
- color/material compatibility
- room fit and clearances
- budget fit
- in-stock freshness
- retailer reliability
- image quality
- not too many retailers where possible

### Step 4: Present Two Directions

Generate two options:

1. Premium direction
2. Budget direction

Both directions must look intentionally designed.

Budget must mean smart, not cheap-looking. The budget direction should retain the same style language with simpler materials, fewer premium finishes, or fewer optional layers.

Each direction should have:

- generated room image
- total estimated furniture cost
- 5-8 visible anchor items in summary
- clear premium/budget label
- no exposed algorithm detail

### Step 5: User Approves A Direction

When the user approves a direction:

- shopping list can be generated immediately from the bundle
- no second matching pass is required
- user can still swap/refresh products later
- final render can be regenerated from the chosen bundle if needed

## Bundle Intelligence Requirements

### Role Coverage

Each room type should include essential items by default unless user exclusions or measurements make them inappropriate.

For example, Dubai living rooms should normally include a TV/media console unless the user explicitly excludes TV.

### Aesthetic Harmony

The engine should score compatibility across:

- color palette
- wood tone
- metal finish
- fabric/material
- silhouette
- formality
- scale
- style family

Example good bundle:

- olive velvet sofa
- walnut coffee table
- brass floor lamp
- warm neutral rug
- black-framed art

Example bad bundle:

- olive velvet sofa
- glossy white TV console
- chrome industrial lamp
- bright blue rug
- farmhouse side table

### Anchor And Supporting Product Rules

Anchor products require higher fidelity:

- sofa
- dining table/chairs
- bed
- rug
- TV/media console
- main lighting

Supporting products may be style-matched rather than exact:

- cushions
- small decor
- plants
- vases
- art
- trays

### Quantity And Price Rules

The bundle engine must multiply quantity-aware roles:

- dining chairs
- accent chairs
- bedside tables
- lamps
- cushions
- stools

The user must never see a single-unit price presented as if it covers a multi-unit role.

### Measurements And Fit

Measurements are not optional for production-safe furniture recommendations.

If measurements are unavailable:

- the system should collect them before sourcing/generation
- the bundle engine should avoid oversized products
- confidence should be lowered

### Retailer Strategy

Bundles should prefer fewer retailers where quality remains strong, because checkout complexity matters.

However, retailer simplicity must not override product fit for anchor items.

Output should support grouping by retailer on the final purchase page.

## Image Generation Contract

The image model receives:

- source room image(s)
- room measurements/constraints
- selected bundle products
- design direction language
- product reference images for anchor items

The prompt must:

- preserve source-room architecture
- place selected anchor products credibly
- preserve product color/material/silhouette for anchor items
- use supporting products as styling guidance
- add designer-level styling detail without inventing contradictory anchors

The image model may add atmosphere, styling, plants, art, and decor only when consistent with the selected bundle and user constraints.

## Product Fidelity Risks

Catalog-first reduces matching risk but does not eliminate image-generation risk.

Known risks:

- image model may alter selected product color
- image model may simplify distinctive silhouettes
- too many product references may reduce fidelity
- supporting decor may be invented or omitted
- room architecture may drift

Mitigation:

- prioritize 4-8 anchor references
- treat decor as style/fill layer
- run post-generation visual QA where possible
- expose product list from bundle, not from image guesses
- keep OpenAI/Gemini provider comparison available for fidelity checks

## Data/Architecture Shape

No database migration should be introduced until the implementation plan is reviewed.

Likely future entities:

- `product_bundles`
- `product_bundle_items`
- `bundle_generation_jobs`

But first implementation should be pure domain logic and test fixtures.

Candidate module boundaries:

- `packages/domain`: bundle role definitions, compatibility scoring, bundle assembly, eval fixtures
- `packages/ai`: image prompt composition from selected bundles
- `apps/web`: feature-flagged flow orchestration and UI only after core logic is proven
- `packages/ingestion`: richer product attributes over time

## Implementation Sequence

### PR A: PRD And Executor Prompt

- Add this PRD.
- Add executor prompt.
- No runtime behavior change.
- No database changes.

### PR B: Bundle Data Model In Domain

- Define pure TypeScript types for room role blueprints, product bundle candidates, bundle items, and bundle scores.
- Add fixtures for living, dining, bedroom, and home office.
- No runtime changes.

### PR C: Bundle Assembly V1

- Build a pure domain helper that assembles premium and budget bundles from product candidates.
- Reuse role-scoped retrieval/scoring helpers from Product Matching Engine where available.
- Add tests for quantity, category correctness, budget split, and role coverage.

### PR D: Aesthetic Compatibility Scoring

- Add compatibility scoring for color, material, wood tone, metal finish, silhouette, and style family.
- Add regression tests for ugly/incoherent bundles.

### PR E: Image Prompt Composition From Bundle

- Add prompt builder that turns a selected product bundle into an image-generation prompt.
- Keep behind tests only.
- No runtime behavior change unless explicitly approved.

### PR F: Local-Only Prototype Flow

- Add a default-off feature flag for catalog-first generation.
- Allow local manual QA only.
- Sam visually inspects premium/budget outputs.

### PR G: Runtime Experiment

- Only after Sam approval.
- Compare:
  - current image-first flow
  - catalog-first premium/budget flow
- Track latency, match trust, product fidelity, and user comprehension.

## Acceptance Criteria

- Premium and budget bundles can be created from the same catalog without random-looking selections.
- Generated concepts use real selected products as anchors.
- Shopping list can be available immediately after concept approval.
- Quantity-aware pricing is correct before render generation.
- The bundle engine can explain each selected item.
- Current image-first matching work is not broken or blocked.

## Open Questions

- Should users see premium/budget before or after the image renders?
- Should both premium and budget images be generated immediately, or should the second be generated on demand to reduce cost?
- What is the maximum number of product references Gemini can follow reliably?
- Do we need a visual QA model before showing the generated concept?
- Should the user be able to swap bundle products before image generation, or only after approval?
- Should premium/budget differ by retailer mix, material quality, or optional styling layers?
