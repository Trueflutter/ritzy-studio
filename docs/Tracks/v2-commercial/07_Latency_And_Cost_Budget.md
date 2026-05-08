# 07 Latency And Cost Budget

## Purpose

Keep V2 commercially viable. AI generation and image workflows must not create unbounded cost or unacceptable waiting.

## UX Latency Targets

| Action | Target |
| --- | --- |
| Login/dashboard navigation | under 2 seconds |
| Room/photo upload response | immediate UI feedback |
| Guided preference save | under 1 second |
| Clarifying questions | under 20 seconds |
| Initial concept generation | background job, visible progress |
| Product matching | under 45 seconds for normal catalog size |
| Final grounded render | background job, visible progress |
| Payment checkout creation | under 5 seconds |
| Retailer redirect | under 1 second after entitlement check |

## Cost Controls

Homeowner free experience must be cost-limited.

Controls:

- cap free concept generations
- require account before expensive generation
- cache room analysis
- reuse generated concept prompts
- run product matching after concept approval
- restrict final grounded render to paid/unlocked state

Designer subscription must be monitored.

Controls:

- track generation cost per designer account
- add fair-use limits if needed
- store job cost estimates
- expose admin cost report

## Background Jobs

Required for:

- concept generation
- product matching over large catalogs
- final render generation
- catalog ingestion
- feed refresh
- conversion import

Job records must store:

- status
- input references
- prompt version
- model/provider
- error
- created/completed timestamps

## Commercial Guardrails

- Do not let unpaid users trigger unlimited image generation.
- Do not let expired designer subscriptions trigger new final renders.
- Do not regenerate final render unnecessarily when selected product set has not changed.
- Prefer polling/durable status over request blocking for long AI operations.
