// Verify budget-with-quantity (item 1) and avoid-colour exclusion (item 3) on the real catalogue
// shopping list produced by the fresh matching run. Reads own test data only.
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const envText = fs.readFileSync(path.resolve(here, "../../.env.local"), "utf8");
const get = (k) => (envText.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const url = get("NEXT_PUBLIC_SUPABASE_URL");
const svc = get("SUPABASE_SERVICE_ROLE_KEY");
const state = JSON.parse(fs.readFileSync(new URL("./e2e-state.json", import.meta.url), "utf8"));
const h = { apikey: svc, Authorization: "Bearer " + svc };

const q = async (p) => (await fetch(`${url}/rest/v1/${p}`, { headers: h })).json();

// Project budget
const project = await q(`projects?id=eq.${state.projectId}&select=budget_max_aed,budget_min_aed`);
const budget = project[0]?.budget_max_aed ?? null;
console.log("project budget_max_aed:", budget);

// Design brief avoid_notes (source of avoid colours)
const room = await q(`rooms?id=eq.${state.roomId}&select=room_type`);
console.log("room_type:", room[0]?.room_type);
const briefs = await q(`design_briefs?room_id=eq.${state.roomId}&select=avoid_notes,color_notes&order=created_at.desc&limit=1`);
console.log("avoid_notes:", JSON.stringify(briefs[0]?.avoid_notes));

// Shopping list items (newest list for the room)
const lists = await q(`shopping_lists?room_id=eq.${state.roomId}&select=id,estimated_total_aed,created_at&order=created_at.desc&limit=1`);
const list = lists[0];
console.log("\nshopping_list:", list?.id, "estimated_total_aed:", list?.estimated_total_aed, "created:", list?.created_at);

const items = await q(
  `shopping_list_items?shopping_list_id=eq.${list.id}&select=status,role_label,quantity,unit_price_aed,line_total_aed,option_rank,product:products(name,color)&order=sort_order.asc`
);

const selected = items.filter((i) => i.status === "selected");
const options = items.filter((i) => i.status === "option");

// Item 1: qty-aware total of SELECTED items vs budget
const lineTotalSum = selected.reduce((t, i) => t + Number(i.line_total_aed ?? 0), 0);
const unitSum = selected.reduce((t, i) => t + Number(i.unit_price_aed ?? 0) * Number(i.quantity ?? 1), 0);
console.log("\n=== ITEM 1: BUDGET (line total, qty-aware) ===");
console.log("selected count:", selected.length);
for (const i of selected) {
  console.log(`  [${i.role_label}] ${i.product?.name} | qty ${i.quantity} x ${i.unit_price_aed} = ${i.line_total_aed}`);
}
console.log("SUM line_total_aed:", lineTotalSum, "| budget:", budget, "| within:", budget == null ? "n/a" : lineTotalSum <= budget);
console.log("(cross-check qty*unit sum:", unitSum, ")");

// Item 3: any option/selected whose colour is an avoid colour
const avoidTerms = String(briefs[0]?.avoid_notes ?? "").toLowerCase().match(/red|purple|orange|pink|yellow|green|blue|black/g) ?? [];
console.log("\n=== ITEM 3: AVOID-COLOUR EXCLUSION ===");
console.log("avoid terms detected in brief:", avoidTerms);
const offending = items.filter((i) => {
  const c = String(i.product?.color ?? i.product?.name ?? "").toLowerCase();
  // Word-boundary match so "red" does not falsely hit "sinteRED", "cREDenza", etc.
  return avoidTerms.some((t) => new RegExp(`\\b${t}\\b`, "i").test(c));
});
console.log("total option-pool items:", items.length, "| offending (avoid-colour present):", offending.length);
for (const o of offending) console.log(`  OFFENDER [${o.status}] ${o.product?.name} color=${o.product?.color}`);
if (offending.length === 0) console.log("PASS: no avoid-colour product survived in selected or alternates.");
