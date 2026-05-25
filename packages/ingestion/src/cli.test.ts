import assert from "node:assert/strict";

import { assertLiveIngestionAllowed, parseArgs, resolveAdapterForCli } from "./cli";

const panHomeByShortKey = resolveAdapterForCli("panhome");
const panHomeByDashedKey = resolveAdapterForCli("pan-home");
const panHomeByAdapterKey = resolveAdapterForCli("panhome-ae");

assert.equal(panHomeByShortKey?.key, "panhome-ae");
assert.equal(panHomeByDashedKey?.key, "panhome-ae");
assert.equal(panHomeByAdapterKey?.key, "panhome-ae");
assert.deepEqual(parseArgs(["pan-home", "--dry-run", "--limit=3"]), {
  adapterKey: "pan-home",
  dryRun: true,
  limit: 3
});

assert.throws(
  () => assertLiveIngestionAllowed(panHomeByShortKey!),
  /panhome-ae is dry-run-only/
);

const homeCentre = resolveAdapterForCli("homecentre");
assert.doesNotThrow(() => assertLiveIngestionAllowed(homeCentre!));

console.log("ingestion cli tests passed");
