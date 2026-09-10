# Nothing typed is lost on the brief (S5, part 1)

The first PR of slice S5 of `plans/2026-09-01_product-pass-implementation.md`
(the data-loss half of step 15). Date: 2026-09-09. Branch:
`opus/s5a-intake-integrity`.

This plan was narrowed twice under adversarial review, and the second
narrowing changed the mechanism, not just the scope. The parent plan
prescribes "save-before-validate" with a draft persisted before validation.
Measurement says that mechanism now has almost nothing left to recover, for
a reason nobody had checked: the four numeric fields are
`input type="number"`, and the HTML value-sanitization algorithm replaces a
non-numeric value with the empty string before the form is submitted, so
"about five metres" never reaches the server at all. Once the measurement
gate is deleted and the text fields carry the bounds the schema already
enforces, no reachable submission by a real user is rejected server-side,
and a draft column would be recovering from a case the browser prevents. It
would also not do what my first draft claimed for it: a draft written on
submit does not survive a crash before submit, so it is no more durable
than the alternative it was argued against. The draft column is therefore
put to Ayo as the open question below rather than built on my own judgement,
since it is his parent plan's named mechanism. Everything in this PR is
needed either way.

## Objective

A homeowner filling in the room brief never loses what she typed. Today the
form requires all three room measurements and rejects a submission by
redirecting before anything is written, so one missing number discards every
sentence she wrote about colours, function and what to avoid. A successful
save does not render her colour notes back either: the field re-renders
empty the moment a value exists. And a colour note longer than its bound
throws an unhandled error onto a raw framework page. After this PR
measurements are optional, the screen says what the design does without
them, a measurement can be cleared once entered, saved answers render back,
and the one remaining way to be refused names the field and keeps the rest.

## Approach

**Delete the gate, do not replace it.** The measurement gate at the top of
`saveDesignBriefAction` is the data-loss bug: it runs before the Supabase
client is even created, so a submission missing one number is redirected
away with nothing written. The pipeline runs without measurements, so the
gate was protecting nothing. Deleting it is the whole fix for the reported
symptom.

**Close the paths that remain, at the boundary that can actually close
them.** After the gate is gone, a legitimate submission can still be
refused two ways: text over a schema bound (colour notes at 1200,
functional requirements at 2000, avoid notes at 1200, inspiration notes at
1600), and a number over a schema bound (wall length and depth at 5000,
ceiling at 1000). Both are prevented in the browser by `maxLength` on the
textareas and `max` on the number inputs, matched to the schema so the two
cannot drift, with a test asserting they agree. The server keeps validating
because a client can always post anything, but it stops throwing: `parse`
becomes `safeParse`, and a rejection redirects back naming the field
instead of rendering the framework's error page.

**Clearing a measurement has to work, which the gate was hiding.** Today the
row is only written when at least one measurement is present, and the page
reads the newest row, so with the gate gone a user who deletes a wrong
ceiling height gets it back on the next render, permanently. This PR makes
the details step write what was submitted whenever it differs from the
newest row, including when it became empty, so a cleared value stays
cleared. Rows still accumulate one per change, which is pre-existing and
deferred, but the newest row is now always the truth.

**The colour field renders the saved note without dropping the palette.**
Today `colorPrefilled` is false whenever a real value exists, so a saved
note renders as an empty box. The naive fix, making the palette a
placeholder, would be a silent regression: a placeholder is never
submitted, so every room with an inspiration analysis and no typed note
would start saving a null colour note into the concept prompt and the
sourcing pass. The palette stays a submitted default; the saved note simply
wins over it. The choice is a pure function with its own test rather than a
ternary in JSX, because that is the line that was wrong.

**What is stated is what happens.** With measurements optional the screen
must say what the design does without them, and that is not "we assume a
3 metre ceiling". `roomMeasurementsLanguage` returns nothing when the wall
length or depth is missing, so the model receives no dimensions and the
design is scaled from the photographs. Inventing a default to display would
be decoration if the pipeline ignored it, or a room sized to a number
nobody measured if it were fed in to make it true. The note says what is
true, and its correspondence with the prompt is asserted in
`packages/ai`, which can import both, rather than in `packages/domain`,
which depends only on zod and must not gain a dependency on the AI package
that already depends on it.

