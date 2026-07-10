# Home Centre UAE Retailer Integration Brief

Date: 2026-05-21  
Prepared for: Sam / Ritzy Studio partner meetings  
Retailer: Home Centre / Homecentre UAE  
Primary site checked: https://www.homecentre.com/ae/en/

## Executive Summary

Home Centre UAE is a realistic first partner for Ritzy Studio because its site already supports the core customer behavior Ritzy needs: product deep links, visible SKU-like product IDs, add-to-basket before sign-in, cart persistence in the current browser session, a guest-checkout path, voucher entry, and a retailer-hosted checkout flow.

The safest V1 ask is not marketplace ordering. Ritzy should ask Home Centre for either:

1. a partner-tracked deep-link program with a manual or hidden promo code, or
2. a retailer-hosted cart/checkout session API that accepts SKU, quantity, campaign/partner ID, optional room/project metadata, and optional promo entitlement, then returns a Home Centre cart or checkout URL.

The public site shows Home Centre has internal cart APIs and offer-code APIs, but those are not partner-ready public APIs. Sam should not imply Ritzy can use those directly. The meeting ask should be framed as: "Can your technical/product team expose a safe partner endpoint or signed cart link using the same checkout that already exists?"

## Evidence Sources Checked

Observed pages:

- Product detail page: https://www.homecentre.com/ae/en/buy-rubik-3-seater-fabric-sofa/p/166839119
- Cart page after adding item: https://www.homecentre.com/ae/en/cart
- Sign-in checkpoint after clicking checkout: https://www.homecentre.com/auth/login?client_id=homecentre_ae
- Guest checkout page: https://www.homecentre.com/ae/en/quickCheckout

Representative product observed:

- Product: Rubik 3-Seater Fabric Sofa
- Public product ID in URL: `166839119`
- Product state SKU: `166839119-HC06062024`
- Variant SKU: `166839119`
- Internal product ID observed in page state: `01J0MSC9PWCB3J0TR6C3WV0WJX`
- Price shown on PDP/cart during inspection: AED 1,489 sale price, AED 1,999 crossed-out base price

Inspection method:

- Normal customer-facing browser journey: PDP -> Add to Basket -> View Basket -> Checkout Now -> guest checkout.
- Static page and JavaScript bundle inspection by fetching the same public PDP and its Next.js assets.
- No login, no payment details, no address submission, no checkout submission, and no aggressive scraping.

## Confirmed Site Behavior

### Product deep links and IDs

Confirmed:

- Product URLs are stable enough for V1 deep linking. The same product resolved through both:
  - `/ae/en/buy-rubik-3-seater-fabric-sofa/p/166839119`
  - `/ae/en/buy-rubik-3-seater-fabric-sofa-166839119-HC06062024/p/166839119`
- Product ID is visible in the URL: `166839119`.
- Product page structured data exposes Product schema with name, image, brand, availability, price currency, and offer URL.
- Page state exposes richer product identifiers:
  - parent/product SKU: `166839119-HC06062024`
  - variant SKU: `166839119`
  - internal product ID: `01J0MSC9PWCB3J0TR6C3WV0WJX`
  - variant internal ID: `01K6P1NP263SE31PVMA3BY1S6H`

Implication:

- Ritzy can store the public product URL and the visible SKU/product ID immediately.
- For a real cart-prefill/API integration, Home Centre should confirm which identifier they want from partners: public SKU, variant SKU, parent SKU, product ID, or internal SKU reference.

### Add to cart before login

Confirmed:

- The PDP showed a normal `Add to Basket` button while signed out.
- Clicking it as an anonymous user produced a success modal: "Successfully Added To Your Basket" with "Continue Shopping" and "View Basket."
- The header basket count changed to `1`.

Implication:

- Home Centre already supports anonymous cart creation.
- This is helpful for partner flow design because account creation is not a prerequisite for cart creation.

### Cart persistence before account creation

Confirmed:

- After adding anonymously, the cart page showed the item without sign-in.
- The same session retained the item when navigating from PDP to cart and then into checkout/guest checkout.

Not fully confirmed:

- I did not test long-term persistence after closing the browser, cross-device persistence, or account merge after later sign-in.

Meeting ask:

- Ask how long anonymous carts persist, whether anonymous carts merge into accounts after login, and whether partner-created carts can be recovered by cart ID/token.

### Guest checkout

Confirmed:

