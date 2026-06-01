# Active Agent Control Board

Status: active coordination source of truth
Last updated: 2026-05-31

This board replaces ad hoc routing through chat-only prompts and stale mailbox prose for active Ritzy Studio implementation lanes. Mailbox files still hold lane history and architectural notes, but this file is the first place agents and heartbeats must read when deciding whether work is parked, routed, blocked, stale, or ready for review.

## Why This Exists

The previous coordination model repeatedly stalled because:

- Heartbeats observed that there were no PRs or messages, but did not force ownership or escalation.
- Mailboxes mixed current state, history, and old next actions in prose. A file could contain both `CHIEF_ARCHITECT_REPLY: Approved` and a later "wait for reply" instruction.
- Visible agent names drifted from lane names, making it unclear which sidebar agent should receive a prompt.
- Safety gates were necessary, but agents sometimes interpreted them as "do nothing" even when docs-only, test-only, domain-only, or dry-run-only work was approved.

This file gives every active item one owner, one status, one expected artifact, and one escalation rule.

## Fixed Statuses

Use only these status values:

- `PARKED`: Intentionally inactive. The blocker must be explicit.
- `ROUTED`: Chief Architect/Sam has assigned the work to a named visible agent.
- `ACKED`: The named agent has acknowledged the route and confirmed branch/scope.
- `IN_PROGRESS`: The agent has branch movement, commits, draft notes, or another visible work signal.
- `PR_OPEN`: A PR exists and is not yet ready for formal review.
- `REVIEW_REQUESTED`: The agent has asked for Chief Architect or strict PR review.
- `APPROVED`: The required review approval exists, but the PR has not merged yet.
- `MERGED`: The PR merged and any follow-through is complete or separately ticketed.
- `BLOCKED`: The owner cannot proceed. The blocker and requested decision must be explicit.
- `STALE`: The ticket missed its acknowledgement or progress SLA without a blocker.

## Visible Agent Names

Use these owner names exactly as they appear in Sam's sidebar:

- `Product Matching Agent`
- `Floor Plan Model Agent`
- `PR Review Agent`
- `Measurement Intelligence ...`
- `Ritzy Chief Architect`
- `Resilience Engineer_Product I...`

Do not invent a new owner name in this board. If Catalog Ingestion or Catalog-First needs active work and there is no visible agent with that name, create a ticket assigned to `Ritzy Chief Architect` with a blocker asking Sam whether to create or rename a visible agent.

## Ticket Rules

Every active ticket must include:

- `Owner`
- `Status`
- `Branch`
- `Allowed scope`
- `Forbidden scope`
- `Expected next artifact`
- `SLA`
- `Last architect instruction`
- `Agent ack`
- `Current PR`
- `Blocker`

No work is considered routed until it appears here or in a GitHub PR comment that references an existing ticket.

## SLA And Escalation

- `ROUTED` must become `ACKED` within one owner heartbeat.
- `ACKED` or `IN_PROGRESS` must show a branch, commit, PR, mailbox update, or explicit blocker within 30 minutes.
- If an item misses either SLA, mark it `STALE` and notify Sam with the exact owner and next prompt.
- If the same item is `STALE` for two checks, Chief Architect must either reassign it, narrow it, park it with a hard blocker, or open a docs-only board update. Do not keep sending the same kick prompt.
- If a ticket is `BLOCKED`, the blocker must name the exact decision needed. "Waiting" is not enough.
- If every ticket is `PARKED` or `BLOCKED` and no PR is open, Chief Architect must not treat that as progress for more than one heartbeat when a safe docs-only, artifacts-only, test-only, domain-only, or dry-run-only next boundary is available.
- After one quiet all-parked/all-blocked check, the next heartbeat must either route one exact safe next boundary, ask Sam for the exact decision needed, or open a docs-only board update explaining why no safe next artifact exists. Do not repeat `DONT_NOTIFY` indefinitely.

## Review And Merge Rules

- Formal PR review still happens on GitHub.
- Strict PR Review Agent verdicts must start with exactly `approved.` or `rejected.`
- Chief Architect PR coordination comments should begin with `CHIEF_ARCHITECT_REPLY:` unless acting as formal reviewer.
- A PR may merge without waiting for Sam only when all of these are true:
  - Strict PR Review Agent approved.
  - Chief Architect approved.
  - Checks are green.
  - Head SHA is unchanged since approval.
  - GitHub reports no conflict.
  - No safety gate is violated.

## Global Safety Gates

Unless Sam explicitly approves the exact PR/action:

- No deploys.
- No production flags.
- No DB migrations.
- No generated DB types.
- No runtime UI/app-action/payment/checkout changes.
- No Product Matching controlled-preview execution.
- No Product Matching app-action execution.
- No runtime allowlist expansion.
- No draft shopping-list writes.
- No catalog writes.
- No live ingestion.
- No Catalog-First runtime coupling.

