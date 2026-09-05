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

   THE FLOOR, set 2026-09-04 after three full measurements (18 of 19 each time):
   across the rooms at least FIVE IN SIX anchors are kept, and no room keeps
   fewer than half its own anchors, nor zero. The exact count is printed on
   every run, because eighteen falling to sixteen is the signal even while the
   gate passes.

   Five in six, not three in four: three in four of nineteen is fifteen, so a
   regression losing three anchors would pass a gate that exists to catch it.
   Sixteen is two pieces below the measurement, which is the judges' own
   disagreement. Half per room, not three of four: the stricter per-room bar
   leaves the room sitting at three of four one flaky judgement from failing
   everything.
   The check used to ask for every anchor on every room, and the shortfall that
   wording measured is not the pipeline: two judges scoring the same render and
   the same product disagree by up to 0.20, and across nineteen anchors they
   disagree on about three, so unanimity measures their agreement rather than
   the work. A dropped reference is still a defect; it is one the floor counts.

   DECISION, 2026-09-04 (Ayo). The across-rooms rate is KNOWINGLY UNMET on the
   palette-register branch and the number is NOT being lowered. Reviewers should
   not reopen this; the reasoning is recorded here so it does not have to be
   argued again.

   The floor was set against a catalogue read that could only see 975 of 3,233
   rows. Fixing that read is what moved the measurement: 18/19 and 17/18 before,
   then 16/19, 13/19, 13/19 after. Lowering the gate would bank a regression
   that a bug fix caused, and would keep being wrong as the catalogue grows.

   What ships instead is the PER-ROOM floor, which held in all three runs: no
   room below half its anchors, none at zero. That is the half protecting an
   individual user's room from being a disaster. The across-rooms rate is the
   aggregate ambition and it is now its own slice.

   Two things must be settled in that slice before the rate is a gate again.
   First, the measurement's variance was never established: it was set from two
   runs, and rounds 1 and 3 anchored the SAME rug in three of five rooms and
   scored 16 and 13. Second, the two measures of "is this piece in the design"
   disagree. The app's own recorded verified_similarity averages about 0.82 and
   every scored anchor cleared its threshold, while this harness's judge says 13
   of 19. That gap is the product promise stated exactly, because a shopping
   list that claims a piece the render did not draw is a list charging for
   something the picture does not show. Reconciling the two verdicts comes
   before any eligibility tuning, or the pipeline gets tuned against a judge
   nobody has validated.

   PASS: the room meets the floor, every anchor was judged, and the app claimed
   at least one on the list. FAIL: the room misses the floor, an anchor could
   not be judged (no usable image), the concept has anchors but no list, or the
   list claims none of them (a run that stands behind nothing is a regression,
   not a vacuous pass).
   NOT_APPLICABLE only when the concept has no shopping list and no anchors.

8. **final_spatial_plausibility** (S4) — check 1 applied to the FINAL hero
   render the reveal shows (the newest succeeded render job for the concept,
   `output_asset_ids[0]`), rather than to the concept. The notes carry the
   app's own spatial QA outcome (`passed`, `resolved_after_regeneration`,
   `unresolved`, `unreviewed`), its verdict and whether it regenerated, so the
   two judges read side by side. NOT_APPLICABLE when no final render exists.

9. **final_view_coverage** (S4) — across the final render's set (hero plus the
   planned views the reveal shows), every key element of the confirmed spec
   appears in at least one image, and the primary focal element appears in at
   least one; the notes name which image shows the focal element. The
   persisted plan's keys and anchoring are appended to the notes.
   NOT_APPLICABLE when no final render exists or the set has a single view.

10. **final_view_consistency** (S4) — every planned view is the same finished
    room as the final hero: same architecture (walls, openings, ceiling,
    floor), same shared objects (silhouette, colour, material, proportions),
    nothing invented, and, where the plan anchored the view to one of the
    room's photographs, the same camera position. The app's own per-view
    outcomes are appended to the notes. REPORTED this slice, not gating,
    until its variance is known (the rule the palette check followed).
    NOT_APPLICABLE when no final render exists or the set has a single view.
    The judge is shown each anchored view's photograph beside it; it is never
    shown the app's own verdicts (those are joined to the notes in code
    afterwards), so the two judges stay independent. A listed view whose
    image cannot be read FAILS the set checks by name; it is never dropped.

### A set of one is not a set

`view_coverage` (check 5) and `final_view_coverage` are judged only on sets of
two or more images and return NOT_APPLICABLE, never PASS, on a single view.
The spec is extracted from the hero, so "every spec element appears in at
least one view" is true of the hero by construction; the check only carries
meaning across additional views. Until S4 the harness rooms' current concepts
had no views at all (the evidence runners passed a no-op defer), so every
earlier `view_coverage` PASS was judged on the hero alone.

### Judge pairs

`product_consistency` prints, for every anchor, the harness similarity beside
the app's own design-check score for the same concept and product (read from
the sourcing run's recorded verification verdicts, every judged product, kept
or not), and counts the anchors on which the two judges disagree across the
committed 0.6 line. This is the reconciliation the retention slice needs
before anything is tuned against either judge; the S4 evidence record carries
the first pairs.

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
- S4 (criteria 10 and 11): `final_view_coverage` 5 of 5 and
  `final_spatial_plausibility` 5 of 5 on the production model;
  `final_view_consistency` reported, not gating, until its variance is known.
- Criterion 8 (sourcing fidelity, Gate 1 condition): all five rooms pass
  product_consistency on the production model; the Phase 0 chandelier-for-
  floor-lamp and swing-chair failures are rejected by the sourcing contracts
  (pinned in packages/domain spec-sourcing tests).
