# PM-001 Post-#255 Local/Dev Validation Evidence

Date: 2026-05-29
Owner: Ritzy Chief Architect
Route: PR #255 merged at `d129765cc1752f6b1cbdabf518affdb126cadbd2`
Branch: `codex/pm001-post-255-validation`

## Boundary

This evidence records the one approved local/dev validation pass routed by PR #255 after PR #254 merged the concept-anchor replacement audit evidence.

Allowed validation boundary:

- Project: `4207ade6-2604-4e15-9b05-ffa77531d3d2`
- Room: `75e18e73-cf69-4b2e-b192-009fbc135b38`
- Concept: `d9cc2f82-6d8f-455c-8c8d-e08522e0938c`
- Account/environment: Sam local/dev account on localhost/local dev
- Catalogue scope: existing catalogue rows only
- Write scope: only existing app-flow local/dev concept/job/shopping-list rows required by the validation flow

No production deploy, production flag, controlled preview, live app action, catalogue/product mutation, live ingestion/catalog write, DB/schema/generated type change, runtime allowlist expansion, payment/checkout change, broad scoring rewrite, prompt/runtime image-generation behavior change, floor-plan work, or Catalog-First coupling was performed.

## Execution

Local server:

- Worktree: `/Users/ayoolatoye/Documents/projects/ritzy-studio-pm001-post-255-validation`
- Base: `origin/main` at `d129765cc1752f6b1cbdabf518affdb126cadbd2`
- Command: `RITZY_AESTHETIC_TASTE_GATE=1 NEXT_PUBLIC_APP_URL=http://localhost:3002 pnpm --filter @ritzy-studio/web dev --port 3002`
- Local auth: temporary Sam local/dev magic-link session cookie generated through the local Supabase admin flow

Validation action:

- URL: `/projects/4207ade6-2604-4e15-9b05-ffa77531d3d2/rooms/75e18e73-cf69-4b2e-b192-009fbc135b38/product-matching`
- Result: `HTTP/1.1 303 See Other`
- Redirect: `/projects/4207ade6-2604-4e15-9b05-ffa77531d3d2/rooms/75e18e73-cf69-4b2e-b192-009fbc135b38/shopping-list`

No second validation pass was run.

## Persisted Rows

Readback was performed through local/dev Supabase service-role inspection after the validation action.

- Latest product-sourcing job: `96418e26-05a7-46f1-a1dc-fea7908c3e7c`
- Job status: `succeeded`
- Job type: `product_visual_sourcing`
- Created: `2026-05-29T07:11:45.767743+00:00`
- Completed: `2026-05-29T07:12:31.018+00:00`
- Shopping list: `99062356-7a63-4438-bd4b-461cc43c66ba`
- Shopping-list status: `draft`
- Estimated total: AED 19,680
- Item rows: 44
- Selected rows: 10

## Selected Products

| Category | Role | Selected product | Retailer | SKU | Price |
| --- | --- | --- | --- | --- | ---: |
| sofas | anchor seating | Stone 4-Seater Sofa - Grey White | Chattels & More | `FCM01OLTA0078` | 9,380 |
| armchairs | secondary seating | Trellis Fabric Chair | Home Centre | `emax_01KFJAHB7YW538097S3MA51MC9` | 669 |
| coffee_tables | coffee table | Baku Coffee Table - Low | Home Centre | `emax_01J0NBZGA75VNV0FAJ0VRA0E6C` | 809 |
| rugs | generous rug | Urbana Plain Solid Rug 300 x 400 - White | Danube Home | `231200401280` | 999 |
| side_tables | side or end tables | Tree Side Table, 63Cm | Chattels & More | `FO02KARE0750` | 1,000 |
| lighting | floor or table lighting | Frosty Wooden Floor Lamp - 154 cm | Home Centre | `emax_01K1716D5PQYBK1CMPRJ0H12WB` | 399 |
| wall_art | wall art or focal wall | Mahogany Wall Art - 60x90 cm | Home Centre | `emax_01J47K9YY51R171G9R23XX0REA` | 169 |
| mirrors | mirror | Zenora Wood Wall Mirror 60X170X2.7Cm Oak | Danube Home | `290102600221` | 299 |
| decor | cushions, tray, ceramics, and decor | Lexie Caramel Ceramic Pebble Vase White 31X13.8X34Cm | Danube Home | `290101601588` | 69 |
| storage | TV media console or built-in media unit | Puro Brown Solid Mango Wood TV Board | Chattels & More | `FO03KARE0332` | 5,149 |

