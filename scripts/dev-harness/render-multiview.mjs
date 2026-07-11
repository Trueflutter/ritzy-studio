// Verify the multi-angle FINAL render. Fails any stuck job, triggers a fresh render, and KEEPS THE
// BROWSER ALIVE on /presentation (the after() task — hero render + spatial QA + the extra camera
// angles — needs a live request). Polls render_jobs past hero success until the view assets are
// appended (output_asset_ids grows to 3) or the final_render_views ai_job reaches a terminal state.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
// Resolve paths from this script's location so it runs from any cwd (e.g. the repo root).
const DIR = path.dirname(new URL(import.meta.url).pathname);
const AUTH = path.join(DIR, "auth.json");
const SHOTS = path.join(DIR, "e2e-shots");
const env = fs.readFileSync(path.resolve(DIR, "../../.env.local"), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const url = get("NEXT_PUBLIC_SUPABASE_URL"), svc = get("SUPABASE_SERVICE_ROLE_KEY");
const state = JSON.parse(fs.readFileSync(path.join(DIR, "e2e-state.json"), "utf8"));
const h = { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" };
const q = async (p) => (await fetch(url + "/rest/v1/" + p, { headers: h })).json();

// Fail any running/queued render job so the dedup guard does not block a fresh render.
for (const j of await q(`render_jobs?room_id=eq.${state.roomId}&status=in.(running,queued)&select=id`)) {
  await fetch(url + `/rest/v1/render_jobs?id=eq.${j.id}`, {
    method: "PATCH",
    headers: { ...h, Prefer: "return=minimal" },
    body: JSON.stringify({ status: "failed", error_message: "manually failed for clean multiview E2E" })
  });
  console.log("failed stuck job", j.id.slice(0, 8));
}

const browser = await chromium.launch();
const page = await browser.newContext({ storageState: AUTH }).then((c) => c.newPage());
page.setDefaultTimeout(30000);
try {
  await page.goto(`${BASE}/projects/${state.projectId}/rooms/${state.roomId}/product-matching`, { waitUntil: "domcontentloaded" });
  await page.keyboard.press("Escape");
  const btn = page.getByRole("button", { name: /Generate final render|Regenerate render/i });
  await btn.first().waitFor({ state: "visible" });
  await btn.first().click();
  await page.waitForURL(/presentation/, { timeout: 30000 }).catch(() => {});
  console.log("on:", page.url());

  let heroDone = false;
  for (let i = 0; i < 26; i++) {
    await page.waitForTimeout(18000);
    const j = (await q(`render_jobs?room_id=eq.${state.roomId}&order=created_at.desc&limit=1&select=id,status,input_summary,output_asset_ids`))[0];
    const assets = (j?.output_asset_ids || []).length;
    const views = (await q(`ai_jobs?room_id=eq.${state.roomId}&job_type=eq.final_render_views&order=created_at.desc&limit=1&select=status,error_message`))[0];
    console.log(`poll ${i}: render=${j?.status} qa=${j?.input_summary?.spatialQaVerdict ?? "-"} assets=${assets} views_job=${views?.status ?? "-"}`);
    if (j?.status === "failed") { console.log("RENDER FAILED"); break; }
    if (j?.status === "succeeded") heroDone = true;
    // Done when views are appended (>=3 assets) or the views job reached a terminal state.
    if (heroDone && (assets >= 3 || views?.status === "succeeded" || views?.status === "failed")) {
      if (views?.error_message) console.log("views error:", views.error_message);
      console.log("DONE. final output_asset_ids:", assets);
      break;
    }
  }
  await page.screenshot({ path: path.join(SHOTS, "17-final-render-multiview.png"), fullPage: true });

  // Report the persisted final-render assets and their view keys.
  const assetIds = ((await q(`render_jobs?room_id=eq.${state.roomId}&order=created_at.desc&limit=1&select=output_asset_ids`))[0]?.output_asset_ids) || [];
  if (assetIds.length) {
    const inList = assetIds.map((id) => `"${id}"`).join(",");
    const rows = await q(`room_assets?id=in.(${inList})&select=id,asset_type,view_key,storage_path`);
    const ordered = assetIds.map((id) => rows.find((r) => r.id === id)).filter(Boolean);
    console.log("\nfinal_render assets (in output order):");
    for (const r of ordered) console.log(`  ${r.view_key ?? "(hero)"} — ${r.asset_type} — ${r.storage_path}`);
  }
} catch (e) {
  console.log("ERR:", e.message);
} finally {
  await browser.close();
}
