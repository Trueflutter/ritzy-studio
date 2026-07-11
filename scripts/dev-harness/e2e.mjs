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

// Default local creds; overridden by state.email/state.password after a signup.
const EMAIL = state.email ?? "fable-test@ritzy.local";
const PASSWORD = state.password ?? "fable-test-passw0rd";

async function signup(emailArg, passwordArg) {
  // Hosted signup is gated to @ritzyinteriors.com (internal pilot). Fresh, labelled account.
  const email = emailArg ?? `fable-e2e-${Date.now()}@ritzyinteriors.com`;
  const password = passwordArg ?? `Fable-e2e-${Date.now()}!`;
  await page.goto(`${BASE}/login`);
  await dismissDevOverlay();
  // Switch to signup mode if the signup fields are not already shown.
  if ((await page.locator("#signup-email").count()) === 0) {
    await page.getByRole("button", { name: /create account/i }).first().click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.fill("#signup-name", "Fable E2E");
  await page.fill("#signup-email", email);
  await page.fill("#signup-password", password);
  await page.click("button[type=submit]:has-text('Create account')");
  await page.waitForTimeout(6000);
  state.email = email;
  state.password = password;
  state.signupLanded = page.url();
  saveState();
  await context.storageState({ path: AUTH_FILE });
  await shot("00-after-signup");
  console.log("signup:", email, "landed:", page.url());
}

async function login(emailArg, passwordArg) {
  await page.goto(`${BASE}/login`);
  await page.fill("#signin-email", emailArg ?? EMAIL);
  await page.fill("#signin-password", passwordArg ?? PASSWORD);
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
    // The upload is a client-side async call to Supabase storage + a row insert. Wait for the
    // "Room photo uploaded" confirmation, NOT a fixed timeout — closing the browser mid-upload
    // (as a short wait does) aborts the in-flight request and silently persists nothing.
    await page
      .getByText(/Room photo uploaded/i)
      .first()
      .waitFor({ state: "visible", timeout: 60000 });
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

async function briefDetails() {
  await page.goto(`${BASE}/projects/${state.projectId}/rooms/${state.roomId}/brief/details`);
  await dismissDevOverlay();
  const setIf = async (sel, val) => {
    const loc = page.locator(sel);
    if (await loc.count()) await loc.fill(val, { force: true }).catch(() => {});
  };
  await setIf("textarea[name=colorNotes]", "warm neutrals — ivory, camel, walnut, soft sage; matte finishes");
  await setIf("textarea[name=functionalRequirements]", "comfortable family seating for five, a quiet reading corner, generous soft textiles");
  await setIf("textarea[name=avoidNotes]", "avoid purple and bright red");
  await setIf("textarea[name=inspirationNotes]", "organic modern, textured neutral, gallery-calm");
  if (await page.locator("select[name=focalPoint]").count()) {
    await page.selectOption("select[name=focalPoint]", "view_window").catch(() => {});
  }
  if (await page.locator("select[name=seatingPriority]").count()) {
    await page.selectOption("select[name=seatingPriority]", "family_lounging").catch(() => {});
  }
  await setIf("input[name=mustKeepClear]", "keep the balcony door and window wall clear");
  await setIf("input[name=wallLengthCm]", "520");
  await setIf("input[name=roomDepthCm]", "420");
  await setIf("input[name=ceilingHeightCm]", "300");
  await shot("10a-brief-details-filled");
  fs.writeFileSync(`${SHOTS}10a-brief-details-filled.html`, await page.content());
  await page.click("button[type=submit]:has-text('Continue')");
  await page.waitForURL((u) => !u.pathname.endsWith("/brief/details"), { timeout: 60000 });
  await page.waitForTimeout(2000);
  state.afterDetailsUrl = page.url();
  saveState();
  await shot("10b-after-details");
  fs.writeFileSync(`${SHOTS}10b-after-details.html`, await page.content());
  console.log("after details ->", page.url());
}

async function briefQuestions(answer) {
  const reply =
    answer ??
    "Richer contemporary with layered natural textures, but kept calm and uncluttered. " +
      "Prioritise family comfort, warm neutrals, matte finishes and natural light. Timeless over trendy.";
  await page.goto(`${BASE}/projects/${state.projectId}/rooms/${state.roomId}/brief/questions/0`);
  for (let i = 0; i < 10; i++) {
    if (!/\/brief\/questions\//.test(page.url())) break;
    await dismissDevOverlay();
    const ta = page.locator("textarea[name=answer]");
    await ta.waitFor({ state: "visible", timeout: 20000 });
    await ta.fill(reply);
    const before = page.url();
    await page.click("button[type=submit]:has-text('Continue')");
    await page.waitForFunction((u) => location.href !== u, before, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    console.log("answered question, now ->", page.url());
  }
  state.afterQuestionsUrl = page.url();
  saveState();
  await shot("11-after-questions");
  fs.writeFileSync(`${SHOTS}11-after-questions.html`, await page.content());
  console.log("questions complete ->", page.url());
}

async function concept() {
  // ?autogenerate=1 makes the panel requestSubmit() generateInitialConceptAction on mount
  // (only when no hero concept exists yet). The action runs synchronously (~1-3 min incl. the
  // Gemini render via Evolink), so the browser must stay alive until the hero concept appears.
  await page.goto(`${BASE}/projects/${state.projectId}/rooms/${state.roomId}/concepts?autogenerate=1`, {
    waitUntil: "domcontentloaded"
  });
  await shot("12-concept-generating");
  // Wait for the hero concept: the "Proceed to sourcing" CTA only renders once a concept exists.
  const done = page.getByRole("button", { name: /Proceed to sourcing/i });
  const failed = page.getByText(/could not|failed|error/i);
  await Promise.race([
    done.first().waitFor({ state: "visible", timeout: 300000 }),
    failed.first().waitFor({ state: "visible", timeout: 300000 })
  ]).catch(() => {});
  await page.waitForTimeout(1500);
  state.conceptUrl = page.url();
  saveState();
  await shot("13-concept-ready");
  fs.writeFileSync(`${SHOTS}13-concept-ready.html`, await page.content());
  const hasCta = await done.count();
  console.log("concept stage done; hero present:", hasCta > 0, "url:", page.url());
}

async function sourcing() {
  // From the hero concept, "Proceed to sourcing" -> selectConceptAction -> /product-matching,
  // which runs catalogue sourcing/matching. Give it a long budget (AI sourcing + image preflight).
  await page.goto(`${BASE}/projects/${state.projectId}/rooms/${state.roomId}/concepts`, {
    waitUntil: "domcontentloaded"
  });
  await dismissDevOverlay();
  await page.getByRole("button", { name: /Proceed to sourcing/i }).first().click();
  await page.waitForURL(/product-matching/, { timeout: 120000 }).catch(() => {});
  // Sourcing runs as a background job (3-5 min) and the page is server-rendered, so poll by
  // reloading until the "sourcing usually takes ..." loading copy is gone and products appear.
  const matchingUrl = page.url();
  for (let i = 0; i < 24; i++) {
    const body = await page.evaluate(() => document.body.innerText);
    const stillSourcing = /Sourcing usually takes|Matching catalog products to your concept/i.test(body);
    const hasProducts = /Add to|Shopping list|AED\s?[0-9]|Selected|retailer/i.test(body) && !stillSourcing;
    console.log(`poll ${i}: sourcing=${stillSourcing} products=${hasProducts}`);
    if (hasProducts || !stillSourcing) break;
    await page.waitForTimeout(20000);
    await page.goto(matchingUrl, { waitUntil: "domcontentloaded" });
  }
  await page.waitForTimeout(2000);
  state.matchingUrl = page.url();
  saveState();
  await shot("14-product-matching");
  fs.writeFileSync(`${SHOTS}14-product-matching.html`, await page.content());
  console.log("sourcing/matching ->", page.url());
}

async function render() {
  // "Generate the grounded render" kicks off an in-request after() task (final render + spatial
  // QA). Click it; completion is polled separately from render_jobs (read-ai-job.mjs / poll).
  await page.goto(`${BASE}/projects/${state.projectId}/rooms/${state.roomId}/product-matching`, {
    waitUntil: "domcontentloaded"
  });
  await dismissDevOverlay();
  const btn = page.getByRole("button", { name: /Generate final render|Regenerate render/i });
  await btn.first().waitFor({ state: "visible", timeout: 20000 });
  await btn.first().click();
  await page.waitForTimeout(6000);
  await shot("16-render-triggered");
  console.log("final render triggered from", page.url());
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
  if (stage === "signup") await signup(process.argv[3], process.argv[4]);
  else if (stage === "login") await login(process.argv[3], process.argv[4]);
  else if (stage === "onboarding") await onboarding();
  else if (stage === "project") await project();
  else if (stage === "room") await room(process.argv[3], process.argv[4]);
  else if (stage === "photos") await photos(process.argv.slice(3));
  else if (stage === "inspect") await inspect(process.argv[3], process.argv[4] ?? "inspect");
  else if (stage === "brief-style") await briefStyle();
  else if (stage === "brief-inspiration") await briefInspiration(process.argv[3]);
  else if (stage === "brief-details") await briefDetails();
  else if (stage === "brief-questions") await briefQuestions(process.argv[3]);
  else if (stage === "concept") await concept();
  else if (stage === "sourcing") await sourcing();
  else if (stage === "render") await render();
  else console.log("unknown stage");
} catch (error) {
  console.error("STAGE FAILED:", error.message);
  await shot("ZZ-failure");
  fs.writeFileSync(`${SHOTS}ZZ-failure.html`, await page.content());
  process.exitCode = 1;
} finally {
  await browser.close();
}
