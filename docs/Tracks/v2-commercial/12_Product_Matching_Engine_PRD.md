# 12 Product Matching Engine PRD

## Purpose

Ritzy's shopping list must feel trustworthy. A client should believe that the suggested sofa, chair, rug, lamp, sideboard, or TV console was chosen because it matches the approved room direction, not because it happened to share a category name.

The catalog is now large enough that product matching must become its own system. More products improve coverage, but they also increase the chance of false positives unless retrieval, ranking, visual arbitration, and failure handling are designed deliberately.

This PRD defines the Product Matching Engine track: a durable engine for turning an approved concept into role-scoped, visually plausible, retailer-backed product options.

## Product Principle

The AI must not search one flat catalog.

The system should first construct high-quality candidate pools per room role, then ask AI to arbitrate between already-plausible options.

The user must never see a confident random list.

## User Trust Requirements

- Anchor products must match the concept's object type, color family, material direction, silhouette, and scale as closely as catalog coverage allows.
- Supporting products may be "closest available," but they must not contradict the concept.
- Missing or weak matches must be honest in internal metadata and, where needed, user-facing copy.
- Required roles must not be silently backfilled from generic ranking after visual sourcing marks them missing.
- Product prices, quantities, and line totals must remain quantity-aware.
- Retailer links and stock claims must remain source-backed.

## Scope

### In Scope

- Role-scoped candidate retrieval.
- Category, stock, price, dimension, and retailer eligibility gates.
- Attribute scoring for color, material, style, shape, texture, and room-role suitability.
- AI visual arbitration over compact candidate pools.
- Confidence/failure metadata for selected products.
- Evaluation scenarios and scorecards.
- Regression tests for ranking behavior.
- Instrumentation for candidate counts, fallback paths, missing roles, and selected match quality.

### Out Of Scope

- Retailer cart auto-population.
- Affiliate tracking changes.
- New retailer ingestion adapters.
- New user-facing styling-layer selection screens.
- Full image-region object detection.
- Database schema migrations unless a later implementation PR explicitly requires them.

## Current Failure Mode

Recent testing exposed a concrete failure:

- Concept sofa was beige.
- Shopping list selected an olive sofa.
- The reason was not a visual decision. The visual sourcing step failed or returned no usable role briefs, then static room-role fallback and text/category ranking selected a product with acceptable category/budget metadata.

This is unacceptable because it makes the system feel random and undermines trust.

## Desired Matching Pipeline

### Stage 1: Concept Role Extraction

Input:

- Approved concept image.
- Concept title and description.
- Room type.
- Room blueprint defaults.
- User brief constraints.

Output:

- Required and supporting product roles.
- Per-role visual brief:
  - object type
  - color family
  - material/fabric
  - silhouette/form
  - style direction
  - quantity
  - priority

Rules:

- Living rooms should normally include sofa, coffee table, rug, lighting, TV/media storage, and appropriate secondary seating unless excluded.
- Dining rooms should normally include dining table, dining chairs, lighting, and sideboard/console where spatially plausible.
- Bedrooms should normally include bed, bedside tables, bedside lighting, rug/textile layer, and storage/decor where relevant.
- Home offices should normally include desk, office chair, task lighting, storage/shelving, and rug/textile layer where relevant.

### Stage 2: Hard Eligibility Gates

Before any ranking:

- Retailer must be active.
- Product must have a canonical URL.
- Product must have a usable image.
- Product must not be known out of stock.
- Product must have a normalized category compatible with the role.
- Product must not exceed hard budget constraints where those exist.
- Product dimensions must be checked against room measurements where available.

### Stage 3: Role-Scoped Candidate Pools

For each role, build a separate pool.

Examples:

- `anchor seating` receives only sofas/sectionals compatible with the sofa role.
- `secondary seating` receives armchairs/lounge chairs.
- `TV media console` receives storage/media-unit products, not generic bookcases unless explicitly compatible.
- `dining chairs` receives dining chairs, not bulky armchairs.

The engine should not send one mixed candidate list for the whole room and ask the AI to figure it out.

### Stage 4: Attribute Ranking

Within each role pool, score candidates using:

