import assert from "node:assert/strict";

import { withTimeout } from "./with-timeout";

// Every deadline the anchored-concepts path adds runs through this one guard,
// and until it was pinned, replacing its whole body with `return await promise`
// left all 21 web suites green. The failure it exists to prevent is not subtle:
// a stalled retailer CDN on one candidate photograph runs the concept request
// past the route's maxDuration, the platform kills it with no catch path, the
// generation job is left "running", and the dedupe refuses the shopper a retry
// for fifteen minutes.

async function main() {
  // A promise that settles first wins, and the timer does not keep the process
  // alive afterwards: an uncleaned timer would hold a serverless invocation open
  // past the work it was measuring.
  assert.equal(await withTimeout(Promise.resolve("done"), 50, "too slow"), "done");
  await assert.rejects(
    withTimeout(Promise.reject(new Error("the work itself failed")), 50, "too slow"),
    /the work itself failed/,
    "the guard reports the work's own failure, not a timeout"
  );

  // Work that never settles is abandoned at the deadline, with the caller's
  // message, so the job record says which stage overran rather than "failed".
  const started = Date.now();
  await assert.rejects(withTimeout(new Promise(() => {}), 30, "the catalogue read overran"), /the catalogue read overran/);
  assert.ok(Date.now() - started >= 25, "and not before the deadline");

  // Slow but inside the deadline still succeeds.
  assert.equal(
    await withTimeout(new Promise((resolve) => setTimeout(() => resolve("late"), 20)), 200, "too slow"),
    "late"
  );

  console.log("with-timeout tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
