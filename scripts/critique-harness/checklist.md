# Critique harness v1 — checklist and thresholds

The harness judges pipeline outputs against this checklist. These are the
committed thresholds the acceptance criteria reference (plan
`plans/2026-09-01_product-pass-implementation.md`, criteria 6-8, 10). Dev loops
run on the cheapest adequate vision model; gate evidence runs on the production
model (`--model`).

## Checks

1. **spatial_plausibility** — furniture placement is physically possible and
   livable: no blocked doors or circulation, no floating or interpenetrating
   objects, seating faces the declared or credible focal point.
   PASS: no hard violation. FAIL: any blocked opening, impossible placement, or
   focal-defying anchor (e.g. sofa under and facing away from the TV wall).

2. **brief_adherence** — the output honors the brief's explicit asks: style
   words, colour notes, functional requirements, avoid notes.
   PASS: every explicit ask visible or plausibly honored, no avoided element
   present as a dominant surface. FAIL: a missed explicit ask or a present
   avoided element.

3. **revision_delta** — for a revision: every mustChange item visibly applied;
   nothing outside the change plan drifted (palette, key furniture, layout,
   architecture). Architecture drift is always FAIL.
   PASS: all asked changes applied AND no unintended change beyond minor
   styling noise. NOT_APPLICABLE when the room has no revision pair.

4. **size_correctness** — object scale is plausible against the room's
   measurements (when provided) and internal proportions; no dollhouse or
   oversized anchor pieces.
   PASS: no object visibly violating plausible scale. Measurements provided by
   the user are authoritative; sizes read from the image are directional.

5. **view_coverage** — across the concept's view set, every key element of the
   design spec appears in at least one view, and the primary focal element
   appears in at least one.
   PASS: no key spec element invisible in all views. NOT_APPLICABLE when the
   room has a single view and no spec.

6. **palette_register** — the palette and materiality were DERIVED from the
   brief, colour notes, and inspiration, not defaulted to the beige-brown
   attractor. Not an anti-beige rule: a warm-neutral brief passes with a
   warm-neutral room when the register reads as chosen (stated dominants,
   accent, carrying materials).
   PASS: the register is traceable to the brief/inspiration, or (silent brief)
   is a deliberate, internally consistent named register. FAIL: generic
   beige-brown despite a cool/dark/saturated/bold brief, or an incoherent
   default register on a silent brief.

7. **product_consistency** — for a room with a shopping list: every SELECTED
   product belongs to the approved design. Judged per product against the
   concept render and the spec role it was selected for: the category must
   match the role (a floor lamp for a floor-lamp role, never a chandelier; an
   armchair for a lounge-chair role, never a swing or rocking chair) and the
   visual similarity to the corresponding object in the render must be at or
   above the committed threshold: similarity at or above 0.6 (the whole render
   is shown and the judge names which object it compared against; the spec
   carries no regions, so there is no crop). Roles the list honestly reports
   as missing are not failures; a wrong product is.
   PASS: every selected product was judged and passes. FAIL: any selected
   product fails, or could not be judged (no usable image).
   NOT_APPLICABLE when the concept has no shopping list yet.

## Room matrix

Five rooms, spanning the register space so the pipeline is proven off the beige
attractor (`rooms/manifest.json`):

- Bolaji's Al Furjan living/dining (combined zones, sliding doors) — warm
  neutral control.
- Cincinnati master bedroom — restful tonal register.
- Stress 1: small dense apartment living room — cool register brief.
- Stress 2: room with structural columns / asymmetric openings — dark
  saturated brief.
- Stress 3: glare-heavy floor-to-ceiling glass room — bold colour brief.

A manifest entry without a `roomId` is reported as SKIPPED (pending creation),
never silently dropped.

## Gate bar

- Criterion 6 (revision): 5 of 5 rooms pass revision_delta.
- Criterion 10 (views): the TV-lounge spec's view set passes view_coverage.
- Palette register: every non-control room passes palette_register on the
  production model.
- Criterion 8 (sourcing fidelity, Gate 1 condition): all five rooms pass
  product_consistency on the production model; the Phase 0 chandelier-for-
  floor-lamp and swing-chair failures are rejected by the sourcing contracts
  (pinned in packages/domain spec-sourcing tests).
