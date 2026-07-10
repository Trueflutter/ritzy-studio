# Ritzy Studio Image Model Bake-Off

Local-only evidence pack comparing Ritzy's current OpenAI image path with Google Imagen on Vertex AI for the two core image workflows:

1. Initial concept generation from a real room photo plus design brief.
2. Final grounded render from a selected room concept plus catalog product references.

## Boundary

- No production behavior changed.
- Imagen is not wired into the app.
- No Vercel environment variables were changed.
- Work is isolated on branch `codex/image-model-bakeoff`.
- Outputs are local evidence only.

## Contents

- `results.md` - executive summary, official-doc findings, scoring, and recommendation.
- `prompts/` - controlled prompts used for each scenario.
- `inputs/` - copied source room image, concept seed, and catalog product reference images.
- `outputs/` - generated images and `manifest.json` with timestamps, latency, prompts, inputs, and run notes.
- `scripts/run-bakeoff.ts` - local runner for OpenAI and capability-gated Vertex Imagen checks.

## Re-run

From the repo root:

```bash
pnpm exec tsx docs/Research/image-model-bakeoff/scripts/run-bakeoff.ts
```

Useful options:

```bash
BAKEOFF_REUSE_OUTPUTS=1 pnpm exec tsx docs/Research/image-model-bakeoff/scripts/run-bakeoff.ts
BAKEOFF_SCENARIOS=final-grounded-render pnpm exec tsx docs/Research/image-model-bakeoff/scripts/run-bakeoff.ts
```

The script loads `.env.local` for `OPENAI_API_KEY`. Vertex runs use `GOOGLE_APPLICATION_CREDENTIALS=/Users/ayoolatoye/.config/ritzy-studio/vertex-sa.json` or the local Google Cloud ADC login. Imagen 4 Fast/Standard runs are real text-to-image calls; the true Ritzy source-room/product-reference workflow remains unsupported by those models according to Google docs and the live API behavior recorded in `results.md`.
