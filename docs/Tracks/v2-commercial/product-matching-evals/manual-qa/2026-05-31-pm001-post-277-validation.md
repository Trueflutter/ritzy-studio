# PM-001 Post-PR #277 Local/Dev Validation Evidence

Date: 2026-05-31
Owner: Product Matching Agent
Ticket: PM-001
Branch: `codex/pm001-post-277-validation-evidence`
Route: PR #278
Route merge commit: `f4fd37df351c1c3e94784c03fc33be89fa9cd6f3`
Validated implementation: PR #277 merged at `fca9ccaecae34d8df7a58fbb42e8cfc9d78a49fb`

## Boundary

This evidence records the one approved local/dev validation pass routed by PR #278 after PR #277 merged the lighting role-fit regression guard/test.

Allowed validation boundary:

- Project: `4207ade6-2604-4e15-9b05-ffa77531d3d2`
- Room: `75e18e73-cf69-4b2e-b192-009fbc135b38`
- Concept: `d9cc2f82-6d8f-455c-8c8d-e08522e0938c`
- Account/environment: Sam local/dev account on localhost/local dev
- Catalogue scope: existing catalogue rows only
- Write scope: only existing app-flow local/dev concept/job/shopping-list rows required by the validation flow

No second validation pass, blind validation, controlled preview, preview QA, browser-click app action, catalogue/product row mutation, live ingestion/catalog write, DB/schema/generated type change, runtime allowlist expansion, production deploy/flag/default-on activation, payment/checkout change, broad Product Matching scoring rewrite, prompt/runtime image-generation behavior change beyond the validation flow, curtains/textiles candidate generation, thin-pool fix, side-table/storage/media change, required sofa/coffee/rug change, floor-plan work, final-render execution, or Catalog-First coupling was performed.

## Route Acknowledgement

Product Matching Agent acknowledged the route on PR #278 after merge and before execution:

- Branch: `codex/pm001-post-277-validation-evidence`
- PR comment: <https://github.com/Trueflutter/ritzy-studio/pull/278#issuecomment-4586643971>

## Execution

Local server:

- Worktree: `/Users/ayoolatoye/Documents/projects/ritzy-studio-pm001-post-277-validation-evidence`
- Command: `RITZY_AESTHETIC_TASTE_GATE=1 NEXT_PUBLIC_APP_URL=http://localhost:3004 pnpm --filter @ritzy-studio/web dev --port 3004`
- Local auth: temporary Sam local/dev magic-link session generated through the local Supabase admin path

Validation action:

- URL: `/projects/4207ade6-2604-4e15-9b05-ffa77531d3d2/rooms/75e18e73-cf69-4b2e-b192-009fbc135b38/product-matching`
- Action: submitted the rendered `Refresh matches` form once
- Result: `HTTP/1.1 303 See Other`
- Redirect: `/projects/4207ade6-2604-4e15-9b05-ffa77531d3d2/rooms/75e18e73-cf69-4b2e-b192-009fbc135b38/shopping-list`

One malformed shell POST attempt was sent before the valid form submission by adding a `Next-Action` header to the rendered form action. It returned `500 Internal Server Error` / closed connection. DB readback immediately after that attempt showed the latest product-sourcing job was still the previous post-PR #270 job `3f99c0de-b9a4-472f-9db3-8f617613d3f4`, so it did not create a Product Matching job or consume the validation boundary. The successful `303` form submission above is the single valid post-PR #277 validation pass. Do not submit another refresh without a fresh route.

## Persisted Rows

Readback was performed through local/dev Supabase service-role inspection after the validation action.

- Latest product-sourcing job: `112bc70e-0229-4f34-856d-716bb54dd46f`
- Job status: `succeeded`
- Job type: `product_visual_sourcing`
- Created: `2026-05-31T12:14:00.615465+00:00`
- Completed: `2026-05-31T12:14:00.678+00:00`
- Shopping list: `99062356-7a63-4438-bd4b-461cc43c66ba`
- Shopping-list status: `draft`
- Shopping-list updated: `2026-05-31T12:14:03.256067+00:00`
- Estimated total: AED 19,680
- Item rows: 44
- Selected rows: 10

## Selected Products

