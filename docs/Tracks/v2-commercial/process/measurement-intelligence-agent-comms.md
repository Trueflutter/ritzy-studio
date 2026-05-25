# Measurement Intelligence Agent Comms

## Current PR
PR #146: <https://github.com/Trueflutter/ritzy-studio/pull/146>

Branch: `codex/measurement-layout-seed-candidate-shortlist`

PR #144 (<https://github.com/Trueflutter/ritzy-studio/pull/144>) merged into `main`.

Previous completed PR: PR #102 (<https://github.com/Trueflutter/ritzy-studio/pull/102>) merged into `main` at `f61b4e2027762c023a14663649936cefbec42db5`.

## Current stage
DUAL_TRACK:
- `DB_SCHEMA_RUNTIME_BLOCKED_WAITING_FOR_SAM_APPROVAL`
- `APPROVED_DOCS_ONLY_SEED_CANDIDATE_SHORTLIST`

## Blockers
Do not apply Supabase migrations, change generated DB types, write seed data, connect to Supabase, add runtime/app/UI wiring, execute production imports, add external floor-plan parser/vendor integrations, or use user/private floor-plan assets without explicit Sam approval.

Raw floor plans are sensitive and may be copyrighted. Shared library value must default to reviewed structured facts, provenance, rights posture, confidence, disclaimers, and user confirmation gates rather than public raw-plan display.

## Chief architect routing
ARCHITECT_NOTE: PR #102 completed the Measurement Intelligence seed row adapter foundation. The lane went quiet because no tracked mailbox existed on `main`; this file restores durable routing.

Do not sit idle while DB/schema/runtime work is blocked. PR #144 completed the first source-feasibility pack. Start one docs-only Measurement Intelligence PR that converts that feasibility into a seed-candidate shortlist without writing data:

1. Branch from latest `main`; suggested branch `codex/measurement-layout-seed-candidate-shortlist`.
2. Add or update `docs/Tracks/v2-commercial/28_Measurement_Intelligence_Seed_Candidate_Shortlist.md`.
3. Select 1-2 lowest-risk candidates from PR #144 for a later reviewed structured-facts seed PR.
4. For each candidate, propose stable slugs, aliases, source-rights status, confidence defaults, disclaimers, expected room rows, known missing measurements, and stop criteria.
5. Include an explicit go/no-go recommendation for whether the next PR should add a repo-managed reviewed seed JSON candidate or remain docs-only.
6. Leave a tracked mailbox update pointing to the shortlist PR and keeping DB/schema/runtime/write work blocked.

Hard stop: this docs-only PR must not add migrations, generated DB types, runtime/UI/app actions, Supabase connections or writes, seed importer writes, production data, external parser/vendor integration, private/user floor-plan assets, raw copyrighted plan images, Product Matching runtime coupling, Catalog-First runtime coupling, deploys, production flags, payment/checkout changes, or live customer-facing behavior.

## Last action taken
PR #146 opened a docs-only seed-candidate shortlist. It narrows PR #144's feasibility pack to Murooj Al Furjan 4-bedroom townhouse and Maple at Dubai Hills Estate 4-bedroom Type 2E as the lowest-risk first reviewed structured-facts seed candidates.

## Next intended action
Implementation agent: monitor PR #146 for review feedback, `CHIEF_ARCHITECT_REPLY:` comments, checks, and mergeability. Do not merge unless the review explicitly says approved to merge. If the PR is rejected, fix only listed blockers within the docs-only seed-candidate-shortlist scope.

Create or keep a Measurement Intelligence heartbeat after opening the PR. The heartbeat should run every 10 minutes and monitor:

- the active Measurement Intelligence PR, if one exists
- `docs/Tracks/v2-commercial/process/measurement-intelligence-agent-comms.md`
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- GitHub checks/mergeability for the active PR

Do not delete the Measurement Intelligence heartbeat just because a PR merged. Delete a PR-specific monitor only after either a lane-level heartbeat is active or this mailbox on `main` points to the next safe action. If the PR merges and this mailbox does not name a specific approved next safe stage, leave an `ARCHITECT_NOTE:` requesting Chief Architect routing instead of going idle.

## Durable next-state handoff after merge
Recommended next safe stage after this routing PR merges: `APPROVED_DOCS_ONLY_SEED_CANDIDATE_SHORTLIST`. Do not start DB/schema migration, generated type changes, runtime/UI wiring, write-capable importers, external parser integrations, or real seed writes from this approval.

The Measurement Intelligence lane must maintain a heartbeat while work is active or routed. If the lane has no open PR and no approved safe next action, the heartbeat should leave an `ARCHITECT_NOTE:` requesting routing instead of going silent.
