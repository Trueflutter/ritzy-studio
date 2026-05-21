# PR B: Initial Concept Prompt V2 Wiring

Status: implementation note for review.

## Scope

This PR wires the modular interior design language into `generateInitialConcept` only, behind the default-off server flag:

`RITZY_INTERIOR_PROMPT_V2_ENABLED=false`

No final render prompt changes, product-role changes, UI changes, or DB/schema changes are included.

## Default Behavior

When `RITZY_INTERIOR_PROMPT_V2_ENABLED` is unset or `false`, initial concept prompt assembly remains on the existing prompt path:

- `initialConceptPrompt.system` is sent unchanged.
- The image edit prompt uses the existing preservation, photorealism, and no-label language.
- Saved prompt version remains the existing `initialConceptPrompt.version`.
- Saved style slugs may be passed into the AI boundary, but they are not included in the prompt payload while the flag is off.

## Flag-On Behavior

When `RITZY_INTERIOR_PROMPT_V2_ENABLED=true`, initial concept generation adds compact modular language to the text system prompt and image edit prompt:

- `sourceRoomPreservationLanguage(roomType)`
- `globalPhotorealismLanguage()`
- `roomDesignLanguage(roomType)`
- `styleDesignLanguage(styleSlugs)`

The prompt version reported for generated concepts becomes `2026-05-21.1`.

## Style Slug Bridge

The app still stores broad legacy slugs such as `modern`, `contemporary`, `traditional`, `scandinavian`, `industrial`, and `bohemian`.

Before live use, those slugs are bridged inside `styleDesignLanguage()` to richer dormant modules. For example:

- `modern` -> `sculptural-minimal`, `warm-contemporary-gallery`
- `contemporary` -> `warm-contemporary-gallery`, `organic-modern`
- `traditional` -> `parisian-contemporary`, `new-classic-dubai`

Unknown slugs remain ignored and return `null` when no matching style exists.

## Expected Generation Behavior

With the flag on, initial concepts should become more specific about:

- source-room architecture preservation
- villa/townhouse-appropriate residential scale
- room-specific composition quality
- layered lighting
- tactile material detail
- corrected camera/photorealism language
- richer style direction where saved style slugs exist

The prompt should remain compact and should not add product fidelity language yet. Product fidelity is reserved for the final grounded render PR.

## Rollback

Set:

`RITZY_INTERIOR_PROMPT_V2_ENABLED=false`

or unset the variable.

No database rollback is required. No UI rollback is required. No saved user data shape changes are required.

## Verification

Required checks:

- `pnpm --filter @ritzy-studio/prompts test`
- `pnpm --filter @ritzy-studio/prompts typecheck`
- `pnpm --filter @ritzy-studio/ai test`
- `pnpm --filter @ritzy-studio/ai typecheck`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
