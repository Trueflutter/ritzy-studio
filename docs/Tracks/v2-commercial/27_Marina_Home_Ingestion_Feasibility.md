# 27 Marina Home Ingestion Feasibility

Status: docs-only routing placeholder. This file does not approve crawler execution, adapter implementation, live catalog writes, production flags, DB/schema changes, runtime coupling, or request-volume widening.

## Purpose

Assess whether Marina Home UAE should become the next dry-run-only Catalog Ingestion adapter after IKEA UAE.

## Questions To Answer

- What is the canonical Marina Home UAE host and market path?
- Are there clean UAE category URLs and clean UAE product URLs?
- What does `robots.txt` allow or disallow for candidate public surfaces?
- Are search, filter, query, cart, account, checkout, private API, or auth-only paths required? If yes, stop.
- Does public static HTML or safely visible page data expose name, canonical URL, SKU/code, AED price, sale price, availability, image URLs, category, dimensions, color, material, and freshness?
- Is a low-volume dry-run-only adapter feasible without bypassing access controls or relying on broad crawling?

## Stop Rules

Stop and recommend deferral if feasibility requires private APIs, auth-only access, search/filter/query URLs, cart/account/checkout paths, broad crawling, access-control bypasses, live writes, Product Matching runtime coupling, or Catalog-First runtime coupling.
