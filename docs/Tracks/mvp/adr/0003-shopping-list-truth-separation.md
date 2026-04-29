# ADR 0003: Shopping List Truth Separation

## Status

Accepted.

## Context

AI-generated room images can be visually compelling but may not exactly reproduce selected products. Product availability, price, dimensions, and URLs must come from reliable product records.

## Decision

Separate visual concept/render truth from shopping-list truth.

- Concept images communicate design direction.
- Final renders communicate a product-informed visualization.
- Shopping lists communicate exact selected product records.

The shopping list must never be inferred from generated image pixels.

## Consequences

Positive:

- Product data remains auditable.
- Designer can trust the shopping list more than the render.
- UI can honestly communicate uncertainty.

Negative:

- Some users may expect the render to be exact.
- The product must repeatedly explain best-effort SKU rendering.

## Guardrails

- Every final render includes product-reference provenance.
- Every shopping-list item links to a product record.
- UI copy avoids exact-SKU claims unless manually verified.
