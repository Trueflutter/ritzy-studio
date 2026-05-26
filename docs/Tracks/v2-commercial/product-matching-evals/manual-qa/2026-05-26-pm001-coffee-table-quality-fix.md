# Product Matching V1 PM-001 Coffee-Table Quality Fix Evidence

Runtime impact: narrow domain/test quality fix plus one approved local/dev retest. Product Matching Engine V1 remains default-off outside the local process used for the retest.

## Scope

PR #205 routed a narrow quality-fix investigation for the PM-001 coffee-table required-role blocker captured by PR #204.

| Field | Value |
| --- | --- |
| Ticket | `PM-001` |
| Owner | Product Matching Agent |
| Branch | `codex/product-match-coffee-table-quality-fix` |
| Project | Arabian Ranches 3 |
| Project ID | `7e1f060d-b95d-462d-8cc2-22b6dd0e92a5` |
| Room | Living Room |
| Room ID | `19d312f0-0cd0-4e92-a612-8897767992b3` |
| User ID | `87c551bf-8288-49df-99c4-a58b530f32ce` |
| User email | `sam.olatoye@gmail.com` |
| Concept | Traditional Sage & Warm-Walnut Formal Living Room |
| Concept ID | `86a84348-9a98-4dc9-9a41-2d2fd2f44b32` |

## Fix Summary

The PR #204 evidence showed the required coffee-table role failed QA because the selected product was only `closest_available`. Reconstructing the local role pool showed that several products normalized as `coffee_tables` were not actually coffee tables in product-name language, including office tables, recamieres, and side tables.

The fix adds narrow coffee-table role filtering and scoring inside the existing Product Matching domain logic:

- Reject obvious non-coffee-table furniture from the coffee-table role pool when the normalized category says `coffee_tables` but product-name language says office table, recamiere/chaise/seating, side table, desk, or bedside.
- Add a small coffee-table role-fit bonus only when product-name language contains coffee/cocktail table.
- Keep the change scoped to coffee-table role matching; no broad scoring rewrite.

## Before / After

| Evidence | Job ID | Coffee-table status | QA stop rules | Blockers | Warnings |
| --- | --- | --- | --- | ---: | ---: |
| Before PR #204 evidence | `b218a6f6-55bf-4c49-961d-9812827d6553` | `closest_available` | Fail | 1 | 12 |
| After local/dev retest | `182e8d5b-2386-4f1a-a139-5d905e67d2fe` | `acceptable_match` | Pass | 0 | 13 |

## Role-Pool Effect

The reconstructed coffee-table role pool now records:

| Field | Value |
| --- | ---: |
| Candidate count | 6 |
| Category-mismatch rejections | 947 |
| Coffee-table role-mismatch rejections | 5 |

The five role-mismatch rejections are catalog rows that were normalized under `coffee_tables` but did not have coffee/cocktail table product-name language and matched obvious non-coffee-table patterns.

## Retest Outcome

Retest evidence row: `182e8d5b-2386-4f1a-a139-5d905e67d2fe`

Coffee-table selected product:

| Field | Value |
| --- | --- |
| Product | Colonial Coffee Table Bar in Brown Polyurethane-Coated Textile, 120x75cm |
| Product ID | `01361cb9-47d3-4002-afbf-e9b8c8c9ffef` |
| Status | `acceptable_match` |
| Confidence tier | `acceptable` |
| Freshness | `fresh` |
| Dimension fit | `missing_product_dimensions` |
| Evidence completeness | `partial` |

Coffee-table reason:

> Round brown coffee table matches overall shape, scale and warm color family required. Finish and detailing differ (no brass rim), so acceptable rather than strong match.

Warnings remain for coffee-table material weakness, missing dimensions, and partial evidence. Those are warnings, not QA blockers.

## Write Boundary

| Boundary | Result |
| --- | --- |
| Product Matching execution | One approved local/dev retest only |
| App actions | false |
| Deploy | false |
| Production flags | false |
| Broad allowlist expansion | false |
| Catalog writes | false |
| Shopping-list rows created | false |
| Shopping-list rows refreshed | false |
| Schema/generated type changes | false |
| UI/payment/checkout changes | false |
| Catalog-First runtime coupling | false |

## Verification

- `pnpm --filter @ritzy-studio/domain test`
- `git diff --check`

## Next Review Question

Chief/Sam should review whether the coffee-table role fix and passing local/dev retest are sufficient to unblock narrative-only Product Matching confidence for this current test room, or whether another separately approved quality follow-up is needed for remaining warnings.
