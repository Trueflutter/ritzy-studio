# Handover: next session (written by Fable, 2026-07-10 end of session 2)

Read order for the incoming instance: `docs/FABLE_HANDOFF.md` (original brief) →
`docs/FABLE_PROGRESS.md` (full session log, newest at bottom) → this file. Branch:
`fable/beta-world-class`, PR #310 (open, all review findings addressed; second Codex review was
stale — see PR comments). NEVER merge without Ayo. Conventional commits, trailer
`Co-Authored-By: <your model name> <noreply@anthropic.com>`. Stage files by name.

## Where things stand (verified, not aspirational)

The prime-directive pipeline works END TO END in the live app against the real Gemini renderer
(via Evolink): photo → brief (room-planning questions) → clarifying questions → catalogue-grounded
concept → 2 consistent extra camera views → cached palette extraction → product matching (trap
products excluded, avoid-colors enforced, cross-project demotion) → shopping list → final render
with spatial-QA verdict `pass`. Evidence and per-fix commits: FABLE_PROGRESS.md session-2 section.

- Local stack: colima + `supabase start` (port 55321), fixture catalog via
  `npx tsx scripts/local-catalog-seed/seed.ts`, E2E driver `scripts/dev-harness/e2e.mjs`
  (stages: login/onboarding/project/room/photos/brief-style/brief-inspiration/brief-details/
  brief-questions/concept/inspect). Test user fable-test@ritzy.local / fable-test-passw0rd, has an
  active local `subscriptions` row (designer_monthly_usd_99) for multi-room testing.
- Hosted Supabase: restored, 3,309 products, BOTH new migrations applied (concept_view_assets,
  concept_palette — verified via REST probes).
- Env truth: local `.env.local` routes OpenAI-SDK → Evolink (`OPENAI_BASE_URL`, gpt-5.1) and
  images → Evolink. OpenAI billing was topped up: `gpt-5-mini`/`gpt-5.5` work DIRECT again;
  `gpt-5.6-*` is limited-preview on this account (retest availability — switch text model to
  `gpt-5.6-luna` when it opens; it's the value pick at $1/$6).
- Vercel production env: NOT yet updated (sandbox blocked secret writes). Ayo must run the
  commands in the "Production env" section below (or approve them interactively).

## Immediate queue (highest value first)

1. **Hosted E2E.** Point `.env.local` at hosted (swap the `# HOSTED:` comment lines back in),
   run the full flow against the REAL 3,309-product catalog. Expect new matching-quality findings
   (the fixture catalog is 60 items). Also set `OPENAI_BASE_URL` off (direct OpenAI, gpt-5-mini)
   to match production, and keep `RITZY_IMAGE_PROVIDER=evolink`.
2. **Sourcing timeout.** Visual sourcing timed out once against Evolink (text fallback engaged
   as designed). Tune `PRODUCT_SOURCING_AI_TIMEOUT_MS` (apps/web/app/actions.ts) or trim
   candidate-image payloads; direct-OpenAI latency may already fix it.
3. **Concept-prompt token audit.** Final-render prompt was slimmed to fit Evolink's 4000-token
   image-prompt cap; the CONCEPT image prompt is near the cap too (style modules + guardrails +
   spatial language + catalogue summary). Audit `buildInitialConceptImagePrompt` length with a
   real brief; slim greedily (the guardrails matter more than prose duplication).
4. **Final-render multi-angle.** `generateConceptView` pattern applies directly (hero final
   render as identity reference + camera-move language). Presentation page already renders
   concept-linked view assets; extend to final renders (asset_type final_render + view_key).
5. **Render durability.** Final render is an in-request `after()` with a 15-min staleness
   heuristic (actions.ts `generateFinalRenderAction`). Under beta load, consider a durable
   queue (Vercel Queues) or at minimum idempotent retry + user-visible retry affordance.
6. **Cost telemetry.** Evolink balance ran dry mid-session with a 402. Log per-job credit usage
   (Evolink returns `usage.credits_used` on task completion) into ai_jobs.cost_estimate_usd.
7. **Grants migration.** Local Supabase needed manual `grant ... to service_role` fixups that
   hosted evidently has out-of-band. Codify them in a migration so environments stop drifting.
8. **Dev-only paper cuts.** Hydration mismatch on hidden form inputs (caret-color) triggers the
   dev overlay; style-step tiles render with empty image slots.

## Production env (Ayo runs; sandbox blocks secret writes from the agent)

```sh
# from repo root; EVOLINK key is the EVOLINK_API_KEY line in .env.local
grep '^EVOLINK_API_KEY=' .env.local | cut -d= -f2 | vercel env add EVOLINK_API_KEY production
printf 'gemini-3.1-flash-image-preview' | vercel env add EVOLINK_IMAGE_MODEL production
printf '1K' | vercel env add EVOLINK_IMAGE_QUALITY production
printf 'true' | vercel env add RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED production
vercel env rm RITZY_IMAGE_PROVIDER production   # then re-add:
printf 'evolink' | vercel env add RITZY_IMAGE_PROVIDER production
# text model stays default gpt-5-mini on the existing OPENAI_API_KEY (topped up).
# Do NOT set OPENAI_BASE_URL in production (that was the local Evolink stopgap).
```

## Traps the next instance must not rediscover

- PostgREST embeds involving concepts↔room_assets MUST name the FK
  (`room_assets!concepts_primary_image_asset_id_fkey`) — the concept_id FK made `room_assets(*)`
  ambiguous and pages fail SILENTLY (empty data, no error).
- Vision inputs must be inlined data URLs (downscaled via `visionImageDataUrl`) — provider-side
  URL downloads flake on CDNs/non-public hosts. Image-generation references keep full-res bytes;
  Evolink references auto-compress (`referenceDataUrl`).
- Every `client.responses.create` must set `max_output_tokens` — gateway cost estimators reject
  unbounded reservations against low balances.
- Evolink image-model prompts cap at 4000 tokens — keep render/concept prompts lean.
- `hasHardCatalogueGroundingContradiction` must never hard-veto on soft styling signals — the
  silhouette case anchored a purple sofa against an explicit "avoid purple". Anchor-loop skips
  now emit warnings; read them (ai_jobs output_summary.catalogueGrounding.warnings) before
  guessing at matching bugs.
- "avoid X" phrases in briefs must not enter cue/matching text as positive tokens
  (`splitAvoidColorCues` handles brief text; keep the invariant for any new text path).
- The user's Chrome cannot reach localhost — drive the local app with the Playwright harness,
  never claude-in-chrome.

## Definition of done (unchanged, from FABLE_HANDOFF.md)

Real person, real photo (furnished or empty) → spatially sound, beautiful, on-brief design from
≥3 mutually consistent angles, matched to real non-repeating buyable furniture, client-ready
presentation, reliably. The multi-angle CONCEPT requirement is met; the final render is still a
single angle (queue item 4).
