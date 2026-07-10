# PM-001 — Product Matching Recommendation Engine Repair Plan

**Status:** Planning artifact. Source of truth for the repair effort. No code in this document is to be merged; it describes intended work.
**Author:** Claude (planning agent)
**Date:** 2026-06-01
**Target beta:** Wednesday 2026-06-03 operational beta
**Trigger:** Sam's local test after PR #286 still fails recommendation-quality expectations.
**Blocking:** PM-001 rollout is blocked pending this plan and the implementation route it defines.

> **How to use this document.** A fresh Codex chat should treat sections 1–4 as the diagnosis (already grounded in repo code, with file:line citations), and sections 5–11 as the executable plan. The Chief Architect/Integrator sub-agent owns sequencing; the named workstream agents own slices. Every file path and line number below was read on branch `codex/measurement-seed-row-adapters-pr-g` and should be re-confirmed before editing — line numbers drift.

---

## 0. Hard constraints (do not violate)

These are fixed for this repair. They override any "better idea" an implementing agent has.

- **No live catalog writes.** No re-ingestion, no mutation of stored `products` rows.
- **No production deploys.** Staging / local only.
- **No DB schema or generated-type changes.** `packages/db/src/types.ts` is frozen. All new signals must be **derived at match time** in the domain layer from fields already present on the candidate (`name`, `categoryNormalized`, `color`, `material`, `styleTags`, `colorTags`, `materialTags`, `roomTags`, price, availability, dimensions).
- **No broad Product Matching rewrite without staging.** Work proceeds in small, reviewable PR slices behind the existing role-scoped engine flag.
- **No prompt/runtime image-generation behavior changes.** Do not retune the grounded-render or concept prompts. (The sourcing-selection prompt in `packages/prompts/src/index.ts` may receive *additive* role-contract context only if a slice explicitly calls for it — but the default route is to fix the app-side candidate pools, not the prompt.)
- **No live app execution / controlled preview as part of implementation.** Verification is unit/fixture tests plus a manual QA pass that Sam runs.
- **Pre-work blocker:** `apps/web/app/actions.ts` and `packages/ai/src/index.ts` are currently in an **unmerged (`UU`) conflict state** (e.g. conflict marker `>>>>>>> 34101ee` around `packages/ai/src/index.ts:258`), and `packages/ai/src/product-sourcing-payload.test.ts` is `DU`. These conflicts must be resolved/cleared via the Chief Architect **before** any ranking work lands, or slices will not build. Treat as Slice S0.

---

## 1. Problem statement (Sam's test, concretely)

After PR #286 the engine still produces recommendation sets with the following observed failures:

| # | Observed failure | Plain-English description (Sam) |
|---|------------------|---------------------------------|
| P1 | **Sofa role mixes normal 2-seaters with long L-shaped/modular sofas** for the same role, with no size/silhouette discipline. | Wrong scale mixed into one role. |
| P2 | **Armchair role includes obvious office/task furniture**, not lounge/living armchairs. | Category doesn't match — a study chair recommended as an armchair. |
| P3 | **A single cushion keeps recurring** in recommendation sets where furniture should appear. | Same item over-recommended; decor crowding furniture. |
| P4 | **Coffee-table role repeats a tiny subset** despite thousands of coffee tables available, and includes an obvious office table. | "The same ones keep getting recommended first regardless of room type," plus wrong class. |
| P5 | **A bathroom mirror appears in a living-room/decor set.** | Category doesn't match — bathroom item in a living room. |
| P6 | **Aesthetic quality is not considered** when ranking. | Two pieces of very different design quality rank identically. |
| X | **Cross-cutting requirement:** the system needs regular diversity, but **diversity must never override correct furniture class.** | Variety is good; wrong category is never acceptable. |

PR #286 added a **narrow catalogue-variety fix** that prefers distinct product-family signatures for early option slots (`diversitySignature` / `diverseRoleMatches`, see §2.5). It helped only at the product-family *repetition* layer (a slice of P4). The deeper failures — taxonomy/class correctness (P1, P2, P4, P5), ranking eligibility and aesthetic signal (P4, P6), and diversity that respects class (X) — are untouched.

---

## 2. How the engine actually works today (grounded code map)

The live PM-001 route is the **role-scoped** engine. Data flows:

```
Ingestion → category_normalized (brittle)        packages/ingestion/src/normalization.ts
   ↓
Room generation → role specs                     packages/domain/src/catalog-first-room-generation.ts
   ↓                                              → catalog-first-product-matching.ts (catalogFirstRolesToProductMatchingSpecs)
Per-role candidate pools (filter→score→cap→diversity)   packages/domain/src/product-matching.ts
   ↓
Role pools handed to AI sourcing for selection    packages/ai/src/index.ts  (roleCandidatePools)
   ↓
Shopping list rows + UI                           apps/web/.../product-matching/page.tsx
```

### 2.1 Category assignment (ingestion) — `packages/ingestion/src/normalization.ts`

- `normalizeCategory(value)` (lines **165–178**) lowercases the retailer string and returns the **first substring hit** from a hardcoded `categoryMap` of ~77 entries (lines **23–97**). First-match-wins, no specificity ranking, no tie-break.
- Fallback is the product **name** when retailer category is absent: `normalizeCategory(parsed.retailerCategory ?? parsed.name)` (line **116**).
- `room_tags` and `style_tags` are **always emitted as `[]`** (lines **124–125**) — room context is discarded even when the retailer URL/category carried it.
- `"mirror" → "mirrors"` (line **91**), `"floor mirror"/"wall mirror" → "mirrors"` (lines **82–84**). A *bathroom* mirror normalizes to the same `"mirrors"` with no room marker. **This is the seed of P5.**
- Because matching is substring + first-hit, an office/task chair whose retailer category or name contains "armchair"/"accent chair"/"chair" can land in `"armchairs"` or `"chairs"`. **This is a seed of P2.**

