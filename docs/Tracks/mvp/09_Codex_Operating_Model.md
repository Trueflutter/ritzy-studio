# 09 Codex Operating Model

## Purpose

This document adapts the project build process to Codex execution with one primary architect agent and optional bounded subagents.

## Primary Architect Agent

The primary Codex agent owns:

- source-of-truth grounding
- current slice identification
- implementation planning
- architecture consistency
- subagent task decomposition
- final integration
- verification selection
- review completion
- feature list updates
- progress log updates
- handoff updates

The primary agent must not rely on memory. It must read:

1. `docs/Tracks/mvp/02_Feature_List.json`
2. `docs/Tracks/mvp/process/progress.md`
3. relevant support docs for the current slice
4. actual code

## Subagent Rules

Subagents may be used only for bounded, concrete work that can run in parallel without replacing project control.

Allowed subagent work:

- codebase exploration
- retailer adapter investigation
- isolated implementation tasks with clear file ownership
- targeted test/debug passes
- design compliance checks
- UX review checks
- code review checks

Subagents must not:

- change locked architecture decisions
- decide feature sequencing
- update the canonical feature list unless explicitly assigned
- silently broaden scope
- implement overlapping file ownership in parallel
- treat exploratory findings as final without primary-agent integration

## Delegation Contract

Every delegated task must state:

- current slice
- exact task
- files or package boundaries owned
- dependencies
- expected output
- verification expectation
- instruction not to revert unrelated edits

## Integration Rule

The primary agent must inspect subagent results before treating work as complete. Subagent completion does not close a slice.

## Review Model

Use review passes based on change type:

- Design Guardian: visual/layout/component/responsive changes
- UX Guardian: flow/copy/interaction changes
- Prompt/Domain Guardian: AI prompts, product matching, domain logic
- Code Review: bugs, regressions, contract mismatches, missing tests
- Stakeholder Walk: product feel, client-facing quality, or business judgment

Review findings must be resolved or documented as explicit deferrals.

## Closure Rule

A slice is closed only after:

1. implementation is complete within boundaries
2. verification is run or explicitly deferred
3. required review passes are complete
4. verification doc is updated
5. progress log is updated
6. feature list `passes` is changed to true
7. handoff is refreshed if useful

## Current Track

The active track is `mvp`.

The canonical next slice is determined by the first item in `docs/Tracks/mvp/02_Feature_List.json` where `passes == false`.
