# F-002 Verification: Locked Design Tokens And App Shell

## Feature

`F-002 Locked Design Tokens And App Shell`

## Scope

Implemented the locked Quiet Gallery design foundation and reusable UI primitives.

Boundaries touched:

- `apps/web`
- `packages/ui`

## Implementation Summary

- Added `@ritzy-studio/ui` package.
- Implemented shared UI primitives:
  - `Button`
  - `Card`
  - `Panel`
  - `TextInput`
  - `Textarea`
  - `Label`
  - `Tabs`
  - `Tab`
  - `SegmentedControl`
  - `Chip`
- Added locked CSS variables from design system section 17.
- Added Tailwind 4 theme bindings for Ritzy tokens.
- Configured Cormorant Garamond and DM Sans through `next/font/google`.
- Updated the starter page into a minimal app-shell proof using primitives.
- Preserved F-002 scope: no auth, product, upload, or AI workflow implemented.

## Design Compliance Checklist

Checked against `docs/Vision/05_Brand_and_Design_System.md` section 20.

- Spacing uses the 4px scale except component-specific exact values from section 8.
- Headings use Cormorant Garamond.
- UI/body text uses DM Sans.
- No pure `#000000` or `#FFFFFF` in app/component styles.
- No dark-mode classes.
- No card-in-card.
- Buttons are square.
- Chips are the only pill-shaped primitive used.
- No decorative gradients.
- No spinners.
- No shadows above elevation 1.

## Verification Commands

Passed:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm check
```

Additional scan:

```bash
rg -n "#000000|#FFFFFF|#fff|#000|dark:|rounded-(full|lg|md|xl)|shadow-(md|lg|xl|2xl)|Inter|Roboto|Arial|system-ui" apps/web packages/ui
```

Result: no UI violations. The only match was `esModuleInterop` in `tsconfig.json`.

## Result

Passed.

## Deferrals

- Auth UI is deferred to F-003/F-004 depending on Supabase implementation.
- Full product-specific screens are deferred to later feature slices.
