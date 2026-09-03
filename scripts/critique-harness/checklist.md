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

7. **product_consistency** — for a room with a shopping list: every ANCHOR on
   it belongs to the approved design. Judged per product against the concept
   render and the spec role it was selected for: the category must match the
   role (a floor lamp for a floor-lamp role, never a chandelier; an armchair
   for a lounge-chair role, never a swing or rocking chair) and the visual
   similarity to the corresponding object in the render must be at or above the
   committed threshold: similarity at or above 0.6 (the whole render is shown
   and the judge names which object it compared against; the spec carries no
   regions, so there is no crop).

   RESTATED 2026-09-03, with slice S3b, on Ayo's decision recorded in
   `plans/2026-09-01_product-pass-implementation.md` criterion 8. This check
   used to require every SELECTED product to pass, and S3 measured five ways
   that the bar is not reachable: the judge is itself a model, two judgements
   of the same pair differ by up to 0.20 on ambiguous pieces, and a
   four-retailer catalogue makes most objects in a generated render ambiguous.
   Tightening the app's bar converted wrong products into empty lists, which
   this check also failed. The answer was to change what the pipeline does
   rather than what the gate says: the room's hero pieces are now chosen from
   live stock BEFORE the render and the render is generated from their
   photographs, so they match by construction. That is the claim this check
   now tests, and it is a stronger one, because a failure means the image
   model dropped a reference it was told to keep.

   Non-anchor selected products are still judged and their pass rate is
   reported in the notes, but they do not decide the verdict. They are matched
   to the design rather than built into it, and the honest promise for them is
   the one the app already makes: a product is presented as chosen only when
   the design check passed it, and anything else is an open role with its
   options showing.

   PASS: the list carries at least one anchor and every anchor was judged and
   passes. FAIL: any anchor fails or could not be judged (no usable image), or
   the list carries no anchor at all (a run that anchored nothing is a
   regression, not a vacuous pass).
   NOT_APPLICABLE only when the concept has no shopping list yet.

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