**The `categoryMap` is the de-facto canonical taxonomy** — but it is an inline `Map`, not an exported enum/type/table. It is invisible to the domain layer, untyped, unversioned, and untestable in isolation.

### 2.2 Role specs and room→category eligibility — `packages/domain/src/product-matching.ts`

- `RoomProductRole` / `EnhancedRoomProductRole` types (lines **54–68**): `{ category, label, quantity, required, visualBrief?, importance, includeWhen }`. **No `allowedCategories`, no `disallowedClasses`, no size/silhouette constraint.**
- `roomProductRoles` / `enhancedRoomProductRoles` tables (lines **148–242**) define roles per room. Living room includes `mirrors` (line **194**), `decor` qty 2 (line **196**).
- `roomCategoryHints` (lines **118–146**) is the eligibility allow-list per room. **Living includes `"mirrors"` (line 128).** Bathroom is `["mirrors","lighting","decor"]` (line 143). Because a bathroom mirror is `categoryNormalized="mirrors"`, it satisfies the living-room allow-list. **This is the mechanical cause of P5.**
- `categoriesForRoom(roomType)` (lines **538–542**) substring-matches roomType to the hints table.

### 2.3 Eligibility filter — `isEligibleCandidate()` (lines **258–286**)

Hard gates, in order: must have `primaryImageUrl`; **`categoryNormalized` must be in `preferredCategories`** (the room hint list); must not be out-of-stock; must be within `budgetMaxAed`. **There is no role-level class purity check and no room-applicability check beyond the coarse room hint list.** A wrong-class item that shares a normalized category with a legitimate role passes this filter unchallenged.

### 2.4 Role pool construction, scoring, caps — `buildRolePool()` (lines **1015–1063**), `buildRoleScopedCandidatePools()` (line **868**)

- `categoriesForScopedRole(role)` (lines **1365–1379**) and `categoriesForRole(category)` (lines **1350–1363**) define the **accepted categories per role**. Today the only expansions are: `chairs` → also `armchairs` (unless role text says "dining"); `office_chairs` → also `chairs` + `armchairs`. **These expansions are one-directional and ad-hoc.** Note the `office_chairs → armchairs` edge means an office task-chair role pool can legitimately pull lounge armchairs; combined with §2.1 misnormalization, the class boundary between task and lounge seating is porous in both directions. **Contributes to P2.**
- Scoring:
  - `scoreCandidate()` global (lines **472–536**): category fit +28, concept/tag matches up to +32, primary image +8, budget ±12, in-stock +8, dimension fit +8. **No aesthetic/quality term.**
  - `scoreProductCandidateForRole()` (lines **1105–1197**): category +48 exact / +12 fallback / **−48 wrong**; color ±; material ±; style up to +24; silhouette ±14; `roleFit` keyword (`roleSpecificKeywordScore`, lines **1199–1239**). The keyword rules only special-case **dining chairs** (penalize bulky/lounge, lines 1205–1213) and **storage/media** (lines 1216–1235). **There is no rule penalizing office/task language in an armchair role, no rule penalizing office/desk tables in a coffee-table role, and no size-class rule for sofas.** **Directly explains P1, P2, P4-class.**
  - **No aesthetic/design-quality signal anywhere.** Two sofas with identical tags score identically regardless of design quality. **This is P6.**
- Deterministic ordering: sort by score desc, then **index tie-break offset** `score - index*0.001` (lines **1051–1053**, mirrored at **254–255**). Identical-scoring candidates resolve to a **fixed, repeatable order** — the same items surface first every run. **Core of P4 ("same ones first regardless of room type").**
- **Hard cap** `.slice(0, candidatesPerRole)` with default **8** (lines **875**, **1052**). Only the top 8 of thousands ever reach selection/diversity. If the top 8 collapse to a few families, the visible set is tiny. **Core of P4.**

### 2.5 Diversity — `composeRoomProductOptions()` (line **806**), `diverseRoleMatches()` (lines **1298–1339**), `diversitySignature()` (lines **1341–1348**)

