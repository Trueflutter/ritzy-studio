# 03 Build Brief

## Build Objective

Build the Ritzy Studio MVP as a doc-governed, slice-based application. The first working product should support concept-first room redesign, designer critique, automated product grounding from UAE retailer catalogs, product substitution, final grounded render generation, and shopping-list output.

## Operating Model

This project uses a strict doc-first execution model. Implementation must follow:

1. `docs/Tracks/mvp/02_Feature_List.json`
2. `docs/Tracks/mvp/process/progress.md`
3. `docs/Tracks/mvp/08_Chief_Architect_Handoff.md`
4. feature-specific specs or verification docs
5. actual codebase

If docs conflict, the higher source wins. The locked design source of truth is `docs/Vision/05_Brand_and_Design_System.md`.

## Initial Technical Direction

The MVP should use a simple web architecture that can support background AI and catalog ingestion jobs:

- Next.js app
- TypeScript
- Supabase Postgres
- pgvector
- object storage for room, concept, and product images
- background jobs for ingestion and generation
- OpenAI APIs for room analysis, product enrichment, product matching support, and image generation/editing

Final stack details are locked in `docs/Tracks/mvp/00_Technical_Decision_Pack.md`.

## First Build Priorities

1. Establish repo and application scaffold.
2. Implement locked design tokens and app shell.
3. Create project and room upload workflow.
4. Capture design brief and clarifying questions.
5. Generate initial concept directions.
6. Create product catalog schema and ingestion adapter framework.
7. Implement first retailer ingestion adapters.
8. Build product matching and substitution UX.
9. Generate final grounded render.
10. Produce shopping list and client presentation view.

## Product Data Stance

Designer-facing manual product CSV upload is not part of the product workflow.

Admin/debug import utilities are allowed only if they accelerate testing or recovery. They must not be presented as the value proposition or primary product path.

## Verification Expectations

Each slice must include:

- targeted tests or documented manual verification
- lint/type/build checks as appropriate
- design compliance check if UI changes
- product-data truthfulness check if catalog or shopping list changes
- prompt contract check if AI behavior changes
- progress log update
- feature list status update only when the slice is genuinely complete

## Definition Of Done For MVP

The MVP is ready when a designer can:

1. create a project
2. upload a room photo
3. describe a desired direction
4. generate and iterate concepts
5. ground an approved concept in real retailer products
6. substitute products by budget/style/dimensions
7. generate a final grounded render
8. review a shopping list with real URLs and prices
9. create a client-ready presentation

No known blocking defects may remain.
