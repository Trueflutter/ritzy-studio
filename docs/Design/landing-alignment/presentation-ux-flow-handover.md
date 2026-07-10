# Handover — Presentation UX Flow Rethink

**Author:** Claude session that closed the customer-journey alignment workstream at PR #215 (2026-05-27).
**Audience:** the next instance picking up the presentation-surface UX work.
**Status of the alignment workstream:** **closed.** PR #215 (`0152c1d` on `main`) merged. All 11 customer-journey screens are visually aligned to the landing's editorial spine. This handover covers the *next* problem, surfaced during PR #215's visual review but explicitly held out of scope.

---

## The 30-second orientation

The customer-journey alignment workstream brought 11 screens into editorial alignment with the marketing landing at `/login`. That work is done. But during the final PR's visual review, Sam (founder) walked through the live flow end-to-end and surfaced a **product-strategy / UX-flow problem on the presentation surface** that's distinct from visual polish:

1. **The presentation page's purpose isn't legible to the user.** Sam himself, the founder who built it, couldn't immediately name what the screen was for. His quote: *"the title 'presentation' is somewhat misleading as even i didnt understand what that was for."*
2. **The CTAs compete and read wrong.** In the commerce-locked state, the screen renders both "Generate Render" (the linear next step) AND "Generate Shopping List" (which actually means "unlock retailer links via paywall"). Sam's reaction: *"There should be no generate shopping list CTA on that page. The only CTA should be to generate the render with the new shopping items. That leaves out the noise and keeps it linearly progressing."*
3. **The paywall mechanic is buried.** Real retailer URLs are locked behind commerce, but the user doesn't understand why this screen sits where it does in the flow. The presentation step looks like a detour from link generation when it's actually the conversion gate.

This is a **product-strategy + UX-flow problem**, not a polish problem. It needs design thinking (likely with mockups or copy options), founder product-decision input, and architect routing on which screens are in scope. Don't bundle it into a visual-polish PR.

---

## The current flow vs. what it should communicate

### Current flow (as of 2026-05-27 on `main`)

```
Dashboard
  ↓
Project creation       (N° 03)
  ↓
Room creation          (N° 04)
  ↓
Photos upload          (N° 05)
  ↓
Brief — Style          (N° 08 — legacy ordering, ships first in actual journey)
  ↓
Brief — Inspiration    (N° 09)
  ↓
Brief — Details        (N° 06)
  ↓
Brief — Questions      (N° 07)
  ↓
Concepts               (N° 10)  ← user selects a concept
  ↓
Product Matching       (no Nº; runs sourcing pipeline)
  ↓
Shopping List          (no Nº; user can edit selections — retailer links LOCKED)
  ↓
Presentation           (N° 11)  ← the screen in question
  ├─ commerce-LOCKED state:
  │    • estimated total
  │    • render (generate or rendered)
  │    • "Generate Shopping List" CTA  ← this is the paywall — confusing copy
  │    • design direction + notes (locked-state copy)
  └─ commerce-UNLOCKED state (after paywall):
       • full retailer-grouped shopping list with real URLs
       • "Open retailer" buttons / "product page →" links per item
```

