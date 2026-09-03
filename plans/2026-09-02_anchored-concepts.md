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

## Deviations

- **Step 3 (anchor candidate pools) needed no new code.** S3's
  `buildSpecSourcingPlan` already applies every contract before ranking, so the
  anchor pools are that function run over the blueprint's anchor roles. A
  second pool builder would have been a second place for the contracts to drift.
- **Step 5, what an omitted role means.** The plan did not say. The prompt tells
  the stylist that omitting a role is a real answer, and the caller honours it:
  a role the pass declines gets NO anchor, and normal sourcing fills it on the
  list where the shopper can see the options. Filling it with the head of the
  shortlist the pass had just rejected would put that piece in the render and
  make it the room, which is the opposite of what the omission asked for.
- **Beyond step 5: the response schema enumerates role keys and product ids.**
  A correctness review found that this repo carries two role-key conventions
  (`rugs` and `lighting::0:floor_lamp`), so an unconstrained string let the pass
  echo a plausible variant, have its pick dropped, and leave the room on the
  ranked head with the call still paid for and nothing saying so. The decoder
  now cannot name a role or a product that was not offered, and validation
  returns what it dropped so a call whose every answer was discarded fails its
  job row instead of looking like a stylist that liked nothing.
- **Beyond step 7: anchored roles skip the design check, not just the pass.**
  The plan said sourcing fills the remaining roles. It is also true that the
  design check must not judge an anchor: asking whether the render contains
  what the render was built from spends budget to re-derive a fact and buys the
  judge's variance on top of it. Anchored roles are merged back after the check
  rather than through it.
- **Beyond step 7: `shopping_list_items.is_anchor`.** "This piece is in the
  render" and "this piece was matched to it" are different promises to a
  shopper, and only the first can be made by construction.
- **New module `apps/web/lib/concept-run-budget.ts`.** The plan said the pass
  would be bounded by the request budget; concept generation had no partition at
  all, because until now it made one paid call. The render and the persistence
  are reserved before anything anchoring gets a share.
- **2XL (Ayo's condition, not in the original plan).** The prototype's anchored
  render fell back from Evolink to OpenAI and took 232 s, close enough to the
  route limit to matter, and the likely cause was an anchor whose 2XL image URL
  carries the resize parameters that host answers with an error. Anchors now
  reach the render as bytes with no reference URL at all: the fetch already
  happened app-side through the guard, and it is the same fetch the set pass
  judges, so a piece whose photograph cannot be fetched is not eligible to
  anchor anything. Measured below.
- **Cost accounting.** The anchor pass has its own `ai_jobs` row, so the concept
  job does NOT also fold its cost in. A run's spend is the sum of its rows, and
  counting the pass twice would overstate every ceiling.
