# S5b: the plan names the room

Slice S5b of `plans/2026-09-01_product-pass-implementation.md` (step 15, the
floor-plan half; acceptance criterion 15). S5a shipped the typed half of the
same screen and merged as `a4ef8c7`.

## Objective

A designer uploads the whole floor plan for a home and the app tells her which
rooms it can see in it. She picks the one this brief is for, and that room's
wall length and depth land in the measurement fields as editable values,
recorded as having come from the plan rather than from her keyboard, with the
part of the plan that shows her room becoming the part the design reads.
Nothing becomes mandatory. A plan the model cannot read, a plan with no
dimensions printed on it, a room the app could not locate on the drawing, and a
room she never confirms all leave the form exactly as it was, and the screen
says which of those happened.

## Approach

**No migration, and no new enum value.** The roadmap and S5a's Deferred entry
both assumed acceptance criterion 15 needed migration M3 to add a
`plan_extracted` value to `measurement_source`, with the transaction ordering
that a new enum value forces. The schema already carries every piece:

- `measurement_source` has had `floor_plan` since the initial schema
  (`supabase/migrations/20260429114000_initial_schema.sql:7`) and nothing has
  ever written it; every row today is `manual`.
- `room_measurements.floor_plan_asset_id` exists, references
  `room_assets(id)`, and is dead code (same file, line 84).
- `ai_jobs.job_type` is a free-text column, not an enum (line 116), and
  `input_summary` and `output_summary` are jsonb (lines 121 and 122).
- `ai_jobs` is readable by the room's owner
  (`supabase/migrations/20260511120000_security_commerce_hardening.sql:29-34`)
  and indexed by `(room_id, created_at desc)` (`:26`).

So criterion 15's `source = plan_extracted` is restated as
`source = 'floor_plan'`: the same meaning under the name the schema already
uses. Adding a second enum value for the same fact would be worse than using
the one that exists, and it would make this slice HIGH tier for nothing.

**The read is a job row, not a document edit.** The obvious home for the
detected rooms is `design_briefs.structured_json`, where the inspiration
analysis writes. It is the wrong home here. That column is read, modified and
written whole by `saveDesignBriefAction` (`apps/web/app/actions.ts:1045` and
`:1163`), and a plan read takes ten to forty five seconds; press Continue in
that window and one write silently discards the other, losing a detection that
was already paid for. The read instead lives on its own `ai_jobs` row:
`job_type = 'floor_plan_read'`, `input_summary.assetId` naming the plan it
read, `output_summary.rooms` carrying the answer. One writer, one row, no
shared document.

That choice also hands the screen its states for free. The newest
`floor_plan_read` row for the room is `running` (reading), `failed` (the read
did not land, offer one retry), or `succeeded` with rooms, or `succeeded` with
none. And the stale-plan question becomes a real comparison rather than a
tautology: chips render only when the newest job's `input_summary.assetId`
equals the id of the attached plan asset. Upload a second plan and the first
plan's rooms disappear immediately, whatever happens to the second read.

**The whole-home plan must not become the room's plan.** Today the uploader
says "Add the floor plan for this room only, not the whole property", and
`apps/web/lib/services/room-images.ts:80` feeds that asset to the concept and
revision prompts under a sentence that asserts what it is: "The next image is
the room's floor plan. Use it to understand the room's true footprint, door and
window positions, and circulation before deciding the furniture layout"
(`packages/ai/src/index.ts:2650`, and the revision twin at `:3489`). Inviting
whole-home plans without doing anything else would ground every paid concept
for those rooms on a drawing of the whole home while telling the model it is
one room.

So the confirmed room is cropped, in memory, on the way to the model. The
confirm action records `structured_json.floorPlan = { assetId, label, box }`,
and `roomImageInputs` (`apps/web/lib/services/room-images.ts:25`) crops the
single plan asset to that box before making the data URL, when and only when
the recorded `assetId` is still the attached one. Nothing new is stored: there
is exactly one `floor_plan` row per room, forever, so there is no second asset
to disambiguate, no `is_primary` race between two confirmations, and no
orphaned crop when the plan is replaced. Confirming a different room changes
one jsonb key.

**A box can be wrong, so she sees it before she commits.** A normalised
bounding box from a small vision model is the likeliest thing here to be
plausible and wrong, and a wrong crop is expensive and silent: the concept is
then grounded on half of two rooms under a sentence asserting it is hers. So
the outline is drawn while she is choosing, on hover and on focus of each chip,
not only after confirmation. And "use the whole plan instead" is an explicit
control that clears the recorded box while keeping her measurements, so
rejecting a bad crop never costs her the numbers.

