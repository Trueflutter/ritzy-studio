# F-004 Verification: Project And Room Creation

## Feature

`F-004 Project And Room Creation`

## Scope

Built the first authenticated project workflow slice.

Boundaries touched:

- `apps/web`
- `packages/ui`
- `packages/domain`
- `packages/db`

## Implementation Summary

- Added `/login` auth gate with sign-in and sign-up forms.
- Added protected dashboard at `/`.
- Added `/projects/new` single-column new project flow.
- Added server actions:
  - sign in
  - sign up
  - sign out
  - create project with first room
- Added project list query and room count display.
- Added initial budget fields and room type fields to the project creation flow.
- Added `ButtonLink` primitive.
- Added domain schema for project-with-room creation.

## Verification Commands

Passed:

```bash
pnpm check
curl -I -s http://localhost:3001
curl -I -s http://localhost:3001/login
curl -I -s http://localhost:3001/projects/new
```

Route behavior:

- `/` redirects unauthenticated users to `/login`.
- `/login` returns 200.
- `/projects/new` redirects unauthenticated users to `/login`.

Supabase data-path smoke test:

- Signed up a temporary local user.
- Created a project through authenticated RLS client.
- Created an initial room for the project.
- Listed projects through authenticated RLS client and confirmed the created project appeared.
- Deleted the test project and test auth user.

Design scan:

```bash
rg -n "#000000|#FFFFFF|#fff|#000|dark:|rounded-(full|lg|md|xl)|shadow-(md|lg|xl|2xl)|Inter|Roboto|Arial|system-ui|spinner|magic|purple" apps/web packages/ui
```

Result: no UI violations. The only match was `esModuleInterop` in `tsconfig.json`.

## Result

Passed.

## Deferrals

- Room image upload begins in F-005.
- Project detail pages are deferred until the room workflow needs them.
- Full auth polish/reset-password/OAuth are deferred.
