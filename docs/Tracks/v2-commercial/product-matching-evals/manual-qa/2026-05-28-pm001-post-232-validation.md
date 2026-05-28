# PM-001 Post-232 Local/Dev Validation

Date: 2026-05-28
Owner: Product Matching Agent
Ticket: PM-001
Branch: `codex/pm001-post-232-validation`

## Source Of Truth

`docs/Tracks/v2-commercial/process/active-agent-control-board.md` shows PM-001 as `ROUTED` to Product Matching Agent for post-PR #232 local/dev validation and failure isolation.

Allowed scope is local/dev PM-001 validation and failure isolation for selected SKUs, repeated-sofa behavior, missing support roles, render/list fidelity, recommendation similarity, and the next narrow code boundary if validation fails. The route is limited to existing test/demo project and room data on localhost using existing catalogue rows only.

Forbidden scope remains production deploys/flags, live catalogue writes/ingestion, catalogue/product row mutations, DB/schema/generated type changes, payment/checkout, floor-plan work, Catalog-First coupling, controlled-preview expansion, runtime allowlist expansion, default-on production activation, unrelated UI redesign, broad catalogue rewrites, and broad scoring rewrites.

Product Matching Agent acknowledged the route on PR #234 with branch `codex/pm001-post-232-validation` before collecting this evidence.

## Validation Method

This pass used read-only evidence only:

- Read PM-001 board/mailbox state on latest `origin/main` after PR #234.
- Read PR #230 and PR #232 merged evidence.
- Read local validation artifacts from `/private/tmp/pm001-support-role-validation.json` and `/private/tmp/ritzy-aesthetic-validation/*`.
- Queried existing local/dev Supabase rows for the already-routed PM-001 demo rooms.

No fresh Product Matching run, browser-click app action, draft shopping-list refresh, catalogue write, catalogue ingestion, schema/type change, production flag, deploy, allowlist change, prompt/runtime behavior change, payment/checkout change, floor-plan work, or Catalog-First coupling was performed in this pass.

## Evidence Targets

Primary post-PR #232 validation target:

- Project: `4207ade6-2604-4e15-9b05-ffa77531d3d2`
- Room: `75e18e73-cf69-4b2e-b192-009fbc135b38`
- Room type: `Living Room`
- Latest shopping list: `99062356-7a63-4438-bd4b-461cc43c66ba`
- Latest product-sourcing job: `515c8a09-ec4c-4cc2-be00-47f348f5e6c3`
- Prior refresh-diversity evidence job: `5473e873-ca82-44ad-a0e1-3ae6981e47f8`

Reference current-main persisted validation target:

- Project: `b8b1cf67-cc0c-43bf-87c4-edce2d2c4ab2`
- Room: `8ba3a184-8beb-45a3-a5e6-d0696e8073ef`
- Concept: `5bb6a8d1-0eff-4b18-8c52-80f422b2d287`
- Shopping list: `07779653-0a11-41cc-864b-fe731c919438`
- Validation job: `71f9f088-5ead-4d60-99a4-a5dcddb994e7`

## Selected SKU Readback

Latest post-PR #232 persisted shopping-list selections for room `75e18e73-cf69-4b2e-b192-009fbc135b38`:

| Role | Selected SKU | Retailer | Palette/material readback |
| --- | --- | --- | --- |
| Anchor seating | Stone 4-Seater Sofa - Grey White | Chattels & More | white, fabric/wood frame |
| Secondary seating | Trellis Fabric Chair | Home Centre | taupe fabric |
| Coffee table | Baku Coffee Table - Low | Home Centre | walnut |
| Generous rug | Urbana Plain Solid Rug 300 x 400 - White | Danube Home | white |
| Side/end tables | Tree Side Table, 63Cm | Chattels & More | brown teak |
| Lighting | Frosty Wooden Floor Lamp - 154 cm | Home Centre | walnut wood |
| Wall art | Mahogany Wall Art - 60x90 cm | Home Centre | white MDF |
| Mirror | Zenora Wood Wall Mirror 60X170X2.7Cm Oak | Danube Home | brown/oak wood |
| Curtains/textile layer | No persisted selection | n/a | no eligible curtains candidates |
| Decor | Lexie Caramel Ceramic Pebble Vase White | Danube Home | white ceramic |
| TV/media console | Puro Brown Solid Mango Wood TV Board | Chattels & More | brown mango wood |

