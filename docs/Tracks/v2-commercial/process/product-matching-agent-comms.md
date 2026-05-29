# Product Matching Engine Agent Comms

## Current PR
None. PR #249 (<https://github.com/Trueflutter/ritzy-studio/pull/249>) merged at `8f2591537ec884e65b79b5325c1d44f2972f6176` after PR Review Agent approval.

## Current stage
DUAL_TRACK:
- `PM001_AESTHETIC_TASTE_GATE_POST_MERGE_VALIDATED_LOCAL_DEV`
- `PM001_NARRATIVE_READINESS_RECOMMENDATION_READY_FOR_REVIEW`
- `PM001_COFFEE_TABLE_QUALITY_FIX_MERGED_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION`
- `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` remains the runtime gate outside the approved local/dev current test boundary

## Blockers
PM-001 is blocked pending `NEXT_PM001_LOCAL_DEV_FIX_BOUNDARY_REQUIRED`. PR #249 completed the thin/empty option-pool warning guard/test, so no further Product Matching implementation or execution is approved right now. The next expected action is Sam/Chief approval for exactly one narrow local/dev fix boundary, or a Product Matching Agent `ARCHITECT_NOTE:` proposing the smallest safe slice. Sam approved the earlier local/dev PM-001 aesthetic-quality rescue in-thread on 2026-05-27 after a catalogue-grounded test render produced an unsuitable black/brown pedestal shell chair and a noisy striped coffee table; that prior boundary is not approval for additional execution or implementation after PR #249.

PM-001 coffee-table blocker has a narrow fix and one approved local/dev retest. Retest `ai_jobs` row `182e8d5b-2386-4f1a-a139-5d905e67d2fe` passes QA stop rules with 0 blockers; Chief/Sam review is still required before customer-facing reuse or any further execution.

Product Matching Engine V1 is still not approved for production deploys, production flags, broad/runtime allowlist expansion, app actions, draft shopping-list/catalog writes, live catalog writes, DB/schema changes, generated DB types, runtime/UI redesign/prompt changes, payment/checkout changes, default-on activation, production rollout, selection/scoring changes, Catalog-First runtime coupling, new preview targets, or broader execution without a new approval.

The PR #240 validation boundary expired after PR #242: one local/dev validation pass and one evidence artifact are complete. The next PM-001 implementation step needs a fresh Sam/Chief boundary before Product Matching Agent resumes code or runtime work.

## Chief architect routing
PRODUCT_MATCHING_AGENT_ACK: 2026-05-29 — Product Matching Agent acknowledges PM-001 stale recovery on branch `codex/pm-001-validation-20260529`, based on latest `origin/main` at `a394e25afa57986c2006fe460368329614fe1786`. Scope accepted: exactly one local/dev validation pass for project `4207ade6-2604-4e15-9b05-ffa77531d3d2`, room `75e18e73-cf69-4b2e-b192-009fbc135b38`, Sam local/dev account, localhost/local dev, existing catalogue rows only, with only existing app-flow local/dev concept/job/shopping-list rows required by the validation flow. Stop rules accepted: no production deploys/flags, rollout, live app actions, catalogue/product writes, live ingestion, DB/schema/generated type changes, controlled-preview expansion, runtime allowlist expansion, payment/checkout changes, broad scoring rewrites, prompt/runtime/image-generation behavior changes beyond validation, floor-plan work, or Catalog-First coupling.

CHIEF_ARCHITECT_REPLY: STALE RECOVERY — Product Matching Agent / PM-001 missed the acknowledgement heartbeat after PR #240 merged on `main` at `71b9b15c02e207cf00d5847ea4636a204ddbbdea`. Pull latest `origin/main`, create a clean branch, and acknowledge with the branch name before execution. Run exactly one local/dev validation pass on project `4207ade6-2604-4e15-9b05-ffa77531d3d2`, room `75e18e73-cf69-4b2e-b192-009fbc135b38`, Sam local/dev account, localhost, existing catalogue rows only. Allowed writes: existing app-flow local/dev concept/job/shopping-list rows required by validation. Evidence artifact must cover persisted selection snapshot, selected SKUs, render/list fidelity, missing roles, recommendation similarity, repeated sofa/support-role regressions, and next narrow code boundary if validation fails. Stop before production deploys/flags, rollout, live app actions, catalogue/product writes, live ingestion, DB/schema/generated type changes, controlled-preview expansion, runtime allowlist expansion, payment/checkout changes, broad scoring rewrites, prompt/runtime/image-generation changes beyond validation, floor-plan work, or Catalog-First coupling.

CHIEF_ARCHITECT_REPLY: Sam approved the bounded PM-001 local/dev validation pass in the coordinator thread on 2026-05-28 before going offline. Product Matching Agent owns the next task. Pull latest `origin/main` after PR #239, create a clean branch, and acknowledge this route with the branch name before execution. Scope: one local/dev validation pass on project `4207ade6-2604-4e15-9b05-ffa77531d3d2`, room `75e18e73-cf69-4b2e-b192-009fbc135b38`, Sam's local/dev account, localhost environment, using existing catalogue rows only. Allowed writes: existing app-flow local/dev concept/job/shopping-list rows required by the validation flow. Evidence artifact: validation note/PR covering persisted selection snapshot, selected SKUs, render/list fidelity, missing roles, recommendation similarity, whether repeated sofa/support-role regressions remain, and the next narrow code boundary if validation fails. Expiration: one validation pass and one evidence artifact. Rollback/cleanup: do not mutate catalogue/product rows; document any local/dev rows created and stop for Chief/Sam direction before destructive cleanup. Stop before production deploys/flags, rollout, live app actions, catalogue/product writes, live ingestion, DB/schema/generated type changes, controlled-preview expansion, runtime allowlist expansion, payment/checkout changes, broad scoring rewrites, prompt/runtime/image-generation behavior changes, floor-plan work, or Catalog-First coupling.

ARCHITECT_NOTE: PR #238 merged into `main` at `d398ea42048e5276ea5e89ec15ccfe7490532f65` after approval. It completed the PM-001 auditability-first implementation slice: local/dev `persistedSelectionSnapshot` in `ai_jobs.output_summary` after shopping-list post-processing, source/final SKU and replacement metadata, refresh-diversity first-position coverage, and support-role media-console fallback coverage. No browser-click Product Matching execution, controlled preview, live catalogue writes/ingestion, catalogue/product row mutations, DB/schema/generated type changes, production deploys/flags, runtime allowlist expansion, UI/prompt/payment/floor-plan work, broad scoring rewrite, default-on activation, or Catalog-First coupling was performed.

