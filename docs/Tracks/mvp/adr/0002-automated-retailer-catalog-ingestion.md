# ADR 0002: Automated Retailer Catalog Ingestion

## Status

Accepted.

## Context

The app's value depends on short-circuiting manual product search. A designer-facing workflow where the user manually finds products and uploads links or CSV files defeats the product goal.

Retailer data access varies by source. Some retailers expose product sitemaps and structured data. Others require partnerships or should be deferred.

## Decision

Implement automated catalog ingestion through a retailer adapter pattern.

Adapters may use:

- approved feeds
- affiliate feeds
- product sitemaps
- public product pages
- structured data
- search providers where appropriate

Adapters must record compliance notes, source confidence, field confidence, and freshness.

## Consequences

Positive:

- The designer does not manually build the product catalog.
- Retailer-specific logic stays isolated.
- Future feeds and partnerships can replace public-page extraction.

Negative:

- Public-page adapters may be brittle.
- Legal/compliance review is required per retailer.
- Product freshness must be managed.

## Guardrails

- No aggressive crawling.
- Respect robots.txt and public terms.
- Defer sources that block crawling unless approved access exists.
- Admin-only imports are allowed for testing but not as user workflow.
