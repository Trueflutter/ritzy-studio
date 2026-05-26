# Product Matching Investor Evidence Appendix

Runtime impact: none. This is a docs-only investor appendix. It does not approve, configure, or execute controlled preview.

## Purpose

This appendix gives a concise investor-facing evidence map for Product Matching V1 after the current readiness chain. It is safe to use for a static walkthrough of what has been proven, what improved, and what remains approval-gated.

Product Matching remains default-off and blocked at `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` until Sam/Chief explicitly approves the exact controlled-preview execution boundary.

## Evidence Chain

| Source | What it proves | Investor-safe takeaway | Boundary |
| --- | --- | --- | --- |
| PR #142 / `manual-qa/2026-05-25-sam-approved-bounded-preview-evidence.md` | One Sam-approved local QA / read-only manual harness pass completed for two prepared targets: Claret Villa / Ground floor Lounge and Dubai South / Ground Floor Dining Room. Both passed QA stop rules with 0 blockers. | Product Matching V1 has real two-room evidence, not only a design claim. | The approval was single-use and expired by execution. It does not approve another pass, app action, write path, or preview configuration. |
| PR #148 / `2026-05-25-post-evidence-warning-triage.md` | Remaining warnings were grouped by required roles, supporting roles, dimension fit, catalog evidence completeness, freshness, and candidate-pool quality. | The warning surface is understood and explainable. | Warnings remain review items; they are not eliminated and do not support unattended customer-facing acceptance. |
| PR #153 / `manual-qa/2026-05-25-qa-warning-reporting.md` | QA warning reporting became deterministic for issue counts, role/product grouping, dimension groups, missing evidence fields, and freshness status. | Reviewers can inspect risk consistently instead of hand-counting warnings. | This was QA-harness-only and did not change selection/scoring behavior. |
| PR #160 / `2026-05-26-controlled-preview-execution-boundary.md` | The exact approval package for any future bounded execution is defined: scope, allowlist, environment, app path, write boundary, stop rules, rollback rules, artifacts, owner, and expiration. | The team knows precisely what Sam/Chief must approve before anything runs. | The package is not approval; it is a decision boundary. |
| PR #173 / `manual-qa/2026-05-26-product-sourcing-image-resilience-audit.md` | Product Sourcing now preflights candidate image URLs, strips unsafe image evidence while preserving text/catalog metadata, records preflight summaries/gates, and routes provider image-download failures to the existing retry path. | The adjacent sourcing path is more resilient to bad catalog images during a demo narrative. | It does not repair catalog data, approve Product Matching execution, or remove the need for review. |
| PR #176 / `2026-05-26-pitch-readiness-status.md` | Pitch-readiness was consolidated after PR #173, including what is safer, what remains blocked, and the execution fields still needed. | The investor story is current and honest. | Controlled-preview execution remains blocked. |
| PR #181 / `2026-05-26-investor-demo-runbook.md` | The investor-demo runbook defines the pitch-safe story, what can be shown without controlled preview, what must not be claimed, and the fallback if asked whether it can run live. | The demo can stay useful without crossing execution gates. | The runbook does not approve live, semi-live, or controlled-preview execution. |

## Evidence Snapshot

| Target | Prior approved scope | Stop-rule outcome | Warning load | Safe interpretation |
| --- | --- | ---: | ---: | --- |
| Claret Villa / Ground floor Lounge | Local QA, read-only/manual harness only | Pass, 0 blockers | 13 warnings | Required roles resolved without missing, closest-available, invalid, empty-pool, or required color-mismatch outcomes; reviewer warning load remains meaningful. |
| Dubai South / Ground Floor Dining Room | Local QA, read-only/manual harness only | Pass, 0 blockers | 8 warnings | Required roles resolved without missing, closest-available, invalid, empty-pool, or required color-mismatch outcomes; dining warning load is lower but still needs review. |

