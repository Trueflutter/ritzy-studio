# 09 Chief Architect Handoff

## Current Track

`v2-commercial`

## Current Canonical Slice

`V2-001 Commercial V2 Documentation And Decision Lock`

## Status

Draft docs created for founder review.

## Locked Inputs From Founder

- V2 serves homeowners and designers.
- Homeowners pay per room.
- Homeowner target price is AED 100 per room unlock.
- Designers pay a monthly subscription.
- Designer target price is USD 99/month.
- Product links should be retailer-backed and attribution-safe.
- Retailer relationships should move toward clean SKU feeds/APIs.
- Homeowner UX must be visual, simple, and frictionless.
- Designer UX may be more advanced.

## Next Work

Before implementation:

1. Founder reviews V2 docs.
2. Resolve open questions in `process/progress.md`.
3. Mark `V2-001` as passed only after approval.
4. Start `V2-002 User Mode And Entitlement Schema`.

## Key Risks

- Billing provider choice affects AED/USD support and webhook model.
- Retailer discount promise must not outrun signed agreements.
- Global discount codes can leak.
- Free product previews can leak enough SKU detail for users to bypass payment.
- Designer subscription may need usage limits if AI/render cost is high.

## Verification Required For First Implementation Slice

- Migration verification.
- RLS/privacy review.
- Server-side entitlement tests.
- Browser check for homeowner/designer routing.
