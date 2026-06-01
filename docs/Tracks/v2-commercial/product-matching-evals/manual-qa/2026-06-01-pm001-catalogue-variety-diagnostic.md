# PM-001 Catalogue Variety Diagnostic

Date: 2026-06-01
Owner: Product Matching Agent
Ticket: PM-001
Branch: `codex/pm001-catalogue-variety-diagnostic`

## Boundary

Sam routed this local/dev Product Matching code/tests/docs boundary after PR #283 merged. The beta-readiness concern is repeated/similar catalogues and product selections that do not always match the room/style well.

Allowed scope:

- Inspect recent PM-001 evidence and latest Sam test evidence.
- Identify whether repetition is caused by candidate pool limits, scoring weights, role fallback behavior, deterministic fallback, catalogue thinness, or post-processing.
- Add focused regression tests or diagnostics.
- Implement one narrow Product Matching fix only if it is clear and safe.

Stop rules honored:

- No Product Matching validation pass through the live app flow.
- No controlled preview, preview QA, browser-click app action, shopping-list refresh/create, visual-sourcing runtime call, final render, deploy, production/default-on activation, live write, live ingestion, catalog write, catalogue/product mutation, DB/schema/generated type change, payment/checkout change, broad scoring rewrite, prompt/runtime image-generation behavior change, curtains/textiles generation, thin-pool fix, side-table/storage/media change, floor-plan work, Catalog-First coupling, or unrelated quality change.

## Evidence Reviewed

Recent PM-001 evidence reviewed:

- `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/2026-05-31-pm001-post-277-validation.md`
- `docs/Tracks/v2-commercial/process/active-agent-control-board.md`
- `docs/Tracks/v2-commercial/process/product-matching-agent-comms.md`

Latest local manual PM-001 validation evidence remains the post-PR #277 validation file above. No new validation pass was run for this route.

## Findings

The current repeated/similar catalogue concern has more than one cause.

Confirmed candidate-pool limits from the post-PR #277 evidence:

- Curtains/textiles had zero persisted options.
- Side/end tables had one persisted option.
- Coffee tables had two persisted options.
- Decor and storage each had four persisted options.

Confirmed fallback/runtime evidence:

- The run stayed on deterministic text fallback because product candidate images were disabled.
- Diagnostics distinguished this from provider visual-sourcing timeout, so remaining quality defects should be treated as semantic matching, metadata, catalogue-pool, deterministic fallback, or post-processing quality issues.

Code-level repeated-option cause found in `packages/domain/src/product-matching.ts`:

- `composeRoomProductOptions` ranks role candidates by category, score, and role visual affinity.
- `diverseRoleMatches` then diversifies early role options by `diversitySignature`, which includes category, price band, color, and material.
- That catches exact-looking duplicates, but it can still allow near-identical product-family variants to dominate early options when the family name is the same and color/material/price differ.
- Refresh diversity already has a product-family signature helper, but that helper was only applied against previous refresh history, not within the current role option pool.

This means repetition can be caused by real catalogue thinness, but also by option post-processing diversity that is too shallow for same-family variants.

## Narrow Fix

The fix is intentionally local and small:

- Keep the highest-ranked candidate for each role.
- For the early option slots, prefer candidates with distinct product-family signatures as well as distinct color/material/price signatures.
- Fall back to same-family repeats when the pool is genuinely thin and no distinct alternatives are available.

This does not change prompts, app actions, catalogue data, database schema, production flags, or broad Product Matching scoring. It only improves option-pool diversity after ranked candidates are already available.

## Regression Coverage

Added a focused domain regression in `packages/domain/src/product-matching.test.ts`:

- A coffee-table role receives three high-ranked `Baku Coffee Table` variants with different colors/materials/prices plus two lower-ranked distinct alternatives.
- Expected output keeps the top `Baku` candidate but fills the next early option slots with distinct `Theo` and `Marble Nesting` families instead of additional `Baku` variants.

Existing diversity behavior remains covered:

- Distinct signature sofa options are still preferred before repeating a visually identical sofa.
- Refresh diversity still penalizes previously shown exact/family products only when close fresh alternatives exist.
- Thin-pool refresh behavior still falls back to the best available product instead of selecting an obviously weak alternative.

## Stop-Rule Confirmation

This diagnostic/fix did not run Product Matching validation, controlled preview, preview QA, live app flow, shopping-list refresh/create, visual-sourcing runtime calls, catalogue/product mutations, DB/schema/type changes, prompt/image-generation behavior changes, production deploys/flags, payment/checkout changes, final render, floor-plan work, or Catalog-First coupling.

ARCHITECT_NOTE: PM-001 catalogue-variety diagnostic found both real catalogue thinness and one narrow current-option post-processing gap. The proposed code change only diversifies same-family variants inside role option pools after ranking, preserving the top-ranked match and falling back to repeats for thin pools. Verification should include the focused Product Matching domain test, domain typecheck, and `git diff --check`. Next smallest safe boundary after review is a separate Chief/Sam route for either deeper role-fit scoring diagnostics or a catalogue-pool/data-quality route; this PR does not approve validation or live/catalogue actions.
