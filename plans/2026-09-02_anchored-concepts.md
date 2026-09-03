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
- **Beyond step 7: anchored roles skip the sourcing PASS but go through the
  design check.** The plan said sourcing fills the remaining roles. There is
  nothing for the pass to propose for an anchored role, so it never sees one.
  The check is a different matter, and I had it the other way round first, on
  the reasoning that asking whether a render contains what it was built from
  re-derives a fact. Measuring it said otherwise: across the five harness rooms
  the render kept 15 of 20 anchors at the gate's bar, dropping a bedside lamp
  to 0.30 and restyling a red armchair to 0.38. "Generated from" is not
  "contains". So anchored roles rejoin BEFORE the check and are judged like
  every other selection; one the judge confirms is selected and the row says
  the piece is in your design, and one it does not confirm opens its role with
  the anchor still first among the options.
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

## Verification

Live, on the hosted project, against all five harness rooms. The pipeline was
run end to end twice on the shipped code (concepts, then spec, sourcing and the
critique harness on the production judge), so the numbers below are the second
run except where both are given.

### Criterion 8 (anchors): NOT MET — 2 of 5 rooms pass

| room | anchors kept by the render | verdict |
| --- | --- | --- |
| alfurjan-living-dining | 2 of 4 | FAIL |
| cincinnati-bedroom | 3 of 3 | PASS |
| stress-dense-apartment | 4 of 4 | PASS |
| stress-columns | 3 of 4 | FAIL |
| stress-glass-glare | 3 of 4, then 2 of 4 | FAIL |

Across the five rooms the render kept 15 of 19 anchors on the first run and 14
of 19 on the second. The two rooms that pass, pass both times; the three that
fail, fail both times.

What it drops, and it is not random:

- **Rugs.** Elenor green multicolour 0.10, Olaf brown/grey 0.20, Bryn 0.40. A
  rug is mostly hidden under the furniture standing on it, so the model has the
  least of it to preserve and the judge the least of it to compare.
- **Unusual silhouettes.** The Samone 2.5-seater-with-chaise came back as a
  cream sectional (0.40); the Cooper 10-seater dining table came back as a small
  oval one (0.20). Both are pieces whose shape is the thing that makes them
  distinctive, and both are the two the spec's own contract had also refused.
- **One saturated accent.** The red Cigar Lounge Armchair, 0.38, restyled into
  the room's terracotta scheme rather than kept.

Everything else scored 0.80 to 0.98. Anchoring is a large improvement on what
S3 measured for searched products (2 of 7 proposals passing an independent
judge), and it is not a guarantee.

### The measurement's own variance, restated

The same room judged twice does not score the same twice, which is what S3
found and what makes a unanimity criterion hard to hold. Al Furjan's app-side
check passed two of its anchors on one run and none on the next, from the same
render and the same products. The gate's own numbers moved less (3 of 4 to 2 of
4 on glass-glare) but they moved.

### Criterion 8a (anchor fit): MET

Across ten room-runs, no anchor was a piece the room could not use. Bedrooms
anchor on beds, rugs and bedside tables; the living-dining hall on a sofa, a
dining table, an armchair and a rug; living rooms on seating, rug and coffee
table. The contracts run before any ranking, and the brief is a hard filter on
top: the cool, no-beige room is anchored on an off-white sofa, a black-framed
tweed chair, a greige rug and a glass-and-steel table.

Two anchor classes were removed on evidence rather than taste: **lighting**,
after a bedside lamp anchored a bedroom and the render kept it at 0.30, and
implicitly any piece whose photograph cannot be fetched, which cannot anchor at
all because the same fetch feeds the aesthetic pass and the render.

### Criterion 8b (anchor diversity): MET

Five rooms on one brief, generated in sequence so the recency window sees the
earlier rooms exactly as production does: **5 of 5 distinct anchor sets, and no
product anchoring more than two of the five.** Held on both runs.

### Criterion 9 (spend and budget): MET

Per room: concept generation USD 0.083 to 0.088 (of which the anchor pass is
about USD 0.012), sourcing USD 0.014 to 0.045. Whole pipeline about USD 0.10 to
0.13 per room, against the USD 1.00 ceiling.

Every paid call has an `ai_jobs` row opened before it and closed with its cost;
the anchor pass refuses to run at all when its row cannot be opened. The concept
job does not re-count the anchor pass, so summing a room's rows is its spend.

Inside the route budget, comfortably: concept generation 80 to 97 s and sourcing
92 to 143 s, both against 300 s. Every render ran on the primary provider with
no fallback, including rooms whose anchors come from the retailer whose image
URLs forced the fallback in the prototype: anchors now reach the provider as
bytes, so there is nothing for it to fetch.

### Criterion 10 (a room with no anchor pass): MET by construction, not observed

The pass ran successfully on all ten room-runs, so the fallback was not
exercised live. It is pinned by test in four shapes: the pass failing, no budget
left for it, no audit row for it, and choosing anchors throwing outright. Each
leaves the room with a concept and records on the job which way it got there.

### Unclaimed anchors

3 of 19 anchors could not be attached to a spec role: the spec extracted from
the render described the piece differently enough that no role in its category
would take it. Those roles are sourced normally and the count is on the job, so
a number that climbs is visible.

### Still open, for Ayo

Criterion 8 as written asks for every anchor to be kept. The measurement says
about three in four, stably, with the failures concentrated in rugs and unusual
silhouettes. The options are the same shape as S3's: restate the criterion as a
floor the measurement can carry (no room below three of four, and no room at
zero), stop anchoring the classes that do not survive as lighting already does,
or accept the rate and keep the honest handling. Nothing here is presented to a
shopper as being in their design unless the check confirmed it, so the failure
mode is a shorter list, not a false one.
