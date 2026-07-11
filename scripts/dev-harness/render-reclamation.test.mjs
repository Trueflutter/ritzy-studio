// Regression test for the render stale-job reclamation race (PR #314 / Codex P1).
//
// Sequence:
//   1. Job A is inserted `running` and its after() task starts.
//   2. A goes stale; the retry path reclaims it via a compare-and-swap (running -> failed).
//   3. A's slow after() task FINALLY finishes and tries to record success.
// The success write must be guarded on `status = running`, so step 3 updates 0 rows and does NOT
// resurrect the reclaimed job. Also asserts the positive control (a still-running job DOES complete).
//
// Integration test — runs against whatever Supabase .env.local points at. Run: `node render-reclamation.test.mjs`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const env = fs.readFileSync(path.resolve(here, "../../.env.local"), "utf8");
const get = (k) => (env.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const url = get("NEXT_PUBLIC_SUPABASE_URL");
const svc = get("SUPABASE_SERVICE_ROLE_KEY");
const h = { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" };

const rest = async (method, pathAndQuery, body, prefer) => {
  const res = await fetch(url + "/rest/v1/" + pathAndQuery, {
    method,
    headers: prefer ? { ...h, Prefer: prefer } : h,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  return { status: res.status, rows: text ? JSON.parse(text) : [] };
};

// Find a valid (room_id, concept_id, shopping_list_id) triple to satisfy render_jobs FKs.
const lists = (await rest("GET", "shopping_lists?select=id,room_id&limit=20")).rows;
let triple = null;
for (const l of lists) {
  const concept = (await rest("GET", `concepts?room_id=eq.${l.room_id}&select=id&limit=1`)).rows[0];
  if (concept) { triple = { room_id: l.room_id, concept_id: concept.id, shopping_list_id: l.id }; break; }
}
if (!triple) {
  console.log("render-reclamation.test.mjs: SKIP — no room with a concept + shopping list in this DB.");
  process.exit(0);
}

const insertRunning = async (selectionKey) =>
  (await rest("POST", "render_jobs", { ...triple, status: "running", input_summary: { selectionKey } }, "return=representation")).rows[0];
const guardedComplete = (id) =>
  rest("PATCH", `render_jobs?id=eq.${id}&status=in.(running)`, { status: "succeeded", output_asset_ids: [] }, "return=representation");
const reclaim = (id) =>
  rest("PATCH", `render_jobs?id=eq.${id}&status=in.(running,queued)`, { status: "failed", error_message: "reclaimed as stale" }, "return=representation");
const statusOf = async (id) => (await rest("GET", `render_jobs?id=eq.${id}&select=status`)).rows[0]?.status;
const cleanup = (id) => rest("DELETE", `render_jobs?id=eq.${id}`);

const created = [];
try {
  // --- Race case: reclaim, THEN the old task tries to complete ---
  const a = await insertRunning("RECLAIM-RACE-A");
  created.push(a.id);
  const reclaimed = await reclaim(a.id);
  assert.equal(reclaimed.rows.length, 1, "retry should win the reclamation CAS");
  assert.equal(await statusOf(a.id), "failed", "job should be failed after reclamation");

  const lateComplete = await guardedComplete(a.id);
  assert.equal(lateComplete.rows.length, 0, "guarded completion must NOT resurrect a reclaimed job");
  assert.equal(await statusOf(a.id), "failed", "reclaimed job must stay failed, not become succeeded");

  // --- Positive control: a still-running job DOES complete ---
  const b = await insertRunning("RECLAIM-RACE-B");
  created.push(b.id);
  const okComplete = await guardedComplete(b.id);
  assert.equal(okComplete.rows.length, 1, "a still-running job should complete normally");
  assert.equal(await statusOf(b.id), "succeeded", "running job should become succeeded");

  console.log("render-reclamation.test.mjs: all assertions passed");
} finally {
  for (const id of created) await cleanup(id);
}
