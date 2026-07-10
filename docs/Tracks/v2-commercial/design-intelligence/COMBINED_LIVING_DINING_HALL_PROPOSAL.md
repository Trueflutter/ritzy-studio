# Proposal — Combined Living + Dining Hall (one space, zoned, multi-view)

**Status:** Proposal + implementation plan for Chief Architect review. **No code changes made.**
**Author:** Claude (planning agent)
**Date:** 2026-06-01
**Requested by:** Sam — many Dubai homes have a single hall used as living **and** dining. Today the app forces a choice between "Living Room" and "Dining Room." Sam asks: can we let the user pick living **and** dining, and have the app design the one hall with both — the way interior designers present it, with **three views of the same hall**?

**Related docs (read alongside this):**
- `docs/Tracks/v2-commercial/design-intelligence/DESIGN_SPATIAL_RULES_RESEARCH_AND_IMPLEMENTATION_PLAN.md` — already defines combined living+dining zoning rules (§5.2 C1–C6) and the `RoomDesignIntent.layoutMode` field.
- `docs/Design/Ritzy_Multi_View_Render_Roadmap.md` (on branch `brand/multi-view-render-roadmap`) — already defines the hero + supporting-views, chained-for-consistency rendering pattern.

> This proposal **connects two pieces of work that already exist on paper** (spatial/zoning intelligence + multi-view rendering) into one concrete feature: a combined hall, modeled as **one zoned room**, designed with zone-aware intelligence, and revealed as **three consistent views of the same hall**.

---

## 1. TL;DR — recommendation

**Yes — and the clean model is "one room, two zones, three views," not "two rooms."**

