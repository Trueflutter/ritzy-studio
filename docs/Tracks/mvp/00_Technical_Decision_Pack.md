# 00 Technical Decision Pack

## Status

Locked for MVP unless explicitly reopened by the founder.

## Product Architecture Decision

Ritzy Studio uses a concept-first, product-grounded workflow.

1. Generate initial concepts from room image and design brief.
2. Let the designer critique and refine the visual direction.
3. After concept approval, search real UAE retailer products.
4. Let the designer substitute and approve products.
5. Generate final grounded renders from selected products.
6. Produce shopping list truth from retailer product data, not from the image model.

## Non-Negotiable Product Data Decision

Designer-facing manual CSV upload is out of scope.

Manual/admin product import may exist only as a hidden testing or recovery utility. The app must automate product discovery through catalog ingestion, retailer adapters, search providers, or approved feeds.

## Platform Decision

Use a TypeScript web application.

Default stack:

- Next.js App Router
- TypeScript
- Tailwind or CSS variables generated from the locked design tokens
- Supabase Postgres
- Supabase Auth unless single-user mode is explicitly chosen before implementation
- Supabase Storage or S3-compatible storage
- pgvector for product and image embeddings
- background job runner for ingestion and AI jobs
- OpenAI APIs for vision, structured extraction, embeddings, and image generation/editing

## Data Store Decision

Postgres is the system of record.

Product records, room records, generation jobs, shopping lists, and review state must be durable database entities. Generated files and source images belong in object storage and are referenced from Postgres.

## AI Provider Decision

OpenAI is the primary AI provider for MVP.

AI usage surfaces:

- room photo analysis
- clarifying question generation
- initial concept prompt generation
- concept image generation/editing
- product metadata enrichment
- product matching explanation
- final grounded render generation/editing

## Retailer Ingestion Decision

Use a catalog adapter pattern.

Each retailer adapter owns:

- discovery source: sitemap, category page, product page, feed, or search source
- robots/terms notes
- extraction logic
- field confidence mapping
- price freshness timestamp
- product URL canonicalization
- image URL handling
- failure modes

Initial adapters should target technically feasible sources first:

1. Home Centre
2. 2XL Home
3. Chattels & More
4. Homes r Us
5. Pan Home

Defer Marina Home until there is direct permission or another approved data source because its robots.txt disallows crawling.

## Search Decision

Use hybrid search:

- normalized category filters
- keyword search
- price and retailer filters
- color/material/style metadata
- product text embeddings
- product image embeddings when available
- dimension filters when dimensions are verified or estimated

LLMs may enrich metadata but must not invent product facts. Every enriched field requires a source confidence level.

## Spatial Decision

Photo-only room dimensions are unreliable and must not be used as hard fit proof.

MVP requires manual measurement inputs where fit matters:

- at least one wall length
- optional ceiling height
- optional room depth
- optional floor plan
- optional image annotations

The system may provide soft fit warnings, not fit certification.

## Rendering Decision

Generated images are concept or grounded visualizations. They are not product-data truth.

Final shopping lists are generated from selected product records, not from visual interpretation of generated images.

## Design Decision

`docs/Vision/05_Brand_and_Design_System.md` is locked visual truth.

Implementation must use:

- Quiet Gallery direction
- Cormorant Garamond and DM Sans
- Bone/Paper/Ochre palette
- square corners
- 1px hairlines
- no dark mode

## Compliance Decision

Automated ingestion must be light, cached, and respectful. Retailer robots.txt, public terms, and copyright concerns must be documented per adapter.

Approved feeds, affiliate feeds, and trade/B2B relationships are preferred for commercial use.

## Observability Decision

All AI and ingestion jobs must be traceable:

- input references
- model/provider used
- prompt version
- job status
- error message
- cost estimate where available
- created and completed timestamps

## Decisions Explicitly Deferred

- exact hosting provider
- billing/subscription
- client collaboration portal
- mobile LiDAR capture
- procurement/checkout
- full retailer partnership program
- multi-tenant team roles beyond owner/admin if not needed for MVP
