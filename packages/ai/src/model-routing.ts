// Per-stage text model routing. Development and verification loops run each stage on
// the cheapest adequate model; upgrades are deliberate per-stage config, not defaults.
//
// Env contract (documented in .env.example): for a stage `concept_direction`,
//   RITZY_TEXT_MODEL_CONCEPT_DIRECTION   overrides the model for that stage only
//   RITZY_TEXT_EFFORT_CONCEPT_DIRECTION  sets Responses reasoning effort (minimal|low|medium|high)
// Unset values fall back to OPENAI_TEXT_MODEL and the SDK's default effort.

export const TEXT_STAGES = [
  "clarifying_questions",
  "inspiration_analysis",
  "concept_direction",
  "concept_palette",
  "product_sourcing",
  "product_verification",
  "spatial_qa",
  "revision_direction",
  "spec_extraction",
  "product_enrichment",
  "anchor_set",
  "camera_read",
  "view_consistency"
] as const;

export type TextStage = (typeof TEXT_STAGES)[number];

const EFFORT_VALUES = ["minimal", "low", "medium", "high"] as const;

export type TextEffort = (typeof EFFORT_VALUES)[number];

type EnvRecord = Record<string, string | undefined>;

function stageEnvValue(env: EnvRecord, prefix: string, stage: TextStage): string | null {
  const value = env[`${prefix}${stage.toUpperCase()}`]?.trim();
  return value ? value : null;
}

// A stage whose default is NOT the room's base text model. The design check
// decides whether a product is presented to a shopper as a match, and the
// gate that judges the same question runs on the production vision model; the
// app has to make that judgement with the same eyes or it will choose pieces
// the gate then fails. An env override still wins.
//
// The anchor set pass is the other one. It decides which real pieces the
// concept render is built around, so its output is not a row on a list that a
// shopper can skip past: it is the room's palette. One call per room, once,
// before anything else is paid for.
//
// The camera read and the view consistency check (S4) go the other way: one
// call per image judged, facts rather than taste, and they run whatever the
// base model is, so they pin the cheapest adequate model rather than inherit
// a production base. An env override still wins.
const STAGE_MODEL_DEFAULTS: Partial<Record<TextStage, string>> = {
  product_verification: "gpt-5.1",
  anchor_set: "gpt-5.1",
  camera_read: "gpt-5-mini",
  view_consistency: "gpt-5-mini"
};

export function resolveStageTextModel(stage: TextStage, env: EnvRecord, baseModel: string): string {
  return stageEnvValue(env, "RITZY_TEXT_MODEL_", stage) ?? STAGE_MODEL_DEFAULTS[stage] ?? baseModel;
}

// A stage whose default effort is not the provider's. The sourcing pass only
// PROPOSES a product per role now; the design check that follows judges those
// proposals on the production vision model. A proposal that never arrives
// (the pass ran past its deadline) costs the shopper every pre-selected piece
// on the list, while a hasty proposal costs nothing, because the check
// rejects it. So the pass buys speed and the check buys care.
const STAGE_EFFORT_DEFAULTS: Partial<Record<TextStage, TextEffort>> = {
  product_sourcing: "low",
  camera_read: "low",
  view_consistency: "low"
};

// Only a reasoning model accepts the parameter at all. A stage default that
// ignored this would 400 every call the moment someone pointed the stage at a
// non-reasoning model through the documented per-stage model override.
function acceptsReasoningEffort(model: string) {
  return /^(gpt-5|o[0-9])/.test(model.trim());
}

export function resolveStageTextEffort(stage: TextStage, env: EnvRecord, model?: string): TextEffort | null {
  const value = stageEnvValue(env, "RITZY_TEXT_EFFORT_", stage);
  // An explicit "none" turns the stage default off; anything unrecognised is
  // ignored rather than sent to the provider.
  if (value === "none") {
    return null;
  }
  if (value && (EFFORT_VALUES as readonly string[]).includes(value)) {
    return value as TextEffort;
  }
  if (model !== undefined && !acceptsReasoningEffort(model)) {
    return null;
  }
  return STAGE_EFFORT_DEFAULTS[stage] ?? null;
}