CHIEF_ARCHITECT_REPLY: Next PM-001 step is a bounded local/dev validation boundary, not another blind code slice. Proposed boundary: Product Matching Agent may run one local/dev validation pass on the existing demo project/room/user after pulling latest main with PR #238, using existing catalogue rows only, to confirm the new persisted-selection snapshot captures post-processed shopping-list rows and to isolate remaining render/list fidelity defects. Required fields before execution: exact project id, room id, user/email, localhost port/env, allowed writes, stop rules, rollback rules, evidence artifact, owner, and expiration. Stop before production deploys/flags, controlled-preview expansion, runtime allowlist expansion, catalogue/product writes, live ingestion, DB/schema/generated type changes, payment/checkout changes, floor-plan work, broad scoring rewrites, prompt/runtime/image-generation behavior changes, or Catalog-First coupling.

CHIEF_ARCHITECT_REPLY: Product Matching Agent / PM-001 owns the next task. Pull latest `origin/main` after PR #236, create a clean branch, and acknowledge this route with the branch name before work. Scope: auditability-first persisted-selection snapshotting after shopping-list post-processing, focused local/dev refresh-diversity hardening tests, and support-role light/mirror/media preference tests. Keep the implementation narrow and local/dev-safe: no schema/generated type changes, no catalogue/product row mutations, no production activation, no deploys/flags, no runtime allowlist expansion, no controlled preview expansion, no payment/checkout changes, no floor-plan work, no broad scoring rewrite, and no Catalog-First coupling. If the implementation cannot be done without crossing those gates, stop with a blocker and the smallest requested boundary. Expected artifact: focused PR or explicit blocker, with tests/evidence showing persisted shopping-list rows can be audited against post-processed selections before another blind browser/final-render pass.

CHIEF_ARCHITECT_REPLY: Product Matching Agent / PM-001 is the owner for the next task. Pull latest `origin/main` after PR #232, create a clean branch, and acknowledge this route with the branch name before work. Scope: post-#232 local/dev validation and failure isolation for repeated sofa selection, missing support roles such as lamps/TV console where catalogue options exist, render-to-shopping-list SKU fidelity, and same-role/same-palette recommendation alternatives. Expected artifact: a validation note or PR with selected SKUs, repeated-sofa behavior, missing role analysis, render/list fidelity, recommendation similarity, and the next narrow code boundary if validation fails. Do not wait for Sam to pass chat messages between agents. Stop before production deploys/flags, live catalogue writes/ingestion, DB/schema/generated type changes, payment/checkout changes, controlled preview expansion, runtime allowlist expansion, floor-plan work, Catalog-First coupling, broad scoring rewrites, or catalogue/product row mutations.

ARCHITECT_NOTE: PR #232 merged into `main` at `61dee4fe12e6e668903f60d16e8d1e168aaa7ac1` after approval. It completed deterministic local/dev PM-001 refresh-history diversity and soft-neutral support-role filtering. The diversity layer stays inside option composition and is supplied by the app only when `localSkuFidelityMode` is active, preserving the `RITZY_AESTHETIC_TASTE_GATE` + non-production + living-room guard. Local/dev validation evidence is recorded in the PR body with jobs `5473e873-ca82-44ad-a0e1-3ae6981e47f8` and `515c8a09-ec4c-4cc2-be00-47f348f5e6c3`. No additional Product Matching execution beyond the approved local/dev validation, controlled preview, production deploys/flags, live catalogue writes/ingestion, schema/generated type changes, payment/checkout changes, runtime allowlist expansion, Catalog-First coupling, floor-plan work, randomness, or global AI prompting/ranking activation was performed.

ARCHITECT_NOTE: PR #230 merged into `main` at `bdd20f314890de95cd11d3b02060c4933b0dbd19` after approval. It completed the focused PM-001 support-role quality and visual-sourcing timeout-diagnosis slice: support-role ranking, deterministic fallback-family filtering, timeout diagnostic metadata, process-doc coordination pointers, and durable local/dev read-only evidence at `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/2026-05-28-pm001-support-role-timeout-diagnosis.md`. No additional Product Matching execution, controlled preview, preview QA, app actions, shopping-list/catalog writes, live writes, production deploys/flags, broad/runtime allowlist expansion, schema/generated type changes, UI/prompt/payment/checkout changes, default-on activation, production rollout, broad scoring rewrite, floor-plan work, unrelated quality changes, or Catalog-First runtime coupling was performed.

ARCHITECT_NOTE: PR #230 was opened on branch `codex/pm001-support-role-timeout-diagnosis`. Scope: focused PM-001 support-role ranking, deterministic fallback-family filtering, timeout diagnostic metadata, and durable local/dev readback evidence after PR #226, PR #227, PR #228, and PR #229. It did not run another Product Matching preview, invoke app actions, write shopping-list/catalog rows, change production flags, expand allowlists, change schema/generated types, change payment/checkout/UI, perform floor-plan work, activate default-on behavior, or add Catalog-First runtime coupling. Review focused on the support-role/fallback/diagnostic slice only and approved the PR before merge.

ARCHITECT_NOTE: PR #226 merged into `main` at `ccf1faa1b721ea847cf158793c9b618179bcde5e`. It improves local/dev living-room SKU fidelity for the investor demo with role-window candidate widening, catalogue-anchor divergence handling, support-role render guard, sofa aesthetic scoring, final-render product fidelity prompt language, and render reference expansion. Review verification included `git diff --check`, `pnpm install --offline --frozen-lockfile`, `pnpm --filter @ritzy-studio/web typecheck`, `pnpm --filter @ritzy-studio/web lint`, `pnpm --filter @ritzy-studio/domain test`, `pnpm --filter @ritzy-studio/domain typecheck`, `pnpm --filter @ritzy-studio/ai test`, `pnpm --filter @ritzy-studio/ai typecheck`, and `pnpm --filter @ritzy-studio/prompts typecheck`. The unrelated `@ritzy-studio/prompts` test baseline failure on `origin/main` was noted by review. No production deploys/flags, live catalog writes/ingestion, schema/generated type changes, payment/checkout changes, floor-plan work, Catalog-First coupling, controlled-preview expansion, production activation, runtime allowlist expansion, or catalogue/product row mutations were performed.

