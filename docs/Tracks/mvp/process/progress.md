# MVP Progress Log

This is the append-only engineering ledger for the MVP track.

## 2026-04-29

### Documentation Scaffold Created

Created initial doc-first project control layer for Ritzy Studio.

Grounded on:

- founder workflow clarification in chat
- feasibility findings from retailer and OpenAI image API investigation
- locked design system at `docs/Vision/05_Brand_and_Design_System.md`

Created:

- `docs/Vision/01_Founder_Intake.md`
- `docs/Vision/02_Vision_Document.md`
- `docs/Vision/03_Build_Brief.md`
- `docs/Vision/04_Design_Brief.md`
- `docs/Vision/design-system/README.md`
- `docs/Tracks/mvp/00_Technical_Decision_Pack.md`
- `docs/Tracks/mvp/01_Technical_PRD.md`
- `docs/Tracks/mvp/02_Feature_List.json`
- `docs/Tracks/mvp/03_Data_Model.md`
- `docs/Tracks/mvp/04_Product_Matching_Rubric.md`
- `docs/Tracks/mvp/05_Prompt_Architecture.md`
- `docs/Tracks/mvp/06_Latency_and_Cost_Budget.md`
- `docs/Tracks/mvp/07_Repository_Structure.md`
- `docs/Tracks/mvp/08_Chief_Architect_Handoff.md`
- `docs/Tracks/mvp/09_Codex_Operating_Model.md`
- `docs/Tracks/mvp/process/documentation-scaffold-verification.md`

Locked decisions:

- Concept-first, product-grounded workflow.
- Designer-facing manual CSV/link collection is not part of the product workflow.
- Shopping list truth comes from product records, not generated images.
- Photo-only dimensions are unreliable and cannot certify fit.
- `docs/Vision/05_Brand_and_Design_System.md` is locked visual truth.

Current canonical next slice:

- `F-001 Project Scaffold And Environment Validation`

Verification:

- `02_Feature_List.json` parsed successfully.
- Feature list contains 18 slices.
- First open slice is `F-001`.
- Git status could not run because this workspace is not currently a git repository.

Open founder confirmations before or during F-001:

- Supabase approved as MVP backend/database/storage/auth stack.
- Auth approved from the start.
- Home Centre approved as the first retailer adapter target.
- Confirm final export format before F-017.

### F-001 Closed: Project Scaffold And Environment Validation

Implemented the initial pnpm monorepo scaffold and Next.js TypeScript web app.

Created:

- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `.env.example`
- `README.md`
- `apps/web`
- `packages/config`
- placeholder package boundaries for `ai`, `db`, `domain`, `ingestion`, `prompts`, and `ui`

Verification passed:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm validate-env` with dummy non-secret values
- `pnpm build`
- `pnpm check`

Feature status:

- `F-001` marked `passes: true`.

Current canonical next slice:

- `F-002 Locked Design Tokens And App Shell`

### F-002 Closed: Locked Design Tokens And App Shell

Implemented Quiet Gallery design tokens and foundational UI primitives.

Created:

- `packages/ui`
- shared primitives for buttons, cards, panels, form fields, tabs, segmented controls, and chips
- Tailwind 4 theme bindings for Ritzy tokens
- Cormorant Garamond and DM Sans font configuration
- minimal app-shell proof page in `apps/web/app/page.tsx`

Verification passed:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm check`
- design-rule scan for forbidden starter styles

Feature status:

- `F-002` marked `passes: true`.

Current canonical next slice:

- `F-003 Database Schema And Auth Foundation`

### F-003 Closed: Database Schema And Auth Foundation

Implemented the Supabase database/auth foundation.

Created:

- `supabase/config.toml`
- `supabase/migrations/20260429114000_initial_schema.sql`
- `packages/db`
- generated Supabase database types
- `packages/domain`
- Supabase browser/server/proxy helpers in `apps/web`
- RLS/privacy posture doc

Verification passed:

- `supabase start`
- `supabase db reset`
- generated local Supabase types
- confirmed 19 public tables exist
- confirmed RLS enabled on all 19 public tables
- confirmed private storage buckets exist
- `pnpm typecheck`
- `pnpm check`
- `pnpm validate-env` with dummy non-secret values

Feature status:

- `F-003` marked `passes: true`.

