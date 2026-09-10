// S5b: the floor plan journey, driven against the running app.
//
// This is the leg that covers the criteria no unit or component test can
// reach, because they are behaviours of a `"use server"` action and of a real
// model reading a real drawing. Run it from `scripts/dev-harness` with the dev
// server up and the saved session in `auth.json`:
//
//   node verify-floor-plan.mjs
//
// It costs one `floor_plan_read` call, about half a cent. Every count is a
// DELTA around the action rather than an absolute, because it runs on the e2e
// persona's own room: the designer free-room trigger refuses a second one.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const HARNESS = "/Users/ayoolatoye/Documents/projects/ritzy-studio/scripts/dev-harness";
const FIXTURES = `${HARNESS}/fixtures`;
const OUT = "/private/tmp/claude-501/-Users-ayoolatoye-Documents-projects-ritzy-studio/ab9a7ca8-1f64-40b6-973a-c2aaa3592e5a/scratchpad/shots-s5b";
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

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`room ${room.id} left in place for inspection`);
if (failed.length) { console.log("FAILED:", failed.map((f) => f.name).join("; ")); process.exit(1); }
