# RE-001 Local Retest Follow-Through

Date: 2026-06-01

Status: passed for product/catalogue sourcing success; performance remains a beta risk.

## Scope

RE-001 retested the product/catalogue sourcing path after PR #200 merged the bounded deterministic text fallback for Product Sourcing timeouts.

The retest used latest `origin/main` at `668b88d`, including PR #200 merge commit `9313ca6d8c422932c87eb59e1f0c33e9faea7fd1`.

## Evidence

- Branch/worktree: `codex/re001-local-retest-followthrough`
- PR comment: <https://github.com/Trueflutter/ritzy-studio/pull/200#issuecomment-4589235314>
- Local server: `http://localhost:3004`
- Project: `4207ade6-2604-4e15-9b05-ffa77531d3d2`
- Room: `75e18e73-cf69-4b2e-b192-009fbc135b38`
- Concept: `d9cc2f82-6d8f-455c-8c8d-e08522e0938c`
- Action result: `303` redirect to shopping list
- `ai_jobs.id`: `540fb2d7-a3f4-47fc-9c85-d36033b8823e`
- Job type: `product_visual_sourcing`
- Status: `succeeded`
- Runtime from row timestamps: `45043ms`
- Request elapsed: `52025ms`
- Model: `gpt-5-mini`
- `productMatchingEngineEnabled`: `false`
- `productSourcingTextFallbackUsed`: `true`
- `productSourcingTextFallbackReason`: `initial_visual_sourcing_timeout`
- `productSourcingTimeoutDiagnostics.isolationReason`: `visual_sourcing_timeout_text_fallback`
- `productImagePreflight`: 35 accepted, 1 rejected unsupported extension
- `productImagePreflightGate.usable`: `true`
- `providerImageDownloadFailure`: `null`
- Shopping list: `99062356-7a63-4438-bd4b-461cc43c66ba`
- Shopping-list result: 30 item rows, 5 selected rows

## Readout

This clears the RE-001 stale retest blocker: product/catalogue sourcing can complete through the existing local app path after PR #200.

The path still waited about 45 seconds before using deterministic text fallback. For the Wednesday beta launch, treat that as a performance and user-experience risk rather than a sourcing correctness failure.

No DB/schema/generated type changes, deploy, Product Matching controlled-preview/config/allowlist changes, catalog writes, payment/checkout changes, UI redesign, prompt/schema changes, or Catalog-First coupling were performed.

## Next Boundary

No further RE-001 work is routed by this note.

If Sam/Chief wants to reduce the beta risk, route a fresh exact timeout/performance boundary focused on the 45s visual-sourcing timeout and fallback latency.
