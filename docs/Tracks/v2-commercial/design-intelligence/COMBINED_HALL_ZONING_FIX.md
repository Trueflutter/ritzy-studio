# Combined Hall Zoning Fix — deterministic living/dining topology

**Status:** Diagnosis + ready-to-implement, deterministic draft for Chief Architect → Codex. **No code changed.**
**Author:** Claude (planning agent)
**Date:** 2026-06-02
**Trigger:** Sam generated a combined Living & Dining hall. Faults: (1) the **sofa runs down the hall's long axis (parallel to the side window wall), not facing the TV**, and (2) **dining sits beside the living zone in the same band, with no divider** — instead of behind the sofa.
**Builds on:** the already-shipped `living_dining` room type + `livingRoomFocalPlacementGuardrail` on `origin/main`. This is **additive**, mirroring that guardrail's pattern.

---

## 1. Grounded current state (origin/main)

The combined hall already ships:
- `RitzyRoomType` includes `"living_dining"` (`interior-design-language.ts:1–8`).
- `roomLanguage.living_dining` (`:37–44`) and `roomBlueprintLanguage.living_dining` (`:65–70`) describe two zones + circulation, and compose `livingRoomFocalPlacementGuardrail` (`:16–27`, which now includes the L-align "parallel/square/no-diagonal" lines).
- `combinedHallProductRoleLanguage` etc. resolve via `living_dining`.

**What the shipped language does NOT say (the gap that produced the bad render):**
1. **No zone-topology rule.** It says "two coordinated zones" but never specifies the dining zone's position *relative to the sofa*. → model places dining **beside** the living band.
2. **No anti-longitudinal-sofa rule for halls.** The focal guardrail says "sofa parallel to the focal wall," but a long hall has a competing long **side wall**; the model parallels the *wrong* wall (the window wall) and runs the sofa down the room's length. → sofa faces dining, not TV.
3. **No divider rule.** Nothing asks for a sofa-back console/screen as the boundary. → zones blur into one band.

These three are deterministic to state. The fix is one additive guardrail array.

---

## 2. The deterministic hall template (the rules to encode)

A combined Living & Dining hall must resolve to this canonical topology:

1. **Living zone anchors to the TV/media focal wall.** Primary sofa **parallel to the TV wall and facing it** across the rug. The sofa's seating axis points at the TV wall.
2. **Do not run the sofa down the hall's long axis** parallel to a side/window wall. (Kills the longitudinal-sofa fault.)
3. **Dining zone goes on the opposite side of the sofa from the TV (behind the sofa back), or at the far end of the hall away from the living seating.** Never beside the sofa in the same TV-facing band; never between the sofa and the TV. (Kills the side-by-side fault.)
4. **A divider marks the boundary behind the sofa:** sofa-back console/credenza, low shelving, a slatted/partial screen, or a planter line — so the sofa back reads as the edge between living and dining.
5. **Each zone gets its own floor + ceiling anchor:** living rug under the seating group; dining rug/defined floor under the table; pendant/chandelier centered over the dining table; separate ambient/lamp lighting over the living zone.
6. **One clear circulation spine** along one side links entry ↔ living ↔ dining; never through the seating core or between sofa and TV.
7. **Narrow-hall fallback:** if too narrow to seat dining behind the sofa, place dining at the far end on the same axis, still divided, and state the zoning assumption in the concept.

---

## 3. The draft fix (additive — define one array, compose into both `living_dining` strings)

### 3a. Define near `livingRoomFocalPlacementGuardrail` (after `interior-design-language.ts:27`)

