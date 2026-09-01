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
  "spatial_qa",
  "revision_direction",
  "spec_extraction",
  "product_enrichment"
] as const;

export type TextStage = (typeof TEXT_STAGES)[number];

const EFFORT_VALUES = ["minimal", "low", "medium", "high"] as const;

export type TextEffort = (typeof EFFORT_VALUES)[number];

type EnvRecord = Record<string, string | undefined>;

function stageEnvValue(env: EnvRecord, prefix: string, stage: TextStage): string | null {
  const value = env[`${prefix}${stage.toUpperCase()}`]?.trim();
  return value ? value : null;
}

export function resolveStageTextModel(stage: TextStage, env: EnvRecord, baseModel: string): string {
  return stageEnvValue(env, "RITZY_TEXT_MODEL_", stage) ?? baseModel;
}

export function resolveStageTextEffort(stage: TextStage, env: EnvRecord): TextEffort | null {
  const value = stageEnvValue(env, "RITZY_TEXT_EFFORT_", stage);
  if (value && (EFFORT_VALUES as readonly string[]).includes(value)) {
    return value as TextEffort;
  }
  return null;
}
