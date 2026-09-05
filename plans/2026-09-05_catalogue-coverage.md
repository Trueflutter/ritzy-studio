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
