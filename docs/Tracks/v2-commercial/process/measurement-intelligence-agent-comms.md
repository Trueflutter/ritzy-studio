# Measurement Intelligence Agent Comms

## Current PR
Pending PR for docs-only Measurement Intelligence investor readiness pack.

Branch: `codex/measurement-intelligence-investor-readiness`

Previous completed PRs:
- PR #151 (<https://github.com/Trueflutter/ritzy-studio/pull/151>) merged the first default-off reviewed structured-facts seed JSON candidate for Murooj Al Furjan.
- PR #146 (<https://github.com/Trueflutter/ritzy-studio/pull/146>) merged the docs-only seed-candidate shortlist.
- PR #144 (<https://github.com/Trueflutter/ritzy-studio/pull/144>) merged the docs-only source-feasibility pack.
- PR #102 (<https://github.com/Trueflutter/ritzy-studio/pull/102>) merged the Measurement Intelligence seed row adapter foundation.

## Current stage
DUAL_TRACK:
- `DB_SCHEMA_RUNTIME_BLOCKED_WAITING_FOR_SAM_APPROVAL`
- `MEASUREMENT_INVESTOR_READINESS_PACK_IN_REVIEW`

## Blockers
Do not apply Supabase migrations, change generated DB types, write seed data, connect to Supabase, add runtime/app/UI wiring, execute production imports, add external floor-plan parser/vendor integrations, or use user/private floor-plan assets without explicit Sam approval.

Raw floor plans are sensitive and may be copyrighted. Shared library value must default to reviewed structured facts, provenance, rights posture, confidence, disclaimers, and user confirmation gates rather than public raw-plan display.

## Chief architect routing
PR #158 completed the Maple at Dubai Hills Estate 4-bedroom Type 2E reviewed structured-facts seed JSON candidate. There is no active Measurement Intelligence PR and no further Measurement Intelligence implementation stage approved in this mailbox.

Current docs-only scope: prepare a Measurement Intelligence investor readiness pack that summarizes completed reviewed seed candidates, the `structured_facts_only` posture, provenance/confidence policy, future DB/runtime requirements, and blocked work. This PR must not add seed records, importer writes, database/schema work, runtime wiring, parser/vendor integration, or real seed writes.

Hard stop: no Measurement Intelligence work may add migrations, generated DB types, runtime/UI/app actions, Supabase connections or writes, seed importer writes, production data, external parser/vendor/OCR integration, private/user floor-plan assets, raw copyrighted floor-plan images, Product Matching runtime coupling, Catalog-First runtime coupling, deploys, production flags, payment/checkout changes, or live customer-facing behavior without explicit approval.

## Last action taken
PR #158 completed the Maple reviewed structured-facts seed JSON candidate. It added exactly one default-off, prefill-only, `structured_facts_only` Maple at Dubai Hills Estate 4-bedroom Type 2E candidate and kept dimensions omitted unless reviewed sources prove structured facts.

This docs-only PR adds `docs/Tracks/v2-commercial/34_Measurement_Intelligence_Investor_Readiness_Pack.md` and keeps the lane implementation-blocked.

## Next intended action
Review the docs-only investor readiness pack. After it merges, wait for explicit Chief Architect or Sam routing before any additional seed records, importer writes, DB/schema work, runtime wiring, parser/vendor integration, or real seed writes.

If a concrete next safe scope is approved, open one small PR, leave an `ARCHITECT_NOTE:` on that PR with the approved scope and stop-rule confirmation, and recreate the Measurement Intelligence PR-check heartbeat.

## Heartbeat
Keep the Measurement Intelligence lane heartbeat active while the lane is parked. It should monitor:

- this mailbox file
- active Measurement Intelligence PRs, if any
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- explicit Chief Architect or Sam routing in the coordinator thread

Do not delete the Measurement Intelligence heartbeat just because a PR merged. Delete a PR-specific monitor only after either a lane-level heartbeat is active or this mailbox on `main` points to the next safe action.
