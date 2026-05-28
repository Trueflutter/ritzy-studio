# PM-001 Support-Role Quality + Timeout Diagnosis

Owner: Product Matching Agent
Ticket: PM-001
Scope: local/dev-only support-role ranking, fallback-family filtering, and timeout diagnostics after PR #226, PR #227, and PR #228.

## What Changed

- Support-role ranking now downranks dark/off-theme wall art, mirrors, lighting, textiles, decor, and media/storage options when the room cue is soft neutral and the role itself did not explicitly ask for a dark finish.
- Support roles now get focused role-fit language for side tables, wall art, mirrors, lighting, curtains/textiles, decor, and media/storage, including penalties for bedside-table, utility-wall, novelty-lighting, utility-textile, and furniture-as-decor mismatches.
- Deterministic text fallback keeps the same Product Matching boundary but uses a family-adjusted score so credible support-role options with warm-neutral cues are favored over dark/off-theme alternatives in the fallback path.
- Product sourcing output summaries now include timeout diagnostics when the initial visual sourcing attempt succeeds, times out and falls back, times out and fallback fails, or fails without timeout.

## Local/Dev Readback

Read-only script:

```bash
pnpm exec tsx /tmp/ritzy-pm001-support-role-validation.ts
```

Evidence output:

```text
/tmp/pm001-support-role-validation.json
```

Current demo evidence:

- Project: `b8b1cf67-cc0c-43bf-87c4-edce2d2c4ab2`
- Room: `8ba3a184-8beb-45a3-a5e6-d0696e8073ef`
- Room type: `Living Room`
- Candidate count read: `875`
- Writes performed: none

Top support-role readback after this change:

| Role | Top result | Family signal |
| --- | --- | --- |
| Side or end tables | Beam Side Table, Grey Marble, Dia43Cm | grey, brass, marble, metal |
| Floor or table lighting | Fonzie Wooden Floor Lamp - 158 cm | grey, wood |
| Wall art or focal wall | Souq DESIGNS Wooden Wall Panel White | white, wood |
| Mirror | Mackenzie Leaner Mirror - 180x80 cm | white, wood |
| Curtains or textile layer | No candidates | missing role documented, not faked |
| Cushions, tray, ceramics, and decor | Suhour Honeycomb Planter With Stand Sml White/Gold | white, brass, metal |
| TV media console or built-in media unit | White 2-Door Storage Cabinet | white, wood |

The readback now records dark/off-theme weakness reasons for lighting, wall art, mirrors, decor, and media/storage, and the top three options for those roles stay in the warm-neutral or light-material family where the existing catalogue has candidates.

## Timeout Diagnostics

New `productSourcingTimeoutDiagnostics` fields in `ai_jobs.output_summary`:

- `initialAttemptDurationMs`
- `timeoutMs`
- `timedOut`
- `fallbackUsed`
- `fallbackReason`
- `candidateCount`
- `rolePoolCount`
- `conceptImageDetail`
- `candidateImageLimit`
- `productCandidateImagesEnabled`

This makes timeout fallback evidence explicit without changing the provider timeout, production flags, catalogue writes, schema, generated types, prompt behavior, or default-on activation. The current visual-sourcing path still has `candidateImageLimit: 0`, so timeout diagnosis can distinguish concept-image-only visual sourcing from deterministic text fallback.

## Remaining Caveats

- This PR does not run a new browser-click preview or app action.
- Curtains/textiles remain missing in the current demo readback because the existing catalogue query has no `curtains` candidates for this room.
- Final render fidelity to selected SKUs still needs a separately approved browser/local validation boundary.
- Production rollout, broad allowlist expansion, catalogue writes, schema/type changes, UI/prompt/payment/checkout changes, floor-plan work, and Catalog-First runtime coupling remain out of scope.
