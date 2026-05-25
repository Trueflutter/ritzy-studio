# Home Office Desk Role Quality Investigation

Runtime impact: narrow default-off domain scoring only. No prompt, app-action flow, UI, DB/schema, generated DB type, production flag, deployment, Catalog-First coupling, or live catalog/shopping-list write changes.

## Scope

This note follows the Chief Architect option-1 approval after PR #108: investigate why the home-office/study required desk role was resolving only as `closest_available`, and prefer role-quality scoring evidence before any broader behavior change.

## Finding

The May 24 timeout/payload investigation showed the home-office/study run completed with a healthy required desk candidate pool, but the required `desks::desk` role still failed the QA gate as `closest_available`.

The deterministic scoring gap was in the role-scoped desk ranking path. Desk candidates received generic category, color, material, and silhouette scoring, but there was no desk-specific role-quality scoring for wood/oak/writing desk cues. In a representative local scorer check, a black metal desk could outrank an oak writing desk because black/metal accent cues outweighed the more important wood writing-desk surface cue.

## Fix

The default-off Product Matching domain scorer now adds a narrow desk-specific role-quality adjustment:

- Reward desk/writing/workstation language for `desks` roles.
- Reward wood/oak/walnut/writing desk language when the role/concept cue asks for it.
- Penalize metal/steel/glass-only desk candidates when the role/concept cue asks for a wood/oak/writing desk.

This stays inside role-scoped candidate scoring and does not alter prompts, stop rules, app actions, UI, DB/schema, production flags, deployments, live writes, or Catalog-First runtime coupling.

## Evidence

Added deterministic coverage in `packages/domain/src/product-matching.test.ts`:

- Scenario: `home office`, concept `warm oak writing desk with slim black legs`.
- Candidates: `Smart Black Metal Office Desk` and `Oak Writing Desk`.
- Expected result: `Oak Writing Desk` ranks first.
- Expected weakness evidence: the black metal desk records `metal or glass desk is weak for requested wood desk role`.

Targeted command:

```bash
pnpm --filter @ritzy-studio/domain exec tsx src/product-matching.test.ts
```

Result: passed.

## Readiness Impact

This clears a deterministic role-scoped desk ranking gap, but it does not by itself clear the home-office/study readiness blocker.

Controlled default-off preview remains blocked until a fresh read-only visual QA run shows the required home-office/study desk role resolves as `strong_match` or `acceptable_match`, not `closest_available`, and the QA stop rules pass.
