# PM-001 Aesthetic Taste Gate Local QA

Date: 2026-05-27
Branch: `codex/pm001-aesthetic-taste-gate`
Scope: founder-approved local/dev investor-demo rescue for catalogue-grounded living-room concept generation.

## Boundary

Allowed:
- Local/dev-only selection quality layer behind `RITZY_AESTHETIC_TASTE_GATE=1` and `NODE_ENV !== "production"`.
- Existing ingested catalogue products only.
- Focused domain/app/AI prompt/test changes for investor-demo validation.

Not done:
- No production deploys or production flags.
- No live ingestion or catalogue writes.
- No DB/schema/generated type changes.
- No payment/checkout changes.
- No floor-plan work.

## Failure Diagnosed

The original technical catalogue grounding was working, but aesthetic arbitration was too weak:
- "Chair" / `armchairs` accepted swivel, recliner, shell, pedestal, outdoor/wire, and hard-frame seating that did not belong in a soft traditional living room.
- Coffee-table scoring allowed noisy/statement pieces against patterned rugs.
- A small role pool plus entry-price fallback could suppress visually suitable low-price fabric chairs while surfacing worse expensive options.
- Provider image upload failed when a catalogue CDN returned `image/jpg`.
- The image prompt needed a stricter local preservation layer after a render closed/changed visible room structure.

## Current Local Evidence

Validation harness:
- Worktree: `/tmp/ritzy-aesthetic-taste-gate`
- Harness: `/tmp/ritzy-aesthetic-validation/run-render.ts`
- Output image: `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/assets/2026-05-27-aesthetic-taste-gate.png`
- Original local output: `/tmp/ritzy-aesthetic-validation/aesthetic-gate-1779877266015.png`
- Provider/model: OpenAI `gpt-image-2`
- Latency: 188.05 seconds
- Gemini: not used locally because Gemini credentials were not present in this worktree.

Selected catalogue anchors:
- Anchor seating: Victor 2 Seater Sofa Beige, Chattels & More.
- Secondary seating: Rudnick Fabric Armchair, Home Centre.
- Coffee table: Kinzie Sintered Stone Top Coffee Table, Home Centre.
- Rug: Galeria Lux Modern Geometrics Rug 240x340 White Gold, Danube Home.

Warnings retained:
- Entry-price coffee-table fallbacks were held back.
- Entry-price rug fallbacks were held back.

## Aesthetic Review

Score: 9.0/10 for investor-demo use.

Passes:
- No office/task/dining/shell/pedestal/swivel/recliner/outdoor/wire chair is selected.
- The selected chair is a beige fabric living-room armchair and harmonizes with the sofa.
- The selected coffee table is quiet, premium, and stone-led rather than striped/noisy.
- The selected rug is controlled white/gold geometry and no longer fights a statement table.
- The rendered room is coherent: sage wall, warm oak, brass, beige upholstery, soft fabric chair, stone table, restrained rug.
- Visible openings/sightlines are preserved well enough for demo validation.

Caveats:
- Image generation remains probabilistic; the strict preservation layer reduces, but cannot fully eliminate, non-structural embellishments such as wall paneling or lighting interpretation.
- Full browser-click E2E still needs a logged-in local session; local service-role harness validated the same product/image path without writing catalogue data.

## Shopping-List Preservation Check

Read-only shopping-list simulation against the same room and catalogue pool verified that the rendered catalogue anchors are preserved and preselected for shopping-list roles:
- Sofa selected: Victor 2 Seater Sofa Beige.
- Armchair selected: Rudnick Fabric Armchair.
- Coffee table selected: Kinzie Sintered Stone Top Coffee Table.
- Rug selected: Galeria Lux Modern Geometrics Rug 240x340 White Gold.

The local aesthetic gate also reorders and prunes optional supporting recommendations for the demo path so weak filler groups are omitted instead of showing visibly unsuitable products. The post-polish supporting recommendations retained for the validation room were restrained lighting, mirrors, and vase/planter decor; weak side-table, wall-art, and storage groups were dropped when the available options did not clear the demo credibility filter.

## Checks

Passed:
- `pnpm --filter @ritzy-studio/domain test`
- `pnpm --filter @ritzy-studio/ai test`
- `pnpm --filter @ritzy-studio/web typecheck`
- `pnpm --filter @ritzy-studio/web lint`
- `git diff --check`
