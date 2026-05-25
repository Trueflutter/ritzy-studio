import assert from "node:assert/strict";

import { panHomeAdapter } from "./adapters/panhome";
import { runCatalogIngestion } from "./runner";

await assert.rejects(
  () =>
    runCatalogIngestion({
      adapter: panHomeAdapter,
      supabase: {} as never,
      limit: 1
    }),
  /panhome-ae is dry-run-only/
);

console.log("runner tests passed");
