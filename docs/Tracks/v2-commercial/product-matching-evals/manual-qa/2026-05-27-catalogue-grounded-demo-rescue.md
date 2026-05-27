# 2026-05-27 Catalogue-Grounded Demo Rescue

Status: local/dev validation passed for the investor-demo rescue flow.

## Scope

- Local server: `http://localhost:3001`
- Project: `b91598f1-1c48-4e4d-9257-73d52ec6b71e`
- Room: `11c3449b-62d6-4db5-8e0d-51d9235b4f92`
- User: `87c551bf-8288-49df-99c4-a58b530f32ce`
- Email: `sam.olatoye@gmail.com`
- Concept: `3d8e6f32-5f21-4c77-817f-046e056ca7a7`
- Concept generation job: `e9626596-59d0-45f9-b87b-8d091352e91b`
- Product sourcing job: `143f964b-3e25-42c5-88d8-83a640ed7118`
- Shopping list: `78a99b5b-e5bc-4c60-b57c-c0d28b3f5b63`

## Founder Override Boundary

Sam confirmed founder override in-thread on 2026-05-27 after PR #219 was rejected for missing a visible PM-001 boundary, instructing the Chief Architect to update the document or confirm founder override. This document records that exact approval boundary.

- Approved scope: local/dev investor-demo rescue from room/photo/brief input to catalogue-grounded concept render to matched shopping recommendations/links, with high-taste output and no internal diagnostics leaking to users.
- Environment: local/dev only, `http://localhost:3001`.
- App path: existing Ritzy Studio project/room flow through concepts, Product Matching, and Shopping List.
- Read boundary: existing local/dev room, concept, catalogue product, product image, and job-summary data needed for the project/room/user above.
- Write boundary: local/dev concept/job/shopping-list rows required to validate the project/room/user above.
- Evidence path: this file.
- Expiration: PR #219 review/merge decision; any later execution requires a fresh Sam/Chief boundary.
- Stop rules: no production deploys, production flags, live catalog writes/ingestion, DB/schema/generated type changes, payment/checkout changes, controlled-preview expansion, runtime allowlist expansion, floor-plan work, Catalog-First coupling, or unrelated quality work.

## Provider

- Local env has `OPENAI_API_KEY` set.
- Local env does not have `RITZY_IMAGE_PROVIDER`, `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GOOGLE_API_KEY`, or `GEMINI_IMAGE_MODEL`.
- The validated concept render used `openai` / `gpt-image-2`.

## What Changed

- Concept generation no longer blocks on weak fuzzy style/material evidence when there are valid role-fit catalogue products with usable reference images.
- Catalogue anchor retrieval now uses role-scoped product windows instead of one global latest-product slice.
- Role candidate selection now diversifies candidates by name signature, retailer, price band, and overlapping visual signals so repeated near-clones do not dominate the pool.
- Product matching now injects the concept's catalogue anchor product IDs into the downstream candidate universe and preserves them in each role's option set.
- Final preselection prefers catalogue anchors first, then theme-aligned candidates for non-anchor roles.
- User-facing concept and product-matching messages no longer expose internal catalogue diagnostics.
- The concept Generate CTA is hidden while generation is pending.

## Concept Anchors

| Role | Product | Retailer | Colour / Material | Price |
| --- | --- | --- | --- | --- |
| Anchor seating | Victor 2 Seater Sofa - Beige | Chattels & More | Beige / eucalyptus wood frame | AED 8,699 |
| Secondary seating | Thinktank Swivel Chair in Grey Polyester | Chattels & More | Grey / polyester | AED 2,200 |
| Coffee table | Pletora Coffee Table - Cement Grey / Dark Oak | Danube Home | Grey and dark oak / wood | AED 339 |
| Generous rug | Greg Rug - Abstract Style - Grey-Gold | Danube Home | Grey and gold / polypropylene | AED 400 |

## Validated Shopping Recommendations

The generated shopping list selected the exact four concept anchors above, plus theme-aligned supporting pieces:

- Recap Nightstand Beige, solid and veneered oak, as the side/end table.
- Modern Minimalist Arched Metal LED Floor Lamp Gold, as the lighting layer.
- Souq DESIGNS Wooden Wall Panel, solid wood, as the wall-art layer.
- Suhour Planter Small Antique Gold, as edited decor.
- Full Length Mirror with luxury gold frame, as the mirror layer.
- Jo TV Base Structure in gold / travertino eco stone, as the media unit layer.

Estimated total: AED 20,319.

## UI Evidence

- Concept diagnostics from older failure URLs are sanitized to a user-safe catalogue retry message.
- During concept auto-generation, the Generate CTA is not visible while the job is pending.
- Product Matching completed and redirected to `/shopping-list`.
- Shopping List shows `9 of 9 categories chosen` and `9 pieces selected`.
- Local screenshot captured at `/tmp/ritzy-shopping-list-validated-current.png`.

## Caveats

- Gemini was requested for faster local iteration but cannot be used in this environment until a Gemini key/provider env var is provided.
- The current validated concept was generated before the entry-price anchor fallback was added; the downstream matching contract still preserved those exact anchors.
- The final render from the selected shopping-list pieces was not run in this validation pass.
