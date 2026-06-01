# PM-001 Selected/Alternate Consistency Evidence

Runtime impact: focused Product Matching option-composition fix. No live app execution.

## Run Details

- Date: 2026-06-01
- Branch: `codex/pm001-alternate-consistency`
- Trigger: Sam's post-PR #294 QA found selected products aligned with the generated design while alternate options in the same role still looked stale or generic.
- DB writes: none
- Catalog writes / re-ingestion: none
- Schema / generated types: none
- Production deploy / flag change: none
- Prompt or image-generation behavior change: none
- Controlled preview / live app flow: not run

## Inconsistent Path

PR #294 improved selected/default product quality through catalogue-grounded anchors and role-scoped candidate pools. The visible alternate slots still came from `composeRoomProductOptions({ ranked: visualRanked })`, where `visualRanked` was the flat global `rankProductMatches` stream. That meant diversity and refresh paths could drift from the selected role's design envelope.

The weak paths were:

- Initial visible alternates: `apps/web/app/actions.ts` built final `roleOptions` from flat `visualRanked`.
- Option diversity: `packages/domain/src/product-matching.ts` treated first color/material tags as a diversity signature, which could reward color/material drift.
- Refresh / find-more / substitution: `apps/web/app/actions.ts` reranked flat same-category catalog candidates instead of the role-scoped pool.

## Files Changed

- `packages/domain/src/product-matching.ts`
- `packages/domain/src/product-matching.test.ts`
- `apps/web/app/actions.ts`
- `docs/Tracks/v2-commercial/process/active-agent-control-board.md`
- `docs/Tracks/v2-commercial/process/product-matching-agent-comms.md`
- `docs/Tracks/v2-commercial/product-matching-evals/2026-06-01-pm001-selected-alternate-consistency-evidence.md`

## Before / After

| Area | Before | After |
| --- | --- | --- |
| Initial alternates | Flat global ranked candidates fed `composeRoomProductOptions`. | Engine-enabled option composition uses role-scoped pools for the same role contracts and design-fit scoring as the selected/default path. |
| Slot ordering | The selected product could persist as selected while not being option rank 0. | Selected products are moved to slot 0 before shopping-list rows are persisted. |
| Diversity | Early alternate diversity could skip same color/material candidates and pull in grey/white generic options. | Diversity prefers different product/family without forcing color/material drift. |
| Refresh / find more | Flat same-category ranking could reintroduce off-brief options. | Refresh and find-more build candidates from a role-scoped pool using the persisted role label, visual brief, room, budget, and measurements. |
| Substitute | Same-category global replacement could bypass the role contract. | Substitution filters by mode first, then chooses from the role-scoped pool for the existing row's role. |
| Thin pools | Flat backfill could fill visible slots with off-brief items. | Role-scoped composition returns only eligible candidates; thin pools surface as fewer options rather than off-envelope filler. |

## Automated Coverage

- Added a green/sage sofa fixture based on Sam's report. The selected/default role pool returns sage/olive velvet sofas and does not pull the familiar grey/white sofa into the visible alternate slots.
- Updated the diversity regression to assert same-envelope products can remain adjacent instead of forcing a color/material change.
- Existing PR #294 role-contract coverage remains in place for sofa size, office/task armchairs, coffee-table role purity, bathroom mirror room scope, lighting fixture guards, and aesthetic ranking.

## Automated Checks

- `pnpm --filter @ritzy-studio/domain exec tsx src/product-matching.test.ts` - passed
- `pnpm --filter @ritzy-studio/domain typecheck` - passed
- `pnpm --filter @ritzy-studio/web typecheck` - passed
- `git diff --check` - passed

## Manual QA For Sam

When Sam reruns the local beta-readiness flow, capture:

| Room / role | Expected manual check |
| --- | --- |
| Living / sofas | A green or sage selected sofa should show alternate sofas in the same green/sage/velvet/contemporary direction, varying by product family/form/detail rather than drifting to generic grey/white unless the brief supports that palette. |
| Living / armchairs | Alternate armchairs should remain residential lounge/accent seating; no office, task, ergonomic, desk, visitor, gaming, or study chairs. |
| Living / coffee tables | Alternates should stay coffee tables, not office/desks/workstations/dining/side tables. |
| Living/decor/mirrors | No bathroom, vanity, shower, ensuite, washroom, or WC mirrors through alternate or replacement paths. |
| Reject / refresh / substitute | Rejecting, refreshing, finding more, or substituting should preserve role, room, class, size, and design direction. |
| Thin pool | If the catalogue cannot produce enough same-envelope alternatives, fewer options or a manual-review/thin-pool note is preferred over generic filler. |

## Stop Rules

This fix does not approve Product Matching live validation, controlled preview, preview QA, browser-click app action, shopping-list refresh/create by an agent, visual-sourcing runtime calls, catalogue/product row mutation, catalog writes, ingestion, production deploy/flag/default-on activation, DB/schema/generated type changes, runtime allowlist expansion, payment/checkout changes, UI redesign, broad catalogue rewrite, broad Product Matching rewrite, prompt/runtime image-generation behavior changes, final-render execution, floor-plan work, or Catalog-First runtime coupling.
