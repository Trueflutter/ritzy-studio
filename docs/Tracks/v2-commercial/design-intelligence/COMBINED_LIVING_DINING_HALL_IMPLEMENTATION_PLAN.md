# Implementation Plan — Combined Living + Dining Hall (single-render MVP)

**Status:** Implementation plan for Chief Architect review. **No code changes made.** This is the durable artifact for this feature; the earlier `COMBINED_LIVING_DINING_HALL_PROPOSAL.md` is **planning input only** (local-only, not confirmed on `origin/main`) and should not be treated as durable project state.
**Author:** Claude (planning agent)
**Date:** 2026-06-01
**Revises:** the local proposal, incorporating Codex/Chief-Architect review corrections.
**Scope of this plan:** ship a **combined "Living & Dining" room type** through the existing **single-render** pipeline — combined type + combined prompt language + living/dining product-role union. **Three-view rendering is explicitly out of scope for the first slice** (flagged fast-follow).

---

## 0. Constraints (hard — carried into every stage)
- **No DB schema or generated-type changes.** `rooms.room_type` is already a plain `string` (`packages/db/src/types.ts:1009/1019/1029`), so no migration is needed — but do not add new DB columns, enums, or regenerate types.
- **No production deploys, no live app actions, no catalog writes, no live execution** as part of implementation. Staging/local + tests only.
- **No broad prompt rewrites.** Combined design language is **additive** — a new branch in existing language functions, mirroring the already-merged focal-placement discipline, not a rewrite of living/dining text.
- **No multi-view rendering** in the first implementation slice. Single grounded render only.
- Follow repo workflow: branch off **latest `origin/main`**, stage files by name, run `./node_modules/.bin/tsc -p tsconfig.json --noEmit` + `./node_modules/.bin/eslint .` from `apps/web` plus domain package tests, commit trailer, route branch/PR through the Chief Architect.

---

## 1. Corrected assumptions (from review)
1. The proposal file is **local-only / not on `origin/main`** → treat as input, not state. **This plan is the artifact.**
2. `rooms.room_type` is a plain string → **no migration**. ✅ correct.
3. This is **not "easy plumbing."** Multiple resolvers misclassify or throw on a new value.
4. The combined case must be added **before** the living/dining fallbacks in: `packages/domain/src/index.ts`, `packages/prompts/src/interior-design-language.ts`, `packages/domain/src/product-matching.ts`, `packages/domain/src/catalog-first-room-generation.ts`.
5. The **multi-view roadmap is on branch `brand/multi-view-render-roadmap`, not main** → cite as future dependency only.
6. The **focal-placement prompt fix has merged to main** → the combined hall must **build on** that placement discipline, not fork it.
7. **Beta: no three-view render.** Ship single-render combined hall first; three-view is a flagged fast-follow.
8. **Pricing: one room unlock** for "Living & Dining" for now, with internal note that scope is larger. Pricing ambiguity must not block design validation.

> ⚠️ **Branch-state note:** the merged focal-placement fix is on `origin/main` but is **not present on the current working branch** (`codex/measurement-seed-row-adapters-pr-g`) — `interior-design-language.ts` here still shows the pre-fix living text (`:11`, `:26`). The implementer **must branch from latest `origin/main`** so the combined language extends the merged placement rules rather than the stale text.

---

## 2. Current repo reality — exact files/functions, with the two matching idioms

There are **two different matching idioms** in the codebase, and they fail differently on an unknown room type. The combined case must be handled in **both**.

### Idiom A — exact membership (unknown value → **throws / parse error**)
- **`packages/domain/src/index.ts`**
  - `canonicalRoomTypes` (`:18`) → `["Living Room","Dining Room","Bedroom","Home Office"]`; feeds `canonicalRoomTypeSchema = z.enum(canonicalRoomTypes)` (`:20`).
  - `normalizeRoomType()` (`:22–55`) lowercases then checks **`[...].includes(normalized)`** (whole-string array membership, **not** substring). `"living & dining"` matches none → falls to `canonicalRoomTypeSchema.parse(roomType)` (`:54`) → **throws** because the enum lacks the value. Used by `createRoomSchema.roomType` transform (`:68`).
- **`packages/domain/src/catalog-first-room-generation.ts`**
  - `normalizeCatalogFirstRoomType()` (`:120–145`) does `roomType.trim().toLowerCase().replace(/[\s-]+/g, "_")` then exact `===` checks. `"Living & Dining"` → `"living_&_dining"` (the `&` is **not** replaced) → matches nothing → **throws** at `:145`.
  - `CatalogFirstRoomType` union (`:1`) and `catalogFirstRoomBundleBlueprints: Record<CatalogFirstRoomType, …>` (`:72–114`) — adding a member requires a matching blueprint entry or the `satisfies Record<…>` fails to compile.