- Clicking `Checkout Now` on the cart routed to a sign-in page.
- That sign-in page explicitly offered `Checkout As A Guest`.
- Opening guest checkout showed a full checkout form with shipping address, delivery date/time, payment methods, Promos & Vouchers, gift-card option, and order summary.

Implication:

- Home Centre can keep payment, account, shipping, delivery, fulfillment, returns, and customer support fully inside its own checkout.
- Ritzy does not need to handle credentials, card data, or payment gateway integrations.

### Discount / promo code entry

Confirmed:

- Cart page includes `Promos & Vouchers` and `View Promos / Enter Voucher Code`.
- Guest checkout page also includes `Promos & Vouchers` and `View Promos / Enter Voucher Code`.
- Guest checkout says gift cards can be used there.
- Public JS bundle contains cart client behavior for `addOfferCodeToCart`, mapped to `POST /cart/{cartId}/offer-codes` through `/api/cart-operations`.

Not confirmed:

- I did not apply a real code.
- I did not find visible customer-facing evidence that promo codes can be pre-applied from a URL parameter.
- I did not find evidence of a documented public partner coupon URL format.

Implication:

- Manual code entry is definitely supportable.
- Hidden server-side application of a partner code is likely feasible for Home Centre internally, but must be confirmed by their team.

### Cart / checkout APIs visible in public assets

Confirmed from public JavaScript bundle inspection:

- The site is a Next.js/react frontend using internal API routes under paths such as:
  - `/api/cart-operations`
  - `/api/cart-operations/cart/`
  - `/api/cart-operations/checkout/`
  - `/api/cart-operations/cart/{cartId}/checkout/start-checkout/{fulfillmentRef}`
  - `/api/catalog-browse/product/`
  - `/api/catalog-browse/products/sku?productSkus=`
  - `/api/inventory/shop-sku-inventory/availability-with-details?skuFieldType=SKU_CODE&skuFieldReferences=`
  - `/api/delivery/product/delivery-estimate/`
- The bundled cart client includes methods equivalent to:
  - create cart
  - resolve cart
  - get cart
  - add item to cart
  - add many items to cart
  - add offer code to cart
  - remove offer code from cart
  - start checkout
- The frontend references `api2.landmarkgroup.com`, `api3.landmarkgroup.com`, and first-party Home Centre hosts.

Important caution:

- These are internal first-party web APIs, not an approved public partner API. Ritzy should not rely on them without a commercial and technical agreement.

### Platform inference

Confirmed:

- The site is not obviously Shopify from observed URLs or behavior.
- Public code includes multiple `BLC_*` entities and Broadleaf references, including `BLC_CART`, `BLC_CUSTOMER`, `BLC_ORDER`, `BLC_PRODUCT`, and `BLC_PRICE_LIST_PRICE_DATA`.
- Product page state includes Broadleaf-like commerce fields such as price info, price lists, SKU refs, inventory reservation strategy, fulfillment strategy, and discountable flags.
- Config says `isOrdersFromMagento: false`.

Inference:

- Home Centre appears to use Landmark Group's custom commerce stack with Broadleaf Commerce/BLC components, plus Next.js frontend, Bloomreach search/recommendation, Algolia indexes, Amplience content, and Checkout.com/payment-provider integration.
- Do not call it Shopify, Magento, or Salesforce Commerce Cloud in the meeting. Say: "Your current web stack appears to expose internal cart and checkout APIs; we would like a supported partner-safe endpoint or signed cart link."

## Integration Options

| Option | UX Quality | Retailer Effort | Ritzy Effort | Security Risk | Tracking Quality | Meeting Ask |
|---|---:|---:|---:|---:|---:|---|
| A. Affiliate/deep-link tracking | Medium. User lands on PDP and adds manually. | Low | Low | Low | Medium/low unless order reports exist | "Can you provide partner-tracked product links, campaign IDs, UTMs, and order reporting?" |
| B. Hidden or embedded promo attribution | Medium/high if code auto-applies; medium if user copies code. | Medium | Low/medium | Low | Medium/high if code tied to Ritzy | "Can a Ritzy partner code be applied automatically or server-side, without the customer typing it?" |
| C. Cart prefill link | High. User lands in cart with selected SKU(s). | Medium/high | Medium | Low/medium if signed and scoped | High if cart stores campaign metadata | "Can you support add-to-cart/cart links with SKU, quantity, promo code, partner ID, redirect?" |
| D. Server-to-server cart creation API | Highest practical V1. Ritzy sends SKU/qty; Home Centre returns hosted cart/checkout URL. | High but controlled | Medium/high | Low if API scoped and no payment data leaves Home Centre | High | "Can you expose a secure hosted checkout session API for partners?" |
| E. Marketplace/order API | Potentially highest control, but unnecessary for V1. | Very high | Very high | High | High | "Future only: not needed for first launch." |

