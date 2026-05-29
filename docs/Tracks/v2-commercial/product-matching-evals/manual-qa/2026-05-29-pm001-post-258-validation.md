# PM-001 Post-#258 Local/Dev Validation Evidence

Date: 2026-05-29
Owner: Product Matching Agent
Ticket: PM-001
Branch: `codex/pm001-post-258-validation`

## Boundary

This evidence records the one approved local/dev validation pass routed by PR #259 after PR #258 merged the visual-sourcing timeout/retry/fallback evidence implementation.

Allowed validation boundary:

- Project: `4207ade6-2604-4e15-9b05-ffa77531d3d2`
- Room: `75e18e73-cf69-4b2e-b192-009fbc135b38`
- Concept: `d9cc2f82-6d8f-455c-8c8d-e08522e0938c`
- Account/environment: Sam local/dev account on localhost/local dev
- Catalogue scope: existing catalogue rows only
- Write scope: only existing app-flow local/dev concept/job/shopping-list rows required by the validation flow

No second validation pass, production deploy, production flag, controlled preview, live app action, catalogue/product mutation, live ingestion/catalog write, DB/schema/generated type change, runtime allowlist expansion, payment/checkout change, broad scoring rewrite, prompt/runtime image-generation behavior change, floor-plan work, final-render execution, or Catalog-First coupling was performed.

## Route Acknowledgement

Product Matching Agent acknowledged the route on PR #259 before execution:

- Branch: `codex/pm001-post-258-validation`
- Base: `origin/main` at `96c0348b5d962373b92a2a429d96ae1481f7d204`
- PR comment: <https://github.com/Trueflutter/ritzy-studio/pull/259#issuecomment-4572748539>

## Execution

Local server:

- Worktree: `/Users/ayoolatoye/Documents/projects/ritzy-studio-pm001-post-258-validation`
- Command: `RITZY_AESTHETIC_TASTE_GATE=1 NEXT_PUBLIC_APP_URL=http://localhost:3004 pnpm --filter @ritzy-studio/web dev --port 3004`
- Local auth: temporary Sam local/dev magic-link session generated through the local Supabase admin path

Validation action:

- URL: `/projects/4207ade6-2604-4e15-9b05-ffa77531d3d2/rooms/75e18e73-cf69-4b2e-b192-009fbc135b38/product-matching`
- Action: submitted the rendered `Refresh matches` form once
- Result: `HTTP/1.1 303 See Other`
- Redirect: `/projects/4207ade6-2604-4e15-9b05-ffa77531d3d2/rooms/75e18e73-cf69-4b2e-b192-009fbc135b38/shopping-list`

One earlier malformed server-action POST returned `HTTP/1.1 500 Internal Server Error` with `Connection closed.` before Product Matching execution. DB readback immediately after that malformed POST showed no new `product_visual_sourcing` job; the latest target job remained `96418e26-05a7-46f1-a1dc-fea7908c3e7c` from the previous post-#255 pass. The successful form submission below is the single valid post-#258 validation pass.

## Persisted Rows

Readback was performed through local/dev Supabase service-role inspection after the validation action.

- Latest product-sourcing job: `49fa0779-a790-47f6-9f2e-db03da5b5d14`
- Job status: `succeeded`
- Job type: `product_visual_sourcing`
- Created: `2026-05-29T08:51:15.700997+00:00`
- Completed: `2026-05-29T08:51:15.788+00:00`
- Shopping list: `99062356-7a63-4438-bd4b-461cc43c66ba`
- Shopping-list status: `draft`
- Shopping-list updated: `2026-05-29T08:51:21.193146+00:00`
- Estimated total: AED 14,316
- Item rows: 32
- Selected rows: 10

## Selected Products

| Category | Role | Selected product | Retailer | Price |
| --- | --- | --- | --- | ---: |
| sofas | anchor seating | Lance 3-Seater Sofa - Nature | Chattels & More | AED 6,440 |
| armchairs | secondary seating | Paco Fabric Armchair | Home Centre | AED 749 |
| coffee_tables | coffee table | Baku Coffee Table - Low | Home Centre | AED 809 |
| rugs | generous rug | Urbana Plain Solid Rug 300 x 400 - White | Danube Home | AED 999 |
| side_tables | side or end tables | Lantine Walnut Veneer Side Table with Brass Detail | Chattels & More | AED 2,240 |
| lighting | floor or table lighting | Hahn E14 8-lights Linen Chandelier | 2XL Home | AED 1,089 |
| wall_art | wall art or focal wall | Minya Framed Canvas Wall Art - 120x60 cm | Home Centre | AED 179 |
| mirrors | mirror | Artemis Arch Wall Mirror - 120x80 cm | Home Centre | AED 349 |
| decor | cushions, tray, ceramics, and decor | Mirabella Ceramic Vase 12X12X20 cm - Ivory | Danube Home | AED 29 |
| storage | TV media console or built-in media unit | Mahmayi Modern 3 Door Credenza Versatile Storage Solution Furniture with 2 Shelves Stylish Credenza for Living Room, Office and Home Decor - White | Danube Home | AED 655 |