```js
const combinedHallZoningGuardrail = [
  "Hall zoning rule: resolve the open-plan hall as a living zone anchored to the TV/media focal wall plus a clearly separate dining zone; never merge them into one undivided furniture band facing the same direction.",
  "Anchor the living zone first: place the primary sofa parallel to and facing the TV/media wall across the rug; do not run the sofa down the long axis of the hall parallel to a side or window wall.",
  "Place the dining zone on the opposite side of the sofa from the TV (behind the sofa back), or at the far end of the hall away from the living seating; never beside the sofa in the same TV-facing band, and never between the sofa and the TV.",
  "Mark the boundary with a divider behind the sofa: a sofa-back console or credenza, low shelving, a slatted or partial screen, or a planter line, so the sofa back reads as the edge between the living and dining zones.",
  "Give each zone its own floor and ceiling anchor: a living rug under the seating group and a dining rug or defined floor under the table, with a pendant or chandelier centered over the dining table and separate ambient or lamp lighting over the living zone.",
  "Keep one clear circulation spine along one side of the hall linking entry, living seating, and dining; do not route the main walkway through the seating core or between the sofa and the TV.",
  "If the hall is too narrow to seat dining behind the sofa, place dining at the far end on the same axis, still divided from the living zone, and state the zoning assumption in the concept."
].join(" ");
```

### 3b. Compose into `roomLanguage.living_dining` (`:37–44`)
Insert `combinedHallZoningGuardrail` as the **second element**, immediately after the open-plan intro line and before the "living zone should include…" line, so topology frames the whole description. Keep `livingRoomFocalPlacementGuardrail` where it is.

### 3c. Compose into `roomBlueprintLanguage.living_dining` (`:65–70`)
Insert `combinedHallZoningGuardrail` as the **second element**, immediately after the "plan one open-plan hall…" intro line.

> **Stop rule:** additive only. Do **not** rewrite the existing `living_dining` strings, the focal guardrail, or the living/dining text. If the rules can't be expressed as appended array elements, stop and escalate.

---

## 4. Tests (ready slice — `packages/prompts/src/interior-design-language.test.ts`)

```ts
const hall = roomDesignLanguage("Living & Dining");
assert.match(hall, /separate dining zone|two coordinated zones/i);                         // zoning present
assert.match(hall, /do not run the sofa down the long axis/i);                             // anti-longitudinal sofa
assert.match(hall, /opposite side of the sofa from the TV|behind the sofa back/i);         // dining-behind-sofa topology
assert.match(hall, /divider|sofa-back console|sofa back reads as the edge/i);              // divider rule

const hallBlueprint = roomBlueprintDefaultsLanguage("Living & Dining");
assert.match(hallBlueprint, /opposite side of the sofa from the TV|behind the sofa back/i); // blueprint carries topology
```
Keep existing `living_dining` / focal-guardrail assertions green. No runtime image-behavior change beyond the additive prompt text.

---

## 5. Verification
1. Tests green; `./node_modules/.bin/tsc -p tsconfig.json --noEmit` + `eslint` clean.
2. Re-generate the same hall — expect: sofa parallel to and facing the TV wall; dining **behind the sofa** (or far end) with a **divider**; two rugs; pendant over the dining table; clear side circulation.
3. Capture before/after as the combined-hall zoning regression evidence.

---

## 6. Caveats / pairing
- **Prompt-layer determinism.** This strongly biases the model to the correct topology; under a wide editorial camera it won't be 100%. Pair with the **vision-QA check** (spatial plan §8: "dining beside living in same band? sofa down long axis? no divider?" → fail).
- **PM-001 sofa silhouette (§5.4):** for halls, prefer a **straight sofa facing the TV** over a sectional; if a sectional, its long run parallels the TV wall (the focal guardrail already says this — the new hall rule reinforces axis).
- **Branch note:** implement from **latest `origin/main`** (the shipped `living_dining` + guardrail live there).

---

## 7. Coordination
- Extends the shipped combined-hall language and the merged focal/L-align guardrail — additive only.
- Folded into `DESIGN_SPATIAL_RULES_RESEARCH_AND_IMPLEMENTATION_PLAN.md` §5.2 (combined zoning C1–C6) as the deterministic guardrail; vision check in §8.
- Several codex instances touch `interior-design-language.ts` — route through the Chief Architect; confirm no concurrent edits before starting.

---

## Appendix — citations (re-verify on latest origin/main)
- `RitzyRoomType` + `living_dining`: `packages/prompts/src/interior-design-language.ts:1–8`.
- `livingRoomFocalPlacementGuardrail` (with L-align lines): `:16–27`.
- `roomLanguage.living_dining`: `:37–44`. `roomBlueprintLanguage.living_dining`: `:65–70`.
- `productRoleLanguage` combined branch: `:249–250`. Combined guardrail composition helper: `:195`.