### Idiom B — substring `includes("living")` (unknown value → **silently misclassified as Living**)
- **`packages/prompts/src/interior-design-language.ts`**
  - `RitzyRoomType` (`:1`) = `"living"|"dining"|"bedroom"|"bathroom"|"office"|"default"`.
  - `resolveRoomType()` (`:247–277`): first test is `normalized.includes("living") || …("lounge") || …("family")` (`:250`) → `"living & dining"` returns **"living"**, never reaching dining. This drives `roomDesignLanguage` (`:143`), `roomBlueprintDefaultsLanguage` (`:147`), `productRoleLanguage` (`:196`).
- **`packages/domain/src/product-matching.ts`**
  - `categoriesForRoom()` (`:538–542`): `Object.entries(roomCategoryHints).find(([key]) => lower.includes(key))` over `roomCategoryHints` (`:118–146`), whose **first key is `living`** → `"living & dining".includes("living")` matches Living first.
  - `enhancedRoomRoleKey()` (`:569–599`): first test `lower.includes("living")…` (`:572`) → returns "living".
  - Role tables `roomProductRoles` / `enhancedRoomProductRoles` (`:148–242`) are keyed by these resolvers.

### UI surface
- `apps/web/app/projects/[projectId]/rooms/new/room-type-selector.tsx` renders single-select radios from a `roomTypes` prop; the new-room page passes `canonicalRoomTypes`. Adding the 5th canonical value **auto-renders a 5th tile** (confirm the prop source in `…/rooms/new/page.tsx` before relying on this).

**Conclusion:** a new `"Living & Dining"` value will (a) **throw** in the two exact-match normalizers and (b) **silently become "Living"** in the three substring resolvers — losing all dining design + dining products. Both must be fixed, combined-case-first.

---

## 3. Corrected normalization strategy

**Canonical discipline (decide once, use everywhere):**
- **Display / `room_type` string:** `"Living & Dining"` (this is what `normalizeRoomType` returns and what is stored).
- **Prompt-side `RitzyRoomType` token:** add `"living_dining"`.
- **Catalog-first token:** add `"living_dining"`.
- Because the stored string contains `&`, every substring/normalization site must be **`&`-aware** (treat `"&"`, `"and"`, and `_` spellings as equivalent). Centralize a tiny predicate (e.g. `isCombinedLivingDining(lower: string)` returning `lower.includes("living") && lower.includes("dining")`) and call it **before** any living/dining test, rather than copy-pasting string checks.

**Per-file rule — combined case FIRST:**
| File / function | Idiom | Required change |
|---|---|---|
| `domain/src/index.ts` `canonicalRoomTypes` (`:18`) | A | Append `"Living & Dining"` → also extends `canonicalRoomTypeSchema` enum (runtime validation only; not a DB/generated type). |
| `domain/src/index.ts` `normalizeRoomType` (`:22`) | A | Add a combined alias branch **before** the Living branch: map `"living & dining"`, `"living and dining"`, `"living/dining"`, `"living-dining"`, `"open plan living dining"`, `"living dining"` → `"Living & Dining"`. |
| `prompts/src/interior-design-language.ts` `RitzyRoomType` (`:1`) | B | Add `"living_dining"` to the union. |
| `…` `resolveRoomType` (`:247`) | B | Add `if (isCombinedLivingDining(normalized)) return "living_dining";` **before** the `includes("living")` test (`:250`). |
| `…` `roomLanguage`/`roomBlueprintLanguage`/`productRoleLanguage` (`:9–51,196–220`) | B | Add a `living_dining` entry to each `Record<RitzyRoomType,…>` (compile-forced once the union grows) — additive zoned language (see §4). |
| `product-matching.ts` `roomCategoryHints` (`:118`) | B | Add a `"living & dining"` (or a `living_dining` lookup) entry **inserted before `living`** so `find()` matches it first; value = de-duped union of living + dining category hints. |
| `…` `categoriesForRoom` (`:538`) | B | Ensure the combined hint is found first (ordering above) or add an explicit combined guard before the `find`. |
| `…` `enhancedRoomRoleKey` (`:569`) | B | Add combined guard returning a `"living_dining"` key **before** `includes("living")` (`:572`); add a `living_dining` entry to `roomProductRoles`/`enhancedRoomProductRoles` = union role set. |
| `catalog-first-room-generation.ts` `CatalogFirstRoomType` (`:1`) | A | Add `"living_dining"`. |
| `…` `normalizeCatalogFirstRoomType` (`:120`) | A | Normalize `&`→`and`/`_` and add a combined `===`/predicate case **before** the living case; return `"living_dining"`. |
| `…` `catalogFirstRoomBundleBlueprints` (`:72`) | A | Add a `living_dining` blueprint = union of `living_room` + `dining_room` roles, de-duped (one rug, one lighting layer; keep dining table/chairs + sofa/coffee/media). |

