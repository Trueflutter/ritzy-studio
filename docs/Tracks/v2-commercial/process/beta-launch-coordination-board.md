# Beta Launch Coordination Board

Status: active beta-launch routing overlay
Target launch: 2026-06-03 operational beta
Last updated: 2026-06-01

This board coordinates beta-critical work that cuts across the normal lane mailboxes. The active agent control board remains the source of truth for long-running implementation lanes; this file prevents beta work from disappearing into chat-only prompts.

## Coordination Rules

- Every beta-critical route must name an owner, expected artifact, and stop rule.
- A chat-only prompt is not enough. If an agent starts work, the result must become visible through a PR, an `ARCHITECT_NOTE:` PR comment, or a committed evidence document.
- If an owner does not acknowledge within one heartbeat after being prompted, the Chief Architect must notify Sam with the exact prompt to resend or reassign.
- If an owner acknowledges but shows no branch, PR, evidence note, or explicit blocker within 30 minutes, treat the route as stale.
- Do not repeat the same stale notice more than twice. After two misses, narrow the route, reassign it, or mark the exact blocker.
- Keep docs-only evidence separate from implementation PRs unless the implementation PR itself is the evidence artifact.

## Global Beta Stop Rules

Do not perform any of these without explicit Sam approval:

- production deploys or production flags
- live payment actions
- live catalog writes or live ingestion
- catalogue/product row mutations
- DB/schema/generated type changes
- Product Matching controlled-preview execution or default-on activation
- runtime allowlist expansion
- external customer-facing action
- broad Product Matching scoring rewrite
- prompt/runtime image-generation behavior changes
- final-render execution
- Catalog-First runtime coupling

## Beta-Critical Tickets

### Ticket BL-001 Designer Path QA

Owner: Sam-created Designer Path QA Agent
Status: MERGED
Branch: `codex/designer-path-qa-evidence`
Allowed scope: None unless Sam/Chief routes a fresh follow-up for the P2 concept completion spinner observation, native file-picker gap, or another designer-path beta blocker.
Forbidden scope: No production deploys, production flags, live payment actions, live catalog writes, live ingestion, DB/schema/generated type changes, controlled-preview expansion, Product Matching default-on activation, runtime allowlist expansion, broad UI redesign, or payment/checkout architecture changes.
Expected next artifact: None unless Sam/Chief routes a fresh designer-path follow-up.
SLA: None while merged and parked.
Last architect instruction: PR #288 merged at `65610546508e616c814aab8c167f4b0d20b53002` after strict PR Review Agent approval at unchanged head `541e95c739d0e455b166f532a056947f4ae1ca85`. The local/dev evidence covered login/onboarding, designer mode, project/room creation, photo evidence, brief/questions/style/inspiration, concept generation, product matching, locked shopping list, designer plan paywall, and room preview. The P2 concept completion spinner observation and native file-picker gap remain follow-up candidates only; no production deploy, live payment action, live catalog write/ingestion, controlled preview expansion, final-render execution, DB/schema/type change, or runtime flag change was authorized.
Agent ack: Designer Path QA Agent opened and updated PR #288; strict review approved it after the EOF whitespace fix and rebase onto PR #287.
Current PR: none; #288 merged (<https://github.com/Trueflutter/ritzy-studio/pull/288>)
Blocker: Parked after merged designer-path QA evidence; fresh Sam/Chief route required for any follow-up fix.

### Ticket BL-002 V2-006 Shopping Preview And Unlock UX