## PR #258 Validation Result

PR #258 worked for the product-candidate-images-disabled path.

The new job did not wait for the prior 45 second visual-provider timeout:

- `productSourcingTimedOut`: false
- `productSourcingTextFallbackUsed`: true
- `productSourcingTextFallbackReason`: `product_candidate_images_disabled`
- `productSourcingTimeoutDiagnostics.isolationReason`: `visual_sourcing_skipped_product_images_disabled_text_fallback`
- `productSourcingTimeoutDiagnostics.canDistinguishTimeoutFromSemanticQuality`: true
- `productSourcingTimeoutDiagnostics.initialAttemptDurationMs`: 0
- `visualSourcingEvidence.status`: `visual_sourcing_skipped_text_fallback`
- `visualSourcingEvidence.timedOut`: false
- `visualSourcingEvidence.fallbackReason`: `product_candidate_images_disabled`
- `visualSourcingEvidence.initialAttemptDurationMs`: 0
- Retry evidence: `attempted: false`, `timedOut: false`, `fallbackUsed: false`, `fallbackReason: none`
- Candidate count: 180
- Role pool count: 11
- Product candidate images enabled: false
- Candidate image limit: 0

This isolates the current behavior from provider latency. With candidate product images disabled, Product Matching now uses deterministic text fallback immediately and records why.

## Persisted Selection Snapshot

The persisted-selection snapshot is present and auditable.

Concept-anchor replacement evidence:

- Sofa concept anchor `5ce49c6b-da39-4db0-80d0-4e8d362cebca` was replaced by persisted selected product `dad46b0e-a18d-4c39-8e6a-0d4b06a06739`; `conceptAnchorReplacement: true`.
- Coffee-table concept anchor `7b7ed109-1c0f-4c30-acc6-ba36747a9e2a` persisted unchanged; `conceptAnchorReplacement: false`.
- Rug concept anchor `e80b7abe-2dbd-4cc4-9e73-4e4f4d7d8276` persisted unchanged; `conceptAnchorReplacement: false`.

Post-processing replacement remains common and visible:

- Sofa, armchair, rug, lighting, wall art, mirror, decor, and storage show `postProcessingReplacement: true`.
- Coffee table and side table did not show post-processing replacement.

## Pool And QA Evidence

Missing role:

- `curtains curtains or textile layer`
- Curtains/textile candidate count: 0
- Curtains/textile rejected count: 1,289
- Curtains/textile rejection reason: `category_mismatch`

Thin persisted option pools:

- Coffee table: `optionCount: 1`
- Side/end tables: `optionCount: 1`
- Rugs: `optionCount: 2`
- Lighting: `optionCount: 2`
- Decor: `optionCount: 2`
- Storage: `optionCount: 2`

QA stop rules:

- `passesQaStopRules`: false
- Blocker count: 3
- Warning count: 16
- Required-role blockers:
  - `sofas::anchor_seating` - `required_closest_available`
  - `coffee_tables::coffee_table` - `required_closest_available`
  - `rugs::generous_rug` - `required_closest_available`

## Role-Fit Notes

Improved:

- Visual-provider timeout wait is removed for candidate-images-disabled validation.
- Product Matching still documents missing curtains/textiles instead of hallucinating a SKU.
- Mirror and decor selections are light/neutral and avoid the prior black/dark support-role failure.
- Storage selection is white and more suitable than the prior heavy brown media-console result.

Still below bar:

- Lighting regressed back to `Hahn E14 8-lights Linen Chandelier` for a `floor or table lighting` role.
- Sofa concept anchor is still replaced.
- Coffee-table and side/end-table pools are too thin for meaningful alternatives.
- Required sofa, coffee table, and rug roles remain `closest_available` blockers.
- Final render/list fidelity is not proven because final-render execution was explicitly forbidden by the route.

## Verdict

PM-001 is still below the investor-demo 9/10 quality bar, but the PR #258 timeout/fallback slice is validated:

- Before PR #258, the same disabled-candidate-image state waited roughly 45 seconds and recorded `initial_visual_sourcing_timeout`.
- After PR #258, the same state completes the sourcing job immediately and records `product_candidate_images_disabled` / `visual_sourcing_skipped_product_images_disabled_text_fallback`.
- Remaining failures are now clearer product-quality and catalogue-pool issues rather than provider-timeout ambiguity.

## Recommended Next Boundary

Return PM-001 to `BLOCKED` after this evidence PR is reviewed and merged.

Smallest safe next boundary to request: one narrow local/dev lighting role-fit fix/test. The target should prevent `floor or table lighting` from selecting chandeliers, ceiling lights, pendant lights, or other ceiling fixtures when eligible floor/table lamp candidates exist, and it should include a focused post-fix local/dev validation route only after review/merge.

Do not run another validation pass, execute final render, mutate catalogue/product rows, broaden scoring, change prompts/runtime image generation, deploy, enable production flags, expand controlled preview, or introduce Catalog-First coupling without a fresh Sam/Chief route.
