import assert from "node:assert/strict";

import { classifyCatalogTimestampFreshness } from "./product-matching-freshness";

const nowMs = Date.parse("2026-05-22T12:00:00.000Z");

assert.deepEqual(
  classifyCatalogTimestampFreshness({
    lastCheckedAt: "2026-05-21T12:00:00.000Z",
    nowMs
  }),
  {
    catalogFreshnessStatus: "fresh",
    checkedAt: "2026-05-21T12:00:00.000Z",
    ageDays: 1,
    thresholdDays: 7
  }
);

assert.equal(
  classifyCatalogTimestampFreshness({
    lastCheckedAt: "2026-05-15T12:00:00.000Z",
    nowMs
  }).catalogFreshnessStatus,
  "fresh"
);
assert.equal(
  classifyCatalogTimestampFreshness({
    lastCheckedAt: "2026-05-15T11:59:59.000Z",
    nowMs
  }).catalogFreshnessStatus,
  "stale"
);

assert.deepEqual(
  classifyCatalogTimestampFreshness({
    lastCheckedAt: null,
    nowMs
  }),
  {
    catalogFreshnessStatus: "missing",
    checkedAt: null,
    ageDays: null,
    thresholdDays: 7
  }
);

assert.deepEqual(
  classifyCatalogTimestampFreshness({
    lastCheckedAt: "not-a-date",
    nowMs
  }),
  {
    catalogFreshnessStatus: "invalid",
    checkedAt: "not-a-date",
    ageDays: null,
    thresholdDays: 7
  }
);

assert.equal(
  classifyCatalogTimestampFreshness({
    lastCheckedAt: "2026-05-20T12:00:00.000Z",
    nowMs,
    thresholdDays: 1
  }).catalogFreshnessStatus,
  "stale"
);

console.log("product matching freshness tests passed");
