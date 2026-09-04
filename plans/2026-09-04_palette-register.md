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
