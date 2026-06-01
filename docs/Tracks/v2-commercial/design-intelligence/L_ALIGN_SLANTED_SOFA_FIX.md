# L-Align Slanted Sofa Prompt Fix

Date: 2026-06-01
Branch: `codex/spatial-l-align-sofa-fix`
Scope: prompt/tests/docs only

## Evidence

The post-PR #301 living-room focal-placement guardrail correctly tells the model to place seating opposite or adjacent to the TV/media focal wall and face the focal point. A newer render failure is different: the sofa/sectional faces the media wall, but the primary sofa is canted diagonally off the room grid.

This is an L-align rotation failure, not the prior L1 focal-facing failure.

## Implementation Note

The prompt-layer patch appends alignment clauses to `livingRoomFocalPlacementGuardrail` so the primary sofa remains parallel to the focal wall, square to the rug and room grid, and not diagonally canted for composition. For sectionals or L-shaped sofas, the long run should stay parallel to the focal wall with the chaise or return toward the room interior. The coffee table should also align square to the sofa and focal wall.

This beta-safe patch does not change Product Matching, sofa selection/scoring, image-provider behavior, render runtime, catalog data, schema, generated types, UI, pricing, or deployment settings. If sectionals remain problematic after this prompt fix, silhouette preference should be handled as a separate Product Matching slice.
