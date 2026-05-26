# Product Matching Pitch Readiness Status

Runtime impact: none. This is a docs/artifacts-only status package.

## Main Verification

PR #173 is merged into `main` at merge commit `f86d902e7bdf648b15453ad2345de3128b27a773`.

Confirmed on `origin/main`:

- `apps/web/app/product-image-preflight.ts` is present.
- `apps/web/app/product-image-preflight.test.ts` is present.
- The PR #173 merge commit is an ancestor of `origin/main`.

PR #173 hardened the Product Sourcing image path by preflighting candidate product image URLs, stripping unsafe image evidence while preserving product text/catalog metadata, recording preflight summaries/gates in `ai_jobs`, and mapping provider image-download failures to the existing catalog-refresh retry path.

## What Is Now Safer After PR #173

The investor-demo Product Matching/Product Sourcing story is safer in these bounded ways:

- Candidate products with unsafe or unreachable image URLs are less likely to break the AI provider request.
- Product text/catalog metadata can still be sent for sourcing context when an image URL is stripped.
- Operators have clearer preflight summaries/gates in `ai_jobs` for debugging product-image readiness.
- Provider image-download failures are routed to existing retry copy instead of presenting as an opaque model failure.

This improves demo confidence for product-sourcing resilience, especially when catalog image quality is uneven.

## What Remains Blocked

Product Matching controlled preview remains blocked until Sam/Chief explicitly approves the execution boundary.

Still blocked:

- controlled-preview configuration or execution;
- app action execution;
- runtime allowlist expansion;
- draft shopping-list create/refresh;
- catalog writes or live catalog writes;
- DB/schema/generated type changes;
- runtime/env default changes;
- UI, prompt, payment, or checkout changes;
- production flags or deploys;
- default-on activation;
- production rollout;
- Product Matching selection/scoring behavior changes;
- Catalog-First runtime coupling.

PR #173 does not change Product Matching preview approval state. It improves image resilience in the existing product-sourcing path, but it does not approve a controlled preview, another evidence pass, runtime config, app actions, or writes.

## Controlled-Preview Approval Fields Still Needed

Sam/Chief must explicitly approve or edit every field below before any controlled-preview execution:

| Field | Required decision |
| --- | --- |
| Scope | Whether execution is limited to the already evidenced Product Matching V1 targets or expanded. |
| Project allowlist | Exact project IDs. Current prepared package proposes only Claret Villa `f66beecc-c011-43c7-9db7-ed59af879820` and Dubai South `c0c9c62e-1062-409f-a624-18db550e7a69`. |
| Room allowlist | Exact room IDs. Current prepared package proposes only Ground floor Lounge `45edb758-735b-4666-bb4b-b00b7cd61de5` and Ground Floor Dining Room `1da580bf-9ad4-40fa-8ee6-420efbbc8ffb`. |
| User/account allowlist | Exact user/account IDs if any app path or preview deployment is approved. No user/account allowlist is proposed for read-only/manual harness execution. |
| Environment | Local QA only, preview deployment, or another explicit environment. |
| App path | Read-only/manual harness only, or a specifically named app action with a separately approved write boundary. |
| Write boundary | Whether draft shopping-list create/refresh writes are allowed. Catalog writes, live catalog writes, DB/schema changes, and generated type changes remain forbidden unless separately approved. |
| Stop rules | Required-role, candidate-pool, artifact-completeness, environment, safety, and expiration stop rules. |
| Rollback rules | What to do if a stop rule triggers, including keeping Product Matching default-off and not reusing failed output for customer-facing decisions. |
| Evidence artifacts | Exact committed evidence location and safe artifact policy. Current package allows safe notes under `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/` only. |
| Owner | Execution/capture owner and reviewer. |
| Expiration | Approval expiry, recommended as one execution pass or 24 hours, whichever comes first. |

The detailed prepared approval package remains `docs/Tracks/v2-commercial/product-matching-evals/2026-05-26-controlled-preview-execution-boundary.md`.

## Investor-Demo Confidence Summary

Product Matching is stronger for an investor narrative today because the core readiness chain now includes:

- two-target Sam-approved read-only evidence from PR #142 with 0 blockers;
- warning triage from PR #148;
- deterministic QA warning reporting from PR #153;
- a prepared execution-boundary package from PR #160;
- mailbox hygiene from PR #170;
- product-sourcing image resilience from PR #173.

The credible pitch claim is: Product Matching V1 has passed bounded read-only evidence for the two prepared targets, and the adjacent product-sourcing path is now more resilient to bad catalog image URLs. The honest caveat is equally important: controlled-preview execution remains approval-gated, warning-heavy, default-off, and not production-ready.

## Do Not Execute Without Approval

Do not run controlled preview, configure controlled preview, expand runtime allowlists, invoke app actions, create/refresh draft shopping-list rows, write catalog data, write live catalog data, change DB/schema/generated types, change runtime/env defaults, change UI/prompts/payment/checkout, set production flags, deploy, enable default-on activation, launch production rollout, change Product Matching selection/scoring behavior, or add Catalog-First runtime coupling without explicit Sam/Chief approval of the exact execution boundary.

If investor-demo urgency requires a live or semi-live demonstration, route the approval request through Sam/Chief first and name the exact scope, environment, app path, write boundary, stop rules, rollback rules, evidence artifacts, owner, and expiration.
