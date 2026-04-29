# 01 Founder Intake

## Product

Ritzy Studio is an AI-assisted interior design workspace for a residential interior designer in Dubai.

The designer uploads photos of real residential spaces, describes the desired style and constraints, iterates on generated room concepts, then grounds the selected direction in real purchasable furniture and decor from UAE/Dubai retailers.

## Founder Intent

The product exists to reduce the manual work of moving from client room photos to a beautiful concept and then to a practical product list. The app must not become a generic image generator or a manual product spreadsheet workflow.

## Primary User

The first user is a professional residential interior designer working from a desk. The app is optimized for a single expert user first, then can expand to teams or client collaboration.

## Core Workflow

1. Designer creates a project.
2. Designer uploads photos of an empty or existing client space.
3. Designer enters style, color, budget, constraints, inspiration, and optional measurements.
4. System asks clarifying questions only when they materially improve the design brief.
5. System generates beautiful initial concept images before product matching.
6. Designer critiques and refines the concept direction.
7. Once the designer likes a concept, the system searches online retailer catalogs for the closest available products.
8. Designer requests substitutions such as cheaper armchairs, warmer wood, smaller sofa, different retailer, or different color.
9. Designer selects final products.
10. System generates final grounded renders using selected products as references.
11. System produces a client-ready presentation and shopping list.

## Non-Negotiables

- No designer-facing manual CSV product upload workflow.
- No workflow where the designer manually finds products and feeds links to the app as the primary path.
- Shopping lists must contain only real products from known sources.
- Generated concept images are visual proposals, not proof that exact SKUs were rendered.
- The app must clearly separate concept-image truth from shopping-list truth.
- Photo-only dimensions must not be treated as reliable.
- Designer review remains mandatory before client delivery.

## Retailer Scope

Initial retailer investigation covered:

- Pan Home
- Homes r Us
- Home Centre
- Crate & Barrel UAE
- 2XL Home
- Marina Home
- THE One
- Chattels & More
- CB2 UAE

The MVP should prioritize retailers with technically feasible public product data access and defer blocked or high-risk sources.

## Locked Design Direction

The visual source of truth is `docs/Vision/05_Brand_and_Design_System.md`.

Locked direction: Quiet Gallery. The interface is a premium working design tool, not a landing page, SaaS dashboard, retail site, or consumer AI toy.

## Open Founder Inputs

- Confirm first three retailers for automated ingestion.
- Confirm whether authentication is required in the first build or if a single-user prototype is acceptable.
- Confirm final deliverable format: web presentation, PDF, image board, or share link.
- Provide sample room photos when available.
- Provide real budget bands and common Dubai residential project types.
- Confirm whether outputs are client-facing from day one.