## Files

Existing files to modify (all exist on `main` today):

- `apps/web/app/actions.ts`: the measurement gate is deleted;
  `designBriefSchema.parse` becomes `safeParse` with a redirect naming the
  refused field; the details step writes a measurement row when the
  submitted values differ from the newest row, including when they became
  empty.
- `apps/web/app/projects/[projectId]/rooms/[roomId]/brief/details/page.tsx`:
  the colour field takes its default from the shared function; the
  textareas carry `maxLength` and the number inputs `max`, both from the
  shared bounds; the assumption notes render above the measurement fields;
  the measurement heading stops calling itself required.
- `packages/domain/src/index.ts`: exports the field bounds already encoded
  in `designBriefSchema` as a table the form can read, so the input
  attributes and the schema cannot drift.
- `packages/domain/src/spatial-design-rules.ts`: `measurementAssumptionNotes`.
- `packages/domain/src/spatial-design-rules.test.ts`: pins the notes.
- `apps/web/package.json`: the two new web tests join the chain.
- `packages/ai/package.json`: the new correspondence test joins the chain.
- `docs/ux/screen-map.md`: the `/brief/details` row's states gain the
  assumption note and the optional-measurements state. The row already
  promises "saved-values re-render, rejection NEVER wipes input", which is
  the contract this PR makes true.

New files (do not exist today):

- `apps/web/lib/brief-fields.ts` (+ `.test.ts`): `colourNotesDefault(saved,
  palette)` and the mapping from the schema's bounds to the input
  attributes the form renders.
- `apps/web/app/projects/[projectId]/rooms/[roomId]/brief/details/measurement-notes.tsx`:
  the numbered assumption list, presentational.
- `apps/web/app/measurement-notes.test.tsx`: its rendering, present and
  empty.
- `packages/ai/src/measurement-language.test.ts`: the correspondence
  between what the note claims and what the prompt carries.

## Steps

1. **Bounds in one place** (`packages/domain`, `apps/web/lib/brief-fields.ts`).
   Export the per-field bounds `designBriefSchema` already encodes, and a
   function mapping a field to the input attributes that enforce it. Test
   first: for every bounded field the exported bound equals the schema's
   own bound, so adding a field or changing a limit cannot leave the form
   and the schema disagreeing.

2. **The gate goes, the throw goes** (`saveDesignBriefAction`). Delete the
   measurement gate. Replace `designBriefSchema.parse` with `safeParse`; on
   failure redirect back to the submitted step with a message naming the
   first refused field and its reason, which preserves every other field
   because they were already being re-read from the database. Nothing else
   in the action moves: it serves `/brief/style` and `/brief/inspiration`
   as well as `/brief/details`, each with its own `nextPath` and, for
   inspiration, an analysis call between the write and the redirect, and
   none of that is this PR's business.

3. **A measurement can be cleared** (`saveDesignBriefAction`). On the
   details step, read the newest `room_measurements` row and write a new
   one when the submitted three differ from it, including when all three
   arrive empty and the existing row has values. A room that never had
   measurements and submits none still writes nothing.

4. **Measurements optional and stated** (`packages/domain/src/spatial-design-rules.ts`,
   `measurement-notes.tsx`, the details page).
   `measurementAssumptionNotes({ roomType, measurements, spatialIntent })`
   returns the numbered sentences for what the pipeline will do with what
   it was given: the design is scaled from the photographs when the wall
   length or depth is absent, the ceiling is unstated when it is, plus the
   focal-point and dining-seat assumptions `parseSpatialIntent` already
   records. No dimension is invented, because none is used. The list
   renders on the page above the measurement fields, and the heading drops
   "strongly recommended". Section 12.5 specifies this list behind a quiet
   link on the concept screen; rendering it inline here is a deliberate
   difference, because on a form the assumption is a consequence of what
   the user is deciding right now rather than a disclosure about a finished
   design.

5. **The colour field** (`brief-fields.ts`, the details page).
   `colourNotesDefault(saved, palette)` returns the saved note when there is
   one and the palette otherwise, and the caption saying the value came
   from the inspiration analysis renders only in the second case. The value
   is a `defaultValue` in both cases, never a placeholder, so accepting the
   suggestion still saves it.

