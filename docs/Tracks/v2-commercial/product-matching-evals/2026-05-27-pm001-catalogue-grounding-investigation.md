# PM-001 Catalogue-Grounding Investigation

Runtime impact: none. This is a read-only/domain-only investigation artifact. It does not run Product Matching, change prompts/runtime/image-generation behavior, invoke app actions, or write shopping-list/catalog rows.

## Scope

| Field | Value |
| --- | --- |
| Ticket | `PM-001` |
| Owner | Product Matching Agent |
| Branch | `codex/product-match-catalogue-grounding-investigation` |
| Route | 2026-05-27 morning catalogue-grounding priority after PR #212 and PR #213/#215 coordination updates |
| Allowed scope | Read-only/domain-only inspection of concept generation, Product Matching selected-products output, catalogue candidate metadata, image evidence/preflight path, and shopping-list/product-sourcing path |
| Runtime gate | Product Matching execution and catalogue-grounded concept implementation remain blocked pending a new explicit Sam/Chief boundary |

## Files Inspected

- `docs/Tracks/v2-commercial/process/active-agent-control-board.md`
- `docs/Tracks/v2-commercial/process/2026-05-27-chief-architect-handover.md`
- `apps/web/app/actions.ts`
- `packages/ai/src/index.ts`
- `packages/prompts/src/index.ts`
- `packages/prompts/src/interior-design-language.ts`
- `packages/domain/src/product-matching.ts`
- `packages/domain/src/product-matching-confidence.ts`
- `packages/domain/src/product-matching-evidence.ts`
- `packages/ingestion/src/types.ts`
- `supabase/migrations/20260429114000_initial_schema.sql`
- `supabase/migrations/20260429162000_product_enrichment_provenance.sql`
- `supabase/migrations/20260520120000_shopping_list_item_role_metadata.sql`

## Current Failure Mode

The initial concept image is generated before catalogue-backed product selection exists.

`generateInitialConceptAction` calls `generateInitialConcept` with the room photo, inspiration images, brief fields, clarifying answers, measurements, and design-language guidance. It does not query catalogue products, Product Matching selected products, product image evidence, or shopping-list candidates before image generation.

`generateConceptRevision` has the same structural gap: revision uses the previous concept and design context, not a catalogue-selected product plan.

Product Matching starts later. `selectConceptAction` routes to product matching, and `groundProductsAction` then queries catalogue candidates, builds role-scoped product candidates, calls `sourceProductsFromConcept`, and writes the shopping-list path when approved. That means Product Matching recommendations are downstream of a generic concept image rather than the concept image being composed from selected catalogue products.

## Gating Points

| Area | Current behavior | Grounding gap |
| --- | --- | --- |
| Concept autogeneration | `saveDesignBriefAction` and `saveClarifyingQuestionAction` can redirect to `/concepts?autogenerate=1`. | Autogeneration can start before catalogue product planning. |
| Initial image generation | `generateInitialConceptAction` calls `generateInitialConcept`. | No selected product summaries or product image references are passed into the image path. |
| Revision generation | `generateConceptRevision` can create another concept image. | Revisions remain concept-context driven, not catalogue-plan driven. |
| Product Matching | `groundProductsAction` builds candidate pools and calls `sourceProductsFromConcept`. | This runs after concept selection and therefore cannot constrain the original concept image. |
| Shopping-list path | Selected products are written later to shopping-list tables when that path is used. | Writes are not an acceptable grounding mechanism for the first safe boundary; the next boundary should prove catalogue grounding before any write path. |

## Catalogue Metadata State

Existing catalogue/product data can support a catalogue-grounded plan:

- product name, retailer, price/sale price, availability, category, normalized category, canonical URL, and primary image URL;
- color, material, style tags, color tags, material tags, and enrichment timestamps;
- product dimensions and product image records;
- Product Matching role confidence, evidence completeness, dimension fit, freshness, warning, and stop-rule surfaces.

Known gaps:

- no explicit product `shape` field exists;
- silhouette/shape is inferred from product name, category, tags, and limited role tokens;
- product descriptions exist in ingestion types but are not currently part of the `ProductMatchCandidate` schema used by Product Matching;
- product image records and diameter/shape-specific dimensional signals are not used by Product Matching;
- `PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT = 0`, so candidate product images are disabled in the current AI sourcing request path.

## Proposed Next Exact Boundary

Any implementation must be separately approved. Recommended boundary:

| Field | Recommendation |
| --- | --- |
| Scope | Narrow local/dev code/runtime/prompt spike to generate the current investor-demo concept from a catalogue-selected product plan before image generation. |
| Project allowlist | Current investor-demo project only; Sam/Chief must name the exact project ID before execution. |
| Room allowlist | Current investor-demo room only; Sam/Chief must name the exact room ID before execution. |
| User allowlist | Current investor-demo user/email only; Sam/Chief must name the exact user ID and email before execution. |
| Environment | Local/dev only. No Vercel preview deployment and no production environment. |
| App path or harness path | Prefer a read-only/local harness path first. App actions require separate explicit approval. |
| Read boundary | Existing project, room, design brief, generated concept metadata, catalogue products, product dimensions, product images, Product Matching candidate metadata, and `ai_jobs` evidence needed for local validation. |
| Write boundary | No shopping-list writes, no catalog writes, no live writes, no DB/schema/generated type changes. If evidence persistence is needed, approve only a local/dev `ai_jobs` evidence row and a committed docs note. |
| Required behavior | Build or read a selected catalogue-product plan for required anchor roles before image generation; pass selected product summaries and approved product image references into the initial concept image path; block or clearly label failure when required selected products do not satisfy user-selected colour, shape/silhouette, style, and description. |
| Stop rules | Stop if any required anchor lacks an acceptable catalogue-backed candidate, selected product images are unsafe/unavailable, user-selected colour/style/shape/description materially conflicts with selected products, or evidence omits selected products, candidate counts, role status, confidence, warning/blocker counts, dimension fit, evidence completeness, image preflight, and freshness. |
| Rollback | Keep Product Matching default-off outside the approved local/dev boundary, do not reuse failed output for customer-facing decisions, do not create shopping-list/catalog rows, record blockers in evidence, and request Chief/Sam routing for the next narrow docs/domain/local-dev follow-up. |
| Evidence artifacts | Commit only a concise note under `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/`; do not commit raw output, secrets, sensitive screenshots, or unapproved contact sheets. |
| Owner | Product Matching Agent owns implementation/evidence; Chief/Sam reviews before any customer-facing reuse. |
| Expiration | One execution pass or 24 hours, whichever comes first. |

## Non-Goals

- No Product Matching execution under this investigation PR.
- No controlled preview.
- No app actions.
- No draft shopping-list create/refresh writes.
- No catalogue writes or live writes.
- No runtime allowlist expansion.
- No DB/schema/generated type changes.
- No UI/payment/checkout changes.
- No production flags or deploys.
- No prompt/runtime/image-generation behavior changes in this PR.
- No broad scoring rewrites or unrelated quality changes.
- No Catalog-First runtime coupling.

## Recommended Decision

Ask Sam/Chief to approve or edit the proposed local/dev catalogue-grounded concept spike. Until that exact boundary is approved, Product Matching can support narrative and analysis only; it should not be presented as live catalogue-grounded concept generation.
