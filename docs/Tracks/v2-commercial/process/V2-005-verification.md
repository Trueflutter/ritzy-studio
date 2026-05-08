# V2-005 Verification

## Feature

`V2-005 Billing Provider Integration`

## Status

Passed for application readiness. Public deployed webhook configuration remains a deployment step.

## Scope Implemented

Added Stripe Checkout foundation for:

- homeowner AED 100 room unlock checkout
- designer USD 99/month subscription checkout
- Stripe webhook endpoint
- room unlock activation
- designer subscription activation/update/cancellation persistence

## Files Changed

- `apps/web/lib/billing/stripe.ts`
- `apps/web/app/api/stripe/webhook/route.ts`
- `apps/web/app/actions.ts`
- `apps/web/app/onboarding/page.tsx`
- `apps/web/app/projects/[projectId]/rooms/[roomId]/shopping-list/page.tsx`
- `packages/config/src/index.ts`
- `.env.example`
- `apps/web/package.json`
- `pnpm-lock.yaml`

## Verification Completed

Ran:

```sh
pnpm --filter @ritzy-studio/web typecheck
pnpm check
```

Result:

- passed

Browser and Stripe verification:

- Stripe Checkout opened from the shopping-list `Unlock room` CTA.
- AED 100 test card payment completed successfully.
- Stripe Checkout session reported `status = complete` and `payment_status = paid`.
- The local webhook handler accepted a correctly signed `checkout.session.completed` event and returned `200`.
- Supabase updated the tested room unlock to `active`.
- Supabase inserted a `room_unlock_activated` entitlement event.
- Shopping-list UI changed from `Unlock room` to `Room commerce unlocked`.

## Deployment Follow-Up

For deployed testing, configure Vercel environment variables from `.env.example`.

Then create a Stripe dashboard webhook for the deployed URL:

```txt
https://<deployment-domain>/api/stripe/webhook
```

Events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Notes

Stripe was selected because current Stripe documentation supports Checkout for one-time payments and subscriptions, and AED/USD are supported currencies.
