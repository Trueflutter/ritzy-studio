# Ritzy Studio Web App

This is the Next.js application for Ritzy Studio.

## Commands

Run commands from the repository root:

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm validate-env
pnpm check
```

## Environment

Copy `.env.example` to `.env.local` and set the required OpenAI and Supabase values.

Environment validation is explicit:

```bash
pnpm validate-env
```

## Design

Visual implementation must follow:

`docs/Vision/05_Brand_and_Design_System.md`

F-001 only establishes the scaffold. Full design tokens and reusable UI primitives belong to F-002.
