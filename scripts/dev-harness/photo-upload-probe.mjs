// Upload a room photo and capture the exact failure (on-page message, console, storage network).
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const state = JSON.parse(fs.readFileSync(new URL("./e2e-state.json", import.meta.url), "utf8"));
const IMG = process.argv[2];
const photosUrl = `${BASE}/projects/${state.projectId}/rooms/${state.roomId}/photos`;

const browser = await chromium.launch();
const context = await browser.newContext({ storageState: "auth.json" });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
const storageResponses = [];
page.on("response", async (r) => {
  const u = r.url();
  if (u.includes("/storage/v1/") || u.includes("/rest/v1/room_assets")) {
    let body = "";
    if (!r.ok()) { try { body = (await r.text()).slice(0, 200); } catch {} }
    storageResponses.push(`${r.status()} ${r.request().method()} ${u.replace(/https:\/\/[^/]+/, "")}${body ? " :: " + body : ""}`);
  }
});

try {
  await page.goto(photosUrl, { waitUntil: "networkidle" });
  await page.locator("input[type=file]").first().setInputFiles(IMG);
  // wait for status to settle (complete or error)
  await page.waitForTimeout(12000);
  const msg = await page.evaluate(() => document.body.innerText).catch(() => "");
  const statusLine = (msg.match(/Room photo uploaded|Uploading photo[^\n]*|.*(error|failed|denied|not allowed|violates)[^\n]*/i) || [])[0] || "(no status text found)";
  console.log("PAGE_STATUS:", statusLine.slice(0, 160));
  console.log("CONSOLE_ERRORS:", consoleErrors.length ? consoleErrors.join(" | ") : "(none)");
  console.log("STORAGE/REST_RESPONSES:");
  for (const l of storageResponses) console.log("  ", l);
} catch (e) {
  console.log("PROBE_FAILED:", e.message);
} finally {
  await browser.close();
}
