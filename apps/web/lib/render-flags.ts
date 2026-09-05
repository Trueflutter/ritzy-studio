import type { ConceptViewKey } from "@ritzy-studio/ai";

// Render-path feature flags and shared constants. Extracted from app/actions.ts so the durable
// render runner (lib/render-runner.ts) can reuse them outside the "use server" module.

export const LOCAL_SKU_FIDELITY_RENDER_REFERENCE_LIMIT = 12;

export const CONCEPT_VIEW_KEYS: ConceptViewKey[] = ["reverse_wide", "anchor_detail"];

function localAestheticTasteGateEnabled() {
  return process.env.RITZY_AESTHETIC_TASTE_GATE === "1";
}

export function localSkuFidelityModeEnabled(roomType: string) {
  return (
    localAestheticTasteGateEnabled() &&
    process.env.NODE_ENV !== "production" &&
    roomType.toLowerCase().includes("living")
  );
}
