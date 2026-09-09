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
// Per-stage defaults: the design check judges on the production vision model
// because the gate does, and the sourcing pass buys speed because a proposal
// that never arrives costs the shopper every pre-selected piece.
assert.equal(resolveStageTextModel("product_verification", {}, "gpt-5-mini"), "gpt-5.1");
assert.equal(resolveStageTextModel("product_verification", { RITZY_TEXT_MODEL_PRODUCT_VERIFICATION: "gpt-5-mini" }, "gpt-5-mini"), "gpt-5-mini", "an env override still wins");
assert.equal(resolveStageTextEffort("product_sourcing", {}), "low");
assert.equal(resolveStageTextEffort("product_sourcing", { RITZY_TEXT_EFFORT_PRODUCT_SOURCING: "high" }), "high");
assert.equal(resolveStageTextEffort("product_verification", {}), null, "the check keeps the provider default");
// The parameter only exists on reasoning models. Pointing a stage at another
// model through the documented override must not 400 every call.
assert.equal(resolveStageTextEffort("product_sourcing", {}, "gpt-5-mini"), "low");
assert.equal(resolveStageTextEffort("product_sourcing", {}, "gpt-4.1"), null);
// And an explicit "none" turns the stage default off.
assert.equal(resolveStageTextEffort("product_sourcing", { RITZY_TEXT_EFFORT_PRODUCT_SOURCING: "none" }), null);
assert.ok(TEXT_STAGES.includes("product_sourcing"));
assert.ok(TEXT_STAGES.includes("product_verification"));
assert.ok(TEXT_STAGES.includes("revision_direction"));
assert.ok(TEXT_STAGES.includes("spec_extraction"));
assert.ok(TEXT_STAGES.includes("anchor_set"));
// The anchor set pass decides which real pieces the render is built around, so
// it runs on the production vision model for the same reason the design check
// does: its output is the room, not a row on a list.
assert.equal(resolveStageTextModel("anchor_set", {}, "gpt-5-mini"), "gpt-5.1");
assert.equal(
  resolveStageTextModel("anchor_set", { RITZY_TEXT_MODEL_ANCHOR_SET: "gpt-5-mini" }, "gpt-5.1"),
  "gpt-5-mini",
  "an env override still wins"
);

// S4: the camera read and the view consistency check are cheap facts, one
// call per image judged; they default to the cheapest adequate model at low
// effort whatever the base model is, and an env override still wins.
assert.ok(TEXT_STAGES.includes("camera_read"));
assert.ok(TEXT_STAGES.includes("view_consistency"));
assert.equal(resolveStageTextModel("camera_read", {}, "gpt-5.1"), "gpt-5-mini");
assert.equal(resolveStageTextModel("view_consistency", {}, "gpt-5.1"), "gpt-5-mini");
assert.equal(resolveStageTextModel("camera_read", { RITZY_TEXT_MODEL_CAMERA_READ: "gpt-5.1" }, "gpt-5-mini"), "gpt-5.1");
assert.equal(resolveStageTextEffort("camera_read", {}), "low");
assert.equal(resolveStageTextEffort("view_consistency", {}), "low");
assert.equal(resolveStageTextEffort("view_consistency", { RITZY_TEXT_EFFORT_VIEW_CONSISTENCY: "high" }), "high");

console.log("model-routing tests passed");
