# Spatial Focal Placement Beta Fix

**Date:** 2026-06-01
**Status:** Beta-safe prompt/blueprint patch evidence
**Scope:** Living rooms only

## Observed Failure

Sam observed a generated living-room render where the primary sofa was placed directly against the TV/media wall and faced away from the TV. The room could still look aesthetically polished, but the focal-point relationship was wrong: the primary seating and TV/media wall occupied the same wall/zone instead of facing each other across the rug and coffee-table zone.

## Slice Boundary

This slice addresses placement language only. It tightens the living-room design and blueprint prompt language so the model is told that:

- primary seating must be on a different wall or zone from the focal point;
- the TV/media wall and primary sofa must not be on the same wall;
- the sofa should sit opposite the TV/media wall, or on a perpendicular adjacent wall when source-room constraints require it;
- the sofa seat/front should face the TV/media wall or declared focal point across the rug/coffee-table zone;
- accent chairs should angle inward toward the sofa/focal-point axis;
- if TV-first placement is impossible, architecture should be preserved, the focal-point assumption should be explicit, and sofa-under-TV placement should be avoided.

## What This Does Not Do

This is not full Design Spatial Intelligence. It does not implement structured focal-point capture, deterministic wall geometry, object-placement validation, vision QA, DB/schema changes, generated type changes, UI changes, Product Matching changes, catalog changes, deploy settings, or live app actions.

## Verification Intent

Tests should confirm that the assembled living-room language and final grounded render prompt include the new focal-placement constraints. Manual render QA is still required to prove image behavior, because the app does not yet capture wall/window/door or furniture-placement geometry.
