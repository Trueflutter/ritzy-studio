# Dev harness (local-only utilities)

- `use-env.sh local|hosted` — switch the app's active env (`.env.local`) between the local Supabase
  stack and hosted Supabase. Copies `.env.local.<target>` (both gitignored, at the repo root) onto
  `.env.local`, then restart `pnpm dev`. **LOCAL is the safe default**; hosted writes test data to
  the PROD database and burns real Evolink/OpenAI credits, so only switch to it for a real-catalogue
  verification pass, then switch back.
- `e2e.mjs` — staged Playwright driver for the local app. Stages: signup / login / onboarding /
  project / room / photos / brief-style / brief-inspiration / brief-details / brief-questions /
  concept / sourcing / render / inspect. Requires playwright installed in an ISOLATED dir (with its
  own package.json — do NOT `npm install` inside the repo; npm walks up to the monorepo root and
  installs the whole workspace) symlinked to `./node_modules`; browsers cache in
  `~/Library/Caches/ms-playwright` (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`). Needs a running `pnpm dev`
  + Supabase. State persists in `e2e-state.json` + `auth.json`. Local test user: fable-test@ritzy.local;
  for a hosted run, `create-hosted-test-user.mjs` makes a pre-confirmed `@ritzyinteriors.com` account
  (hosted signup is gated + email-confirmed) and writes its creds to `e2e-state.json`.
- `read-ai-job.mjs [roomId]` — dump the latest `ai_jobs` grounding/sourcing diagnostics + render
  job status for a room (reads the room from `e2e-state.json` by default).
- `render-alive.mjs` — final-render repro that keeps the browser alive on /presentation.
- `render.test.ts` (in apps/web/lib, run via `npx tsx`) and `render-reclamation.test.mjs` — cover the
  stalled-render recovery + the stale-job reclamation race (run the latter against a DB with test
  data via `node render-reclamation.test.mjs`).
- `evogen.py` — submit-then-poll helper for the Evolink image API (EVOLINK_API_KEY env).
  Usage: `evogen.py --out x.png --prompt-file p.txt [--size 16:9] [--quality 1K] [ref_url ...]`.
  Records name→URL pairs in `manifest.tsv` beside the output.

See docs/FABLE_PROGRESS.md for the full local-stack setup notes (colima + supabase CLI, grants
fixups, analytics disabled under colima).
