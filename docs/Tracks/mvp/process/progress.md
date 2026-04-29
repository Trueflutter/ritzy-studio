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