- `diversitySignature(match)` = `category : priceBand : colorTags[0] : materialTags[0]`. **Uses only the first color/material tag** and has **no silhouette or size dimension**. A 2-seater and an L-shaped sectional with the same category/price/first-color/first-material collapse to the **same** signature *(so PR #286 can't separate them)* — and conversely two genuinely different items with the same first tags are wrongly treated as identical. **Explains why P1 survived #286.**
- Diversity is enforced **only for the first 3 picks** (`selected.length < Math.min(limit, 3)`, lines **1314–1315**); after that, and in the second fill pass (lines 1326–1336), duplicates are allowed. **Soft, shallow, late.**
- Diversity runs **after** category-acceptance filtering (line **830**), so it cannot pull a wrong *normalized category* in — but it operates within accepted categories that are themselves too broad (§2.2/§2.4), and it has no notion of class/size purity. **Diversity currently can promote a uniquely-signed but wrong-size/wrong-class item over a correct one** — the exact thing constraint X forbids.

### 2.6 Evals & evidence — `packages/domain/src/product-matching-evals.ts`, `-evidence.ts`, `-pool-quality.ts`, `-pool-diversity.ts`, `-pool-qa-rollup.ts`

- `runProductMatchingEvalScenario(...)` (lines **115–141**) returns a scorecard with `categoryCorrectness`, `colorFidelity`, `materialFidelity`, `quantityCorrectness`, `priceStockTrust`, `roleCoverage`, `overallTrust` (`buildEvalScorecard`, lines **247–279**). **`categoryCorrectness` measures dimension-fit, not class purity** — it does not assert "no office chair in an armchair role."
- Pool quality (`summarizeRolePoolQuality`, `WEAK_TOP_ATTRIBUTE_TOTAL=35`) and pool diversity (`summarizeRolePoolDiversity`, narrow/balanced/scattered) and the rollup (`summarizePoolQaRollup`, `manualReviewSuggested`) are **diagnostic only** — they report, they do not gate or filter.
- **Explicitly deferred** (line **277**): `"style/silhouette visual fidelity"`. So the one signal that would catch P1/P6 is not scored.
- **No room-role regression cases**; no disallowed-class assertions; no "diversity did not violate class" assertion. **This is the validation gap.**
- 8 hardcoded eval scenarios (lines **309–754**) cover color preference, media console, dining-chair-rejects-bulky, sideboard, bedroom roles, home-office multi-role. None assert mirror room-appropriateness, sofa size purity, coffee-table class purity, or office-chair exclusion from armchairs.

### 2.7 UI / evidence surface — `apps/web/app/projects/[projectId]/rooms/[roomId]/product-matching/page.tsx`

Per-item cards already render `selection_reason`, `dimension_fit_note`, normalized category, retailer, price, availability, dimensions. **There is no surfaced signal for class-purity rejections, room-applicability, pool thinness, or "why this item over a repeated one."** Evidence for the fixes will need a place to live (see §5 S6 and §9).

---

## 3. Root causes, by layer

### 3.1 Catalog taxonomy / data quality
- **R1.** `normalizeCategory` is first-substring-wins over an untyped inline map → mis-assigned classes (task chair → armchairs; office table → coffee/tables family). (`normalization.ts:165–178`, map `23–97`.)
- **R2.** Room context is **destroyed at ingest** (`room_tags=[]`, `style_tags=[]`, `normalization.ts:124–125`). A bathroom mirror is indistinguishable from a decorative living-room mirror downstream.
- **R3.** No canonical, typed, versioned category vocabulary the domain layer can reason about.
- *Constraint reminder:* we **cannot** re-ingest or change schema. The fix for R1/R2 must be a **match-time re-derivation** from `name` + `categoryNormalized` (and any present tags), not an ingestion rewrite.

### 3.2 Role-to-category mapping
- **R4.** `roomCategoryHints` lets `mirrors`/`decor` be room-ambiguous (living + bathroom + dining all accept `mirrors`). (`product-matching.ts:118–146`.)
- **R5.** `categoriesForRole` / `categoriesForScopedRole` expansions are ad-hoc and porous (office_chairs↔armchairs↔chairs). (`product-matching.ts:1350–1379`.)
- **R6.** Role specs carry no `disallowedClasses` and no size/silhouette contract. (`product-matching.ts:54–68`.)

### 3.3 Candidate eligibility filters
- **R7.** `isEligibleCandidate` only checks image + room-category-membership + stock + budget. No class-purity, no room-applicability hard gate. (`product-matching.ts:258–286`.)

### 3.4 Ranking / scoring
- **R8.** Deterministic score + `index*0.001` tie-break → identical sets surface first every run, room-independent within a category. (`1051–1053`, `254–255`.)
- **R9.** Hard cap of 8 candidates/role collapses huge pools to a tiny visible subset. (`875`, `1052`.)
- **R10.** No aesthetic/design-quality term in either scorer → P6; commodity and curated pieces tie. (`472–536`, `1105–1197`.)
- **R11.** `roleSpecificKeywordScore` only special-cases dining chairs and media storage — no negative signal for office/task language in lounge/coffee roles. (`1199–1239`.)

### 3.5 Diversity logic
- **R12.** `diversitySignature` ignores silhouette/size and uses only first color/material tag → 2-seater vs sectional collide; near-dupes leak. (`1341–1348`.)
- **R13.** Diversity enforced only for first 3 slots, applied late, soft. (`1314–1336`.)
- **R14.** No guarantee that the diversity step preserves class/size purity (violates constraint X). 

### 3.6 Validation / evaluation gaps
- **R15.** No class-purity, room-appropriateness, or size-purity assertions in evals; visual fidelity deferred. No room-role regression fixtures. (`product-matching-evals.ts`.)

### 3.7 UI / evidence gaps
- **R16.** No surfaced reason for class rejection, room mismatch, pool thinness, or repetition — making manual QA of the fix hard to evidence. (`product-matching/page.tsx`.)

---

## 4. Files to inspect / likely modify

| File | Role in repair | Likely change |
|------|----------------|---------------|
| `packages/domain/src/product-matching.ts` | Core engine: types, eligibility, scoring, pools, diversity | **Primary.** New role-contract types; hard class/room filters; size-class derivation; aesthetic term; diversity signature + ordering fixes; widen cap. |
| `packages/domain/src/catalog-first-room-generation.ts` | Produces `RoomBundleRole` | Map contract fields (disallowed classes, size class) onto generated roles. |
| `packages/domain/src/catalog-first-product-matching.ts` | `catalogFirstRolesToProductMatchingSpecs` (lines 4–15) | Carry new contract fields through to `RoomProductRoleSpec`. |
| `packages/domain/src/product-matching-pool-diversity.ts` / `-pool-quality.ts` / `-pool-qa-rollup.ts` | Diagnostics | Add class-purity + room-applicability diagnostics; surface "diversity-safe" flag. |
| `packages/domain/src/product-matching-evals.ts` | Eval harness | Add class-purity / room-appropriateness / size-purity / diversity-safety assertions + new scenarios. |
| `packages/domain/src/product-matching-evidence.ts` | Evidence completeness | Add room/class-signal evidence points. |
| `packages/domain/src/index.ts` | Barrel exports | Export new contract types / canonical taxonomy. |
| `packages/ingestion/src/normalization.ts` | **Read-only for diagnosis** (audit only; no re-ingest) | Reference for the canonical vocabulary; **do not** change ingest behavior in this effort. |
| `packages/prompts/src/index.ts` | Sourcing prompt (lines 230–241) | **Only if a slice explicitly approves** additive role-contract context. Default: untouched. |
| `apps/web/app/projects/[projectId]/rooms/[roomId]/product-matching/page.tsx` | UI/evidence | Surface class/room/thin-pool reasons (read-only display, additive). |
| `apps/web/app/actions.ts`, `packages/ai/src/index.ts`, `packages/ai/src/product-sourcing-payload.test.ts` | **Conflict (S0)** | Resolve merge conflict first. |
| New: `packages/domain/src/__fixtures__/` or `*.test.ts` | Regression fixtures | Room-role regression cases. |

---

## 5. Recommended architecture

The repair is a layered filter: **hard class/room purity first, then soft quality+diversity re-rank, then explicit thin-pool fallback.** Diversity is always *subordinate* to class purity (constraint X).

### 5.1 Role contracts (typed, centralized)
Extend `RoomProductRoleSpec` / `RoomProductRole` with optional, additive fields:

```ts
type RoleClassContract = {
  allowedCategories: CanonicalCategory[];      // hard allow-list, replaces ad-hoc categoriesForRole expansions
  disallowedClasses: ClassTag[];               // hard deny-list (e.g. armchairs role denies "office","task","desk")
  sizeClass?: "compact" | "standard" | "large" | "any"; // e.g. sofa role can require "2-3 seat" vs allow sectional
  roomScope?: RoomScope;                        // for room-ambiguous categories (mirrors, decor)
};
```
Centralize per-role contracts in **one typed table** keyed by `(roomKey, roleCategory)`, replacing the scattered `categoriesForRole` / `categoriesForScopedRole` / `roomCategoryHints` logic. The existing functions become thin lookups into this table. Keep them additive/back-compatible (default contract = today's behavior) so the flag can gate.

### 5.2 Disallowed classes per role (hard)
A **class tag** is derived at match time from `name` + `categoryNormalized` tokens (no schema change). Examples:
- `armchairs` role → `disallowedClasses: ["office","task","desk","ergonomic","gaming","study"]`.
- `coffee_tables` role → `disallowedClasses: ["office","desk","dining","workstation","study"]`.
- `sofas` role → size discipline via `sizeClass`, not a class deny (see 5.4).
A candidate whose derived class tags intersect a role's `disallowedClasses` is **filtered out before scoring** (hard), not penalized.

### 5.3 Product-family diversity (subordinate to class)
- Rebuild `diversitySignature` to include a **silhouette/size token** and use **full** color/material tag sets (sorted-joined), not `[0]`.
- Apply diversity **across all option slots**, not just the first 3, as a **re-rank within the already-class-pure pool** — never as a gate that can admit a wrong-class/size item.
- Keep a deterministic but **diversity-aware ordering**: replace the pure `index*0.001` lock with a stable round-robin over distinct families so large pools rotate rather than always showing the same top-N.

### 5.4 Room-type-sensitive eligibility
- For **room-ambiguous categories** (`mirrors`, `decor`, `lighting`, `wall_art`), require a `roomScope` check: derive a room-applicability signal at match time from `name`/tokens (e.g. "bathroom","vanity","ensuite" ⇒ bathroom-scoped) and **hard-exclude** bathroom-scoped mirrors from living/dining sets. Default-allow when no room signal is present (don't over-filter).
- For **sofas**, derive a size class from name/dimensions ("2 seater","loveseat" ⇒ compact/standard; "l-shaped","sectional","modular","corner","u-shaped" ⇒ large). Enforce the role's `sizeClass`: if a role is "anchor 2–3 seat sofa," sectionals are out (or placed in a separate role) — do not mix scales in one role (P1).

### 5.5 Hard filters vs soft penalties
- **Hard (filter before scoring):** wrong `allowedCategories`; matched `disallowedClasses`; room-scope conflict; out-of-room size class; out-of-stock; over-budget; no image. (Extends `isEligibleCandidate` + role-pool construction.)
- **Soft (scoring re-rank within the eligible set):** color/material/style fidelity, **aesthetic/design-quality term** (new — see below), price tier, dimension fit, diversity rotation.
- **Aesthetic/quality term (R10/P6):** a transparent, deterministic heuristic from available fields only — e.g. style-tag richness, presence/quality of `primaryImageUrl`, material "premium" family hits, retailer trust weighting, completeness of evidence. **No new model call, no schema field.** Documented and unit-tested so QA can reason about it.

### 5.6 Fallback when pools are thin (explicit)
- Reuse `summarizeRolePoolQuality` statuses. When a class-pure pool is `empty`/`thin`, **do not** backfill with wrong-class items and **do not** silently repeat one item to fill slots. Instead:
  - return fewer options with an explicit `thin_pool` / `no_eligible_candidate` reason on the role,
  - surface it in evidence + UI (R16),
  - let `poolQaRollup.manualReviewSuggested` flag the room.
- Repetition cap: a single `product_id` (and a single tight family signature) may appear **at most once per role set**; never as filler.

---

## 6. Staged implementation sequence (small PR slices)

Each slice is independently reviewable, behind the existing role-scoped engine flag where behavior changes, and lands with tests. Order matters.

- **S0 — Unblock build (conflict resolution).** Resolve the `UU`/`DU` merge conflicts in `apps/web/app/actions.ts`, `packages/ai/src/index.ts`, `packages/ai/src/product-sourcing-payload.test.ts`. No behavior change; just make the tree build/lint/typecheck clean. *Owner: Integrator.*
- **S1 — Taxonomy/data audit (read-only).** Sample current `categoryNormalized` distribution and known mis-mappings using fixtures only (no DB writes). Produce an audit doc + a candidate **canonical category list** + a **class-tag dictionary** (which name tokens imply office/task/desk/dining/sectional/bathroom). *Owner: Taxonomy/Data Audit Agent.* Output: doc under `docs/Tracks/v2-commercial/product-matching-evals/`.
- **S2 — Canonical taxonomy + role-contract types (pure domain, no behavior).** Introduce `CanonicalCategory`, `ClassTag`, `RoomScope`, `RoleClassContract` types and the centralized contract table in `product-matching.ts` (+ exports). Default contracts reproduce today's behavior. Add match-time derivation helpers (`deriveClassTags`, `deriveSizeClass`, `deriveRoomScope`) with unit tests. **No filtering wired in yet.** *Owner: Role Contract Agent.*
- **S3 — Hard eligibility filters (flagged).** Wire `disallowedClasses` + `roomScope` + `allowedCategories` contract into `isEligibleCandidate` and role-pool construction; retire the ad-hoc `categoriesForRole`/`categoriesForScopedRole` expansions in favor of the contract table. Land P2 (armchair excludes office), P5 (bathroom mirror excluded from living), and coffee-table class purity. *Owner: Role Contract Agent.*
- **S4 — Size discipline for sofas + size-aware diversity signature.** Add `sizeClass` enforcement (P1) and rebuild `diversitySignature` (silhouette/size + full tags) and diversity rotation across all slots (P3/P4 family repetition). *Owner: Ranking/Diversity Agent.*
- **S5 — Ranking widening + aesthetic term.** Raise/parametrize the per-role cap (R9), replace the pure index tie-break with diversity-aware rotation (R8), add the aesthetic/quality soft term (R10/P6). *Owner: Ranking/Diversity Agent.*
- **S6 — Eval harness + regression fixtures.** Add class-purity, room-appropriateness, size-purity, and diversity-safety assertions to `product-matching-evals.ts`; add room-role regression scenarios (mirror, sofa-size, armchair-vs-office, coffee-vs-office, cushion-repeat). Add UI/evidence surfacing of new reasons. *Owner: Eval Harness Agent + QA Evidence Agent.*
- **S7 — QA evidence run + decision doc.** Sam runs the local manual QA pass; capture evidence per the established convention; record rollout decision. *Owner: QA Evidence Agent + Integrator.*

Slices may be parallelized where they don't collide (S1 data audit ∥ S2 types). S3–S5 are sequential on `product-matching.ts`. The Integrator serializes merges into `product-matching.ts` to avoid conflicts.

---

## 7. Suggested sub-agent workstreams (one Codex chat)

| Agent | Mandate | Primary files | Done when |
|-------|---------|---------------|-----------|
| **Chief Architect / Integrator** | Owns sequencing, the flag, merge order into `product-matching.ts`, S0 conflict resolution, and the final decision doc. Routes file ownership so two agents never edit the same hunk. | all | All slices merged green; decision recorded. |
| **Taxonomy / Data Audit Agent** | S1: produce canonical category list + class-tag dictionary + room-scope token dictionary from fixtures and `normalization.ts` map (read-only). No ingest changes. | `normalization.ts` (read), fixtures, audit doc | Dictionaries reviewed; feed S2. |
| **Role Contract Agent** | S2–S3: contract types, centralized contract table, match-time derivation helpers, hard filters. | `product-matching.ts`, `catalog-first-product-matching.ts`, `catalog-first-room-generation.ts`, `index.ts` | P2, P5, coffee-class pass in evals. |
| **Ranking / Diversity Agent** | S4–S5: size discipline, diversity signature/rotation, cap widening, aesthetic term. | `product-matching.ts`, `-pool-diversity.ts`, `-pool-quality.ts` | P1, P3, P4, P6 pass in evals. |
| **Eval Harness Agent** | S6: new assertions + regression scenarios; keep existing 8 scenarios green. | `product-matching-evals.ts`, `*.test.ts`, fixtures | Regression suite red→green proves each fix. |
| **QA Evidence Agent** | S6–S7: UI/evidence surfacing; assemble manual QA checklist + evidence doc per convention. | `product-matching/page.tsx`, evidence docs | Evidence artifacts captured; decision doc drafted. |

---

## 8. Acceptance criteria for beta

A build is beta-eligible only when **all** hold, demonstrated by automated evals **and** the manual QA pass:

1. **Sofa size purity (P1):** A sofa role does not mix 2-seaters with L-shaped/modular/sectional pieces unless the role contract's `sizeClass` explicitly allows `large`. Mixed-scale sets fail the eval.
2. **Armchair class purity (P2):** Armchair roles contain **zero** office/task/ergonomic/desk/gaming/study chairs. Derived class tags intersecting the deny-list are filtered pre-scoring.
3. **Coffee-table class purity (P4):** Coffee-table roles exclude office tables, desks, workstations, and dining tables.
4. **Mirror room-appropriateness (P5):** Bathroom/vanity-scoped mirrors never appear in living/dining/bedroom decor sets; room-ambiguous categories respect `roomScope`.
5. **Product-family repetition bounded (P3/P4):** No single `product_id` repeats within a role set; tight family signatures are limited; large pools rotate (the same top-N do not appear identically every run). The recurring-cushion case is gone.
6. **Diversity never overrides class (X):** Every diversity-promoted option passes the same hard class/room/size gates — proven by a "diversity-safety" assertion.
7. **Aesthetic signal present (P6):** Ranking includes the documented aesthetic/quality term; a fixture pair (commodity vs curated, otherwise identical) ranks the curated piece higher.
8. **Explicit thin-pool behavior:** When a class-pure pool is genuinely thin/empty, the engine returns fewer options with an explicit reason and flags `manualReviewSuggested` — it does **not** backfill wrong-class items or repeat to fill slots.
9. **No regressions:** All 8 existing eval scenarios remain green; lint + typecheck clean (`./node_modules/.bin/tsc -p tsconfig.json --noEmit`, `./node_modules/.bin/eslint .` from `apps/web`, plus domain package checks).

---

## 9. Proposed tests / evals

**Unit tests (`packages/domain/src/*.test.ts`):**
- `deriveClassTags` — task/office/desk/dining/sectional/bathroom token coverage incl. tricky names ("Executive Lounge Chair", "L-Shaped Corner Sofa", "Vanity Mirror", "Office Coffee Bar").
- `deriveSizeClass` — 2-seater vs sectional vs modular vs loveseat.
- `deriveRoomScope` — bathroom/vanity vs decorative.
- Contract filter — armchair role rejects office chair; coffee role rejects desk; living role rejects bathroom mirror.
- Diversity signature — 2-seater and sectional get distinct signatures; near-duplicate fabric variants don't collapse on first-tag.
- Aesthetic term — curated > commodity on otherwise-identical fixtures.
- Thin-pool — empty/thin pure pool yields explicit reason, no wrong-class backfill.

**Fixture-based catalog tests:** synthetic catalog fixtures (extend `catalog-first-dry-run-fixtures.ts` patterns) containing deliberate traps: a bathroom mirror, an office task chair tagged "armchair-ish," an office table near coffee tables, a single attractive cushion, a sectional + several 2-seaters, and a large coffee-table pool. Assert each trap is handled.

**Room-role regression cases (the heart of S6):**
- Living room: no bathroom mirror; no office chair in armchair; no office table in coffee; cushion not repeated; sofa role not mixing scales; large coffee pool rotates.
- Bedroom / dining / office / bathroom: mirror/scope correctness; dining-chair-not-lounge (existing) still green.

**Local / manual QA checklist (Sam runs):**
- For each room type: open the product-matching set and confirm criteria 1–8 by eye; capture screenshots.
- Specifically re-run the exact scenario from Sam's failing test and confirm each P1–P6 is resolved.
- Confirm thin-pool rooms show the explicit reason rather than wrong-class filler.

**Evidence artifacts to capture (per existing convention, see `manual-qa/2026-05-23-product-matching-engine-v1-evidence.md`):**
- Run details (date, branch, flag value, DB-writes=none, catalog/AI stats).
- Per-room role table: role | product id | class-purity | room-scope | size-class | diversity-safe | evidence completeness | notes.
- Before/after screenshots for the six failure modes.
- `poolQaRollup` output showing thin-pool flags.
- Decision section (beta go/no-go, follow-ups, architect sign-off).

---

## 10. Risks & stop rules

**Risks:**
- **Over-filtering thin pools.** Aggressive room-scope/size hard filters could empty legitimate pools (e.g. a catalog with few true 2-seaters). Mitigate: default-allow when no signal; lean on explicit thin-pool fallback, not silent exclusion.
- **Class-tag false positives.** Token heuristics can mis-tag (e.g. "office" in a product description that's actually a lounge chair "for the home office"). Mitigate: prefer name + category tokens over free description; unit-test tricky names; keep the dictionary reviewable (S1 output).
- **Determinism vs rotation.** Diversity rotation must remain deterministic for reproducible QA — no `Math.random`. Use a stable family round-robin.
- **`product-matching.ts` merge churn.** S3–S5 all touch it; the Integrator must serialize.
- **Scope creep into ingestion.** Tempting to "just fix the map." Forbidden here (no re-ingest/schema). All correctness lives at match time.

**Stop rules (halt and escalate to Chief Architect / Sam):**
- Any change would require a DB/schema/generated-type edit, re-ingestion, or a prompt/runtime image-generation behavior change → **stop**.
- A hard filter drops a required role below viable options across multiple test rooms → **stop**, reconsider as soft penalty + thin-pool reason.
- Existing 8 eval scenarios go red and can't be restored without weakening a new criterion → **stop**.
- The fix cannot be demonstrated green by **EOD Tuesday 2026-06-02** → **stop and ship a reduced scope** (criteria 2, 3, 4, 5, 8 — the class/room purity + thin-pool fallback — are the minimum viable beta; P1 size discipline and P6 aesthetic term may defer if necessary, recorded explicitly).

---

## 11. What should NOT be attempted before beta

- Re-ingesting the catalog or "fixing" `normalization.ts` mappings at write time.
- Any DB schema / generated-type change (e.g. adding a real `room_tags` population, a `class` column, a taxonomy table).
- A full rewrite of `product-matching.ts` or the role-scoped engine.
- Prompt or runtime image-generation behavior changes (grounded-render / concept prompts).
- A learned/embedding-based aesthetic model or any new model call for ranking — the aesthetic term must be a transparent heuristic for this beta.
- Live production deploy or controlled preview as part of implementation; live app execution by an implementing agent.
- Broad UI redesign of the product-matching page — only additive evidence surfacing.

---

## 12. Selected vs Alternate Option Consistency (post-PR #294 finding)

> **Added 2026-06-01** after Sam's latest local QA. This is a **consistency bug, not a new rewrite**: the same role-contract / aesthetic / diversity / room-scope / design-brief discipline that now produces a good *selected* recommendation must apply to **every visible option slot**, not only the preselected one.

### 12.1 New problem statement (concrete)
Recommendation quality improved: the **preselected** item per role is now visually and stylistically aligned with the generated design. But the **two alternates** in the same role often look like the old repeated/generic results.
- **Example:** selected sofa = a **green** sofa aligned with the concept; the two alternate sofas = familiar **grey/white** options that do not carry the same aesthetic logic.
- The alternates read as a *different, weaker* stream than the selected — exactly the symptom of two different code paths feeding the same UI.

### 12.2 Root cause — two streams, grounded in code
Tracing the live grounding action (`apps/web/app/actions.ts`):

1. **The selected anchor is AI/catalogue-grounded.** The role pools handed to the AI come from the role-scoped engine (`buildProductSourcingRuntimePlan` → `sourcingCandidatePools`, `actions.ts:1901,1975`), and the AI returns a chosen product per role (`sourcingResult.roleResults` / `selectedProducts`). The preselect logic at `actions.ts:2269–2287` sets `status:"selected"` to that AI pick **provided it appears in the role's composed options** (`role.options.some(o => o.id === roleResult.productId)`, `:2272`), else the AI `selectedProducts` match (`:2277`), else `role.options[0]` (`:2285`).
2. **But the *visible option set* (selected + alternates) is built by a different, weaker path.** All three slots come from `composeRoomProductOptions({ ranked: visualRanked, roles, optionsPerRole: 6 })` (`actions.ts:2219–2225`), where **`visualRanked` is the GLOBAL ranker** `rankProductMatches(...)` (`actions.ts:2038–2049`) — i.e. the global `scoreCandidate` scorer (`product-matching.ts:472–536`), **not** the role-scoped attribute scorer (`scoreProductCandidateForRole`, `:1105–1197`) that carries the per-role color/material/silhouette **envelope** discipline. So the alternates never get the role-scoped aesthetic gating the selected stream benefited from.
3. **The diversity step actively pushes alternates AWAY from the selected's aesthetic envelope.** Inside `composeRoomProductOptions`, options are ranked by `score + roleVisualAffinity` then passed through `diverseRoleMatches` (`product-matching.ts:837, 1298–1339`), which forces **distinct `diversitySignature`s** across the first 3 slots. `diversitySignature = category : priceBand : colorTags[0] : materialTags[0]` (`:1341–1348`). Because the signature keys on **color/material family**, the selected green sofa forces the next two slots to a **different** color/material — i.e. grey/white. **Diversity here means "different family," not "same design intent, different product family."** This is the mechanical cause of the green-then-grey/white pattern.
4. **Category acceptance uses the OLD ad-hoc expansion, not the PM-001 role contract.** `composeRoomProductOptions` filters via `categoriesForRole` (`:821, 1350–1363`), not the planned scoped contract (`categoriesForScopedRole` / §5 contracts). So alternates can still admit wrong-class items even after the §5 hard filters land — **unless the contract is applied on this path too.**
5. **Reject/replace reveals more of the weak stream.** The "reveal a replacement on reject" paths (`actions.ts:2699, 2848`) also rank with the global `rankProductMatches`, so revealed replacements inherit the same off-envelope behavior. Reserve options are pre-stored (`optionsPerRole: 6`, `:2224`), all from the same weak path.
6. **Row status.** `buildShoppingListItemRows` (`product-matching.ts:1384–1421`) stamps `status:"selected"` for the preselected id and `"option"` for the rest, ordered by `option_rank` — so the UI's "selected vs alternate" distinction is purely which stream-2 item got blessed by stream-1, with no guarantee the alternates share the selected's envelope.

**Summary:** the selected item is (often) the AI's envelope-aligned anchor; the alternates are global-ranked, diversity-pushed-off-envelope, old-expansion-filtered catalogue items. Same role, same UI row group — but **not** the same role-contract / aesthetic / scope discipline.

### 12.3 Required architecture change (consistency, not rewrite)
Apply the §5 discipline to **all** option slots by unifying on one pool + one envelope:

- **R-Alt-1 — One pool for all slots.** Build the visible options from the **same role-scoped pool** the selected anchor was chosen from (the role-scoped candidate pools), not from the global `visualRanked`. Either feed `composeRoomProductOptions` the role-scoped ranked pool, or compose options directly from `RoleScopedCandidatePool`. The selected item must be slot 0 of that same pool, not a separately-sourced injection.
- **R-Alt-2 — Design-intent envelope for alternates.** Derive an **envelope** from the selected item + concept brief: color family, material family, silhouette/size class, room scope, and style direction (reuse the §5 derivation helpers and the role-scoped attribute families, `product-matching.ts:81–103`). Alternates must fall **inside** this envelope (soft-rank strongly toward it; hard-filter only on class/scope/room per §5), unless a deliberate "contrast" reason is set.
- **R-Alt-3 — Diversity *within* the envelope.** Redefine alternate diversity as **"same role, same design intent, different product family"** — vary retailer / product family / secondary detail, **not** the primary color/material family. Concretely: keep the §5.4 silhouette/size in the signature for genuine variety, but **stop using primary color/material family as a diversity axis when an envelope is set** (that axis is what produces grey/white). Diversity becomes meaningful variation *within* the direction, not random category/colour variety.
- **R-Alt-4 — Same hard contracts on this path.** Route `composeRoomProductOptions` (and the reject/replace paths at `actions.ts:2699,2848`) through the §5 role contracts (`categoriesForScopedRole` + `disallowedClasses` + `roomScope` + `sizeClass`), so all three slots pass the same hard gates as the selected.
- **R-Alt-5 — Explicit thin-pool fallback.** When there are not enough high-fit, on-envelope alternates, **surface a thin-pool / manual-review reason** (reuse `summarizeRolePoolQuality` + `poolQaRollup.manualReviewSuggested`, §2.6) on the role and show fewer options — **do not** backfill with off-brief grey/white generics to reach 3.

### 12.4 Acceptance criteria (selected vs alternate)
1. **Same hard contracts:** For each role, **all three** visible options pass the identical §5 role contracts (allowed categories, disallowed classes, room scope, size class).
2. **Shared design-intent envelope:** Alternates share the selected item's envelope — color family, material family, silhouette/scale, room scope, style direction — unless a deliberate `contrast` flag is set.
3. **No stale generics:** Alternates are **not** the old default grey/white/generic products unless the concept actually calls for that direction.
4. **Meaningful in-direction variation:** Diversity produces variation *within* the design direction (different product family/retailer/detail), not random category or off-palette variety.
5. **Thin-pool honesty:** Insufficient high-fit alternates ⇒ explicit thin-pool/manual-review reason, fewer options shown, no off-brief filler.
6. **Evidence:** Before/after screenshots of the **selected + both alternates** for **sofa, armchair, coffee table, mirror/decor, and rug**, showing alternates now sharing the selected's envelope.

### 12.5 Tests / evals (additions to §9)
- **Unit (`product-matching.ts`):** with a green-sofa selected anchor + a mixed catalogue (green / grey / white sofas), `composeRoomProductOptions` (on the unified role-scoped pool) returns alternates **in the green/neutral-compatible envelope**, not grey/white, and varies by product family. Assert the diversity signature no longer keys on primary color/material when an envelope is set.
- **Unit:** all three options for a role pass the §5 hard contracts (armchair role: no office chair in any of the three slots; coffee role: no desk; living mirror: no bathroom mirror).
- **Unit:** thin on-envelope pool ⇒ fewer options + `manualReviewSuggested`, no off-envelope backfill.
- **Fixture/regression:** the exact Sam case (green selected sofa, grey/white alternates) becomes a red→green guardrail.
- **Eval harness (`product-matching-evals.ts`):** add an "option-set envelope consistency" assertion across selected + alternates per role.

### 12.6 Sequencing note
This work **depends on §5–§6** (role contracts + size/envelope derivation + diversity fix) and should land as a slice **between S4 and S5** (after the diversity/ranking fixes exist, before the eval/QA sweep), so the alternate-stream unification reuses the same contract/envelope code rather than duplicating it. It touches `apps/web/app/actions.ts` (option source wiring at `:2038, :2219, :2699, :2848`) and `packages/domain/src/product-matching.ts` (`composeRoomProductOptions`, `diverseRoleMatches`, `diversitySignature`). **Stop rule applies:** if unifying the pool would require changing what the AI sourcing returns or a schema change, stop and escalate — the fix should be confined to which pool feeds the visible options and how alternates are enveloped/diversified.

---

## Appendix A — Key citations (re-verify before editing; line numbers drift)

- Ingestion category map + room-tag loss: `packages/ingestion/src/normalization.ts:23–97,116,124–125,165–178`.
- Role types: `packages/domain/src/product-matching.ts:54–68`.
- Room role tables: `…product-matching.ts:148–242`.
- Room→category eligibility hints: `…product-matching.ts:118–146`; `categoriesForRoom` `538–542`.
- Eligibility filter: `…product-matching.ts:258–286`.
- Accepted-categories expansions: `…product-matching.ts:1350–1379`.
- Global scorer: `…product-matching.ts:472–536`.
- Role attribute scorer: `…product-matching.ts:1105–1197`; role keyword rules `1199–1239`.
- Pool build + cap + index tie-break: `…product-matching.ts:868,875,1015–1063,1051–1053`; mirrored global `246–256`.
- Diversity: `…product-matching.ts:806,1298–1339`; signature `1341–1348`.
- Catalog-first bridge: `packages/domain/src/catalog-first-product-matching.ts:4–15`.
- Sourcing prompt guidance (do not choose sofa for chair role, etc.): `packages/prompts/src/index.ts:230–241`.
- Role candidate pools handed to AI: `packages/ai/src/index.ts` (`roleCandidatePools`, ~798–826; conflict marker ~258).
- Evals scorecard + deferred visual fidelity: `packages/domain/src/product-matching-evals.ts:115–141,247–299` (deferred list `277`).
- Pool quality/diversity/rollup: `product-matching-pool-quality.ts`, `-pool-diversity.ts`, `-pool-qa-rollup.ts`.
- UI evidence surface: `apps/web/app/projects/[projectId]/rooms/[roomId]/product-matching/page.tsx` (item cards ~354–446).
- Evidence doc convention: `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/2026-05-23-product-matching-engine-v1-evidence.md`.
- **Selected vs alternate (§12):** option source = global ranker `apps/web/app/actions.ts:2038–2049` → `composeRoomProductOptions` `:2219–2225`; preselect/anchor merge `:2269–2287`; reject/replace `:2699,:2848`. Compose + diversity `packages/domain/src/product-matching.ts:806–866,1298–1339,1341–1348`; old category expansion `:821,1350–1363`; row status `:1384–1421`; attribute families `:81–103`.