6. **Contract and evidence.** The `/brief/details` row in
   `docs/ux/screen-map.md` gains the two states. The visual ladder runs on
   that screen through the existing `scripts/dev-harness/e2e.mjs` driver
   and its saved storage state, at 1440x900 and 390x844, scored by the
   ux-critic.

## Acceptance criteria

1. Submitting the details form with all three measurement fields empty and
   the text fields filled proceeds to `/brief/questions/0` (or
   `/concepts?autogenerate=1` when the room has no questions) and writes
   every text field to its column. No measurement gate remains in
   `saveDesignBriefAction`.
2. A room whose newest `room_measurements` row carries a ceiling height,
   submitted from the details step with all three fields empty, has a newer
   row with all three null afterwards, and the re-rendered form shows the
   fields empty. Submitting the same empty state again writes no further
   row.
3. Submitting a colour note of 1201 characters through a client that
   bypasses the input bound redirects back to the details step with a
   message naming the colour field, marks that field, leaves the colour note
   already on record untouched, and SAVES every other answer the same
   submission carried; the action does not throw. (Amended after the PR was
   opened. The criterion first read "writes no typed column", which is the
   whole-submission discard a review showed to be this plan's own objective
   failing one layer in. A change that restores it is a regression, not a
   return to the plan.)
4. For every field `designBriefSchema` bounds, the attribute the form
   renders equals the schema's bound (one test reads both), so the four
   textareas carry `maxLength` 1200, 2000, 1200 and 1600 and the three
   measurement inputs carry `max` 5000, 5000 and 1000.
5. `colourNotesDefault` returns the saved note when one exists, the palette
   when none does and a palette exists, and an empty string when neither;
   the rendered field uses it as a `defaultValue` in every case, and the
   "pulled from your inspiration" caption renders only when the palette was
   used.
6. For a room with no measurements, `measurementAssumptionNotes` returns a
   line saying the design is scaled from the photographs, and
   `buildInitialConceptImagePrompt` for that room contains no centimetre
   dimension; for a room with all three, the notes carry no measurement
   line and the prompt carries all three numbers. One test in `packages/ai`
   calls both and asserts both halves.
7. `measurement-notes.tsx` renders a numbered list of the lines it is given
   and renders nothing when given none.
8. `pnpm check` and every workspace test suite pass; no dollar sign is
   added to user-visible text; the diff's added lines contain no em dash.

## Test plan

- Unit, `apps/web/lib/brief-fields.test.ts`: AC 4's bound agreement and AC
  5's colour-note decision.
- Unit, `packages/domain/src/spatial-design-rules.test.ts`: the assumption
  lines for each combination of present and absent measurements.
- Unit, `packages/ai/src/measurement-language.test.ts`: AC 6's
  correspondence, calling `measurementAssumptionNotes` and
  `buildInitialConceptImagePrompt` in one test, which is possible in this
  package because it already depends on the domain package and not the
  reverse.
- Component, `apps/web/app/measurement-notes.test.tsx` (react-dom server
  render, the `app/render-notes.test.tsx` pattern): AC 7.
- Live, on the walk room through the dev-harness driver: AC 1, 2 and 3 in a
  browser, with the job and row states recorded under Verification. These
  three are behaviours of a `"use server"` action, which the recording
  double cannot host and which this PR deliberately does not extract, so a
  browser is the honest way to prove them.
- Visual ladder: `/brief/details` in three states (no measurements with the
  notes showing, measurements present with no notes, a refused submission
  naming the field) at 1440x900 and 390x844, scored by the ux-critic
  against the rubric and the screen-map row.
- Gates: `pnpm check` and every package test script. AC 8.

## Risk tier

STANDARD. No file in Files matches any glob in `.claude/high-risk-paths`:
there is no migration in this PR, `apps/web/lib/render-runner.ts`,
`apps/web/app/api/queues/**`, `apps/web/app/api/stripe/**`,
`apps/web/lib/billing/**` and `packages/ingestion/**` are all untouched, and
no render-path reader is edited. The tier dropped from HIGH when the draft
column left the plan, since `supabase/migrations/**` was the only match. If
Ayo answers the open question by keeping the draft column, the migration
returns, the tier returns to HIGH, and the Codex cross-model pass and a
rollout section are owed before implementation.