CHIEF_ARCHITECT_REPLY:
Founder/local-dev boundary confirmed for PM-001 aesthetic-quality rescue. PR #220 merged the approved local/dev implementation.

Approval source:
- Sam's in-thread goal on 2026-05-27: deliver an investor-demo-quality catalogue-grounded living-room flow with actual SKUs, target aesthetic score 9/10 or better, no visibly unsuitable hero items, and no office/task/dining/shell/pedestal chair unless explicitly requested.
- Chief interpretation: catalogue grounding is now technically working, but aesthetic SKU arbitration is a product-quality blocker for investor demo. The next safe slice is a local/dev-only taste gate plus tests and evidence.

Exact approved boundary:
- Environment: local/dev only, `http://localhost:3001`
- App path: existing local user flow from room/photo/brief through concepts, product matching, and shopping-list
- Read boundary: existing local/dev catalogue data, room assets, concepts, products, job summaries, and generated render evidence needed for the investor-demo room
- Write boundary: code/tests/docs plus local/dev concept/job/shopping-list rows needed to validate the aesthetic-quality rescue; no catalogue/product row mutations
- Acceptance rubric: selected hero SKUs must be actual ingested products; chair, coffee table, sofa, and rug must belong together; no office/task/dining/shell/pedestal chair unless explicitly requested; no noisy coffee table paired with a patterned rug; shopping list must preserve rendered catalogue anchors; strict aesthetic review target is 9/10 or better
- Evidence artifact: `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/2026-05-27-aesthetic-taste-gate.md`
- Expiration: PR review/merge decision for the aesthetic-quality rescue; further execution after that requires a fresh Sam/Chief boundary
- Stop rules: stop before production deploys/flags, live catalog writes/ingestion, schema/generated types, payment/checkout changes, controlled-preview expansion, runtime allowlist expansion, floor-plan work, Catalog-First coupling, production activation, or unrelated quality changes

ARCHITECT_NOTE: PR #220 merged into `main` at `abf2e517db19d8e1fd7cd2adcc6f11a01c82405b`. It adds a local/dev-only aesthetic taste gate behind `RITZY_AESTHETIC_TASTE_GATE=1` and `NODE_ENV !== "production"`, living-room chair suitability rules, coffee-table/rug visual-noise checks, widened local/demo role pools, source-room preservation prompt language for initial and final renders, `image/jpg` MIME normalization, and shopping-list anchor preservation/optional recommendation polish. Durable evidence is in `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/2026-05-27-aesthetic-taste-gate.md` with screenshot asset `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/assets/2026-05-27-aesthetic-taste-gate.png`. Verification before merge included `git diff --check`, `pnpm --filter @ritzy-studio/domain test`, `pnpm --filter @ritzy-studio/ai test`, `pnpm --filter @ritzy-studio/web typecheck`, `pnpm --filter @ritzy-studio/web lint`, and adversarial review. No production deploys/flags, live catalog writes/ingestion, schema/generated type changes, payment/checkout changes, floor-plan work, Catalog-First coupling, controlled-preview expansion, or production activation were performed.

ARCHITECT_NOTE: PR #221 merged into `main` at `8698fcdf66c49c8d91f505802ed62e1360143b08` and corrected post-merge PM-001 board/mailbox state. Post-merge validation for PR #220 is recorded at `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/2026-05-27-aesthetic-taste-gate-post-merge-validation.md`. No app actions, new Product Matching execution, controlled preview, catalogue writes, live ingestion, schema/generated type changes, payment/checkout changes, floor-plan work, production flags, or deploys were performed.

ARCHITECT_NOTE: PR #217 merged at `e75a40067a8c0dc1fc2b6d5b2318610ec41b5548` after explicit Chief boundary approval and strict review. It implements catalogue-grounded initial concept generation, anchor persistence in concept job summaries, downstream anchor enforcement/preselection during product grounding, bounded remote product-image fetches, cue evidence tightening, and revision stop behavior for catalogue-grounded concepts. Verification before merge included `git diff --check origin/main...HEAD`, `pnpm --filter @ritzy-studio/ai test`, `pnpm --filter @ritzy-studio/domain test`, `pnpm --filter @ritzy-studio/web typecheck`, and `pnpm --filter @ritzy-studio/web lint`. No Product Matching execution, controlled preview, preview QA, app actions, shopping-list/catalog writes, live writes, deploys/flags, allowlist expansion, DB/schema/generated type changes, UI/payment/checkout work, floor-plan work, broad scoring rewrites, or Catalog-First coupling was performed.

ARCHITECT_NOTE: PR #216 prepared the PM-001 catalogue-grounding investigation on branch `codex/product-match-catalogue-grounding-investigation`. It inspects the concept-generation flow, Product Matching selected-products path, catalogue candidate metadata, image evidence/preflight path, and shopping-list/product-sourcing path. Current failure mode: initial concept images are generated before catalogue product selection exists; Product Matching starts only after concept selection through `groundProductsAction`, so recommendations are downstream of a generic concept image. Proposed next boundary: separately approved local/dev catalogue-grounded concept-generation spike for the current investor-demo project/room/user only. No Product Matching execution, controlled preview, app actions, draft shopping-list/catalog writes, live writes, allowlist expansion, DB/schema/generated type changes, UI/payment/checkout changes, production flags/deploys, prompt/runtime/image-generation behavior changes, code implementation, broad scoring rewrite, floor-plan work, or Catalog-First coupling was performed.

ARCHITECT_NOTE: PR #212 prepared the PM-001 narrative-readiness package on branch `codex/product-match-narrative-readiness`. It uses only merged PR #204 and PR #207 evidence plus the active control board to answer what is safe to claim after the passing coffee-table retest, what remains blocked, and the exact recommended next local/dev execution boundary for Sam/Chief approval. It does not run Product Matching, invoke app actions, expand allowlists, write shopping-list/catalog rows, change runtime config, schema/types, UI, prompts, production flags, or Catalog-First coupling.

