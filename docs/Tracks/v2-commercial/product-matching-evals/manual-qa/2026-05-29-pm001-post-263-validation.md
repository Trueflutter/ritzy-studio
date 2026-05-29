# PM-001 Post-#263 Local/Dev Validation Evidence

Date: 2026-05-29
Owner: Product Matching Agent
Ticket: PM-001
Branch: `codex/pm001-post-263-validation-evidence`

## Boundary

This evidence records the one approved local/dev validation pass routed by PR #265 after PR #263 merged the lighting role-fit guard/test.

Allowed validation boundary:

- Project: `4207ade6-2604-4e15-9b05-ffa77531d3d2`
- Room: `75e18e73-cf69-4b2e-b192-009fbc135b38`
- Concept: `d9cc2f82-6d8f-455c-8c8d-e08522e0938c`
- Account/environment: Sam local/dev account on localhost/local dev
- Catalogue scope: existing catalogue rows only
- Write scope: only existing app-flow local/dev concept/job/shopping-list rows required by the validation flow

No second validation pass, production deploy, production flag, controlled preview, live app action, catalogue/product mutation, live ingestion/catalog write, DB/schema/generated type change, runtime allowlist expansion, payment/checkout change, broad scoring rewrite, prompt/runtime image-generation behavior change, curtains/textiles candidate generation, thin-pool fix, sofa/coffee/rug rewrite, floor-plan work, final-render execution, or Catalog-First coupling was performed.

## Route Acknowledgement

Product Matching Agent acknowledged the route on PR #265 after merge and before execution:

- Branch: `codex/pm001-post-263-validation-evidence`
- Route merge commit: `18e9bccefdda1725fb4dca909704197e9f311ca6`
- PR comment: <https://github.com/Trueflutter/ritzy-studio/pull/265#issuecomment-4573771138>

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

No malformed action POST was sent during this validation. The single successful form submission above is the only valid post-#263 validation pass.

## Persisted Rows

Readback was performed through local/dev Supabase service-role inspection after the validation action.

- Latest product-sourcing job: `9d9dff0a-7fcc-48d5-9ec5-93f6c8a3df02`
- Job status: `succeeded`
- Job type: `product_visual_sourcing`
- Created: `2026-05-29T10:21:59.757528+00:00`
- Completed: `2026-05-29T10:21:59.961+00:00`
- Shopping list: `99062356-7a63-4438-bd4b-461cc43c66ba`
- Shopping-list status: `draft`
- Shopping-list updated: `2026-05-29T10:22:05.456153+00:00`
- Estimated total: AED 19,680
- Item rows: 45
- Selected rows: 10

## Selected Products

| Category | Role | Selected product | Retailer | Price |
| --- | --- | --- | --- | ---: |
| sofas | anchor seating | Stone 4-Seater Sofa - Grey White | Chattels & More | AED 9,380 |
| armchairs | secondary seating | Trellis Fabric Chair | Home Centre | AED 899 |
| coffee_tables | coffee table | Baku Coffee Table - Low | Home Centre | AED 1,099 |
| rugs | generous rug | Urbana Plain Solid Rug 300 x 400 - White | Danube Home | AED 999 |
| side_tables | side or end tables | Tree Side Table, 63Cm | Chattels & More | AED 1,000 |
| lighting | floor or table lighting | Frosty Wooden Floor Lamp - 154 cm | Home Centre | AED 399 |
| wall_art | wall art or focal wall | Mahogany Wall Art - 60x90 cm | Home Centre | AED 349 |
| mirrors | mirror | Zenora Wood Wall Mirror 60X170X2.7Cm Oak | Danube Home | AED 299 |
| decor | cushions, tray, ceramics, and decor | Lexie Caramel Ceramic Pebble Vase White 31X13.8X34Cm | Danube Home | AED 69 |
| storage | TV media console or built-in media unit | Puro Brown Solid Mango Wood TV Board | Chattels & More | AED 5,149 |

## PR #263 Validation Result

PR #263 fixed the specific chandelier/floor-light regression observed in the prior post-#258 validation evidence.

Lighting evidence:

- Role: `lighting` / `floor or table lighting`
- Persisted selected product: `Frosty Wooden Floor Lamp - 154 cm`
- Persisted selected product id: `7402940d-d061-49ad-b1bd-597d7a673cad`
- Source text-fallback product: `Blake Wooden Tripod Floor Lamp - 149 cm`
- Source text-fallback product id: `60b20a38-0e32-4eb0-8070-489777fd2880`
- Persisted option count: 6
- Persisted option pool contained only floor/table lamps:
  - `Frosty Wooden Floor Lamp - 154 cm`
  - `Arina Marble Table Lamp - 65 cm`
  - `Elke Wooden Table Lamp - 40 cm`
  - `Grene Ceramic Table Lamp - 35Cm`
  - `Frosty Ceramic Table Lamp - 40Cm`
  - `Berit Paper Rope Table Lamp - 34 cm`
- Lighting pool diagnostics recorded `lighting_role_fixture_mismatch: 12`.
- No chandelier, pendant, or ceiling fixture was selected for the floor/table lighting role.

The previous post-#258 validation selected `Hahn E14 8-lights Linen Chandelier` for this same floor/table lighting role. This pass selected a floor lamp and retained eligible table-lamp alternatives.

## Visual Sourcing Evidence

The run stayed on deterministic text fallback because product candidate images remain disabled.