Owner: Ritzy Chief Architect
Status: ROUTE_READY
Branch: none
Allowed scope: Local/dev code/tests/docs for V2-006 beta usability: locked shopping preview, unlocked shopping links, designer subscription bypass expectations, clear paid/unpaid states, and server-side no-link-leakage checks.
Forbidden scope: No live payment actions, production deploys, production flags, DB/schema/generated type changes unless separately approved, live catalog writes, live ingestion, Product Matching execution, controlled-preview/default-on activation, or retailer attribution promises beyond existing data.
Expected next artifact: A focused V2-006 implementation or test PR, or an explicit blocker naming the smallest Sam decision needed.
SLA: Route within the next beta coordination cycle unless Sam chooses to defer V2-006 from Wednesday beta.
Last architect instruction: V2-006 remains `passes=false` in `docs/Tracks/v2-commercial/02_Feature_List.json`; it is the first unfinished V2 commercial feature and beta-critical for designers testing the shopping-list experience.
Agent ack: not started.
Current PR: none.
Blocker: Needs Chief route to an implementation agent or explicit Sam decision to defer.

### Ticket BL-003 Product Matching Variety And Fit

Owner: Product Matching Agent
Status: MERGED_WAITING_FOR_SAM_RETEST
Branch: none
Allowed scope: None until Sam's fresh beta-readiness retest result or a fresh Sam/Chief route approves the next exact PM-001 local/dev boundary.
Forbidden scope: No blind validation, controlled preview, production/default-on activation, live app actions, live catalog writes, catalogue/product mutations, DB/schema/generated type changes, runtime allowlist expansion, broad scoring rewrite, prompt/runtime image-generation behavior changes, payment/checkout changes, deploys, final-render execution, or Catalog-First coupling.
Expected next artifact: Sam's retest readout after PR #286. If repeated catalogues or poor fit remains, route the smallest next Product Matching local/dev boundary.
SLA: Once Sam posts retest evidence, route or park within one heartbeat.
Last architect instruction: PR #286 merged at `51812e2f9748c5ff5131959b7518edc2a73185b6` after strict approval. It diagnosed thin/zero pools plus a narrow current-option post-processing gap, then made early option slots prefer distinct product-family signatures when alternatives exist.
Agent ack: Product Matching Agent completed the catalogue-variety diagnostic/fix on branch `codex/pm001-catalogue-variety-diagnostic`; PR #286 merged.
Current PR: none.
Blocker: Waiting for Sam's latest Product Matching retest result after PR #286.

### Ticket BL-004 RE-001 Sourcing Retest

Owner: Resilience Engineer_Product I...
Status: MERGED
Branch: `codex/re001-local-retest-followthrough`
Allowed scope: None unless Sam/Chief routes a fresh timeout/performance follow-up.
Forbidden scope: Same as RE-001 in the active control board.
Expected next artifact: None unless Sam/Chief routes a fresh timeout/performance follow-up.
SLA: None while parked after PR #285 merged.
Last architect instruction: PR #285 merged at `8c7c1b5b3ae9dfa118d0f1e2c9a75f4d36aa4ad6`, recording that RE-001 retest passed on latest `origin/main`; product/catalogue sourcing succeeded but still used text fallback after a roughly 45s visual-sourcing timeout.
Agent ack: complete.
Current PR: none; #285 merged (<https://github.com/Trueflutter/ritzy-studio/pull/285>)
Blocker: Parked after successful local/dev retest; fresh Sam/Chief route required for timeout/performance follow-up.

### Ticket BL-005 Stripe And Deployment Smoke

Owner: Ritzy Chief Architect
Status: APPROVAL_REQUIRED
Branch: none
Allowed scope: Planning/checklist only until Sam approves deployed env/webhook/payment smoke actions.
Forbidden scope: No live payment actions, production deploys, production flags, or external customer-facing changes without explicit Sam approval.
Expected next artifact: A beta launch ops checklist naming deployed environment variables, Stripe webhook URL/events, test account(s), rollback steps, and exact smoke-test boundary.
SLA: Prepare checklist before Wednesday beta launch.
Last architect instruction: V2-005 passed locally, but deployed Stripe webhook configuration remains a deployment step.
Agent ack: not started.
Current PR: none.
Blocker: Production/deployed actions require explicit Sam approval.
