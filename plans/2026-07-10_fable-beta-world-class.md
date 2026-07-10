# Fable: Beta World-Class Plan (72h)

**Date:** 2026-07-10
**Branch:** `fable/beta-world-class` (working branch; slices will be split into PR branches)
**Brief:** `docs/FABLE_HANDOFF.md` (read in full; grounded against current main)
**Companion:** `docs/FABLE_PROGRESS.md` is the living progress log. Read it first if resuming.

## Prime directive

A real person photographs their room (furnished or empty) and gets back a spatially sound,
beautiful, on-brief design shown from at least 3 mutually consistent camera angles, matched to
real, non-repeating, aesthetically coherent, buyable furniture, in a client-ready presentation.

## Blocking discovery (surfaced 2026-07-10, needs Ayo)

**The hosted Supabase project (`baevldudfqfnzczbvooz.supabase.co`) no longer resolves in DNS**
(NXDOMAIN on 1.1.1.1 and 8.8.8.8). This is consistent with a paused or deleted Supabase project.
Everything DB/auth/storage-backed is dead against that URL: login, uploads, catalog, the whole flow.

- **Ayo action:** restore the project in the Supabase dashboard (or provision a new one and update
  `.env.local` + Vercel env). Nothing I can do locally fixes the hosted instance.
- **My mitigation:** stand up a local Supabase (colima + docker + supabase CLI), apply
  `supabase/migrations`, seed a catalog via `packages/ingestion`, and verify the full flow locally.
  All work transfers unchanged once the hosted project is back.

## Stages (sequenced for continuous shippable value)

### Stage 0 — Testing foundation (DONE except E2E verify)
- [x] Evolink image provider wired (`RITZY_IMAGE_PROVIDER=evolink`, submit-then-poll, URL-based
  references, OpenAI fallback). Live-probed against the real API: submit + poll + retrieval work,
  ~17s at 1K quality. Commit `d8fc005`.
- [ ] Local Supabase up, migrations applied, seed user + catalog subset ingested.
- [ ] Full-flow reproduction of the known failures with real room photos, evidence captured.

### Stage 1 — Matching quality (highest user-visible pain, lowest risk)
1. Turn ON the role-scoped scoring engine path by default locally; validate against evals + real
   flow; if sound, flip default (or ship env change) with evidence.
2. Cross-project/per-user exclusion: recently-used product ids (per user) are demoted, not just
   excluded within one list. Needs a small query + rank-time demotion. Schema-free first pass:
   read existing shopping_list_items for the user's other rooms.
3. Concept-image palette coherence: extract a structured palette from the generated concept image
   (one gpt-5-mini vision call, cached on the concept row), and feed it into role-scoped scoring as
   a real color/material term so matches align to the concept as rendered, not just text tokens.
4. Pool rotation: replace deterministic index tie-break with stable rotation over product families
   so large pools stop surfacing the same top-N.
5. If time: wire `product_embeddings` similarity for candidate recall (RLS currently blocks reads;
   needs service-role read or policy migration).

### Stage 2 — Spatial intelligence
1. Wire the dormant `spatial-design-rules.ts` engine into the live flow:
   - Capture structured `SpatialIntent` (layoutMode, focalPoint, seatingPriority, diningSeatCount)
     in the brief (deterministic micro-questions; stored in `design_briefs.structured_json`).
   - Run hard checks + `deriveSpatialDesignerWarnings` before concept generation; surface
     assumptions/warnings in the concept UI (honesty cue, on-brand).
   - Feed intent into `spatialLayoutLanguage()` fragments in the concept + render prompts.
2. Feed the floor plan image (already captured, currently discarded) and measurements into the
   concept generation call as an additional reference/vision input.
3. Measurements should not hard-gate concept generation: degrade gracefully with recorded
   assumptions (freedom explicitly granted in the handoff).

### Stage 3 — Multi-photo in, multi-angle out (the "feels like a designer" jump)
1. Multi-photo capture: upload flow encourages/accepts 2-3 photos (different corners; empty-room
   guidance); concept generation consumes all of them (today: order-by-created_at limit 1).
2. Multi-angle generation: concept produces 3 views of the SAME room. Strategy: generate the
   hero view first (room photo + refs), then generate views 2-3 with the hero as the primary
   reference plus camera-move instructions ("same room, same furniture, same palette; camera at
   the opposite corner / seating-group close-up"). Persist as multiple assets per concept.
3. Same pattern for the final grounded render (hero + 2 consistent alternates).
4. Presentation shows the angle set; consistency verified by vision QA (Stage 4).

### Stage 4 — Post-render vision QA
- One gpt-5-mini vision call per generated image set scoring: focal orientation, sofa
  alignment/anti-cant, scale plausibility, palette adherence, cross-view consistency.
- On failure: one automatic regeneration with corrective prompt, then surface an honest warning.

### Stage 5 — Hardening + polish
- Final render durability (in-request `after()` + 15-min staleness is fragile under load).
- Latency/perceived speed, empty/error states, presentation polish within Quiet Gallery.
- Full `pnpm check`, E2E walk, PRs.

## Explicit tradeoffs (deliberate, not silent)
- Palette extraction uses one extra vision call per concept (cheap, cached) instead of pixel
  clustering infra: better taste, less code.
- Multi-angle consistency relies on image-to-image referencing + prompt discipline + vision QA,
  not 3D geometry. True geometric conditioning (depth/segmentation) is out of 72h scope.
- Cross-project exclusion is a rank-time demotion from existing tables, not a new schema table,
  unless evidence shows we need durable state.
- Local Supabase catalog will be a Home Centre-focused subset, not the full nine-retailer catalog.

## Verification bar
`pnpm check` green is necessary, never sufficient. Every stage ends with a real-flow verification
against the real Gemini renderer via Evolink, with screenshots/evidence in
`docs/Tracks/v2-commercial/fable-evidence/`.
