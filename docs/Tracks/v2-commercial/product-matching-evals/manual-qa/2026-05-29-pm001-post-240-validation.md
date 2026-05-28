# PM-001 Post-240 Local/Dev Validation

Date: 2026-05-29
Owner: Product Matching Agent
Ticket: PM-001
Branch: `codex/pm-001-validation-20260529`

## Route Acknowledgement

Product Matching Agent acknowledged the PR #240/#241 stale-recovery route before execution in:

- `docs/Tracks/v2-commercial/process/active-agent-control-board.md`
- `docs/Tracks/v2-commercial/process/product-matching-agent-comms.md`

Accepted boundary: exactly one local/dev validation pass for project `4207ade6-2604-4e15-9b05-ffa77531d3d2`, room `75e18e73-cf69-4b2e-b192-009fbc135b38`, Sam's local/dev account, latest `origin/main`, localhost/local dev, existing catalogue rows only. Allowed writes were the existing app-flow local/dev concept/job/shopping-list rows required by validation.

Forbidden scope remained production deploys/flags, rollout, live app actions, catalogue/product writes, live ingestion, DB/schema/generated type changes, controlled-preview expansion, runtime allowlist expansion, payment/checkout changes, broad scoring rewrites, prompt/runtime/image-generation behavior changes beyond validation, floor-plan work, and Catalog-First coupling.

## Execution

- Worktree: `/Users/ayoolatoye/Documents/projects/ritzy-studio-pm001-validation`
- Branch: `codex/pm-001-validation-20260529`
- Base: `origin/main` at `a394e25afa57986c2006fe460368329614fe1786`
- Local server: `http://localhost:3002`
- Env: copied ignored local/dev `.env.local`; set `RITZY_AESTHETIC_TASTE_GATE=1`
- Auth: temporary Sam local/dev browser/session token for `sam.olatoye@gmail.com`
- Action: submitted the existing Product Matching `Refresh matches` form once for selected concept `d9cc2f82-6d8f-455c-8c8d-e08522e0938c`
- Result: server action returned `303` to `/projects/4207ade6-2604-4e15-9b05-ffa77531d3d2/rooms/75e18e73-cf69-4b2e-b192-009fbc135b38/shopping-list`

One earlier malformed POST did not include the server-action field because the shell expanded the `$ACTION_ID...` form key before Node saw it. It failed immediately with HTTP 500 before Product Matching execution and did not create a `product_visual_sourcing` row. The corrected form submission above is the single valid validation pass.

## Rows Created Or Refreshed

- Product-sourcing job created: `d71d47f6-6f88-43a0-b9fc-f48c1a1492f9`
- Shopping list refreshed: `99062356-7a63-4438-bd4b-461cc43c66ba`
- Shopping-list rows inserted after refresh: 35
- Selected shopping-list item rows:
  - `5ef8176d-a2bb-4d1d-86be-81d3a7517abc`
  - `1c607735-59da-49fe-9dc1-e11e0ff095f8`
  - `92405e0e-1ae2-4eed-a7c4-7cf5a94c74ae`
  - `c3d043ca-5ecc-4725-aafd-548309a797c8`
  - `8eab83ff-015b-48ab-998c-b004f5c27650`
  - `6cffd50b-9b74-4f5f-b48e-8c05814f953b`
  - `3cea27e4-6bd0-4061-a1db-1c3f0875244c`
  - `56a8a0c7-ab0b-42a2-b534-e527f40b2253`
  - `a80c5e59-74c9-4fda-a688-859a003a26b6`
  - `0c779ee1-0ee5-4fd6-890d-0a4903122b9b`

No catalogue/product rows, schema/types, generated types, production config, runtime allowlists, payment/checkout, floor-plan, live ingestion, or Catalog-First rows were changed.

## Job Snapshot

Latest created job `d71d47f6-6f88-43a0-b9fc-f48c1a1492f9`:

- Status: `succeeded`
- Created: `2026-05-28T20:23:02.102586+00:00`
- Completed: `2026-05-28T20:23:47.197+00:00`
- `localSkuFidelityMode`: `true`
- `persistedSelectionSnapshot`: present
- Snapshot source path: `text_fallback`
- AI visual sourcing timed out: `true`
- Timeout: `45000 ms`
- Fallback reason: `initial_visual_sourcing_timeout`
- Candidate count: `180`
- Role pool count: `11`
- Candidate product images enabled: `false`
- Candidate image limit: `0`

The PR #238 audit snapshot is working: the job output now records the final post-processed selected products after shopping-list item writes, including source selected IDs and whether post-processing replaced the raw fallback pick.

## Selected Products

| Role | Product ID | Product | Retailer | Price |
| --- | --- | --- | --- | ---: |
| Anchor seating | `dad46b0e-a18d-4c39-8e6a-0d4b06a06739` | Lance 3-Seater Sofa - Nature / Polyester Fabric & Wood Frame | Chattels & More | AED 6,440 |
| Secondary seating | `d9f6b835-1adf-4553-88f6-4daec956b383` | Paco Fabric Armchair | Home Centre | AED 999 |
| Coffee table | `7b7ed109-1c0f-4c30-acc6-ba36747a9e2a` | Baku Coffee Table - Low | Home Centre | AED 1,099 |
| Generous rug | `e80b7abe-2dbd-4cc4-9e73-4e4f4d7d8276` | Urbana Plain Solid Rug 300 x 400 - White | Danube Home | AED 999 |
| Side/end tables | `a2ff2134-46d4-41db-aeab-59b86e6a68bd` | Lantine Walnut Veneer Side Table with Brass Detail | Chattels & More | AED 2,240 |
| Lighting | `00b2bc65-d156-4951-bdfc-26e95d9c4877` | Hahn E14 8-lights Linen Chandelier | 2XL Home | AED 1,575 |
| Wall art | `94d280ed-cf3f-4106-8323-d7ded075daae` | Minya Framed Canvas Wall Art - 120x60 cm | Home Centre | AED 179 |
| Mirror | `5bcc61bb-45ac-443f-ba90-b2009ede8e3e` | Artemis Arch Wall Mirror - 120x80 cm | Home Centre | AED 349 |
| Decor | `2821efae-44aa-4d4c-9668-b587e0f7776d` | Mirabella Ceramic Vase 12X12X20 cm - Ivory | Danube Home | AED 29 |
| TV/media console | `4b02ac3f-8c3b-4b5c-b54e-be02300d3e80` | Mahmayi Modern 3 Door Credenza Versatile Storage Solution Furniture with 2 Shelves Stylish Credenza for Living Room, Office and Home Decor - White | Danube Home | AED 655 |