Docs-only, test-only, domain-only, and dry-run-only work may proceed only when the ticket's allowed scope says so.

## Active Tickets

### Ticket PM-001

Owner: Product Matching Agent
Status: REVIEW_REQUESTED
Branch: `codex/pm001-catalogue-variety-diagnostic`
Allowed scope: Sam routed the next PM-001 local/dev Product Matching code/tests/docs boundary to investigate repeated/similar catalogues, repeated product selections, and room/style role fit after PR #283 merged. Allowed work is limited to inspecting recent PM-001 and Sam test evidence, identifying whether repetition is caused by candidate pool limits, scoring weights, role fallback behavior, deterministic fallback, catalogue thinness, or post-processing, then adding focused local/dev diagnostics or regression tests and one narrow safe Product Matching fix only if clear.
Forbidden scope: No Product Matching validation pass through the live app flow, blind validation, controlled preview, preview QA, production deploy, production flag/default-on activation, live app action, live catalog write, live ingestion, catalogue/product row mutation, DB/schema/generated type change, runtime allowlist expansion, payment/checkout change, UI redesign, broad catalogue rewrite, broad scoring rewrite, prompt/runtime image-generation behavior change, final-render execution, curtains/textiles candidate generation, thin-pool fixes, side-table/storage/media changes, floor-plan work, Catalog-First runtime coupling, or unrelated quality changes.
Expected next artifact: PR Review Agent strict verdict on PR #286.
SLA: Active while PR #286 is awaiting review.
Last architect instruction: Sam's latest beta-readiness concern is repeated/similar catalogues and product selections that do not always match the room/style well. Product Matching Agent must pull latest `origin/main`, create a clean branch, inspect recent PM-001 evidence and latest Sam test evidence, identify the smallest safe local/dev diagnostic or fix boundary for catalogue variety, repeated-product selection, and role/product fit, then open one focused PR only within Product Matching code/tests/docs. PR #283 merged at `99d922176445efd485ad718864a17ae5bb15baaf`; PR #282 merged at `c4fd35996a4108dd8ab911590a1372cd375a0d38`.
Agent ack: Product Matching Agent acknowledged the fresh Sam route on branch `codex/pm001-catalogue-variety-diagnostic`, based on `origin/main` at `668b88db9b1e697e6a0a024b82a086932724972f`, and accepted the stop rules before work. No validation pass, controlled preview, preview QA, live app/catalog action, catalogue/product mutation, DB/schema/type change, deploy/flag, broad scoring rewrite, prompt/image-generation behavior change, payment/checkout, final render, floor-plan work, or Catalog-First coupling is approved.
Current PR: #286 (<https://github.com/Trueflutter/ritzy-studio/pull/286>); #283 merged (<https://github.com/Trueflutter/ritzy-studio/pull/283>); #282 merged (<https://github.com/Trueflutter/ritzy-studio/pull/282>); #280 merged (<https://github.com/Trueflutter/ritzy-studio/pull/280>); #278 merged (<https://github.com/Trueflutter/ritzy-studio/pull/278>); #277 merged (<https://github.com/Trueflutter/ritzy-studio/pull/277>)
Blocker: Waiting for PR Review Agent strict verdict on PR #286.

### Ticket MI-001

Owner: Measurement Intelligence ...
Status: PARKED
Branch: none
Allowed scope: None while parked. A future ticket may allow docs-only, test-only, domain-only, or dry-run-only Measurement Intelligence work.
Forbidden scope: No migrations, generated DB types, Supabase writes, seed ingestion, app/runtime/UI wiring, floor-plan parsing, external integrations, production data work, live writes, deploys, feature flags, payment/checkout changes, or Product Matching/Catalog-First runtime coupling.
Expected next artifact: None while parked.
SLA: None while parked.
Last architect instruction: The lane remains blocked for DB/schema/runtime work. If the agent needs a next safe scope, it must leave a fresh concise `ARCHITECT_NOTE:` with current main state and the proposed docs/domain/dry-run-only artifact.
Agent ack: not required while parked
Current PR: none
Blocker: `DB_SCHEMA_RUNTIME_BLOCKED_WAITING_FOR_SAM_APPROVAL`

### Ticket FP-001

Owner: Floor Plan Model Agent
Status: PARKED
Branch: none
Allowed scope: None while parked. A future ticket may allow docs-only investor proof, model-decision notes, or synthetic/dry-run-only planning.
Forbidden scope: No user/private floor-plan assets, raw copyrighted floor-plan storage/display, OCR/vendor/parser integrations, production data work, runtime UI/app-action wiring, DB/schema/generated type changes, live writes, deploys, or feature flags.
Expected next artifact: None while parked.
SLA: None while parked.
Last architect instruction: The lane is parked after investor proof notes unless Sam/Chief explicitly routes a safe docs-only or dry-run-only next artifact.
Agent ack: not required while parked
Current PR: none
Blocker: Waiting for explicit Sam/Chief routing.

