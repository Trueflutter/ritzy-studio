# 04 Pricing And Entitlements

## Pricing

### Homeowner

Target price:

- `AED 100 per room unlock`

Free or freemium access:

- upload room photos
- complete guided style/preferences flow
- generate initial concept
- see shopping-list preview
- see estimated total
- generate the final product-grounded render as the value reveal

Paid room unlock:

- exact retailer shopping links
- eligible retailer discount code or auto-discount link
- export/shareable shopping list
- product substitution within defined limits

### Designer

Target price:

- `USD 99/month`

Subscription includes:

- professional project/client workflow
- concept generation
- product matching
- product substitutions
- final renders
- presentations
- tracked retailer links
- eligible partner discounts

Usage limits are not locked yet.

Options:

- unlimited with fair-use monitoring
- monthly room/render credits
- subscription plus overage credits

Recommendation for V2:

- start with `USD 99/month` and generous fair-use limits
- monitor AI cost per designer account
- add explicit credits only if cost demands it

## Entitlement Matrix

| User state | Concept generation | Shopping preview | Raw retailer link | Discount code | Final grounded render |
| --- | --- | --- | --- | --- | --- |
| Signed-out | No | No | No | No | No |
| Homeowner free | Yes, limited | Yes, preview only | No | No | Yes |
| Homeowner room unlocked | Yes | Yes | Yes, tracked | Yes, if eligible | Yes |
| Designer inactive subscription | Limited/account screen | No or existing only | No | No | No |
| Designer active subscription | Yes | Yes | Yes, tracked | Yes, if eligible | Yes |
| Admin/test | Yes | Yes | Yes, tracked where possible | Test only | Yes |

## Paywall Rules

- Never expose raw retailer product URLs to users without entitlement.
- Do not rely on client-side hiding for paid links.
- Paywall should explain what is unlocked in concrete terms.
- Avoid deceptive previews.
- Do not promise discounts for retailers without active campaigns.

## Homeowner Unlock UX

The upgrade screen should answer:

- What am I paying for?
- Is this per room?
- What products will I unlock?
- Do I get discounts?
- Can I still edit products?
- What happens if a product goes out of stock?

Recommended copy posture:

> Generate the final shopping list for AED 100 to reveal retailer links, product details, and eligible partner discounts.

Avoid:

> Guaranteed 5% off everywhere.

The final render is the pre-paywall value reveal. Payment begins when a homeowner asks to generate the final shopping list after seeing the rendered room and estimated furniture total.

## Designer Subscription UX

Designer subscription should be positioned as a professional workspace, not just link unlock.

Core value:

- client projects
- multiple rooms
- product-grounded renders
- shopping lists
- presentations
- retailer partner discounts

## Refund And Expiry Rules

To define before implementation:

- homeowner room unlock refund window
- whether unlocked links expire
- whether discount codes expire
- what happens when designer subscription is cancelled
- access to historical presentations after cancellation

## Billing Provider Requirements

The provider must support:

- AED one-time payments
- USD subscriptions
- webhook events
- test mode
- customer portal or cancellation flow
- server-side checkout sessions
- metadata for `user_id`, `room_id`, and `mode`

Provider choice is deferred.
