# Ritzy Studio

Ritzy Studio is an AI-assisted interior design workspace for Dubai residential interior designers.

## Source Of Truth

This project uses a doc-first, slice-based execution model.

Current canonical feature list:

`docs/Tracks/mvp/02_Feature_List.json`

Current progress log:

`docs/Tracks/mvp/process/progress.md`

Locked design system:

`docs/Vision/05_Brand_and_Design_System.md`

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm validate-env
pnpm check
```

## Environment

Copy `.env.example` to `.env.local` and provide:

- `OPENAI_API_KEY`
- `OPENAI_TEXT_MODEL`
- `OPENAI_IMAGE_MODEL`
- `OPENAI_EMBEDDING_MODEL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

Run environment validation explicitly:

```bash
pnpm validate-env
```

`pnpm check` intentionally runs lint, typecheck, and build without requiring real secrets.

## Current Slice

The current slice is controlled by the first feature in `docs/Tracks/mvp/02_Feature_List.json` where `passes` is `false`.
