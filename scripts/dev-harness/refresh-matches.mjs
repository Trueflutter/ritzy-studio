// Force a fresh catalogue matching run (groundProductsAction) against the real catalogue,
// without regenerating the concept. Clicks "Refresh matches" on the product-matching page and
// waits for the new shopping list to render. Used to exercise new matching code on real data.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const DIR = new URL(".", import.meta.url).pathname;
const state = JSON.parse(fs.readFileSync(DIR + "e2e-state.json", "utf8"));
const AUTH = DIR + "auth.json";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  storageState: fs.existsSync(AUTH) ? AUTH : undefined
});
const page = await context.newPage();
page.setDefaultTimeout(30000);

const matchingUrl = `${BASE}/projects/${state.projectId}/rooms/${state.roomId}/product-matching`;
await page.goto(matchingUrl, { waitUntil: "domcontentloaded" });
await page.keyboard.press("Escape").catch(() => {});
await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));

const before = await page.evaluate(() => document.body.innerText.slice(0, 200));
console.log("navigated to product-matching; clicking Refresh matches...");
await page.getByRole("button", { name: /Refresh matches/i }).first().click();

// groundProductsAction runs synchronously (AI sourcing + preflight), then redirects back to the
// matching page. Wait for navigation to settle, then poll for the refreshed list.
await page.waitForLoadState("networkidle", { timeout: 300000 }).catch(() => {});
for (let i = 0; i < 18; i++) {
  const body = await page.evaluate(() => document.body.innerText);
  const stillSourcing = /Sourcing usually takes|Matching catalog products|Refreshing matches/i.test(body);
  const hasProducts = /AED\s?[0-9]/i.test(body) && !stillSourcing;
  console.log(`poll ${i}: url=${page.url().split("/").slice(-1)[0]} sourcing=${stillSourcing} products=${hasProducts}`);
  if (hasProducts) break;
  await page.waitForTimeout(15000);
  await page.goto(matchingUrl, { waitUntil: "domcontentloaded" });
}
await page.screenshot({ path: DIR + "e2e-shots/refresh-matches.png", fullPage: true });
console.log("refresh-matches done ->", page.url());
await browser.close();
