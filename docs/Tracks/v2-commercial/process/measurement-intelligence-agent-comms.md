# Measurement Intelligence Agent Comms

## Current PR
PR #144: <https://github.com/Trueflutter/ritzy-studio/pull/144>

Branch: `codex/measurement-layout-source-feasibility`

Previous completed PR: PR #102 (<https://github.com/Trueflutter/ritzy-studio/pull/102>) merged into `main` at `f61b4e2027762c023a14663649936cefbec42db5`.

## Current stage
DUAL_TRACK:
- `DB_SCHEMA_RUNTIME_BLOCKED_WAITING_FOR_SAM_APPROVAL`
- `APPROVED_DOCS_ONLY_LAYOUT_SOURCE_FEASIBILITY_PACK`

## Blockers
Do not apply Supabase migrations, change generated DB types, write seed data, connect to Supabase, add runtime/app/UI wiring, execute production imports, add external floor-plan parser/vendor integrations, or use user/private floor-plan assets without explicit Sam approval.

Raw floor plans are sensitive and may be copyrighted. Shared library value must default to reviewed structured facts, provenance, rights posture, confidence, disclaimers, and user confirmation gates rather than public raw-plan display.

## Chief architect routing
ARCHITECT_NOTE: PR #102 completed the Measurement Intelligence seed row adapter foundation. The lane went quiet because no tracked mailbox existed on `main`; this file restores durable routing.

Do not sit idle while DB/schema/runtime work is blocked. Start one docs-only Measurement Intelligence PR that prepares the first source-feasibility pack for real Dubai layout seeds without writing data:

1. Branch from latest `main`; suggested branch `codex/measurement-layout-source-feasibility`.
2. Add or update `docs/Tracks/v2-commercial/26_Measurement_Intelligence_Source_Feasibility_Pack.md`.
3. Pick 3-5 high-value Dubai villa/townhouse communities or developments for first reviewed seed candidates. Bias toward common UAE/Dubai homes where developer-layout prefills would reduce onboarding friction.
4. For each candidate, record public/source availability, likely layout identifiers/aliases, source rights posture, whether structured facts can be used without republishing raw plan images, expected room-measurement coverage, confidence, risks, and stop criteria.
5. Include a recommendation matrix: proceed to synthetic/sample seed, proceed to reviewed structured-facts seed, defer for partner/feed/permission, or stop.
6. Leave a tracked mailbox update pointing to the feasibility PR and keeping DB/schema/runtime/write work blocked.

Hard stop: this docs-only PR must not add migrations, generated DB types, runtime/UI/app actions, Supabase connections or writes, seed importer writes, production data, external parser/vendor integration, private/user floor-plan assets, raw copyrighted plan images, Product Matching runtime coupling, Catalog-First runtime coupling, deploys, production flags, payment/checkout changes, or live customer-facing behavior.

## Last action taken
PR #144 opened a docs-only source-feasibility pack for Measurement Intelligence layout-prefill candidates. It evaluates Murooj Al Furjan, Maple at Dubai Hills Estate, Elan at Tilal Al Ghaf, DAMAC Hills 2 Violet/Natura, and Arabian Ranches III Joy/Ruba for reviewed structured-facts seed feasibility.

## Next intended action
Implementation agent: monitor PR #144 for review feedback, `CHIEF_ARCHITECT_REPLY:` comments, checks, and mergeability. Do not merge unless the review explicitly says approved to merge. If the PR is rejected, fix only listed blockers within the docs-only feasibility-pack scope.

Create or keep a Measurement Intelligence heartbeat after opening the PR. The heartbeat should run every 10 minutes and monitor:

- the active Measurement Intelligence PR, if one exists
- `docs/Tracks/v2-commercial/process/measurement-intelligence-agent-comms.md`
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- GitHub checks/mergeability for the active PR

Do not delete the Measurement Intelligence heartbeat just because a PR merged. Delete a PR-specific monitor only after either a lane-level heartbeat is active or this mailbox on `main` points to the next safe action. If the PR merges and this mailbox does not name a specific approved next safe stage, leave an `ARCHITECT_NOTE:` requesting Chief Architect routing instead of going idle.

## Durable next-state handoff after merge
Recommended next safe stage after this routing PR merges: `APPROVED_DOCS_ONLY_LAYOUT_SOURCE_FEASIBILITY_PACK`. Do not start DB/schema migration, generated type changes, runtime/UI wiring, write-capable importers, external parser integrations, or real seed writes from this approval.

The Measurement Intelligence lane must maintain a heartbeat while work is active or routed. If the lane has no open PR and no approved safe next action, the heartbeat should leave an `ARCHITECT_NOTE:` requesting routing instead of going silent.
