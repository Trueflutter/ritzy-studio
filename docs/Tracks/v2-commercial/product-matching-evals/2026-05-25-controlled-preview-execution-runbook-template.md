# Controlled Preview Execution Runbook Template

Status: template only. This document does not approve Product Matching controlled-preview configuration or execution.

## Purpose

Prepare the exact approval and execution checklist Sam must approve before Product Matching Engine V1 can run in controlled default-off preview.

PR #129 improved deterministic warning specificity for future QA artifacts. That improves review clarity, but it does not change the activation gate.

## Required Approval Fields

Sam's approval must explicitly name:

- Scope:
- Project/room/user allowlist:
- Environment:
- App path or harness path:
- Write boundary:
- Stop rules:
- Rollback rules:
- Evidence artifacts required:
- Owner:
- Expiration or review date:

## Non-Approval Defaults

Until every field above is explicit:

- No controlled-preview configuration.
- No controlled-preview execution.
- No app-action execution.
- No allowlist expansion.
- No draft shopping-list create/refresh.
- No catalog row writes.
- No runtime/env-default changes.
- No production flags or deploys.
- No DB/schema/generated type changes.
- No UI/prompt/payment/checkout changes.
- No Catalog-First runtime coupling.

## Execution Checklist

Before execution:

- Confirm approval fields are complete.
- Confirm Product Matching remains default-off outside the named scope.
- Confirm environment and allowlist match the approval exactly.
- Confirm evidence artifact paths are ready.
- Confirm rollback owner and stop rules are understood.

During execution:

- Capture selected products, role confidence, warning/blocker counts, evidence completeness, dimension fit, and catalog freshness.
- Capture screenshots/contact sheets where safe.
- Stop immediately if a blocker appears outside the approved stop-rule tolerance.
- Do not widen scope mid-run.

After execution:

- Record results in `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/`.
- Update `docs/Tracks/v2-commercial/process/product-matching-agent-comms.md`.
- Open a small PR with evidence only.
- Do not change runtime defaults or production flags.

## Chief Architect Review Points

- Did the run stay within the exact approval?
- Were any live writes performed?
- Did any required role regress to missing or closest-available?
- Are warning classes still visible and specific after PR #129?
- Is a follow-up fix needed before broader preview?
