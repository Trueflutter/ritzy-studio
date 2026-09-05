# Catalogue coverage, and what it proved

Date: 2026-09-05
Risk tier: LOW (one additive data backfill, one schema resilience fix)

## Objective

Raise the shopping list's fill rate for the demo. Rooms were sourcing 3 to 5
pieces against 13 to 17 roles, so a viewer reaching the list sees mostly
"Choose one". The S3 verification diagnosed the cause as catalogue coverage:
"with four retailers, most objects in an AI-generated render have no genuine
match".

## What shipped

1. **511 products recovered.** 585 usable rows carried no `category_normalized`
   and were invisible to every role query. 152 carried a label today's map
   already understands and simply predated the needle; 433 needed new needles.
   They were not junk, they were the styling stock a finished room needs.

   | category | before | after |
   | --- | --- | --- |
   | decor | 111 | 344 |
   | lighting | 224 | 354 |
   | storage | 326 | 406 |
   | side_tables | 157 | 225 |
   | uncategorised | 585 | 74 |

   The 74 remaining are deliberate: dining sets (a set fills one blueprint role
   and leaves the other to buy the same chairs again), architectural and outdoor
   fixtures, kitchen trolleys, bathmats.

2. **The normaliser now falls back to the product NAME** when the retailer's
   category resolves to nothing, with a guard so it cannot overturn a deliberate
   exclusion. Found by reading the dry run rather than trusting it: the fallback
   was filing "Derin 1+8-Seater Dining Set with Swivel Chair" as `chairs`.

3. **One malformed id no longer costs a room every pick it earned.** The
   sourcing response schema failed the whole array on one bad UUID, and the
   caller's only answer to a parse error is to discard the entire visual pass.
   A room fell from five chosen pieces to three, having paid for a pass that was
   thrown away. Longer candidate lists make this MORE likely, so it was about to
   get worse. The array now drops bad elements and keeps the rest, the same
   choice `validateAnchorSetPicks` already makes for anchors.

## What it proved, which is not what was expected

**Catalogue coverage is not the binding constraint on fill rate.** Adding 511
products to exactly the thin categories did not move it.

| room | before | after |
| --- | --- | --- |
| alfurjan-living-dining | 3 chosen | 3 |
| cincinnati-bedroom | 3 | 3 |
| stress-dense-apartment | 5 | 5 |
| stress-columns | 3 | 2 |
| stress-glass-glare | 1 | 1 |
| **total chosen** | **15** | **14** |

`missingRoleCount` moved a little, which is what more stock should do: roles
that had no candidates now have some. But nothing more got CHOSEN, because
choosing is gated by the paid design check, and that is where the funnel closes.

### The funnel, from one room's recorded job (stress-glass-glare, 17 roles)

- contracts reject ~45,000 candidate-role pairs, almost all `category_mismatch`
- the visual pass proposes for 8 of 13 open roles; 5 get no verdict at all
- the design check judges those 8 and passes **one**

The eight scores: 0.35, 0.40, 0.00, **0.90**, 0.10, 0.40, 0.55, 0.50, against a
0.75 bar. One in eight.

### Why, and it is structural rather than a tuning problem

The check compares a catalogue photograph against an object in an
AI-generated render. A terracotta sofa in the render and a terracotta sofa in
the catalogue score 0.35 because they are different sofas. They can only score
highly when the render was BUILT from that product.

Which is exactly what anchoring does, and the numbers agree: anchors are kept
and claimed at a far higher rate than anything else, because they are in the
render by construction. Everything else is a hunt for a match to an object the
render invented.

**So the lever on fill rate is anchoring MORE of the room before the render, not
adding more catalogue.** Currently four roles are anchored (sofa, armchair, rug,
coffee table). Lighting, side tables, storage and the decor layer are all
hunted after the fact, and all score badly.

