# Measurement Intelligence Agent Comms

## Current PR
PR #151: <https://github.com/Trueflutter/ritzy-studio/pull/151>

Branch: `codex/measurement-reviewed-seed-json-candidate`

PR #146 (<https://github.com/Trueflutter/ritzy-studio/pull/146>) merged into `main`.

PR #144 (<https://github.com/Trueflutter/ritzy-studio/pull/144>) merged into `main`.

Previous completed PR: PR #102 (<https://github.com/Trueflutter/ritzy-studio/pull/102>) merged into `main` at `f61b4e2027762c023a14663649936cefbec42db5`.

## Current stage
DUAL_TRACK:
- `DB_SCHEMA_RUNTIME_BLOCKED_WAITING_FOR_SAM_APPROVAL`
- `APPROVED_DOMAIN_ONLY_REVIEWED_SEED_JSON_CANDIDATE`

## Blockers
Do not apply Supabase migrations, change generated DB types, write seed data, connect to Supabase, add runtime/app/UI wiring, execute production imports, add external floor-plan parser/vendor integrations, or use user/private floor-plan assets without explicit Sam approval.

Raw floor plans are sensitive and may be copyrighted. Shared library value must default to reviewed structured facts, provenance, rights posture, confidence, disclaimers, and user confirmation gates rather than public raw-plan display.

## Chief architect routing
ARCHITECT_NOTE: PR #102 completed the Measurement Intelligence seed row adapter foundation. The lane went quiet because no tracked mailbox existed on `main`; this file keeps durable routing active.

Do not sit idle while DB/schema/runtime work is blocked. PR #146 completed the seed-candidate shortlist and recommended a future repo-managed reviewed seed JSON candidate for Murooj Al Furjan 4-bedroom townhouse and Maple at Dubai Hills Estate 4-bedroom Type 2E. Start one small domain-only Measurement Intelligence PR that adds the first reviewed structured-facts seed JSON candidate without any importer writes:

1. Branch from latest `main`; suggested branch `codex/measurement-reviewed-seed-json-candidate`.
2. Add a repo-managed candidate JSON fixture in a docs/domain path, using the already-documented shortlist shape as source of truth. Prefer one tiny file first if the existing repo has no established candidate-seed path; document the chosen path in the PR body and mailbox.
3. Include only structured facts, provenance URLs, aliases, source-rights status `structured_facts_only`, conservative confidence defaults, disclaimers, expected room rows, missing-measurement notes, and stop criteria.
4. Use only Murooj Al Furjan 4-bedroom townhouse and/or Maple at Dubai Hills Estate 4-bedroom Type 2E. Do not add DAMAC Hills 2, Arabian Ranches III, Elan, broader Maple phases, or raw floor-plan assets in this PR.
5. Keep all dimensions approximate or `unknown` unless the reviewed source proves a structured fact; never imply tight-clearance or product-fit safety.
6. Add schema/shape notes or tests only if the existing docs/domain harness already supports them without runtime/importer wiring.
7. Leave a tracked mailbox update pointing to the seed-candidate PR and keeping DB/schema/runtime/write work blocked.

Hard stop: this domain-only PR must not add migrations, generated DB types, runtime/UI/app actions, Supabase connections or writes, seed importer writes, production data, external parser/vendor integration, private/user floor-plan assets, raw copyrighted plan images, Product Matching runtime coupling, Catalog-First runtime coupling, deploys, production flags, payment/checkout changes, or live customer-facing behavior.

## Last action taken
PR #151 opened the first reviewed structured-facts seed JSON candidate. It adds one default-off Murooj Al Furjan 4-bedroom townhouse candidate and a focused domain schema parse test.

## Next intended action
Implementation agent: monitor PR #151 for review feedback, `CHIEF_ARCHITECT_REPLY:` comments, checks, and mergeability. Do not merge unless the review explicitly says approved to merge. If the PR is rejected, fix only listed blockers within the domain-only reviewed-seed-JSON-candidate scope.

Create or keep a Measurement Intelligence heartbeat after starting the PR. The heartbeat should run every 10 minutes and monitor:

- the active Measurement Intelligence PR, if one exists
- `docs/Tracks/v2-commercial/process/measurement-intelligence-agent-comms.md`
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- GitHub checks/mergeability for the active PR

Do not delete the Measurement Intelligence heartbeat just because a PR merged. Delete a PR-specific monitor only after either a lane-level heartbeat is active or this mailbox on `main` points to the next safe action. If the PR merges and this mailbox does not name a specific approved next safe stage, leave an `ARCHITECT_NOTE:` requesting Chief Architect routing instead of going idle.

## Durable next-state handoff after merge
Recommended next safe stage after this routing PR merges: `APPROVED_DOMAIN_ONLY_REVIEWED_SEED_JSON_CANDIDATE`. Do not start DB/schema migration, generated type changes, runtime/UI wiring, write-capable importers, external parser integrations, or real seed writes from this approval.

The Measurement Intelligence lane must maintain a heartbeat while work is active or routed. If the lane has no open PR and no approved safe next action, the heartbeat should leave an `ARCHITECT_NOTE:` requesting routing instead of going silent.
