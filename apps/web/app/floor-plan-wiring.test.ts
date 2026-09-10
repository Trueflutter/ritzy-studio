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

console.log("floor plan wiring tests passed");
