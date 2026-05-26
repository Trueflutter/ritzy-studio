# Catalog Ingestion Agent Comms

## Current PR
PR #156: https://github.com/Trueflutter/ritzy-studio/pull/156

Branch: `codex/catalog-ingestion-crate-barrel-feasibility`

Touched files:
- `docs/Tracks/v2-commercial/28_Crate_And_Barrel_UAE_Category_Discovery_Feasibility.md`
- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`

Runtime impact: none / docs-only

## Current stage
`APPROVED_DOCS_ONLY_CRATE_AND_BARREL_UAE_CATEGORY_DISCOVERY_FEASIBILITY`

## Blockers
Live ingestion remains blocked.

Do not perform live catalog writes, remove `dryRunOnly`, widen request volume, use private APIs, use auth-only paths, use checkout/cart/account/search/filter/query URLs, use Magento `/catalog/...` paths, change DB/schema/generated types, change UI/runtime/app actions, change prompts, change payment/checkout behavior, enable production flags, deploy, couple to Product Matching runtime, or couple to Catalog-First runtime without a separate explicit approval.

Preserve Homes r Us `Crawl-delay: 10`.

## Chief Architect Routing
ARCHITECT_NOTE:
Lane: Catalog Ingestion
Current PR: PR #155 updates this mailbox after PR #154 merge
Current stage: `APPROVED_DOCS_ONLY_CRATE_AND_BARREL_UAE_CATEGORY_DISCOVERY_FEASIBILITY`
What is complete: Pan Home, Homes r Us, IKEA UAE, and Marina Home now have dry-run-only adapter coverage. Live ingestion remains blocked by `dryRunOnly` plus CLI/runner guards.
Decision: After PR #155 merges, start the next small safe stage: a docs-only Crate & Barrel UAE category discovery feasibility PR.

Approved next stage:
`APPROVED_DOCS_ONLY_CRATE_AND_BARREL_UAE_CATEGORY_DISCOVERY_FEASIBILITY`

Scope for the next stage:

1. Branch from latest `main`; suggested branch `codex/catalog-ingestion-crate-barrel-feasibility`.
2. Create or update a docs-only feasibility note for Crate & Barrel UAE (`https://www.crateandbarrel.me/en-ae`) focused on category discovery, robots/terms posture, public product-page parseability, URL allow/reject rules, and whether a later dry-run-only adapter spike is safe.
3. Use only read-only public research and saved notes. Do not run crawler-scale discovery, do not implement an adapter, and do not fetch broad category/product sets beyond a tiny manually bounded check.
4. Confirm or reject clean category discovery paths before any adapter work. Existing research says product pages are rich but category discovery needs a deeper pass; that is the next question.
5. Preserve live-ingestion blockers: no live catalog writes, no `dryRunOnly` removal, no private APIs, no auth-only paths, no checkout/cart/account/search/filter/query URLs, no Magento/internal paths, no DB/schema/generated type changes, no UI/runtime/app-action changes, no prompts/payment/checkout changes, no production flags/deploys, no Product Matching runtime coupling, and no Catalog-First runtime coupling.
6. Keep the Catalog Ingestion heartbeat active after merge and monitor this mailbox plus PR comments; do not delete the lane monitor just because PR-specific work closes.

Why Crate & Barrel: the existing UAE retailer feasibility docs rank it as the next P1 after already-covered P0/P1 retailers, with strong product detail pages but unresolved category discovery. Home Box remains a no-go for direct ingestion from prior Cloudflare 403 findings, and West Elm/Pottery Barn need partner/network verification before technical ingestion.

## Last Action Taken
Started the routed Crate & Barrel UAE docs-only category discovery feasibility stage from latest `main`.

The feasibility note records a tiny manually bounded public check. It found promising clean category and product URL shapes through public index evidence, but direct `robots.txt` and storefront fetches timed out from this environment, so robots posture and clean category fetchability remain unresolved gates before any adapter work.

## Next Intended Action
Open the Crate & Barrel UAE docs-only feasibility PR, leave an `ARCHITECT_NOTE:` with PR URL, branch, head commit, files touched, verification, and hard-stop confirmation, then wait for Chief Architect review.

Do not start live ingestion, controlled preview, adapter implementation, broad discovery, production flag, deploy, runtime coupling, or write path from this approval.

## Heartbeat
Keep the Catalog Ingestion heartbeat active while the lane is routed or awaiting routing. With no open active PR, the heartbeat should monitor:

- `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md`
- recent PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`
- the active Crate & Barrel UAE feasibility PR once opened
- follow-up PR comments beginning `ARCHITECT_NOTE:` or `CHIEF_ARCHITECT_REPLY:`

If the feasibility PR is rejected, fix only listed docs blockers. If it is approved and explicitly approved to merge, merge only if runtime impact remains none/docs-only and no hard stop was crossed.
