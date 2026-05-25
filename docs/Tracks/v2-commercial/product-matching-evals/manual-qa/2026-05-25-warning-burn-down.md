# Product Matching Warning Burn-Down

Runtime impact: default-off domain/test/docs only. This PR does not configure or execute controlled preview.

## Scope

Chief Architect asked for one small non-runtime warning-burn-down improvement while Product Matching remains at `WAITING_FOR_SAM_APPROVAL`.

This pass focused on deterministic QA stop-rule visibility for warning classes that remain in PR #123/#125 readiness docs:

- required dimension warnings;
- required catalog evidence completeness warnings;
- required catalog freshness warnings;
- supporting-role manual-review warnings.

## Change

QA stop-rule warning messages now include the specific evidence already present in deterministic domain metadata:

| Warning class | Before | After |
| --- | --- | --- |
| Required missing dimensions | `Required role selected product fit could not be fully checked from dimensions.` | Adds the dimension classifier detail, for example `Product dimensions are missing; fit requires designer review.` |
| Required oversized dimensions | `Required role selected product may not fit entered room measurements.` | Adds the dimension classifier detail, for example `Product width exceeds entered room wall length.` |
| Required partial/weak catalog evidence | `Required role selected product has partial/weak catalog evidence.` | Adds the exact missing evidence fields, for example missing material, style/room, price, availability, or dimension evidence. |
| Required stale catalog freshness | `Required role selected product catalog timestamp is stale.` | Adds timestamp age and threshold, for example `7 days old, threshold 7 days.` |
| Required invalid catalog freshness | `Required role selected product catalog timestamp is invalid.` | Adds the invalid timestamp text. |
| Supporting role issue | `Supporting role needs manual QA review.` | Distinguishes closest-available, missing supporting selection, empty candidate pool, and color mismatch. |

## Before/After Evidence

Static fixture coverage in `packages/domain/src/product-matching-confidence.test.ts` now asserts:

- stale freshness warning includes age and freshness threshold;
- missing and invalid freshness warnings remain explicit;
- missing and oversized dimension warnings include classifier details;
- partial and weak catalog evidence warnings include missing evidence fields;
- supporting closest-available warning is distinguished from generic manual review.

## Guardrails

- No controlled-preview configuration.
- No controlled-preview execution.
- No evidence pass.
- No new preview targets or allowlist expansion.
- No app-action execution.
- No draft shopping-list create/refresh.
- No runtime/env-default changes.
- No production rollout, default-on activation, production flags, or deploys.
- No live catalog writes.
- No DB/schema/generated type changes.
- No UI/prompt/payment/checkout changes.
- No Catalog-First runtime coupling.

## Tests

- `pnpm --filter @ritzy-studio/domain test`
- `pnpm --filter @ritzy-studio/domain typecheck`

## Next State

Product Matching preview activation remains `WAITING_FOR_SAM_APPROVAL`. This PR only improves deterministic warning specificity for future QA/review artifacts.
