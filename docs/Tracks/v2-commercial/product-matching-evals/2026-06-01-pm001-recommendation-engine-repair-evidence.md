# PM-001 Recommendation Engine Repair Evidence

Runtime impact: domain-only Product Matching engine repair behind the existing role-scoped candidate-pool path. No live app execution.

## Run Details

- Date: 2026-06-01
- Branch: `codex/pm001-recommendation-engine-repair`
- Source plan: `PM001_RECOMMENDATION_ENGINE_REPAIR_PLAN.md`
- DB writes: none
- Catalog writes / re-ingestion: none
- Schema / generated types: none
- Production deploy / flag change: none
- Prompt or image-generation behavior change: none
- Controlled preview / live app flow: not run

## Implemented Slices

| Slice | Status | Evidence |
| --- | --- | --- |
| S1/S2 taxonomy helpers and role contracts | Done | Added match-time class tags, room scope, sofa size class, canonical category type surface, and additive role contract fields. |
| S3 hard eligibility filters | Done | Role pools now reject class, room-scope, and sofa-size mismatches before scoring/diversity. |
| S4 sofa size and diversity safety | Done | Straight sofa roles reject sectional/modular/corner sofas unless the role explicitly asks for a large sofa; diversity signatures include sofa size and full color/material tag sets. |
| S5 ranking widening and aesthetic heuristic | Done | Role-scoped pools consider more candidates by default, apply stronger family/signature repeat penalties, and include the existing deterministic aesthetic heuristic in role-pool ranking. |
| S6 regression coverage | Done for domain | Added focused assertions for office-chair armchair rejection, office-table coffee-table rejection, bathroom-mirror living-room rejection, sofa size mismatch, and aesthetic re-ranking. Manual Sam QA remains external. |

## Acceptance Mapping

| Failure mode | Automated evidence |
| --- | --- |
| Armchair roles include office/task furniture | `classPureLivingPool` rejects `Executive Ergonomic Task Office Chair` with `class_mismatch`. |
| Coffee-table roles include office tables | `classPureLivingPool` and the existing coffee-table regression reject office/workstation table candidates. |
| Bathroom mirrors appear in living/decor sets | `classPureLivingPool` rejects `Bathroom Vanity Mirror Cabinet` with `room_scope_mismatch`. |
| Sofa role mixes straight sofas with sectional/modular pieces | `classPureLivingPool` rejects `Ivory L-Shaped Modular Corner Sofa` with `size_class_mismatch`. |
| Same family recurs too aggressively | Role diversity now penalizes repeated diversity signatures and refresh-family signatures across all selected role-pool slots. |
| Ranking lacks design-quality signal | `aestheticRankedCoffeePool` ranks a quiet walnut coffee table above a noisy statement coffee table in a quiet patterned-rug living room. |
| Diversity overrides class | Class, room-scope, and size gates run before scoring/diversity in `buildRolePool`; compose option filtering also applies class and sofa-size contract checks. |
| Thin pools should not backfill wrong class | Rejected candidates are counted under explicit rejection reasons; pools return only remaining eligible candidates. |

## Automated Checks

- `pnpm --filter @ritzy-studio/domain exec tsx src/product-matching.test.ts` - passed
- `pnpm --filter @ritzy-studio/domain typecheck` - passed
- `pnpm --filter @ritzy-studio/domain test` - passed
- `pnpm typecheck` - passed
- `pnpm lint` - passed

## Manual QA For Sam

When Sam runs the local beta-readiness retest, capture:

| Room / role | Expected manual check |
| --- | --- |
| Living / sofas | Straight sofa role should not show L-shaped, modular, corner, or sectional pieces unless the role asks for that size. |
| Living / armchairs | No office, task, ergonomic, desk, gaming, visitor, or study chairs. |
| Living / coffee tables | No office tables, desks, workstations, dining tables, side tables, recamieres, chaise, or seating. |
| Living/dining/bedroom / mirrors | No bathroom, vanity, shower, ensuite, washroom, or WC mirrors. |
| Decor/support roles | Repetition should be bounded; if the catalog pool is thin, fewer options or explicit review reasons are acceptable. |
| Ranking | Quiet/refined roles should prefer materially coherent residential pieces over noisy/utility alternatives when hard class gates are already satisfied. |

## Decision

This branch is ready for strict code review after full package checks. It does not approve live preview, production deployment, catalog mutation, re-ingestion, schema/type changes, or Sam's manual local QA result.
