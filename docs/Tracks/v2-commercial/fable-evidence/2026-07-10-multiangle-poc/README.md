# Multi-angle consistency POC (2026-07-10)

Provider: Evolink gateway, model `gemini-3.1-flash-image-preview`, quality 1K.
All generations via the raw API (submit-then-poll), before app wiring, to derisk Stage 3
of `plans/2026-07-10_fable-beta-world-class.md`.

## Inputs (synthetic stand-ins for real user photos)
- `furnished-room.png` — generated "amateur phone photo" of a dated, lived-in Dubai apartment
  living room (worn brown sofa, old TV, clutter). Reads convincingly as a real user upload.
- `empty-room-corner1.png` / `empty-room-corner2.png` — the same empty room from two corners;
  corner 2 was generated from corner 1 as a reference plus a camera-move instruction. Serves as
  the multi-photo capture test pair.

## Experiment: 3 mutually consistent views of one design
1. `concept-v1.png` — quiet-luxury redesign generated from `furnished-room.png` as source room
   (single reference + concept prompt, like the live pipeline).
2. `concept-v2.png` — SAME room, reverse wide angle. Reference: concept-v1 URL only, plus a
   camera-move prompt with an explicit furniture identity list.
3. `concept-v3.png` — SAME room, seating-group detail view. Same referencing technique.

## Findings
- Furniture identity holds strongly across all three views: identical sofa, travertine two-piece
  coffee table, patterned rug, walnut console + TV, boucle chair, lamp/side table, artwork.
- Geometry is not perfect (subtle wall/window relationship drift in the reverse shot) but well
  within client-presentable tolerance for concept-stage imagery.
- Technique for the app: generate the hero view via the existing pipeline, then generate 2 more
  views passing the hero image URL as reference with a camera-move + identity-list prompt.
  Enforce with a vision-QA consistency check (Stage 4); regenerate on hard failure.
- Empty-room corner pair shows the same technique also produces plausible multi-photo INPUT
  coverage, and the model respects "same room, new camera" instructions with one reference.

## Cost/latency observed
- ~17-40s per 1K-quality generation via Evolink; ~4.26 credits per image.
