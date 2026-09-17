// S5b: the floor plan journey, driven against the running app.
//
// This is the leg that covers the criteria no unit or component test can
// reach, because they are behaviours of a `"use server"` action and of a real
// model reading a real drawing. Run it from `scripts/dev-harness` with the dev
// server up and the saved session in `auth.json`:
//
//   node verify-floor-plan.mjs
//
// It costs two `floor_plan_read` calls, about a cent in all: the plan read on
// upload, and the read pressed after a lost call. Every count is a DELTA around
// the action rather than an absolute, because it runs on the e2e persona's own
// room: the designer free-room trigger refuses a second one.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Everything is resolved from this file, so the leg runs wherever the
// repository is checked out. It carried one developer's absolute paths, which
// is fine for a scratch script and not for one in the repository (review).
// fileURLToPath, not `new URL(...).pathname`: the latter keeps percent
// encoding, so a checkout under a path with a space in it resolves to a
// directory that does not exist (review).
const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = `${HARNESS}/fixtures`;
const OUT = process.env.RITZY_HARNESS_OUT ?? `${HARNESS}/e2e-shots/floor-plan`;
fs.mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3000";

const envText = fs.readFileSync(path.resolve(HARNESS, "../../.env.local"), "utf8");
const env = (k) => (envText.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const SUPA = env("NEXT_PUBLIC_SUPABASE_URL");
const SVC = env("SUPABASE_SERVICE_ROLE_KEY");
const state = JSON.parse(fs.readFileSync(`${HARNESS}/e2e-state.json`, "utf8"));

const rest = async (pathAndQuery, init = {}) => {
  const res = await fetch(`${SUPA}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) }
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

// The persona's own room. A room of its own would have been cleaner, but the
// designer free-room trigger refuses a second one, which is S6's gate doing
// its job. So every count here is a DELTA around the action rather than an
// absolute on a room with no history.
const room = { id: state.roomId };
console.log("room:", room.id, "(the e2e persona's, with its existing history)");
const DETAILS = `${BASE}/projects/${state.projectId}/rooms/${room.id}/brief/details`;

const jobs = async () => (await rest(`ai_jobs?room_id=eq.${room.id}&select=job_type,status,cost_estimate_usd,input_summary,output_summary&order=created_at.desc`)) ?? [];
const measurements = async () => (await rest(`room_measurements?room_id=eq.${room.id}&select=source,confidence,wall_length_cm,room_depth_cm,ceiling_height_cm,floor_plan_asset_id&order=created_at.desc`)) ?? [];
const assets = async () => (await rest(`room_assets?room_id=eq.${room.id}&asset_type=eq.floor_plan&select=id,mime_type,width_px&order=created_at.desc`)) ?? [];

const jobsAtStart = (await jobs()).length;
const measurementsAtStart = (await measurements()).length;
const startedMeasured = (await measurements())[0] ?? null;
console.log(`starting from ${jobsAtStart} jobs, ${measurementsAtStart} measurement rows, newest ${startedMeasured?.source}/${startedMeasured?.wall_length_cm}x${startedMeasured?.room_depth_cm} ceiling ${startedMeasured?.ceiling_height_cm}`);

const browser = await chromium.launch();
const context = await browser.newContext({ storageState: `${HARNESS}/auth.json`, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(60000);
const strip = async () => page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));

const shot = async (name) => {
  await strip();
  await page.screenshot({ path: `${OUT}/${name}--1440x900.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await strip();
  await page.screenshot({ path: `${OUT}/${name}--390x844.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
};

const upload = async (file) => {
  await page.goto(DETAILS, { waitUntil: "networkidle" });
  await strip();
  await page.setInputFiles('input[type="file"]', file);
};

// Wait on the row rather than on the DOM: the read is a job, and polling the
// screen races the upload's own navigation.
const waitForRead = async (from) => {
  for (let i = 0; i < 40; i += 1) {
    await page.waitForTimeout(3000);
    const rows = await jobs();
    const latest = rows[0];
    if (rows.length > from && latest && latest.status !== "running") return latest;
  }
  return null;
};

// ------------------------------------------------------ the too-small refusal
// The too-small case: the same Emaar plan at 500 pixels, which the ladder in
// the plan's Verification shows is where a read stops being trustworthy. A
// downscale of developer collateral rather than somebody's listing sheet, so
// the fixtures carry no address.
await upload(`${FIXTURES}/floor-plan-emaar-below-floor-500px.jpg`);
await page.waitForTimeout(6000);
await page.goto(DETAILS, { waitUntil: "networkidle" });
const smallText = await page.locator('[data-testid="detected-rooms"]').innerText().catch(() => "");
check(
  "a plan below the readable floor is refused before any call",
  /too small to read/.test(smallText) && /\d{3,4} pixels across/.test(smallText),
  smallText.slice(0, 80)
);
check("and nothing was spent on it", (await jobs()).length === jobsAtStart, `${(await jobs()).length - jobsAtStart} new jobs`);
await shot("plan--too-small");

// ------------------------------------------- bytes that are not what they say
// A PDF saved as `plan.png`, and bytes that are no image at all saved the same
// way. The browser declares both `image/png`, so the upload asks for a read,
// and only the server can tell. A first version refused them and wrote nothing
// down, so the page said "Floor plan attached" and then "Reading your floor
// plan" for ever (PR review). The refusal has to be on screen when the upload
// settles, WITHOUT a reload, and still there after one.
const panelText = async () => page.locator('[data-testid="detected-rooms"]').innerText().catch(() => "");
const settle = async () =>
  page
    .waitForFunction(() => !/Uploading floor plan|Reading your floor plan/.test(document.body.innerText), null, { timeout: 90000 })
    .catch(() => null);
const prompts = async () => ({
  attached: await page.getByText("Floor plan attached", { exact: true }).count(),
  refused: await page.getByText("Attached, but we cannot read it", { exact: true }).count()
});

const disguised = [
  {
    name: "a PDF saved as plan.png",
    buffer: fs.readFileSync(`${FIXTURES}/floor-plan-tilal-villa-brochure.pdf`),
    says: /PDF, which we cannot read yet/,
    row: "application/pdf"
  },
  {
    name: "bytes that are no image, saved as plan.png",
    buffer: Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 131 + 7) % 256)),
    says: /could not open that file as an image/,
    row: "application/octet-stream"
  }
];
for (const file of disguised) {
  await upload({ name: "plan.png", mimeType: "image/png", buffer: file.buffer });
  await settle();
  const inSession = await panelText();
  const prompt = await prompts();
  check(
    `${file.name} is refused on screen as soon as the upload settles`,
    file.says.test(inSession) && !/Reading your floor plan/.test(inSession),
    inSession.replace(/\n/g, " ").slice(0, 80)
  );
  check(
    "and the upload panel says it cannot be read, not that it is attached",
    prompt.refused === 1 && prompt.attached === 0,
    JSON.stringify(prompt)
  );
  check(
    "the plan's row now says what the file is",
    (await assets())[0]?.mime_type === file.row,
    `${(await assets())[0]?.mime_type}`
  );
  await page.goto(DETAILS, { waitUntil: "networkidle" });
  const reloaded = await panelText();
  check(
    "and a reload says the same, rather than reading for ever",
    file.says.test(reloaded) && !/Reading your floor plan/.test(reloaded),
    reloaded.replace(/\n/g, " ").slice(0, 80)
  );
  check("nothing was spent on it", (await jobs()).length === jobsAtStart, `${(await jobs()).length - jobsAtStart} new jobs`);
}
await shot("plan--not-an-image");

// ------------------------------------------------------------ the PDF refusal
await upload(`${FIXTURES}/floor-plan-tilal-villa-brochure.pdf`);
await page.waitForTimeout(6000);
await page.goto(DETAILS, { waitUntil: "networkidle" });
const pdfText = await page.locator('[data-testid="detected-rooms"]').innerText().catch(() => "");
check("a PDF says so rather than sitting there unread", /PDF, which we cannot read yet/.test(pdfText), pdfText.slice(0, 70));
check("and nothing was spent on it either", (await jobs()).length === jobsAtStart, `${(await jobs()).length - jobsAtStart} new jobs`);
await shot("plan--pdf");

// ------------------------------------------------------------- the real plan
const beforeJobs = (await jobs()).length;
await upload(`${FIXTURES}/floor-plan-emaar-collective-2bed.jpg`);
const readJob = await waitForRead(beforeJobs);
// Before any reload: this page was loaded over the refused PDF, and a first
// version kept the panel's wording from that load, so a plan that had just
// read perfectly was captioned "Attached, but we cannot read it" (PR review).
await settle();
const promptAfterRead = await prompts();
check(
  "a readable plan that replaces a refused one is called attached, without a reload",
  promptAfterRead.attached === 1 && promptAfterRead.refused === 0,
  JSON.stringify(promptAfterRead)
);
await page.goto(DETAILS, { waitUntil: "networkidle" });
const roomsText = await page.locator('[data-testid="detected-rooms"]').innerText().catch(() => "");
check(
  "a real Emaar plan yields its rooms",
  readJob?.status === "succeeded" && /rooms on your plan/i.test(roomsText),
  `${readJob?.status}, ${(readJob?.output_summary?.rooms ?? []).length} rooms: ${roomsText.replace(/\n/g, " ").slice(0, 70)}`
);

const afterJobs = await jobs();
check("exactly one read, succeeded, with its cost", afterJobs.length - beforeJobs === 1 && afterJobs[0].status === "succeeded" && afterJobs[0].cost_estimate_usd > 0, `${afterJobs.length - beforeJobs} job, ${afterJobs[0]?.status}, $${afterJobs[0]?.cost_estimate_usd}`);
check("one floor plan asset for the room, the uploader having replaced the last", (await assets()).length === 1, `${(await assets()).length}`);

await page.goto(DETAILS, { waitUntil: "networkidle" });
const reloadJobs = await jobs();
check("reloading the page reads nothing again", reloadJobs.length === afterJobs.length, `${reloadJobs.length} jobs`);

const chips = await page.locator('[data-testid="detected-rooms"] button').allInnerTexts();
// The numbers, not the phrasing: the copy has moved twice and the substance
// is that the chip carries what confirming it would write.
check(
  "the rooms carry the numbers they would write",
  chips.some((c) => /4\.7 m/.test(c) && /3\.2 m/.test(c)),
  chips.map((c) => c.replace(/\n/g, " ")).join(" | ").slice(0, 120)
);
check(
  "and the one the plan does not size says so",
  chips.some((c) => /no size printed on the plan/.test(c)),
  ""
);
check(
  "every read number says where it came from",
  chips.filter((c) => /\d\.\d m wall/.test(c)).every((c) => /from your plan/.test(c)),
  ""
);
await shot("plan--rooms");

// -------------------------------------------------------------- confirming
const living = page.locator('[data-testid="detected-rooms"] button', { hasText: "Living" }).first();
await living.click();
await page.waitForTimeout(3500);

const wall = await page.inputValue("#wallLengthCm");
const depth = await page.inputValue("#roomDepthCm");
check("the fields follow the room she picked, without a reload", wall === "470" && depth === "320", `wall=${wall} depth=${depth}`);
const notes = await page.locator('[data-testid="measurement-assumption-notes"]').innerText().catch(() => "");
check("and the assumption panel stops saying the design is scaled from photographs", !/scaled from your photographs/.test(notes), notes.replace(/\n/g, " ").slice(0, 70));

const rows = await measurements();
check(
  "exactly one new measurement row, from the plan, verified, pointing at it",
  rows.length - measurementsAtStart === 1 && rows[0].source === "floor_plan" && rows[0].confidence === "verified" && Number(rows[0].wall_length_cm) === 470 && Number(rows[0].room_depth_cm) === 320 && rows[0].floor_plan_asset_id,
  `+${rows.length - measurementsAtStart} ${rows[0]?.source}/${rows[0]?.confidence} ${rows[0]?.wall_length_cm}x${rows[0]?.room_depth_cm}`
);
check(
  "and the ceiling she typed before survives a plan that prints none",
  startedMeasured?.ceiling_height_cm == null || Number(rows[0].ceiling_height_cm) === Number(startedMeasured.ceiling_height_cm),
  `was ${startedMeasured?.ceiling_height_cm}, now ${rows[0]?.ceiling_height_cm}`
);
// No outline: the boxes came back plausible and wrong, so the crop and the
// overlay were withdrawn. What confirming does now is name the room to the
// concept prompt.
const outline = await page.locator('[data-testid="detected-room-outline"]').count();
check("nothing is outlined on the plan, since the model cannot locate a room", outline === 0, `${outline}`);
const panel = await page.locator('[data-testid="detected-rooms"]').innerText();
check("and the screen names the room it is treating as this one", /We are treating Living/.test(panel), panel.replace(/\n/g, " ").slice(0, 80));
await shot("plan--confirmed");

// ---------------------------------------------------- continue, and the row
await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/brief/details"), { timeout: 90000 }).catch(() => null), page.click('button[type="submit"]')]);
await page.waitForTimeout(2000);
check("continuing leaves the details step", !page.url().includes("/brief/details"), page.url().replace(BASE, "").slice(0, 60));
const afterContinue = await measurements();
check(
  "and an unedited continue writes no further row, so the plan stays its source",
  afterContinue.length === rows.length && afterContinue[0]?.source === "floor_plan",
  `${afterContinue.length - rows.length} further rows, newest ${afterContinue[0]?.source}`
);

// --------------------------------------------------- a read that never arrived
// The upload lands, and the call that asks for the read does not: the tab
// closed, the connection dropped, or the call threw before it opened a row. A
// first version rendered that as "Reading your floor plan" for ever, since no
// row meant "not opened yet" (PR review). The server action is held and then
// dropped for one upload to stand in for all three; storage and the row go
// straight to Supabase and are unaffected.
//
// A second tab is left open first, on the rooms of the plan about to be
// replaced, for the stale click at the end.
const tab2 = await context.newPage();
tab2.setDefaultTimeout(60000);
await tab2.goto(DETAILS, { waitUntil: "networkidle" });
const tab2Rooms = tab2.locator('[data-testid="detected-rooms"] button');
check("a second tab shows the rooms of the plan about to be replaced", (await tab2Rooms.count()) > 0, `${await tab2Rooms.count()} rooms`);

const isAction = (route) => route.request().method() === "POST" && Boolean(route.request().headers()["next-action"]);
// Held for four seconds before it is dropped, so the replacement is in flight
// long enough to look at.
const holdThenDrop = async (route) => {
  if (!isAction(route)) return route.continue();
  await new Promise((resolve) => setTimeout(resolve, 4000));
  return route.abort();
};
await page.route("**/*", holdThenDrop);
const jobsBeforeLostCall = (await jobs()).length;
await upload(`${FIXTURES}/floor-plan-emaar-collective-2bed.jpg`);
await page.getByText("Reading your floor plan...", { exact: true }).waitFor({ timeout: 30000 }).catch(() => null);
const roomsWhileReplacing = await page.locator('[data-testid="detected-rooms"] button').count();
check(
  "while a plan is replaced, none of the old plan's rooms is on screen to click (criterion 11)",
  roomsWhileReplacing === 0 && (await page.getByText("Reading your floor plan...", { exact: true }).count()) === 1,
  `${roomsWhileReplacing} rooms on screen`
);
await settle();
await page.unroute("**/*", holdThenDrop);
const unreadText = await panelText();
check(
  "a plan whose read never arrived is offered the read, not told one is running",
  /have not read this floor plan yet/.test(unreadText) && !/Reading your floor plan/.test(unreadText),
  unreadText.replace(/\n/g, " ").slice(0, 80)
);
check("and nothing was spent", (await jobs()).length === jobsBeforeLostCall, `${(await jobs()).length - jobsBeforeLostCall} new jobs`);
await page.goto(DETAILS, { waitUntil: "networkidle" });
check("a reload says the same", /have not read this floor plan yet/.test(await panelText()), "");
await shot("plan--unread");

// Pressed, with the call dropped: the panel says so and still offers the
// read, rather than the page going to its error screen.
const readOffer = () => page.locator('[data-testid="detected-rooms"] button', { hasText: "Read the rooms on it" });
const drop = (route) => (isAction(route) ? route.abort() : route.continue());
await page.route("**/*", drop);
await readOffer().click();
await page.getByText("That did not go through. Try again in a moment.").waitFor({ timeout: 30000 }).catch(() => null);
const droppedText = await panelText();
check(
  "a pressed read that does not go through says so, and still offers the read",
  /did not go through/.test(droppedText) && (await readOffer().count()) === 1 && (await jobs()).length === jobsBeforeLostCall,
  droppedText.replace(/\n/g, " ").slice(0, 90)
);
await page.unroute("**/*", drop);

// Pressed again, it reads, saying so while it does.
await readOffer().click();
await page
  .getByText("Reading your floor plan. The rooms it names will appear here in a moment.")
  .waitFor({ timeout: 10000 })
  .catch(() => null);
check("while that read runs, the panel says it is reading", /Reading your floor plan/.test(await panelText()), "");
const offeredRead = await waitForRead(jobsBeforeLostCall);
await settle();
const afterOfferedRead = await panelText();
check(
  "and pressing it reads the plan, once, without a reload",
  offeredRead?.status === "succeeded" &&
    (await jobs()).length - jobsBeforeLostCall === 1 &&
    /rooms on your plan/i.test(afterOfferedRead),
  `${offeredRead?.status}, ${(await jobs()).length - jobsBeforeLostCall} job: ${afterOfferedRead.replace(/\n/g, " ").slice(0, 60)}`
);

// ------------------------------------------------ a stale click in the other tab
// The second tab still shows the replaced plan's rooms. A click there sends
// the read its list came from, which is no longer the plan's, so the server
// refuses it: nothing is written, and that tab's fields do not take the old
// list's numbers for Continue to save (PR review).
const measurementsBeforeStale = (await measurements()).length;
const wallBefore = await tab2.inputValue("#wallLengthCm");
const depthBefore = await tab2.inputValue("#roomDepthCm");
await tab2Rooms.filter({ hasText: /Bedroom/ }).first().click();
await tab2.getByText("belongs to a plan you have since replaced", { exact: false }).waitFor({ timeout: 60000 }).catch(() => null);
// And the tab is left on the plan attached now, not stranded on a list every
// click of which is refused: the refusal's own refresh brings in the new
// plan's rooms, none of them confirmed yet, under the reply.
await tab2.getByText("Pick the one this brief is for", { exact: false }).waitFor({ timeout: 20000 }).catch(() => null);
const staleText = await tab2.locator('[data-testid="detected-rooms"]').innerText().catch(() => "");
check(
  "a click on the replaced plan's rooms in another tab is refused, says why, and leaves the tab on the plan attached now",
  /belongs to a plan you have since replaced/.test(staleText) && /Pick the one this brief is for/.test(staleText) && !/We are treating/.test(staleText),
  staleText.replace(/\n/g, " ").replace(/^.*?(Pick|We are)/, "$1").slice(0, 110)
);
const wallAfter = await tab2.inputValue("#wallLengthCm");
const depthAfter = await tab2.inputValue("#roomDepthCm");
check(
  "and nothing is written, and that tab's fields do not move",
  (await measurements()).length === measurementsBeforeStale && wallAfter === wallBefore && depthAfter === depthBefore,
  `+${(await measurements()).length - measurementsBeforeStale} rows, wall ${wallBefore} to ${wallAfter}, depth ${depthBefore} to ${depthAfter}`
);
await tab2.close();

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`room ${room.id} left in place for inspection`);
if (failed.length) { console.log("FAILED:", failed.map((f) => f.name).join("; ")); process.exit(1); }