## Deferred, with what review already found

Each is a separate PR. The findings are recorded so the analysis is not
repeated.

- **The refused answer itself is not handed back.** The design review's
  standing P0 on this screen, twice measured. The screen map's clause for
  `/brief/details` is "rejection NEVER wipes input"; every OTHER answer in the
  submission now survives, but the refused field re-renders the shorter answer
  already on record, so a shopper who wrote past the bound has to write it
  again from memory. The critic measured the state at both widths and reports
  no restore, undo or view-what-you-typed affordance anywhere on the page.
  Two mechanisms would close it, and both are larger than this PR: the field
  values could be stashed in `sessionStorage` on submit and the refused one
  restored when the page comes back carrying `?refused=`, which needs a client
  component and works only where scripting does; or the submission could be
  written to a draft the page reads, which needs a column and therefore a
  migration this PR deliberately does not have. Also owed with it: the live
  character count the critic asks for at the field, which needs the submitted
  LENGTH to travel, not just the field name. Worth knowing before scheduling
  it: the refusal is only reachable at all from a client that ignores the
  `maxLength` the markup now carries, so no shopper using the app as shipped
  can land in this state.
- **The style selector clobbers a stored note.** Found while answering a
  review of this PR; pre-existing and outside this diff.
  `visual-style-selector.tsx` replaces the WHOLE hidden `styleNotes` field
  with its own generated block whenever the field is empty or starts with
  "Selected visual styles:", so toggling a style drops any shopper text the
  stored value carried from that submission. It cannot lose anything today,
  because no screen lets a shopper write into `style_notes` at all: the only
  writers are the action's composer and this selector. The fix is for the
  selector to use the same `composeStyleNote` and `shopperStyleNote` pair the
  server uses, rather than its own third format, and it has to land with (or
  before) any screen that adds a style-note field.
- **Photo slots, replace and reorder** (step 16). Needs a stored order, but
  "the first photograph is the camera" is read in four places, not one:
  `apps/web/lib/render-inputs.ts`, `apps/web/lib/services/room-images.ts`
  (consumed by both concept generation and concept revision, whose own
  comment warns the two paths must see the same ordering or the
  architecture ground truth diverges), `apps/web/app/actions.ts`, and the
  concepts page. `room_assets.is_primary` is a fifth, competing source of
  truth. A reorder that moves only the render path would build a final
  render from one camera while the concept it must preserve came from
  another. That PR changes all readers together or not at all.
- **Eyebrow renumbering.** The `N° 06` collision between `/brief/details`
  and `/product-matching` is real, but the route is not a usable key: `/`
  renders two numerals, `/onboarding` renders the same numeral as `/`,
  `rooms/new` renders one only for a first room, and the presentation
  screen varies its label under one numeral. The screen map also holds rows
  that can carry no numeral. The key and the ordering source need deciding
  before the table is written.
- **The status display and message hygiene**, with `apps/web/app/error.tsx`
  and its own screen-map row, which the map's rule requires before any UI
  work on it. Next 16's error file takes `{ error, unstable_retry }`, not
  `reset`.
- **Signup states.** The confirm-email state is missing and worth adding.
  The refusal message must NOT name the configured allowlist: it is a
  comma-separated mix of domains and full personal addresses, so rendering
  it would show every pilot member's email to any anonymous visitor. The
  same message is reused today when the provider call throws, reporting a
  network failure as though the address were refused.
- **Measurement row accumulation.** One row per change, no dedupe. Fixing
  it is not an upsert: there is no unique constraint to conflict on, and a
  later manual save must not overwrite the `plan_extracted` provenance
  S5b introduces, which `measurementCanSupportProductFit` reads.
- **Duplicate `design_briefs` rows per room.** No unique constraint on
  `room_id`, and the readers disagree on which row wins (`updated_at` on
  the details page, `created_at` in product sourcing).
