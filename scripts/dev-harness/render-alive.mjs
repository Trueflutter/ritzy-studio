// Clean final-render attempt: fail any stuck same-selection job (dedup blocks retries for 15 min),
// then trigger the render and KEEP THE BROWSER ALIVE on the presentation page (which polls) for the
// full render duration. Characterises whether the render engine works vs the after() task dying on
// client disconnect.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const env = fs.readFileSync("../../.env.local", "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const url = get("NEXT_PUBLIC_SUPABASE_URL"), svc = get("SUPABASE_SERVICE_ROLE_KEY");
const state = JSON.parse(fs.readFileSync("./e2e-state.json", "utf8"));
const h = { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" };

// 1) Fail any running/queued job for this room so the dedup guard does not block a fresh render.
const running = await (await fetch(url + `/rest/v1/render_jobs?room_id=eq.${state.roomId}&status=in.(running,queued)&select=id`, { headers: h })).json();
for (const j of running) {
  await fetch(url + `/rest/v1/render_jobs?id=eq.${j.id}`, { method: "PATCH", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", error_message: "manually failed for clean E2E retry" }) });
  console.log("failed stuck job", j.id.slice(0, 8));
}

const browser = await chromium.launch();
const page = await browser.newContext({ storageState: "auth.json" }).then((c) => c.newPage());
page.setDefaultTimeout(30000);
try {
  await page.goto(`${BASE}/projects/${state.projectId}/rooms/${state.roomId}/product-matching`, { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Escape");
  const btn = page.getByRole("button", { name: /Generate final render|Regenerate render/i });
  await btn.first().waitFor({ state: "visible" });
  await btn.first().click();
  // Follow the redirect to /presentation and STAY there (it polls the render job).
  await page.waitForURL(/presentation/, { timeout: 30000 }).catch(() => {});
  console.log("on:", page.url());
  // Keep the page alive; poll the DB for completion up to ~6 min.
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(18000);
    const j = (await (await fetch(url + `/rest/v1/render_jobs?room_id=eq.${state.roomId}&order=created_at.desc&limit=1&select=id,status,input_summary,output_asset_ids`, { headers: h })).json())[0];
    console.log(`poll ${i}: status=${j?.status} qa=${j?.input_summary?.spatialQaVerdict ?? "-"} assets=${(j?.output_asset_ids || []).length}`);
    if (j?.status === "succeeded" || j?.status === "failed") { console.log("DONE:", j.status); break; }
  }
  await page.screenshot({ path: "e2e-shots/17-final-render.png" });
} catch (e) {
  console.log("ERR:", e.message);
} finally {
  await browser.close();
}
