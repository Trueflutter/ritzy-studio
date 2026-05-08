# V2-003 Verification

## Feature

`V2-003 Role-Based Entry And Homeowner Guided Flow`

## Scope

Implemented first-run role routing and a simplified homeowner room creation path.

## Files Changed

- `apps/web/app/onboarding/page.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/actions.ts`
- `packages/domain/src/index.ts`
- `docs/Tracks/v2-commercial/02_Feature_List.json`
- `docs/Tracks/v2-commercial/process/progress.md`

## Behavior Shipped

- New signups now route to `/onboarding`.
- Dashboard redirects users with missing or `unknown` V2 profile mode to `/onboarding`.
- Onboarding presents two paths:
  - homeowner: guided own-room flow
  - designer: professional studio flow with USD 99/month positioning
- Designer path sets `user_profiles.intended_mode = designer`, creates/keeps a `designer_accounts` shell, and routes to `/`.
- Homeowner path creates a normal project/room behind the scenes while presenting a simpler room-only form.
- Homeowner room creation sets `user_profiles.intended_mode = homeowner` and logs a service-role entitlement event.

## Browser Verification

Verified in the in-app browser:

- `/onboarding` shows homeowner and designer choices.
- `/onboarding` shows the simplified room form.
- Dashboard redirects an `unknown` profile to `/onboarding`.
- Designer mode action opens the studio dashboard.
- Homeowner room form creates `V2 Homeowner QA Room` and lands on photo upload.
- Test account profile was restored to `designer` after browser verification.

## Automated Verification

Ran:

```sh
pnpm --filter @ritzy-studio/domain test
pnpm --filter @ritzy-studio/web typecheck
```

Result:

- passed

## Notes

- This slice does not implement the visual style quiz. That begins in `V2-004`.
- This slice does not implement billing checkout. That remains `V2-005`.
- This slice does not implement paywall/link gating. That remains `V2-006`.
