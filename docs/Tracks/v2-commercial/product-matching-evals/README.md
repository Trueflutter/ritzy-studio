# Product Matching Eval Harness

## Purpose

The executable Product Matching Engine evals live in `packages/domain/src/product-matching-evals.ts`.

They are deterministic domain fixtures for role-scoped retrieval, attribute scoring, eligibility gates, and scorecard metadata. The docs here explain how to run and read them, but the typed fixture file is the source of truth.

## Run

```bash
pnpm --filter @ritzy-studio/domain test
pnpm --filter @ritzy-studio/domain typecheck
```

The domain test runs every scenario through `runProductMatchingEvalScenario`, which calls `buildProductSourcingRuntimePlan` with the Product Matching Engine enabled.

## Scenario Coverage

The current harness covers:

- living room beige/cream linen sofa over olive velvet sofa
- living room TV media console over generic bookcase storage
- dining chairs over bulky lounge armchairs
- dining sideboard/credenza over generic shelving
- bedroom bed and paired bedside-table required roles
- explicit missing required bedroom role metadata
- home office desk, office chair, storage, and task lighting
- living room paired accent seating quantity
- sofa eligibility gates for unavailable, missing-image, and over-budget candidates
- dining room anchor set for table, chairs, and over-table lighting

## Scorecard

Each eval result includes a deterministic 1-5 scorecard for:

- category correctness
- color fidelity
- material fidelity
- quantity correctness
- price and stock trust
- role coverage
- overall trust

These scores summarize the existing domain matcher output. They do not create another ranking algorithm.

`summarizeProductMatchingEvalResults` aggregates already-computed scenario results into suite-level pass/fail counts and average scorecard values. It is reporting-only and does not change scenario pass criteria or score calculations.

## Deferred Dimensions

The harness intentionally does not score:

- product image visual fidelity beyond structured color/material/role tags
- AI explanation quality
- final shopping-list copy
- manual visual inspection of real catalog images

Those remain part of local/manual QA with `RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED=true` and inspection of `ai_jobs` rows as described in `PR_E_Runtime_Rollout_QA.md`.

## Pass Criteria

An eval passes when:

- required roles listed in the scenario have candidates unless the scenario is explicitly testing missing-role metadata
- expected top candidates match stable IDs for surgical regressions
- broader scenarios choose from an allowed stable-ID set
- disallowed candidate IDs are absent from the role pool
- expected rejection reasons appear with at least the expected count
- role quantities match expectations

## NOT in This Harness

- no AI prompt changes
- no visual arbitration changes
- no UI changes
- no runtime flag enablement
- no database migrations
- no package-level eval CLI