ARCHITECT_NOTE: PM-001 coffee-table quality fix completed on branch `codex/product-match-coffee-table-quality-fix`. The fix rejects obvious non-coffee-table product-name language from the coffee-table role pool and adds a focused coffee-table role-fit signal. Focused domain tests pass, and the one approved local/dev retest persisted `ai_jobs` row `182e8d5b-2386-4f1a-a139-5d905e67d2fe`; QA stop rules now pass with 0 blockers and the required coffee-table role is `acceptable_match`. This does not approve customer-facing reuse, another execution, app actions, writes, production flags/deploys, broad allowlist expansion, DB/schema/generated type changes, UI/payment/checkout changes, broad scoring rewrites, or Catalog-First runtime coupling.

ARCHITECT_NOTE: PM-001 local/dev current test preview evidence completed on branch `codex/product-match-local-preview-evidence`. Evidence was captured in `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/2026-05-26-pm001-local-preview-evidence.md` from `ai_jobs` row `b218a6f6-55bf-4c49-961d-9812827d6553`. The run used request-scoped local process allowlisting for project `7e1f060d-b95d-462d-8cc2-22b6dd0e92a5`, room `19d312f0-0cd0-4e92-a612-8897767992b3`, user `87c551bf-8288-49df-99c4-a58b530f32ce`, and email `sam.olatoye@gmail.com`. It completed without app actions, shopping-list/catalog writes, deploys, production flags, DB/schema/generated type changes, UI/payment/checkout changes, selection/scoring changes, or Catalog-First runtime coupling. QA stop rules did not pass because the required coffee-table role returned `closest_available`; Chief/Sam routing is needed before any customer-facing reuse or quality-fix/retest work.

ARCHITECT_NOTE: PR #187 merged into `main` and completed the docs-only Product Matching investor evidence appendix at `docs/Tracks/v2-commercial/product-matching-evals/2026-05-26-investor-evidence-appendix.md`. It summarizes the PR #142, PR #148, PR #153, PR #160, PR #173, PR #176, and PR #181 readiness chain, including what can be safely shown tomorrow and what must not be claimed or executed. It does not approve or perform controlled-preview configuration/execution, app actions, runtime allowlist expansion, writes, runtime/schema/UI/prompt/payment/checkout changes, production flags/deploys, default-on activation, production rollout, selection/scoring changes, or Catalog-First runtime coupling.

ARCHITECT_NOTE: PR #181 adds the docs-only investor demo runbook at `docs/Tracks/v2-commercial/product-matching-evals/2026-05-26-investor-demo-runbook.md`. It explains the pitch-safe Product Matching story after PR #176 and PR #173, what can be shown without controlled preview, what must not be claimed, future bounded-preview approval fields, and the fallback if asked whether this can run live today. It does not approve or perform controlled-preview configuration/execution, app actions, runtime allowlist expansion, writes, runtime/schema/UI/prompt/payment/checkout changes, production flags/deploys, default-on activation, production rollout, selection/scoring changes, or Catalog-First runtime coupling.

ARCHITECT_NOTE: PR #176 merged into `main` and completed the docs/artifacts-only Product Matching pitch-readiness package after PR #173. The package confirms the product-sourcing image-resilience fix is present on main, summarizes what is now safer for investor-demo readiness, and keeps controlled-preview execution blocked pending explicit Sam/Chief approval of the execution boundary.

ARCHITECT_NOTE: PR #173 merged into `main` at `f86d902e7bdf648b15453ad2345de3128b27a773` and the product-sourcing image-resilience fix is present on `origin/main`. The fix improves image preflight safety in the existing product-sourcing path, but it does not approve Product Matching controlled-preview configuration/execution, app actions, runtime allowlist expansion, writes, runtime/schema/UI/prompt/payment/checkout changes, production flags/deploys, default-on activation, production rollout, selection/scoring changes, or Catalog-First runtime coupling.

ARCHITECT_NOTE: PR #142 completed the one Sam-approved bounded local QA / read-only manual harness evidence pass for the two approved targets only. PR #148 completed the docs-only post-evidence warning triage. PR #153 completed the QA-harness-only warning report improvement. Do not run or configure any further controlled preview until Sam/Chief explicitly approves the next bounded execution.

ARCHITECT_NOTE: PR #160 completed the docs-only controlled-preview execution-boundary approval package. PR #170 completed mailbox hygiene that cleared stale PR #160 state while keeping the lane parked at `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`, with `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` still the runtime gate. It does not approve, configure, or execute controlled preview.

Hard stop: no controlled-preview configuration/execution, app actions, runtime allowlist expansion, draft shopping-list/catalog writes, live catalog writes, DB/schema/generated types, runtime/env default changes, runtime/UI/prompt/payment/checkout changes, production flags/deploys, default-on activation, production rollout, selection/scoring changes, or Catalog-First runtime coupling without explicit Sam/Chief approval.

## Last action taken
ARCHITECT_NOTE:
PM-001 visual-sourcing timeout isolation evidence implementation is open on branch `codex/pm001-visual-timeout-evidence`.

Exact scope:
- Add deterministic visual-sourcing timeout/fallback evidence to existing Product Matching audit output.
- Expose whether visual sourcing timed out, whether text fallback was used, the fallback reason, role/candidate counts, text-fallback role evidence count, and notes that separate provider visual-reasoning failure from semantic product matching quality.
- Wire that evidence into the existing `ai_jobs.output_summary` role-confidence audit path without running Product Matching or making a runtime visual-sourcing call.

Files changed:
- `packages/domain/src/product-matching-confidence.ts`
- `packages/domain/src/product-matching-confidence.test.ts`
- `apps/web/app/actions.ts`
- `apps/web/app/product-sourcing-timeout-diagnostics.ts`
- `apps/web/app/product-sourcing-timeout-diagnostics.test.ts`
- `docs/Tracks/v2-commercial/process/active-agent-control-board.md`
- `docs/Tracks/v2-commercial/process/product-matching-agent-comms.md`

Checks run:
- `pnpm install --offline --frozen-lockfile`
- `pnpm --filter @ritzy-studio/web exec tsx app/product-sourcing-timeout-diagnostics.test.ts`
- `pnpm --filter @ritzy-studio/domain exec tsx src/product-matching-confidence.test.ts`
- `pnpm --filter @ritzy-studio/domain test`
- `pnpm --filter @ritzy-studio/domain typecheck`
- `pnpm --filter @ritzy-studio/web typecheck`
- `git diff --check`

Forbidden scope confirmation:
- No Product Matching execution, blind validation, visual-sourcing runtime call, app action, write-path validation, shopping-list/catalogue write, live ingestion/catalog write, catalogue/product mutation, DB/schema/generated type change, production deploy/flag/default-on activation, controlled-preview expansion, runtime allowlist change, prompt/runtime image-generation behavior change, broad scoring rewrite, payment/checkout, floor-plan work, or Catalog-First coupling was performed.

