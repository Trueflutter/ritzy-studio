# PM-001 Post-PR #270 Local/Dev Validation Evidence

Date: 2026-05-29
Branch: `codex/pm001-post-270-validation`
Route: PR #272
Route merge commit: `19dc1484a8ac5890892f33dd5368de3c4aeb7fe4`
Validated implementation: PR #270 merged at `3a8003c6b01d2cb74c686e8ba85e54bb34f5cac3`

## Scope

This evidence records the one approved local/dev validation pass routed by PR #272 after PR #270 enriched required-role `required_closest_available` audit evidence.

- Project: `4207ade6-2604-4e15-9b05-ffa77531d3d2`
- Room: `75e18e73-cf69-4b2e-b192-009fbc135b38`
- Concept: `d9cc2f82-6d8f-455c-8c8d-e08522e0938c`
- Account/environment: Sam local/dev account on localhost/local dev
- Catalogue boundary: existing catalogue rows only
- Write scope: only existing app-flow local/dev concept/job/shopping-list rows required by the validation flow

No second validation pass, production deploy, production flag, controlled preview, live app action, catalogue/product mutation, live ingestion/catalog write, DB/schema/generated type change, runtime allowlist expansion, payment/checkout change, broad scoring rewrite, prompt/runtime image-generation behavior change beyond the validation flow, curtains/textiles candidate generation, thin-pool fix, side-table/storage/media change, lighting change, floor-plan work, final-render execution, or Catalog-First coupling was performed.

## Route Acknowledgement

Product Matching Agent acknowledged the route on PR #272 after merge and before execution:

- Branch: `codex/pm001-post-270-validation`
- PR comment: <https://github.com/Trueflutter/ritzy-studio/pull/272#issuecomment-4574441776>

## Execution

Local server:

- Worktree: `/Users/ayoolatoye/Documents/projects/ritzy-studio-pm001-post-263-validation-route`
- Command: `RITZY_AESTHETIC_TASTE_GATE=1 NEXT_PUBLIC_APP_URL=http://localhost:3004 pnpm --filter @ritzy-studio/web dev --port 3004`
- Local auth: temporary Sam local/dev magic-link session generated through the local Supabase admin path

Validation action:

- URL: `/projects/4207ade6-2604-4e15-9b05-ffa77531d3d2/rooms/75e18e73-cf69-4b2e-b192-009fbc135b38/product-matching`
- Action: submitted the rendered `Refresh matches` form once
- Result: `HTTP/1.1 303 See Other`
- Redirect: `/projects/4207ade6-2604-4e15-9b05-ffa77531d3d2/rooms/75e18e73-cf69-4b2e-b192-009fbc135b38/shopping-list`

Two earlier shell parsing attempts exited before submitting a POST because the local command pipeline stopped while extracting the server-action field. DB readback before the successful POST showed the latest product-sourcing job was still `9d9dff0a-7fcc-48d5-9ec5-93f6c8a3df02`, so those attempts did not create a new Product Matching job. The successful `303` form submission above is the single valid post-PR #270 validation pass.

## Persisted Rows

Readback was performed through local/dev Supabase service-role inspection after the validation action.

- Latest product-sourcing job: `3f99c0de-b9a4-472f-9db3-8f617613d3f4`
- Job status: `succeeded`
- Job type: `product_visual_sourcing`
- Created: `2026-05-29T11:39:47.062287+00:00`
- Completed: `2026-05-29T11:39:47.114+00:00`
- Shopping list: `99062356-7a63-4438-bd4b-461cc43c66ba`
- Shopping-list status: `draft`
- Shopping-list updated: `2026-05-29T11:39:52.72248+00:00`
- Estimated total: AED 14,316
- Item rows: 35
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

## Required Role Evidence

PR #270 succeeded at making the required-role blocker evidence explicit. The three required roles still block the QA stop rules, but the blocker messages now explain the pool and metadata reasons.

| Role key | Selected product | QA status | Enriched blocker evidence |
| --- | --- | --- | --- |
| `sofas::anchor_seating` | Lance 3-Seater Sofa - Nature | `required_closest_available` | candidate pool has 18 candidates; 1,144 catalogue candidates rejected (`category_mismatch: 1144`); weakness: material family weak, silhouette conflicts, color family conflicts; metadata gap: style or room evidence missing |
| `coffee_tables::coffee_table` | Baku Coffee Table - Low | `required_closest_available` | candidate pool has 18 candidates; 1,219 catalogue candidates rejected (`category_mismatch: 1214`, `coffee_table_role_mismatch: 5`); weakness: material family weak, silhouette conflicts, color family conflicts; metadata gaps: material evidence missing, style or room evidence missing |
| `rugs::generous_rug` | Urbana Plain Solid Rug 300 x 400 - White | `required_closest_available` | candidate pool has 18 candidates; 1,221 catalogue candidates rejected (`category_mismatch: 1221`); weakness: color family conflicts, silhouette conflicts; metadata gaps: material evidence missing, style or room evidence missing, dimension evidence missing; dimension evidence: product dimensions missing, fit requires designer review |

QA stop-rule summary:

