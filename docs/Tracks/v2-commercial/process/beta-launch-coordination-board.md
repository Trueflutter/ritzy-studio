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
Status: ROUTE_READY
Branch: none
Allowed scope: Local/dev end-to-end designer-path QA, docs-only evidence, and one narrow local/dev fix PR if a beta-blocking issue is found.
Forbidden scope: No production deploys, production flags, live payment actions, live catalog writes, live ingestion, DB/schema/generated type changes, controlled-preview expansion, Product Matching default-on activation, runtime allowlist expansion, broad UI redesign, or payment/checkout architecture changes.
Expected next artifact: `ARCHITECT_NOTE:` or PR documenting designer login/onboarding, designer mode selection, project creation, room creation, photo upload, brief/questions/style/inspiration flow, concept generation path, product matching/shopping-list path, presentation/client-facing path, navigation, subscription/paywall expectations, and P0/P1/P2 blockers.
SLA: Acknowledge within one heartbeat after Sam creates the agent session; evidence, PR, or blocker within 30 minutes after acknowledgement.
Last architect instruction: Sam asked whether to create a new chat session; Chief Architect confirmed yes and provided the stricter Designer Path QA Agent prompt.
Agent ack: waiting for Sam-created agent session.
Current PR: none.
Blocker: Waiting for the Designer Path QA Agent session to be created and prompted.

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
Status: WAITING_FOR_SAM_TEST
Branch: none
Allowed scope: After Sam's morning retest, local/dev diagnostics, tests, and one narrow fix PR focused on repeated/similar catalogues, repeated-product selection, and role/product fit.
Forbidden scope: No blind validation, controlled preview, production/default-on activation, live app actions, live catalog writes, catalogue/product mutations, DB/schema/generated type changes, runtime allowlist expansion, broad scoring rewrite, prompt/runtime image-generation behavior changes, payment/checkout changes, deploys, final-render execution, or Catalog-First coupling.
Expected next artifact: Sam's retest readout. If the concern reproduces, route Product Matching Agent with the prepared variety/fit prompt.
SLA: Once Sam posts retest evidence, route or park within one heartbeat.
Last architect instruction: Sam's key concern is that recent Product Matching tests produced similar catalogues again and again, with products not always matching.
Agent ack: not routed for this new concern yet.
Current PR: none.
Blocker: Waiting for Sam's latest Product Matching retest result.

### Ticket BL-004 RE-001 Sourcing Retest

Owner: Resilience Engineer_Product I...
Status: EVIDENCE_REPORTED
Branch: `codex/re001-local-retest-followthrough`
Allowed scope: None unless Sam/Chief routes a fresh timeout/performance follow-up.
Forbidden scope: Same as RE-001 in the active control board.
Expected next artifact: PR #285 review/merge for durable board/evidence update, then no further RE-001 action unless routed.
SLA: PR #285 should be reviewed/merged or fixed promptly.
Last architect instruction: RE-001 reported the retest passed on latest `origin/main`; product/catalogue sourcing succeeded but still used text fallback after a roughly 45s visual-sourcing timeout.
Agent ack: complete.
Current PR: #285 `docs: record RE-001 retest followthrough`
Blocker: Needs PR Review Agent review for PR #285.

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
