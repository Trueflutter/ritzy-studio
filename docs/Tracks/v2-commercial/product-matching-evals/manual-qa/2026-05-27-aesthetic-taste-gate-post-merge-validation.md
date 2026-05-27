# PM-001 Aesthetic Taste Gate Post-Merge Validation

Date: 2026-05-27
Validated main commit: `8698fcdf66c49c8d91f505802ed62e1360143b08`

## Scope

Docs/read-only post-merge validation of the PR #220 PM-001 local/dev aesthetic taste gate after PR #221 coordination cleanup.

No app actions, new Product Matching execution, controlled preview, catalogue writes, live ingestion, DB/schema/generated type changes, payment/checkout changes, floor-plan work, production flags, or deploys were performed.

## Main-State Evidence

Merged PRs:
- PR #220 merged at `abf2e517db19d8e1fd7cd2adcc6f11a01c82405b`.
- PR #221 merged at `8698fcdf66c49c8d91f505802ed62e1360143b08`.

Durable validation artifacts present on `main`:
- `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/2026-05-27-aesthetic-taste-gate.md`
- `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/assets/2026-05-27-aesthetic-taste-gate.png`

Recorded successful local/dev evidence:
- Aesthetic score: 9.0/10 for investor-demo use.
- Render provider/model: OpenAI `gpt-image-2`.
- Selected actual ingested catalogue anchors:
  - Victor 2 Seater Sofa Beige, Chattels & More.
  - Rudnick Fabric Armchair, Home Centre.
  - Kinzie Sintered Stone Top Coffee Table, Home Centre.
  - Galeria Lux Modern Geometrics Rug 240x340 White Gold, Danube Home.
- Shopping-list preservation simulation preserved and preselected the same rendered catalogue anchors.

## Main-Code Checks

Confirmed on `origin/main`:
- Local/dev aesthetic gate exists in `apps/web/app/actions.ts` via `localAestheticTasteGateEnabled()`.
- Shopping-list optional recommendation polish is gated and returns unchanged behavior when `RITZY_AESTHETIC_TASTE_GATE` is not enabled locally.
- Multiple same-category catalogue anchors are preserved with a `Set` per category before optional pruning.
- Strict source-room preservation prompt language is wired for initial concept and final grounded render in `packages/ai/src/index.ts`.

## Caveats

- This post-merge pass did not run a new browser-click E2E flow because that would require local authenticated app execution beyond this docs/read-only validation pass.
- The committed validation evidence proves the selected/rendered catalogue anchors and shopping-list preservation path for the approved local/dev investor-demo room; image generation remains probabilistic.
- No production/default-on behavior is approved by this merge. The implementation remains gated behind `RITZY_AESTHETIC_TASTE_GATE=1` and `NODE_ENV !== "production"`.

## Status

PR #220 is present on `main` with durable evidence and no known implementation blocker for the approved local/dev investor-demo path.
