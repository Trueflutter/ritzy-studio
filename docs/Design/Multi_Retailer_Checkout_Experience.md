# Multi-Retailer Checkout Experience

## Goal

When Ritzy sources across multiple retailers, the shopping-list experience should make the purchase path feel organized, trustworthy, and retailer-aware. We should not imply a single universal cart until a retailer integration actually supports it.

## Recommended MVP

Group selected products by retailer after the user unlocks the shopping list.

Each retailer group should show:

- Retailer name.
- Number of selected items.
- Retailer subtotal.
- Stock freshness, using `last_checked_at`.
- The selected products from that retailer.
- A single retailer-level CTA, for example `View Danube Home Items`.

The total room estimate remains visible above the retailer groups, but every line item with `role_quantity > 1` must show both unit price and line total so dining chairs, lamps, cushions, and paired armchairs do not feel misleading.

## Customer Flow

1. User sees the final rendered room.
2. User chooses `Generate Shopping List`.
3. User unlocks the shopping list.
4. Shopping list opens with a room total and retailer-grouped sections.
5. User can open each retailer group to buy that retailer's items.

## Near-Term Checkout Handoff

Until formal partner APIs are available, use safe retailer handoff links:

- Product detail links for each selected item.
- Retailer-grouped subtotals.
- Clear stock freshness labels.
- No hidden discount promise unless the retailer has approved it.

## Partner Integration Target

For retailers that can support deeper integration, ask for one of these paths in order:

1. Hosted cart or checkout deep link that accepts SKU, quantity, and approved discount/campaign token.
2. Add-to-cart API with scoped partner credentials.
3. Affiliate/tracking links plus visible or auto-applied code.
4. Product feed only, with manual customer checkout as fallback.

The safest partner ask is a checkout/cart handoff that only accepts public SKU IDs, quantities, and a scoped campaign code. Ritzy should never need customer retailer credentials or privileged inventory/admin access.

## Not Now

- Do not build a single Ritzy-owned universal cart until retailer commercial terms and integration support are clear.
- Do not hide retailer names after unlock.
- Do not show stale items as confidently in stock.
- Do not run live retailer ingestion without a dry-run summary and approval.