CHIEF_ARCHITECT_REPLY:
PM-001 is routed again after PR Review Agent approved the post-PR #249 handoff and PR #250 merged at `6fad6c285ec0580658ff9bb8ddbe55075ab5602f`.

Owner: Product Matching Agent.

Route:
- Pull latest `origin/main` at `6fad6c285ec0580658ff9bb8ddbe55075ab5602f`.
- Create a clean branch.
- Acknowledge this route with the branch name and explicit stop-rule confirmation.
- Implement only visual-sourcing timeout isolation evidence: PM-001 should surface deterministic timeout/fallback metadata in existing Product Matching audit paths so review can distinguish visual sourcing timeout/text fallback from semantic matching quality.
- Add focused local/dev tests for timeout/fallback evidence using existing non-runtime audit/domain paths.
- Open one focused PR with an `ARCHITECT_NOTE:` confirming scope, verification, and stop rules.
- Leave the PR for PR Review Agent review before merge.

Allowed scope:
- local/dev code and tests for visual-sourcing timeout/fallback evidence only
- docs/mailbox updates directly tied to the PR
- read-only inspection of existing PM-001 evidence from PR #242/#249

Forbidden scope:
- Product Matching execution or another blind validation pass
- visual-sourcing runtime calls, prompt/runtime image-generation behavior changes, runtime allowlist changes, controlled preview, app actions, writes, live ingestion/catalog writes, catalogue/product mutations
- DB/schema/generated type changes
- broad scoring rewrites or unrelated product-quality changes
- production deploys/flags/default-on activation
- payment/checkout, floor-plan work, or Catalog-First runtime coupling

If the fix requires anything outside this route, stop and leave an explicit blocker.

ARCHITECT_NOTE:
PR #249 merged at `8f2591537ec884e65b79b5325c1d44f2972f6176` after PR Review Agent approval. It completed the PM-001 thin/empty option-pool warning guard/test: `required_pool_thin` warning evidence is now present in existing Product Matching QA stop-rule output for one-candidate required pools, while `required_pool_empty` remains a blocker for zero-candidate required roles. No Product Matching execution, blind validation, app actions, shopping-list writes, catalogue/product mutations, live ingestion/catalog writes, DB/schema/generated type changes, production deploys/flags, controlled-preview expansion, runtime allowlist expansion, prompt/runtime image-generation behavior changes, broad scoring rewrite, payment/checkout, floor-plan work, or Catalog-First coupling was performed.

PRODUCT_MATCHING_AGENT_ACK: 2026-05-29 — Product Matching Agent acknowledges the PM-001 thin/empty option-pool warning route on branch `codex/pm001-thin-pool-warning`, based on latest `origin/main` at `a59e90f8c62d588c6582a9e4de7d5212e5fce16f`. Scope accepted: deterministic warning/stop evidence for required roles with zero eligible candidates or materially thin option pools in existing Product Matching domain/audit paths, focused local/dev tests, and one focused PR left for PR Review Agent review before merge. Stop rules accepted: no Product Matching execution or blind validation pass, app actions, controlled preview, runtime allowlist changes, shopping-list/catalogue writes, live ingestion/catalog writes, catalogue/product mutations, DB/schema/generated type changes, prompt/runtime image-generation behavior changes, broad scoring rewrites, unrelated product-quality changes, production deploys/flags/default-on activation, payment/checkout, floor-plan work, or Catalog-First coupling.

CHIEF_ARCHITECT_REPLY:
PM-001 is routed again after PR Review Agent approved the post-merge process cleanup and PR #246 merged at `39d86c3b531af76ec9a76e4d797d36c1e75747ce`.

Owner: Product Matching Agent.

Route:
- Pull latest `origin/main` at `39d86c3b531af76ec9a76e4d797d36c1e75747ce`.
- Create a clean branch.
- Acknowledge this route with the branch name and explicit stop-rule confirmation.
- Implement only the thin/empty option-pool warning guard/test: PM-001 should surface deterministic warning/stop evidence when a required layer has zero eligible candidates or a materially thin option pool, so investor-demo readiness cannot silently pass while curtains/textiles are empty or coffee/side tables remain too thin.
- Add focused local/dev tests for zero-candidate and thin-pool behavior using existing domain/audit paths.
- Open one focused PR with an `ARCHITECT_NOTE:` confirming scope, verification, and stop rules.
- Leave the PR for PR Review Agent review before merge.

Allowed scope:
- local/dev code and tests for thin/empty option-pool warning evidence only
- docs/mailbox updates directly tied to the PR
- read-only inspection of existing PM-001 evidence from PR #242/#245

Forbidden scope:
- Product Matching execution or another blind validation pass
- app actions, controlled preview, runtime allowlist changes, writes, live ingestion/catalog writes, catalogue/product mutations
- DB/schema/generated type changes
- prompt/runtime image-generation behavior changes
- broad scoring rewrites or unrelated product-quality changes
- production deploys/flags/default-on activation
- payment/checkout, floor-plan work, or Catalog-First runtime coupling

If the fix requires anything outside this route, stop and leave an explicit blocker.

ARCHITECT_NOTE:
PR #245 merged at `3b385fb9cc9e849b4148c4644a264c8bf15e6d63` and completed the PM-001 lighting role-fit guard/test. The merge happened after green checks but without PR Review Agent approval, which violated the normal review process. This follow-through exists to correct durable board/mailbox state and route the post-merge review/process cleanup through PR Review Agent.

Do not start the next PM-001 implementation slice until PR Review Agent has reviewed the follow-through PR and Chief/Sam has explicitly routed the next exact local/dev boundary.

ARCHITECT_NOTE:
PM-001 lighting role-fit guard/test is implemented in PR #245 on branch `codex/pm001-lighting-role-guard`.

Scope completed:
- Added a focused local/dev role-fit guard so `floor lighting`, `table lighting`, `floor/table lighting`, task, or bedside lighting roles reward floor/table/desk/task/bedside lamp language and penalize chandeliers, ceiling lights, pendants, suspension lights, and hanging fixtures when the role is not an over-table/ceiling role.
- Added focused domain tests proving an eligible aged-brass table lamp outranks a linen chandelier for `floor or table lighting`, while the existing over-table chandelier behavior remains covered.

