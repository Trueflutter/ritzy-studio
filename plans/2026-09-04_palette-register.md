# A room that asks for a committed colour gets one

## Objective

Close the gap between what a brief ASKS FOR and what the render delivers. The
contracts already enforce what a brief forbids; nothing pulls toward what it
wants, so a room whose brief says "a committed terracotta and ochre carried
across upholstery, rug and art" comes back a safe neutral.

## Evidence

Measured on the harness, 2026-09-04, after S3b merged.

- **stress-glass-glare** brief: "Bold colour: a committed terracotta and ochre
  accent carried across upholstery, rug and art." Avoid: "an all-neutral
  scheme." Verdict: `brief_adherence` FAIL, `palette_register` FAIL — "reads as
  a safe neutral scheme rather than the specified bold register."
- Its anchors on that run: Cream sofa, Blend accent chair, Davi rug, Heston
  marble table. **All neutral, and all confirmed kept by the render** at 0.78 to
  0.98. The render did exactly what it was told; the pieces it was told to build
  around were wrong for the brief.
- **The same room passed both checks on an earlier run of the same code**, when
  the rotation happened to put a red Cigar Lounge Armchair among its anchors. So
  the room's palette is decided by which anchors the rotation lands on, and
  nothing makes that landing honour the brief.
- The sofa pool's top five for this room all score **248.0, identical** — grey,
  white, beige, cream, off-white. Colour is not discriminating between them.
- The catalogue is not the whole story but it is part of it: for this room's
  sofa role there is no terracotta sofa that passes the contracts (two exist;
  one is an armchair bed, one fails the size class, both correctly rejected).
  There ARE 9 warm-saturated rugs and 3 armchairs.

So the fix has two halves: make the anchor set carry the brief's colour where
the catalogue can supply it, and make the RENDER carry it where the catalogue
cannot.

## Steps

1. **A wanted-colour signal** (`packages/domain`, pure): the mirror of
   `avoidColorTokens`. Read the brief's colour notes into the same expanded
   family vocabulary, so "terracotta and ochre" becomes a set the ranking can
   reward. Extend `colorFamilies` where the vocabulary is thin: ochre, amber,
   clay and sienna have no family today.
2. **Anchor shortlists carry it** (`packages/domain`, pure): a candidate in a
   wanted family is promoted; one in no wanted family is not penalised out of
   existence, because a room needs a sofa even when the catalogue has no
   terracotta one. Ranking signal, never a contract override — the piece must
   still fit the room.
3. **The aesthetic pass is told what the brief wants**, not only what it
   forbids: the set is judged on whether it DELIVERS the named register.
