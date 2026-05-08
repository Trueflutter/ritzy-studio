# 10 RLS And Privacy Posture

## Purpose

Document the V2 commercial entitlement privacy model.

## Tables Added In V2-002

- `user_profiles`
- `designer_accounts`
- `subscriptions`
- `room_unlocks`
- `entitlement_events`

## Access Principles

- Users can manage their own V2 profile.
- Users can read and update their own designer account shell.
- Billing/subscription writes are service-role only.
- Room unlock writes are service-role only.
- Entitlement events are append-style service-role records.
- Users can read only their own entitlement records.
- Room unlock visibility also requires room ownership.

## Server-Side Entitlement Helpers

### `has_active_designer_subscription(user_id uuid)`

Returns true when a user has a `designer_monthly_usd_99` subscription with status `trialing` or `active` and the current period has not ended.

### `has_active_room_unlock(room_id uuid, user_id uuid)`

Returns true when a user has an active room unlock for that room and the unlock has not expired.

### `can_access_room_commerce(room_id uuid)`

Returns true when:

- the user is an admin, or
- the user owns the room and has either an active room unlock or an active designer subscription.

This function is intended to gate paid shopping-link access in later V2 slices.

## Privacy Notes

- Billing provider identifiers are stored, but payment card data must never be stored in Ritzy.
- Entitlement event metadata must avoid raw payment secrets or full provider payloads unless explicitly needed.
- Future outbound-click tracking should hash or omit IP/user-agent data unless a retailer contract requires more.
- Retailer exports should minimize direct user identity.

## Verification

V2-002 migration was applied to the linked Supabase project on 2026-05-04.

Service-role verification confirmed:

- new entitlement tables are queryable
- existing users were backfilled into `user_profiles`
- the current existing user has default `intended_mode = designer`
