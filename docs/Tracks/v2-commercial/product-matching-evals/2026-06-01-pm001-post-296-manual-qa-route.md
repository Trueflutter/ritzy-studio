# PM-001 Post-296 Manual QA Route

Runtime impact: docs-only route for Sam's manual local Product Matching retest after PR #296. No app execution by this agent.

## Current State

- PR #296 merged at `410f820c66b9a28efc43adf151dea81a79de6246`.
- PR #296 fixed the selected-vs-alternate consistency gap: visible alternates now use role-scoped pools, role contracts, room/class/size filters, and the same design-fit envelope as selected/default products.
- PR #295 remains open from the earlier post-#294 manual-QA route, but it is stale against the newer PR #296 routing docs and should not merge unchanged.

## Next Planned Stage

Sam should run the local Product Matching beta-readiness retest after PR #296 and record whether selected/default and alternate option slots now feel curated to the same design intent.

## Manual QA Checklist

| Area | Expected check |
| --- | --- |
| Selected-vs-alternate sofa consistency | A selected green/sage/olive sofa should show alternate sofas in the same role and palette/material/style direction, varying by product family/form/detail rather than drifting to generic grey/white unless the brief supports that palette. |
| Selected slot ordering | The selected product should appear as the first visible option for its role. |
| Role/class purity | No office/task/ergonomic/desk/gaming/study seating should appear in living-room armchair alternatives. |
| Coffee-table purity | Coffee-table alternatives should not include office tables, desks, workstations, dining tables, side tables, recamieres, chaise, sofas, armchairs, or bedside tables. |
| Room scope | Bathroom/vanity/shower/ensuite/washroom/WC mirrors or decor should not reappear in living-room alternate paths. |
| Reject/refresh/find-more/substitute | Replacement paths should preserve role, room, class, size, and design direction rather than falling back to the old generic stream. |
| Thin pools | If the catalogue cannot supply enough same-envelope alternatives, fewer options or explicit thin/manual-review evidence is acceptable; off-brief filler is not. |

## Stop Rules

This route does not approve Product Matching live validation by an agent, controlled preview, preview QA, browser-click app action, shopping-list refresh/create by an agent, visual-sourcing runtime calls, catalogue/product row mutation, catalog writes, ingestion, production deploy/flag/default-on activation, DB/schema/generated type changes, runtime allowlist expansion, payment/checkout changes, UI redesign, broad catalogue rewrite, broad Product Matching rewrite, prompt/runtime image-generation behavior changes, final-render execution, floor-plan work, or Catalog-First runtime coupling.

## Outcome Routing

- If Sam's manual retest passes: route a docs-only beta decision/readiness record.
- If Sam's manual retest still shows failures: route the smallest next local/dev boundary based on the exact observed failure, with no live validation or runtime/catalog action unless explicitly approved.