- `productSourcingTextFallbackUsed`: true
- `productSourcingTextFallbackReason`: `product_candidate_images_disabled`
- `productSourcingTimeoutDiagnostics.isolationReason`: `visual_sourcing_skipped_product_images_disabled_text_fallback`
- `productSourcingTimeoutDiagnostics.canDistinguishTimeoutFromSemanticQuality`: true
- `productSourcingTimeoutDiagnostics.initialAttemptDurationMs`: 0
- `visualSourcingEvidence.status`: `visual_sourcing_skipped_text_fallback`
- `visualSourcingEvidence.timedOut`: false
- `visualSourcingEvidence.fallbackReason`: `product_candidate_images_disabled`
- Retry evidence: `attempted: false`, `timedOut: false`, `fallbackUsed: false`, `fallbackReason: none`
- Candidate count: 180
- Role pool count: 11
- Product candidate images enabled: false
- Candidate image limit: 0

This confirms the current validation is not blocked by provider visual-sourcing latency. Remaining defects are product matching/catalogue-pool quality and render/list fidelity unknowns, not a visual-provider timeout.

## Persisted Selection Snapshot

The persisted-selection snapshot is present and auditable.

Concept-anchor replacement evidence:

- Sofa concept anchor `5ce49c6b-da39-4db0-80d0-4e8d362cebca` was replaced by persisted selected product `1b0e5fbf-74e7-497f-8e11-0fcc3aa18972`; `conceptAnchorReplacement: true`.
- Coffee-table concept anchor `7b7ed109-1c0f-4c30-acc6-ba36747a9e2a` persisted unchanged; `conceptAnchorReplacement: false`.
- Rug concept anchor `e80b7abe-2dbd-4cc4-9e73-4e4f4d7d8276` persisted unchanged; `conceptAnchorReplacement: false`.

Post-processing replacement evidence:

- Sofa, armchair, rug, side table, lighting, wall art, mirror, decor, and storage show `postProcessingReplacement: true`.
- Coffee table did not show post-processing replacement.
- Lighting source selection `Blake Wooden Tripod Floor Lamp - 149 cm` was post-processed to persisted selection `Frosty Wooden Floor Lamp - 154 cm`.

Persisted option counts:

- Sofa: 5
- Armchair: 5
- Coffee table: 2
- Rug: 6
- Side/end tables: 1
- Lighting: 6
- Wall art: 6
- Mirror: 6
- Decor: 4
- Storage: 4

## Pool And QA Evidence

Missing role:

- `curtains curtains or textile layer`
- Curtains/textile candidate count: 0
- Curtains/textile rejected count: 1,289
- Curtains/textile rejection reason: `category_mismatch`

QA stop rules:

- `passesQaStopRules`: false
- Blocker count: 3
- Warning count: 16
- Required-role blockers:
  - `sofas::anchor_seating` - `required_closest_available`
  - `coffee_tables::coffee_table` - `required_closest_available`
  - `rugs::generous_rug` - `required_closest_available`
- Required thin/empty pool counts:
  - `thinRequiredPoolCount`: 0
  - `emptyRequiredPoolCount`: 0
  - `missingRequiredRoleCount`: 0

Support-role warnings remain for armchair, side table, lighting, wall art, mirror, curtains/textiles, decor, and storage because they are closest-available or missing-supporting matches.

## Role-Fit Notes

Improved:

- The specific lighting regression is resolved in this local/dev pass: floor/table lighting no longer selects a chandelier when eligible floor/table lamps exist.
- The lighting pool now exposes multiple floor/table lamp alternatives and records explicit ceiling-fixture rejection evidence.
- Missing curtains/textiles are documented rather than silently faked.
- Visual-sourcing fallback remains clearly distinguished from semantic matching quality.

Still below bar:

- Required sofa, coffee table, and rug roles still fail QA stop rules as `required_closest_available`.
- Curtains/textiles still have zero candidates.
- Side/end-table options remain thin at one persisted option.
- Storage selected `Puro Brown Solid Mango Wood TV Board`; this may be visually heavy/dark for the soft-neutral concept even though it is a TV-media product.
- Final render/list fidelity is not proven because final-render execution was explicitly forbidden by the route.

## Verdict

PM-001 remains below the investor-demo 9/10 quality bar, but PR #263 is validated for its intended slice.

The immediate chandelier/floor-light defect is fixed: the post-#263 pass selected a floor lamp for `floor or table lighting`, preserved floor/table lamp alternatives, and recorded `lighting_role_fixture_mismatch` rejections for ceiling fixtures.

The remaining blockers are narrower and clearer:

- Required hero roles still report closest-available QA blockers.
- Curtains/textiles require a separate approved boundary because no catalogue candidates are available for that role.
- Support-role aesthetic polish is still uneven, especially storage/media.
- Render-to-list fidelity cannot be claimed until a separately routed final-render validation boundary exists.

## Recommended Next Boundary

Return PM-001 to `BLOCKED` after this evidence PR is reviewed and merged.

Smallest safe next boundary to request: one narrow local/dev required-role QA hardening slice for the three remaining required blockers (`sofas`, `coffee_tables`, `rugs`). The target should either raise these above `required_closest_available` with deterministic evidence or make the stop-rule artifact more explicit about which catalogue metadata/pool condition prevents acceptable required-role confidence.

Do not run another validation pass, execute final render, mutate catalogue/product rows, broaden scoring, change prompts/runtime image generation, deploy, enable production flags, expand controlled preview, add curtains/textiles candidates, or introduce Catalog-First coupling without a fresh Sam/Chief route.
