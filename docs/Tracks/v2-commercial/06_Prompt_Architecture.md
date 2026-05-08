# 06 Prompt Architecture

## Purpose

Extend MVP prompt architecture for homeowner onboarding, visual style interpretation, paywall-safe shopping previews, and retailer-product grounding.

## New Prompt Surfaces

### Homeowner Preference Interpreter

Input:

- selected visual style cards
- disliked style cards
- color preferences
- budget band
- room type
- free-text notes

Output contract:

- plain-language style summary
- structured style tags
- color palette guidance
- material direction
- avoid list
- confidence/uncertainty notes

Rules:

- Do not use inaccessible design jargon without explanation.
- Do not invent budget or measurements.
- Keep output suitable for concept generation and product search.

### Visual Style Card Generator

Input:

- style taxonomy
- room type
- brand direction

Output contract:

- card title
- plain-language description
- image prompt or approved image reference
- style tags

Rules:

- Generated reference images must not imply retailer SKU availability.
- Cards must be visually distinct enough for non-designers.

### Shopping Preview Summarizer

Input:

- selected product records
- user entitlement state
- retailer campaign state

Output contract:

- preview-safe product summary
- locked/unlocked fields
- upgrade value copy
- missing/stale data warnings

Rules:

- Do not expose raw retailer URLs in locked state.
- Do not promise discounts where no eligible campaign exists.
- Do not invent product facts.

### Discount Explanation Prompt

Input:

- retailer campaign terms
- assigned discount code or auto-link state
- product eligibility

Output contract:

- short user-facing explanation
- terms summary
- expiry note
- exclusions

Rules:

- Use retailer-provided terms only.
- If terms are incomplete, say the discount is eligible but should be confirmed at checkout.

## Existing Prompt Surfaces To Preserve

- room analysis
- clarifying questions
- concept direction
- concept image generation/edit
- critique rewrite
- product search planning
- product metadata enrichment
- product match explanation
- final grounded render

## Homeowner Tone

Homeowner copy should be:

- visual
- concrete
- plain-language
- reassuring without overpromising
- short

## Designer Tone

Designer copy should be:

- precise
- efficient
- editable
- explicit about uncertainty

## Inspection Requirements

Commercial prompts must log:

- user mode
- entitlement state if relevant
- prompt key/version
- input asset IDs
- output schema
- cost estimate where available
