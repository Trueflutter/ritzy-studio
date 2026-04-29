# F-006 Verification: Design Brief And Clarifying Questions

## Feature

`F-006 Design Brief And Clarifying Questions`

## Scope

Implemented the protected design brief intake and bounded AI clarifying-question flow.

Boundaries touched:

- `apps/web`
- `packages/ai`
- `packages/prompts`
- `packages/domain`
- `packages/db`
- `packages/config`

## Implementation Summary

- Added protected route:
  - `/projects/[projectId]/rooms/[roomId]/brief`
- Connected the photo step's continue CTA to the brief step.
- Captured structured brief fields:
  - style direction
  - colour preferences
  - budget range and priorities
  - functional requirements
  - avoid notes
  - inspiration
  - optional main wall, room depth, ceiling height, and measurement notes
- Added `packages/prompts` with versioned clarifying-question prompt:
  - key: `brief.clarifying_questions`
  - version: `2026-04-29.1`
- Added `packages/ai` with OpenAI Responses API structured-output generation for clarifying questions.
- Persisted design briefs, room measurements, clarifying questions, and AI job metadata.
- Logged model and prompt version in `ai_jobs`.
- Added clarification-answer saving with status transitions from `open` to `answered`.
- Fixed root `.env.local` loading for Next config and environment validation.

## Verification Commands

Passed:

```bash
pnpm validate-env
pnpm lint
pnpm typecheck
pnpm build
```

OpenAI structured-output smoke test:

```bash
pnpm exec tsx -e '...generateClarifyingQuestions(...)...'
```

Result:

```json
{"count":5,"promptVersion":"2026-04-29.1","model":"gpt-5-mini"}
```

Design scan:

```bash
rg -n "#000000|#FFFFFF|#fff|#000|dark:|rounded-(full|lg|md|xl)|shadow-(md|lg|xl|2xl)|Inter|Roboto|Arial|system-ui|spinner|magic|purple" apps/web packages/ui
```

Result: no UI violations. The only match was `esModuleInterop` in `tsconfig.json`.

## Result

Passed.

## Deferrals

- Concept generation is deferred to F-007.
- Room image analysis is deferred to F-007.
- Live hosted Supabase schema verification is deferred until the founder links or confirms the target hosted project migration path; local schema has already been verified in F-003.
