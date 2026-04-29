# F-008 Verification: Concept Critique And Iteration Loop

## Feature

`F-008 Concept Critique And Iteration Loop`

## Scope

Implemented critique capture, concept selection, and revised concept generation.

Boundaries touched:

- `apps/web`
- `packages/ai`
- `packages/prompts`
- `packages/db`
- `packages/ui`

## Implementation Summary

- Added concept selection action:
  - selected concept is marked `selected`
  - sibling concepts are marked `rejected`
- Added critique form to each generated concept card.
- Stored critique history in `concept_critiques`.
- Added versioned revision prompt:
  - key: `concept.revision_from_critique`
  - version: `2026-04-29.1`
- Added OpenAI revision helper:
  - uses the original room photo, previous concept, saved brief, measurements, answered clarifying questions, and designer critique
  - generates a child concept via `parent_concept_id`
  - uploads revised render to private `generated-renders`
  - logs revision AI job metadata

## Verification Commands

Passed:

```bash
pnpm check
```

## Result

Passed.

## Deferrals

- Product sourcing starts in F-009/F-010 catalog work.
- Human stakeholder quality review of generated image aesthetics remains a live use validation step once the hosted Supabase schema and test room images are connected.