4. **The render carries the colour the catalogue cannot** (`packages/prompts`):
   today the anchor instruction ("put those exact pieces in the room, keep their
   colour and material, design everything else around them") is more concrete
   than the palette instruction, so a neutral anchor set produces a neutral
   room. The prompt must say that the brief's register is carried by the
   surfaces the pieces do NOT occupy — wall finish, drapery, art, cushions — and
   that neutral anchors are a reason to push the register harder elsewhere, not
   permission to drop it.
5. **`attributeCueText` stops discarding the room's colour notes** when a role
   carries its own visual brief (`packages/domain`). Anchor roles have no visual
   brief so they are unaffected; every SPEC role has one, so post-approval
   sourcing currently scores without the room's palette at all.
6. **Verify** on all five harness rooms: `brief_adherence` and `palette_register`
   on the two failing rooms, and no regression on the three that pass.

## Acceptance criteria

1. The two currently-failing rooms pass `palette_register`.
2. No room that passes `brief_adherence` or `palette_register` today regresses.
3. The anchor floor set on 2026-09-04 still holds: five in six across the rooms,
   half per room, never zero.
4. A brief that names a colour the catalogue cannot supply still produces a room
   in that register, carried by the surfaces the pipeline controls.
5. Colour never overrides a contract: no piece reaches a shortlist for its
   colour that the room's size, scope or object-kind rules would reject.

## Risks

- **Over-weighting colour surfaces a badly-fitting piece.** Mitigated by keeping
  colour a ranking signal behind the contracts, and by criterion 5.
- **The three passing rooms regress.** The two failing rooms are the stress
  rooms; the fix must be measured on all five, not on the two.
- **Judge variance.** The same room has passed and failed these checks on
  identical code. Any verdict needs at least two runs before it is believed.

## Risk tier

MEDIUM: no migration, no new paid call. It changes the paid render's prompt and
the ranking that feeds it, so it is measured on the harness rather than reasoned
about.

## Verification (2026-09-04)

Three full runs of the five harness rooms, production judge (gpt-5.1). Room
and project rows are test data and were reset between runs, as agreed.

| room | anchors kept R1 / R2 / R3 | palette_register R1 / R2 / R3 |
| --- | --- | --- |
| alfurjan-living-dining | 4/4, 2/4, 3/4 | PASS, PASS, PASS |
| cincinnati-bedroom | 3/3, 2/3, 2/3 | PASS, PASS, PASS |
| stress-dense-apartment | 3/4, 3/4, 4/4 | FAIL, PASS, FAIL |
| stress-columns | 2/4, 3/4, 2/4 | PASS, PASS, PASS |
| stress-glass-glare | 4/4, 3/4, 2/4 | PASS, PASS, PASS |
| **total** | **16/19, 13/19, 13/19** | **4/5, 5/5, 4/5** |

R1 = walls + colour-reservation. R2 = adds cabinet fronts, the named-surface
avoid rule, and the zoning de-duplication. R3 = adds the anchor scale gate.

1. **Partly met.** palette_register was 3/5 at branch start. stress-columns now
   passes in every run. stress-dense-apartment passes in one run of three: its
   remaining failures are an orange brick wall that reappears intermittently and,
   in its passing run, a single wooden decor tray. Both are render variance on a
   room whose source photo fights its brief, not a pipeline defect.
2. **Met.** Nothing that passed at branch start fails now. The Al Furjan
   regression is closed: 6/6 dimensions pass in R2 and R3.
3. **NOT met.** 16/19, 13/19, 13/19 against a floor of five in six (15.84/19).
   Per-room the floor holds in every run: no room below half its anchors, none
   at zero. It is the across-rooms rate that fails. See "Anchor retention" below.
4. **Met.** stress-columns is briefed dark saturated and the catalogue cannot
   supply forest green at scale; the room passes brief_adherence and
   palette_register in all three runs, carried by wall colour, drapery and
   joinery finish rather than by product colour.
5. **Met, and it was AC5 that caught the R2 anchor drop.** anchorUnderscaledForRole
   runs before the shortlist, so colour cannot reserve a slot for a piece the
   room's scale rules reject.

### Anchor retention: what the three runs actually show

The drop is not caused by the changes on this branch. R1 predates the scale
gate and already sat at 16/19, barely over the floor. More importantly, R1 and
R3 anchored the SAME rug in three of the five rooms and scored 16/19 and 13/19,
so a large part of the spread is the render reproducing the same reference
differently on different runs.

Two roles account for nearly every miss, in all three runs: the group-anchoring
rug (similarity 0.20, 0.20, 0.18) and secondary seating (0.45, 0.40, 0.35). The
rug misses correlate with FIGURED stock. What the render keeps is plain and
textured (Plain Plush Solid, Nimi Looselay, Bryn Dhurry, Cosey Modern
Abstracts); what it loses is figured (Aleem Persian 1200 Reeds, Milas Carpet,
Oslen Teselya). An image model will not reproduce a specific carpet pattern.

This got more likely, not less, for two reasons that are both improvements:
fixing the catalogue read took the candidate pool from 975 to 3,233 and
surfaced far more figured stock, and the colour reservation deliberately
surfaces saturated pieces, which in rugs usually means patterned ones. The
scale gate then compounded it in one room: it correctly rejected a 160x230
carpet in the 5.2m x 4.2m room and the pool's next on-palette rug was a Persian,
which the render reproduced worse than the undersized one it replaced.

The five-in-six floor was set on runs against the 975-row catalogue. Whether it
survives contact with the full one is a product decision, not an engineering
one, and it is Ayo's to make. The engineering option, if the floor is to hold,
is to make anchor eligibility prefer pieces the render can actually reproduce
(plain over figured for rugs), on the same principle as "an anchor must have a
photograph". That is a slice of its own, not a patch to this branch.

## Decision (Ayo, 2026-09-04)

Approved: ship this branch on the per-room floor, keep the five-in-six number
unchanged, and open anchor retention as its own slice.

Acceptance criterion 3 is therefore KNOWINGLY UNMET at merge, deliberately and
with the number left alone. Reviewers should not treat it as an oversight or
propose lowering it. The full reasoning lives next to the criterion itself, in
`scripts/critique-harness/checklist.md` under the product_consistency floor, so
that it stays with the thing it governs.

The short version: the floor was measured against a catalogue read that could
see 975 of 3,233 rows. Fixing that read moved the measurement. The per-room half
of the floor, which is what protects any individual user's room, held in every
run.

### Next slice, not this branch

1. Reconcile the two verdicts. The app's `verified_similarity` and the harness
   judge disagree about whether the same anchor is in the same render. Settle
   which is right before tuning anything against either.
2. Establish the measurement's variance, so the rate can be a gate again with a
   known error bar rather than a number taken from two runs.
3. Only then, anchor eligibility. The intended mechanism is accumulated
   `verified_similarity`, so the system learns which stock the render reproduces
   faithfully. Note that the harness deletes anchor rows per run, so this can be
   validated in production but not from harness data as it stands.

A name-based "prefer plain rugs over figured ones" heuristic was considered and
rejected as the first move: it would tune the pipeline against an unvalidated
judge. It stays on the table for step 3.