| Category | Role | Selected product | Retailer | Price |
| --- | --- | --- | --- | ---: |
| sofas | anchor seating | Stone 4-Seater Sofa - Grey White \| Blended Fabric & Wood Frame | Chattels & More | AED 9,380 |
| armchairs | secondary seating | Trellis Fabric Chair | Home Centre | AED 669 |
| coffee_tables | coffee table | Baku Coffee Table - Low | Home Centre | AED 809 |
| rugs | generous rug | Urbana Plain Solid Rug 300 x 400 - White | Danube Home | AED 999 |
| side_tables | side or end tables | Tree Side Table, 63Cm | Chattels & More | AED 1,000 |
| lighting | floor or table lighting | Frosty Wooden Floor Lamp - 154 cm | Home Centre | AED 399 |
| wall_art | wall art or focal wall | Mahogany Wall Art - 60x90 cm | Home Centre | AED 169 |
| mirrors | mirror | Zenora Wood Wall Mirror 60X170X2.7Cm Oak | Danube Home | AED 299 |
| decor | cushions, tray, ceramics, and decor | Lexie Caramel Ceramic Pebble Vase White 31X13.8X34Cm | Danube Home | AED 69 |
| storage | TV media console or built-in media unit | Puro Brown Solid Mango Wood TV Board | Chattels & More | AED 5,149 |

## PR #277 Validation Result

PR #277 is validated for its intended narrow slice: after post-processing, chandeliers, pendants, and ceiling fixtures did not persist for the `floor or table lighting` role while eligible floor/table lamps existed.

Lighting evidence:

- Role: `lighting` / `floor or table lighting`
- Persisted selected product: `Frosty Wooden Floor Lamp - 154 cm`
- Persisted selected product id: `7402940d-d061-49ad-b1bd-597d7a673cad`
- Source text-fallback product: `Blake Wooden Tripod Floor Lamp - 149 cm`
- Source text-fallback product id: `60b20a38-0e32-4eb0-8070-489777fd2880`
- Persisted option count: 6
- Persisted option pool:
  - `Frosty Wooden Floor Lamp - 154 cm`
  - `Arina Marble Table Lamp - 65 cm`
  - `Elke Wooden Table Lamp - 40 cm`
  - `Grene Ceramic Table Lamp - 35Cm`
  - `Frosty Ceramic Table Lamp - 40Cm`
  - `Berit Paper Rope Table Lamp - 34 cm`
- The previous failing product `Hahn E14 8-lights Linen Chandelier` did not persist in the selected product or option pool.
- No chandelier, pendant, or ceiling fixture was present in the persisted `floor or table lighting` option pool.

The post-PR #270 validation selected `Hahn E14 8-lights Linen Chandelier` for this same floor/table lighting role. This post-PR #277 pass selected a floor lamp and retained only floor/table lamp alternatives in the persisted option pool.

## Visual Sourcing Diagnostics

The run stayed on deterministic text fallback because product candidate images remain disabled.

- `visualSourcingEvidence.status`: `visual_sourcing_skipped_text_fallback`
- `visualSourcingEvidence.timedOut`: `false`
- `visualSourcingEvidence.fallbackUsed`: `true`
- `visualSourcingEvidence.fallbackReason`: `product_candidate_images_disabled`
- `visualSourcingEvidence.initialAttemptDurationMs`: `0`
- `visualSourcingEvidence.textFallbackRoleCount`: `11`
- `visualSourcingEvidence.rolePoolCount`: `11`
- `visualSourcingEvidence.candidateCount`: `180`
- `productSourcingTimeoutDiagnostics.isolationReason`: `visual_sourcing_skipped_product_images_disabled_text_fallback`
- `productSourcingTimeoutDiagnostics.canDistinguishTimeoutFromSemanticQuality`: `true`
- `productSourcingTimeoutDiagnostics.productCandidateImagesEnabled`: `false`
- `productSourcingTimeoutDiagnostics.candidateImageLimit`: `0`
- Retry evidence: `attempted: false`, `timedOut: false`, `fallbackUsed: false`, `fallbackReason: none`

This confirms the validation did not wait for provider visual-sourcing latency. Remaining quality findings should be treated as semantic matching, catalogue pool, metadata, or render/list fidelity issues.

## Persisted Selection Snapshot

The persisted-selection snapshot is present and auditable.

Required roles:

- `sofas::anchor_seating`
  - Selected: Stone 4-Seater Sofa - Grey White | Blended Fabric & Wood Frame (`1b0e5fbf-74e7-497f-8e11-0fcc3aa18972`)
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
  - Option count: 2