Current canonical next slice:

- `F-004 Project And Room Creation`

### F-004 Closed: Project And Room Creation

Implemented authenticated project and room creation.

Created:

- `/login`
- protected `/` dashboard
- `/projects/new`
- server actions for auth and project creation
- project list and room count display
- project-with-room domain schema

Verification passed:

- `pnpm check`
- unauthenticated route redirect checks
- login page render check
- Supabase authenticated RLS smoke test for sign-up, project insert, room insert, project list, cleanup
- design-rule scan for forbidden UI styles

Feature status:

- `F-004` marked `passes: true`.

Current canonical next slice:

- `F-005 Room Image Upload And Asset Storage`

### F-005 Closed: Room Image Upload And Asset Storage

Implemented protected room photo upload and private asset storage.

Created:

- `/projects/[projectId]/rooms/[roomId]/photos`
- `RoomPhotoUploader`
- signed URL display for existing room photos
- project-card links into the photo step

Verification passed:

- `pnpm check`
- unauthenticated route redirect check
- Supabase authenticated storage/RLS smoke test
- design-rule scan for forbidden UI styles

Feature status:

- `F-005` marked `passes: true`.

Current canonical next slice:

- `F-006 Design Brief And Clarifying Questions`

### F-006 Closed: Design Brief And Clarifying Questions

Implemented protected brief capture and bounded clarifying-question generation.

Created:

- `/projects/[projectId]/rooms/[roomId]/brief`
- `packages/prompts`
- `packages/ai`
- versioned clarifying-question prompt
- OpenAI structured-output helper
- server actions for saving briefs and clarification answers

Verification passed:

- `pnpm validate-env`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- OpenAI structured-output smoke test
- design-rule scan for forbidden UI styles

Feature status:

- `F-006` marked `passes: true`.

Current canonical next slice:

- `F-007 Room Analysis And Initial Concept Generation`

### F-007 Closed: Room Analysis And Initial Concept Generation

Implemented initial room analysis and concept image generation.

Created:

- `/projects/[projectId]/rooms/[roomId]/concepts`
- versioned room-analysis and concept-direction prompt
- OpenAI `gpt-image-2` image generation/edit helper
- server action for initial concept generation
- private generated render storage flow

Verification passed:

- official OpenAI docs check for current image model and image edit capability
- `pnpm check`
- OpenAI `gpt-image-2` low-quality smoke test

Feature status:

- `F-007` marked `passes: true`.

Current canonical next slice:

- `F-008 Concept Critique And Iteration Loop`

### F-008 Closed: Concept Critique And Iteration Loop

Implemented concept selection, critique storage, and revised concept generation.

Created:

- concept selection server action
- critique/revision form on generated concept cards
- versioned critique-revision prompt
- OpenAI revision helper
- child-concept generation via `parent_concept_id`

Verification passed:

- `pnpm check`

Feature status:

- `F-008` marked `passes: true`.

Current canonical next slice:

- `F-009 Product Catalog Schema And Adapter Framework`

### F-009 Closed: Product Catalog Schema And Adapter Framework

Implemented the catalog ingestion framework.

Created:

- `packages/ingestion`
- adapter interface
- product normalization helpers
- ingestion run helper
- normalization tests

Verification passed:

- `pnpm --filter @ritzy-studio/ingestion test`
- `pnpm typecheck`
- `pnpm check`

Feature status:

- `F-009` marked `passes: true`.

Current canonical next slice:

- `F-010 First Retailer Ingestion Adapter`

### F-010 Closed: First Retailer Ingestion Adapter

Implemented the Home Centre UAE ingestion adapter.

Created:

- `homecentre-ae` adapter
- category product URL discovery
- product JSON-LD/meta extraction
- Home Centre adapter tests
- compliance notes for public-page ingestion

Verification passed:

- light Home Centre robots/sitemap/category/product probing
- `pnpm --filter @ritzy-studio/ingestion test`
- live one-product extraction smoke test
- `pnpm typecheck`
- `pnpm check`

Feature status:

- `F-010` marked `passes: true`.

Current canonical next slice:

- `F-011 Additional Retailer Ingestion Adapters`

### F-011 Closed: Additional Retailer Ingestion Adapters

Implemented two additional retailer adapters.

Created:

- `2xlhome-ae` adapter
- `chattels-and-more-ae` adapter
- adapter parser tests for both retailers
- sample extraction verification notes

Verification passed:

- light robots/category/product probing for both retailers
- `pnpm --filter @ritzy-studio/ingestion test`
- `pnpm --filter @ritzy-studio/ingestion typecheck`
- live one-product extraction smoke tests for both adapters
- `pnpm typecheck`
- `pnpm check`

Feature status:

- `F-011` marked `passes: true`.

Current canonical next slice:

- `F-012 Product Enrichment And Embeddings`

### F-012 Closed: Product Enrichment And Embeddings

Implemented product enrichment and text embedding support.

Created:

- product metadata enrichment prompt
- enrichment input/output domain schemas
- product search text builder
- stable enrichment source hashes
- OpenAI text embedding helper
- product enrichment and embedding storage helper
- product provenance migration
- focused prompt/domain/AI tests

Verification passed:

- `pnpm --filter @ritzy-studio/domain test`
- `pnpm --filter @ritzy-studio/prompts test`
- `pnpm --filter @ritzy-studio/ai test`
- `pnpm --filter @ritzy-studio/ai typecheck`
- `pnpm typecheck`
- `pnpm check`

Feature status:

- `F-012` marked `passes: true`.

Current canonical next slice:

- `F-013 Product Search And Matching`

### F-013 Closed: Product Search And Matching

Implemented product grounding for selected concepts.

Created:

- product matching rubric in `packages/domain`
- product matching tests
- product grounding server action
- draft shopping list creation/refresh
- catalog-backed product cards on the concept page
- warnings for missing dimensions and stale product data

Verification passed:

- `pnpm --filter @ritzy-studio/domain test`
- `pnpm --filter @ritzy-studio/web lint`
- `pnpm --filter @ritzy-studio/web typecheck`
- `pnpm check`

Feature status:

- `F-013` marked `passes: true`.

Current canonical next slice:

- `F-014 Product Substitution Loop`

### F-014 Closed: Product Substitution Loop

Implemented line-level product substitution.

Created:

- substitution candidate filtering in `packages/domain`
- substitution tests
- shopping list item swap action
- price impact calculation
- per-item swap controls on product cards

Verification passed:

- `pnpm --filter @ritzy-studio/domain test`
- `pnpm --filter @ritzy-studio/web lint`
- `pnpm --filter @ritzy-studio/web typecheck`
- `pnpm check`

Feature status:

- `F-014` marked `passes: true`.

Current canonical next slice:

- `F-015 Final Grounded Render Generation`

### F-015 Closed: Final Grounded Render Generation

Implemented final grounded render generation.

Created:

- final grounded render prompt
- OpenAI final render helper
- render job provenance migration
- final render server action
- product image reference fetching
- final render review UI
- failure/retry path through repeatable generation

Verification passed:

- `pnpm --filter @ritzy-studio/ai typecheck`
- `pnpm --filter @ritzy-studio/web lint`
- `pnpm --filter @ritzy-studio/web typecheck`
- `pnpm check`

Feature status:

- `F-015` marked `passes: true`.

Current canonical next slice:

- `F-016 Shopping List And Cost Estimate`

### F-016 Closed: Shopping List And Cost Estimate

Implemented the catalog-backed shopping list page.

Created:

- dedicated shopping list route
- data-dense line-item table
- estimated total display
- stale/missing data warnings
- concepts page link to shopping list

Verification passed:

- `pnpm --filter @ritzy-studio/web lint`
- `pnpm --filter @ritzy-studio/web typecheck`
- `pnpm check`

Feature status:

- `F-016` marked `passes: true`.

Current canonical next slice:

- `F-017 Client Presentation And Export View`

### F-017 Closed: Client Presentation And Export View

Implemented the client presentation view.

Created:

- presentation route
- print/save-PDF control
- final render presentation area
- selected concept narrative
- selected products section
- caveat notes for SKU exactness and stale product facts
- shopping list link to presentation

Verification passed:

- `pnpm --filter @ritzy-studio/web lint`
- `pnpm --filter @ritzy-studio/web typecheck`
- `pnpm check`

Feature status:

- `F-017` marked `passes: true`.

Current canonical next slice:

- `F-018 MVP Hardening And Review Passes`