- **S5b, the floor plan**: whole-plan acceptance, client-side pdf.js
  rasterization, detected-room identification, measurements written with
  the `plan_extracted` provenance (whose enum value that migration adds,
  since PostgreSQL cannot use a new enum value in the transaction that
  added it), and the Vercel preview proof the project rule requires for a
  native-dependency-adjacent path.
- **The inspiration uploader's stale-closure `is_primary` bug** and the
  `skip` link that bypasses the inspiration action.
- **AC 12 of the parent plan, the J1 step budget**, whose own text says the
  combined start screen and name-only project form of S6 are what bring the
  count inside budget.

## Open questions for Ayo

1. **The draft column, which your parent plan names.** Step 15 prescribes
   save-before-validate, and my first two drafts built it: a
   `design_briefs.draft_json` column written before validation, with a
   contract for promoting accepted fields and recovering refused ones.
   Review killed the justification. The four numeric fields are
   `input type="number"`, so the browser replaces non-numeric text with an
   empty string before submitting and the server never sees it; with the
   textareas bounded by `maxLength` there is no reachable way for a real
   user's submission to be refused server-side; and a draft written on
   submit does not survive a crash before submit, so it is not the
   durability win I first claimed. The mechanism would cost an additive
   migration (returning this PR to HIGH tier), a column, two modules and
   their tests, to recover from a case a client would have to be tampered
   with to reach. I recommend shipping without it and keeping the parent
   plan's intent through the client bounds and the honest rejection path.
   Say the word and I will add it back, at HIGH tier with the Codex pass.
2. **The e2e and visual evidence route.** The repo has a Playwright driver
   at `scripts/dev-harness/e2e.mjs` with a saved storage state at
   `scripts/dev-harness/auth.json`, both gitignored, which is why this plan
   bootstraps no test framework. The state is from 10 July, so its access
   token is long expired and whether the harness still signs in depends on
   the refresh token in that cookie still being valid. If it is not, I
   cannot refresh it: entering a password is prohibited for me, and minting
   a session through the admin API was refused by the tool policy during
   S4. In that case I need you to run the harness once, and the three
   browser criteria and the visual ladder are recorded as owed until you
   do, the way S4 recorded its reveal walk.

## Deviations

- **Step 2 and 5, three further losses the increment review found.** Redefining
  `hasMeasurements` from "this submission carries measurements" to "the row
  needs writing" broke its three other readers, so an unchanged resubmission
  would have reported a fully measured room as unmeasured and regenerated its
  clarifying questions with no dimensions. The two questions are now separate
  values. The new refusal redirect also pointed at `/brief/style`, which
  accepted no message and rendered none, so a refusal there was silent; and
  that refusal was reachable, because the step round-trips its composed style
  note through a hidden field and the action re-wrapped the wrapped value,
  growing the column by about eighty characters per save until it crossed the
  bound and the step could never be submitted again. The style page now renders
  its message and `shopperStyleNote` makes the composition idempotent, which
  also repairs an already-grown value on the next save. None of this was
  foreseen by the plan; all of it is inside its objective.
- **Step 4, the assumption list is a client component.** The plan had it
  server-rendered. Rendered that way it described the last SAVED measurements
  while sitting directly beneath the inputs that override them, so a shopper
  who typed her three numbers was still told the design would be scaled from
  her photographs until she submitted, which is the opposite of the plan's
  stated reason for putting the list on the form at all. The measurement half
  is now recomputed from the live fields; `measurementScalingNotes` was split
  out of `measurementAssumptionNotes` so both sides share one rule.
- **Step 2, the refusal's wording and tone.** The plan said the message would
  name the field. The design review showed that naming it and saying "shorten
  it and continue" asks for an edit the shopper cannot make, because the
  refused text is not on the screen. The message now states what happened and
  the limit, and it carries a tone so a rejection renders as an error rather
  than through the neutral note the app uses for successes. A `tone` parameter
  on the redirect is the minimum that achieves it; the shared status component
  stays deferred.
- **Step 4, the measurement placeholders.** Not in the plan. The empty state
  was effectively unreachable while measurements were mandatory and is an
  ordinary state now, and the grey sample numerals read as entered values
  against a measured screen that uses the same number for real.