> The single most important rule for the implementer: **always test the combined predicate before the living/dining test, in every resolver.** That one ordering invariant is what makes this non-trivial.

---

## 4. Combined design language (additive, builds on merged focal-placement fix)

- **Do not fork the merged placement discipline.** Read the living-room placement rules as they exist on **latest `origin/main`** (post-focal-fix `roomLanguage.living` + blueprint) and **compose a `living_dining` entry that applies the same placement logic per zone**:
  - Living zone: primary sofa placed to **face its focal point** (media/art/view), not against the TV wall (mirror the merged rule).
  - Dining zone: table centered, over-table light centered, sideboard on a clear wall.
  - **Connection:** describe the two zones as **one cohesive hall with a circulation spine between them**, distinct rugs/lighting per zone, shared palette — reuse the spatial-plan zoning rules (combined §5.2 C1–C6) as *language*, not as a new solver.
- This is **one additive `living_dining` branch** in `roomLanguage`, `roomBlueprintLanguage`, and `productRoleLanguage`. No edits to the living/dining text itself.
- **Stop rule:** if expressing the combined zone language would require editing the existing living/dining strings or the merged placement sentences, **stop and escalate** — it must stay additive.

---

## 5. Beta-safe MVP scope (this plan)
1. User can pick **"Living & Dining"** at room setup (5th tile, single-select preserved).
2. The value flows through **all five resolver sites combined-case-first** — never misclassified as Living, never throwing.
3. Concept generation emits a **zoned living+dining concept** via the additive `living_dining` language, on the **existing single render**.
4. Product matching returns the **union role set** (sofa/coffee/media + dining table/chairs/sideboard, de-duped) so both zones get products.
5. Stored as **one room**, `room_type = "Living & Dining"`, **one unlock** (pricing note §1.8).
6. Tests prove no regression to the existing four room types.

---

## 6. Explicit out-of-scope (first slice)
- **Three-view / multi-view rendering** (flagged fast-follow; depends on `brand/multi-view-render-roadmap`).
- **DB schema / generated types / new asset or render-set columns.**
- **Structured per-zone focal capture UI** beyond what already exists (may reuse existing brief fields; full `RoomDesignIntent` capture is the Design-Spatial-Intelligence track, coordinated not duplicated).
- **Multi-select room-type UI** (single tile only; internal model stays the same so a future multi-select is a pure UI swap).
- **Pricing/packaging changes** (one unlock; internal scope note only).
- **Broad rewrites** of living/dining language or the merged placement fix.
- **Catalog writes / re-ingestion / live runs.**

---

## 7. PR-sized implementation stages

Each stage is small, additive, independently testable, branched from latest `origin/main`.

- **S1 — Domain normalization + canonical type (Idiom A core).**
  - Files: `packages/domain/src/index.ts` (`canonicalRoomTypes`, `normalizeRoomType`), add shared `isCombinedLivingDining` helper (export from domain).
  - Outcome: `"Living & Dining"` is a valid canonical value; aliases normalize to it; no throw.
- **S2 — Prompt resolver + additive zoned language (Idiom B, prompts).**
  - Files: `packages/prompts/src/interior-design-language.ts` (`RitzyRoomType`, `resolveRoomType` combined-first, `roomLanguage`/`roomBlueprintLanguage`/`productRoleLanguage` `living_dining` entries).
  - Outcome: combined hall resolves to `living_dining`; concept language is zoned and reuses merged placement discipline.
- **S3 — Product-matching room mapping + union role set (Idiom B, matching).**
  - Files: `packages/domain/src/product-matching.ts` (`roomCategoryHints` combined entry ordered first, `categoriesForRoom`, `enhancedRoomRoleKey` combined-first, `roomProductRoles`/`enhancedRoomProductRoles` `living_dining` union).
  - Outcome: combined hall yields the de-duped union of living + dining roles/categories.
