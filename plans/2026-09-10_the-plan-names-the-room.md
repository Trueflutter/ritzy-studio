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
  and `revertToWholePlanAction`.
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
3. Confirming a room the plan dimensions adds exactly one `room_measurements` row whose
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
   the room could not be located on the drawing. Confirming a room the plan
   locates but does not dimension records the box, writes NO
   `room_measurements` row, and the screen says the plan gave no size for it
   and invites her to type one. Choosing "use the whole plan instead" after a
   confirmation clears the recorded box and leaves any `room_measurements` row
   untouched.
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
| 14 | unit + browser | `floor-plan-rooms.test.ts` for the floor in `floorPlanReadDecision`; the harness uploads the Emaar plan downscaled below the floor and asserts no `ai_jobs` row and the honest line |

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

## Dismissed, with the reasoning

- **"Replacing a floor plan leaves stale measurements active"** (PR review).
  The remedy proposed, invalidating a measurement when its plan is replaced or
  making every reader check `floor_plan_asset_id` against the attached asset,
  rests on a premise this slice does not hold: a measurement describes the
  ROOM, not the document it was read off. The commonest reason to replace a
  plan is a better copy of the same drawing, and under that remedy a designer
  who uploads a sharper scan watches her room become unmeasured, the fields
  empty, and the concept prompt regain "measurements were not provided". It
  would also treat a plan-read number as more perishable than a typed one,
  which nothing else in the brief does: a number she typed by mistake is hers
  until she changes it, and so is this one, visible in the field and editable.
  What a replacement DOES invalidate is the room identity, and that is already
  gated on the attached asset in both readers that use it, the screen
  (`details/page.tsx`) and the concept path (`room-images.ts`).
  Worth recording rather than fixing: `room_measurements.floor_plan_asset_id`
  is `on delete set null`, so replacing a plan silently empties the pointer
  while `source` still reads `floor_plan`. Nothing reads the pointer today.
  Changing that is a migration, and it belongs with the slice that gives it a
  reader.

- **Two reads of the same plan can both be paid for** (cross-model gate,
  BLOCKER). `floorPlanReadDecision` reads the newest job and then the service
  inserts one, so two requests arriving together, two tabs or a double-fired
  action, can both pass the check and both call the model. Closing it properly
  needs the claim to be atomic in the database, a partial unique index on
  `(room_id, job_type) where status = 'running'`, which is a migration this
  slice does not carry. The cost of the race is one duplicated read, under a
  cent, both rows close `succeeded` and the newest wins, so nothing downstream
  disagrees. Recorded for the slice that adds the index.
- **A confirmation is two writes, and only one of them is guarded** (cross-model
  gate). The measurement row and the confirmed-room key are written
  separately, so two tabs confirming different rooms at once can leave one
  room's numbers newest while the other room's name is recorded. Serialising
  them needs a transaction, which means an RPC and a migration. Both halves are
  visible on the screen and recoverable by clicking the right chip, which is
  why this is recorded rather than fixed here.
- **`design_briefs` still has no unique constraint on `room_id`** (cross-model
  gate, raised alongside the guarded writer). Two writers that both find no row
  can both insert one. Already recorded in S5a's Deferred section as duplicate
  brief rows; the guarded writer narrows the update path but cannot close the
  insert path without that constraint.

- **A close that fails twice costs one extra read** (cross-model gate, round
  two). `closeAiJob` returns rather than throws when both its attempts fail, so
  a successful call can leave its row `running` with no cost recorded, and the
  staleness rule then allows a retry that spends again. The alternative is the
  bug that rule just fixed: a shopper stuck on "Reading your floor plan" for
  ever with no retry. Bounded at one cheap call in a double-write failure, and
  the honest fix is durable reconciliation, which the render path has and this
  one does not need at this size.
- **A response that spends and then fails to parse records no cost**
  (cross-model gate, round two). `readFloorPlanRooms` parses inside the AI
  package and throws before returning `textCostUsd`, so an incomplete or
  malformed answer is billed by the provider and absent from `ai_jobs`. Not
  specific to this slice: every stage in `packages/ai` does this, including the
  inspiration analysis this one is modelled on, and criterion 7 states it
  rather than pretending otherwise. Fixing it means preserving usage across a
  parse failure in every stage, which is its own change.

