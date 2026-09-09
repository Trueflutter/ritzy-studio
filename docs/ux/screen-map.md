# Screen Map

Source of truth for screen contracts. Derived from the router on 2026-09-01 (fable/product-pass-plan). Rows marked PLANNED have no route yet; they are approved by the product plan (`_handoffs/PRODUCT_PLAN.md` §9a) and must be built from the named archetype. No UI work may start on a screen without a row here.

Archetype vocabulary: public/landing, dashboard, form-step, detail, list, settings, empty-shell. Design references: the five Quiet Gallery archetypes in `_handoffs/design_handoff_ritzy_elevation/README.md` (1a dashboard, 1b concept review, 1c matching ledger, 1d presentation-on-ink, 1e·1 photos, 1e·2 brief) and the blueprints in `docs/Vision/05_Brand_and_Design_System.md` §19.

| Route | Archetype | User | Job (one line) | Dominant content | Primary action | Secondary actions | States that must exist |
|---|---|---|---|---|---|---|---|
| `/login` | public/landing | visitor | Understand the promise and get in | Hero room imagery | Sign in / create account (one access module) | Anchor nav to sections | error (refusal visible at the form, not below fold), confirm-email notice |
| `/` | dashboard (1a) | both | See my projects and resume the right room | Project cover renders | Open project | Begin a project; filter tabs | empty (no projects), loading, populated |
| `/onboarding` | form-step | new user | Choose how I design today and name the first home, one screen | Two mode cards + one name field (first run) | Pick a mode and continue (project auto-created) | none | returning-user redirect, designer client-name variant |
| `/projects/new` | form-step | both | Name a subsequent home (or client) | Single form card (homeowner: name only; designer: adds client) | Continue | Cancel | validation error (inline, input preserved) |
| `/projects/[p]/rooms/new` | form-step | both | Pick what I am designing | Room-type choices | Continue | Back | designer gate state (plan required), validation |
| `/projects/[p]/rooms/[r]/photos` | form-step (1e·1) | both | Give the app my room | 3-slot contact sheet | Continue to the brief | Remove/replace/reorder photo | empty, uploading, 3-full, upload error |
| `/projects/[p]/rooms/[r]/brief` | redirect | both | n/a (routes to first incomplete step) | n/a | n/a | n/a | n/a |
| `/projects/[p]/rooms/[r]/brief/style` | form-step | both | Say how the room should feel | Style imagery chips + one feeling field | Continue | Back | none-selected error (inline, non-destructive) |
| `/projects/[p]/rooms/[r]/brief/inspiration` | form-step | both | Share references if I have them | Inspiration dropzone | Continue | Skip (equal prominence) | empty-is-fine, upload error |
| `/projects/[p]/rooms/[r]/brief/details` | form-step (1e·2) | both | Answer what I know; accelerators optional | Editorial question list | Continue to concepts | Back; floor-plan upload; measurement fields | saved-values re-render, rejection NEVER wipes input, plan-uploaded state, room-identified state (from whole plan) |
| `/projects/[p]/rooms/[r]/brief/questions/[i]` | form-step | both | Answer one clarifying question | The single question | Continue (Enter must work) | Skip; Back | last-question handoff to generation |
| `/projects/[p]/rooms/[r]/concepts` | detail (1b) | both | Judge the direction; approve or ask for changes | Hero concept render | Proceed to sourcing (spec confirm) | Generate revision; view earlier versions; assumptions link | generating (verbatim §12.2 copy), failed (retry, no simultaneous progress), revision-generating, multi-version |
| `/projects/[p]/rooms/[r]/spec` | detail + ledger (1c pattern) | both | Confirm what the design contains before sourcing | Object ledger (role, qty, size) beside the render | Confirm and source | Edit row; remove object; add note | extraction-running, extraction-failed, edited-dirty |
| `/projects/[p]/rooms/[r]/product-matching` | list/ledger (1c) | both | See the matched pieces and fix what is wrong | The materials ledger | Open shopping list | Swap row; refresh matches; why-this-piece | sourcing-running, missing-role rows (honest, visible), swap drawer |
| `/projects/[p]/rooms/[r]/shopping-list` | list/ledger (1c) | both | Choose final pieces and commit | Category groups with options | Generate final render (pre-pay: category labels only) | Select option; refresh category; unlock CTA when unpaid | pre-pay (category labels, no names/links), post-pay (names+links+PDF), missing-role disclosure |
| `/projects/[p]/rooms/[r]/presentation` | detail (1d, on ink) | both + client-over-shoulder | See the finished room and buy it | Final hero render | Unlock shopping list (unpaid) / Open shopping list (paid) | View planned/requested views; change pieces | render-queued/polling, failed+retry, review-flagged (placement review unresolved or could not run: findings shown, render again), view-left-out (an unverifiable angle omitted, said once), paid vs unpaid; the 12.9 disclaimer beneath every final render |
| `/settings` PLANNED | settings (§9.11) | both | Manage mode, plan, credits, billing | Tabbed sections (Profile / Studio / Billing) | Contextual per section | Switch mode; change plan; buy credit pack | credit balance zero, payment failed, designer-without-plan |
| `/api/stripe/webhook` | system | n/a | Money truth | n/a | n/a | n/a | idempotent, amount+currency validated (do not restyle) |
| `/api/queues/final-render` | system | n/a | Durable render execution | n/a | n/a | n/a | CAS states (do not expose or make synchronous) |

Screen-level notes:
- Mode switch is a header control (segmented, max 3 per §8.4), not a route; it appears on `/` and `/settings` for accounts with both contexts. Its states: homeowner-active, designer-active, switch-confirmation when a draft is open.
- Floor-plan room identification is a state of `/brief/details`, composed from existing primitives: plan image + detected-room list as chips, selected room highlighted by overlay. Interactive region drawing on the plan is NOT in scope; if ever wanted it needs a Claude Design pass (flagged, none needed now).
- The paywall moment (designer second room, homeowner unlock) uses the feature dark card (§8.5), one per screen, with the plan ladder inside; checkout remains Stripe-hosted.
- No new archetype is required for any row above. Every PLANNED screen composes: 1c ledger pattern, §9.11 settings blueprint, §8 components, §12 AI-UX rules.

## Personas & access

| Persona | Account | How to log in | Reaches |
|---|---|---|---|
| Homeowner (test) | `fable-homeowner@ritzyinteriors.com` / `FableWalk-2026!` | `/login` access module (email confirmed) | All rows except designer gate states |
| Designer (test) | `fable-designer@ritzyinteriors.com` / `FableWalk-2026!` | same | All rows incl. designer gate + Studio settings |
| Owner accounts | `ayo@ritzyinteriors.com`, `bolaji@ritzyinteriors.com` | their own credentials | everything |
| Fresh persona | any `@ritzyinteriors.com` address | sign up, then confirm via `scripts/dev-harness/create-hosted-test-user.mjs` (or Supabase admin API `email_confirm`) | per mode chosen |

Signup stays behind `RITZY_SIGNUP_ALLOWLIST` (default `ritzyinteriors.com`). Playwright suites log in with the two test personas above.
