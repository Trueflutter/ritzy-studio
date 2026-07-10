// Create ONE pre-confirmed, clearly-labelled test account on the hosted Supabase the local
// dev app currently points at (hosted email confirmation is on, blocking UI signup auto-login).
// Reads URL + service-role from ../../.env.local. Prints only the test email + status; never keys.
import fs from "node:fs";
import path from "node:path";

const envText = fs.readFileSync(path.resolve(process.cwd(), "../../.env.local"), "utf8");
const get = (k) => {
  const m = envText.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
};
const url = get("NEXT_PUBLIC_SUPABASE_URL");
const svc = get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !svc) throw new Error("missing SUPABASE url/service-role in .env.local");
if (!/supabase\.co/.test(url)) throw new Error("SUPABASE_URL is not hosted: refusing (" + url + ")");

const email = `fable-e2e-${Date.now()}@ritzyinteriors.com`;
const password = `Fable-e2e-${Date.now()}!`;

const res = await fetch(url + "/auth/v1/admin/users", {
  method: "POST",
  headers: { apikey: svc, Authorization: "Bearer " + svc, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name: "Fable E2E" } })
});
const status = res.status;
const ok = res.ok;
let userId = null;
try { const j = await res.json(); userId = j.id ?? j.user?.id ?? null; if (!ok) console.log("error_code:", j.error_code || j.msg || j.error || "(unknown)"); } catch {}

console.log("status:", status, "ok:", ok);
console.log("email:", email);
console.log("user_id_present:", Boolean(userId));

if (ok) {
  const stateFile = path.resolve(process.cwd(), "e2e-state.json");
  const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : {};
  state.email = email;
  state.password = password;
  state.userId = userId;
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log("saved creds to e2e-state.json");
}