Estimated total: AED 14,316.

## Missing Roles

Missing role remains:

- `curtains curtains or textile layer`

This is supported by the role-candidate readback: curtains had `candidateCount: 0` and all 1,289 rejected products were `category_mismatch`. This is correct validation behavior under the existing catalogue-only boundary: the flow did not invent a curtain/textile product.

## Render/List Fidelity

The shopping-list page rendered successfully after the pass and included `10 pieces selected`, `categories chosen`, and the selected product names above.

Concept-generation anchors for concept job `c81bbd4d-8ffc-4cfa-af66-460f4bd04a64` were:

| Role | Concept anchor | Post-processed selected product | Fidelity |
| --- | --- | --- | --- |
| Anchor seating | Victor 2 Seater Sofa - Beige | Lance 3-Seater Sofa - Nature | Replaced |
| Secondary seating | Cream Sandwich Armchair | Paco Fabric Armchair | Replaced |
| Coffee table | Baku Coffee Table - Low | Baku Coffee Table - Low | Preserved |
| Generous rug | Urbana Plain Solid Rug 300 x 400 - White | Urbana Plain Solid Rug 300 x 400 - White | Preserved |

The persisted snapshot also shows raw text-fallback selections being replaced by post-processing for sofa, armchair, rug, lighting, wall art, mirror, decor, and TV/media console. That is now auditable rather than hidden. It also means render/list fidelity is mixed: core table/rug anchors are preserved, but sofa/armchair shifted from the original concept anchor set.

No final render generation was run in this pass.

## Recommendation Similarity

Recommendation rows are same-role alternatives rather than unrelated catalogue objects:

- Sofa alternatives are all sofas and stay in a light/neutral family.
- Armchair alternatives are all fabric Home Centre armchairs at similar price points.
- Rug alternatives are white/beige rug options.
- Wall art, mirror, decor, and storage alternatives remain role-scoped.

Similarity is still uneven because some roles have thin or awkward pools:

- Coffee table has only one option in the persisted snapshot.
- Side/end tables has only one option.
- Lighting selected a chandelier for a role labelled `floor or table lighting`.
- TV/media selected a white credenza with broad living-room/storage language rather than a clearly TV-specific console.

## Repeated Sofa And Support-Role Regressions

The repeated Stone/Rio/Tobago sofa-family regression did not recur in this pass. The selected sofa is now `Lance 3-Seater Sofa - Nature`.

Support-role regressions are improved but not fully cleared:

- Positive: no black/off-theme vase or dark mirror was selected.
- Positive: wall art, mirror, decor, and storage selections are lighter than earlier support-role failures.
- Remaining regression: lighting chose `Hahn E14 8-lights Linen Chandelier`, which does not match the role label's floor/table lighting intent.
- Remaining quality issue: side table and coffee table remain warm walnut/brown, which can still pull the soft-white/greige room toward a heavier wood palette.

## Quality Verdict

PM-001 is still below the investor-demo 9/10 quality bar.

What is working:

- The app-flow validation pass completes locally and redirects to Shopping List.
- The PR #238 persisted-selection snapshot captures final post-processed shopping-list choices.
- Missing curtains are documented instead of hallucinated.
- Repeated sofa-family selection improved in this run.
- Support roles are less obviously off-theme than the prior black/dark support-role failures.

What still blocks a 9/10 claim:

- Visual sourcing still times out and falls back to deterministic text sourcing.
- All required role statuses in raw `roleStatuses` remain `closest_available`.
- Sofa and armchair concept anchors were replaced, so render/list fidelity is not fully preserved.
- Lighting role fit regressed to a chandelier under a floor/table-lighting role.
- Coffee table and side/end-table option pools are too thin for meaningful recommendation similarity.
- Final render/list visual fidelity is not proven because final render generation was not executed.

## Next Narrow Boundary If Validation Fails

Recommended next code boundary, still local/dev only and separate from this evidence PR:

1. Add a focused role-fit guard/test so `floor or table lighting` does not select chandeliers/ceiling fixtures when floor/table lamp candidates exist.
2. Add an audit assertion comparing concept anchors, raw text-fallback picks, and `persistedSelectionSnapshot` replacements for required roles, so render/list drift is visible in tests without another browser run.
3. Add a thin-pool stop/warning for roles with fewer than two viable options, especially coffee tables and side/end tables.
4. Investigate the persistent 45-second visual-sourcing timeout as a runtime/latency slice, without changing production flags, allowlists, prompts, schema, catalogue data, or Catalog-First coupling.

Do not proceed to rollout, controlled-preview expansion, production activation, catalogue writes, ingestion, prompt/runtime image-generation changes, or final-render execution without a fresh Sam/Chief boundary.