- `passesQaStopRules`: `false`
- Blockers: 3
- Warnings: 16
- `closestAvailableRequiredCount`: 3
- `weakMaterialRequiredCount`: 1
- `weakRequiredEvidenceCount`: 1
- `partialRequiredEvidenceCount`: 2
- `missingRequiredDimensionCount`: 1
- `staleRequiredFreshnessCount`: 3

## Persisted Selection Snapshot

The persisted-selection snapshot is present and auditable.

Required roles:

- `sofas::anchor_seating`
  - Selected: Lance 3-Seater Sofa - Nature (`dad46b0e-a18d-4c39-8e6a-0d4b06a06739`)
  - Source selected product: `50c49580-2faa-4269-91cd-c9e42c04271e`
  - Concept anchor product: `5ce49c6b-da39-4db0-80d0-4e8d362cebca`
  - `conceptAnchorReplacement`: `true`
  - `postProcessingReplacement`: `true`
  - Option count: 5

- `coffee_tables::coffee_table`
  - Selected: Baku Coffee Table - Low (`7b7ed109-1c0f-4c30-acc6-ba36747a9e2a`)
  - Source selected product: `7b7ed109-1c0f-4c30-acc6-ba36747a9e2a`
  - Concept anchor product: `7b7ed109-1c0f-4c30-acc6-ba36747a9e2a`
  - `conceptAnchorReplacement`: `false`
  - `postProcessingReplacement`: `false`
  - Option count: 1

- `rugs::generous_rug`
  - Selected: Urbana Plain Solid Rug 300 x 400 - White (`e80b7abe-2dbd-4cc4-9e73-4e4f4d7d8276`)
  - Source selected product: `bea2fba3-e7ca-4590-a16a-bd9dfbb0b521`
  - Concept anchor product: `e80b7abe-2dbd-4cc4-9e73-4e4f4d7d8276`
  - `conceptAnchorReplacement`: `false`
  - `postProcessingReplacement`: `true`
  - Option count: 5

## Visual Sourcing Diagnostics

PR #258/#252 timeout isolation evidence remains working for this route:

- `visualSourcingEvidence.status`: `visual_sourcing_skipped_text_fallback`
- `visualSourcingEvidence.timedOut`: `false`
- `visualSourcingEvidence.fallbackUsed`: `true`
- `visualSourcingEvidence.fallbackReason`: `product_candidate_images_disabled`
- `visualSourcingEvidence.initialAttemptDurationMs`: `0`
- `visualSourcingEvidence.textFallbackRoleCount`: `11`
- `productSourcingTimeoutDiagnostics.isolationReason`: `visual_sourcing_skipped_product_images_disabled_text_fallback`
- `productSourcingTimeoutDiagnostics.canDistinguishTimeoutFromSemanticQuality`: `true`
- Retry evidence: `attempted: false`, `timedOut: false`, `fallbackUsed: false`, `fallbackReason: none`

Interpretation: this pass did not wait for a provider visual timeout. It used deterministic text fallback because product candidate images are disabled, so remaining quality findings should be treated as semantic/pool/metadata quality issues rather than visual-provider latency.

## Zero/Thin Pool Warnings

- Curtains/textiles remain zero-candidate:
  - Role: `curtains::curtains_or_textile_layer`
  - Candidate count: 0
  - Rejected count: 1,289
  - Rejection reason: `category_mismatch: 1289`

No required role was empty or thin in this pass. The required-role blockers are closest-available quality/evidence blockers, not zero-candidate blockers.

## Render/List Fidelity Limits

Final render execution was not run and remains outside this route. Observable list-level fidelity:

- Sofa remains concept-anchor replaced and post-processing replaced.
- Coffee table remains concept-anchor stable and post-processing stable.
- Rug keeps the concept-anchor product but is post-processing replaced from source selected product to persisted selected product.
- Lighting regressed at selected-SKU level: this pass selected `Hahn E14 8-lights Linen Chandelier` for `floor or table lighting`, despite the earlier PR #263 validation selecting a floor lamp.

## Result

PM-001 remains below the 9/10 investor-demo bar.

What improved:

- The post-PR #270 evidence is now clear and auditable for the three required closest-available blockers.
- The route cleanly distinguishes deterministic text fallback from provider timeout.

What still blocks:

- Required sofa, coffee table, and rug roles still block as `required_closest_available`.
- Curtains/textiles still have zero eligible candidates.
- Lighting regressed to a chandelier for `floor or table lighting`.
- Side table, wall art, mirror, decor, and storage still require manual QA review as closest-available support selections.
- Final-render fidelity was not executed.

Smallest safe next boundary to request: one narrow local/dev lighting role-fit regression guard/test that specifically prevents `floor or table lighting` from persisting chandeliers/ceiling fixtures after post-processing when eligible floor/table lamps exist. The evidence already shows `lighting_role_fixture_mismatch: 12` in the candidate diagnostics, but persisted selected SKU still regressed to a chandelier in this pass.

Do not run another validation pass, execute final render, mutate catalogue/product rows, broaden scoring, change prompts/runtime image generation, deploy, enable production flags, expand controlled preview, add curtains/textiles candidates, change side-table/storage/media behavior, or introduce Catalog-First coupling without a fresh Sam/Chief route.
