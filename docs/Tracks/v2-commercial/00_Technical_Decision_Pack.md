# 00 Technical Decision Pack

## Status

Draft for founder approval. Supersedes MVP decisions only where explicitly stated.

## Product Positioning Decision

Ritzy Studio V2 is a B2B2C room redesign and retailer-product discovery platform.

It serves two primary user modes:

- `homeowner`: a guided, low-friction consumer flow for redesigning the user's own space.
- `designer`: a professional workflow for designers managing client rooms and presentations.

Both modes share the same core engine:

1. Upload real room photos and optional floor plans.
2. Capture style, color, budget, and constraints.
3. Generate a beautiful initial concept.
4. Approve a direction.
5. Match real retailer SKUs.
6. Generate a final product-grounded render.
7. Unlock retailer shopping links through payment or subscription entitlement.

## Commercial Model Decision

V2 uses different monetization by user mode.

### Homeowner

- First concept experience may be free or freemium.
- Shopping-list preview may show categories, images, prices, and estimated total.
- Exact retailer links, exact SKU details where needed, final grounded render, export, and eligible discount access require a paid room unlock.
- Initial target price: `AED 100 per room`.

### Designer

- Designers pay a monthly subscription.
- Initial target price: `USD 99/month`.
- Subscription unlocks professional workflow access.
- Designer usage limits, credits, or fair-use controls are allowed and must be defined before production launch.
- Designer mode may later support team seats, client portals, and agency pricing, but those are not V2 baseline unless added to the feature list.

## Retailer Partnership Decision

Commercial V2 must prefer approved retailer data access over public-page extraction.

Approved data routes, in priority order:

1. Retailer API.
2. Affiliate/product feed.
3. Retailer-provided scheduled feed.
4. Trade/B2B catalog feed.
5. Approved crawl or sitemap/category extraction.
6. Admin-only recovery import.

Public scraping remains a technical fallback, not the commercial target.

## Attribution Decision

All paid/unlocked shopping clicks must route through Ritzy redirect tracking.

The application must not render raw outbound retailer links directly in paid shopping experiences. It should render signed Ritzy redirect URLs that:

1. Validate entitlement.
2. Record user, room, product, retailer, campaign, and timestamp.
3. Attach retailer-supported attribution parameters.
4. Attach or display eligible discount code where applicable.
5. Redirect to the canonical retailer product URL.

## Discount Code Decision

V2 must not assume a single public code such as `RITZY5` is commercially safe.

Preferred discount mechanisms:

1. Retailer-generated single-use codes assigned per room unlock.
2. Unique user/room codes with expiry and usage caps.
3. Auto-discount affiliate links where retailers support them.
4. Public campaign codes only when the retailer explicitly accepts leakage risk.

Marketing copy must say `eligible partner discounts` until signed retailer agreements guarantee a specific discount.

## UX Decision

Homeowner onboarding must be visual and plain-language.

Style names alone are not sufficient. Style selection must use image-led cards, plain-language descriptions, and progressive disclosure.

Designer mode may expose advanced controls, but should still default to guided flows and strong defaults.

## Product Data Truth Decision

The shopping list remains database truth.

Image generation can create concept and final visualization, but product facts must come from retailer catalog records, feeds, APIs, or verified source pages.

## Spatial Decision

Photo-only sizing remains unreliable.

V2 should improve measurement capture through:

- optional floor plan upload
- wall-length entry
- ceiling-height entry
- image annotation
- future LiDAR/RoomPlan support

The app must not certify fit unless dimensions and room measurements are sufficiently verified.

## Platform Decision

Continue with the MVP platform unless a future ADR explicitly changes it:

- Next.js App Router
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Storage or compatible object storage
- pgvector
- background jobs for AI and catalog ingestion
- OpenAI APIs for vision, prompts, embeddings, and image generation

Add commercial infrastructure:

- billing provider
- entitlement checks
- redirect tracking
- retailer campaign/reporting jobs
- partnership feed ingestion

## Deferred Decisions

- Billing provider.
- UAE VAT treatment.
- Whether homeowner first concept is always free or free only for first account.
- Designer monthly usage limits.
- Retailer dashboard versus export-only reporting.
- Exact discount guarantee wording.
- Team seats and agency pricing.
