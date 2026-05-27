# Chief Architect Handover - Investor Catalogue Grounding Priority

Date: 2026-05-27

This is the clean handover for a new Chief Architect. It intentionally avoids replaying the full mailbox history. Use the active control board first, then this note, then open PRs and mailbox history only for evidence.

## Sam's Morning Priority

The investor-meeting priority is not another narrative package. The product must show that concept generation and recommendations are grounded in the ingested catalogue:

- The concept image should be generated from catalogue-backed pieces, not generic image synthesis.
- Recommended pieces must match the user's selected colour, shape, style, and description.
- Current behaviour does not meet that bar. Product sourcing can now complete, but the selected products still do not reliably match the concept image or user intent.

Plain truth for the new Chief Architect: Product Matching V1 has evidence and a narrow coffee-table fix, but it is not broadly enabled, not production-ready, and not yet wired as a reliable catalogue-grounding source for concept image generation.

## Current Live State

- `origin/main` control board still has PM-001 as `BLOCKED`.
- PR #212 is open for docs-only PM-001 narrative readiness.
- PR #213 is open for anti-stall process rules. It has strict PR Review Agent approval at head `b8b6c2c` and needs merge only if still unchanged, green or intentionally skipped for docs-only scope, mergeable, and safety-gate clean.
- PR #212 has Chief Architect approval comments, but still needs strict `PR Review Agent` review or update after #213 merges.
- PR #214 is this handover PR and must wait for its own rejection to be fixed and re-reviewed.
- The main local checkout is dirty/conflicted; use clean worktrees for any new work.

## What Is Proven

- Product sourcing timeout recovery improved through PR #200.
- Sam/Claude reported product catalogue sourcing can now complete.
- PM-001 local/dev Product Matching evidence exists for Sam's current test room.
- The original PM-001 coffee-table role failed as `closest_available`.
- A narrow coffee-table fix merged in PR #207.
- One approved local/dev retest wrote `ai_jobs` row `182e8d5b-2386-4f1a-a139-5d905e67d2fe`.
- That retest moved the required coffee-table role to `acceptable_match` and QA blockers to 0.

## What Is Not Proven

- The app is not generating concept images from ingested catalogue products.
- Product Matching is not approved for customer-facing reuse.
- Product Matching is not approved for another execution unless Sam/Chief routes an exact boundary.
- The selected catalogue products are not yet guaranteed to match user-selected colour, silhouette, materials, or description.
- Warnings remain around weak catalogue evidence, missing dimensions, material mismatch, and partial evidence.

## Current Safety Boundary

Do not perform these without a new exact Sam/Chief approval:

- Production deploys or production flags.
- Product Matching controlled-preview execution.
- Product Matching app-action execution.
- Runtime allowlist expansion.
- Draft shopping-list create/refresh writes.
- Catalog or live catalog writes.
- DB migrations or generated DB types.
- Runtime UI, prompt, app-action, payment, or checkout changes.
- Catalog-First runtime coupling.

Docs-only, domain-only, QA-harness-only, local/dev-only, or read-only evidence work can be routed only when the control board or PR comment names that exact boundary.

## Recommended Immediate Route

Route a new narrow morning ticket to `Product Matching Agent`, not a nonexistent Catalog Ingestion or Catalog-First owner.

Goal: diagnose and define the shortest safe path to catalogue-grounded concept generation for the current investor demo room.

Allowed first step:

- Read-only/domain-only investigation of the current concept-generation flow, Product Matching selected-products output, catalogue candidate metadata, and image evidence path.
- Identify the exact code path that currently lets generic concept image generation run without catalogue-selected product references.
- Produce only a read-only/domain-only investigation artifact: a docs PR, mailbox `ARCHITECT_NOTE:`, or board update that names files inspected, the failure mode, and the proposed next exact boundary.

Do not allow the agent to run another Product Matching execution, invoke app actions, create shopping-list rows, refresh draft rows, write catalogue rows, change schema/types, deploy, broaden allowlists, or open a code/runtime/prompt/image-generation implementation PR during this first step.

Any code, runtime, prompt, local/dev implementation, or image-generation behaviour PR must be separately routed through a new Sam/Chief-approved ticket with the full boundary below.

If the investigation finds that a local/dev evidence execution is required, the agent must stop and request a new approval with:

- project id
- room id
- user id/email
- environment
- app path or harness path
- read boundary
- write boundary
- stop rules
- rollback
- evidence artifact path
- expiration

## Team Coordination Model

The incoming Chief Architect should run this as one active lane plus queued dependent lanes, not as several loosely parked agents.

Active lane now:

- `Product Matching Agent`: owns catalogue-grounded concept/image generation and recommendation quality for the current investor demo path.