- category exactness
- color family match
- material family match
- style tag match
- silhouette/shape keywords
- room tag match
- fit and dimensions
- price and budget fit
- stock freshness
- retailer confidence
- image quality/completeness

The score should be explainable and testable.

### Stage 5: Diversity Without Randomness

Candidate shortlists should avoid showing near-duplicates, but diversity must not override fit.

Good diversity:

- three beige linen sofas with different silhouettes
- two walnut TV consoles with different storage styles

Bad diversity:

- one beige sofa, one olive sofa, one black leather sofa when the concept needs a beige linen sofa

### Stage 6: AI Visual Arbitration

The AI should receive compact role-scoped candidates, for example:

- 8-12 candidates for anchor roles.
- 4-8 candidates for supporting roles.
- Fewer candidates for decor.

AI output must choose, reject, or mark missing per role.

It should not be allowed to invent products or select outside the candidate IDs.

### Stage 7: Confidence And Failure Handling

Each role should produce one of:

- `strong_match`
- `acceptable_match`
- `closest_available`
- `missing_required`
- `missing_supporting`

Required anchors:

- strong or acceptable match: proceed.
- closest available: proceed only if clearly marked internally and not visually contradictory.
- missing required: broaden/retry once, then block or ask for another catalog refresh.

Supporting roles:

- may be omitted if missing.
- must not be backfilled by unrelated products.

## UX Contract

The user does not need to see algorithm detail.

They should see:

- a good shopping list; or
- a calm retry/loading state; or
- a clear message that better catalog matches are needed.

They should not see:

- irrelevant colors/materials presented as confident matches.
- decor objects pretending to be product roles.
- product choices with nonsensical explanations.
- anchor items that contradict the concept.

## Evaluation Harness

Create 10-20 fixed evaluation scenarios:

- living room with beige sofa, walnut media unit, brass lighting
- living room with green velvet sofa and charcoal chairs
- dining room with cream upholstered dining chairs and walnut sideboard
- bedroom with ivory upholstered bed and walnut bedside tables
- home office with wood desk, task chair, shelves, and task lamp

Each scenario should include:

- room type
- concept text
- concept image reference if available
- expected product roles
- target color/material families
- disallowed matches
- acceptable substitutions

Score 1-5:

- category correctness
- color fidelity
- material fidelity
- style fidelity
- silhouette fidelity
- quantity correctness
- price/stock trust
- role coverage
- explanation quality
- overall user trust

## Implementation Sequence

### PR A: PRD And Test Fixtures

- Add this PRD.
- Add eval scenario fixtures and a manual scoring template.
- No runtime changes.

### PR B: Role-Scoped Retrieval API

- Add pure domain helpers that return candidate pools per role.
- Keep current runtime behavior behind a default-off flag if needed.
- Add tests for living, dining, bedroom, and home office role pools.

### PR C: Attribute Scoring V1

- Add explicit color, material, category, and role-fit scoring.
- Add regression tests for known failures:
  - beige sofa concept must not prefer olive sofa when beige candidates exist.
  - dining chairs must not become bulky armchairs.
  - TV console role must not prefer generic shelving when media units exist.

### PR D: Visual Arbitration Contract

- Update AI product sourcing to consume role-scoped shortlists.
- Require per-role status.
- Preserve no-silent-fallback rules.
- Log per-role candidate counts and selected confidence.

### PR E: Runtime Rollout

- Enable role-scoped matching for local/manual QA first.
- Run eval harness.
- Sam visually inspects.
- Only then enable for production.

## Acceptance Criteria

- The shopping list never silently uses static fallback for a required visual role marked missing.
- The engine can explain why each selected item was chosen.
- Anchor item colors/materials are not contradicted when matching alternatives exist.
- Large catalog size improves coverage without reducing relevance.
- Runtime logs show candidate counts, retry paths, missing roles, and selected confidence.
- Evaluation scenarios can be rerun after future catalog or prompt changes.

## Open Questions

- Should weak anchor matches be user-visible as "closest available" or should they always block?
- Should users choose optional styling layers before render generation, or should this remain part of the brief?
- Do we need image embeddings for product photos in v1, or can structured enrichment and AI arbitration carry the first version?
- Should retailer preference influence ranking before or after visual fidelity?
- What minimum stock freshness should be acceptable for production shopping lists?
