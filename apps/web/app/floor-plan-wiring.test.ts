import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// S5b: the wiring between the screen and the actions, which nothing else can
// reach.
//
// The read is triggered by an upload and the confirmation by a chip, both
// through server actions, so the units and the components can be green while
// the feature is dead: delete one call from the uploader and no `ai_jobs` row
// is ever created, the screen says "Reading your floor plan" for ever, and
// every suite still passes (tests review). The browser leg in
// `scripts/dev-harness/verify-floor-plan.mjs` proves the behaviour; this
// proves the calls exist, in the suite that runs on every change.

const brief = path.resolve(__dirname, "projects/[projectId]/rooms/[roomId]/brief");
const uploader = readFileSync(path.join(brief, "floor-plan-uploader.tsx"), "utf8");
const details = readFileSync(path.join(brief, "details/page.tsx"), "utf8");
const rooms = readFileSync(path.join(brief, "details/detected-rooms.tsx"), "utf8");

// The upload is the only thing that spends. A render must never call it.
assert.match(uploader, /await readFloorPlanAction\(roomId\)/, "the uploader reads the plan it just uploaded");
assert.equal(
  /readFloorPlanAction/.test(details),
  true,
  "and the page hands the action down rather than the component importing it"
);
assert.match(details, /actions=\{\{ confirm: confirmDetectedRoomAction, read: readFloorPlanAction \}\}/);
assert.equal(
  /readFloorPlanForRoom|confirmDetectedRoom\(/.test(details),
  false,
  "the page calls no service directly, so nothing reads a plan on render"
);

// A confirmation belongs to the plan it was read from. Both the screen and the
// concept path check it; the check is what stops a room picked off a replaced
// drawing being shown, and cropped from, as this one (review finding).
assert.match(details, /recordedRoom\.assetId === floorPlan\?\.id/);

// PDF is off the accept list until the slice that can rasterise one:
// advertising a format the reader refuses put the promise and the refusal
// sixty pixels apart in the same panel (design review).
assert.equal(/application\/pdf/.test(uploader), false, "the dropzone does not accept PDF");
assert.equal(
  /,\s*(or\s+)?PDF/i.test(uploader.match(/hint="[^"]*"/)?.[0] ?? ""),
  false,
  "and the hint does not list it among the formats it takes; naming it as something to photograph is fine"
);

// Not asserted here: that every control is `type="button"`. The rendered
// markup is where that is provable, and `detected-rooms.test.tsx` asserts it
// on the buttons themselves; counting the source finds the phrase in a comment
// and calls it a control.

// The fields are filled through the ids the page renders, so a rename on the
// page cannot leave the confirmation writing into nothing.
for (const id of ["wallLengthCm", "roomDepthCm", "ceilingHeightCm"]) {
  assert.ok(details.includes(`id="${id}"`), `the details page renders ${id}`);
}
assert.match(rooms, /ASSUMPTION_SOURCE_FIELD_IDS/, "and it takes them from the one place that names them");

// The label has to reach the model, not just the service that assembles the
// inputs. It was recorded by the confirmation, returned by `roomImageInputs`,
// and passed to neither model call, so the sentence that replaced the crop was
// never given a room to name (cross-model gate). The seam tests were green
// throughout, which is why this asserts the call sites.
const conceptPaths = [
  "lib/services/concept-generation.ts",
  "lib/services/concept-revision.ts"
];
for (const rel of conceptPaths) {
  const source = readFileSync(path.resolve(__dirname, "..", rel), "utf8");
  assert.match(
    source,
    /floorPlanRoomLabel: images\.floorPlanRoomLabel/,
    `${rel} hands the confirmed room's name to the model beside the plan`
  );
}

// A read that throws must not strand the page. The uploader's call carries a
// catch, so a dropped connection leaves the panel settled and the plan
// offered for reading rather than "Reading your floor plan..." until a
// reload; and the rooms block catches around its own read, because inside a
// transition an uncaught rejection replaces the page with the error boundary
// (tests review). Both are behaviours of a click, which no render reaches,
// so the harness drives them too; these pin the shape in the fast suite.
assert.match(uploader, /await readFloorPlanAction\(roomId\)\.catch\(/, "the uploader survives a read that throws");
assert.match(rooms, /try \{\s*const result = await actions\.read\(roomId\);/, "the rooms block reads inside a try");
assert.match(rooms, /label: "Read the rooms on it", run: read \}/, "the offer to read a plan nothing has read is the read");
assert.match(rooms, /label: "Try reading it again", run: read \}/, "and so is the retry after a failed one");

// A confirmation names the read its list came from, and the page hands the
// component that read's id. Without it the server compares the attached plan
// with the newest read, both its own, and cannot see a list from an older
// plan (PR review).
assert.match(details, /readJobId=\{floorPlanReadJob\?\.id \?\? null\}/);
assert.match(rooms, /await actions\.confirm\(roomId, index, readJobId\)/);
// The stale refusal is marked as one on its way out of the action, and the
// block shows it whatever the page says next: it is the only thing saying why
// the list she clicked is gone.
assert.match(rooms, /say\(result\.message, \{ whateverFollows: result\.stale === true \}\)/);
assert.match(
  rooms,
  /messageForState\(message, \{ state, replacement: replacements \}\)/,
  "and a reply is scoped to the replacement it was given under"
);
// And a refused confirmation moves no field: it wrote nothing, and the old
// list's numbers on the page would be saved as hers by Continue.
{
  const refusedReturns = rooms.search(/if \(!result\.confirmed\) \{\s*return;\s*\}/);
  assert.ok(refusedReturns > 0, "a refused confirmation returns");
  assert.ok(refusedReturns < rooms.indexOf("setFieldValue(MEASUREMENT_FIELD_IDS[0], room.wallLengthCm)"), "before any field is set");
}

// A read the rooms block started says it is reading while it runs, rather
// than "not read yet" over a read already paid for (PR review). `pending` is
// false in any static render, so this is pinned on the source.
assert.match(rooms, /state === "reading" \|\| \(\(state === "unread" \|\| state === "read_failed"\) && pending\)/);

// The upload panel and the rooms block share one provider, so the rooms of
// the plan being replaced come off the screen while it is replaced
// (criterion 11), and the uploader says so at the start and on every way out.
{
  const opens = details.indexOf("<FloorPlanActivityProvider>");
  const closes = details.indexOf("</FloorPlanActivityProvider>");
  assert.ok(opens > 0 && closes > opens, "the provider is on the page");
  for (const child of ["<FloorPlanUploader", "<DetectedRooms"]) {
    const at = details.indexOf(child);
    assert.ok(at > opens && at < closes, `${child} is inside it`);
  }
  assert.ok(
    uploader.indexOf("setReplacing(true)") > 0 &&
      uploader.indexOf("setReplacing(true)") < uploader.indexOf('.from("room-assets")\n      .upload('),
    "the rooms come off before the upload starts"
  );
  assert.equal((uploader.match(/setReplacing\(false\)/g) ?? []).length, 3, "and come back on both errors and when the page is refreshed");
}

// No reply from an action claims a read is under way. The action cannot know
// that, and a reply saying so sat under a refused plan with nothing reading
// (tests review).
{
  const actionsSource = readFileSync(path.resolve(__dirname, "actions.ts"), "utf8");
  const start = actionsSource.indexOf("export async function readFloorPlanAction");
  const end = actionsSource.indexOf("async function ensureInspirationAnalysisBeforeDetails");
  assert.ok(start > 0 && end > start, "the two floor plan actions are found, in order");
  // Their string literals only: the rest of the file, comments included, talks
  // about other things being read.
  const replies = actionsSource.slice(start, end).match(/"[^"\n]*"|`[^`]*`/g) ?? [];
  assert.ok(replies.some((reply) => /nothing was changed/.test(reply)), "the replies are what this looks at");
  assert.match(
    actionsSource.slice(start, end),
    /confirmed: false,\s*stale: true,\s*message: "That list belongs to a plan you have since replaced/,
    "the stale refusal says it is one"
  );
  assert.equal(replies.some((reply) => /being read|is reading|in progress/i.test(reply)), false);
}

// The replacement inserts before it retires. The other order loses the old
// plan when the insert fails, with the new object orphaned in storage
// (cross-model gate).
{
  const insertAt = uploader.indexOf('.from("room_assets").insert');
  const deleteAt = uploader.indexOf('.from("room_assets").delete');
  assert.ok(insertAt > 0 && deleteAt > 0);
  assert.ok(insertAt < deleteAt, "the new plan is durable before the old one is deleted");
}

console.log("floor plan wiring tests passed");