## Option-by-Option Feasibility

### Option A: Simple affiliate/deep-link tracking

Feasibility: immediately feasible if Home Centre has partner tracking or agrees to campaign-tagged links.

Ritzy flow:

- Ritzy stores product URL and SKU.
- User clicks `Buy from Home Centre`.
- Ritzy opens the Home Centre PDP in a new tab with partner tracking parameters or affiliate redirect.
- Ritzy shows/copies discount code if one exists.

Pros:

- Fastest to launch.
- No sensitive data exchange.
- Home Centre keeps full checkout.
- Works with current observed PDP/cart behavior.

Cons:

- User must add each product manually.
- Multi-item room shopping is clunky.
- Tracking may be click-only unless Home Centre returns order-level reports.
- Manual promo entry can leak coupon codes publicly.

Ask:

- Partner tracking URL format.
- Campaign-specific promo code.
- Order report by partner/campaign code.
- Whether Home Centre allows Ritzy to show "partner pricing" or only "shop at Home Centre."

### Option B: Hidden or embedded promo attribution

Feasibility: not confirmed on public URL behavior; likely possible internally because the site supports offer-code application to cart.

Observed:

- Promo/voucher UI exists in cart and checkout.
- Internal cart client exposes offer-code methods.
- No visible evidence of URL-based promo auto-apply.

Ask:

- Do you support pre-applied promo code links?
- If no, can you apply a partner code server-side during cart/session creation?
- Can the code be hidden from the customer and attributed to Ritzy in reporting?
- Can the code be rotated, capped, restricted by SKU/category, and made non-stackable?

### Option C: Cart prefill link

Feasibility: not confirmed from public customer flow; plausible with technical support.

Observed:

- Anonymous carts exist.
- Internal cart APIs support cart creation and adding items.
- Bundle includes add-one and add-many cart client methods.
- Product and variant SKUs are visible.

Risk:

- Public add-to-cart URL format was not found.
- Ritzy should not try to reverse-engineer internal web API calls for production.

Ask for required fields:

- `sku` or `variantSku`
- `quantity`
- `couponCode` or `offerCode`
- `partnerId` / `campaignId`
- `source` / `utm`
- optional `ritzyProjectId` / `ritzyRoomId`
- `redirectUrl` after cart creation
- signature/HMAC or expiring token for tamper prevention

### Option D: Server-to-server cart creation API

Feasibility: best partner-grade V1 if Home Centre is willing.

Recommended shape:

Ritzy calls Home Centre:

```json
{
  "partnerId": "ritzy-studio",
  "campaignId": "ritzy-homecentre-v1",
  "items": [
    { "sku": "166839119", "quantity": 1 }
  ],
  "promoCode": "RITZY10",
  "metadata": {
    "ritzyProjectId": "project_123",
    "ritzyRoomId": "room_456"
  },
  "redirectAfterCheckout": "https://ritzystudio.com/projects/project_123/rooms/room_456"
}
```

Home Centre returns:

```json
{
  "cartId": "homecentre_cart_id",
  "checkoutUrl": "https://www.homecentre.com/ae/en/cart?..."
}
```

Why safest for Home Centre:

- Home Centre owns checkout, payment, stock truth, order confirmation, delivery, returns, cancellations, fraud controls, and customer support.
- Ritzy never sees card data or passwords.
- Home Centre can validate SKU availability and pricing before returning the hosted URL.
- Home Centre can apply discount server-side without exposing coupon mechanics.
- Home Centre can revoke API keys, rotate partner codes, cap usage, and block abuse.

Why best for Ritzy:

- Best UX: "Checkout with Home Centre" after room shopping-list selection.
- Works for multi-product room carts.
- Clear attribution to project/room/campaign.
- Low customer trust friction because checkout remains on Home Centre.

### Option E: Full marketplace/order API

Feasibility: future only.

This would mean Ritzy creates or manages orders directly. It is not appropriate for V1 because it increases legal, operational, support, payment, refund, fraud, and fulfillment responsibilities. Keep it as a later marketplace conversation only if Ritzy becomes a real transactional channel.