## Evidence Findings

Visual sourcing timeout isolation is now explicit:

- `productSourcingTimedOut`: true
- `productSourcingTextFallbackUsed`: true
- `productSourcingTextFallbackReason`: `initial_visual_sourcing_timeout`
- `productSourcingTimeoutDiagnostics.isolationReason`: `visual_sourcing_timeout_text_fallback`
- `productSourcingTimeoutDiagnostics.canDistinguishTimeoutFromSemanticQuality`: true
- Initial attempt duration: 45,064 ms against a 45,000 ms timeout
- Product candidate images were disabled for this attempt

Concept-anchor audit evidence is now explicit in `persistedSelectionSnapshot.roles[]`:

- Sofa concept anchor `5ce49c6b-da39-4db0-80d0-4e8d362cebca` was replaced by persisted selected product `1b0e5fbf-74e7-497f-8e11-0fcc3aa18972`; `conceptAnchorReplacement: true`.
- Coffee-table concept anchor `7b7ed109-1c0f-4c30-acc6-ba36747a9e2a` persisted unchanged; `conceptAnchorReplacement: false`.
- Rug concept anchor `e80b7abe-2dbd-4cc4-9e73-4e4f4d7d8276` persisted unchanged; `conceptAnchorReplacement: false`.
- Most roles still show `postProcessingReplacement: true`, which is now visible and reviewable instead of hidden.

Lighting role fit improved:

- The selected floor/table lighting product is `Frosty Wooden Floor Lamp - 154 cm`.
- The option pool includes floor/table lamp alternatives.
- The previous chandelier-for-floor/table-lighting failure did not recur in this pass.

Pool and readiness evidence:

- Curtains/textile layer remains missing: `missingRoles` includes `curtains curtains or textile layer`.
- `roleCandidateCounts` for curtains/textiles shows `candidateCount: 0`, `rejectedCount: 1289`, all by category mismatch.
- Side tables remain thin after post-processing: persisted side-table `optionCount: 1`.
- Coffee tables remain thin: persisted coffee-table `optionCount: 2`.
- The confidence gate reports 3 blockers and 16 warnings.
- Required-role blockers are all `required_closest_available`: sofas, coffee tables, and rugs.

## Verdict

PM-001 is moving again and the recent slices are paying off:

- The visual-sourcing timeout is now isolated from semantic matching quality.
- Concept-anchor replacement is now explicitly auditable.
- Lighting no longer chooses a chandelier for the floor/table-lighting role in this pass.
- Thin/empty pool and readiness warnings are now visible.

PM-001 is still below the 9/10 investor-demo bar. The blocking issues are:

- Visual sourcing still times out and falls back to deterministic text matching.
- Curtains/textile layer still has zero eligible candidates.
- Sofa concept anchor replacement remains real and now visible.
- Required sofa, coffee table, and rug selections are still only `closest_available`.
- Coffee-table and side-table option pools remain thin.

## Recommended Next Boundary

Return PM-001 to `BLOCKED` after this evidence PR is reviewed and merged.

Smallest safe next boundary to request: one narrow local/dev fix for product visual-sourcing timeout behavior. The target should be timeout reduction or retry/fallback behavior only, with deterministic evidence that distinguishes provider timeout from matching quality. Do not run another validation pass until that boundary is explicitly routed.
