# Measurement Intelligence Agent Comms

## Current PR
PR #158: <https://github.com/Trueflutter/ritzy-studio/pull/158>

Branch: `codex/measurement-maple-reviewed-seed-json-candidate`

PR #151 (<https://github.com/Trueflutter/ritzy-studio/pull/151>) merged into `main`.

PR #146 (<https://github.com/Trueflutter/ritzy-studio/pull/146>) merged into `main`.

PR #144 (<https://github.com/Trueflutter/ritzy-studio/pull/144>) merged into `main`.

Previous completed PR: PR #102 (<https://github.com/Trueflutter/ritzy-studio/pull/102>) merged into `main` at `f61b4e2027762c023a14663649936cefbec42db5`.

## Current stage
DUAL_TRACK:
- `DB_SCHEMA_RUNTIME_BLOCKED_WAITING_FOR_SAM_APPROVAL`
- `APPROVED_DOMAIN_ONLY_MAPLE_REVIEWED_SEED_JSON_CANDIDATE`

## Blockers
Do not apply Supabase migrations, change generated DB types, write seed data, connect to Supabase, add runtime/app/UI wiring, execute production imports, add external floor-plan parser/vendor integrations, or use user/private floor-plan assets without explicit Sam approval.

Raw floor plans are sensitive and may be copyrighted. Shared library value must default to reviewed structured facts, provenance, rights posture, confidence, disclaimers, and user confirmation gates rather than public raw-plan display.

## Chief architect routing
ARCHITECT_NOTE: PR #151 added the first default-off reviewed structured-facts seed JSON candidate for Murooj Al Furjan. Keep the lane moving with the second candidate already shortlisted in PR #146, but do not widen into runtime/importer/schema work.

Do not sit idle while DB/schema/runtime work is blocked. Start one small domain-only Measurement Intelligence PR that adds the Maple at Dubai Hills Estate 4-bedroom Type 2E reviewed structured-facts seed candidate:

1. Branch from latest `main`; suggested branch `codex/measurement-maple-reviewed-seed-json-candidate`.
2. Extend `docs/Tracks/v2-commercial/measurement-layout-seed.reviewed-candidates.json` with exactly one Maple at Dubai Hills Estate 4-bedroom Type 2E candidate.
3. Include only structured facts, provenance URLs, aliases, source-rights status `structured_facts_only`, conservative confidence defaults, disclaimers, expected room rows, missing-measurement notes, and stop criteria.
4. Keep the candidate default-off and prefill-only. Keep all dimensions approximate or `unknown` unless the reviewed source proves a structured fact; never imply tight-clearance or product-fit safety.
5. Do not add DAMAC Hills 2, Arabian Ranches III, Elan, broader Maple phases, raw floor-plan assets, importer wiring, Supabase writes, or runtime/UI behavior.
6. Extend the focused domain schema parse test only as needed to prove the reviewed-candidate JSON stays valid and prefill-only.
7. Leave a tracked mailbox update pointing to the Maple candidate PR and keeping DB/schema/runtime/write work blocked.

Hard stop: this domain-only PR must not add migrations, generated DB types, runtime/UI/app actions, Supabase connections or writes, seed importer writes, production data, external parser/vendor integration, private/user floor-plan assets, raw copyrighted plan images, Product Matching runtime coupling, Catalog-First runtime coupling, deploys, production flags, payment/checkout changes, or live customer-facing behavior.

## Last action taken
PR #158 adds the Maple at Dubai Hills Estate 4-bedroom Type 2E reviewed structured-facts seed JSON candidate. It extends the existing default-off reviewed-candidates file and focused domain schema parse test.

## Next intended action
Implementation agent: monitor PR #158 for review feedback, `CHIEF_ARCHITECT_REPLY:` comments, checks, and mergeability. Do not merge unless the review explicitly says approved to merge. If the PR is rejected, fix only listed blockers within the domain-only Maple reviewed-seed-JSON-candidate scope.

After PR #158 merges, treat the Maple reviewed seed candidate stage as complete. Do not continue into more seed records, importer writes, database/schema work, runtime wiring, or parser/vendor integration without an explicit next approved stage from the Chief Architect or Sam.

Create or keep a Measurement Intelligence heartbeat after starting the PR. The heartbeat should run every 10 minutes and monitor:

- the active Measurement Intelligence PR, if one exists
- `docs/Tracks/v2-commercial/process/measurement-intelligence-agent-comms.md`
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- GitHub checks/mergeability for the active PR

Do not delete the Measurement Intelligence heartbeat just because a PR merged. Delete a PR-specific monitor only after either a lane-level heartbeat is active or this mailbox on `main` points to the next safe action. If the PR merges and this mailbox does not name a specific approved next safe stage, leave an `ARCHITECT_NOTE:` requesting Chief Architect routing instead of going idle.

## Durable next-state handoff after merge
After PR #158 merges, there is no further Measurement Intelligence stage approved in this mailbox. Keep DB/schema/runtime/write work blocked, keep the Measurement Intelligence heartbeat active, and request Chief Architect routing before starting another PR.

Do not start DB/schema migration, generated type changes, runtime/UI wiring, write-capable importers, external parser integrations, additional reviewed seed records, or real seed writes from this approval.

The Measurement Intelligence lane must maintain a heartbeat while work is active or routed. If the lane has no open PR and no approved safe next action, the heartbeat should leave an `ARCHITECT_NOTE:` requesting routing instead of going silent.