### Ticket RE-001

Owner: Resilience Engineer_Product I...
Status: PARKED
Branch: none
Allowed scope: None while parked after the completed local/dev retest. A future route may allow a narrow timeout/performance follow-up or beta launch smoke-test evidence.
Forbidden scope: No DB migrations, generated DB types, Product Matching controlled-preview configuration/execution, runtime allowlist expansion, Product Matching Engine V1 activation, live catalog writes, draft shopping-list writes except the existing successful sourcing path, payment/checkout changes, deploys, UI redesign, prompt/schema changes unless narrowly required for the fallback and explicitly called out for review, broad sourcing architecture changes, or Catalog-First runtime coupling unless a new ticket explicitly routes that scope.
Expected next artifact: None while parked. If Sam/Chief needs beta performance hardening, route a fresh exact boundary for the 45s visual-sourcing timeout/fallback behavior.
SLA: None while parked after completed retest.
Last architect instruction: RE-001 local/dev retest follow-through completed on latest `origin/main` at `668b88d`, including PR #200 merge commit `9313ca6d8c422932c87eb59e1f0c33e9faea7fd1`. Product/catalogue sourcing succeeded through the existing local app path, returned `303` to shopping list, and updated shopping list `99062356-7a63-4438-bd4b-461cc43c66ba` with 30 item rows and 5 selected rows. Evidence row: `ai_jobs` `540fb2d7-a3f4-47fc-9c85-d36033b8823e`, `status=succeeded`, runtime `45043ms`, request elapsed `52025ms`, `productMatchingEngineEnabled=false`, `productSourcingTextFallbackUsed=true`, reason `initial_visual_sourcing_timeout`. This clears the stale retest blocker but leaves the 45s timeout/text-fallback path as a beta performance risk, not a sourcing failure.
Agent ack: Resilience Engineer completed the routed retest on branch `codex/re001-local-retest-followthrough` and left an `ARCHITECT_NOTE:` on PR #200: <https://github.com/Trueflutter/ritzy-studio/pull/200#issuecomment-4589235314>.
Current PR: none; #200 merged (<https://github.com/Trueflutter/ritzy-studio/pull/200>)
Blocker: Parked after successful local/dev retest; fresh Sam/Chief route required for any timeout/performance follow-up.

### Ticket CI-001

Owner: Ritzy Chief Architect
Status: BLOCKED
Branch: none
Allowed scope: Coordination only.
Forbidden scope: Do not route Catalog Ingestion implementation to an unnamed owner.
Expected next artifact: Sam decision if Catalog Ingestion needs active work.
SLA: None until Sam decides whether to create/rename a visible Catalog Ingestion agent.
Last architect instruction: The old lane name `Catalog Ingestion` does not map to a visible sidebar agent in the current set. Do not issue prompts to a nonexistent owner.
Agent ack: not required
Current PR: none
Blocker: No visible `Catalog Ingestion Agent` owner exists.

### Ticket CF-001

Owner: Ritzy Chief Architect
Status: PARKED
Branch: none
Allowed scope: Coordination only.
Forbidden scope: No Catalog-First runtime/integration work.
Expected next artifact: None while parked.
SLA: None while parked.
Last architect instruction: Catalog-First remains paused after docs/domain handoff. Do not start runtime/integration work until Product Matching is stable and Sam explicitly approves a new default-off Catalog-First runtime spike. If Sam wants active Catalog-First work, first create or rename a visible owner.
Agent ack: not required while parked
Current PR: none
Blocker: Paused after docs-only handoff; no visible Catalog-First owner exists.

## Heartbeat Instructions

Chief Architect heartbeat must:

1. Read this board first.
2. Check open PRs and GitHub comments for tickets in `PR_OPEN`, `REVIEW_REQUESTED`, or `APPROVED`.
3. Check mailbox files only for evidence that updates a ticket.
4. Notify when a `ROUTED`, `ACKED`, or `IN_PROGRESS` ticket misses SLA.
5. Stay quiet only when every ticket is either actively progressing within SLA, intentionally `PARKED`, or hard `BLOCKED` with a named blocker, and this is not the second consecutive all-quiet heartbeat while a safe next boundary exists.
6. When all lanes are parked/blocked for two consecutive checks but a safe next boundary exists, provide the exact owner and copy/paste route prompt, or open a docs-only board update that routes it.

Implementation agents must:

1. Read their assigned ticket before starting.
2. Use the exact owner name and ticket id in any mailbox or PR comment.
3. Acknowledge scope before implementation.
4. Stop and ask if the needed work is outside allowed scope.
5. Update the ticket through a docs-only PR or mailbox note when the status changes.