(Journey-counter numbering is internally inconsistent — Details/Questions occupy 06–07 while Style/Inspiration occupy 08–09 even though Style comes first in the actual user encounter order. This was inherited from the workstream's predecessor and Sam approved the numbering on each PR. Flag is in [[feedback-strict-journey-order]] memory. Not for you to fix unless renumbering is part of a larger flow rework.)

### What it should communicate (Sam's intent, paraphrased)

- The user should arrive at the presentation surface and immediately understand: *"this is where I see my room before I buy."*
- A single linear CTA at each state. No competing buttons.
- Clear affordance to change selections (loops back into product-matching / shopping-list editing).
- The paywall step (link unlock) should be **the consequence of approving the render**, not a competing CTA next to it.

---

## Specific observations Sam made during PR #215 review

Quote dump for context, with surface references:

> **"The flow is supposed to help me generate shopping links, so why do we have this here?"** *(when first landing on the locked presentation page)*

> **"There should be no generate shopping list CTA on that page. The only CTA should be to generate the render with the new shopping items. That leaves out the noise and keeps it linearly progressing."**

> **"Also the title 'presentation' is somewhat misleading as even i didnt understand what that was for."**

> **"It should be placed in a way that it lets them know they can see the final room before they go ahead to purchase items, and then have an option to change it."**

That last line is the **most actionable framing** for your work — it gives you the user-facing job-to-be-done for this screen.

---

## Surfaces involved

The rework likely touches more than one file:

1. **`apps/web/app/projects/[projectId]/rooms/[roomId]/presentation/page.tsx`** (post-#215) — the main screen. Currently 647 lines. Renders three states (rendered / in-progress / empty) on the render block, and locked vs. unlocked branches via the `commerceUnlocked` flag from `can_access_room_commerce` RPC.
2. **`apps/web/app/projects/[projectId]/rooms/[roomId]/presentation/unlock-shopping-list-cta.tsx`** — the paywall component currently rendered inside the Estimated Total aside in the locked state when `finalRenderUrl` exists. **Touching this affects commerce flow** — architect routing required.
3. **`apps/web/app/projects/[projectId]/rooms/[roomId]/shopping-list/page.tsx`** — the screen the user navigates FROM into presentation. The "Generate Render" CTA actually lives here (see screenshots from the 2026-05-26 review session — `apps/web/app/projects/[projectId]/rooms/[roomId]/shopping-list/page.tsx` has the GENERATE RENDER button next to the AED estimate). Per the brief, shopping-list is a **no-go zone** — operational, data-dense. But if the flow rework changes where Generate Render lives, scope might necessarily extend to shopping-list. Architect ruling required.
4. **`apps/web/app/projects/[projectId]/rooms/[roomId]/presentation/print-button.tsx`** — print export trigger. Only shown when commerce unlocked. Probably stays put.
5. **`apps/web/app/projects/[projectId]/rooms/[roomId]/presentation/render-refresh.tsx`** — render-job polling. Out of scope unless the flow rework changes how render completion routes the user.
6. **Nav chrome** in `presentation/page.tsx:165–190` — the top-right header has `Studio → Concepts → Shopping List (if unlocked) → Print (if unlocked)`. The "PRESENTATION" button label that Sam saw in the screenshot is in **shopping-list's nav chrome**, pointing back to this page. If "Presentation" gets renamed, this label rename ripples there too.
7. **`apps/web/app/projects/[projectId]/rooms/[roomId]/concepts/page.tsx`** — has nav chrome pointing forward to product-matching / shopping-list / presentation. If presentation is renamed, links here update too.
8. **The journey-counter eyebrow** — `N° 11 — Presentation` is now in the page (PR #215). If "Presentation" is renamed to something like "Your room" or "The reveal" (note: "The reveal" is currently used as the locked-state H1 caption — would need to be reworked if it becomes the eyebrow noun), the eyebrow text changes too.

**Commerce-touching surfaces** (`unlock-shopping-list-cta.tsx`, `commerceUnlocked` flag logic, `can_access_room_commerce` RPC, server actions for unlock) **require architect routing before touching.** The brief explicitly carved payment / Stripe-touching surfaces out of polish-workstream scope: *"Any payment / Stripe-touching surface — operational; not in scope for this alignment work without explicit user direction."*

---

## Open product questions to ask Sam before designing

Don't guess at these. Ask Sam first. Then route to architect with the answers in hand.

1. **What does the screen do (in one sentence the homeowner would write)?**
   - Founder's framing from review: *"they can see the final room before they go ahead to purchase items, and then have an option to change it."*
   - Convert that into a screen-naming candidate. Suggestions to test: `Your room`, `The reveal`, `Final room`, `Room preview`, `Approval`. Sam will have an opinion.

2. **What's the single CTA in each state?**
   - Empty (no render): `Generate render` — clear.
   - Render generating: pending status — no CTA.
   - Render ready, links still locked: ??? — Sam said *"the only CTA should be to generate the render with the new shopping items"*. But if a render already exists, what's the next step? *"Approve and unlock"*? *"Get retailer links"*? *"This is your room"*? — needs founder input.
   - Render ready, links unlocked: probably no primary CTA, just the populated retailer-grouped list with print / share affordances.

3. **Where does "change selected pieces" live?**
   - Currently a quiet link inside the Estimated Total aside ("Change selected pieces →"). Sam's quote implies he wants a clear affordance: *"have an option to change it."* — should this be elevated to a secondary CTA, or stay as a quiet text link?
   - If elevated, it routes back to product-matching or shopping-list — which?

4. **Does the paywall stay on the presentation surface, or move?**
   - Currently `UnlockShoppingListCta` lives inside the Estimated Total aside in the locked state.
   - Should the unlock moment be the consequence of approving the render? E.g. user generates render → sees room → "Approve this room and unlock retailer links" → paywall → unlocked.
   - Or does the paywall move to its own screen entirely?

5. **What's the relationship between Shopping List and Presentation?**
   - Today they're sibling screens; user enters Shopping List first (to review/edit selections), then Presentation (to see the room + unlock).
   - Sam's confusion (*"the flow is supposed to help me generate shopping links, so why do we have this here?"*) suggests the two screens may need to merge, swap order, or be re-narrated.

6. **What should the journey counter be?**
   - Currently `N° 11 — Presentation` (post-#215). If the screen is renamed, the eyebrow text changes. If the screen splits or merges with shopping-list, the journey counter may need rethinking entirely.

---

## What stays out of scope (architect-locked)

Per the brief and the workstream's standing rules:

- **Server actions** (`generateFinalRenderAction`, `groundProductsAction`, `selectConceptAction`, etc.) — not for UI-lane touching.
- **Render polling logic / job state machine** — owned by another lane.
- **Commerce gating (`can_access_room_commerce` RPC)** — payment-adjacent, architect routing required.
- **Sourcing pipeline / RE-001 timeout work** — separate Resilience Engineer lane; the text-fallback in PR #200 closed the immediate timeout, but the underlying vision-call latency profile is still being characterized.
- **Brief / measurement / catalog data shapes** — domain-owned.
- **Product matching engine** (`productMatchingEngineEnabled` is `false` in current production; catalog-first planner is gated). Don't touch.
- **The shopping-list operational table** (categories, retailer cards, selection checkboxes) — operational, data-dense, no marketing aesthetic per brief.

---

## Workstream artifacts to read before drafting

In the order that loads context fastest:

1. **`docs/Design/landing-alignment/README.md`** — the original alignment brief. Read in full.
2. **PR #215** (`gh pr view 215 --comments`) — the closing PR. The ARCHITECT_NOTE supplemental comment lays out the scope guardrails the architect held throughout. Useful to see the boundary patterns.
3. **PR #175** (`gh pr view 175 --comments`) — the founder-override exemplar. Demonstrates how Sam can override architect no-go-zones via `workflow-founder-override.md` memory pattern. You will probably need to invoke this for presentation flow work, since commerce-touching surfaces are architect no-go.
4. **`apps/web/app/projects/[projectId]/rooms/[roomId]/presentation/page.tsx`** — read the full file. 647 lines. Pay attention to:
   - Lines 65–151: data-fetching + flag computation (`commerceUnlocked`, `finalRenderUrl`, `showShoppingListUnlock`, `canRequestRender`).
   - Lines 195–207: hero header (post-#215 polish).
   - Lines 209–239: Estimated Total aside (post-#215 polish, contains `UnlockShoppingListCta`).
   - Lines 242–290: render block (three states — operational, untouched).
   - Lines 292–305: Design Direction section (post-#215 polish).
   - Lines 307–309: `RetailerPurchaseGroups` rendering (only when commerce unlocked).
   - Lines 311–320: Notes section (post-#215 polish).
5. **`apps/web/app/projects/[projectId]/rooms/[roomId]/shopping-list/page.tsx`** — the screen immediately upstream. Read to understand the relationship.
6. **`packages/ui/src/marketing-panel.tsx` + `marketing-display.tsx`** — primitives now in use on `/presentation`. Important if you touch them.

---

## Memory pointers (auto-loaded)

These are already loaded into the next instance's context via `MEMORY.md`:

- **`feedback-strict-journey-order.md`** — the full 11-screen workstream history. Workstream is marked closed at PR #215. This handover note is referenced from there.
- **`feedback-form-field-chip-pattern.md`** — chip pattern validated across form-step screens. Not directly relevant to presentation but informs the form-tier polish if you end up touching brief-adjacent screens.
- **`feedback-empty-state-pattern.md`** — empty-state pattern for screens with no content yet. Could be relevant if you redesign the locked-state presentation.
- **`feedback-journey-eyebrow-numbering.md`** — N° XX convention. If renaming presentation, the eyebrow changes too.
- **`workflow-architect-coordination.md`** — pre-work routing rule. Critical.
- **`workflow-founder-override.md`** — how Sam can override architect no-go-zones. Likely needed for commerce-touching work.
- **`workflow-auto-commit-hook.md`** — Sam's env auto-commits clean diffs. Sometimes fires, sometimes doesn't. Plan for both.
- **`workflow-ritzy.md`** — branch / staging / commit trailer / PR conventions.
- **`user-collab-style.md`** — Sam wants terse responses, screen-by-screen review, NOT-in-this-PR sections.
- **`pricing-early-traction.md`** — current pricing is AED 99 / room (homeowner) and AED 199 / month (designer). Relevant context for any paywall-adjacent design.
- **`brand-refined-product.md`** — Path B refined-product brand direction.

---

## Recommended first action for the next instance

1. Read this handover end-to-end.
2. Read the alignment brief at `docs/Design/landing-alignment/README.md`.
3. Read PR #215's description + ARCHITECT_NOTE.
4. Skim the memories listed above.
5. **Don't draft a coordination message yet.** Open with a clarifying question turn to Sam first — ask the 6 open product questions above (or a tight subset of them). Sam moves fast and corrects directly; this is a product-strategy decision that needs his framing, not your guess. Once you have answers, *then* draft the architect coordination message for the first slice of work.
6. **Likely first slice (subject to Sam's product answers):** rename the screen + remove the `UnlockShoppingListCta` from the Estimated Total aside in the locked state. That's two small changes — one cosmetic (eyebrow + nav-chrome labels), one structural (CTA placement). Both are reversible. The paywall-relocation question is the next slice after that.

---

## Tone + style notes

- Sam reviews UI hands-on, screen by screen. Don't batch screens.
- Terse responses. NOT-in-this-PR sections in every PR body.
- Walk the user encounter order, never skip ahead.
- When in doubt on a product decision, route to Sam rather than guessing.
- When in doubt on architecture boundaries, route to Chief Architect rather than guessing.
- Hardware: dev server runs on a free port (PR #215 used :3045). Worktree pattern: `git worktree add -b <branch> ../ritzy-studio-<slug> origin/main && cp .env.local ../ritzy-studio-<slug>/`.

Welcome aboard. The presentation flow rework is real product work — not visual polish. Give it the thinking pass it deserves.
