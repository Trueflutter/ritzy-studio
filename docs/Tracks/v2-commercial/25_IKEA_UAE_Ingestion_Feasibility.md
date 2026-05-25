# 25 IKEA UAE Ingestion Feasibility

## Purpose

This is a docs-only feasibility placeholder for assessing whether IKEA UAE should become the next dry-run-only retailer adapter after Pan Home and Homes r Us.

This file does not approve crawler execution, adapter implementation, live catalog writes, production flags, DB/schema changes, runtime coupling, or request-volume widening.

## Questions To Answer

- What is the canonical IKEA UAE host and market path?
- Are there clean UAE category URLs and clean UAE product URLs?
- What does `robots.txt` allow or disallow for the candidate public surfaces?
- Are search, filter, query, cart, account, checkout, private API, or auth-only paths required? If yes, stop.
- Does public static HTML or safely visible page data expose name, canonical URL, SKU/code, AED price, sale price, availability, image URLs, category, dimensions, color, material, and freshness?
- Is a low-volume dry-run-only adapter feasible without bypassing access controls or relying on broad crawling?

## Required Output For The Feasibility PR

- canonical host and accepted URL shapes
- rejected URL/path patterns
- robots/terms notes and request pacing recommendation
- source-surface summary
- likely parser field coverage
- known gaps and null-preserving rules
- go/no-go recommendation for a future dry-run-only adapter PR
- explicit confirmation that no crawler execution, adapter implementation, live writes, or runtime coupling occurred

## Stop Rules

Stop and recommend deferral if feasibility requires:

- private APIs or auth-only access
- search/filter/query URLs
- cart, checkout, account, or customer paths
- `/catalog/` or equivalent internal storefront paths
- high-volume crawling
- access-control bypasses
- live catalog writes
- Product Matching or Catalog-First runtime coupling