- **S4 — Catalog-first room generation (Idiom A, catalog-first).**
  - Files: `packages/domain/src/catalog-first-room-generation.ts` (`CatalogFirstRoomType`, `normalizeCatalogFirstRoomType` combined-first + `&`-aware, `catalogFirstRoomBundleBlueprints.living_dining`).
  - Outcome: catalog-first path builds a combined blueprint, de-duped.
- **S5 — UI tile + end-to-end single-render validation.**
  - Files: `apps/web/.../rooms/new/room-type-selector.tsx` (auto-renders if prop = `canonicalRoomTypes`; confirm `…/rooms/new/page.tsx` prop) + one-line helper copy under the tile.
  - Outcome: user can create a "Living & Dining" room and get a zoned concept + union products on the single render. Manual QA evidence captured.

> S1→S4 are pure domain/prompt packages (safe, test-heavy) and can land in sequence; S5 wires the UI once the domain path is green. The combined blueprint/role union in S3 and S4 must agree (same categories) — keep them consistent.

---

## 8. Tests required per stage
- **S1:** `normalizeRoomType("Living & Dining")` and each alias → `"Living & Dining"`; `canonicalRoomTypeSchema.parse("Living & Dining")` passes; existing four types unchanged; `isCombinedLivingDining` truthy for `&`/`and`/`/`/`-` spellings, falsy for `"Living Room"`/`"Dining Room"`.
- **S2:** `resolveRoomType("Living & Dining")` → `"living_dining"` (regression: it must **not** return `"living"`); `roomDesignLanguage`/`roomBlueprintDefaultsLanguage`/`productRoleLanguage` return the combined entry and mention both zones + circulation; existing room types unchanged. Extend `interior-design-language.test.ts`.
- **S3:** `categoriesForRoom("Living & Dining")` returns the union (asserts both `sofas` and `dining_tables` present) and is found **before** Living; `enhancedRoomRoleKey("Living & Dining")` → combined key; role table union contains required sofa **and** dining table/chairs, de-duped (single rug/lighting).
- **S4:** `normalizeCatalogFirstRoomType("Living & Dining")` → `"living_dining"` (no throw); `catalogFirstBlueprintForRoom("Living & Dining")` returns the union blueprint; `catalogFirstRoomBundleBlueprints` still `satisfies Record<CatalogFirstRoomType,…>` (compile check). Extend `catalog-first-room-generation.test.ts` and `room-type.test.ts`.
- **S5:** manual QA: create a Living & Dining room, confirm a zoned concept renders on the single path and both zones receive products; capture before/after evidence per the manual-qa convention. No automated UI test required if covered by domain tests.
- **All stages:** typecheck + eslint clean; the four existing room types produce byte-identical resolver output (snapshot/regression guard).

---

## 9. Risk / stop rules
- **Misclassification regression:** the entire feature hinges on combined-case-first ordering. Any resolver that still hits `includes("living")` first silently drops dining. **Mitigation:** a single shared `isCombinedLivingDining` predicate + a regression test per resolver asserting `≠ "living"`.
- **Throw on unknown value:** `normalizeRoomType` and `normalizeCatalogFirstRoomType` throw if the combined case is missing. **Mitigation:** S1/S4 add the case + a parse test before anything depends on it.
- **Branch drift from merged focal fix:** building on the stale current branch would fork the placement language. **Stop rule:** branch from latest `origin/main`; if `roomLanguage.living` on your base lacks placement language, you're on the wrong base — rebase.
- **Union blueprint bloat:** naively unioning living + dining roles double-counts rug/lighting/decor. **Mitigation:** de-dupe to one rug strategy + one lighting layer; keep both anchors (sofa + dining table). If a hall is too small for both, that is a *design-language warning* (spatial C6), **not** a reason to drop a zone.
- **Scope creep:** **stop and escalate** if the work pulls in schema changes, multi-view rendering, multi-select UI, pricing changes, or any rewrite of existing living/dining/placement strings.
- **Pricing ambiguity:** do **not** block on it — ship as one unlock with an internal scope note (§1.8).

---