1. **One room entity, a combined type.** Treat the hall as a *single* room of a new type (working name **"Living & Dining"**), not two separate rooms. A combined hall shares architecture, palette, lighting, and circulation — splitting it into two room records would fragment measurements, concept, products, and the reveal.
2. **It is NOT a schema change.** `rooms.room_type` is a free **`string`** column (`packages/db/src/types.ts:1009–1029`), so a new type value is a **domain-constant + normalization** change, not a DB migration. (See §3.1 — this is the single most important enabling fact.)
3. **Zone-aware design intelligence.** Reuse the already-drafted combined living+dining rules (spatial plan §5.2): explicit zoning, circulation spine, focal-point-per-zone, role-set union, scale arbitration.
4. **Three views of the same hall.** Reuse the multi-view roadmap, specialized for a combined space: **(V1) Living-zone hero, (V2) Dining-zone hero, (V3) Connecting establishing view** that shows both zones and the circulation between them — chained so all three read as the *same* hall.
5. **Stage it.** Ship the *room model + zoning + product union* first (works with today's single render), then layer the three-view reveal as a second phase reusing the multi-view work.

**UI recommendation:** add a dedicated **"Living & Dining"** tile (5th option) rather than a free-form multi-select. It preserves the existing single-select radio semantics (`room-type-selector.tsx`), is unambiguous to plumb downstream, and reads clearly to the user. (Multi-select is discussed and rejected in §6.)

**Decisions needed from the architect** are collected in §9 — chiefly: pricing/unlock for a combined hall, and whether to defer the render-set schema columns.

---

## 2. The problem (Dubai context)

- A large share of Dubai apartments and villas have an **open hall** that functions as living + dining in one volume (often L-shaped or a long rectangle, frequently open to the kitchen).
- The current room setup screen (screenshot: *N° 04 — Set up the room*) offers a **single choice** of Living Room / Dining Room / Bedroom / Home Office. A user with one hall must either:
  - pick "Living Room" and lose the dining design + dining products, or
  - create two rooms for one physical space, which double-counts architecture, fragments the concept, and breaks the reveal and (likely) pricing.
- Interior designers never present such a hall as one flat photo. They present an **establishing view of the whole space** plus **a view per zone**, so the client understands both the seating and dining moments and how they relate. Sam's "three views of the same hall" is exactly this convention.

---

## 3. Current system reality (grounded in repo)

### 3.1 Room type is a free string, gated by a domain constant (NOT a DB enum)
- DB: `rooms.room_type: string` (`packages/db/src/types.ts:1009 (Row), 1019 (Insert), 1029 (Update)`) — **plain string, no Postgres enum.** Adding `"Living & Dining"` is **not** a schema change.
- The selectable list is a **domain constant**: `canonicalRoomTypes = ["Living Room","Dining Room","Bedroom","Home Office"]` (`packages/domain/src/index.ts:18`), rendered by `RoomTypeSelector` (`apps/web/app/projects/[projectId]/rooms/new/room-type-selector.tsx`) as **single-select radios** that auto-submit.
- Aliases normalize via `normalizeRoomType()` (`packages/domain/src/index.ts:26–52`) — e.g. lounge/majlis → "Living Room".

### 3.2 Room type fans out to ~five places that must learn the combined type
A new type is "plumbing," touching every place that switches on room type:
1. `canonicalRoomTypes` + `normalizeRoomType` — `packages/domain/src/index.ts:18, 26–52`.
2. Prompt-side resolver `RitzyRoomType` + `resolveRoomType()` — `packages/prompts/src/interior-design-language.ts:1, 247–277` (today: living/dining/bedroom/bathroom/office/default — **no combined**).
3. Per-room design language + blueprint defaults — `interior-design-language.ts:9–51` (`roomLanguage`, `roomBlueprintLanguage`), `productRoleLanguage()` `:196–220`.
4. Product-matching room→role mapping — `roomCategoryHints` (`packages/domain/src/product-matching.ts:118–146`), `roomProductRoles`/`enhancedRoomProductRoles` (`:148–242`), `categoriesForRoom()` (`:538–542`), `enhancedRoomRoleKey()` (`:569–599`).
5. Catalog-first room generation — `CatalogFirstRoomType` (`packages/domain/src/catalog-first-room-generation.ts:1`, currently the same 4 types).

### 3.3 Concept + render are single-image today
- Concept generation composes design-language modules into one `generationPrompt` (`packages/ai/src/index.ts:341–345`).
- Final render is **one grounded image** with a practical cap of ~8 product references (per the multi-view roadmap's own description of the current path). One hero, not a set.
- **`editableZones`** already exists on the concept response (`packages/prompts/src/index.ts:131`) — a free-text foothold, but no structured zoning.

### 3.4 The multi-view pattern is already specified (not yet built)
`docs/Design/Ritzy_Multi_View_Render_Roadmap.md` defines: a hero reveal + 2–4 supporting/vignette views; a **consistency summary** (palette, materials, lighting, placements) captured from the hero; per-view **product subsets** (fewer references per call → higher fidelity); a small **view-plan JSON**; chained generation ("use the hero as source of truth, do not redesign"); and a data-model direction (render-set metadata in `render_jobs.input_summary` first, schema columns later). **This proposal is a specialization of that roadmap for a combined hall.**

### 3.5 There is already evidence the domain anticipates combined space
A property-layout fixture names a room **"Living / Dining"** (`packages/domain/src/measurement-layout-seed.ts:277–278`) — source-property metadata, confirming combined halls exist in our data, though it is **not** yet a design-time room type.

---

## 4. Key insight

The two hard parts are **already designed**:
- **Zoning intelligence** for combined living+dining → spatial plan §5.2 (C1 explicit zoning, C2 circulation spine, C3 focal-per-zone, C4 role-set union, C5 back-to-back anchoring, C6 scale arbitration).
- **Multi-view reveal** → multi-view roadmap (hero + supporting views, chained for consistency).

So this feature is mostly **integration + plumbing a new room type**, not new invention. The combined hall is the *first concrete customer* of both pieces of work, which de-risks both.

---

## 5. Proposed approach — "one room, two zones, three views"

### 5.1 The model
- **One `room` record**, `room_type = "Living & Dining"` (free string), `layoutMode = "living_plus_dining"` stored in `design_briefs.structured_json` (per spatial plan's `RoomDesignIntent`). No schema change.
- **Two design zones** (living, dining) carried as structured intent, not separate rooms. Each zone has its own focal point and role priorities; they share architecture, palette, lighting, and a circulation spine.
- **One product plan** = **role-set union** of living + dining roles, de-duplicated and scale-arbitrated (spatial §5.2 C4): e.g. sofa + armchairs + coffee table + media/art + **dining table + dining chairs + over-table light + sideboard**, with **one** shared rug strategy (rug-per-zone only if the hall is large enough — C6 warns rather than crams).
- **One reveal = three views** of the same hall (§7).

### 5.2 How it flows through each pipeline stage
| Stage | Today | With combined hall |
|------|-------|--------------------|
| Room setup | single radio | add "Living & Dining" tile → `room_type` string + `layoutMode` intent |
| Brief / clarifying | generic | ask zoning planning questions (spatial §6): focal point **per zone**, must-keep-clear, dining-seating count, existing pieces |
| Design language | `roomLanguage[living\|dining]` | new `combined` language module = zoned living+dining composition + circulation (spatial §5.2) |
| Product roles | `roomProductRoles[living]` *or* `[dining]` | **union** role set (de-duped, scaled) |
| Concept gen | one prompt | one prompt that establishes both zones + the connection |
| Render | one hero | **three chained views** (living hero, dining hero, connecting establishing) |
| Shopping list | role rows | union role rows; products tagged by zone for grouping |
| Pricing/unlock | per room | **architect decision** (§9) |

---

## 6. UI options (room setup screen)

**Option A — dedicated "Living & Dining" tile (RECOMMENDED).**
- Add a 5th tile to the existing grid (`room-type-selector.tsx`). Single-select semantics preserved; downstream gets one clean type value.
- Pros: unambiguous, minimal UI change, easy to plumb, clear to user. Cons: one more tile; "combined" is a discrete choice not a composition.

**Option B — multi-select (tick Living *and* Dining).**
- Let the user check both; map the pair to the combined mode.
- Pros: matches Sam's literal phrasing ("select living and dining"); composable. Cons: breaks the current radio/auto-submit pattern; ambiguous combinations (Living+Bedroom?); more validation; the result is still internally one combined type, so the multi-select is UI sugar over Option A's model. **Rejected for v1** — revisit only if users expect arbitrary combinations.

**Recommendation:** Option A tile now; keep the internal model (`layoutMode`) identical so a future multi-select is a pure UI swap. Add a one-line helper under the tile ("One hall used for both living and dining — we'll design and reveal both zones").

---

## 7. The "three views of the same hall" reveal (design)

Specializes the multi-view roadmap for a combined space. **All three are the same hall**, chained for consistency.

- **V1 — Living-zone hero.** Wide, emotionally persuasive view centered on the seating group, oriented to the living focal point (media/art/view). Product subset: sofa, armchairs, coffee table, rug, primary art/console, primary lamp.
- **V2 — Dining-zone hero.** Wide view centered on the dining table + chairs + over-table light + sideboard, with the living zone legible in the background so the spaces read as connected. Product subset: dining table, chairs, pendant, sideboard, art/mirror.
- **V3 — Connecting / establishing view.** The designer's "show the whole hall" shot: a longer axis that captures both zones and the **circulation spine** between them, proving the zoning and scale work. Lighter product emphasis; spatial comprehension is the job.

**Consistency strategy (from the roadmap):** generate **V1 (or a whole-hall hero) first**, capture a **consistency summary** (camera, palette, dominant materials, lighting mood, key placements, zone boundaries), then generate V2 and V3 **using the first render + the summary as the source of truth** ("same hall, same palette/materials/lighting, do not redesign"). Per-view product subsets keep each generation honest (fewer references → better fidelity). This directly mitigates the "each view becomes a different room" risk.

**Order/ratio is configurable** via a small view-plan JSON (roadmap Step 2): for a small hall, V3 may merge into V1; for a large hall, add a fourth detail vignette.

---

## 8. Staged implementation plan (PR-sized slices)

Designed so value lands early and the high-risk render work is last. Additive, flag-gated, staging/local first.

- **S0 — Architect decisions (this doc §9).** Resolve pricing/unlock, schema-deferral, and scope before code.
- **S1 — Combined room type plumbing (no render change).** Add `"Living & Dining"` to `canonicalRoomTypes` + `normalizeRoomType`; add a `combined` branch to `resolveRoomType`, `roomLanguage`, `roomBlueprintLanguage`, `productRoleLanguage`; add `roomCategoryHints`/`roomProductRoles` union entries + `enhancedRoomRoleKey` + `CatalogFirstRoomType`. Tests only; **single render still works**, just now produces a zoned living+dining concept + union product set. *(Touches the §3.2 files.)*
- **S2 — UI tile + intent capture.** Add the 5th tile (`room-type-selector.tsx`) and store `layoutMode` + per-zone focal points in `design_briefs.structured_json` via the spatial-plan clarifying questions (spatial §6). No schema change.
- **S3 — Zoning design language (FLAGGED, first prompt-affecting slice).** Implement the `combined` design-language module (zoning, circulation, focal-per-zone) as an **additive** language fn slotted into the concept composition (`packages/ai/src/index.ts:341–345`). Prompt-checkable tests. Requires explicit approval (prompt-touching).
- **S4 — Product role union + zone tagging.** Implement the de-duped, scale-arbitrated union role set; tag shopping-list rows by zone for grouping; reuse PM-001 role contracts so the combined set stays class-pure. (Depends on PM-001 §5 contracts.)
- **S5 — Multi-view render (the three views).** Implement the multi-view roadmap for the combined hall: view-plan JSON, consistency summary, hero-then-supporting chained generation, per-view product subsets, render-set metadata in `render_jobs.input_summary` (no schema). New prompt helpers in `packages/prompts` (`multiViewRenderSystem`, `heroRenderViewLanguage`, `supportingViewLanguage`, `renderConsistencyLanguage`, `productSubsetFidelityLanguage`). **Highest risk to image behavior → last, flag-gated.**
- **S6 — Reveal UI + QA.** Present the three views as a coordinated set; add eval/QA (zoning correctness, view consistency, product fidelity per view); capture evidence.

**Parallelism:** S1 ∥ S2; S3/S4 after S1; S5 after S3 (needs zoned concept as anchor). Integrator serializes edits to `interior-design-language.ts`, `product-matching.ts`, `ai/src/index.ts`.

---

## 9. Open questions for the Chief Architect

1. **Pricing / unlock.** Is a combined hall **one** room unlock (currently AED 99/room per the early-traction pricing) or priced differently given it covers two functions + a three-view reveal? This affects model + UI copy. *(Blocking for S0.)*
2. **Render-set schema.** Defer render-set typing to `render_jobs.input_summary` (no migration) for v1, or introduce `final_render_hero` / `final_render_vignette` asset types + render-set columns now? Roadmap recommends "metadata first, columns later." *(Affects S5.)*
3. **Type naming.** "Living & Dining" vs "Living + Dining" vs "Open-Plan Hall" — and do we also need a kitchen-inclusive variant later? *(Affects S1 copy + normalization.)*
4. **Concurrency with PM-001 + spatial work.** S4 depends on PM-001 §5 role contracts; S3 overlaps the spatial plan's S4 concept-language seam. Sequence so the combined hall *reuses* that code rather than forking it. *(Coordination, per architect-coordination convention.)*
5. **Render cost / latency.** Three chained generations ≈ 3× current render cost/time per reveal. Acceptable? Cap views by hall size? *(Affects S5 + pricing.)*
6. **Measurement dependence.** Zoning/scale arbitration (C2/C6) wants reliable dimensions; gate via `fitConfidenceUsePolicy` and warn when measurements are weak. Acceptable to ship with prompt-level zoning when measurements are absent? *(Affects S3/S4.)*

---

## 10. Risks & stop rules (no code yet; carry into implementation)

- **Inconsistent views ("three different rooms").** Mitigated by chained generation + consistency summary + per-view subsets (§7). If drift persists in testing, reduce to **two** views (whole-hall hero + one zone vignette) before shipping more.
- **Two-rooms temptation.** Do **not** model the hall as two `room` records — it fragments concept/products/reveal/pricing. One room, two zones.
- **Cramming a small hall.** If dimensions can't support both zones at full scale, **downgrade supporting pieces and warn** (C6) — never force a full dining set into a tiny living room.
- **Scope creep into broad rewrites.** This is additive plumbing + reuse of two existing roadmaps. **Stop and escalate** if it requires: a DB **schema/enum migration**, a **broad prompt rewrite** (only additive language modules allowed), a **production deploy**, or changing what the AI sourcing returns. Render-set metadata goes in `input_summary` first.
- **Pricing ambiguity blocking UX.** Don't ship the tile until Q1 (pricing) is answered, or the unlock flow will be inconsistent.

---

## 11. Beta-safe minimum scope

If time is short, ship **S0–S2 + S4 only** (combined type plumbing + UI tile + intent + union product set), keeping **today's single render**. This already lets a user **select one combined hall and get a zoned living+dining design with both zones' products** — solving the core "I have one hall" problem. The **three-view reveal (S5)** is the premium layer; gate it behind a flag and enable once view-consistency QA passes. This sequencing delivers the functional win for the beta and treats the multi-view reveal as a fast-follow that reuses the existing roadmap.

---

## Appendix — Key citations (re-verify before editing; line numbers drift)
- `rooms.room_type` is a free string (no enum): `packages/db/src/types.ts:1009, 1019, 1029`.
- Canonical types + normalization: `packages/domain/src/index.ts:18, 26–52`.
- Room-type selector (single-select radios): `apps/web/app/projects/[projectId]/rooms/new/room-type-selector.tsx`.
- Prompt-side room resolver (no combined branch): `packages/prompts/src/interior-design-language.ts:1, 247–277`; language tables `:9–51, 196–220`.
- Product-matching room→role mapping: `packages/domain/src/product-matching.ts:118–146, 148–242, 538–542, 569–599`.
- Catalog-first room types: `packages/domain/src/catalog-first-room-generation.ts:1`.
- Concept-language composition seam: `packages/ai/src/index.ts:341–345`.
- `editableZones` foothold on concept response: `packages/prompts/src/index.ts:131`.
- "Living / Dining" property fixture: `packages/domain/src/measurement-layout-seed.ts:277–278`.
- Multi-view render roadmap: `docs/Design/Ritzy_Multi_View_Render_Roadmap.md` (branch `brand/multi-view-render-roadmap`).
- Combined living+dining zoning rules + `RoomDesignIntent.layoutMode`: `docs/Tracks/v2-commercial/design-intelligence/DESIGN_SPATIAL_RULES_RESEARCH_AND_IMPLEMENTATION_PLAN.md` (§5.2, §5.6, §6).
