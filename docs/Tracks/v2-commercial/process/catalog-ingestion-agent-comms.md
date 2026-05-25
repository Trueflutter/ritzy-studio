# Catalog Ingestion Agent Comms

## Current PR
None. PR #124 merged Pan Home dry-run ingestion adapter.

## Current stage
APPROVED_DRY_RUN_RETAILER_ADAPTER_NEXT_STAGE.

## Blockers
Live ingestion remains blocked. Do not perform live catalog writes, DB/schema changes, generated DB type changes, production flags, deploys, payment/checkout changes, UI changes, Product Matching runtime coupling, Catalog-First runtime coupling, or broad crawler execution without explicit approval.

## Chief architect routing
ARCHITECT_NOTE: Start the next retailer ingestion stage with Homes r Us as a dry-run-only adapter/planning PR.

Scope:
- Branch from latest `main`; suggested branch `codex/homesrus-ingestion-dry-run`.
- Add a dry-run-only Homes r Us adapter or, if discovery proves too uncertain, a docs+fixture spike that captures the blocking evidence.
- Keep discovery to public, clean category/product URLs. Respect the known Homes r Us robots constraints: `Crawl-delay: 10`, no query/parameter URLs, and no `/catalog/` paths.
- Prefer a tiny category seed set and a low dry-run limit.
- Reuse the existing ingestion adapter/CLI/test patterns from Home Centre, Danube, 2XL, Chattels, and Pan Home.
- Include parser/unit tests with saved fixture HTML or deterministic sample parsing.
- Include one dry-run verification command that proves the adapter can see a small number of products without writes.

Stop rules:
- If the site blocks clean public discovery, requires query URLs, requires `/catalog/` paths, requires authenticated/private APIs, requires high crawl volume, or would need live writes, stop and report findings instead of forcing an adapter.
- If adding Homes r Us requires changing shared ingestion schema, Supabase migrations, generated DB types, Product Matching runtime, UI, app actions, production config, or deploy behavior, stop and ask Chief Architect.

## Last action taken
PR #124 added Pan Home dry-run ingestion adapter and was merged at `7438d0a`.

## Next intended action
Catalog ingestion agent: start Homes r Us dry-run-only work from latest `main`, open a small PR, and report PR URL/head/checks back to Chief Architect.

## Durable next-state handoff after merge
After Homes r Us dry-run-only PR is opened, keep live ingestion blocked until a separate explicit approval removes the dry-run-only guardrails.