**The plan is sent at a resolution its numbers survive, and at high detail.**
`cameraReadContent` sends `detail: "low"` (`packages/ai/src/index.ts:3230`),
which tiles at 512 pixels and would throw away any resolution we paid for; the
concept path already sends the floor plan at `detail: "high"` (`:2655`). The
plan read sends `high`. Resolution matters underneath that: every vision input
goes through `visionImageDataUrl` (`apps/web/lib/render-images.ts:46`), which
downscales to 1024 pixels at JPEG quality 78 because photographs gain nothing
from more, and an A3 plan reduced to 1024 pixels wide leaves its dimension
strings a few pixels tall. Rather than change that shared function, which
`render-runner.ts` imports and which is a high-risk path, this slice adds a
sibling `planImageDataUrl` beside it at 2048 and quality 90, and pins the
existing 1024 and 78 with a test so the default cannot drift.

**A number read wrong is worse than no number.** The confirmation writes
`confidence = 'verified'`, which is what keeps dimension-aware product fit
switched on (`measurementCanSupportProductFit`,
`packages/domain/src/measurement-confidence.ts:53`, read on the concept path at
`apps/web/lib/services/concept-generation.ts:335`); writing `estimated` instead
would quietly switch that off for every designer who used a plan rather than a
tape measure, which is a worse design from a better measurement. The price of
keeping it on is that a misread wall length is then sized against and
clearance-checked as though someone had measured it. Two things pay that price.
The chip carries the numbers it would write, so the click is a person
confirming what she can see. And criterion 9 measures the read against ground
truth: the synthetic fixture has known printed dimensions, and the run asserts
what came back against them rather than only checking that the label is
formatted.

**The read runs once, on upload, and is persisted.** The uploader already
writes directly to Storage from the browser and then calls a server action for
the inspiration images; the floor plan follows that path
(`analyzeInspirationAction` at `apps/web/app/actions.ts:1427`, calling
`analyzeAndWriteInspirationForRoom` at `:1448`: open an `ai_jobs` row, make a
data URL rather than a signed URL, call the model, close the job through
`closeAiJob` (`apps/web/lib/services/close-ai-job.ts`), whose bounded retry is
what makes "no row is left running" true). The read is triggered by the upload
and never by a render, so opening the details page cannot spend money whatever
state the room is in. A pure decision function guards the action: it refuses a
read whose asset already has a `succeeded` or `running` job, so a retry or a
double call cannot buy the same answer twice, and a new plan is always read
because the recorded asset id no longer matches.

**The confirmation writes the row, and fills the inputs from the client.** The
alternative is to fill the inputs client-side and carry provenance in a hidden
field the details form submits, which makes provenance a client truth that has
to survive every keystroke. Writing on confirmation puts provenance where the
row is written. But the write alone is not enough: the three inputs are
uncontrolled `defaultValue` (`details/page.tsx:357`), so a dirty field keeps
her number on screen while the database holds the plan's, and the assumption
panel beneath them (`measurement-notes.tsx:92`) reads `useState(savedNotes)`
once and recomputes only from `input` and `change` listeners. A server refresh
moves neither. So the chip is a `type="button"` control that calls the action
AND sets the three inputs through the native value setter with a dispatched
`input` event. The panel then follows for free, which is the falsehood
`apps/web/app/details-field-ids.test.ts:14` exists to prevent: a room whose
measurements are on screen must not still be told the design is scaled from her
photographs. The chips sit inside the page's single form
(`details/page.tsx:130` to `:421`), so `type="button"` is not a detail: a bare
button would submit the brief and generate clarifying questions.

