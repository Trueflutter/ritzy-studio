import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@ritzy-studio/db";

import { homeCentreAdapter } from "./adapters/homecentre";
import { categoryCounts } from "./catalog-counts";
import { normalizeProductCandidate } from "./normalization";
import { runCatalogIngestion } from "./runner";
import type { CatalogAdapter, CatalogSupabaseClient } from "./types";

type CliOptions = {
  adapterKey: string;
  dryRun: boolean;
  limit?: number;
};

const adapters = new Map<string, CatalogAdapter>([
  ["homecentre", homeCentreAdapter],
  [homeCentreAdapter.key, homeCentreAdapter]
]);

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  if (process.env.INIT_CWD) {
    loadEnvFile(resolve(process.env.INIT_CWD, ".env.local"));
  }
  loadEnvFile(".env.local");
  loadEnvFile("../../.env.local");
  loadEnvFile("apps/web/.env.local");

  const options = parseArgs(process.argv.slice(2));
  const adapter = adapters.get(options.adapterKey);

  if (!adapter) {
    throw new Error(`Unknown adapter "${options.adapterKey}". Available: ${Array.from(adapters.keys()).join(", ")}`);
  }

  if (options.dryRun) {
    const summary = await dryRunCatalog(adapter, options.limit ?? 24);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const supabase = createSupabaseClient();
  const before = await categoryCounts(supabase, adapter.key);
  let lastProgressLogAt = 0;
  const result = await runCatalogIngestion({
    adapter,
    supabase,
    limit: options.limit,
    onProgress: (progress) => {
      if (progress.products_seen - lastProgressLogAt < 25 && progress.products_failed === 0) {
        return;
      }

      lastProgressLogAt = progress.products_seen;
      console.error(
        [
          `ingestion progress: ${progress.products_seen} seen`,
          `${progress.products_created} created`,
          `${progress.products_updated} updated`,
          `${progress.products_failed} failed`
        ].join(" · ")
      );
    }
  });
  const after = await categoryCounts(supabase, adapter.key);

  console.log(
    JSON.stringify(
      {
        adapter: adapter.key,
        limit: options.limit ?? null,
        result,
        categoryCounts: {
          before,
          after
        }
      },
      null,
      2
    )
  );
}

function parseArgs(args: string[]): CliOptions {
  const adapterKey = args.find((arg) => !arg.startsWith("--")) ?? "homecentre";
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error("--limit must be a positive integer.");
  }

  return {
    adapterKey,
    dryRun: args.includes("--dry-run"),
    limit
  };
}

async function dryRunCatalog(adapter: CatalogAdapter, limit: number) {
  const categoryCounts = new Map<string, number>();
  const samples: Array<{
    name: string;
    categoryRaw: string | null;
    categoryNormalized: string | null;
    priceAed: number | null;
    availability: string | null;
  }> = [];
  let seen = 0;
  let failed = 0;

  const discoveries = await adapter.discoverProducts({ limit });
  for await (const discovery of discoveries) {
    if (seen >= limit) {
      break;
    }

    seen += 1;

    try {
      const normalized = normalizeProductCandidate(await adapter.extractProduct(discovery));
      const category = normalized.product.category_normalized ?? "uncategorized";
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);

      if (samples.length < 12) {
        samples.push({
          name: normalized.product.name,
          categoryRaw: normalized.product.category_raw,
          categoryNormalized: normalized.product.category_normalized,
          priceAed: normalized.product.sale_price_aed ?? normalized.product.price_aed,
          availability: normalized.product.availability
        });
      }
    } catch {
      failed += 1;
    }
  }

  return {
    adapter: adapter.key,
    mode: "dry-run",
    seen,
    failed,
    categoryCounts: Object.fromEntries([...categoryCounts.entries()].sort()),
    samples
  };
}

function createSupabaseClient(): CatalogSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for live ingestion.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function loadEnvFile(path: string) {
  const absolutePath = resolve(process.cwd(), path);
  if (!existsSync(absolutePath)) {
    return;
  }

  const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}
