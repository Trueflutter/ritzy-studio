# 06 Latency And Cost Budget

## Purpose

Ritzy Studio uses AI generation, image processing, embeddings, and retailer ingestion. This document prevents slow or expensive implementation from being accepted merely because it works.

## UX Latency Targets

### Immediate UI Interactions

Target: under 150ms perceived response.

Applies to:

- navigation
- opening drawers
- selecting products
- changing filters
- switching tabs

### Standard Data Fetch

Target: under 1.5s for cached data.

Applies to:

- project list
- room detail
- saved concepts
- product search over indexed catalog

### Uploads

Target: show progress immediately.

Large images may take longer, but the UI must show state within 300ms.

### AI Concept Generation

Target: asynchronous job with visible progress.

The UI must not block. The user should see generation state and may leave/return.

### Product Grounding

Target: under 10s for indexed catalog search; longer work must be a background job.

### Retailer Ingestion

Target: background only.

Never run broad ingestion in a user request/response path.

## Cost Guardrails

### Concept Generation

Generate a bounded number of images per request. Default: 3 initial concepts unless changed in the feature list.

### Iterations

Each critique should generate a bounded number of variations. Default: 1 to 2.

### Product Enrichment

Batch and cache enrichment. Reuse embeddings and tags unless source content changes.

### Image References

Use product images selectively in final grounded renders. Do not pass an unbounded product list to image generation.

## Required Cost Tracking

Each AI job should store:

- provider
- model
- job type
- input size summary
- output size summary
- estimated cost when available
- created/completed timestamps

## Retry Rules

- Retry transient failures with capped attempts.
- Do not retry image generation endlessly.
- Surface failures with a recovery CTA.
- Record failed job metadata.

## Budget Risks

- Image generation can dominate cost.
- Re-enriching full catalogs is expensive.
- Product image embeddings can grow quickly.
- Final render attempts can multiply if designer critique loops are unconstrained.

## MVP Controls

- Require explicit user action for generation.
- Cache catalog enrichment.
- Store prompt versions and source hashes.
- Use background jobs for long work.
- Add admin-visible job logs before scaling ingestion.