What is better after PR #230 and PR #232:

- The persisted support selections no longer show the earlier black/off-theme vase or mirror failure.
- Lighting, decor, wall art, rug, and most armchair alternatives stay in a soft-neutral or warm-wood family.
- Curtains/textiles are documented as missing rather than faked.
- Recommendation rows are same-role alternatives, not unrelated catalogue objects.

## Failure Taxonomy

### 1. Visual Sourcing Timeout

The latest three product visual sourcing jobs for room `75e18e73-cf69-4b2e-b192-009fbc135b38` all fell back to deterministic text sourcing:

| Job | Created | Timed out | Timeout | Fallback | Candidate count | Role pools | Candidate images |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| `515c8a09-ec4c-4cc2-be00-47f348f5e6c3` | 2026-05-28 11:40 UTC | yes | 45000 ms | `initial_visual_sourcing_timeout` | 180 | 11 | disabled, limit 0 |
| `5473e873-ca82-44ad-a0e1-3ae6981e47f8` | 2026-05-28 11:36 UTC | yes | 45000 ms | `initial_visual_sourcing_timeout` | 180 | 11 | disabled, limit 0 |
| `34d6c3d2-c6c8-45f8-9f61-f31119dc1cd5` | 2026-05-28 11:22 UTC | yes | 45000 ms | `initial_visual_sourcing_timeout` | 180 | 11 | disabled, limit 0 |

The timeout diagnostic metadata added by PR #230 is working: each latest row records `productSourcingTimeoutDiagnostics` with `timedOut: true`, `fallbackUsed: true`, `conceptImageDetail: "low"`, `candidateImageLimit: 0`, and `productCandidateImagesEnabled: false`.

This isolates the current visual-sourcing issue from product-image preflight: candidate product images are not being sent (`candidateImageLimit: 0`), so candidate-image payload size is not the current cause. Remaining suspects are concept-image processing, structured candidate context, model latency, or the 45 second timeout cap.

### 2. Repeated Hero SKU Selection

PR #232 proved that refresh history can move selection away from an earlier Stone/Rio/Tobago sofa cluster when a credible same-role alternative exists. However, the latest persisted shopping list for room `75e18e73-cf69-4b2e-b192-009fbc135b38` selected Stone again, with Rio and Tobago still appearing as high-ranked sofa alternatives.

Current evidence says refresh diversity is directionally useful but not yet robust enough to guarantee non-repetition across repeated local/dev refreshes.

Recommended next narrow code boundary:

- Strengthen the deterministic refresh-history penalty only inside local/dev `localSkuFidelityMode` option composition.
- Keep the best candidate first when the pool is thin or the alternative is off-palette.
- Add a focused domain test proving a repeated Stone/Rio/Tobago family yields a same-role, same-palette alternative only when that alternative clears the existing aesthetic quality threshold.

### 3. Missing Role Despite Catalogue Candidates

Curtains/textiles remain missing because the current role pool has zero eligible `curtains` candidates:

- Latest job `515c8a09-ec4c-4cc2-be00-47f348f5e6c3` records missing role `curtains curtains or textile layer`.
- Role candidate count for curtains is `0`.
- Rejection reason is entirely `category_mismatch`.

This is the correct behavior for the current catalogue state: Product Matching should document the missing role, not invent a curtains/textile SKU.

No code change is recommended unless Sam/Chief approve catalogue ingestion or category expansion work. Catalogue/product row mutation remains forbidden.

### 4. Off-Palette Recommendation Alternatives

Persisted shopping-list alternatives are improved but still uneven:

- Good: armchair alternatives are beige/taupe fabric; rug alternatives are white/beige; lighting alternatives are walnut, white, marble, ceramic, paper rope.
- Mixed: mirror alternatives still lean walnut/brown, with one ivory/white mirror available lower in the set.
- Mixed: TV/media options lean brown/walnut; no light oak/white media unit is selected in the latest persisted list even though prior support-role readback found lighter storage candidates.
- Watch item: `ai_jobs.output_summary.roleStatuses` for the latest job still shows a raw fallback wall-art pick with navy/multicolor wording, while the persisted shopping list has a cleaner white wall-art selection.

Recommended next narrow code boundary:

- Preserve the PR #230 support-role family filters, but add an audit check that persisted recommendation rows and `ai_jobs.output_summary.roleStatuses` agree on final selected products after post-processing.
- Prefer lighter mirror/media alternatives when they clear role fit and same-palette thresholds.

### 5. Render/List Fidelity

This read-only pass can verify persisted concept/list anchors for the reference validation target `b8b1cf67-cc0c-43bf-87c4-edce2d2c4ab2`:

| Role | Render/list anchor |
| --- | --- |
| Anchor seating | Victor 2 Seater Sofa - Beige |
| Secondary seating | Rudnick Fabric Armchair |
| Coffee table | Kinzie Sintered Stone Top Coffee Table |
| Generous rug | Galeria Lux Modern Geometrics Rug 240x340 White Gold |

For the post-PR #232 target `4207ade6-2604-4e15-9b05-ffa77531d3d2`, this pass verifies the current shopping-list rows but does not prove final render fidelity because it did not trigger a new final render or browser-click flow.

Important audit gap:

- Latest job `515c8a09-ec4c-4cc2-be00-47f348f5e6c3` records raw fallback `roleStatuses` such as Nicole sofa, Stilo brown leather armchair, and navy/multicolor wall art.
- The persisted shopping list for the same room/concept records different final rows such as Stone sofa, Trellis fabric chair, and white Mahogany wall art.

This does not necessarily mean the UI is wrong; it means the final post-processing and persisted shopping-list selection are not durably summarized in the `ai_jobs` row. That makes validation harder than it should be and weakens investor-demo auditability.

Recommended next narrow code boundary:

- Add a final persisted-selection snapshot to product-sourcing job summaries after shopping-list rows are written.
- Include role label, category, selected product id/name, option ranks, source path (`visual` or `text_fallback`), and any post-processing replacement reason.
- Add a focused test around the summary builder so evidence can compare `ai_jobs` to persisted rows without another DB readback script.

## Current Quality Verdict

PM-001 is materially better for local/dev investor-demo sourcing than the pre-PR #230/#232 state:

- Selected support rows are no longer obviously black/off-theme in the persisted latest shopping list.
- The system documents missing curtains instead of hallucinating them.
- Timeout reason is explicit and repeatable.
- Same-role alternatives are present for major roles.

PM-001 is not yet at a 9/10 final investor-demo quality bar for the full flow:

- Visual sourcing still times out and always uses deterministic text fallback in the latest evidence.
- QA stop rules still fail with three required-role blockers: anchor seating, coffee table, and rug are `closest_available`.
- Refresh diversity can regress back to the Stone/Rio/Tobago sofa family.
- Final render/list fidelity for the latest post-PR #232 target is not proven by a fresh final-render pass.
- `ai_jobs.output_summary.roleStatuses` and persisted shopping-list selections can disagree, so audit evidence is incomplete.

## Recommended Next Boundary

Open the next PM-001 slice as a narrow code/tests/docs PR, still local/dev only:

1. Persist final selected shopping-list snapshot into the product-sourcing `ai_jobs.output_summary` after post-processing.
2. Add a local/dev-only refresh-history test for repeated sofa-family avoidance when a credible same-palette alternative exists.
3. Add a focused support-role preference test for light mirror/media alternatives where role fit is otherwise comparable.
4. Do not run another browser-click validation until the audit snapshot is in place, unless Sam/Chief explicitly prefer a fresh local/dev final-render validation first.

Stop before catalogue ingestion, catalogue/product row edits, schema/type changes, production config, runtime allowlists, broad scoring rewrites, Product Matching rollout, or final-render execution outside the existing local/dev evidence boundary.