- **Step 2, a refusal costs only the field it names.** Found by review after
  the PR was opened. The first implementation refused the whole submission: it
  redirected before the Supabase client was created, so a shopper who fixed her
  colour note and pasted an over-long functional answer in the same visit lost
  both, which is this plan's own objective failing one layer further in, and
  the message told her everything else had been kept. The parse now drops only
  the fields the schema would not take, re-parses, writes the rest, and names
  what was refused; the refused fields keep the value on record, including the
  measurement numbers, and the copy says what actually happened. Where the
  failure is not a bounded answer (a room id that is not a uuid) nothing is
  written, because there is no rest of the submission to save.
- **Step 2, where each fact about a refusal is said.** Three rounds of review
  after the PR was opened moved this twice, so the rule is written down here.
  The field note explains the value the field is SHOWING, because it shows the
  shorter answer that was restored and "Too long to save" beside a visibly
  short value reads as nonsense. The limit rides on the field, because that is
  where she rewrites and the banner is a screen above her by then; a step that
  renders no field for the refused answer says the limit in its banner
  instead, so it is never said twice and never nowhere. The banner names the
  fields, says what happened to the rest, and links to the first. All three
  measurements carry the same error treatment as the four textareas, because a
  refusal naming a measurement marked no input anywhere on the page.
- **Step 2, the branch that can name no field.** A submission the schema cannot
  read at all (a room id that is not a uuid) has no field to name, and sending
  the field name anyway resolved to nothing on the screen: she would press
  Continue and get back an identical page. It sends a bounded CODE now, which
  the screen resolves to its own sentence. Putting the sentence itself in
  `?message=` was written and then withdrawn: that channel renders whatever
  text a link carries, and making this PR depend on it is exactly the
  reflection the refusal treatment is kept out of.
- **Step 2, the style-note strip is positional, not textual.** Also found by
  review. `shopperStyleNote` matched the two composed prefixes anywhere in the
  stored value, so a paragraph of the shopper's own that opened with those
  words would have been deleted on save. It now strips only from the two edges,
  where `composeStyleNote` writes them. Narrowing it further by matching the
  style names the summary carries was rejected: it would stop recognising this
  app's own text the day a style is renamed, and the growth-to-lockout bug the
  pair exists to stop would come back silently. The residual corner, a note
  whose first block opens with the same line the composer writes there, is
  pinned by test as a known limit.

## Verification

Checked on 2026-09-09 on branch `opus/s5a-intake-integrity`. Unit and
component criteria are proven by the package suites; the four criteria that
are behaviours of a `"use server"` action were driven in a real browser,
because the recording double cannot host one and this PR deliberately does
not extract the action.

The browser run is twenty-seven checks against the running app, all passing
(twenty-two, plus five the post-PR reviews added: a submission carrying one
refused answer and three valid changes, a submission carrying two refused
answers, and the three that hold the refusal's copy and link where the design
review put them). It
used the dev-harness Playwright driver and its saved session
(`scripts/dev-harness/auth.json`, gitignored). Open question 2 in
this plan is therefore answered: the saved state's refresh token was still
valid, so no new session had to be minted and no password was read or
typed. The harness's `node_modules` symlink pointed into a deleted
scratchpad from an earlier session and was repointed at an isolated install
outside the repo, per its own README; nothing was installed into the
workspace.

Test data: the run exercised the e2e persona's room
`f4fba429-63e0-45cf-b7c6-eefc81657b55`, writing and clearing its
measurements and its colour note several times and leaving it measured at
520 by 410 by 300. No other room, project or user row was touched.

- **AC 1**, measurements optional. Submitting the details form with all
  three fields empty redirected to `/brief/questions/0` rather than back to
  the details step, and the old "Room measurements are required" message
  does not occur anywhere in the tree. Verified in the browser.
- **AC 2**, a measurement can be cleared. A room measured 520 by 410 by 300
  was submitted with all three fields empty; the re-rendered form showed
  all three empty, where before this change the newest row's values
  returned for ever. Verified in the browser, and the decision itself is
  pinned by `measurementsChanged` in `apps/web/lib/brief-fields.test.ts`,
  including that an unchanged resubmission writes no row and that the other
  brief steps cannot clear a room's measurements by omitting the inputs.
