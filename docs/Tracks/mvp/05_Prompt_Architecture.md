# 05 Prompt Architecture

## Purpose

This document defines the runtime AI prompt surfaces for Ritzy Studio. Prompts must remain versioned, inspectable, and separated by task.

## Prompt Surfaces

### Room Analysis Prompt

Input:

- room photo
- optional measurements
- room type

Output contract:

- detected room type
- visible fixed architecture
- editable zones
- fixed elements to preserve
- lighting notes
- uncertainty notes

Rules:

- Do not infer exact dimensions from photo only.
- Identify uncertainty explicitly.
- Do not suggest products.

### Clarifying Question Prompt

Input:

- design brief draft
- room analysis summary

Output contract:

- zero to five questions
- reason each question matters

Rules:

- Ask only questions that materially affect design generation or product matching.
- Do not interrogate the user for information that can be safely defaulted.

### Concept Direction Prompt

Input:

- room photo
- room analysis
- design brief
- optional inspiration

Output contract:

- concept title
- concept rationale
- generation prompt
- preserve-list
- allowed-change-list
- uncertainty note

Rules:

- Product-specific SKU accuracy is not required in this stage.
- Preserve original architecture as much as possible.
- Avoid implying real product availability.

### Concept Image Generation/Edit Prompt

Input:

- original room image
- concept prompt
- optional mask

Output:

- generated concept image

Rules:

- Keep walls, windows, doors, ceiling, AC vents, sockets, and fixed fixtures stable where visible.
- Treat masks as guidance, not absolute guarantees.
- No retail product claims in the image output.

### Critique Rewrite Prompt

Input:

- selected concept
- designer critique
- previous generation prompt

Output contract:

- revised concept intent
- changed elements
- preserved elements
- new generation prompt

Rules:

- Preserve previous approved qualities unless critique says otherwise.
- Keep critique history auditable.

### Product Search Planning Prompt

Input:

- approved concept
- room type
- brief
- budget
- measurements

Output contract:

- required product categories
- optional product categories
- category-level budget guidance
- style/color/material search terms
- dimension constraints and warnings

Rules:

- Do not invent products.
- Produce search parameters, not shopping-list facts.

### Product Metadata Enrichment Prompt

Input:

- retailer product name
- description
- image
- structured fields

Output contract:

- normalized category
- style tags
- color tags
- material tags
- room tags
- source confidence

Rules:

- Never invent price, stock, URL, dimensions, retailer, or SKU.
- Derived tags must be marked as model-enriched.

### Product Match Explanation Prompt

Input:

- approved concept
- candidate product facts
- room constraints

Output contract:

- short explanation
- verified facts
- assumed facts
- warnings

Rules:

- No percentages.
- Use prose confidence: verified, assumed, estimated.
- Mention missing dimensions or stale price where applicable.

### Final Grounded Render Prompt

Input:

- original room photo
- approved concept
- selected product images
- shopping list facts
- optional mask

Output:

- generated final render

Rules:

- Use selected products as references.
- Preserve architecture as much as possible.
- Do not claim exact SKU rendering.
- Final shopping list remains database truth.

## Prompt Versioning

Every prompt must have:

- `prompt_key`
- `version`
- `purpose`
- `input_schema`
- `output_schema`
- `model`
- `created_at`

Generation jobs must store prompt key and version.

## Inspection Requirements

Admins/developers must be able to inspect:

- input summaries
- prompt version
- output summaries
- errors
- cost estimate where available

Do not store raw secrets or keys in prompt logs.
