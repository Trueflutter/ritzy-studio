import assert from "node:assert/strict";

import { assertLiveIngestionAllowed, parseArgs, resolveAdapterForCli } from "./cli";

const panHomeByShortKey = resolveAdapterForCli("panhome");
const panHomeByDashedKey = resolveAdapterForCli("pan-home");
const panHomeByAdapterKey = resolveAdapterForCli("panhome-ae");
const homesRusByShortKey = resolveAdapterForCli("homesrus");
const homesRusByDashedKey = resolveAdapterForCli("homes-r-us");
const homesRusByAdapterKey = resolveAdapterForCli("homesrus-ae");
const ikeaByShortKey = resolveAdapterForCli("ikea");
const ikeaByDashedKey = resolveAdapterForCli("ikea-uae");
const ikeaByAdapterKey = resolveAdapterForCli("ikea-uae");
const marinaHomeByShortKey = resolveAdapterForCli("marinahome");
const marinaHomeByDashedKey = resolveAdapterForCli("marina-home");
const marinaHomeByAdapterKey = resolveAdapterForCli("marinahome-ae");

assert.equal(panHomeByShortKey?.key, "panhome-ae");
assert.equal(panHomeByDashedKey?.key, "panhome-ae");
assert.equal(panHomeByAdapterKey?.key, "panhome-ae");
assert.equal(homesRusByShortKey?.key, "homesrus-ae");
assert.equal(homesRusByDashedKey?.key, "homesrus-ae");
assert.equal(homesRusByAdapterKey?.key, "homesrus-ae");
assert.equal(ikeaByShortKey?.key, "ikea-uae");
assert.equal(ikeaByDashedKey?.key, "ikea-uae");
assert.equal(ikeaByAdapterKey?.key, "ikea-uae");
assert.equal(marinaHomeByShortKey?.key, "marinahome-ae");
assert.equal(marinaHomeByDashedKey?.key, "marinahome-ae");
assert.equal(marinaHomeByAdapterKey?.key, "marinahome-ae");
assert.deepEqual(parseArgs(["pan-home", "--dry-run", "--limit=3"]), {
  adapterKey: "pan-home",
  dryRun: true,
  limit: 3
});
assert.deepEqual(parseArgs(["homes-r-us", "--dry-run", "--limit=2"]), {
  adapterKey: "homes-r-us",
  dryRun: true,
  limit: 2
});
assert.deepEqual(parseArgs(["ikea", "--dry-run", "--limit=2"]), {
  adapterKey: "ikea",
  dryRun: true,
  limit: 2
});
assert.deepEqual(parseArgs(["marina-home", "--dry-run", "--limit=3"]), {
  adapterKey: "marina-home",
  dryRun: true,
  limit: 3
});

assert.throws(
  () => assertLiveIngestionAllowed(panHomeByShortKey!),
  /panhome-ae is dry-run-only/
);
assert.throws(
  () => assertLiveIngestionAllowed(homesRusByShortKey!),
  /homesrus-ae is dry-run-only/
);
assert.throws(
  () => assertLiveIngestionAllowed(ikeaByShortKey!),
  /ikea-uae is dry-run-only/
);
assert.throws(
  () => assertLiveIngestionAllowed(marinaHomeByShortKey!),
  /marinahome-ae is dry-run-only/
);

const homeCentre = resolveAdapterForCli("homecentre");
assert.doesNotThrow(() => assertLiveIngestionAllowed(homeCentre!));

console.log("ingestion cli tests passed");
