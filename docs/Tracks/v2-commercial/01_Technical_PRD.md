# 01 Technical PRD

## Purpose

Extend Ritzy Studio from a designer-only MVP into a commercial room redesign platform for homeowners and professional designers, with retailer-backed SKU recommendations, paid unlocks, retailer attribution, and eligible partner discounts.

## Users

### Homeowner

A consumer redesigning their own room.

Needs:

- simple guided onboarding
- visual style help
- fast concept generation
- clear budget control
- confidence that recommended products are real
- easy shopping links after payment

### Designer

A professional designer working for clients.

Needs:

- client/project organization
- more detailed room briefs
- product review and substitution
- client-ready presentations
- monthly subscription access
- reliable retailer product data

### Retailer Partner

A furniture/decor retailer whose SKUs are recommended by Ritzy.

Needs:

- clean attribution
- measurable outbound traffic
- discount-code control
- SKU-level performance reporting
- brand-safe product display

## Core V2 Journeys

### Homeowner Journey

1. Sign up.
2. Choose `I am redesigning my own home`.
3. Create a room.
4. Upload room photos.
5. Optionally upload floor plan.
6. Answer guided questions.
7. Choose style using visual cards.
8. Choose colors, budget, must-keep items, and constraints.
9. Generate initial concept.
10. Approve or revise the concept.
11. View shopping-list preview.
12. Pay AED 100 to unlock the room.
13. Get retailer links, eligible discount code, and final grounded render.
14. Click tracked shopping links and shop on retailer sites.

### Designer Journey

1. Sign up.
2. Choose `I design for clients`.
3. Subscribe at USD 99/month or start trial if enabled.
4. Create client project and rooms.
5. Upload room photos and optional floor plans.
6. Enter advanced brief details.
7. Generate and refine concepts.
8. Approve concept direction.
9. Match products.
10. Swap products where needed.
11. Generate final grounded render.
12. Create client presentation.
13. Use tracked retailer links and eligible partner discounts.

### Retailer Attribution Journey

1. Retailer provides feed/API/campaign terms.
2. Ritzy ingests SKU catalog.
3. User unlocks a room or has subscription entitlement.
4. User clicks a product link.
5. Ritzy records click and redirects with attribution.
6. Retailer records session/conversion.
7. Ritzy imports or receives conversion reports.
8. Ritzy reconciles traffic, sales, discounts, and commission.

## Functional Requirements

### Role-Based Onboarding

- Ask how the user intends to use Ritzy.
- Route homeowners to a simple guided room flow.
- Route designers to project/client workflow.
- Store user mode and allow later switching if needed.

### Visual Style Discovery

- Present style cards with real/generated reference imagery.
- Use plain-language explanations.
- Allow users to like/dislike styles.
- Support mixed styles.
- Capture colors to keep, colors to avoid, and mood.
- Avoid jargon-only style labels.

### Homeowner Room Flow

- Create a room without requiring project-management complexity.
- Allow photo upload and floor-plan upload.
- Ask only high-value questions.
- Show progress clearly.
- Generate a first concept with minimum friction.

### Designer Workflow

- Preserve MVP project/room workflow.
- Add subscription entitlement.
- Keep advanced brief fields.
- Preserve product swapping and presentation generation.

### Paywall And Entitlements

- Homeowner paid unit is a room unlock.
- Designer paid unit is monthly subscription.
- Entitlements must be checked server-side.
- Locked users must not receive raw retailer URLs.
- Paid users should get tracked redirect links.

### Shopping Preview

- Before payment, show enough detail to create trust.
- Do not expose raw retailer URLs before entitlement.
- Exact product title visibility is a product decision to lock before implementation.
- Prices and availability must show freshness warnings.

### Retailer Links

- Links must be signed Ritzy redirect URLs.
- Redirects must log click events.
- Redirects must attach attribution parameters where supported.
- Redirects must handle missing/expired products gracefully.

### Discounts

- Discount promise must be retailer-specific.
- Support code pools, generated codes, auto-discount links, and no-code campaigns.
- Show expiry, terms, and eligible retailers.
- Do not claim a discount for a retailer without campaign coverage.

### Retailer Feeds

- Store feed source, ingestion run, freshness, and field confidence.
- Support product deactivation.
- Support price/stock refresh.
- Support retailer-specific taxonomy mapping.

### Reporting

- Track outbound clicks.
- Track room unlocks and subscriptions.
- Track retailer conversions when data is available.
- Provide export-ready retailer performance reports.

## UX Requirements

- Homeowner UX must feel guided, visual, and nontechnical.
- Designer UX must feel efficient, precise, and professional.
- Long AI and ingestion tasks must use durable job states.
- Buttons must have clear hierarchy and pending states.
- Paywalls must explain value without feeling deceptive.
- The UI must follow `docs/Vision/05_Brand_and_Design_System.md`.

## Non-Functional Requirements

- Product facts must be source-backed.
- Entitlement checks must be server-side.
- Billing and redirect events must be auditable.
- Retailer data must have freshness timestamps.
- AI cost and latency must be bounded.
- No secret keys in client code.
- Private room images remain access-controlled.

## Out Of Scope For Initial V2

- In-app checkout for retailer products.
- Guaranteed product availability at time of purchase.
- Guaranteed exact SKU appearance in generated renders.
- Exact fit certification without verified measurements.
- Retailer-facing self-serve dashboard unless explicitly added.
- Multi-seat designer teams unless explicitly added.

## Acceptance Criteria

V2 is accepted when:

- A homeowner can generate a guided room concept, see a shopping preview, pay AED 100, unlock tracked retailer links, and receive a final grounded render.
- A designer can subscribe at USD 99/month and use the professional workflow without per-room homeowner unlock friction.
- Retailer links are tracked through Ritzy redirects.
- Discount access is controlled by campaign/code rules.
- Product recommendations are backed by catalog records, not invented by AI.
