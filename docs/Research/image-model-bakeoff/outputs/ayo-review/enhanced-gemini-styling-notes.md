# Enhanced Ritzy Styling Notes

Run date: 2026-05-21

## Model

- Google provider: Google Vertex AI
- Google model: `gemini-3.1-flash-image-preview`
- Google location: `global`
- OpenAI model: `gpt-image-2`
- Prompt version/name: `enhanced-ritzy-styling-2026-05-21`

## Outputs

| Test | Latency | Output |
|---|---:|---|
| Gemini living room concept, enhanced Ritzy styling | 16.56s | `gemini-3.1-flash-image-preview--living-concept--enhanced-ritzy-styling--16.56s.png` |
| Gemini living final grounded render, enhanced Ritzy styling | 18.67s | `gemini-3.1-flash-image-preview--living-final-grounded--enhanced-ritzy-styling--18.67s.png` |
| OpenAI living room concept, exact same enhanced prompt | 142.98s | `openai-gpt-image-2--living-concept--enhanced-ritzy-styling--142.98s.png` |
| OpenAI living final grounded render, exact same enhanced prompt | 132.68s | `openai-gpt-image-2--living-final-grounded--enhanced-ritzy-styling--132.68s.png` |

## What changed versus baseline

The enhanced prompts added stronger Ritzy interior-design direction instead of relying on the plain baseline prompt. They explicitly asked for:

- editorial residential photography, not CGI showroom;
- high-end but livable Dubai villa/townhouse interior;
- finished interior-designer styling rather than bare staging;
- layered lighting, including lamps, picture lights, sconces, pendants, cove/ceiling lighting where appropriate;
- intentional wall treatment through art, mirrors, paneling, shelves, picture lights, or resolved negative space;
- correctly scaled rugs;
- material/color-specific sofa and seating direction;
- side tables, coffee-table styling, books, trays, vessels, branches/greenery, cushions, and throws;
- curtains/window treatment where softness is needed;
- source-room architecture preservation;
- product fidelity for selected catalog sofa/chair/table references in the final grounded render.

## Apples-to-apples method

Both providers used the exact same enhanced concept prompt file:

`docs/Research/image-model-bakeoff/prompts/living-room-concept-enhanced-ritzy-styling.md`

Both providers used the exact same enhanced final-grounded prompt file:

`docs/Research/image-model-bakeoff/prompts/final-grounded-render-enhanced-ritzy-styling.md`

Each provider's final grounded render used:

- the same source room image;
- that provider's own enhanced concept output as the concept reference;
- the same product-reference contact sheet.

## Visual review: Gemini

### Living room concept

The enhanced Gemini concept added materially stronger art direction than the earlier Gemini baseline. It includes wall art, picture lighting, a floor/task lamp, a large scaled rug, coffee-table styling, sideboard styling, books, vessels, greenery, curtains, and a more designer-finished seating composition. It no longer feels like a plain realist render.

Failures / watch items:

- Architecture preservation is only partial. The output strongly redesigns the room shell with black framing, fluted wall treatment, and a courtyard-like exterior view.
- It may be too architecturally assertive if the source photo must remain tightly preserved.
- Lighting is richer, but still not heavily layered beyond picture lights, cove light, and a floor/task lamp.
- No unwanted text, watermark, price tag, or retailer label observed.

### Final grounded render

The Gemini final grounded render kept the enhanced concept language and added stronger catalog-like furniture cues. It includes a rounded cream accent chair, a cream channeled sofa, marble/stone coffee table, large rug, art, picture lighting, floor lamp, sideboard styling, vessels, books, greenery, curtains, and a throw. It feels more finished, more decorated, and more Ritzy than the prior plain Gemini final output.

Product fidelity notes:

- The rounded cream accent chair appears directionally faithful to the product-reference intent.
- The sofa preserves a cream/light upholstery family and rounded/channeled residential feel, but exact SKU fidelity is not proven from the contact sheet.
- The table/color-material reference appears to influence the coffee-table material and contrast, but not exact product identity.
- Because catalog references were passed as a contact sheet, individual product fidelity remains a risk. A next test should pass individual product images if the model supports the full image count reliably.

Failures / watch items:

- Source architecture preservation remains the biggest concern. The model carries forward an invented/designed wall system and courtyard relationship from the enhanced concept.
- Product fidelity is visually improved but still representative rather than SKU-exact.
- It added a strong art/styling layer without fake TV, visible labels, watermarks, or shopping-list text.
- No obvious strange paintings, bad rug scale, or major unwanted text observed.

## Visual review: OpenAI

### Living room concept

The OpenAI enhanced concept is very strong on interior-design art direction. It adds a resolved lounge composition, warm cove lighting, picture light, floor lamp, large art, built-in shelf niche, layered styling, cushions, throw, greenery, side tables, coffee-table objects, and a premium villa/townhouse atmosphere. It feels more naturally "interior designer finished" than the plain baseline outputs.

Failures / watch items:

- Architecture preservation is also partial. OpenAI invents an arched niche, changes the room proportions, and adds a more Mediterranean/plaster villa shell.
- It is rich and attractive, but it still redesigns architectural features beyond a strict source-photo edit.
- No unwanted text, watermark, product label, or fake TV observed.

### Final grounded render

The OpenAI enhanced final grounded render is very polished and keeps the concept's art direction: warm cove lighting, large art, picture light, floor lamp, built-in niche, large rug, coffee-table styling, books, vessels, greenery, throws, pillows, curtains, and a complete seating composition. It also picks up the product-reference language with rounded cream lounge chairs and a channeled sofa.

Product fidelity notes:

- The rounded cream chairs appear directionally faithful to the reference style.
- The sofa preserves a cream/light upholstery family and channeled/residential feel, but exact SKU identity remains unproven from the contact sheet.
- The coffee table strongly reflects the table/material reference.

Failures / watch items:

- Still not SKU-exact.
- Architecture preservation is not strict; the output follows the concept shell rather than tightly preserving every source-room constraint.
- No unwanted text, watermark, labels, or fake TV observed.

## Provider comparison

| Test | Gemini 3.1 Flash Preview | OpenAI `gpt-image-2` |
|---|---:|---:|
| Enhanced living concept latency | 16.56s | 142.98s |
| Enhanced final grounded latency | 18.67s | 132.68s |

Art direction:

- OpenAI remains slightly stronger for polished, high-end interior-design composition out of the box with the enhanced prompt.
- Gemini improved substantially with the enhanced prompt and now has enough wall art, picture lighting, floor/task lighting, styling, rug scale, curtains, and decor to be a serious contender.

Speed:

- Gemini is dramatically faster on both runs.

Architecture preservation:

- Neither provider is strict enough yet. Both redesign architectural features when the prompt asks for richer design.
- Gemini's enhanced concept invents a black-framed/fluted wall system and courtyard relationship.
- OpenAI's enhanced concept invents an arched niche and more plaster villa architecture.

Product fidelity:

- Both are directionally faithful, not SKU-exact.
- Contact-sheet input is likely limiting fidelity. The next test should use individual product images with explicit labels if the model supports the image count.

## Takeaway

The stronger Ritzy prompt language closes a meaningful part of the art-direction gap for Gemini. OpenAI still has a slight edge in polished interior-design taste on this exact prompt, but Gemini is close enough visually, much faster, and still the stronger operational candidate if follow-up tests improve architecture and product constraint-following.

The remaining risk for both providers is not realism or styling; it is constraint-following. Before making Gemini primary, run one more focused pass that scores architecture preservation and product fidelity separately, ideally with individual catalog product references rather than a contact sheet.