Supporting lanes now:

- `PR Review Agent`: #213 already has strict approval and should not be re-reviewed unless its head changes. Review #212 after #213 merges or after any required rebase/update, and re-review #214 after this rejection is fixed. Any new morning Product Matching PR needs a verdict starting with `approved.` or `rejected.`
- `Ritzy Chief Architect`: keeps the board current, routes exact safe boundaries, and prevents repeated quiet heartbeats.

Queued lane, not first:

- `Floor Plan Model Agent`: important, but should stay parked until the catalogue-grounded image/recommendation loop has a demonstrable path or the Chief explicitly splits a safe docs/domain-only floor-plan task. The product is not complete until users can select floor plans from multiple people/sources, but starting that before catalogue grounding is stabilized will split attention across two unfinished investor-critical foundations.

Decision rule:

- If a task affects the investor demo's visible output today, keep it in Product Matching/catalogue grounding first.
- If a task affects later room setup, floor-plan choice, measurements, or multi-provider plan selection, queue it behind the grounding fix unless it can be done as docs/domain-only with no implementation dependency.
- Do not let parked lanes become idle forever. If a lane stays parked for two checks and a safe docs/domain/dry-run artifact exists, route that artifact or explicitly ask Sam for the decision.

Operating rhythm:

- Every 10 minutes: read the active board, check open PRs, then mailbox notes.
- Every active ticket must show branch, commit, PR, mailbox update, or explicit blocker within 30 minutes.
- If Product Matching Agent reports that execution is required, stop and request exact Sam/Chief approval before running it.
- If PR Review Agent does not respond within one heartbeat for open review-needed PRs, notify with the exact PRs and prompt.

## Floor-Plan Follow-Up

The floor-plan model remains a required product pillar after the catalogue-grounding path is stable.

Future route for `Floor Plan Model Agent`:

- Map the user flow where customers select or provide floor plans from different people/sources.
- Identify the minimum model/data shape needed for floor-plan selection without storing unsafe raw assets.
- Produce a docs/domain-only plan first: providers/sources, user consent, allowed asset handling, measurement dependencies, and how selected plans feed room setup.
- Do not add OCR/parser/vendor integrations, raw copyrighted floor-plan storage/display, production data writes, DB/schema/generated type changes, runtime UI/app-action changes, deploys, or feature flags without explicit Sam/Chief approval.

Recommended sequence:

1. Catalogue-grounded concept image and matched recommendations for the investor path.
2. Floor-plan selection model/domain plan.
3. Measurement Intelligence tie-in only after floor-plan and catalogue grounding boundaries are explicit.

## Copy/Paste Prompt For Product Matching Agent

Product Matching Agent: new Chief/Sam morning priority is investor demo catalogue grounding, not more narrative docs. Investigate why the concept image and recommendations are not grounded in the ingested catalogue, and identify the shortest safe local/dev boundary that would make concept generation use catalogue-selected products matching the user's selected colour, shape, style, and description.

Scope: read-only/domain-only investigation only. Inspect the current concept-generation flow, Product Matching selected-products output, catalogue candidate metadata, image evidence/preflight path, and shopping-list/product sourcing path. Produce a docs PR, mailbox `ARCHITECT_NOTE:`, or board update with the exact files inspected, current failure mode, and proposed next exact boundary needed to ground image generation in selected catalogue products.

Hard stops: do not run Product Matching execution, controlled preview, app actions, draft shopping-list create/refresh writes, catalogue writes, live writes, runtime allowlist expansion, DB/schema/generated type changes, UI/payment/checkout changes, production flags/deploys, broad scoring rewrites, prompt/runtime behaviour changes, image-generation behaviour changes, code implementation PRs, or Catalog-First runtime coupling without a new explicit Sam/Chief approval naming that exact boundary.

Expected artifact: docs-only branch/PR, mailbox `ARCHITECT_NOTE:`, or board update within 30 minutes that names the files inspected, the gating point, and the next exact execution boundary if one is required.

## Copy/Paste Prompt For PR Review Agent

PR Review Agent: PR #213 already has strict approval at head `b8b6c2c` and should merge if still unchanged, green or intentionally skipped for docs-only scope, mergeable, and safety-gate clean. After #213 merges, review or request update/rebase for PR #212 as docs-only PM-001 narrative-readiness. Re-review PR #214 only after this rejection is fixed. Start any new verdict with `approved.` or `rejected.`

## Advisor Role

The previous Chief Architect remains available as advisor. Ask them only for clarification of prior evidence, merge history, or why a safety gate exists. Do not let advisor history override the active control board, live PR state, or Sam's current morning priority.
