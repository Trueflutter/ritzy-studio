# PR C: Final Grounded Render Prompt V2 Wiring

Status: implementation note for review.

## Scope

This PR wires the modular interior design language into `generateFinalGroundedRender` only, behind the default-off server flag:

`RITZY_FINAL_RENDER_PROMPT_V2_ENABLED=false`

No product-role selection changes, product-reference ordering changes, UI changes, or DB/schema changes are included.

## Default Behavior

When `RITZY_FINAL_RENDER_PROMPT_V2_ENABLED` is unset or `false`, final grounded render prompt assembly remains on the existing prompt path:

- `finalGroundedRenderPrompt.system` is sent unchanged.
- Existing concept/product summary wording is preserved.
- Saved prompt version remains the existing `finalGroundedRenderPrompt.version`.

## Flag-On Behavior

When `RITZY_FINAL_RENDER_PROMPT_V2_ENABLED=true`, final grounded render generation adds compact modular language:

- `sourceRoomPreservationLanguage(roomType)`
- `roomDesignLanguage(roomType)`
- `globalPhotorealismLanguage()`
- `finalRenderProductFidelityLanguage()`

The prompt version reported for generated final renders becomes `2026-05-21.1`.

## Product Fidelity Wording

Flag-on wording explicitly improves:

- anchor-item priority
- selected product silhouette preservation
- color family preservation
- material preservation
- proportion preservation
- visible distinctive feature preservation
- non-substitution language
- no exact-SKU promise

This PR does not reorder product references. Product-reference ordering belongs to PR D.

## Expected Generation Behavior

With the flag on, final grounded renders should become more faithful to selected product references while still preserving source-room architecture and the approved concept direction. The render should remain a representative client-facing visualization, with real shopping-list product cards as the source of truth.

## Rollback

Set:

`RITZY_FINAL_RENDER_PROMPT_V2_ENABLED=false`

or unset the variable.

No database rollback is required. No UI rollback is required. No saved user data shape changes are required.

## Verification

Required checks:

- `pnpm --filter @ritzy-studio/prompts test`
- `pnpm --filter @ritzy-studio/prompts typecheck`
- `pnpm --filter @ritzy-studio/ai test`
- `pnpm --filter @ritzy-studio/ai typecheck`
- `pnpm --filter @ritzy-studio/config typecheck`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
