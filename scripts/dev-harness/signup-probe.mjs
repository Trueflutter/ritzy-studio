// Throwaway probe: sign up a fresh @ritzyinteriors.com test account against whatever
// backend the local dev app currently points at, and report where it lands + any message.
// Answers: does hosted Supabase require email confirmation (would block auto-login)?
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const ts = Date.now();
const email = `fable-e2e-${ts}@ritzyinteriors.com`;
const password = `Fable-e2e-${ts}!`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(30000);

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  // switch to signup mode (tab labelled "New user" / aria "Create account"); needs hydration
  const tab = page.getByRole("tab", { name: /create account/i });
  await tab.waitFor({ state: "visible" });
  await tab.click();
  await page.locator("#signup-email").waitFor({ state: "visible", timeout: 10000 });
  await page.fill("#signup-name", "Fable E2E");
  await page.fill("#signup-email", email);
  await page.fill("#signup-password", password);
  await page.click("button[type=submit]:has-text('Create account')");
  await page.waitForTimeout(6000);
  const url = page.url();
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600));
  const msg = new URL(url).searchParams.get("message");
  console.log("EMAIL:", email);
  console.log("LANDED_URL:", url);
  console.log("QUERY_MESSAGE:", msg || "(none)");
  console.log("LOGGED_IN:", !url.includes("/login"));
  console.log("BODY_SNIPPET:", bodyText.replace(/\s+/g, " ").slice(0, 300));
  fs.writeFileSync(new URL(".", import.meta.url).pathname + "signup-probe-creds.json", JSON.stringify({ email, password, url }, null, 2));
} catch (e) {
  console.error("PROBE_FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
