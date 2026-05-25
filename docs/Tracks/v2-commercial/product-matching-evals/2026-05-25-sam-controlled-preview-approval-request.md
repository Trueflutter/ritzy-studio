# Product Matching V1 Sam Approval Request

Runtime impact: none. This is a docs-only decision request. It does not approve, configure, or execute controlled preview.

## Current State

Product Matching V1 is at `WAITING_FOR_SAM_APPROVAL` after PR #123. Chief Architect clarified that PR #123 only consolidated readiness; it did not approve controlled-preview configuration or execution.

Do not proceed until Sam explicitly approves or declines the items below.

## Requested Decision

Sam should approve or decline controlled default-off Product Matching V1 preview configuration/execution.

If approving, Sam must name the exact boundaries for:

1. Scope / allowlist.
2. Environment.
3. App path.
4. Write boundary.

## Scope / Allowlist To Approve Or Decline

Recommended smallest scope for an initial controlled default-off preview is limited to already evidenced targets only:

| Target | Project | Project ID | Room | Room ID | Room type | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Living target | Claret Villa | `f66beecc-c011-43c7-9db7-ed59af879820` | Ground floor Lounge | `45edb758-735b-4666-bb4b-b00b7cd61de5` | Living Room | `manual-qa/2026-05-25-bounded-controlled-preview-evidence.md` |
| Dining target | Dubai South | `c0c9c62e-1062-409f-a624-18db550e7a69` | Ground Floor Dining Room | `1da580bf-9ad4-40fa-8ee6-420efbbc8ffb` | Dining Room | `manual-qa/2026-05-25-post-119-dining-re-evidence.md` |

Sam decision required:

- Approve both listed project IDs, or name a smaller subset.
- Approve both listed room IDs, or name a smaller subset.
- Name the user/account allowlist. If no user/account allowlist is approved, say `none`.
- Confirm whether the initial scope is limited to the already evidenced living and dining targets above.
- If Sam intended a Claret Villa dining target rather than the evidenced Dubai South dining target, provide the exact Claret dining project ID, room ID, and concept/evidence reference before any configuration or execution.

## Environment To Approve Or Decline

Sam decision required:

- `local QA only`, or
- `Vercel preview`, or
- another explicitly named environment.

Until Sam chooses one, do not configure or execute controlled preview anywhere.

## App Path To Approve Or Decline

Sam decision required:

- `read-only/manual harness only`, or
- a specific app action path and permission boundary.

Recommended safest initial choice: `read-only/manual harness only`.

Until Sam chooses one, do not invoke app actions.

## Write Boundary To Approve Or Decline

Sam decision required:

- Are draft shopping-list create/refresh writes allowed? Recommended: `no`.
- Are catalog writes forbidden? Recommended: `yes, forbidden`.
- Are DB/schema/generated type changes forbidden? Recommended: `yes, forbidden`.
- Are any other writes permitted? If yes, name the exact table/action and stop rule.

Until Sam answers, no draft shopping-list create/refresh, no catalog writes, no DB/schema/generated type changes, and no other write paths are approved.

## Proposed Approval Text For Sam

Sam may approve by filling this in:

```text
SAM_APPROVAL:
Decision: approve / decline controlled default-off Product Matching V1 preview configuration/execution.

Scope / allowlist:
- Project IDs:
- Room IDs:
- User/account allowlist:
- Scope limited to already evidenced living/dining targets: yes / no

Environment:
- local QA only / Vercel preview / other:

App path:
- read-only/manual harness only / specific app action:

Write boundary:
- Draft shopping-list create/refresh writes allowed: yes / no
- Catalog writes forbidden: yes / no
- DB/schema/generated type changes forbidden: yes / no
- Other writes allowed, if any:

Stop/rollback rules:
- Keep Product Matching V1 default-off globally.
- Stop if any required role is missing, closest-available, invalid, outside-pool, or materially contradictory.
- Roll back by clearing/keeping false Product Matching V1 and controlled-preview env values.
```

## Guardrails While Waiting

- No controlled-preview configuration.
- No controlled-preview execution.
- No default-on activation.
- No production rollout.
- No production flags or deploys.
- No live catalog writes.
- No DB/schema/generated type changes.
- No UI/prompt/payment/checkout changes.
- No Catalog-First runtime coupling.
- No new preview targets or allowlist expansion.
- No app-action execution.
- No draft shopping-list create/refresh.

## Next State

`WAITING_FOR_SAM_APPROVAL`: hold until Sam answers the decision request explicitly.