- **Every remaining unclosed finding is one race, and one migration closes
  them** (cross-model gate, three rounds). A confirmation can write plan A's
  numbers just after plan B is attached; two tabs uploading at once leave two
  `floor_plan` rows, so "the newest asset" becomes timestamp order; two reads
  of the same plan can each be paid for; and a confirmation's two writes are
  not one transaction. They are the same shape: this slice serialises nothing
  because it carries no migration, by design. What closes them together is one
  migration, a unique partial index making "one live floor plan per room" and
  "one running read per room" true in the database, plus an RPC for the
  confirmation's pair of writes. Each is bounded today: a duplicated read costs
  under a cent, and every disagreement is visible on the screen and corrected
  by picking the room again. Recorded here rather than half-solved with
  re-checks that narrow a window without closing it.

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

## Verification

Checked on 2026-09-10 on branch `opus/s5b-plan-names-the-room`. The unit,
component and service criteria are proven by the package suites; the ones that
are behaviours of a `"use server"` action or of a real model were driven
against the running app and against the two real plans in the fixtures.

**The readable floor, measured rather than guessed.** The Emaar plan was read
at six widths, scored against the figures printed on it (seven rooms named,
six of them dimensioned):

| Width | Unit read | Rooms named | Dimensions right | Wrong |
|---|---|---|---|---|
| 1067 (as published) | metres | 7 of 7 | 6 of 6 | 0 |
| 900 | metres | 7 of 7 | 6 of 6 | 0 |
| 800 | metres | 7 of 7 | 6 of 6 | 0 |
| 700 | metres | 7 of 7 | 6 of 6 | 0 |
| 600 | metres | 7 of 7 | 5 of 6 | 1 |
| 500 | unknown | 6 of 7 | 0 of 6 | 0 |

Six calls, USD 0.032 in total. The floor stays at 800: the first WRONG number
appears at 600, and this is the friendliest possible sample, one apartment on a
wide sheet. A denser drawing fails earlier at the same width, which the 390
pixel listing thumbnail of a three-level house shows at the other end. The 500
row is the safety rail working rather than a failure: the model could not tell
what the drawing was drawn in, said so, and every dimension was dropped instead
of guessed.

**Criterion 9, read against ground truth.** At its published resolution the
Emaar plan returns all seven rooms with the drawing's own names, every
dimension exact against the recorded figures (Living 470 by 320, both bedrooms,
dining and kitchen, bathroom, balcony), `unitRead` metres, and Storage with no
dimensions because the drawing prints none for it. USD 0.005 per read.

**The journey, in a browser.** Nineteen checks, all passing, committed as
`scripts/dev-harness/verify-floor-plan.mjs` so they can be re-run: a plan below
the readable floor refused with nothing spent, a PDF refused with nothing
spent, the Emaar plan read once with its cost recorded and not read again on
reload, the chips carrying the numbers they would write and saying where they
came from, the room the plan does not size saying so, confirming filling the
fields without a reload, the assumption panel following, one measurement row
written from the plan at `verified` pointing at the asset, a ceiling typed
earlier surviving a plan that prints none, nothing drawn on the plan since the
model cannot locate a room, the screen naming the room it is treating as this
one, and an unedited Continue writing no further row so the plan stays the
source.

Test data: the run used the e2e persona's own room
`f4fba429-63e0-45cf-b7c6-eefc81657b55`, which now carries the Emaar plan as its
floor-plan asset and a `floor_plan` measurement row at 470 by 320 by 300. A
room of its own would have been cleaner; the designer free-room trigger refuses
a second one, which is S6's gate doing its job, so every count in the run is a
delta around the action rather than an absolute.

**Re-checked on 2026-09-17, after the external review's P1.** The unit,
component and service suites and `pnpm check` are green. The new tests were
mutation-verified: ten mutations, each reverting one piece of the fix
(no-row back to `reading`, every non-image called a PDF, either refusal left
unwritten, the PDF signature ignored, the correction's error swallowed or
aimed at no row, the read control or the `unreadable` branch removed, and
`unreadable` dropped from the refused states), and each fails at least one
suite. The browser leg now has 34 checks, all passing, adding four groups to
the nineteen above: PDF bytes and bytes that are no image, each saved as
`plan.png`, refused on screen as soon as the upload settles, without a
reload, with the upload panel saying the plan cannot be read, the row
corrected to `application/pdf` or `application/octet-stream`, the same
refusal after a reload, and nothing spent; a readable plan replacing a
refused one captioned "Floor plan attached" without a reload; and an upload
whose read call was blocked offered the read rather than told one is
running, the same after a reload, nothing spent, and read exactly once when
the offer is pressed. Three reads across two runs, USD 0.0100 in total. The
shared database held five floor plans when this was checked, four of them
images with no read against them, uploaded from 22 May on: each of those
rooms would have said "Reading your floor plan" for ever from the moment the
unfixed branch merged, and each now offers the read. The Codex gate could not
run on the fix: the account was at its usage limit until 19 September.