Verification:
- `pnpm install --offline --frozen-lockfile`
- `pnpm --filter @ritzy-studio/domain exec tsx src/product-matching.test.ts`
- `pnpm --filter @ritzy-studio/domain test`
- `pnpm --filter @ritzy-studio/domain typecheck`
- `git diff --check`

No Product Matching execution, blind validation, app actions, draft shopping-list writes, catalogue/product mutations, live ingestion/catalog writes, DB/schema/generated type changes, production deploys/flags, controlled-preview expansion, runtime allowlist expansion, prompt/runtime image-generation behavior changes, broad scoring rewrite, payment/checkout, floor-plan work, or Catalog-First coupling was performed.

CHIEF_ARCHITECT_REPLY:
PM-001 is routed again. Sam confirmed Chief approval authority in his absence and approved the next narrow local/dev fix boundary on 2026-05-29.

Owner: Product Matching Agent.

Route:
- Pull latest `origin/main` at `dc9e2d36939a7a05614bd3c522e376876da79c25`.
- Create a clean branch.
- Acknowledge this route with the branch name and explicit stop-rule confirmation.
- Implement only the lighting role-fit guard/test: `floor lighting`, `table lighting`, or `floor/table lighting` roles must not select chandeliers, ceiling lights, pendant lights, or other ceiling fixtures when floor-lamp or table-lamp candidates exist.
- Add focused tests for the guard.
- Open one focused PR with a short mailbox/PR note confirming the scope and verification.

Allowed scope:
- Local/dev code, tests, and docs for this lighting role-fit guard.
- Read-only inspection of existing local/dev evidence from PR #242 if needed.

Not approved:
- No Product Matching execution or blind validation pass.
- No app actions.
- No draft shopping-list writes.
- No catalogue/product row mutations.
- No live ingestion or catalog writes.
- No DB/schema/generated type changes.
- No production deploys or flags.
- No controlled-preview expansion.
- No runtime allowlist expansion.
- No prompt/runtime image-generation behavior changes.
- No broad scoring rewrite.
- No payment/checkout changes.
- No floor-plan work.
- No Catalog-First coupling.

Expected artifact:
- Branch acknowledgement within one owner heartbeat.
- Branch, commits, PR, mailbox update, or explicit blocker within 30 minutes.

Stop rule:
- If the lighting guard cannot be implemented without crossing any forbidden scope, stop and leave an `ARCHITECT_NOTE:` naming the smallest required boundary.

PR #242 merged the PM-001 post-#240 validation evidence at `b9af25ec2104933174e7d0051c7d8691c6cc8f3c`. It confirms the PR #238 persisted-selection snapshot captures post-processed shopping-list choices and that the repeated Stone/Rio/Tobago sofa regression did not recur in that pass. It also confirms PM-001 remains below the 9/10 investor-demo bar: visual sourcing timed out to deterministic text fallback, curtains/textile layer had zero eligible catalogue candidates, sofa/armchair concept anchors were replaced, lighting selected a chandelier for a floor/table-lighting role, and coffee/side-table pools remain thin. No production deploys/flags, rollout, live app actions, catalogue/product writes, live ingestion, DB/schema/generated type changes, controlled-preview expansion, runtime allowlist expansion, payment/checkout changes, broad scoring rewrites, prompt/runtime/image-generation changes, final-render execution, floor-plan work, or Catalog-First coupling was performed.

Product Matching Agent acknowledged PM-001 stale recovery on branch `codex/pm-001-validation-20260529`, ran the single approved local/dev validation pass for project `4207ade6-2604-4e15-9b05-ffa77531d3d2`, room `75e18e73-cf69-4b2e-b192-009fbc135b38`, and recorded evidence at `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/2026-05-29-pm001-post-240-validation.md`. The pass created product-sourcing job `d71d47f6-6f88-43a0-b9fc-f48c1a1492f9` and refreshed shopping list `99062356-7a63-4438-bd4b-461cc43c66ba` with 35 local/dev item rows. The PR #238 persisted-selection snapshot is present and captures post-processed shopping-list selections. Quality remains below the investor-demo 9/10 bar because visual sourcing still timed out to text fallback, curtains remain missing due zero eligible catalogue candidates, sofa/armchair concept anchors were replaced, and support-role role fit still needs a narrow lighting guard. No production deploys/flags, rollout, live app actions, catalogue/product writes, live ingestion, DB/schema/generated type changes, controlled-preview expansion, runtime allowlist expansion, payment/checkout changes, broad scoring rewrites, prompt/runtime/image-generation changes, final-render execution, floor-plan work, or Catalog-First coupling was performed.

PR #235 merged the PM-001 post-#232 validation note at `57a132f0024bac205893a6831b01178ae2e5f707` after approval and explicit implementation-agent merge instruction. The evidence note records selected SKUs, repeated-sofa behavior, missing curtains/textiles, recommendation similarity, render/list fidelity limits, visual-sourcing timeout diagnostics, and the next narrow code boundary recommendation. Product Matching remains below the 9/10 full-flow investor-demo bar; the recommended next slice is auditability-first persisted-selection snapshotting after shopping-list post-processing, focused local/dev refresh-diversity hardening tests, and support-role light mirror/media preference tests before another blind browser/final-render pass. No additional Product Matching execution, browser-click app action, shopping-list refresh, catalogue write, catalogue ingestion, schema/type change, production flag, deploy, allowlist change, prompt/runtime behavior change, payment/checkout change, floor-plan work, broad scoring rewrite, or Catalog-First coupling was performed.

PR #235 opened the PM-001 post-#232 validation note after Product Matching Agent acknowledged the PR #234 route. Evidence came from merged PR notes, existing local validation artifacts, and read-only local/dev Supabase row inspection for project `4207ade6-2604-4e15-9b05-ffa77531d3d2`, room `75e18e73-cf69-4b2e-b192-009fbc135b38`, jobs `515c8a09-ec4c-4cc2-be00-47f348f5e6c3`, `5473e873-ca82-44ad-a0e1-3ae6981e47f8`, and `34d6c3d2-c6c8-45f8-9f61-f31119dc1cd5`. The validation finds improved persisted support-role selections, repeatable visual-sourcing timeout fallback, missing curtains/textiles, remaining required-role QA blockers, intermittent repeated sofa-family regression, and an audit gap where `ai_jobs.output_summary.roleStatuses` can differ from persisted shopping-list rows after post-processing. No fresh Product Matching run, browser-click app action, shopping-list refresh, catalogue write, catalogue ingestion, schema/type change, production flag, deploy, allowlist change, prompt/runtime behavior change, payment/checkout change, floor-plan work, broad scoring rewrite, or Catalog-First coupling was performed.

