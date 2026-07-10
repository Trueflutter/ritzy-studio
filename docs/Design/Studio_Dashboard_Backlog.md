# Studio Dashboard Backlog

Date: 2026-05-21

Status: captured during prompt V2 manual testing. Do not mix into the prompt PR B/C/D batch unless explicitly scoped later.

## Project Cards Need Real Room Imagery

Current issue:

- The studio/project dashboard shows blank beige project-card image areas.
- This makes existing projects feel empty and unfinished, even when rooms already have uploaded photos or generated renders.

Desired direction:

- Project cards should preview available room imagery.
- Prefer the strongest available visual per project, for example:
  1. latest final render if available
  2. selected concept image
  3. uploaded room photo
  4. refined placeholder only if no room image exists
- If a project has multiple rooms, consider a quiet image stack/grid or use the most recently active room as the main preview.

## Continue Existing Project Or Start New Work

Current issue:

- Returning users need clearer choices from the studio dashboard.
- They should be able to continue an existing project or start new work within the same project.

Desired direction:

- Each project card should make "continue" obvious.
- Project detail should support adding a new room/design flow inside the existing project.
- The dashboard should keep "Begin a project" for net-new projects, but project cards should help users resume or expand current projects.

## Profile Mode Switching

Current issue:

- Users may need to switch between homeowner and designer modes after onboarding.

Desired direction:

- Add a settings/profile area where a user can switch or manage intended mode:
  - homeowner
  - designer
  - both
- This should be handled carefully with entitlements:
  - switching profile mode should not accidentally grant paid access
  - designer subscription state remains separate from intended mode
  - homeowner room unlocks remain room-specific

## Suggested Future PR Shape

PR 1: Dashboard project-card previews.

PR 2: Project detail/new-room continuation flow.

PR 3: Settings/profile mode switcher with entitlement-safe behavior.

Do not bundle this with prompt work.

## Prompt V2 Manual Test UX Findings

Captured during local testing on 2026-05-21 with prompt V2 flags enabled.

Prompt quality signal:

- The new concept/render prompt direction is visually strong and should continue.
- The output felt gorgeous enough to proceed with the prompt batch, subject to keeping production flags off until explicitly enabled.

Flow and UX issues surfaced:

1. Product sourcing should auto-start.
   - When the user proceeds from the concept screen into sourcing, sourcing should already be running.
   - The sourcing screen should not show a confusing "Start sourcing" CTA if the user already initiated the flow.
   - The sourcing state should be a clear in-progress screen.

2. Sourcing screen copy needs a small edit.
   - Replace: "Matching catalog products to your concept — prices, dimensions, and retailer links follow."
   - With: "Matching catalog products to your concept. The prices, dimensions, and retailer links will follow afterwards."

3. Sourcing needs time expectation.
   - Add expectation copy in the same spirit as render generation.
   - Example: "Sourcing usually takes about 3-5 minutes."

4. Shopping-list card selection should not reorder cards.
   - Current behavior: selecting a different item moves it to the first card position.
   - This is confusing because it looks like the click did not select the clicked card.
   - Desired behavior: keep cards in place and move the selected state/checkmark/button state to the clicked card.

5. Generate shopping list CTA should wait until final render is ready.
   - During final render generation, the page should not show "Generate shopping list" as the primary CTA.
   - The CTA should appear after the final image fully renders.
   - Before the final render completes, the user should see render progress only.
   - After the render completes, the user should be able to either generate the shopping list or go back/swap selected items.

6. Shopping list should include lighting when visible in the design.
   - The tested design included lamps/lights, but the shopping list did not include them.
   - Lighting is an important layer and should be represented in sourcing/product roles when present in the concept.
   - This likely belongs in the product-role/sourcing follow-up, not just prompt wording.

7. Shopping list must preserve anchor product color and material families.
   - The tested concept used a green sofa and dark charcoal/grey armchairs, but sourcing selected beige/brown seating.
   - The final render then followed the wrong selected catalog products, producing a room that lost the approved concept's seating palette.
   - Anchor categories such as sofa, armchairs, beds, dining chairs, rugs, and major lighting need stricter color/material matching before default selection.
   - If no close color/material match exists, the UI should either surface that mismatch clearly or avoid silently selecting a visually wrong anchor item.

## Future V2 Inspiration Template Library

Idea:

- Many users will struggle to find and upload good inspiration.
- Build a curated Ritzy inspiration/template library that users can select from.

Desired direction:

- Provide selectable inspiration assets/templates by room type and style direction.
- Templates should act as high-quality starting points for taste, palette, materiality, lighting, and composition.
- This can become a V2 differentiator: users do not need to know how to search for good references before Ritzy can produce a strong direction.

Potential future scope:

- Curated image/style library.
- Room-type filtering.
- Style-direction filtering.
- "Start from this look" flow during brief/inspiration.
- Use selected templates as controlled style references in prompt assembly.