## Safety Framing for Home Centre

Use this language:

"Ritzy is not asking to become the merchant of record. We want to send high-intent room-shopping demand into Home Centre checkout. Home Centre keeps checkout, payment, delivery, returns, cancellations, customer service, stock validation, price truth, and fraud controls. Ritzy only passes product SKU, quantity, campaign attribution, and optional promo eligibility."

Controls Home Centre can retain:

- No retailer password collection by Ritzy.
- No payment data handled by Ritzy.
- No order creation outside Home Centre unless explicitly agreed later.
- Partner codes can be hidden from the customer.
- Partner codes can be revoked or rotated.
- Usage can be capped by customer, session, SKU, category, campaign, geography, or date.
- Discount stacking can be disabled.
- Home Centre can reject unavailable items before checkout URL creation.
- Home Centre can return substitutions or out-of-stock status before customer checkout.
- Home Centre can keep all fraud and refund logic in its existing systems.

## Commercial Asks for Sam

Ask for:

- Partner discount: percentage or AED value.
- Scope: all products, selected categories, curated SKUs, or room bundles only.
- Whether discount stacks with existing sale prices.
- Whether the code is public, hidden, single-use, multi-use, session-bound, or customer-bound.
- Whether Home Centre can create campaign-specific promo codes such as `RITZY10`, `RITZYHC`, or hidden partner entitlement codes.
- Attribution window: same-session, 7 days, 14 days, 30 days, or other.
- Commission/referral fee, if any.
- Whether commission applies before or after VAT, delivery, cancellations, and returns.
- Reporting cadence: daily, weekly, monthly.
- Reporting delivery: dashboard, CSV, SFTP, email, API.
- Order-level reporting fields:
  - order ID
  - order date/time
  - partner ID/campaign ID
  - SKU/product ID
  - product title/category
  - quantity
  - gross merchandise value
  - discount value
  - net sales after discount
  - order status
  - return/cancellation status
  - commission/referral amount
  - optional Ritzy project/room metadata
- Return/cancellation treatment: clawback, partial returns, cancellation windows.
- Whether Ritzy can advertise "partner pricing," "exclusive Home Centre offer," or only "retailer links."
- Whether Ritzy can show Home Centre logo/product images in app and generated shopping lists.
- Whether Home Centre can provide a curated feed for Ritzy-friendly SKUs.

## Technical Checklist for Home Centre Team

Read/send this after the commercial discussion:

- Do you support cart creation links?
- Do you support adding SKUs to cart via URL?
- Do you support multiple SKUs/quantities in one cart link?
- Do you support pre-applied promo codes via URL?
- Do you support invisible/server-side code application?
- Do you support hosted checkout session creation by API?
- Can the API return a Home Centre hosted cart/checkout URL?
- Which product identifier should partners send: product ID, parent SKU, variant SKU, internal SKU ref, or another ID?
- Can you validate price, stock, delivery eligibility, and variant availability before returning the URL?
- Can you return unavailable or substituted items before checkout?
- Can you attach partner ID, campaign ID, source, and Ritzy room/project ID to the cart/order metadata?
- Can you provide product feed fields:
  - SKU
  - parent product ID
  - variant ID
  - title
  - description
  - price
  - sale price
  - currency
  - stock status
  - dimensions
  - color
  - material
  - category
  - image URL
  - product URL
  - brand
  - delivery/assembly flags
- Can you provide inventory and price refresh via API, feed, or SFTP?
- What refresh cadence is allowed: hourly, daily, real-time webhooks?
- Can you provide order attribution reports by partner ID/campaign ID?
- Can you include Ritzy metadata in reports?
- What authentication is required: API key, OAuth client credentials, signed URL, HMAC, JWT?
- What rate limits apply?
- What IP allowlisting, request signing, expiry window, replay prevention, or environment separation is required?
- Do you have sandbox credentials and test SKUs?
- What is the approval process for production access?

## Recommended Ritzy V1 Architecture

V1 data model:

- Store retailer name: `Home Centre`
- Store retailer region: `AE`
- Store product URL
- Store public product ID: e.g. `166839119`
- Store SKU/variant SKU after feed confirmation
- Store selected quantity
- Store displayed price snapshot and timestamp
- Store room ID, project ID, shopping-list ID, and campaign ID

V1 flow:

1. User unlocks shopping list.
2. User chooses selected products in Ritzy.
3. User clicks `Buy from Home Centre` or `Checkout with Home Centre`.
4. Ritzy logs outbound intent:
   - user/session ID if allowed
   - project ID
   - room ID
   - shopping-list ID
   - product IDs/SKUs
   - quantities
   - retailer
   - timestamp
   - campaign ID
   - outbound URL type
5. Ritzy either:
   - opens tracked product deep links, or
   - calls a Home Centre partner API and opens returned cart/checkout URL.
6. Home Centre checkout opens in a new tab/window.
7. Home Centre owns checkout, payment, delivery, support, and stock truth.
8. If Home Centre sends reports, Ritzy reconciles orders later by partner/campaign/project metadata.

Do not do in V1:

- Do not handle card data.
- Do not collect Home Centre passwords.
- Do not create orders on Home Centre's behalf unless a formal API contract exists.
- Do not depend on reverse-engineered public web APIs.

## Recommended Ask for Sam's First Meeting

Primary ask:

"We want Ritzy users to send room-level purchase intent into Home Centre checkout. For V1, can you support either campaign-tracked product links with a partner discount, or a hosted cart/checkout session API where Ritzy sends SKU, quantity, partner campaign ID, and optional promo eligibility, and Home Centre returns a checkout URL?"

Commercial ask:

"Can we create a Ritzy campaign with partner pricing for selected Home Centre SKUs or categories, with order-level reporting by partner/campaign, and clear rules for returns, cancellations, stacking, expiry, and commission?"

Technical ask:

"Can your team confirm whether cart links, add-SKU-by-URL, pre-applied offer codes, or a secure cart creation API are supported? If not currently public, what is the lightest safe endpoint you can expose?"

Preferred concession:

- If they cannot do API in V1, ask for a campaign-specific promo code plus partner-tracked product links and weekly order reporting.

## Fallback Plan if Home Centre Says "No API"

Fallback V1:

- Use deep links to individual PDPs.
- Add `utm_source=ritzy_studio`, `utm_medium=partner`, `utm_campaign=homecentre_v1`, or their preferred tracking parameters.
- Show a copyable partner code in Ritzy.
- Let users add products manually on Home Centre.
- Ritzy logs outbound clicks by product/project/room.
- Home Centre sends weekly/monthly report by code or campaign.

Fallback UX:

- Button label: `Shop at Home Centre`
- Secondary text: `Partner offer available at checkout`
- Per-product action instead of one cart action.
- If multi-item room shopping is needed, open links one at a time from the shopping list.

Fallback tracking:

- Use campaign links for click attribution.
- Use partner code for conversion attribution.
- Reconcile orders by SKU/date/campaign/code in reports.
- Do not claim exact conversion unless Home Centre gives order-level reporting.

## Future Retailer Plan

Use the Home Centre brief as the template for each retailer:

1. Verify customer flow:
   - anonymous add-to-cart
   - guest checkout
   - promo-code entry
   - product/SKU visibility
   - stable product URLs
2. Identify platform:
   - Shopify, Salesforce Commerce Cloud, Magento/Adobe Commerce, custom, Broadleaf, commercetools, etc.
3. Classify integration level:
   - deep link only
   - promo code
   - cart URL
   - hosted checkout API
   - marketplace/order API
4. Ask for product feed:
   - SKU, title, price, sale price, stock, dimensions, images, URL, category, materials/colors.
5. Ask for attribution/reporting:
   - campaign, partner, order, SKU, GMV, returns/cancellations.
6. Keep retailer-owned checkout as the default unless a retailer explicitly wants marketplace integration.

Retailers to prioritize after Home Centre:

- Home Box, because it appears to be another Landmark Group brand and may share technical patterns.
- IKEA UAE, because room-based commerce fit is strong but cart/API behavior must be checked separately.
- Pan Emirates / Danube Home / The One, depending on product feed quality and partner willingness.

## Bottom Line

Home Centre is technically promising for Ritzy because the observed customer journey already supports anonymous carting, guest checkout, voucher entry, and SKU-based commerce state. The best meeting posture is confident but careful:

- Confirmed: deep links, anonymous cart, guest checkout, promo/voucher UI, SKU visibility, retailer-hosted checkout.
- Inferred: Broadleaf/custom Landmark commerce stack and internal APIs can probably support partner cart creation.
- Not confirmed: public cart-prefill URL, URL-based promo auto-apply, or partner API availability.

Sam should ask for the lightest supported path first, but anchor the ideal V1 around Home Centre-hosted checkout session creation.
