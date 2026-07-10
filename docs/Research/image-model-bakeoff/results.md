# Ritzy Studio Image Model Bake-Off Results

Run date: 2026-05-21, local branch `codex/image-model-bakeoff`.

## Executive summary

Correction from the earlier Imagen-only pass: Google can run the reference-image workflow. The working Google path is **Gemini native image generation**, not Imagen 4 Fast/Standard.

Best current recommendation: continue testing before production switch, but treat `gemini-3.1-flash-image-preview` as the strongest Google candidate for Ritzy. It accepts source/reference images, is much faster than the current OpenAI path in this bake-off, and produced plausible concept/final-render outputs. OpenAI still produced strong concept quality, but the Google Gemini path is now clearly worth a serious second round with tighter prompts and multiple seeds.

Key facts:

- `gemini-3.1-flash-image-preview` works on Vertex AI `global`; the non-preview ID `gemini-3.1-flash-image` fails.
- `gemini-3-pro-image-preview` works on Vertex AI `global`; it is slower than 3.1 Flash preview but still faster than OpenAI in this run.
- `gemini-2.5-flash-image` works on Vertex AI `us-central1`.
- Imagen 4 Fast/Standard work on Vertex AI `us-central1`, but are text-to-image only and are not a replacement for the source-room/product-reference workflow.

## Methodology

Controlled scenarios:

1. Living room concept generation from the same source room photo.
2. Dining room concept generation from the same source room photo.
3. Final grounded render using source room, selected concept seed, and catalog product references.

OpenAI and Gemini native image models received image inputs. Imagen 4 models were retained as a text-to-image speed/cost baseline only.

Full run metadata is in `outputs/manifest.json`.

## Official-doc findings

Google:

