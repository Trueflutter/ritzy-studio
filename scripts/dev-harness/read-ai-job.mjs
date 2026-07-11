// Read the latest ai_jobs diagnostics for the E2E test room (non-PII, own test data).
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const envText = fs.readFileSync(path.resolve(here, "../../.env.local"), "utf8");
const get = (k) => (envText.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const url = get("NEXT_PUBLIC_SUPABASE_URL");
const svc = get("SUPABASE_SERVICE_ROLE_KEY");
const state = JSON.parse(fs.readFileSync(new URL("./e2e-state.json", import.meta.url), "utf8"));
const roomId = process.argv[2] || state.roomId;

const res = await fetch(
  `${url}/rest/v1/ai_jobs?room_id=eq.${roomId}&order=created_at.desc&limit=3&select=job_type,status,error_message,input_summary,output_summary,created_at`,
  { headers: { apikey: svc, Authorization: "Bearer " + svc } }
);
console.log("status:", res.status);
const rows = await res.json();
for (const r of rows) {
  console.log("\n===", r.job_type, r.status, r.created_at, "===");
  if (r.error_message) console.log("error:", r.error_message);
  const g = r.input_summary?.catalogueGrounding ?? r.output_summary?.catalogueGrounding;
  if (r.input_summary?.blockers) console.log("blockers:", JSON.stringify(r.input_summary.blockers, null, 2));
  if (g) console.log("catalogueGrounding:", JSON.stringify(g, null, 2));
}
