# UX audit bootstrap

How to get the app rendering representative data for a visual audit
(`/ux-audit`, `/design-review`, `/fidelity-check`). Written 2026-09-05 during
S4; keep it current when the sign-in story changes.

## Environment

- `.env.local` at the repo root points the web app at the Supabase project
  the team shares for development and production (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, the OpenAI
  and Evolink keys). No local Supabase is needed for an audit; the harness
  rooms below already live in that project.
- Dev server: `pnpm dev` (Next.js 16, Turbopack) on port 3000. The preview
  entry in `.claude/launch.json` is `ritzy-web`.
- Migrations are applied by the Supabase CLI against the linked project
  (`supabase db query --linked` for DDL; never `db push`, the migration
  history carries stamp mismatches from earlier renames).

## Representative data

The five critique-harness rooms (`scripts/critique-harness/rooms/manifest.json`)
carry every state the reveal and the concepts page have: a confirmed
design spec, a shopping list with selected rows, concept views, and final
renders with planned views and their check rows.

| room | route | persona |
|---|---|---|
| Al Furjan living and dining (four photographs, chosen focal point) | `/projects/05650484-7993-4884-8eac-75ae63d7c8ce/rooms/c5f8011b-9b03-4121-bba2-49f2da6ce69f/presentation` | bolaji@ritzyinteriors.com |
| Cincinnati bedroom | `/projects/04d80787-650a-4dc1-8e15-15c05eb48d45/rooms/9ce608fa-a989-41f3-a750-a3393581c142/presentation` | bolaji@ritzyinteriors.com |
| Stress: dense apartment | `/projects/8ee572ea-3bdb-4ae8-a1b5-7d4b8224dd84/rooms/8ffacf57-bce5-4ab0-906d-8d200fe38966/presentation` | fable-homeowner@ritzyinteriors.com |
| Stress: columns | `/projects/c02604df-0e88-43dc-a2e8-510f3fd05826/rooms/f06d1676-3d23-460b-9d2c-fd45e4f9fc45/presentation` | fable-homeowner@ritzyinteriors.com |
| Stress: glass and glare | `/projects/fae81e54-6105-4203-a582-f608b828796d/rooms/d7a8f43d-5f18-4d81-b690-c0f565ebb85d/presentation` | fable-homeowner@ritzyinteriors.com |

The concepts page is the same route with `/concepts` in place of
`/presentation`; the shopping list is `/shopping-list`.

## Sign-in, and why the audit cannot do it alone

Every project route is behind Supabase Auth. The app signs in with email
and password only: there is no magic-link callback or code-exchange route,
so a generated link cannot be followed, and an agent must not type a
persona's password. On 2026-09-05 the only remaining route, minting a
persona session server-side through the admin API and carrying it as the
`sb-<ref>-auth-token` cookie, was refused by the tool policy, so the S4
visual ladder was not walked.

What makes the next audit mechanical, in order of preference:

1. A Playwright storage-state file that Ayo creates by signing in once as
   each persona (`npx playwright codegen --save-storage=...`), kept out of
   git; the audit loads it with `browser_navigate` after
   `context.storageState`.
2. A dev-only sign-in helper route, gated on `NODE_ENV !== "production"`
   and a shared secret, that exchanges an admin-generated magic link for a
   session. This is an auth surface and belongs in its own reviewed PR.

Until one of those exists, an audit of a signed-in screen is recorded as
NOT-VERIFIED with this reason, never as a pass.

## Capture conventions

- Viewports 1440 by 900 and 390 by 844; full-page PNGs under
  `docs/ux/audit-<date>/shots/` named `<route-slug>--<viewport>--<state>.png`.
- The reveal's states to capture: normal (three views), review-flagged
  (`spatialQaOutcome` unresolved, the review note with "render again"),
  review-unreviewed, and view-left-out (an `unresolved` view outcome). The
  component test `apps/web/app/render-notes.test.tsx` pins the copy of each
  state; the capture proves the composition.