The credible investor claim is: Product Matching V1 has passed bounded read-only evidence for two prepared rooms, the warning surface is documented, and the adjacent product-sourcing image path is more resilient after PR #173. The honest caveat is: it remains default-off, warning-heavy, and blocked from any live or controlled-preview execution until Sam/Chief approves the execution boundary.

## What We Can Safely Show Tomorrow

- Static walkthrough of the PR #142 evidence summary for the two prepared targets.
- The exact stop-rule outcome: both prepared targets passed with 0 blockers.
- The remaining warning counts and classes from PR #148.
- The deterministic warning-reporting improvement from PR #153.
- The controlled-preview approval fields from PR #160.
- The PR #173 image-resilience story: preflight candidate images, strip unsafe image evidence, preserve product metadata, record summaries/gates, and route image-download failures to retry guidance.
- The PR #176 pitch-readiness package and PR #181 investor demo runbook.
- Static screenshots, diagrams, or recorded walkthroughs that do not invoke app actions, change runtime config, expand allowlists, write rows, or run controlled preview.
- The approval gate itself: what must be approved before Product Matching can run live or semi-live.

## Do Not Claim

- Do not claim Product Matching is live.
- Do not claim Product Matching is production-ready.
- Do not claim controlled preview is approved, configured, or recently executed.
- Do not claim app actions are approved.
- Do not claim draft shopping-list rows, catalog rows, or live catalog writes are approved.
- Do not claim warnings are eliminated.
- Do not claim the two prepared rooms prove broad catalog or room-type coverage.
- Do not claim PR #173 approves Product Matching execution; it only improves image resilience in the existing product-sourcing path.
- Do not claim Catalog-First or Measurement can depend on Product Matching runtime coupling.

## Do Not Execute

Do not run or configure controlled preview, invoke app actions, expand allowlists, create or refresh draft shopping-list rows, write catalog rows, write live catalog data, change runtime/env defaults, change UI, change prompts, change DB/schema/generated types, deploy, set production flags, enable default-on activation, launch production rollout, change Product Matching selection/scoring behavior, or add Catalog-First runtime coupling without explicit Sam/Chief approval.

## Future Approval Fields Still Needed

Sam/Chief must approve or edit every field before any future bounded preview execution:

| Field | Required decision |
| --- | --- |
| Scope | Exact execution scope and whether it is limited to the two already evidenced targets. |
| Project allowlist | Exact project IDs. Current prepared package proposes only Claret Villa `f66beecc-c011-43c7-9db7-ed59af879820` and Dubai South `c0c9c62e-1062-409f-a624-18db550e7a69`. |
| Room allowlist | Exact room IDs. Current prepared package proposes only Ground floor Lounge `45edb758-735b-4666-bb4b-b00b7cd61de5` and Ground Floor Dining Room `1da580bf-9ad4-40fa-8ee6-420efbbc8ffb`. |
| User/account allowlist | Exact user/account IDs if any app path or preview deployment is approved. |
| Environment | Local QA only, preview deployment, or another named environment. |
| App path | Read-only/manual harness only, or a specifically named app action with separate approval. |
| Write boundary | Whether any draft shopping-list create/refresh writes are allowed. Catalog writes, live catalog writes, DB/schema changes, and generated type changes remain forbidden unless separately approved. |
| Stop rules | Required-role, candidate-pool, artifact-completeness, environment, safety, and expiration stop rules. |
| Rollback rules | Exact response if any stop rule triggers. |
| Evidence artifacts | Exact committed artifact path and safe artifact policy. Current prepared package allows safe notes under `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/` only. |
| Owner | Execution/capture owner and reviewer. |
| Expiration | Recommended: one execution pass or 24 hours, whichever comes first. |

## Fallback If Asked Whether It Can Run Live Tomorrow

Answer:

> Not without approval. Tomorrow we can show the evidence appendix, the two prepared target results, the warning/reporting improvements, the execution boundary, and the image-resilience fix. To run live or semi-live, Sam/Chief must first approve the exact scope, allowlist, environment, app path, write boundary, stop rules, rollback rules, artifacts, owner, and expiration.

