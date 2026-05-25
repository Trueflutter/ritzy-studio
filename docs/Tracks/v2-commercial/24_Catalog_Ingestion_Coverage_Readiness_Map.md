# 24 Catalog Ingestion Coverage Readiness Map

## Purpose

This is a docs-only routing artifact for the Catalog Ingestion lane. It gives the ingestion agent a safe next stage after Pan Home and Homes r Us dry-run coverage, without approving live catalog writes or runtime coupling.

## Current Coverage Snapshot

The repository currently has dry-run-capable ingestion adapters for:

- Home Centre
- Chattels
- Danube Home
- 2XL
- Pan Home
- Homes r Us

Pan Home and Homes r Us are explicitly dry-run-only. Their live ingestion paths must stay blocked until a separate approval removes the `dryRunOnly` guard and confirms scope, request limits, write boundaries, evidence artifacts, rollback rules, and owner.

## Readiness Dimensions

For each retailer, the coverage/readiness PR should record:

- canonical source surfaces and accepted URL shapes
- robots/terms constraints and request pacing
- discovery strategy, including whether sitemap, category seed, or manual seed is used
- parser field coverage for name, URL, SKU, AED price, sale price, availability, images, category, dimensions, color, material, and freshness
- known gaps, especially missing static fields, noisy storefront scripts, category normalization limits, and null-preserving behavior
- dry-run command and minimum verification evidence
- live-ingestion status, which remains blocked unless explicitly approved

## Known Active Guardrails

- Do not remove `dryRunOnly` for Pan Home or Homes r Us.
- Do not run broad crawls or live writes.
- Do not use private APIs, auth-only paths, checkout/cart/account/search/filter/query URLs, or `/catalog/` paths.
- Preserve Homes r Us `Crawl-delay: 10` and low-volume dry-run behavior.
- Do not change DB/schema/generated types, UI/runtime/app actions, prompts, payment/checkout, production flags, deploys, Product Matching runtime coupling, or Catalog-First runtime coupling.

## Next-Retailer Decision Slot

Pan Home and Homes r Us are complete for dry-run-only adapter coverage. The next retailer should be selected by Chief Architect/Sam before implementation starts.

The coverage/readiness PR should include a short recommendation matrix for the next candidate, including source availability, UAE relevance, robots/terms risk, static parser feasibility, category value, and whether a dry-run adapter can be implemented without widening crawler behavior.

## Required Handoff

When the coverage/readiness PR opens, update `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md` with:

- PR URL
- branch
- head commit
- touched files
- explicit confirmation that no crawler execution, live writes, runtime coupling, or guardrail removal occurred
- recommended next safe stage after the PR merges
