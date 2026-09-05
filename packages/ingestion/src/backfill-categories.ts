// Re-derives category_normalized for catalogue rows that have none.
//
// Two separate causes put 585 usable products outside every role query, and one
// operation fixes both, because both are "run today's normaliser over rows that
// an older one left behind":
//
//   152 rows carry a category the CURRENT map already understands ("End
//       Tables", "Pendants", "Living Room Chandeliers"). They were ingested
//       before those needles existed and nothing has re-derived them since.
//   433 rows needed the needles added alongside this script, and they are
//       exactly the styling stock a finished room needs: decor was the
//       thinnest category in the catalogue at 111 products while 233 candle
//       holders, figurines, bowls, trays, clocks and lanterns sat invisible.
//
// Safety. This only ever fills a NULL, and only when the normaliser produces a
// value. It never overwrites a category that is already set, never clears one,
// never deletes a row, and touches no other column. Re-running it is a no-op.
// That matters: `products` is shared with production and is additive-only.
//
// A second, narrower job shares this script because it is the same operation:
// --stale re-derives rows whose stored category DISAGREES with today's map.
// `category_normalized` is a cache of a pure function of `category_raw`, so
// re-deriving it corrects a stale cache rather than destroying authored data.
// It found 52 chandeliers and ceramic table lamps filed as `beds` (their
// retailer category is "Bedroom Chandeliers", and an older map ordering matched
// "bed" before "chandelier"), plus 7 canvas wall-art pieces filed as `decor`.
// That is 14% of the `beds` category answering bed-role queries with lighting.
//
// --stale never blanks a category: a row is only rewritten when the resolver
// produces a DIFFERENT, non-null value.
//
// Usage, from the repo root:
//   pnpm --filter @ritzy-studio/ingestion backfill:categories
//   pnpm --filter @ritzy-studio/ingestion backfill:categories -- --apply
//   pnpm --filter @ritzy-studio/ingestion backfill:categories -- --stale
//   pnpm --filter @ritzy-studio/ingestion backfill:categories -- --stale --apply
//
// Without --apply it reports exactly what it would write, and writes nothing.

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@ritzy-studio/db";

import { categoryFor, normalizeCategory } from "./normalization";

// PostgREST answers with at most 1,000 rows however large a limit asks for, so
// the read pages. Ordered by id, because paging on a non-unique sort silently
// repeats and skips rows.
const PAGE_SIZE = 1000;

type Row = { id: string; name: string; category_raw: string | null; category_normalized?: string | null };

// Rows whose stored category disagrees with what today's resolver derives.
async function restaleRows(
  supabase: ReturnType<typeof createClient<Database>>,
  apply: boolean
) {
  const rows: Row[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category_raw, category_normalized")
      .not("category_normalized", "is", null)
      .order("id", { ascending: true })
      .range(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const stale = rows.flatMap((row) => {
    const derived = categoryFor(row.category_raw, row.name);
    // Never blank a category. A row the resolver no longer recognises keeps
    // whatever it has; only a different, positive answer rewrites one.
    if (!derived || derived === row.category_normalized) return [];
    return [{ id: row.id, from: row.category_normalized ?? "(none)", to: derived }];
  });

  const pairs = new Map<string, number>();
  for (const entry of stale) pairs.set(`${entry.from} -> ${entry.to}`, (pairs.get(`${entry.from} -> ${entry.to}`) ?? 0) + 1);
  console.log(`categorised rows read: ${rows.length}`);
  console.log(`stale against today's map: ${stale.length}\n`);
  for (const [pair, count] of [...pairs].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${pair}`);
  }

  if (!apply) {
    console.log("\nDRY RUN. Nothing written. Add --apply to write.");
    return;
  }
  let written = 0;
  for (const entry of stale) {
    const { error } = await supabase
      .from("products")
      .update({ category_normalized: entry.to })
      .eq("id", entry.id)
      .eq("category_normalized", entry.from);
    if (error) throw new Error(`${entry.id}: ${error.message}`);
    written += 1;
  }
  console.log(`\nrewrote ${written} stale categories.`);
}

function loadEnv() {
  for (const path of [".env.local", "../../.env.local", "apps/web/.env.local"]) {
    try {
      process.loadEnvFile(path);
    } catch {
      // Absent or unreadable: the next candidate, or the explicit check below.
    }
  }
}

export async function backfillCategories({ apply }: { apply: boolean }) {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const rows: Row[] = [];
  for (;;) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category_raw")
      .is("category_normalized", null)
      .order("id", { ascending: true })
      .range(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const resolved: Array<{ id: string; category: string; viaName: boolean }> = [];
  const unresolved = new Map<string, number>();

  for (const row of rows) {
    // One shared resolver with ingestion, so a backfilled row and a freshly
    // ingested one always agree, including about what stays unmapped.
    const fromCategory = normalizeCategory(row.category_raw);
    const category = categoryFor(row.category_raw, row.name);
    if (!category) {
      const label = row.category_raw ?? "(no retailer category; name did not resolve)";
      unresolved.set(label, (unresolved.get(label) ?? 0) + 1);
      continue;
    }
    resolved.push({ id: row.id, category, viaName: !fromCategory });
  }

  const byCategory = new Map<string, number>();
  for (const entry of resolved) byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + 1);

  console.log(`uncategorised rows read: ${rows.length}`);
  console.log(
    `resolvable: ${resolved.length} (${resolved.filter((entry) => entry.viaName).length} via the name fallback)`
  );
  console.log(`left alone: ${rows.length - resolved.length}\n`);
  console.log("would set:");
  for (const [category, count] of [...byCategory].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${category}`);
  }
  console.log("\nstill unresolved, by retailer label:");
  for (const [label, count] of [...unresolved].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(count).padStart(4)}  ${label}`);
  }

  if (!apply) {
    console.log("\nDRY RUN. Nothing written. Re-run with --apply to write.");
    return { read: rows.length, resolved: resolved.length, written: 0 };
  }

  let written = 0;
  for (const entry of resolved) {
    // Filtered on NULL as well as id: if anything set a category between the
    // read and this write, that value wins and this update matches nothing.
    const { error } = await supabase
      .from("products")
      .update({ category_normalized: entry.category })
      .eq("id", entry.id)
      .is("category_normalized", null);
    if (error) throw new Error(`${entry.id}: ${error.message}`);
    written += 1;
    if (written % 100 === 0) console.log(`  ${written}/${resolved.length}`);
  }
  console.log(`\nwrote ${written} categories.`);
  return { read: rows.length, resolved: resolved.length, written };
}

const applyFlag = process.argv.includes("--apply");
const run = process.argv.includes("--stale")
  ? (async () => {
      loadEnv();
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
      return restaleRows(
        createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
        applyFlag
      );
    })()
  : backfillCategories({ apply: applyFlag });

run.catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