**Then the same-family correctness and tests reviews of that fix**, run in
the gate's place and not as a substitute for it, found seven more (the last
two Deviations entries record what changed). Their tests: the confirmation
refused for five kinds of mismatched read; a plan the file check passes, on
real bytes, read with no row rewritten; the concept path shown to send the
disguised bytes before the correction and to leave them out after it; the
domain matrix asserting the whole state for every plan against every job; the
rooms block rendering nothing of any state while a replacement is in flight;
a reply kept to the state it was given in; and source pins for the behaviours
of a click, which no static render reaches. Seventeen mutations, each
reverting one of those, each fail a suite. The browser leg has 40 checks, all
passing, adding: a second tab left on the old rooms; none of the old rooms on
screen in the uploading tab while the replacement is in flight (criterion 11);
a pressed read whose call is dropped saying so and still offering the read;
the panel saying it is reading while a pressed read runs; and the other tab's
click on the replaced plan's rooms refused with its reason, nothing written,
its fields unmoved, and the tab left on the new plan's list. A second
correctness pass on that round found one minor defect, recorded in the last
Deviations entry; six more mutations pin its fix, and the browser leg was
re-run on the final code, 40 of 40. Nine reads over the day's five runs, USD
0.0301 in total, all succeeded.

## Deviations

- **The crop and the overlay are withdrawn, and the prompt is told the room's
  name instead.** The largest deviation, and Ayo approved it. The read is
  excellent at names and dimensions and unreliable at location: on the Emaar
  fixture the outline for the living room enclosed the balcony and ran outside
  the exterior wall, measured by the design review against the drawing. A crop
  taken from a box like that grounds a paid concept on a room the shopper never
  picked, and an outline around the wrong room is worse than none. Two
  reviewers independently found the same thing from the other side: an opt-in
  crop could not carry an unconditional invitation to upload whole-home plans,
  because every state except a confirmed located room still handed the whole
  sheet to a prompt asserting it was her room. So the box leaves the answer
  schema (prompt version `.2`), the crop and the outline and the revert control
  go, and `floorPlanLanguage` in `packages/ai` replaces the sentence that
  asserted the drawing IS this room with one that says it may show more of the
  home and names the room she confirmed on it. Confirming is now worth
  something for every named room rather than only for the ones the plan sizes,
  which is what the villa brochure case needed anyway.
- **PDF comes off the accept list.** The dropzone offered it and the reader
  refused it sixty pixels below, in the same panel (design review). It returns
  in S5c with the rasterisation that can read one.
- **No synthetic plan.** The plan called for one, drawn large and metric, as
  the positive fixture and as the ladder that sets the readable floor. Both
  jobs are done better by the real Emaar drawing: the ladder runs on it by
  downscaling, which measures a real plan rather than one whose author knew
  what the test needed, and it is the positive case already. The plan-attacker
  warned about exactly that weakness in a fixture I would draw myself, so the
  synthetic one is dropped rather than added for completeness.
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
- **Confirming a room has two halves, and a villa brochure only has one of
  them.** Ayo supplied a Tilal Al Furjan villa brochure with the observation
  that many owners have exactly that: the marketing PDF for the home they
  bought. Measured with the real read: its two drawings are embedded 1546 by
  949 JPEGs, so every room name comes back correct and every dimension line,
  about four pixels tall inside that JPEG, does not, at 200, 300 or 600 dpi.
  Rasterising higher only enlarges the same pixels. Under the first design
  that made a whole class of plan a list of disabled chips, which is the
  commonest artefact a villa owner has and nothing to do with it. So
  confirming now has two independent halves: the dimensions fill the fields,
  and the box crops the drawing for the concept prompts. A room with either is
  worth confirming and the screen says which it got. Recorded with the fixture
  and its measurements in `scripts/dev-harness/fixtures`.
- **A real Dubai plan, found online on Ayo's instruction, and what it did to
  the floor.** The fixture set is now two real drawings that bracket the
  problem. Emaar's Collective 2.0 two-bedroom marketing plan (Dubai Hills
  Estate, from the agency listing page) is the positive case: metric, printed
  room dimensions in metres, one named room carrying none, an area table in
  both square feet and square metres, and a key plan of five building diagrams
  whose unit numbers a read must not mistake for rooms. It is published at 1067
  by 550, which is what a developer actually distributes, and that refuted the
  first guess at the readable floor: 1200 would have refused the real case the
  feature exists for. The floor is 800 now, bracketed by both fixtures, and the
  evidence run still sets the final number.
- **A readable-resolution floor.** The plan assumed any uploaded image is
  worth reading. The first real plan Ayo supplied was a listing thumbnail
  whose dimension strings were about four pixels tall, so any answer from it
  was a guess, and a guess is the worst thing this feature can produce:
  the confirmation writes `confidence = 'verified'`, which is what switches
  dimension-aware product fit back on. So a plan below the floor is refused
  before any call is made (criterion 14).
