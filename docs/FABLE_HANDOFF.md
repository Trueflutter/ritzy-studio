# Ritzy Studio — Build to World-Class. Handoff to Fable.

You are the strongest model on this codebase. I am handing you a working but underwhelming interior-design app and asking you to make it genuinely world-class in the next 72 hours, then keep going. This brief is grounded in a fresh review of the current `main` branch. Read it, then read the docs it points to, then run the app against the real production renderer and reproduce the failures yourself before you decide your plan.

Do not feel bound by the narrow, self-imposed constraints the previous work operated under (no schema changes, no re-ingestion, no new model calls, heuristics only, everything flag-gated off). Those constraints shipped a safe beta but capped quality at "okay." I am explicitly lifting them for you. See "Freedoms."

## 0. Start from `main`. It is further along than you may expect.

Base all work on `origin/main` (up to date, ~PR #309). A large amount of good work is already merged there. In particular, `main` has ALREADY shipped:

- Combined "Living & Dining" room type end to end: canonical room type, a room selector that shows it first, combined-hall zoning prompt language, and combined product roles.
- Spatial prose guardrails that are injected into the image prompts today: focal-placement, anti-cant ("do not cant the sofa diagonally"), L-align, and combined-hall zoning.
- A structured spatial-rules engine (`packages/domain/src/spatial-design-rules.ts`) with hard-checkable envelopes and a living-only-vs-combined gate. It is built and tested but DORMANT (exported, never called in the live path).
- Product-matching fixes: selected-vs-alternate consistency, role purity, anti-stall text fallback, lighting-role guards, applied diversity, bedside-role normalization, and a controlled-preview cohort gate for the scoring engine.

So do not re-solve these. Confirm them, then push past them.

## 1. What the product is, and the quality bar

Ritzy Studio turns a photo of a real room into a beautiful, buyable interior design. A user (a Dubai residential interior designer, or a homeowner) uploads a room photo, answers a short brief, and the app generates a design concept, then a shopping list of real, purchasable furniture that matches that concept, then a client-ready final render and presentation.

The quality bar, in the owner's own words from `docs/Vision/`:

- "A private interior studio rendered in software: visual, precise, restrained, and honest about uncertainty."
- "Premium, editorial, quiet, truthful." It must NOT feel like a consumer AI toy (no purple gradients, glow orbs, sparkle icons, "magic" copy), a SaaS dashboard, or a retail site.
- Generated images should read as "high-end editorial interior photography," not CGI showroom, not generic beige luxury.
- The design system is LOCKED (`docs/Vision/05_Brand_and_Design_System.md`, "Quiet Gallery"): Cormorant Garamond x DM Sans, Bone/Paper/Ochre palette, square corners, 1px hairlines, no dark mode. Do not redesign the visual language. Work inside it.

"World class" means: a real person, taking a real photo of their real room (furnished or empty), gets back a design a professional would be proud to present and a furniture list they would actually buy. Today it does not clear that bar. That is the job.

## 2. The core architecture is decided. Do not reopen it.

Concept-first is locked (`docs/Tracks/mvp/adr/0001-concept-first-product-grounded-workflow.md`, Accepted): design a concept freely, then ground it in real products, then re-render against the chosen products. Fidelity ("what you see is buyable") is guaranteed by truth separation (`adr/0003`): the shopping list is database truth, never inferred from render pixels. A catalog-first path (build the concept FROM stock) exists as a maintained, tested scaffold in `packages/domain/src/catalog-first-*.ts` but is deliberately NOT wired into the live app.

Keep this spine. The one refinement to consider: make the concept catalog-aware (design within an envelope the catalog can actually fill: category, style, price band, real dimensions) so matching and the grounded render stop fighting the design. This resolves the aspiration-vs-fidelity tension instead of picking a side.

## 3. Stack, live pipeline, models

- pnpm monorepo, Next.js 16, RSC. Supabase (Postgres + Storage + Auth + RLS). Stripe billing.
- Almost everything runs through Next.js Server Actions in `apps/web/app/actions.ts`. Only one real HTTP route (Stripe webhook). AI in `packages/ai/src/index.ts`; prompts in `packages/prompts/src/`; matching/domain in `packages/domain/src/`.
- Models: text + all vision = `gpt-5-mini` (OpenAI Responses API). Embeddings = `text-embedding-3-small`. Image generation is provider-routed via `RITZY_IMAGE_PROVIDER`; production uses Gemini `gemini-3.1-flash-image-preview`. Image generation is an image-to-image edit with reference images + a text prompt.
- IMAGE PROVIDER NOTE: the production Gemini path currently authenticates to Google Vertex with a Bearer `VERTEX_ACCESS_TOKEN`, which expires hourly and makes local testing painful. An Evolink gateway key (`EVOLINK_API_KEY`, static) is now in `.env.local` and is confirmed working against the same `gemini-3.1-flash-image-preview` model (and `gpt-image-2`). Evolink is NOT yet wired into the code. Wiring it is a contained job and is your fastest route to reliable local/prod-parity testing. See Appendix A for the exact contract. Do all design-fidelity verification against the real Gemini renderer, not `gpt-image-2`, so you tune to what beta users see.

Live flow: login -> onboarding -> project -> room -> upload photo -> 4-step brief -> initial concept -> select concept -> ground products -> shopping list -> final grounded render -> presentation -> unlock (Stripe) -> retailer deep links. No in-app checkout, intentionally out of scope.

The bones work. Do not tear them down. Make them excellent.

## 4. Problem area 1: spatial awareness and design principles

`main` has already shipped combined living-dining and the prose spatial guardrails (anti-cant, L-align, focal placement, hall zoning), and they are injected into the image prompts. So the "slanted sofa" and "never asks living-vs-combined" faux pas are addressed at the prose level. What remains genuinely missing (verified on `main`):

- No geometric spatial reasoning anywhere in the live path. No depth, segmentation, perspective, masking, or layout solving. Spatial correctness is still delegated to prose sent to a general image model.
- The uploaded floor plan is captured but never fed to any AI call. Room measurements never reach the image model (they only enter the text brief). Real spatial input is being discarded.
- The structured spatial-rules engine (`packages/domain/src/spatial-design-rules.ts`) is DORMANT. It has hard-checkable envelopes, a layout-mode gate, and designer warnings, but nothing in `apps/web` calls it. Wiring it into the flow (capture intent, check facts, warn) is close to free value.
- No post-render QA. Nothing verifies the rendered image actually obeys the guardrails (seating faces the focal point, sofa square to wall, plausible scale). Faux pas still ship silently.

The design-intelligence plan and rule corpus are in `docs/Tracks/v2-commercial/design-intelligence/` (rescued and committed). Read `DESIGN_SPATIAL_RULES_RESEARCH_AND_IMPLEMENTATION_PLAN.md` and `DESIGN_SPATIAL_RULES_CORPUS.md`. They were written to be safe and additive. You do not have to be. If real geometry, using the floor plan and measurements, wiring the structured rules, or a vision-QA loop is the right answer, build it.

## 5. Problem area 2: furniture matching (repeats + random/ugly pieces)

`main` has fixed several matching bugs since the owner last looked: the selected-vs-alternate inconsistency is fixed (selected and alternates now come from one pool), diversity is now actually applied to selection (not just logged as telemetry), and role purity, anti-stall text fallback, lighting-role guards, and bedside normalization all shipped. What remains real in the DEFAULT production path (verified on `main`):

- The real color/material/silhouette scoring engine is OFF by default (`RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED` defaults `false`). With it off, the live ranker is `scoreCandidate`, which has no color/material/style-coherence term (category, keyword overlap, image, budget, stock, dimension fit only). The good scoring exists (`scoreProductCandidateForRole`, `assessAestheticFitForRole`) but only runs under the flag or a controlled-preview cohort gate. Turning it on and validating it is high-leverage.
- Aesthetic coherence is measured against TEXT TOKENS, never against the actual palette of the generated concept image. Only the LLM vision call sees the concept image, and a deterministic re-rank can override its picks. So a beige concept can still be matched to an off-palette product.
- `product_embeddings` (pgvector, 1536-dim, ivfflat) are written during enrichment and NEVER read by matching. RLS even blocks reads (`using(false)`). Real semantic/visual similarity infrastructure is sitting unused.
- Repetition persists: catalog is read in fixed deterministic order (`last_checked_at desc`, limit 1500), the LLM only ever sees the same top ~36 candidates, tie-breaks are deterministic, and there is NO cross-project or per-user "already used" exclusion (the only exclusion is within a single list). The same anchors surface across rooms.
- The catalog is sparse and partially enriched (pervasive "unavailable" fallbacks). A thin catalog is likely a bigger driver of repeats and bad matches than the algorithm.

The full code-grounded diagnosis and repair plan is `docs/Tracks/v2-commercial/product-matching-evals/PM001_RECOMMENDATION_ENGINE_REPAIR_PLAN.md` (rescued and committed). Read it, but note its line numbers predate 372 commits of `main` work; re-confirm before editing. It deliberately forbade schema changes, re-ingestion, new model calls, and vector search. You are not bound by those. If the right answer is enabling the engine, real embedding/vision matching against the concept image, cross-project exclusion, better taxonomy at ingest, and a deeper catalog, build it.

## 6. Problem area 3: it renders like one snapshot, not like a designer working a room

Two linked gaps the owner has explicitly called out. Both are STILL TRUE on `main`. Treat them as first-class.

- Output is a single camera angle. A designer presents a room from several viewpoints. Generation must produce at minimum 3 concept views from different but coherent camera angles of the SAME designed room (for example a wide establishing shot, a seating-group view, and a secondary-zone or detail view), not one image. Today `generateInitialConcept` returns exactly one image and the prompts explicitly preserve the single source viewpoint. The hard part is consistency: the angles must show the same furniture, palette, and layout from different positions, not three different rooms. Solve that. It also gives the spatial system more surfaces to get right and to QA.
- Input is a single room photo. The concept action selects one `room_photo` (order by created_at, limit 1) and passes only that to the image model. The app should insist on 2-3 photos of the room at upload, ideally the empty room from different corners, and feed all of them to the model, so it has real spatial coverage instead of hallucinating occluded walls from one frame. Empty-room capture very likely improves spatial fidelity; if you confirm that, make guided multi-photo (and empty-room) capture the default and explain the why in-flow.

Multi-photo in, multi-angle out, all mutually consistent. This is a large part of what will make the app feel like a real designer.

## 7. Freedoms (this is the important part)

I am removing the prior constraints. You may:

- Change the DB schema and migrations where it genuinely improves quality (spatial intent, richer taxonomy, room scope). Keep generated types in sync.
- Re-ingest or re-enrich the catalog with a better taxonomy, improve retailer adapters, deepen the catalog so role pools are not thin.
- Use the models fully: turn on and validate the scoring engine; wire the dormant embeddings into vector/visual matching; score aesthetic coherence against the actual concept-image palette; add a vision-QA pass over renders; extract structured spatial intent. Add model calls where they earn their place.
- Wire the dormant spatial-rules engine into the live flow.
- Introduce depth/segmentation/layout conditioning on image generation if that is what spatial correctness needs.
- Rethink friction (for example, measurements currently gate concept generation; a great app should degrade gracefully when a user just wants to snap a photo).

If you keep something simple for the deadline, say so explicitly and record it as a deliberate tradeoff, not a silent cap.

## 8. High-leverage opportunities (pointers, not prescriptions)

- Fastest wins: wire Evolink for reliable Gemini testing (Appendix A); enable and validate the scoring engine; wire the dormant spatial-rules engine; add cross-project exclusion so pieces stop repeating.
- Use the concept-image palette for matching coherence (not just text tokens), and wire the unused embeddings into real similarity search.
- Catalog depth may matter more than the ranker. A focused re-ingest/enrich of the lead retailer (Home Centre) so every role has a deep, well-tagged pool is probably high value.
- Multi-photo in, multi-angle out (section 6).
- Post-render vision QA that scores focal orientation, sofa alignment, scale, and style adherence; regenerate or warn on failure.
- Render durability: the final render runs in an in-request `after()` task with a 15-minute staleness heuristic, not a durable queue. Fragile under beta load. Consider hardening.

## 9. Go beyond the named problems

Treat the whole experience as yours to elevate: onboarding, the brief flow, concept variety and revision, the shopping-list interaction, presentation/reveal, empty and error states, latency and perceived speed, trust and honesty cues, accessibility. If you see a way to make it materially better, propose it and do it.

## 10. Non-negotiables and guardrails

- Keep the working flows working. Ships to real beta users in 72 hours. Prefer staged, verifiable increments over a big-bang rewrite. Land value continuously.
- Respect the locked design system (Quiet Gallery). No consumer-AI-toy styling.
- Preserve truth separation: the shopping list is database truth; never claim exact-SKU rendering; keep honesty-about-uncertainty cues.
- Security and privacy: every query filters by user context; keep Supabase RLS intact; do not weaken ownership checks; never print or commit secrets; verify `.env*` is gitignored.
- Branch before you touch files. Conventional commits. Do not merge without the owner's approval. Open PRs for review.
- VERIFY IN THE REAL APP, NOT JUST IN TESTS. Take an actual room photo (furnished and empty), run the full flow, and look at the output with your own eyes, against the PRODUCTION Gemini renderer (use Evolink, Appendix A). `pnpm check` must pass, but green tests are not the bar. The bar is: does a real user get a world-class result.
- If you change schema, write real migrations and keep generated types in sync.

## 11. Definition of done for the beta

A real person takes a photo of their room, furnished or empty, and:

1. The app understands the space well enough to place furniture like a designer would (seating faces the focal point, scale and circulation plausible, combined living+dining handled). Capture guides the user to 2-3 photos.
2. The generated design is beautiful, on-brief, consistent with the locked visual language, and presented as at least 3 mutually-consistent camera angles of the same room, not a single snapshot.
3. The furniture list is coherent with the design, class-correct, non-repeating across rooms, aesthetically aligned to the concept image, and every item is real and buyable.
4. The final render and presentation are client-ready.
5. It simply works, end to end, reliably, within sane latency, for the beta group.

## 12. Where to start

1. Base off `origin/main`. Read: this brief; the rescued diagnosis docs (`PM001_RECOMMENDATION_ENGINE_REPAIR_PLAN.md`, `design-intelligence/DESIGN_SPATIAL_RULES_RESEARCH_AND_IMPLEMENTATION_PLAN.md`); the ADRs (`0001`, `0003`); the vision (`docs/Vision/02_Vision_Document.md`, `05_Brand_and_Design_System.md`); the prompt bible (`docs/Design/Ritzy_Interior_Prompt_Bible.md`). Re-confirm any file:line before editing; the diagnosis docs predate recent `main` work.
2. Run it: `pnpm install`, set env, `pnpm dev`. Wire Evolink (Appendix A) and set `RITZY_IMAGE_PROVIDER` to it so Gemini works locally with the static key. Walk the whole flow with a couple of real room photos (furnished and empty). Reproduce the repetition, the text-token-only matching, the single-angle output, and any spatial faux pas yourself, against Gemini.
3. Then write your own plan. Sequence for continuous, shippable value under the 72-hour deadline. State your tradeoffs. Build, verify in the real app, open PRs.

You have more capability than the code currently expresses. Use it. Make it world-class.

## Appendix A — Evolink image provider (confirmed working, not yet wired)

Evolink is a gateway serving the same `gemini-3.1-flash-image-preview` (and `gpt-image-2`, `gemini-3-pro-image-preview`) behind a static key. It replaces the hourly-expiring Vertex token for testing and can be a production option. Probed and confirmed: key authenticates, model available, generation + poll + retrieval all work, output quality matches the editorial bar.

Contract:

- Submit: `POST https://api.evolink.ai/v1/images/generations`, header `Authorization: Bearer $EVOLINK_API_KEY`, JSON body:
  - `model`: `gemini-3.1-flash-image-preview`
  - `prompt`: string
  - `size`: aspect ratio, e.g. `16:9` (not WxH pixels)
  - `quality`: `1K` | `2K` | `4K`
  - `image_urls`: array of up to 14 reference image URLs for image-to-image/edit. IMPORTANT: URLs, not inline base64. Ritzy already stores room/concept renders in Supabase Storage (produce signed URLs) and product images are already URLs, so pass those.
  - Returns immediately: `{ id: "task-...", status: "processing", ... }`.
- Poll: `GET https://api.evolink.ai/v1/tasks/{id}` with the same Bearer header. When `status == "completed"`, the image URL(s) are in `results[]`. Statuses: `pending|processing|completed|failed`.

Integration notes:
- Add an `evolink` branch in `generateImageWithConfiguredProvider` (`packages/ai/src/index.ts`), allow `evolink` in the `RITZY_IMAGE_PROVIDER` enum and add `EVOLINK_API_KEY` in `packages/config/src/index.ts`.
- The async submit-then-poll model fits the final render (already backgrounded via `after()`) cleanly. The initial concept is currently synchronous inside a server action; poll within the action (est ~30s, within existing timeouts) or move it to a job.
- References must be URLs. Convert the current inline-bytes references to signed Storage URLs.
- This is also your chance to evaluate `gemini-3-pro-image-preview` (Nano Banana Pro) for higher-fidelity grounded renders.
