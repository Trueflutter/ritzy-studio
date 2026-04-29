# 01 Technical PRD

## Purpose

Build an MVP that lets a residential interior designer transform room photos into refined design concepts, ground those concepts in real UAE retailer products, and produce client-ready renders plus a shopping list.

## Users

### Primary User

Professional interior designer.

### Future Users

- design assistant
- procurement assistant
- client reviewer

These are not required for MVP unless explicitly added to the feature list.

## Core User Journey

1. Sign in.
2. Create a project.
3. Add room details.
4. Upload room photos.
5. Enter design brief.
6. Answer clarifying questions if needed.
7. Generate initial concept directions.
8. Review and critique concepts.
9. Approve one concept direction.
10. Run product grounding.
11. Review matched real products.
12. Request substitutions.
13. Approve final product set.
14. Generate final grounded render.
15. Review client presentation and shopping list.

## Functional Requirements

### Project Management

- Create, list, update, and archive projects.
- Store client/project name, room type, budget, notes, and status.
- Support multiple rooms per project.

### Room Upload

- Upload one or more room photos.
- Store original image and derivative thumbnails.
- Capture room type and optional measurements.
- Display upload status and errors.

### Design Brief

- Capture style, color, budget, constraints, desired mood, room usage, and inspiration notes.
- Ask clarifying questions when required information is missing.
- Preserve the designer's final brief as a structured record.

### Initial Concept Generation

- Analyze room photo and brief.
- Generate multiple concept directions.
- Preserve fixed architecture as much as possible.
- Store generated images and generation metadata.
- Show uncertainty notes.

### Concept Critique

- Let designer choose a concept.
- Let designer request changes in natural language.
- Store critique history.
- Generate revised concepts from critique.

### Product Catalog

- Ingest product data automatically from retailer adapters.
- Store product name, category, retailer, price, dimensions, image, URL, availability, color, material, and confidence.
- Track source and last checked timestamp.
- Support re-ingestion and price refresh.

### Product Matching

- Search products by room type, category, style, color, material, budget, retailer, dimensions, and visual similarity.
- Present candidate products with explanation and confidence prose.
- Never fabricate missing product facts.

### Substitution

- Let designer request alternatives by price, color, material, retailer, size, category, or style.
- Preserve selected products unless explicitly replaced.
- Show price impact and missing-data warnings.

### Final Grounded Render

- Generate client-facing render using selected products and original room as references.
- Store render metadata and selected product references.
- Show caveat that render may not exactly match SKUs.

### Shopping List

- Generate line-item shopping list from selected product records.
- Show retailer, category, product name, price in AED, dimensions, availability, source URL, image, and last checked timestamp.
- Show estimated total.
- Flag missing or stale data.

### Client Presentation

- Present final render, design note, selected products, total cost, and caveats.
- Export format is to be confirmed before implementation.

## Non-Functional Requirements

- UI must comply with the locked design system.
- Job status must be visible for long-running AI and ingestion work.
- App must not block the main UI while jobs run.
- Product data must be timestamped.
- AI prompts must be versioned.
- Errors must be recoverable and visible.
- No secrets committed to the repo.

## Acceptance Criteria

MVP is accepted when a test project can move through the full workflow from room upload to final presentation using at least one automated retailer ingestion source and no designer-facing manual product-link entry.

## Out Of Scope

- checkout
- purchase order management
- exact construction drawings
- guaranteed exact fit without measurements
- guaranteed exact SKU visual rendering
- client comments
- team permissions beyond MVP auth needs