PR #232 merged the deterministic local/dev PM-001 refresh-history diversity and soft-neutral support-role filtering slice after approval. The merged evidence demonstrates refresh history can move selection to a credible same-role alternative when available and that selected support rows no longer include the black/off-theme vase/mirror in the validated local/dev path. No further execution or rollout is approved by the merge.

PR #230 merged the PM-001 support-role quality and visual-sourcing timeout-diagnosis slice after approval. The merged evidence records cleaner support-role alternatives for the current demo catalogue readback and documents missing curtains/textiles rather than faking them. No further execution or rollout is approved by the merge.

PR #230 opened the PM-001 support-role quality and visual-sourcing timeout-diagnosis slice. It tightens soft-neutral support-role ranking, improves deterministic text fallback family scoring for support roles, adds timeout diagnostic fields to product-sourcing job summaries, and records read-only local/dev evidence at `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/2026-05-28-pm001-support-role-timeout-diagnosis.md`. No Product Matching execution, controlled preview, preview QA, app action, draft shopping-list row create/refresh, catalogue write, DB/schema/generated type change, live write, UI/prompt/payment/checkout change, production flag/deploy, broad/runtime allowlist expansion, default-on activation, production rollout, broad scoring rewrite, prompt/runtime/image-generation behavior change, unrelated quality change, floor-plan work, or Catalog-First runtime coupling was performed.

PR #228 merged the docs/mailbox-only PM-001 post-#227 stale-pointer cleanup. No Product Matching execution, controlled preview, preview QA, app action, draft shopping-list row create/refresh, catalogue write, DB/schema/generated type change, live write, UI/prompt/payment/checkout change, production flag/deploy, broad/runtime allowlist expansion, default-on activation, production rollout, broad scoring rewrite, prompt/runtime/image-generation behavior change, code implementation, unrelated quality change, floor-plan work, or Catalog-First runtime coupling was performed.

PR #227 merged the docs/mailbox-only PM-001 post-#226 handoff. No Product Matching execution, controlled preview, preview QA, app action, draft shopping-list row create/refresh, catalogue write, DB/schema/generated type change, live write, UI/prompt/payment/checkout change, production flag/deploy, broad/runtime allowlist expansion, default-on activation, production rollout, broad scoring rewrite, prompt/runtime/image-generation behavior change, code implementation, unrelated quality change, floor-plan work, or Catalog-First runtime coupling was performed.

PR #226 merged the local/dev PM-001 SKU-fidelity/support-role improvement after approval at head `bef303aa2e298bc5f6c1541c74d353a773`. No production deploys/flags, live catalogue writes/ingestion, schema/generated type changes, payment/checkout changes, floor-plan work, Catalog-First runtime coupling, controlled-preview expansion, production activation, runtime allowlist expansion, or catalogue/product row mutations were performed.

PR #220 merged the local/dev PM-001 aesthetic taste gate for catalogue-grounded investor-demo concepts and shopping-list anchor preservation. PR #221 cleaned the post-merge board/mailbox state. Post-merge validation is committed at `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/2026-05-27-aesthetic-taste-gate-post-merge-validation.md`.

PR #217 merged the approved catalogue-grounded concept-generation implementation. The merged code path is ready for a separately approved local/dev validation boundary on the investor-demo project/room/user. No Product Matching execution, controlled preview, preview QA, app action, draft shopping-list row create/refresh, catalogue write, DB/schema/generated type change, live write, UI/payment/checkout change, production flag/deploy, broad/runtime allowlist expansion, default-on activation, production rollout, broad scoring rewrite, floor-plan work, or Catalog-First runtime coupling was performed.

Prepared `docs/Tracks/v2-commercial/product-matching-evals/2026-05-27-pm001-catalogue-grounding-investigation.md`, a docs-only/read-only PM-001 catalogue-grounding investigation and next-boundary recommendation. PR #212 merged at `12cc0e4b42ba1966d55116c41501774a7187c516`. No Product Matching execution, controlled preview, app action, draft shopping-list row create/refresh, catalogue write, DB/schema/generated type change, live write, UI/prompt/payment/checkout change, production flag/deploy, broad/runtime allowlist expansion, default-on activation, production rollout, broad scoring rewrite, prompt/runtime/image-generation behavior change, code implementation, unrelated quality change, floor-plan work, or Catalog-First runtime coupling was performed.

Prepared `docs/Tracks/v2-commercial/product-matching-evals/2026-05-27-pm001-narrative-readiness.md`, a docs-only PM-001 narrative-readiness and recommended next-boundary package. No Product Matching execution, app action, draft shopping-list row create/refresh, catalog write, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, broad allowlist expansion, default-on activation, production rollout, broad scoring rewrite, unrelated quality change, or Catalog-First runtime coupling was performed.

PR #207 merged the PM-001 coffee-table quality fix. The fix tightened coffee-table role matching, added focused domain tests, and documented retest evidence at `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/2026-05-26-pm001-coffee-table-quality-fix.md`.

PM-001 coffee-table quality fix completed. The retest persisted `ai_jobs` evidence row `182e8d5b-2386-4f1a-a139-5d905e67d2fe`; QA stop rules pass with 0 blockers, and required role `coffee table` is now `acceptable_match`. No app action, draft shopping-list row create/refresh, catalog write, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, broad allowlist expansion, default-on activation, production rollout, broad scoring rewrite, unrelated quality change, or Catalog-First runtime coupling was performed.

PM-001 local/dev current test preview evidence completed. The run persisted `ai_jobs` evidence row `b218a6f6-55bf-4c49-961d-9812827d6553` and added `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/2026-05-26-pm001-local-preview-evidence.md`. QA stop rules did not pass because required role `coffee table` returned `closest_available`. No app action, draft shopping-list row create/refresh, catalog write, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, broad allowlist expansion, default-on activation, production rollout, selection/scoring behavior change, or Catalog-First runtime coupling was performed.

