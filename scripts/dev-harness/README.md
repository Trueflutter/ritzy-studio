# Dev harness (local-only utilities)

- `e2e.mjs` — staged Playwright driver for the local app (login / onboarding / project / room /
  photos / brief-style / brief-inspiration / inspect). Requires `npm i playwright` +
  `npx playwright install chromium` somewhere on the path, a running `pnpm dev`, the local
  Supabase stack, and the seeded fixture catalog (scripts/local-catalog-seed). State persists in
  `e2e-state.json` + `auth.json` next to the script. Test user: fable-test@ritzy.local
  (local stack only).
- `evogen.py` — submit-then-poll helper for the Evolink image API (EVOLINK_API_KEY env).
  Usage: `evogen.py --out x.png --prompt-file p.txt [--size 16:9] [--quality 1K] [ref_url ...]`.
  Records name→URL pairs in `manifest.tsv` beside the output.

See docs/FABLE_PROGRESS.md for the full local-stack setup notes (colima + supabase CLI, grants
fixups, analytics disabled under colima).
