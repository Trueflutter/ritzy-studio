# 05 Retailer Partnership And Attribution

## Purpose

Define how Ritzy Studio should work with retailers, ingest SKU data cleanly, unlock shopping links, attribute traffic, and manage partner discounts.

## Retailer Data Ask

For each retailer, request:

- product feed or API
- SKU ID
- product name
- category
- price
- sale price
- currency
- product URL
- product images
- dimensions
- material
- color
- availability
- delivery notes
- category taxonomy
- image usage permission
- affiliate/deep-link format
- discount-code support
- conversion reporting method

## Commercial Ask

Ask retailers for one or more:

- affiliate commission
- CPA bounty
- CPC fee
- exclusive customer discount
- unique code pool
- auto-discount deep links
- monthly reporting

## Attribution Model

Every unlocked product link should point first to Ritzy:

`/r/{signedClickToken}`

The redirect endpoint:

1. Validates token.
2. Validates user entitlement.
3. Records outbound click.
4. Assigns or attaches discount metadata if eligible.
5. Builds retailer destination URL.
6. Redirects to retailer.

## Coupon Leakage Risk

Global public codes are easy to leak.

Preferred controls:

- single-use codes
- user/room-specific codes
- short expiry
- usage caps
- auto-discount links
- retailer-side validation
- conversion reporting by code and click

If a retailer only supports a public code, document that leakage is accepted by the retailer.

## Discount UX Rules

- Show discount only for eligible retailers/products.
- Show terms and expiry.
- Do not imply all products qualify.
- If no discount exists, show product link without discount messaging.

## Reporting

Internal report exports should include:

- retailer
- product
- SKU
- room type
- user mode
- click timestamp
- discount code
- unlock/subscription status
- conversion status if known
- gross sale if reported
- commission if reported

Privacy:

- minimize direct personal data
- hash or omit sensitive identifiers in retailer exports unless contractually required

## Retailer Outreach Positioning

Ritzy gives retailers:

- high-intent room-level demand
- full-room basket creation
- measurable SKU-level traffic
- discount-controlled conversion path
- insight into styles, categories, and budgets users want

Ritzy asks retailers for:

- clean SKU data
- attribution support
- conversion reporting
- discount mechanism
- image usage rights for shopping lists and product-grounded render references

## Open Retailer Questions

- Can the retailer generate single-use discount codes?
- Can the retailer accept auto-discount links?
- Can attribution parameters survive to checkout?
- Can the retailer report conversions by click ID or coupon code?
- Are product images licensed for use in AI-assisted room concepts?
- How frequently can inventory/price feed refresh?
- Are UAE-specific prices and stock available?

## Active Planned Ingestion Coverage

- Pan Home UAE: planned dry-run-only adapter coverage via UAE sitemap/product URLs. Live catalog writes remain blocked pending separate approval.
- Homes r Us UAE: planned dry-run-only adapter coverage via tiny clean category seeds. Live catalog writes remain blocked pending separate approval; query URLs and `/catalog/` paths remain disallowed, and `Crawl-delay: 10` applies.
