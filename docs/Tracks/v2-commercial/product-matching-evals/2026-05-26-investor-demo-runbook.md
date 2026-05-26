# Product Matching Investor Demo Runbook

Runtime impact: none. This is a docs-only runbook. It does not approve, configure, or execute controlled preview.

## Pitch-Safe Story

Product Matching V1 is pitch-ready as a controlled, evidence-backed capability, not as a live production rollout.

Safe story after PR #176 and PR #173:

- Product Matching has completed a bounded read-only evidence pass for the two prepared targets from PR #142.
- Both prepared targets passed QA stop rules with 0 blockers.
- PR #148 grouped the remaining warning classes so reviewers can explain the residual risk.
- PR #153 improved QA-harness warning reporting for deterministic reviewer visibility.
- PR #160 prepared the controlled-preview execution boundary Sam/Chief would need to approve before any execution.
- PR #176 packaged the investor-ready status after PR #173.
- PR #173 made the adjacent product-sourcing path more resilient to bad candidate image URLs by preflighting images, preserving text/catalog metadata when unsafe image evidence is stripped, recording preflight summaries/gates in `ai_jobs`, and routing provider image-download failures to the existing retry path.

The concise investor-safe line:

> Product Matching V1 has passed bounded read-only evidence for two prepared rooms, and the adjacent product-sourcing image path now has stronger resilience against bad catalog image URLs. The system remains default-off and approval-gated before any live or controlled-preview execution.

## What Can Be Shown Without Controlled Preview

Safe without controlled-preview execution:

- The PR #176 pitch-readiness status package: `2026-05-26-pitch-readiness-status.md`.
- The prepared controlled-preview execution boundary: `2026-05-26-controlled-preview-execution-boundary.md`.
- The PR #142 evidence summary: 0 blockers for the two prepared targets, with living warnings and dining warnings clearly disclosed.
- The warning triage from PR #148 and QA warning reporting improvement from PR #153.
- The PR #173 resilience story at a product level: image preflight, unsafe image stripping, metadata preservation, `ai_jobs` preflight summaries/gates, and retry-path handling.
- Static screenshots, docs, diagrams, or recorded walkthroughs that do not invoke app actions, write rows, expand allowlists, change runtime config, or run controlled preview.
- A manual narrative of the approval gate: what Sam/Chief must approve before the next bounded pass.

Safe demo framing:

- "Here is the evidence package."
- "Here is the decision boundary."
- "Here is what improved after the image-resilience fix."
- "Here is what would be approved before this runs live or semi-live."

## What Must Not Be Claimed

Do not claim:

- Product Matching is live.
- Product Matching is production-ready.
- Controlled preview has been approved.
- Controlled preview has been configured or executed after PR #176.
- App actions can be invoked today without approval.
- Draft shopping-list rows or catalog rows can be created or refreshed.
- Catalog writes, live catalog writes, DB/schema changes, generated type changes, runtime flags, or deploys are approved.
- Product Matching is default-on.
- The warnings are eliminated.
- The two prepared targets represent broad room or catalog coverage.
- Catalog-First or Measurement can rely on Product Matching runtime coupling.
- PR #173 approves Product Matching execution; it only improves image resilience in the existing product-sourcing path.

If asked whether the capability is ready, say:

> Ready to show as an evidence-backed, default-off capability with explicit gates. Not approved for live execution or controlled preview until Sam/Chief approves the exact execution boundary.

## Future Bounded Preview Approval Fields

Before any bounded controlled-preview execution, Sam/Chief must approve or edit every field:

| Field | Required approval |
| --- | --- |
| Scope | Exact scope of the preview/evidence pass. |
| Project allowlist | Exact project IDs. Current prepared package proposes only Claret Villa `f66beecc-c011-43c7-9db7-ed59af879820` and Dubai South `c0c9c62e-1062-409f-a624-18db550e7a69`. |
| Room allowlist | Exact room IDs. Current prepared package proposes only Ground floor Lounge `45edb758-735b-4666-bb4b-b00b7cd61de5` and Ground Floor Dining Room `1da580bf-9ad4-40fa-8ee6-420efbbc8ffb`. |
| User/account allowlist | Exact user/account IDs if any app path or preview deployment is approved. |
| Environment | Local QA only, preview deployment, or another explicit environment. |
| App path | Read-only/manual harness only, or a specifically named app action with separately approved boundaries. |
| Write boundary | Whether any draft shopping-list create/refresh writes are allowed. Catalog writes, live catalog writes, DB/schema changes, and generated type changes remain forbidden unless separately approved. |
| Stop rules | Required-role, candidate-pool, artifact-completeness, environment, safety, and expiration stop rules. |
| Rollback rules | Exact response if a stop rule triggers. |
| Evidence artifacts | Exact committed artifact path and safe artifact policy. Current prepared package allows safe notes under `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/` only. |
| Owner | Execution/capture owner and reviewer. |
| Expiration | Recommended: one execution pass or 24 hours, whichever comes first. |

## Fallback If Asked "Can This Run Live Today?"

Answer:

> Not live today without approval. Today we can show the evidence package, the two prepared target results, the warning/reporting improvements, and the image-resilience fix. To run live or semi-live, Sam/Chief must first approve the exact scope, allowlist, environment, app path, write boundary, stop rules, rollback rules, artifacts, owner, and expiration.

If pressure continues:

1. Offer a static walkthrough of the committed artifacts.
2. Show the approval checklist from `2026-05-26-controlled-preview-execution-boundary.md`.
3. State that Product Matching remains default-off globally.
4. Route the approval request to Sam/Chief instead of improvising execution.

## Do Not Execute

Do not run controlled preview, configure controlled preview, invoke app actions, expand runtime allowlists, create/refresh draft shopping-list rows, write catalog rows, write live catalog data, change DB/schema/generated types, change runtime/env defaults, change UI/prompts/payment/checkout, set production flags, deploy, enable default-on activation, launch production rollout, change Product Matching selection/scoring behavior, or add Catalog-First runtime coupling without explicit Sam/Chief approval.