One consequence is recorded rather than fixed here: the next Continue press
sets `structuredJson.measurements.source` back to `"manual"`
(`apps/web/app/actions.ts:1076`). That key has no reader anywhere in the repo
(S5a's review confirmed it), the `room_measurements` row keeps the true
provenance, and carrying the real source into a dead key is work for the slice
that gives it a reader.

**Images in this slice; PDFs in the next one.** The uploader already accepts
`application/pdf` and the bucket allows it, but every reader drops it:
`apps/web/lib/services/room-images.ts:88` keeps a plan only when its mime type
starts with `image/`, so a PDF is stored, the screen says "Floor plan
attached", and no model has ever seen it. That is a lie on the screen today and
this slice ends it by saying plainly that a PDF cannot be read yet. The fix,
client-side pdf.js rasterisation, has a merge gate this session cannot satisfy:
the project rule (parent plan step 15 and criterion 15, restated in
`docs/FABLE_HANDOVER_NEXT_SESSION.md:83`) is that a native-dependency-adjacent
path is proven on a Vercel preview deployment that reaches the code path, and
signing in to a preview is refused in this tool policy. Bundling it here would
hold the readable-plan work behind that gate. It is the next slice, and how the
proof is obtained is the open question below.

## Files

**New**

- `packages/domain/src/floor-plan-rooms.ts`: the detected-room record, the
  bounds a read is filtered to, `floorPlanReadDecision`, `confirmableRooms`,
  the metres label, and the crop rectangle derived from a box.
- `packages/domain/src/floor-plan-rooms.test.ts`: bounds, the decision, the
  label, the confirmable split, the crop rectangle including its margin and its
  clamping at the image edge.
- `apps/web/lib/services/floor-plan-read.ts`: the read service (job row, data
  URL, model call, close) and the confirm service (measurement row, recorded
  box).
- `apps/web/lib/services/floor-plan-read.test.ts`: both services against the
  recording double, including every failure path.
- `apps/web/app/projects/[projectId]/rooms/[roomId]/brief/details/detected-rooms.tsx`:
  the plan preview, the chips, the hover and focus outline, the client fill,
  the "use the whole plan instead" control, and the six states.
- `apps/web/app/detected-rooms.test.tsx`: every state this component renders.
- `scripts/dev-harness/fixtures/floor-plan-two-bed.png`: a synthetic plan with
  labelled rooms and printed dimensions, drawn as SVG and rasterised with the
  harness's own Playwright browser, so it is reproducible, carries no third
  party's drawing, and has ground truth to assert against.

**Modified**

- `packages/ai/src/model-routing.ts`: add `floor_plan_read` to `TEXT_STAGES`
  and to `STAGE_MODEL_DEFAULTS` as `gpt-5-mini`, the way `camera_read` pins the
  cheapest adequate model rather than inheriting the base.
- `.env.example`: the stage's two env overrides, which `model-routing.ts:4`
  names as the contract.
- `packages/prompts/src/index.ts`: `floorPlanReadPrompt` (key, version,
  system), `floorPlanReadResponseSchema` (zod), `floorPlanReadJsonSchema`
  (strict), following the `cameraRead` trio at `:249-296`.
- `packages/ai/src/index.ts`: `readFloorPlanRooms` and an exported pure
  `floorPlanReadContent` sending `detail: "high"`, plus the normalisation that
  bounds the answer.
- `packages/ai/src/render-review-payload.test.ts`: the content builder's shape
  and its `detail`, beside the `cameraReadContent` assertions already there.
  The `packages/ai` test chain is hand-maintained, and this file is already in
  it, so no manifest changes for this one.
- `packages/domain/src/index.ts`: export the new module.
- `packages/domain/package.json` and `apps/web/package.json`: add the new test
  files to the `test` chains, which are hand-maintained and pick up nothing by
  pattern.
- `apps/web/lib/render-images.ts`: add `planImageDataUrl` (2048, quality 90)
  beside `visionImageDataUrl`, whose signature does not move.
- `apps/web/lib/render-images.test.ts`: pin `visionImageDataUrl` at 1024 and
  quality 78, since `render-runner.ts` and `render-views.ts` depend on it.
- `apps/web/lib/services/room-images.ts`: crop the plan in memory to the
  recorded box when it belongs to the attached asset.
- `apps/web/app/actions.ts`: `readFloorPlanAction`, `confirmDetectedRoomAction`
  and `useWholePlanAction`.
- `apps/web/app/projects/[projectId]/rooms/[roomId]/brief/floor-plan-uploader.tsx`:
  whole-plan copy, the read call after a successful upload, and the honest PDF
  state.
- `apps/web/app/projects/[projectId]/rooms/[roomId]/brief/details/page.tsx`:
  read the newest `floor_plan_read` job beside the plan asset, render the
  detected rooms beside the measurement fields, and the provenance line.
- `scripts/dev-harness/e2e.mjs`: the `brief-details` stage gains the floor-plan
  leg on a room it creates for it, and counts its interactions.
- `scripts/dev-harness/read-ai-job.mjs`: read `room_measurements` for a room as
  well as `ai_jobs`.
- `docs/ux/screen-map.md`: the row for `/brief/details` gains reading,
  read-failed, room-not-located and PDF-unreadable beside `plan-uploaded` and
  `room-identified`.
- `plans/2026-09-01_product-pass-implementation.md`: criterion 15 restated to
  `source = 'floor_plan'` with the reason, and split across S5b and S5c.

## Steps

1. **The domain module.** The record (`label`, `wallLengthCm`, `roomDepthCm`,
   `ceilingHeightCm`, `confidence`, optional normalised `box`), the bounds a
   model answer is filtered to (at most 12 rooms, label at most 40 characters,
   dimensions inside `BRIEF_FIELD_BOUNDS`, boxes inside 0 to 1 and non-empty),
   `floorPlanReadDecision` over the newest job row, the confirmable split, the
   metres label, and the crop rectangle with its margin. Tests first.
2. **The prompt and the call.** The prompt object with its version, the zod and
   strict JSON schema pair, `readFloorPlanRooms` at `detail: "high"`, the
   stage's model default, and the normalisation that runs the model's answer
   through the domain bounds. Tests: a parse of a captured answer, the bounds
   dropping an out-of-range room and a malformed box, and the content builder's
   shape including its detail.
3. **The read service.** `planImageDataUrl`, the `ai_jobs` row carrying the
   asset id in `input_summary` and the rooms in `output_summary`, and
   `closeAiJob` on every path. Tested against the recording double: the answer
   written, a model error closing the job failed, an empty room list closing it
   succeeded, and no path leaving a row running.
4. **The confirm service.** The measurement row with `source = 'floor_plan'`,
   `confidence = 'verified'` and `floor_plan_asset_id`; the recorded
   `structured_json.floorPlan`; the whole-plan control that clears the box and
   keeps the row; and `roomImageInputs` cropping in memory when the recorded
   asset is the attached one. Tested against the double, including the no-box
   path and the replaced-plan path where the crop must not apply.
5. **The screen.** The plan rendered from a one-hour signed URL, the pattern
   `photos/page.tsx:70` already uses; the chips keyed to the newest job's asset
   id; the outline on hover and focus; the `type="button"` control that calls
   the action and sets the three inputs through the native setter with a
   dispatched `input` event; the provenance line; and the reading, read-failed
   with retry, nothing-read, nothing-dimensioned, room-not-located and PDF
   states. The control is disabled while its own call is in flight.
6. **Evidence.** The harness run on a room it creates for the purpose, with the
   synthetic fixture and with one real plan, the row assertions read back
   through the service client, captures at 1440 by 900 and 390 by 844 scored by
   the ux-critic, and the interaction count for J3 step 6.

## Acceptance criteria

1. Uploading an image plan adds exactly one `room_assets` row with
   `asset_type = 'floor_plan'` and exactly one `ai_jobs` row with
   `job_type = 'floor_plan_read'`, `status = 'succeeded'` and a non-null
   `cost_estimate_usd`, counted as a delta around the upload. Reloading
   `/brief/details` afterwards adds no further `ai_jobs` row.
2. In the plan-uploaded state the screen renders one control per detected room,
   each labelled with the room's name and its dimensions in metres to one
   decimal place, for example `Living Room 5.2 by 4.1 m`. A detected room
   without both a wall length and a depth renders as a disabled control saying
   the plan shows no dimensions for it.
3. Confirming a detected room adds exactly one `room_measurements` row whose
   `source` is `floor_plan`, `confidence` is `verified`, `floor_plan_asset_id`
   is the plan asset's id, and whose values are that room's; the three inputs
   show those values without a reload, and the assumption panel beneath them
   stops saying the design will be scaled from her photographs.
4. After confirming a room that carried a box, `roomImageInputs` returns a
   floor-plan image cropped to that box, and the room still has exactly one
   `floor_plan` asset row. Confirming a second room replaces the crop rather
   than adding one. After the plan is replaced, `roomImageInputs` returns the
   new plan uncropped until a room on it is confirmed.
5. Confirming a room that carried no box writes the measurement row, records no
   box, leaves `roomImageInputs` returning the whole plan, and the screen says
   the room could not be located on the drawing. Choosing "use the whole plan
   instead" after a confirmation clears the recorded box and leaves the
   `room_measurements` row untouched.
6. Pressing Continue without editing after a confirmation adds no further
   `room_measurements` row, so the newest row is still the `floor_plan` one.
   Editing one value and pressing Continue adds exactly one row with
   `source = 'manual'`.
7. With a plan uploaded and no room confirmed, pressing Continue leaves
   `/brief/details` for the next step of the brief: measurements stay optional
   throughout.
8. A read whose model call throws closes its `ai_jobs` row `failed` with the
   error recorded, leaves every measurement input and text answer exactly as it
   was, and the screen offers one retry. A read that succeeds and finds no
   rooms closes `succeeded` and the screen says no rooms were found. No path
   leaves a row `running`. Cost is recorded on the succeeded path; on a throw
   the provider returns no usage to price, which is the existing behaviour of
   `analyzeAndWriteInspirationForRoom` and is stated rather than pretended.
9. Read against ground truth: for the synthetic fixture, whose printed
   dimensions are known, every room the read returns matches the drawing's
   label, and its wall length and depth are within 5 percent of what is printed
   on it. The real plan's read is reported number by number against the figures
   on the drawing, and a miss is recorded rather than tuned away.
10. Uploading a PDF stores the asset, creates no `ai_jobs` row, and the screen
    says a PDF cannot be read yet and asks for a picture of the plan. No screen
    claims a PDF plan is in use.
11. Replacing the plan replaces the room list with it: after uploading a second
    plan, no control from the first plan's read is rendered, whatever the state
    of the second read.
12. The plan-uploaded state renders the plan itself from a signed URL, and the
    outline of a room is drawn over it while that room's control is hovered or
    focused, before anything is confirmed. A room with no box draws no outline.
13. The J3 step 6 path costs three interactions on the running app: choose the
    file, confirm the room, continue.
14. A plan whose longest edge is below the readable floor is not read at all:
    no `ai_jobs` row is created, the screen says the plan is too small to read
    and asks for a larger copy, and no measurement is offered. The floor's
    number is established by evidence, not assumed: the synthetic fixture is
    read at descending widths and the number is set where the read stops
    matching its own ground truth.

## Test plan

| Criterion | Level | Where |
|---|---|---|
| 1 | unit + browser | `floor-plan-rooms.test.ts` for `floorPlanReadDecision` over a succeeded and a running job; the harness counts `ai_jobs` rows as a delta around the upload and around a reload |
| 2 | component | `detected-rooms.test.tsx` renders a read with three rooms, one undimensioned, and asserts the labels and the disabled control |
| 3 | service + browser | `floor-plan-read.test.ts` asserts the insert payload recorded by the double; the harness confirms a chip and asserts the input values and the assumption panel text without reloading |
| 4 | service + browser | `floor-plan-read.test.ts` drives `roomImageInputs` against the double for four cases: no confirmation, a confirmed box, a second confirmation, and a recorded box whose asset is no longer attached; the harness reads the asset count back |
| 5 | service + component | the no-box path and the whole-plan control in `floor-plan-read.test.ts`; the copy in `detected-rooms.test.tsx` |
| 6 | unit + browser | `measurementsChanged` already pins the no-write case in `brief-fields.test.ts`; the harness edits one value, continues, and asserts a `manual` row is newest |
| 7 | browser | the harness uploads a plan, confirms nothing, presses Continue, and asserts the path left `/brief/details` |
| 8 | service | `floor-plan-read.test.ts` for all three paths, asserting the job's terminal row each time |
| 9 | browser | the harness compares the read's rooms against the fixture's known figures, and prints the real plan's comparison into the evidence record |
| 10 | component + browser | `detected-rooms.test.tsx` for the copy; the harness uploads a PDF and asserts no `ai_jobs` row |
| 11 | component + browser | `detected-rooms.test.tsx` renders a job whose asset id does not match the attached asset and asserts no control appears; the harness uploads a second plan and asserts the first plan's rooms are gone |
| 12 | component + browser | `detected-rooms.test.tsx` for the outline on focus with and without a box; the harness captures both widths for the ux-critic |
| 13 | browser | the harness counts its own interactions for the J3 step 6 path |
| 14 | unit + browser | `floor-plan-rooms.test.ts` for the floor in `floorPlanReadDecision`; the harness uploads `floor-plan-listing-thumbnail.jpeg` (390 by 578) and asserts no `ai_jobs` row and the honest line |

The row assertions read through the service client the harness already uses
(`scripts/dev-harness/read-ai-job.mjs`), extended to read `room_measurements`,
and the floor-plan leg runs on a room the harness creates, so counts are deltas
on a room with no history rather than absolutes on the shared persona room.
Both new test files are added to the hand-maintained `test` chains in
`apps/web/package.json` and `packages/domain/package.json`; neither picks up
files by pattern, so a test not listed there never runs again.

Every AI-touching test runs against the recording double or a captured answer.
The only real model calls in the loop are the evidence run's: one
`floor_plan_read` per uploaded plan, `gpt-5-mini` pinned by the stage default,
at high detail, under USD 0.01 per call.

## Risk tier

**STANDARD.** Re-ran the match against `.claude/high-risk-paths`
(`apps/web/lib/billing/**`, `apps/web/app/api/stripe/**`,
`supabase/migrations/**`, `apps/web/app/api/queues/**`,
`apps/web/lib/render-runner.ts`, `packages/ingestion/**`): no file in the Files
section matches any glob. `apps/web/lib/render-images.ts` is imported by
`render-runner.ts`, which is a listed path, so this slice adds a function
beside `visionImageDataUrl` rather than changing it, and pins its current
behaviour with a test. The new sharp call sites inherit the existing linux
trace in `apps/web/next.config.ts:18`, so they add no native-dependency preview
gate of their own.

## Open questions for Ayo

1. **The PDF split.** This slice ships image plans and tells the truth about
   PDFs; the rasterisation is the next slice. Its merge gate is a Vercel
   preview proof, and I cannot sign in to a preview. Three ways to get it, your
   call: you spend three minutes on the preview URL with a plan PDF and say
   what you saw; you give me a Playwright storage-state file scoped to the
   preview domain the way `scripts/dev-harness/auth.json` is scoped to
   localhost; or the slice adds a diagnostic page that mounts only when
   `VERCEL_ENV` is not `production`, rasterises a bundled fixture PDF, and
   prints the page count and dimensions, which I can verify on the preview with
   no session at all. The third needs your approval because it puts a
   diagnostic route in the codebase.
2. **A real floor plan.** The repo has no plan fixture of any kind. The
   synthetic one I will draw proves the wiring and gives criterion 9 its ground
   truth, but not how well the model reads a real Dubai apartment plan. If you
   have one I may use, the evidence run uses it and reports what it found; may
   I commit a reduced copy as a fixture, or should it stay out of the repo?
3. **Criterion 15's wording.** I am restating `source = plan_extracted` as
   `source = 'floor_plan'` in the parent plan, because that value already
   exists in the schema and means exactly this. Say if you would rather I add
   the second enum value and the migration it needs.
4. **Acceptance criterion 12** (the J1 step budget) stays with S6, per its own
   text: the combined start screen and name-only project form of step 17 are
   what bring the count inside budget. Flagging it so the parent plan's
   criteria are not read as owed by this slice.

## Deviations

- **Units, which the plan never mentioned.** The real fixture Ayo supplied is
  a US listing plan in feet-and-inches decimal shorthand, where `14.11` means
  14 feet 11 inches and not 14.11 feet; Dubai plans are metric and usually
  drawn in millimetres. The column stores centimetres. So the prompt asks for
  centimetres, names all three notations, and requires the model to report the
  unit it believes it read, so a wrong-unit answer is visible in the job's
  output rather than silently 30 times too small. The bounds already drop
  anything outside 1 to 5000 cm, which catches the millimetre mistake but not
  the feet one, which is why the reported unit matters.
- **A level per room.** A whole-home plan carries several floors on one
  drawing, and Ayo's fixture has three, with the label "Bedroom" on three
  different rooms. The detected-room record gains an optional `level` and the
  chip shows it, or three identical chips would ask her to pick blind.
- **A readable-resolution floor, and what the supplied fixture is for.** The
  plan assumed any uploaded image is worth reading. The real plan supplied is
  390 by 578 pixels, a listing thumbnail, so its dimension strings are about
  four pixels tall and any answer from it is a guess. A guess is the worst
  thing this feature can produce, because the confirmation writes
  `confidence = 'verified'` and that is what switches dimension-aware product
  fit back on. So a plan below the floor is refused before any call is made
  (criterion 14), and the supplied fixture earns its place as the negative
  case rather than the positive one. The positive case is the synthetic metric
  plan, drawn large enough to be legible, and Ayo is asked for a
  full-resolution copy of a real plan if he has one.
