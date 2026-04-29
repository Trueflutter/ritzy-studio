# ADR 0001: Concept-First Product-Grounded Workflow

## Status

Accepted.

## Context

Ritzy Studio must help an interior designer create beautiful room concepts without requiring her to manually hunt products first. At the same time, the final shopping list must contain real purchasable products from UAE/Dubai retailers.

Starting with product search would constrain ideation too early. Starting with final render claims would overpromise exact SKU rendering.

## Decision

Use a two-stage creative and grounding workflow:

1. Generate and refine visual concepts first.
2. Ground the selected concept in real products second.
3. Generate final renders only after product selection.
4. Treat the shopping list as database truth.

## Consequences

Positive:

- The designer gets immediate creative value.
- The app does not require manual product hunting.
- Product accuracy is preserved in the shopping list.
- The product can be honest about render limitations.

Negative:

- Final render may differ from the initial concept after real products are selected.
- Product matching quality depends on catalog ingestion and enrichment.
- The UI must explain uncertainty clearly.

## Guardrails

- No designer-facing manual CSV upload path.
- No exact SKU rendering guarantee.
- No generated-image-derived shopping facts.