- **AC 3**, a refused answer is a message, not a throw, and costs only the
  field it names. Re-driven in the browser after the criterion was amended.
  A client with the input bound removed posted 1201 characters of colour
  notes; the response came back to the details step at `?refused=colorNotes`
  with "Your colours and materials answer was too long to save, so we kept
  the answer you had. Everything else on this page was saved. Keep it under
  1200 characters.", no framework error page rendered, and the saved colour
  note was still in the field. A second submission carried an over-long
  functional answer alongside a changed colour note and a changed wall
  measurement: both changes were saved, the functional answer kept
  "seats six for dinner", and only that field was marked. A third carried two
  over-long answers and both were named with both limits. The earlier run
  recorded here quoted a message the shipped code no longer produces; that
  wording is superseded.
- **AC 4**, the form carries the schema's bounds.
  `packages/domain/src/brief-field-bounds.test.ts` exercises the schema at
  each bound rather than trusting the wiring, and
  `apps/web/lib/brief-fields.test.ts` reads the attributes from the same
  table. The rendered attributes were also read off the live page:
  `maxlength=1200` on the colour field, `max=5000` on the wall, `max=1000`
  on the ceiling.
- **AC 5**, a saved colour note re-renders. Verified in the browser: the
  saved note came back in the field, where the old condition rendered an
  empty box. `colourNotesDefault` pins the three cases, including that the
  palette is a submitted default and never a placeholder.
- **The assumption list follows what she types**, which the increment review
  showed a server-rendered list could not do: with the fields empty the
  photograph line is shown, typing a wall length and a depth removes it and
  names the ceiling instead, and typing the ceiling clears the panel, all
  without a submit. Verified in the browser.
- **AC 6**, the note matches the prompt.
  `packages/ai/src/measurement-language.test.ts` calls both sides in one
  test and asserts both directions, including the case that motivated the
  wording: a wall length without a depth reaches the model as silence, so
  the note still says the design is scaled from the photographs. The live
  page showed the photograph line for an unmeasured room and no measurement
  line once measured.
- **AC 7**, the assumption list. `apps/web/app/measurement-notes.test.tsx`
  covers the numbered list, the empty case rendering nothing, and that the
  assumptions are neither in a tooltip nor collapsed, which 12.5 forbids.
- **AC 8**, gates. `pnpm check` (lint, typecheck across all packages,
  production build) and every workspace suite pass: 89 test files green,
  up from 82 on `main`. The diff's added lines contain no em dash and no
  dollar sign reaches user-visible text.

### Design review, and what it is owed

The three states were captured at 1440x900 and 390x844 and scored by the
ux-critic against the rubric and the screen-map row. It returned FAIL(P0) on
all three states. Three findings were caused or made prominent by this change
and are fixed above: the refusal asking for an impossible edit, the refusal
rendering as a neutral note, and the ghost numerals in the empty measurement
fields.

The rest are properties of the screen this change did not introduce and must
not be bundled into a data-loss fix. They are recorded here so the PR that
takes the screen inherits the evidence rather than rediscovering it:

- The editorial header stack (eyebrow, 44px headline, four-line intro,
  context line, style chip) takes 44 percent of the desktop fold and 58 to 72
  percent of the first mobile screen, so no question and no input is visible
  on a 390 wide screen in any state. The critic notes the headline itself is
  approved in the design handoff, so this is a proportion problem rather than
  a novel pattern, and that section 19.4 of the design system puts the first
  input directly under the eyebrow with no intro paragraph.
- The optional accelerator block is the only enclosed surface on the page, so
  the optional content outranks the question list the contract calls dominant,
  and the floor-plan dropzone is roughly seventeen times the area of the
  primary action.
- The primary action sits more than two viewports below the fold on desktop
  and more than three screen heights down on mobile.
- The must-keep-clear answer is a single-line input that clips a saved value
  mid-word at both widths, which the contract's "saved values re-render"
  promise does not survive.
- The letterspaced captions that carry the word "optional" are the least
  legible text on the screen, which matches the known form-typography backlog
  item rather than anything new here.
- The step rail says Questions is next while the button says Continue to
  concepts.
- Two contract states, plan-uploaded and room-identified, have no capture at
  all and cannot be graded until S5b builds them.
