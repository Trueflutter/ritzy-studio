# 07 Repository Structure

## Current State

The repository contains the initial pnpm workspace and Next.js scaffold.

Current implemented structure:

```text
apps/
  web/
    app/
    public/
    scripts/
packages/
  ai/
  config/
  db/
  domain/
  ingestion/
  prompts/
  ui/
docs/
  Vision/
  Tracks/
```

## Target Structure

Use a small monorepo-style layout if the app is scaffolded from zero:

```text
apps/
  web/
    app/
    components/
    lib/
    public/
    styles/
packages/
  config/
  db/
  domain/
  prompts/
  ingestion/
  ai/
  ui/
docs/
  Vision/
  Tracks/
```

## Boundary Vocabulary

Feature slices should declare one or more boundaries:

- `apps/web`
- `packages/config`
- `packages/db`
- `packages/domain`
- `packages/ui`
- `packages/prompts`
- `packages/ingestion`
- `packages/ai`
- `cross-layer`
- `docs`

## Package Responsibilities

### apps/web

Next.js application, routes, screens, server actions/API handlers, app shell.

### packages/config

Shared environment validation, constants, feature flags, provider configuration.

### packages/db

Database schema, migrations, query helpers, generated types.

### packages/domain

Core product entities, validation schemas, category normalization, matching contracts.

### packages/ui

Design-system implementation, shared components, tokens, layout primitives.

### packages/prompts

Prompt definitions, prompt versions, schemas, test fixtures.

### packages/ingestion

Retailer adapter interface, retailer-specific adapters, extraction utilities, source confidence logic.

### packages/ai

OpenAI client wrappers, job orchestration helpers, embeddings, image generation helpers.

## Placement Rules

- UI primitives go in `packages/ui`.
- Route-specific composition goes in `apps/web`.
- Retailer-specific code goes in `packages/ingestion`.
- Prompt text and output schemas go in `packages/prompts`.
- Durable business rules go in `packages/domain`.
- Database migrations and generated DB types go in `packages/db`.
- Secrets never go in source files.

## Documentation Rules

Implementation must follow `docs/Tracks/mvp/02_Feature_List.json`.

Every completed feature requires a verification doc under:

`docs/Tracks/mvp/process/`

Progress updates go in:

`docs/Tracks/mvp/process/progress.md`