- **That thumbnail is not in the repository, and must not be.** It was a real
  estate listing sheet for a private residence, carrying the street address,
  the MLS number and the room-by-room interior layout of somebody's home, and
  this repository is public (security review, caught before the branch was
  ever pushed). The commit that added it was rewritten out of the branch
  rather than deleted in a later one, because a delete leaves the blob in the
  history a push would publish. Criterion 14 is driven by the Emaar plan
  downscaled below the floor instead, which is developer marketing collateral
  and carries nobody's address.
- **A refusal made from the file is written to the plan's row, and a plan
  nothing has read is `unread`, never `reading`** (external review at
  `0e36588`, P1). Bytes the browser declared as an image but no decoder could
  open were refused by the read and recorded nowhere: the refusal was returned,
  the action surfaced only `failed` outcomes, the upload panel captioned the
  plan "Floor plan attached", and the refreshed page, deciding from the row the
  browser had written, found a readable image with no read against it and said
  "Reading your floor plan" for ever with nothing to press. The cause was wider
  than that path. The screen rendered the absence of a job row as a read in
  progress, and every other way to reach no row shares it: the tab closing
  before the upload's call, the call throwing before it opens its row, and a
  plan the read refuses as too small from the file when the row said otherwise.
  Two changes close the family. The read corrects the asset row to what the
  file is when it refuses one: `mime_type` becomes `application/pdf` when the
  bytes open with the PDF signature and `application/octet-stream` otherwise,
  and `width_px` and `height_px` become the file's own size when that is below
  the floor. The page, and the concept path, which gates the plan on the same
  column, then reach the refusal the read did, with no `ai_jobs` row, as
  criteria 10 and 14 require. And a plan with no read against it is a new
  `unread` state that offers the read, so `reading` is said only while a read
  of that plan is running. A refusal is deliberately not retryable: reading the
  same bytes again cannot succeed, so each refusal names the file that would
  work, and the upload panel beside it takes the replacement. The screen also
  gains `unreadable`, split from `pdf`, so a file that is not a PDF is no longer
  told that it is one. Two alternatives were weighed. A `cancelled` job row per
  refusal would break the letter of criteria 10 and 14 and put calls that were
  never made into the ledger of calls made. A local error kept in the upload
  panel is gone on the next load, which is the page the finding was about. The
  same line of the uploader carried a second defect the review did not name: it
  kept its caption in state from before the upload, so it also said "Attached,
  but we cannot read it" over a readable plan that replaced a refused one. Once
  nothing is in flight its caption now comes from the page, which read it off
  the rows.
- **A confirmation names the read its list came from, and the old plan's
  rooms leave the screen while it is replaced** (same-family correctness
  review of the P1 fix, 2026-09-17; pre-existing in this branch). The stale
  check compared the attached plan with the newest read, both from the
  server, so it could not see a list drawn from an older plan. Next runs
  server actions one at a time (`dispatchAction` in
  `next/dist/client/components/app-router-instance.js` queues each behind the
  one in flight), so a click on the old rooms during a replacement's read was
  sent only after that read landed. Both sides then agreed, and the old index
  named a room on the new list: one room's numbers written as `verified` under
  another room's name, and the old chip's numbers put in the fields for
  Continue to save. A second tab reached the same place with no queue.
  Criterion 11 was also unmet in the uploading tab, which went on showing the
  old rooms for the whole read. Three changes. The page hands the component
  the read's id and the confirmation sends it back, and the server refuses
  anything but the newest succeeded read of the attached plan. A refused
  confirmation moves no field. And a small shared state
  (`floor-plan-activity.tsx`) lets the upload panel take the rooms block off
  the screen from the moment a replacement starts until the refreshed page
  arrives. The same round fixed three smaller things: a read the rooms block
  starts says it is reading while it runs, a reply belongs to the state it
  was given in rather than following the block through a refresh, and no
  reply claims a read is under way, since the action cannot know that.
- **A reply is scoped to the plan it was about** (second correctness pass on
  the round above, minor). Keyed to the screen state alone, a reply about the
  old plan, such as "We could not read a size for Kitchen", captioned the new
  plan's rooms after a replacement in the same tab, and in another tab the
  refusal of a stale list was hidden whenever the new plan's state was not
  `rooms`, so the list she clicked vanished unexplained. The shared state now
  counts replacements, a reply carries the count it was given under, and the
  stale refusal is marked by the action and shown whatever state follows,
  until that tab replaces the plan itself.
