# Designer Path QA - Wednesday June 3 Operational Beta

ARCHITECT_NOTE: Designer Path QA Agent local/dev pass on latest `origin/main` (`668b88d`, pulled 2026-06-01 Asia/Dubai). Evidence-only artifact; no production deploys, production flags, live payment actions, live catalog writes, live ingestion, DB/schema/generated type changes, controlled preview expansion, Product Matching default-on activation, runtime allowlist expansion, broad UI redesign, or checkout architecture changes.

## Account And Environment

- Local app: `http://localhost:3048`
- Command: `NEXT_PUBLIC_APP_URL=http://localhost:3048 pnpm --filter @ritzy-studio/web dev --port 3048`
- Env source: copied root `.env.local` from the main checkout into the clean worktree; `pnpm validate-env` passed.
- QA account: `ritzy.qa+1780283635510@gmail.com`
- QA user id: `16d197e1-41ef-49bc-9b83-bd790194f071`
- Account creation: Supabase service-role admin create of confirmed local/dev QA auth user after public sign-up hit email protections.
- Project id: `fba9c706-2d0c-4877-b363-01d350d425d2`
- Room id: `12566f2e-b816-4e9f-9b53-90e6b08987fd`
- Concept id: `e80878a6-5582-4a27-9e5c-d70f17d565fd`
- Shopping list id: `800f4c99-224f-47a1-8818-3530db9f8888`

## Routes Tested

- `/login`
- `/onboarding`
- `/projects/new`
- `/projects/fba9c706-2d0c-4877-b363-01d350d425d2/rooms/new`
- `/projects/fba9c706-2d0c-4877-b363-01d350d425d2/rooms/12566f2e-b816-4e9f-9b53-90e6b08987fd/photos`
- `/projects/fba9c706-2d0c-4877-b363-01d350d425d2/rooms/12566f2e-b816-4e9f-9b53-90e6b08987fd/brief`
- `/projects/fba9c706-2d0c-4877-b363-01d350d425d2/rooms/12566f2e-b816-4e9f-9b53-90e6b08987fd/brief/style`
- `/projects/fba9c706-2d0c-4877-b363-01d350d425d2/rooms/12566f2e-b816-4e9f-9b53-90e6b08987fd/brief/inspiration`
- `/projects/fba9c706-2d0c-4877-b363-01d350d425d2/rooms/12566f2e-b816-4e9f-9b53-90e6b08987fd/brief/details`
- `/projects/fba9c706-2d0c-4877-b363-01d350d425d2/rooms/12566f2e-b816-4e9f-9b53-90e6b08987fd/brief/questions/0` through `/brief/questions/4`
- `/projects/fba9c706-2d0c-4877-b363-01d350d425d2/rooms/12566f2e-b816-4e9f-9b53-90e6b08987fd/concepts`
- `/projects/fba9c706-2d0c-4877-b363-01d350d425d2/rooms/12566f2e-b816-4e9f-9b53-90e6b08987fd/product-matching`
- `/projects/fba9c706-2d0c-4877-b363-01d350d425d2/rooms/12566f2e-b816-4e9f-9b53-90e6b08987fd/shopping-list`
- `/projects/fba9c706-2d0c-4877-b363-01d350d425d2/rooms/12566f2e-b816-4e9f-9b53-90e6b08987fd/presentation`

## Evidence Pointers

- `assets/2026-06-01/01-onboarding-designer-mode.png`
- `assets/2026-06-01/02-photo-upload-confirmed.png`
- `assets/2026-06-01/03-brief-details.png`
- `assets/2026-06-01/04-concept-generated.png`
- `assets/2026-06-01/05-shopping-list-locked.png`
- `assets/2026-06-01/06-designer-plan-required.png`
- `assets/2026-06-01/07-room-preview-no-render.png`

## Pass Fail Summary

- PASS: Existing confirmed QA user can sign in through `/login` and reaches `/onboarding`.
- PASS: Designer mode selection persists and routes to `/projects/new`.
- PASS: Designer project creation works.
- PASS: First designer room creation works for an unsubscribed designer account.
- PASS: Photo screen recognizes an uploaded room photo and enables brief continuation. Note: the browser automation wrapper did not expose native file-picker upload, so the image was inserted through the same Supabase storage and `room_assets` path the UI uses, then verified in the UI.
- PASS: Brief flow works across style, inspiration skip, details/measurements, generated clarifying questions, and five answers.
- PASS: Concept generation completed. Job `4bc50045-8f37-44b9-8ec2-4937766856c4` succeeded and produced selected concept `e80878a6-5582-4a27-9e5c-d70f17d565fd`.
- PASS: Product matching / shopping-list path completed once using existing catalogue rows. Job `52f6269c-89c4-4530-bae9-7d7e84aa74df` succeeded; shopping list `800f4c99-224f-47a1-8818-3530db9f8888` contains 36 item rows, 6 selected rows, and an estimated total of AED 25,664.50.
- PASS: Unsubscribed designer paywall behavior appears as expected for a second room: `/rooms/new` shows "Designer plan required" and "Start designer plan".
- PASS: Shopping list retailer links remain locked for the unsubscribed designer account.
- PASS: Room Preview route renders the client-facing preview shell with the selected concept and shopping-list estimate.
- NOT EXECUTED: Designer subscription checkout was not opened because live payment actions are forbidden for this pass.
- NOT EXECUTED: Final render generation was not executed; the preview route was checked without triggering another render job.
- LIMITED: Mobile viewport resizing was not available through the in-app browser wrapper, so mobile UX was not separately screenshotted in this pass.

## Blockers

- P0: None found.
- P1: None found.
- P2: Concept generation completion can look ambiguous in-browser. During the autogenerate flow, the UI showed "Concept generation is already running" / generation-studio state while the persisted job later succeeded and a manual navigation to `/concepts` revealed the generated concept. This may be browser-automation-specific, but it is worth a narrow follow-up because a beta user could otherwise think the concept is still running after completion.
- P2: File-picker drag/drop was not exercised by the automation wrapper. Storage upload and UI recognition passed, but the native input event needs a human or Playwright-capable browser pass if upload-widget fidelity is important for Wednesday.

## Smallest Follow-Up PR

Open one narrow QA/fix PR only if the concept completion state reproduces outside this automation session:

- Scope: `apps/web/app/projects/[projectId]/rooms/[roomId]/concepts/*` only.
- Goal: make the concept generation panel refresh or land on the completed concept once `generateInitialConceptAction` succeeds, and add a focused regression note/test if the local stack supports it.
- Explicitly out of scope: Product Matching scoring, catalog data, final render execution, payment/checkout behavior, DB/schema/generated types, preview/default-on flags, runtime allowlist expansion, or UI redesign.
