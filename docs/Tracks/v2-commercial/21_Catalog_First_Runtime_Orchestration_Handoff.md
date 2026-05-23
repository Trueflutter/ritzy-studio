# Catalog-First Runtime Orchestration Handoff

Status: dormant handoff only

## Purpose

Catalog-first room generation now has enough pure domain foundation to describe the future runtime orchestration path without wiring it into the app.

This handoff explains how a future integration PR should consume the dormant helpers, where the Product Matching Engine V1 boundary sits, and what must be true before any runtime behavior changes.

Runtime impact in this handoff: none.

## Intended Future Sequence

1. Start from room inputs and constraints.
   - room type
   - room measurements when available
   - budget tier target: `budget` or `premium`
   - budget ceiling when available
   - user exclusions for products, categories, or roles
   - design brief constraints and approved concept direction when catalog-first is paired with image generation

2. Normalize and load the catalog-first room blueprint.
   - Normalize room aliases through `normalizeCatalogFirstRoomType(...)`.
   - Load deterministic roles through `catalogFirstBlueprintForRoom(...)` or `catalogFirstRolesForRoom(...)`.
   - Treat role quantities from the blueprint as authoritative for bundle math.

3. Build role-scoped catalog candidate pools.
   - Future runtime code should call Product Matching Engine V1 capabilities for retrieval, eligibility, ranking, visual arbitration, and confidence.
   - Catalog-first should pass room roles and constraints into that lower-level matching layer.
   - Catalog-first should not implement a separate retrieval or ranking engine.

4. Create a catalog-first orchestration plan.
   - Use `planCatalogFirstRoomBundle(...)` once candidate items are available.
   - The plan records required roles, supporting roles, role-level candidate pools, provisional selections, missing required roles, weak supporting roles, quantity expectations, estimated total, confidence, warnings, and product-matching role specs.
   - Missing required roles must remain explicit and must not be silently backfilled with wrong-category products.

5. Convert the plan into bundle assembly input.
   - Use `catalogFirstPlanToBundleAssemblyInput(...)` to adapt the plan to `BundleAssemblyInput`.
   - Preserve plan role order.
   - Pass only selected provisional items forward.

6. Assemble the provisional bundle.
   - Use `assembleCatalogFirstPlanBundle(...)` or `assembleCatalogFirstBundle(...)`.
   - Required-role gaps should block a bundle.
   - Quantity-aware totals should remain based on blueprint quantities.
   - Budget fit should remain explicit and inspectable.

7. Package references for image generation only after readiness gates pass.
   - Future runtime orchestration may package selected catalog items as image references or prompt context.
   - The package should include product IDs, role IDs, quantities, role labels, candidate confidence, and warnings.
   - Runtime prompt or image-generation call changes require a separate approved PR.

8. Request user approval before shopping-list readiness.
   - Catalog-first output should become shopping-list ready only after the generated/approved room direction is accepted.
   - Immediate shopping-list readiness means the selected bundle can be reviewed and persisted by a separately approved shopping-list writer.
   - This handoff does not approve shopping-list writes.

## Dormant Helpers And Responsibilities

`catalog-first-room-generation.ts`

- Defines room types, bundle tiers, room bundle roles, product bundle items, bundle assembly inputs/outputs, bundle scores, and deterministic room blueprints.
- Owns quantity-aware role defaults for living room, dining room, bedroom, and home office.
- Provides bundle assembly that blocks when required roles are missing.

`catalog-first-product-matching.ts`

- Adapts catalog-first roles into Product Matching role specs.
- Keeps catalog-first role intent compatible with the Product Matching Engine lane without coupling to runtime matching.

`catalog-first-orchestration-planner.ts`

- Builds a pure plan from room type, measurements, budget tier, candidate items, optional roles, and user exclusions.
- Selects provisional items from caller-supplied candidates.
- Surfaces required/supporting role coverage, weak roles, missing roles, estimated totals, confidence, and warnings.

`catalog-first-plan-assembly.ts`

- Converts a `CatalogFirstOrchestrationPlan` into `BundleAssemblyInput`.
- Delegates final assembly to the existing pure bundle assembler.

`catalog-first-dry-run.ts`

- Composes planning, plan-to-assembly conversion, and assembly into one dry-run result.
- Intended for QA, future orchestration proofs, and integration readiness checks.

`catalog-first-dry-run-fixtures.ts`

- Provides synthetic complete-room and edge-case fixture scenarios.
- Fixtures are not catalog ingestion, not production catalog records, and not runtime data.

`catalog-first-dry-run-fixture-report.ts`

- Runs fixture scenarios through the dry-run path and summarizes readiness, totals, missing required roles, and weak supporting roles.
- Intended as a deterministic QA/evaluation surface.

## Product Matching Engine V1 Boundary

Catalog-first orchestration should own:

- room-level bundle intent
- role blueprint selection
- role quantities
- user exclusions at the orchestration layer
- provisional bundle shape
- missing/weak role visibility
- readiness gates before downstream packaging

Product Matching Engine V1 should own:

- role-scoped retrieval
- hard eligibility gates
- category, stock, price, dimension, retailer, and image gates
- attribute scoring
- visual arbitration
- candidate confidence
- fallback and missing-role evidence
- runtime rollout controls for the existing image-first matching flow

Catalog-first must not duplicate Product Matching retrieval, ranking, visual arbitration, or confidence logic. Future catalog-first runtime work should reuse Product Matching lower-level capabilities once those interfaces are approved for this orchestration path.

## Activation Gates For Future Runtime PRs

Do not begin runtime or integration work until all are true:

- Sam explicitly approves the specific runtime/integration PR scope.
- Chief Architect confirms the integration boundary for that PR.
- Product Matching Engine V1 has a stable interface appropriate for catalog-first role-scoped candidate retrieval or an explicitly approved adapter scope.
- The PR states whether behavior is default-off, preview-only, or live behavior changing.
- The PR includes a rollback/disable path for any runtime invocation.
- The PR includes manual QA scenarios for living room, dining room, bedroom, and home office.
- The PR proves no live catalog writes, shopping-list writes, or prompt/image call changes happen unless explicitly approved.

## Stop Rules

Stop and escalate before merging if a future PR:

- wires catalog-first into app runtime routes or server actions
- changes production prompt behavior or image-generation calls
- creates Supabase migrations or generated DB types
- writes shopping-list rows
- writes or mutates catalog data
- changes Product Matching Engine runtime behavior
- enables feature flags or default-on behavior
- deploys or requires live operational action
- tries to silently backfill missing required roles with unrelated products
- makes catalog-first responsible for retrieval, ranking, or visual arbitration already owned by Product Matching Engine V1

## Recommended Next Step

After this docs-only handoff lands, pause Catalog-First Room Generation implementation. Resume only when Sam approves a specific runtime or integration PR, or when Chief Architect assigns a narrowly scoped docs/domain-only follow-up.
