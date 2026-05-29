import assert from "node:assert/strict";

import { buildProductSourcingTimeoutDiagnostics } from "./product-sourcing-timeout-diagnostics";

const base = {
  attemptDurationMs: 45_023,
  timeoutMs: 45_000,
  candidateCount: 24,
  rolePoolCount: 8,
  conceptImageDetail: "low" as const,
  candidateImageLimit: 0,
  productCandidateImagesEnabled: true
};

const timeoutFallback = buildProductSourcingTimeoutDiagnostics({
  ...base,
  timedOut: true,
  fallbackUsed: true,
  fallbackReason: "initial_visual_sourcing_timeout"
});

assert.equal(timeoutFallback.attemptKind, "initial_visual_sourcing");
assert.equal(timeoutFallback.fallbackSourcePath, "text_fallback");
assert.equal(timeoutFallback.fallbackReason, "initial_visual_sourcing_timeout");
assert.equal(timeoutFallback.isolationReason, "visual_sourcing_timeout_text_fallback");
assert.equal(timeoutFallback.canDistinguishTimeoutFromSemanticQuality, true);
assert.equal(timeoutFallback.retry.attempted, false);

const visualSuccess = buildProductSourcingTimeoutDiagnostics({
  ...base,
  attemptDurationMs: 12_000,
  timedOut: false,
  fallbackUsed: false,
  fallbackReason: null
});

assert.equal(visualSuccess.fallbackSourcePath, "visual");
assert.equal(visualSuccess.fallbackReason, "none");
assert.equal(visualSuccess.isolationReason, "visual_sourcing_completed");
assert.equal(visualSuccess.canDistinguishTimeoutFromSemanticQuality, true);

const retryTimeout = buildProductSourcingTimeoutDiagnostics({
  ...base,
  attemptDurationMs: 9_000,
  timedOut: false,
  fallbackUsed: false,
  fallbackReason: null,
  retry: {
    attempted: true,
    attemptDurationMs: 45_111,
    timedOut: true,
    fallbackUsed: false,
    fallbackReason: "retry_visual_sourcing_timeout",
    providerImageDownloadFailure: false,
    imageGateUsable: true
  }
});

assert.equal(retryTimeout.isolationReason, "retry_visual_sourcing_timeout");
assert.equal(retryTimeout.retry.attempted, true);
assert.equal(retryTimeout.retry.fallbackReason, "retry_visual_sourcing_timeout");
assert.equal(retryTimeout.retry.imageGateUsable, true);
