import assert from "node:assert/strict";

import { resolveStageTextModel, resolveStageTextEffort, TEXT_STAGES } from "./model-routing";

// Default: every stage resolves to the configured base text model.
assert.equal(resolveStageTextModel("clarifying_questions", {}, "gpt-5-mini"), "gpt-5-mini");
assert.equal(resolveStageTextModel("spatial_qa", {}, "gpt-5-mini"), "gpt-5-mini");

// A per-stage env override wins for that stage only.
const env = {
  RITZY_TEXT_MODEL_SPATIAL_QA: "gpt-5.1",
  RITZY_TEXT_EFFORT_CONCEPT_DIRECTION: "low"
};
assert.equal(resolveStageTextModel("spatial_qa", env, "gpt-5-mini"), "gpt-5.1");
assert.equal(resolveStageTextModel("concept_direction", env, "gpt-5-mini"), "gpt-5-mini");

// Effort: unset resolves to null (SDK default); set values pass through; invalid
// values are ignored rather than sent to the API.
assert.equal(resolveStageTextEffort("concept_direction", env), "low");
assert.equal(resolveStageTextEffort("spatial_qa", env), null);
assert.equal(resolveStageTextEffort("spatial_qa", { RITZY_TEXT_EFFORT_SPATIAL_QA: "extreme" }), null);
assert.equal(resolveStageTextEffort("spatial_qa", { RITZY_TEXT_EFFORT_SPATIAL_QA: "high" }), "high");

// Empty-string overrides are treated as unset.
assert.equal(resolveStageTextModel("spatial_qa", { RITZY_TEXT_MODEL_SPATIAL_QA: "  " }, "gpt-5-mini"), "gpt-5-mini");

// The stage list is the routing contract; a typo'd stage cannot compile at the call
// sites, and the env var name derivation is stable and documented.
assert.ok(TEXT_STAGES.includes("product_sourcing"));
assert.ok(TEXT_STAGES.includes("revision_direction"));

console.log("model-routing tests passed");
