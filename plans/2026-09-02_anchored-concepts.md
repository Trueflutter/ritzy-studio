# Anchored concepts: choose the hero pieces before the render

## Objective

Return the pipeline to the product-first ordering the platform originally had,
for the pieces that carry the design and the money. The room's ANCHOR pieces
(seating, main surface, rug, and one storage or lighting piece) are chosen from
the live catalogue BEFORE the concept is generated, and the concept is
generated using their photographs as references. They then match by
construction rather than by search, which is what S3 measured to be
unachievable the other way round.

Everything else stays as S3 built it: the confirmed spec drives sourcing for
the remaining roles, a design check decides what may be presented as a match,
and anything unverified is an open role or an honest gap.

## Why

S3's evidence, in the sibling plan's Verification section: with a four-retailer
catalogue, roughly 13% of the pieces an unconstrained render depicts have a
genuine match in stock. Tightening the bar converts wrong products into empty
lists. Anchoring inverts the problem for the pieces that matter most.

## The two failures of the earlier product-first attempt

Ayo named both, and they are acceptance criteria here, not footnotes.

1. **Pieces the room cannot use.** The earlier attempt put office chairs in
   living rooms and tables that did not belong. Cause: ranking ran before the
   contracts. Here every contract (category, class tags, room scope, size class
   against the room's measurements, seat range, object kind) is applied BEFORE
   any ranking, exactly as S3's sourcing does.
2. **The same pieces in every design.** The earlier attempt returned the
   top-ranked product every time, so one sofa anchored every living room.
   Cause: a deterministic scorer with no memory and no spread. Here the
   shortlist is de-duplicated across recent anchors, spread across retailers and
   product families, and ordered with a room-seeded rotation, so two rooms with
   the same brief do not get the same set.

## Steps

1. **Prototype first, before any of the rest.** Generate one room's concept
   with four real anchor products pinned as references, beside the current
   unanchored render of the same room, and compare. Concept-first won at Gate 1
   on render quality; if pinning real pieces visibly degrades the render, that
   changes the design and Ayo decides before more is built. Scratch code, no
   commit beyond the comparison record.
2. **Anchor role set** (`packages/domain`, pure): `anchorRolesForRoomType`
   returns at most four roles from the shipped room blueprint's required roles,
   ordered by visual weight. Providers accept far more references than this
   (Evolink caps at 14), so four is a design choice, not a limit: enough to
   carry the room, few enough that the room photo still dominates.
3. **Anchor candidate pools** (`packages/domain`, pure): reuse
   `sourcingRolesFromBlueprint` plus the S3 contract machinery so the pool for
   each anchor role is contract-clean before ranking, with a per-role share of
   the room budget so one piece cannot consume it.
4. **Shortlist diversity** (`packages/domain`, pure): drop products anchored
   recently anywhere, spread the shortlist across retailers and product
   families, and order it with a room-seeded rotation. Testable with no model
   call, and criterion 8b is asserted against it.
5. **Aesthetic set pass** (`packages/ai`, paid vision): one call sees the room
   photo, the brief and the shortlist images, and picks one product per anchor
   role as a SET that works together, with a reason per piece. Set-level, not
   per-role: coherence is the thing a scorer cannot judge. Same discipline as
   S3's design check: untrusted text fenced, audit row before the call, bounded
   by the request budget, honest fallback to the ranked shortlist when it cannot
   run, recorded either way.
6. **Generate from the anchors** (`apps/web`, `packages/ai`): pass the chosen
   products into concept generation as references, and tell the prompt these
   exact pieces must appear and must not be restyled.
7. **Persist** (migration, HIGH): the anchors chosen for a concept, so sourcing
   fills the remaining roles rather than re-deciding these, and the shopping
   list carries them with their own provenance.
8. **Verify**: the S3 design check runs on the anchors after generation, which
   now asks "did the render keep the pieces we gave it". Harness on all five
   rooms for criteria 8, 8a and 8b.

## Acceptance criteria

Criteria 8, 8a and 8b as restated in
`plans/2026-09-01_product-pass-implementation.md`, plus:

9. Every paid call in the anchor path has an `ai_jobs` row opened before it and
   closed with its cost, and the whole run stays inside the route budget and
   the USD 1.00 per-run ceiling.
10. A room whose anchor pass cannot run still produces a concept, from the
    ranked shortlist, and says so on the job record.

## Risks

- **Render quality.** The reason concept-first won at Gate 1. Step 1 exists to
  measure it before anything else is built.
- **A bad anchor poisons the whole design**, where today a bad product is one
  row on a list. The contracts and the set pass are the mitigation; the fallback
  is that a shopper can still swap, and swaps go through the design check.
- **Cost.** One more paid vision call per room, on top of the two S3 added.
  Bounded by the same run budget and measured against the ceiling.

## Risk tier

HIGH: a migration, and a change to the paid generation path.
