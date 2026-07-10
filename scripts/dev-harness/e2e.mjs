// Staged E2E driver for Ritzy Studio against local stack.
// Usage: node e2e.mjs <stage> [args]; state persisted in e2e-state.json + auth.json.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const DIR = new URL(".", import.meta.url).pathname;
const SHOTS = DIR + "e2e-shots/";
const STATE_FILE = DIR + "e2e-state.json";
const AUTH_FILE = DIR + "auth.json";
fs.mkdirSync(SHOTS, { recursive: true });

const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : {};
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  storageState: fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined
});
const page = await context.newPage();
page.setDefaultTimeout(30000);

async function dismissDevOverlay() {
  try {
    await page.keyboard.press("Escape");
    const badge = page.locator("[data-nextjs-toast], nextjs-portal").first();
    if (await badge.count()) {
      await page.evaluate(() => {
        document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
      });
    }
  } catch {
    // best effort
  }
}

async function shot(name) {
  await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: false });
  console.log(`shot: ${name} url: ${page.url()}`);
}

async function login() {
  await page.goto(`${BASE}/login`);
  await page.fill("#signin-email", "fable-test@ritzy.local");
  await page.fill("#signin-password", "fable-test-passw0rd");
  await page.click("button[type=submit]:has-text('Sign in')");
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 20000 });
  await context.storageState({ path: AUTH_FILE });
  await shot("01-after-login");
}

async function onboarding() {
  await page.goto(`${BASE}/onboarding`);
  await page.click("text=Designer mode");
  await page.waitForTimeout(3000);
  await shot("01b-after-onboarding");
}

async function project() {
  await page.goto(`${BASE}/projects/new`);
  await shot("02-project-new");
  await page.fill("input[name=name]", "Fable Test Villa");
  await page.fill("input[name=clientName]", "Test Client");
  await page.fill("input[name=location]", "Dubai Marina");
  const budgetMax = page.locator("input[name=budgetMaxAed]");
  if (await budgetMax.count()) await budgetMax.fill("40000");
  await page.click("button[type=submit]");
  await page.waitForURL(/projects\/[0-9a-f-]{36}/, { timeout: 20000 });
  state.projectUrl = page.url();
  state.projectId = page.url().match(/projects\/([0-9a-f-]{36})/)?.[1];
  saveState();
  await shot("03-project-created");
}

async function room(roomType = "Living Room", name = "Family Living Room") {
  await page.goto(`${BASE}/projects/${state.projectId}/rooms/new`);
  await shot("04-room-new");
  await dismissDevOverlay();
  await page.check(`input[name=roomType][value="${roomType}"]`, { force: true });
  await page.fill("input[name=name]", name);
  await dismissDevOverlay();
  await page.click("button[type=submit]");
  await page.waitForURL(/rooms\/[0-9a-f-]{36}/, { timeout: 20000 });
  state.roomUrl = page.url();
  state.roomId = page.url().match(/rooms\/([0-9a-f-]{36})/)?.[1];
  saveState();
  await shot("05-room-created");
}

async function photos(files) {
  await page.goto(`${BASE}/projects/${state.projectId}/rooms/${state.roomId}/photos`);
  await shot("06-photos-page");
  for (const file of files) {
    const input = page.locator("input[type=file]").first();
    await input.setInputFiles(file);
    await page.waitForTimeout(4000);
    await shot(`07-photo-uploaded-${files.indexOf(file) + 1}`);
  }
}

async function briefStyle() {
  await page.goto(`${BASE}/projects/${state.projectId}/rooms/${state.roomId}/brief/style`);
  await dismissDevOverlay();
  await page.check('input[name=styleSlugs][value="contemporary"]', { force: true });
  await page.check('input[name=styleSlugs][value="scandinavian"]', { force: true });
  await page.click("button[type=submit]");
  await page.waitForURL(/brief\/inspiration/, { timeout: 20000 });
  await shot("09-brief-inspiration");
  fs.writeFileSync(`${SHOTS}09-brief-inspiration.html`, await page.content());
}

async function briefInspiration(imagePath) {
  await page.goto(`${BASE}/projects/${state.projectId}/rooms/${state.roomId}/brief/inspiration`);
  await dismissDevOverlay();
  if (imagePath) {
    await page.locator("input[type=file]").first().setInputFiles(imagePath);
    await page.waitForTimeout(5000);
  }
  await shot("09b-inspiration-uploaded");
  await page.click("button[type=submit]");
  await page.waitForURL(/brief\/details/, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot("10-brief-details");
  fs.writeFileSync(`${SHOTS}10-brief-details.html`, await page.content());
}

async function briefStep(name, fill = async () => {}) {
  await dismissDevOverlay();
  await fill();
  await shot(`10-before-submit-${name}`);
  await page.click("button[type=submit]");
  await page.waitForTimeout(4000);
  await shot(`11-after-${name}`);
  fs.writeFileSync(`${SHOTS}11-after-${name}.html`, await page.content());
}

async function inspect(path, name) {
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(1500);
  await shot(name);
  fs.writeFileSync(`${SHOTS}${name}.html`, await page.content());
}

const stage = process.argv[2];
try {
  if (stage === "login") await login();
  else if (stage === "onboarding") await onboarding();
  else if (stage === "project") await project();
  else if (stage === "room") await room(process.argv[3], process.argv[4]);
  else if (stage === "photos") await photos(process.argv.slice(3));
  else if (stage === "inspect") await inspect(process.argv[3], process.argv[4] ?? "inspect");
  else if (stage === "brief-style") await briefStyle();
  else if (stage === "brief-inspiration") await briefInspiration(process.argv[3]);
  else console.log("unknown stage");
} catch (error) {
  console.error("STAGE FAILED:", error.message);
  await shot("ZZ-failure");
  fs.writeFileSync(`${SHOTS}ZZ-failure.html`, await page.content());
  process.exitCode = 1;
} finally {
  await browser.close();
}