## 10. Coordination with adjacent tracks
- **Merged focal-placement fix (main):** the combined `living_dining` language **extends** the merged per-zone placement discipline; it must not edit or duplicate it. (§4 stop rule.)
- **Design Spatial Intelligence track** (`DESIGN_SPATIAL_RULES_…PLAN.md`): owns `RoomDesignIntent.layoutMode` and combined zoning rules §5.2. This MVP uses those rules as **language** only; full structured per-zone focal capture + spatial QA is that track's job. Keep the `living_dining` token name consistent with `layoutMode: "living_plus_dining"` mapping so the tracks converge (document the mapping; don't fork the vocabulary).
- **Product Matching (PM-001):** the union role set must pass PM-001 §5 role contracts (class purity, room scope) once those land — so a combined hall doesn't admit wrong-class items across the larger role set. Sequence the union work to reuse PM-001 contracts rather than predate them where possible; if PM-001 contracts aren't merged yet, the union still works on today's matching, and contract enforcement applies later uniformly.
- **Multi-view roadmap** (`brand/multi-view-render-roadmap`, not main): the three-view reveal is the fast-follow that consumes this MVP's zoned concept as its hero anchor. Cite as future dependency; do not implement now.
- **Architect-coordination convention:** several codex instances touch `interior-design-language.ts` and `product-matching.ts`; route this branch through the Chief Architect and confirm no concurrent edits to those files before starting.

---

## 11. Recommended first implementation prompt (for the next Codex agent)

> **Do not implement from this section yourself — it is a handoff for a future implementation chat.**

```
Task: Implement Stage S1 of the Combined Living + Dining Hall MVP (domain normalization only).
Source of truth: docs/Tracks/v2-commercial/design-intelligence/COMBINED_LIVING_DINING_HALL_IMPLEMENTATION_PLAN.md

Branch: branch off LATEST origin/main (it contains the merged focal-placement fix). Name: feature/combined-living-dining-s1-normalize.

Do ONLY S1 in this slice:
1. In packages/domain/src/index.ts:
   - Add "Living & Dining" to canonicalRoomTypes (this also extends canonicalRoomTypeSchema; runtime validation only — do NOT touch DB or generated types).
   - Add and export a helper isCombinedLivingDining(lower: string): boolean that returns lower.includes("living") && lower.includes("dining").
   - In normalizeRoomType, add a combined-case branch BEFORE the Living branch mapping "living & dining" / "living and dining" / "living/dining" / "living-dining" / "living dining" / "open plan living dining" to "Living & Dining".
2. Tests (extend the domain test file): normalizeRoomType returns "Living & Dining" for every alias; canonicalRoomTypeSchema.parse("Living & Dining") passes; the existing four types are unchanged; isCombinedLivingDining is true for &/and/slash/hyphen spellings and false for "Living Room" and "Dining Room".

Constraints: additive only; no schema/generated-type changes; no prompt edits; no UI; no multi-view; no other resolver files in this slice. Run ./node_modules/.bin/tsc -p tsconfig.json --noEmit and the domain package tests; both must be clean. Then STOP and report — S2 (prompts) is a separate slice.

Critical invariant for the whole feature (later slices): in every resolver that uses includes("living") (resolveRoomType, enhancedRoomRoleKey, categoriesForRoom) and every exact-match normalizer (normalizeCatalogFirstRoomType), the combined case MUST be tested BEFORE the living/dining case, or the hall is silently misclassified as Living or throws.
```

---

## Appendix — Key citations (re-verify on latest origin/main before editing; line numbers drift)
- `rooms.room_type` plain string: `packages/db/src/types.ts:1009,1019,1029`.
- Canonical types + schema: `packages/domain/src/index.ts:18,20`; `normalizeRoomType` (exact membership, throws): `:22–55`; `createRoomSchema.roomType`: `:68`.
- Prompt resolver (substring includes-living-first): `packages/prompts/src/interior-design-language.ts:1, 247–277`; language tables `:9–51, 143–149, 196–220`; tests `interior-design-language.test.ts`.
- Product-matching room maps: `packages/domain/src/product-matching.ts:118–146 (roomCategoryHints, living first), 148–242 (role tables), 538–542 (categoriesForRoom), 569–599 (enhancedRoomRoleKey, living first)`.
- Catalog-first: `packages/domain/src/catalog-first-room-generation.ts:1 (CatalogFirstRoomType), 72–114 (blueprints Record), 120–145 (normalizeCatalogFirstRoomType, exact, throws), 148–153`.
- Room-type UI: `apps/web/app/projects/[projectId]/rooms/new/room-type-selector.tsx` (+ `…/rooms/new/page.tsx` prop source).
- Multi-view roadmap (branch, NOT main): `docs/Design/Ritzy_Multi_View_Render_Roadmap.md` on `brand/multi-view-render-roadmap`.
- Spatial zoning rules + layoutMode: `docs/Tracks/v2-commercial/design-intelligence/DESIGN_SPATIAL_RULES_RESEARCH_AND_IMPLEMENTATION_PLAN.md` §5.2, §5.6.
- ⚠️ Merged focal-placement fix is on `origin/main` but **not** on working branch `codex/measurement-seed-row-adapters-pr-g` — branch from main.
