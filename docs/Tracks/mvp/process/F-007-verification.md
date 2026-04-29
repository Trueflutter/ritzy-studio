# F-007 Verification: Room Analysis And Initial Concept Generation

## Feature

`F-007 Room Analysis And Initial Concept Generation`

## Scope

Implemented initial concept generation from the saved room photo and design brief.

Boundaries touched:

- `apps/web`
- `packages/ai`
- `packages/prompts`
- `packages/config`
- `packages/db`
- `packages/ui`

## Implementation Summary

- Added protected route:
  - `/projects/[projectId]/rooms/[roomId]/concepts`
- Added concept generation server action:
  - fetches the latest design brief
  - uses the first uploaded room photo as the base image
  - passes answered clarifying questions and measurements into the AI input
  - logs an `ai_jobs` row
  - uploads generated render output to private `generated-renders` storage
  - stores the render as a `concept_render` room asset
  - creates a generated concept record
- Added versioned room analysis and concept-direction prompt:
  - key: `concept.initial_room_analysis`
  - version: `2026-04-29.1`
- Added OpenAI image generation helper:
  - text/vision pass produces structured room analysis and concept direction
  - image-edit pass uses the original room image as the source
  - generated images are not treated as shopping-list truth
- Updated the brief page to link into the concepts stage after a brief exists.
- Set default image model to `gpt-image-2`, matching current official model documentation.

## OpenAI Documentation Checked

Official OpenAI docs checked before implementation:

- `https://developers.openai.com/api/docs/models/gpt-image-2`
- `https://developers.openai.com/api/docs/models/all`
- `https://platform.openai.com/docs/guides/image-generation?lang=javascript`
- `https://platform.openai.com/docs/api-reference/images/createEdit?lang=node.js`

Relevant confirmed capabilities:

- `gpt-image-2` is the current state-of-the-art image generation model.
- Image generation and image editing are supported through `v1/images/generations` and `v1/images/edits`.
- GPT Image models can use input images for editing and preservation guidance.
- Composition and exact placement are still model limitations, so F-007 stores uncertainty and avoids SKU/exact-fit claims.

## Verification Commands

Passed:

```bash
pnpm check
```

OpenAI image-model smoke test:

```bash
pnpm exec tsx -e '...client.images.generate({ model: "gpt-image-2", quality: "low" })...'
```

Result:

```json
{"model":"gpt-image-2","images":1,"hasImage":true}
```

## Result

Passed.

## Deferrals

- Full designer critique loop is deferred to F-008.
- Product-grounded matching remains deferred until the catalog/search slices.
- Exact architecture preservation is not guaranteed by the model; the UI and job metadata keep the output framed as an initial concept.