PR #187 created `docs/Tracks/v2-commercial/product-matching-evals/2026-05-26-investor-evidence-appendix.md`. No controlled-preview configuration/execution, app action, evidence pass, draft shopping-list row create/refresh, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, new preview target, allowlist expansion, default-on activation, production rollout, selection/scoring behavior change, or Catalog-First runtime coupling was performed.

PR #181 created `docs/Tracks/v2-commercial/product-matching-evals/2026-05-26-investor-demo-runbook.md` and updated this mailbox. No controlled-preview configuration/execution, app action, evidence pass, draft shopping-list row create/refresh, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, new preview target, allowlist expansion, default-on activation, production rollout, selection/scoring behavior change, or Catalog-First runtime coupling was performed.

PR #176 merged the docs/artifacts-only pitch-readiness package. It added `docs/Tracks/v2-commercial/product-matching-evals/2026-05-26-pitch-readiness-status.md` and updated this mailbox. No controlled-preview configuration/execution, app action, evidence pass, draft shopping-list row create/refresh, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, new preview target, allowlist expansion, default-on activation, production rollout, selection/scoring behavior change, or Catalog-First runtime coupling was performed.

PR #173 completed the product-sourcing image-resilience hotfix on `main`. `apps/web/app/product-image-preflight.ts` and `apps/web/app/product-image-preflight.test.ts` are present on `origin/main`, and merge commit `f86d902e7bdf648b15453ad2345de3128b27a773` is included in `origin/main`.

PR #160 completed the docs-only controlled-preview execution-boundary package after PR #153. The package prepares approval fields for proposed scope, project/room/user allowlist, environment, app path, write boundary, stop rules, rollback rules, owner, expiration, and evidence artifacts. No controlled-preview configuration/execution, app action, evidence pass, draft shopping-list row create/refresh, DB/schema/generated type change, live catalog write, UI/prompt/payment/checkout change, production flag/deploy, new preview target, allowlist expansion, default-on activation, production rollout, selection/scoring behavior change, or Catalog-First runtime coupling was performed.

PR #170 merged to clean stale mailbox state after PR #160 merged. This was docs/mailbox only.

## Next intended action
Product Matching Agent: acknowledge the visual-sourcing timeout isolation evidence route, then open one focused implementation PR. PR Review Agent must review the PR before merge. Do not run additional Product Matching execution, visual-sourcing runtime calls, controlled preview, app actions, writes, broad/runtime allowlist changes, production activity, broad scoring rewrites, prompt/runtime image-generation behavior changes, unrelated quality changes, floor-plan work, or Catalog-First coupling without a new explicit Sam/Chief boundary.

Keep the Product Matching lane heartbeat active. It must not be deleted after merges. The heartbeat should run every 10 minutes and monitor:

- `docs/Tracks/v2-commercial/process/product-matching-agent-comms.md`
- Product Matching PRs, if any appear
- PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- this thread for explicit Sam/Chief approval, edits, or rejection

Do not delete the Product Matching heartbeat just because a PR merged. If the mailbox does not name a specific approved next safe implementation stage, keep the lane parked and wait for Sam/Chief routing.

Sam/Chief: separately review whether the PR #142 two-target evidence is sufficient for a next bounded preview step. Any further execution requires a new explicit approval with scope, project/room/user allowlist, environment, app path, write boundary, stop rules, rollback rules, evidence artifacts, owner, and expiration.

## Durable next-state handoff after merge
PR #207 merged the PM-001 coffee-table quality fix. The lane state is `PM001_COFFEE_TABLE_QUALITY_FIX_MERGED_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION`. The runtime gate remains `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` outside the already completed local/dev evidence and retest passes. Do not reuse the output for customer-facing decisions, run another Product Matching execution, invoke app actions, expand allowlists, create or refresh draft shopping-list/catalog rows, change DB/schema/generated types, change runtime/UI/prompt/payment/checkout, deploy production flags, activate default-on behavior, make broad scoring rewrites or unrelated quality changes, or add Catalog-First runtime coupling without explicit Chief/Sam approval.

PR #187 merged the docs-only Product Matching investor evidence appendix at `docs/Tracks/v2-commercial/product-matching-evals/2026-05-26-investor-evidence-appendix.md`. The lane state remains `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`. `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` remains the runtime gate. Do not start controlled-preview configuration/execution, app actions, allowlist expansion in runtime config, draft shopping-list/catalog writes, DB/schema/generated type changes, runtime/UI/prompt/payment/checkout work, live catalog writes, production flags/deploys, default-on activation, production rollout, Product Matching selection/scoring changes, or Catalog-First runtime coupling without explicit Sam/Chief approval.

PR #181 merged the docs-only Product Matching investor demo runbook at `docs/Tracks/v2-commercial/product-matching-evals/2026-05-26-investor-demo-runbook.md`. The lane state remains `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`. `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` remains the runtime gate. Do not start controlled-preview configuration/execution, app actions, allowlist expansion in runtime config, draft shopping-list/catalog writes, DB/schema/generated type changes, runtime/UI/prompt/payment/checkout work, live catalog writes, production flags/deploys, default-on activation, production rollout, Product Matching selection/scoring changes, or Catalog-First runtime coupling without explicit Sam/Chief approval.

PR #176 is merged and the docs/artifacts-only Product Matching pitch-readiness package is complete. The lane state remains `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`. `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` remains the runtime gate. Do not start controlled-preview configuration/execution, app actions, allowlist expansion in runtime config, draft shopping-list/catalog writes, DB/schema/generated type changes, runtime/UI/prompt/payment/checkout work, live catalog writes, production flags/deploys, default-on activation, production rollout, Product Matching selection/scoring changes, or Catalog-First runtime coupling without explicit Sam/Chief approval.

PR #160 is merged and the docs-only controlled-preview execution-boundary package is complete. The lane state is `CONTROLLED_PREVIEW_EXECUTION_BOUNDARY_READY_WAITING_FOR_SAM_CHIEF_DECISION`. `CONTROLLED_PREVIEW_EXPANSION_BLOCKED_WAITING_FOR_SAM_CHIEF_DECISION` remains the runtime gate. Do not start controlled-preview configuration/execution, app actions, allowlist expansion in runtime config, draft shopping-list/catalog writes, DB/schema/generated type changes, runtime/UI/prompt/payment/checkout work, live catalog writes, production flags/deploys, default-on activation, production rollout, Product Matching selection/scoring changes, or Catalog-First runtime coupling without explicit Sam/Chief approval.