- `rugs::generous_rug`
  - Selected: Urbana Plain Solid Rug 300 x 400 - White (`e80b7abe-2dbd-4cc4-9e73-4e4f4d7d8276`)
  - Source selected product: `bea2fba3-e7ca-4590-a16a-bd9dfbb0b521`
  - Concept anchor product: `e80b7abe-2dbd-4cc4-9e73-4e4f4d7d8276`
  - `conceptAnchorReplacement`: `false`
  - `postProcessingReplacement`: `true`
  - Option count: 5

Lighting role:

- `lighting::floor_or_table_lighting`
  - Selected: Frosty Wooden Floor Lamp - 154 cm (`7402940d-d061-49ad-b1bd-597d7a673cad`)
  - Source selected product: `60b20a38-0e32-4eb0-8070-489777fd2880`
  - Concept anchor product: `null`
  - `conceptAnchorReplacement`: `false`
  - `postProcessingReplacement`: `true`
  - Option count: 6

Persisted option counts:

- Sofa: 5
- Armchair: 5
- Coffee table: 2
- Rug: 5
- Side/end tables: 1
- Lighting: 6
- Wall art: 6
- Mirror: 6
- Decor: 4
- Storage: 4

## Pool And QA Evidence

The current `output_summary` does not include a `qaStopRuleSummary` key. The available role status and pool evidence still shows PM-001 remains below the investor-demo bar.

Missing role:

- `curtains curtains or textile layer`
- Current status: `missing_supporting`
- Curtains/textiles candidate status: zero persisted selected/option rows in this pass

Role statuses:

- `sofas::anchor_seating`: `closest_available`
- `armchairs::secondary_seating`: `closest_available`
- `coffee_tables::coffee_table`: `closest_available`
- `rugs::generous_rug`: `closest_available`
- `side_tables::side_or_end_tables`: `closest_available`
- `lighting::floor_or_table_lighting`: `closest_available`
- `wall_art::wall_art_or_focal_wall`: `closest_available`
- `mirrors::mirror`: `closest_available`
- `decor::cushions_tray_ceramics_and_decor`: `closest_available`
- `storage::tv_media_console_or_built_in_media_unit`: `closest_available`
- `curtains::curtains_or_textile_layer`: `missing_supporting`

Thin/zero persisted pools:

- Curtains/textiles: zero candidates persisted for the supporting textile layer.
- Side/end tables: one persisted option.
- Coffee table: two persisted options.
- Decor: four persisted options.
- Storage: four persisted options.

Required roles are no longer zero-candidate, but sofa, coffee table, and rug still surface as closest-available matches rather than investor-demo-grade required-role matches.

## Render/List Fidelity Limits

Final render execution was not run and remains outside this route. Observable list-level fidelity:

- The persisted shopping list now selects a floor lamp for `floor or table lighting`, and the option pool contains no chandelier/pendant/ceiling fixture.
- Sofa remains concept-anchor replaced and post-processing replaced.
- Coffee table remains concept-anchor stable and post-processing stable.
- Rug keeps the concept-anchor product but is post-processing replaced from source selected product to persisted selected product.
- Storage still selects a dark/heavy TV board, which may require separate aesthetic review if PM-001 quality work continues.

## Result

PR #277 is validated for the narrow lighting guard: `Hahn E14 8-lights Linen Chandelier` no longer persists for `floor or table lighting` when eligible floor/table lamps exist.

PM-001 remains below the 9/10 investor-demo bar.

What improved:

- The post-PR #277 pass selected `Frosty Wooden Floor Lamp - 154 cm` for floor/table lighting.
- The persisted floor/table lighting option pool contains only floor/table lamps.
- The run cleanly distinguishes deterministic text fallback from provider timeout.

What still blocks:

- Required sofa, coffee table, and rug roles still report closest-available quality status.
- Curtains/textiles still have no persisted candidates for the supporting textile layer.
- Side-table, coffee-table, decor, and storage pools are thin.
- Storage/media aesthetic fit remains uncertain.
- Final-render fidelity was not executed.

Smallest safe next boundary to request after this evidence PR is reviewed and merged: return PM-001 to Chief/Sam for a fresh exact route. The next narrow boundary should not be another validation pass. Based on this evidence, the likely candidates are a required-role quality/evidence slice for sofa/coffee/rug, a curtains/textiles candidate-source route, or a storage/media support-role quality route, but each requires explicit approval.

Do not run another validation pass, execute final render, mutate catalogue/product rows, broaden scoring, change prompts/runtime image generation, deploy, enable production flags, expand controlled preview, add curtains/textiles candidates, change side-table/storage/media behavior, alter required sofa/coffee/rug behavior, or introduce Catalog-First coupling without a fresh Sam/Chief route.