There is a real tension to resolve before acting on this, and it is why this is
a recommendation rather than a change: more anchors means more reference
photographs in one render, and anchor retention is already under pressure at 13
of 19 against the five-in-six floor (see
`plans/2026-09-04_palette-register.md`). Lighting was previously REMOVED from
anchoring on evidence. Whether the render can carry six or eight references as
faithfully as four is an open measurement, not a known quantity.

This also reframes the deferred retention slice: anchor retention and shopping
list fill rate are the same problem seen from two ends.

## Not done here

- Adding retailers. On this evidence it would not move the demo, and it is the
  expensive option. Worth revisiting only after the anchoring question is
  settled.
- The one Arabic-language category label (`أثاث > غرفة المعيشة > الطاولات
  الجانبية`) suggests the Danube adapter occasionally captures the localised
  category. One row today; worth a look if it grows.

## Review round 2 (Codex on PR #336)

Two findings, both valid, both mine, and chasing the second turned up a third
that neither of us had seen.

1. **The deliberate exclusion was bypassable by a product with no retailer
   category.** The guard only checked `category_raw`, so `categoryFor(null,
   "Derin 1+8-Seater Dining Set with Swivel Chair")` returned `chairs` — the
   same double-buy, reached by a different road. The exclusion now holds however
   the name is reached. It also needed a second needle: "Bavaria 1+2 High Dining
   Table Set" does not contain "dining set". Deliberately NOT a bare "table
   set", because "Dott Sintered Stone Top Coffee Table - Set of 2" is a nest of
   tables, one purchase filling one role.

2. **Generic decor needles shadowed wall lights.** "Candle Wall Lights" resolved
   to `decor`. I had reasoned correctly about "Candle Chandeliers" (chandelier
   sits earlier, so lighting wins), written a comment explaining why the bug
   could not happen, and then created it one line below by appending "wall
   light" after "candle".

3. **Found by auditing what the backfill had already written: 80 rows were
   miscategorised, none of them by this PR.** `category_normalized` is a cache
   of a pure function of `category_raw`, so re-deriving it corrects a stale
   cache rather than destroying authored data. The script gained a `--stale`
   mode for exactly this, which never blanks a category: a row is rewritten only
   when the resolver produces a different, non-null value.

   - 52 chandeliers and ceramic table lamps stored as `beds` ("Bedroom
     Chandeliers", from an older map ordering)
   - 7 canvas wall-art pieces stored as `decor`
   - 28 dressers stored as `beds` — invisible to the first stale pass, because
     today's map was wrong in the same direction

   The root cause of the bed ones is that `["bed", "beds"]` is a three-letter
   needle sitting mid-map, and first-needle-wins made it beat every more
   specific needle placed after it: bedroom, bedside, bedding and sofa bed all
   contain it. It now sits LAST, so it wins only when nothing more specific
   does. A bed-role query was answering with lighting and storage, and 14% of
   the `beds` category was not beds.

   | category | at PR open | after this round |
   | --- | --- | --- |
   | storage | 406 | 434 |
   | lighting | 354 | 406 |
   | beds | 384 | 304 |

   The catalogue is now self-consistent: a second `--stale` pass reports zero.

## Review round 3 (Codex on PR #336)

Valid, and taken. The exclusion ran AFTER `normalizeCategory`, so a label that
resolved on some other needle skipped it: `categoryFor("Dining Table Set", ...)`
matched the `dining table` needle and returned `dining_tables`, which would let
a bundled set fill the table role while the blueprint sourced the chairs
separately.

No such label is in the catalogue today, so this was latent rather than live.
Taken anyway on two grounds: the exclusion is a statement about the OBJECT and
should not depend on which needle happens to match first, and this is ingestion
code that S8 will run nightly, so a retailer adding the label later would
silently reintroduce the double-buy.

Verified against the live catalogue rather than assumed: after the reordering,
`--stale` reports 0 and the NULL pass still resolves 0 of the 74 deliberate
exclusions. Nothing in the catalogue changes; the fix is purely defensive.