- Gemini image generation/editing supports text-and-image input for native image generation. Source: [Gemini API image generation docs](https://ai.google.dev/gemini-api/docs/image-generation), [Vertex AI Gemini image generation docs](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/image-generation).
- Vertex model routing observed in the live project:
  - `gemini-3.1-flash-image-preview`: works in `global`.
  - `gemini-3-pro-image-preview`: works in `global`.
  - `gemini-2.5-flash-image`: works in `us-central1`.
  - `gemini-3.1-flash-image`: fails in `us-central1` and `global`; missing `-preview`.
- Imagen 4 Fast/Standard are valid Vertex models in `us-central1`, but official docs list text input only and no product/image editing support. Source: [Google Imagen 4 docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/imagen/4-0-generate-001).

OpenAI:

- OpenAI Images API supports image editing with image inputs. Source: [OpenAI image generation guide](https://platform.openai.com/docs/guides/image-generation), [OpenAI Images API reference](https://platform.openai.com/docs/api-reference/images).
- The repo currently uses `gpt-image-2`; local API calls succeeded, but current official docs checked here did not list exact pricing for that model.

## Comparison table

| Scenario | Provider/model | Input images used | Status | Latency | Output |
|---|---:|---:|---:|---:|---|
| Living concept | OpenAI `gpt-image-2` | Source room | Completed | 167.21s | `outputs/living-room-concept--openai--gpt-image-2.png` |
| Living concept | Gemini `gemini-3.1-flash-image-preview` | Source room | Completed | 16.35s | `outputs/living-room-concept--vertex--gemini-3.1-flash-image-preview.png` |
| Living concept | Gemini `gemini-3-pro-image-preview` | Source room | Completed | 52.20s | `outputs/living-room-concept--vertex--gemini-3-pro-image-preview.png` |
| Living concept | Gemini `gemini-2.5-flash-image` | Source room | Completed | 13.31s | `outputs/living-room-concept--vertex--gemini-2.5-flash-image.png` |
| Dining concept | OpenAI `gpt-image-2` | Source room | Completed | 138.50s | `outputs/dining-room-concept--openai--gpt-image-2.png` |
| Dining concept | Gemini `gemini-3.1-flash-image-preview` | Source room | Completed | 14.18s | `outputs/dining-room-concept--vertex--gemini-3.1-flash-image-preview.png` |
| Dining concept | Gemini `gemini-3-pro-image-preview` | Source room | Completed | 35.67s | `outputs/dining-room-concept--vertex--gemini-3-pro-image-preview.png` |
| Dining concept | Gemini `gemini-2.5-flash-image` | Source room | Completed | 13.56s | `outputs/dining-room-concept--vertex--gemini-2.5-flash-image.png` |
| Final grounded render | OpenAI `gpt-image-2` | Source room, concept, product refs | Completed | 154.93s | `outputs/final-grounded-render--openai--gpt-image-2.png` |
| Final grounded render | Gemini `gemini-3.1-flash-image-preview` | Source room, concept, product contact sheet | Completed | 17.79s | `outputs/final-grounded-render--vertex--gemini-3.1-flash-image-preview.png` |
| Final grounded render | Gemini `gemini-3-pro-image-preview` | Source room, concept, product contact sheet | Completed | 27.88s | `outputs/final-grounded-render--vertex--gemini-3-pro-image-preview.png` |
| Final grounded render | Gemini `gemini-2.5-flash-image` | Source room, concept, product contact sheet | Completed | 14.25s | `outputs/final-grounded-render--vertex--gemini-2.5-flash-image.png` |
| Living probe | Gemini `gemini-3.1-flash-image` | Source room | Error | 2.17s | Model not found; use `gemini-3.1-flash-image-preview` |

## Scoring snapshot

Scores are initial visual review only, 1-5. A more reliable decision should rerun multiple seeds per model.

| Scenario | Provider/model | Photorealism | Design quality | Architecture preservation | Product fidelity | Lighting realism | Speed | Overall suitability |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Living concept | OpenAI `gpt-image-2` | 4.5 | 4.0 | 4.0 | N/A | 4.5 | 2.0 | 4.0 |
| Living concept | Gemini 3.1 Flash preview | 4.0 | 3.5 | 3.0 | N/A | 4.0 | 4.5 | 3.5 |
| Living concept | Gemini 3 Pro preview | 4.0 | 3.5 | 3.0 | N/A | 4.0 | 3.5 | 3.5 |
| Dining concept | OpenAI `gpt-image-2` | 4.5 | 4.0 | 3.5 | N/A | 4.5 | 2.5 | 4.0 |
| Dining concept | Gemini 3.1 Flash preview | 4.0 | 3.5 | 3.0 | N/A | 4.0 | 4.5 | 3.5 |
| Dining concept | Gemini 3 Pro preview | 4.5 | 4.0 | 3.0 | N/A | 4.5 | 3.5 | 4.0 |
| Final grounded render | OpenAI `gpt-image-2` | 4.0 | 3.5 | 2.5 | 3.0 | 4.0 | 2.0 | 3.0 |
| Final grounded render | Gemini 3.1 Flash preview | 4.0 | 4.0 | 3.0 | 3.5 | 4.0 | 4.5 | 4.0 |
| Final grounded render | Gemini 3 Pro preview | 4.0 | 4.0 | 3.0 | 3.5 | 4.0 | 3.5 | 4.0 |

## Visual observations

- Google Gemini native image outputs are real competitors; this is not the same category as Imagen 4 text-to-image.
- `gemini-3.1-flash-image-preview` preserved enough room/reference context to warrant deeper testing and was roughly 9-10x faster than OpenAI in these runs.
- `gemini-3-pro-image-preview` produced polished dining and final-render outputs, but was slower than 3.1 Flash preview.
- Product fidelity is still not proven. The product contact-sheet workaround helped, but the next run should pass individual product refs if the model supports more inputs reliably, or use tighter labeling/cropping.
- OpenAI still has strong concept quality, but its latency is a serious issue for interactive workflows.

## Recommendation

Do not switch production yet, but revise the bake-off conclusion:

- Keep OpenAI as the production-safe path for now.
- Continue a focused second-round bake-off against `gemini-3.1-flash-image-preview` and `gemini-3-pro-image-preview`.
- Drop Imagen 4 Fast/Standard from the source-room/product-grounded bake-off; keep them only as optional text-to-image moodboard baselines.
- Next test should run 3-5 seeds per scenario, individual product-reference images where supported, stricter product-color prompts, and side-by-side Sam/chief-architect scoring.
