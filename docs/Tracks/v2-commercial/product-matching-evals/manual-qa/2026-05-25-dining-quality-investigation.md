# Product Matching Engine V1 Dining Quality Investigation

Runtime impact: none. This is a default-off domain/docs/QA investigation and narrow fix.

## Scope

Chief Architect selected a narrow investigation after PR #117 because the bounded dining evidence pass cleared required-role stop rules but surfaced two order-quality concerns:

- Dining chairs selected an `acceptable_match` product whose name and shape read stool/bench-like.
- Supporting over-table lighting returned `closest_available` with a floor lamp instead of a pendant/chandelier.

Hard boundaries honored:

- No new preview target.
- No app action.
- No draft shopping-list create or refresh.
- No runtime/env-default change.
- No production rollout.
- No default-on activation.
- No broad deploy or production flag change.
- No live catalog writes.
- No DB/schema change.
- No generated DB types.
- No UI changes.
- No prompt changes.
- No payment or checkout changes.
- No Catalog-First runtime coupling.
- No allowlist expansion.

## Finding

The cause is a narrow role-classification/scoring gap in the default-off Product Matching domain matcher.

Dining chair retrieval already rejects `armchairs` for dining-chair scoped pools, which prevents the older bulky lounge-chair failure mode. However, a catalog row categorized as `chairs` can still be semantically stool/bench-like. Because it matches the `chairs` category and shares neutral/upholstered metadata, it can remain a plausible required-role option and require manual review.

Over-table lighting has the same shape of issue. The category `lighting` is too broad by itself: pendant/chandelier and floor/table lamps share the same category, so the scoped pool needs role-specific preference for ceiling/pendant/chandelier language and a penalty for floor/table/desk lamp language when the role is over-table lighting.

## Fix

Added narrow role-specific scoring cues:

- Dining chairs now penalize `stool`, `stools`, `bench`, `benches`, `barstool`, and `barstools` as weak for dining-chair roles.
- Over-table lighting now rewards `pendant`, `chandelier`, `ceiling`, `suspension`, and `hanging` language.
- Over-table lighting now penalizes `floor`, `table`, `desk`, and generic `lamp` language when no over-table cue is present.

This does not remove weak candidates from all catalog use. It only improves default-off role-scoped ordering and weakness evidence for the dining roles under investigation.

## Evidence

Added deterministic domain coverage:

- A stool-like chair row no longer outranks a proper cream upholstered dining chair for the dining-chair required role.
- The stool-like row records `stool or bench seating is weak for dining chair role`.
- A floor lamp no longer outranks a brass pendant/chandelier for over-table dining lighting.
- The floor-lamp row records `floor or table lamp is weak for over-table lighting role`.

## Verification

Command run:

```bash
pnpm --filter @ritzy-studio/domain test
```

Result: passed.

## Readiness Impact

This resolves the narrow scoring/classification side of the PR #117 dining quality warning. It does not prove the live dining target will now choose order-ready products, because no new preview run was approved or executed in this PR.

Recommended next decision: Chief Architect should choose whether the next stage is a bounded dining re-evidence pass to confirm the fix on the same target, a broader QA-harness-only reproducibility script, or lane pause.
