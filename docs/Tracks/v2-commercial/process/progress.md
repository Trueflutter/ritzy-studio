# V2 Commercial Progress

## 2026-05-04

Created the V2 commercial planning track.

Docs created:

- `00_Technical_Decision_Pack.md`
- `01_Technical_PRD.md`
- `02_Feature_List.json`
- `03_Data_Model.md`
- `04_Pricing_And_Entitlements.md`
- `05_Retailer_Partnership_And_Attribution.md`
- `06_Prompt_Architecture.md`
- `07_Latency_And_Cost_Budget.md`
- `08_Repository_Structure.md`
- `09_Chief_Architect_Handoff.md`

Founder inputs captured:

- V2 should support both homeowners and designers.
- Homeowner flow should be simpler and more visual.
- Designer flow can be more advanced.
- Homeowners pay per room.
- Designers pay subscription.
- Homeowner target price: AED 500 per room.
- Designer target price: USD 99/month.
- Retailer data should move toward clean SKU feeds/APIs/partnerships.
- Retailer attribution and discount control are required.

Light benchmarking notes:

- Online design platforms commonly use visual style quizzes, per-room packages, and shopping-list/render deliverables.
- Role/use-case onboarding is a common SaaS best practice for reducing first-run friction.
- Affiliate platforms commonly recommend unique coupon codes or tracked links for attribution; global public codes are leakage-prone.

Open founder decisions:

- Should the homeowner first concept be free for every account or only as a launch promotion?
- In free preview, should exact product names be visible or hidden until unlock?
- Should unpaid users see retailer names?
- Should final grounded render be fully locked until AED 500 payment?
- Should designer subscription include unlimited rooms or monthly fair-use limits?
- Which billing provider should be used for AED one-time payments and USD subscriptions?
- Should retailer reporting be internal export only for V2, or should retailer partners get a dashboard?
- Should discounts be marketed as `eligible partner discounts` until retailer agreements are signed?

Recommended next slice:

- `V2-001` remains open until founder approval.
- After approval, begin `V2-002 User Mode And Entitlement Schema`.

## 2026-05-04 — V2-001 Approved

Founder approved the V2 commercial plan and requested implementation proceed.

Updated:

- marked `V2-001` as passed in `02_Feature_List.json`

## 2026-05-04 — V2-002 User Mode And Entitlement Schema

Implemented the V2 commercial entitlement foundation.

Added:

- `user_intended_mode` enum
- `subscription_status` enum
- `room_unlock_status` enum
- `entitlement_event_type` enum
- `user_profiles`
- `designer_accounts`
- `subscriptions`
- `room_unlocks`
- `entitlement_events`
- server-side entitlement helper functions:
  - `has_active_designer_subscription(user_id)`
  - `has_active_room_unlock(room_id, user_id)`
  - `can_access_room_commerce(room_id)`

Domain updates:

- added homeowner room unlock and designer subscription constants
- added active entitlement helper logic
- added entitlement tests

Verification:

- `supabase db push --dry-run` confirmed the pending V2 entitlement migration
- `supabase db push --yes` applied the migration to the linked Supabase project
- service-role smoke check confirmed new tables are queryable and current user profile was backfilled
- `pnpm --filter @ritzy-studio/domain test` passed
- `pnpm --filter @ritzy-studio/domain typecheck` passed
- `pnpm --filter @ritzy-studio/db typecheck` passed

Carry-over:

- billing provider remains deferred to `V2-005`
- role-selection UI begins in `V2-003`
- paywall/unlock UI begins in `V2-006`

## 2026-05-04 — V2-003 Role-Based Entry And Homeowner Guided Flow

Implemented role-based onboarding and the first homeowner simplified path.

Added:

- `/onboarding` route
- homeowner/designer role cards
- simplified homeowner room creation form
- dashboard redirect for users with missing or `unknown` intended mode
- signup redirect to onboarding
- `setUserModeAction`
- `createHomeownerRoomAction`
- domain schemas for user mode and homeowner room creation

Browser verification:

- onboarding page shows both role paths
- unknown profile redirects from `/` to `/onboarding`
- designer mode action opens the studio dashboard
- homeowner room form creates a room and lands on photo upload
- test account was restored to designer mode after verification

Automated verification:

- `pnpm --filter @ritzy-studio/domain test` passed
- `pnpm --filter @ritzy-studio/web typecheck` passed

Carry-over:

- visual style quiz starts in `V2-004`
- billing checkout starts in `V2-005`
- shopping preview and unlock UX starts in `V2-006`

## 2026-05-04 — V2-004 Visual Style Quiz And Preference Capture

Implemented image-led style preference capture on the brief screen.

Added:

- canonical visual style options in `packages/domain`
- visual style card grid before free-text brief fields
- liked style checkbox controls
- avoided style checkbox controls
- structured brief persistence under `structured_json.visualPreferences`
- downstream-readable merged `style_notes` for concept generation

Browser verification:

- style card section renders on the QA homeowner room brief
- selected `Warm minimal` and `Quiet luxury`
- marked `Earthy rustic` as avoided
- brief save completed and clarifying questions appeared

Data verification:

- saved design brief contains liked/avoided style slugs and style summaries

Automated verification:

- `pnpm --filter @ritzy-studio/domain typecheck` passed
- `pnpm --filter @ritzy-studio/web typecheck` passed

Carry-over:

- replace remote reference images with owned/licensed/generated brand-controlled assets before commercial launch

## 2026-05-04 — V2-005 Billing Provider Integration Started

Selected Stripe Checkout for billing.

Reasoning:

- supports Checkout for one-time payments and subscriptions
- AED and USD are supported currencies in Stripe currency documentation
- fits homeowner AED 500 room unlock and designer USD 99/month subscription

Implemented:

- Stripe dependency in `apps/web`
- optional Stripe env validation
- Stripe client helper
- homeowner room unlock checkout action
- designer subscription checkout action
- Stripe webhook endpoint
- room unlock activation on `checkout.session.completed`
- designer subscription persistence on checkout/subscription webhooks
- checkout CTA on onboarding designer path
- checkout CTA in shopping-list estimate panel

Verification:

- `pnpm --filter @ritzy-studio/web typecheck` passed
- `pnpm check` passed
- Stripe Checkout opened from the room unlock CTA
- AED 500 test card payment completed successfully
- Stripe Checkout session reported `complete` / `paid`
- signed local webhook request returned `200`
- Supabase room unlock changed from `pending` to `active`
- entitlement event `room_unlock_activated` was recorded
- shopping-list UI showed `Room commerce unlocked`

Deployment follow-up:

- configure Stripe production/test webhook against the deployed Vercel URL
