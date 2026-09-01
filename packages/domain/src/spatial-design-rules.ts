import {
  fitConfidenceUsePolicy,
  type MeasurementConfidence,
  type MeasurementSourceKind
} from "./measurement-confidence";

// Kept from the retired catalog-first planner family (Gate 1 disposition): the
// pipeline's internal room-type key. The rules read exactly id and quantity from
// a role, so that is the whole role contract here; the planner's wider role
// vocabulary died with the planner.
export type CatalogFirstRoomType = "living_room" | "living_dining" | "dining_room" | "bedroom" | "home_office";

export type SpatialRoleFact = {
  id: string;
  quantity: number;
};

export type SpatialLayoutMode =
  | "living_only"
  | "living_plus_dining"
  | "dining_only"
  | "bedroom"
  | "home_office"
  | "unknown";

export type SpatialFocalPoint =
  | "tv_media_wall"
  | "view_window"
  | "fireplace"
  | "art_display_wall"
  | "conversation"
  | "bed_wall"
  | "workstation"
  | "unknown";

export type SpatialFocalPointConfidence = "user_selected" | "assumed" | "unknown";

export type SpatialSeatingPriority =
  | "tv_viewing"
  | "conversation"
  | "family_lounging"
  | "formal_hosting"
  | "majlis_hosting"
  | "mixed"
  | "unknown";

export type SpatialHostingMode = "daily_family" | "formal_guests" | "large_gatherings" | "unknown";

export type SpatialWorkMode = "daily_work" | "occasional_admin" | "video_calls" | "study" | "unknown";

export type SpatialIntent = {
  layoutMode?: SpatialLayoutMode;
  focalPoint?: SpatialFocalPoint;
  focalPointConfidence?: SpatialFocalPointConfidence;
  seatingPriority?: SpatialSeatingPriority;
  diningNeeded?: boolean;
  diningSeatCount?: number | null;
  hostingMode?: SpatialHostingMode;
  workMode?: SpatialWorkMode;
  mustKeepClear?: readonly string[];
  existingPiecesToKeep?: readonly string[];
  assumptions?: readonly string[];
};

// The layout mode is decided by the room type the user picked (Living & Dining
// is a first-class room type); it is never asked twice.
export function spatialLayoutModeForRoomType(roomType: string): SpatialLayoutMode {
  const normalized = roomType
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[/_-]/g, " ")
    .replace(/\s+/g, " ");

  if (/\bliving\b/.test(normalized) && /\bdining\b/.test(normalized)) {
    return "living_plus_dining";
  }
  if (normalized.includes("living") || normalized.includes("lounge") || normalized.includes("family")) {
    return "living_only";
  }
  if (normalized.includes("dining")) {
    return "dining_only";
  }
  if (normalized.includes("bed")) {
    return "bedroom";
  }
  if (normalized.includes("office") || normalized.includes("study")) {
    return "home_office";
  }
  return "unknown";
}

const spatialFocalPointValues: readonly SpatialFocalPoint[] = [
  "tv_media_wall",
  "view_window",
  "fireplace",
  "art_display_wall",
  "conversation",
  "bed_wall",
  "workstation",
  "unknown"
];

const spatialSeatingPriorityValues: readonly SpatialSeatingPriority[] = [
  "tv_viewing",
  "conversation",
  "family_lounging",
  "formal_hosting",
  "majlis_hosting",
  "mixed",
  "unknown"
];

// Reads the structured spatial intent captured by the brief out of
// design_briefs.structured_json. Tolerant of missing/legacy data.
const MUST_KEEP_CLEAR_MAX_ENTRIES = 6;
const MUST_KEEP_CLEAR_MAX_ENTRY_CHARS = 160;

function boundSpatialIntentText(value: string, maxChars: number) {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length <= maxChars ? collapsed : `${collapsed.slice(0, maxChars - 1)}…`;
}

export function parseSpatialIntent(value: unknown, roomType: string): SpatialIntent {
  const layoutMode = spatialLayoutModeForRoomType(roomType);
  const record =
    value && typeof value === "object" && "spatialIntent" in value
      ? ((value as { spatialIntent?: unknown }).spatialIntent as Record<string, unknown> | null)
      : null;

  const assumptions: string[] = [];
  const focalPointRaw = typeof record?.focalPoint === "string" ? record.focalPoint : null;
  const focalPoint = spatialFocalPointValues.includes(focalPointRaw as SpatialFocalPoint)
    ? (focalPointRaw as SpatialFocalPoint)
    : "unknown";
  const seatingPriorityRaw = typeof record?.seatingPriority === "string" ? record.seatingPriority : null;
  const seatingPriority = spatialSeatingPriorityValues.includes(
    seatingPriorityRaw as SpatialSeatingPriority
  )
    ? (seatingPriorityRaw as SpatialSeatingPriority)
    : "unknown";
  const diningSeatCountRaw = record?.diningSeatCount;
  const diningSeatCount =
    typeof diningSeatCountRaw === "number" && Number.isFinite(diningSeatCountRaw) && diningSeatCountRaw > 0
      ? Math.min(Math.round(diningSeatCountRaw), 16)
      : null;
  const mustKeepClearRaw = record?.mustKeepClear;
  const mustKeepClearEntries =
    typeof mustKeepClearRaw === "string" && mustKeepClearRaw.trim().length > 0
      ? [mustKeepClearRaw]
      : Array.isArray(mustKeepClearRaw)
        ? mustKeepClearRaw.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
        : [];
  // mustKeepClear is the only free-text field here (focal point and seating priority are
  // enum-validated) and it flows verbatim into image prompts, which carry a hard provider
  // token cap. Bound it at this parse boundary so no consumer can be blown past its budget
  // by a hostile or accidental oversized brief value.
  const mustKeepClear = mustKeepClearEntries
    .slice(0, MUST_KEEP_CLEAR_MAX_ENTRIES)
    .map((entry) => boundSpatialIntentText(entry, MUST_KEEP_CLEAR_MAX_ENTRY_CHARS))
    .filter((entry) => entry.length > 0);

  const livingLike = layoutMode === "living_only" || layoutMode === "living_plus_dining";
  if (livingLike && focalPoint === "unknown") {
    assumptions.push("Focal point not confirmed; assuming the TV/media wall anchors the seating.");
  }
  if (layoutMode === "living_plus_dining" && diningSeatCount === null) {
    assumptions.push("Dining seat count not confirmed; assuming six day-to-day seats.");
  }

  return {
    layoutMode,
    focalPoint,
    focalPointConfidence: focalPoint === "unknown" ? "assumed" : "user_selected",
    seatingPriority,
    diningNeeded: layoutMode === "living_plus_dining" || layoutMode === "dining_only",
    diningSeatCount,
    mustKeepClear,
    assumptions
  };
}

export type SpatialRuleCheckability = "hard-checkable" | "prompt-checkable" | "vision-QA-only";

export type SpatialRuleSurface =
  | "clarifying_question"
  | "concept_prompt"
  | "manual_qa"
  | "designer_warning"
  | "hard_check";

export type SpatialRuleId =
  | "L1"
  | "L2"
  | "L3"
  | "L4"
  | "L5"
  | "L6"
  | "L7"
  | "L8"
  | "L9"
  | "L10"
  | "L11"
  | "C1"
  | "C2"
  | "C3"
  | "C4"
  | "C5"
  | "C6"
  | "C7"
  | "D1"
  | "D2"
  | "D3"
  | "D4"
  | "D5"
  | "B1"
  | "B2"
  | "B3"
  | "B4"
  | "B5"
  | "O1"
  | "O2"
  | "O3";

export type SpatialRule = {
  id: SpatialRuleId;
  name: string;
  roomTypes: readonly (CatalogFirstRoomType | "living_plus_dining")[];
  checkability: SpatialRuleCheckability;
  requiresMeasurementConfidence: boolean;
  requiredInputs: readonly string[];
  surfaces: readonly SpatialRuleSurface[];
  betaSafeNote: string;
};

export type SpatialRoomMeasurements = {
  wallLengthCm?: number | null;
  roomDepthCm?: number | null;
  ceilingHeightCm?: number | null;
  source?: MeasurementSourceKind | null;
  confidence?: MeasurementConfidence | null;
};

export type SpatialFootprint = {
  widthCm?: number | null;
  depthCm?: number | null;
};

export type SpatialRoomFacts = {
  roomType: CatalogFirstRoomType;
  intent?: SpatialIntent | null;
  measurements?: SpatialRoomMeasurements | null;
  roles?: readonly SpatialRoleFact[];
  footprintsByRoleId?: Readonly<Record<string, SpatialFootprint | null | undefined>>;
};

export type SpatialRuleVerdictStatus = "pass" | "fail" | "needs_measurement" | "not_applicable";

export type SpatialRuleVerdict = {
  ruleId: SpatialRuleId;
  status: SpatialRuleVerdictStatus;
  message: string;
  warnings: readonly string[];
};

export type SpatialDesignerWarning = {
  code:
    | "spatial_layout_mode_missing"
    | "spatial_focal_point_assumed"
    | "spatial_measurement_confidence_low"
    | "spatial_geometry_missing"
    | "spatial_must_keep_clear_unstructured";
  message: string;
};

const BASE_WALKWAY_CM = 75;
const TIGHT_CLEARANCE_CM = 90;
const BED_SIDE_CLEARANCE_CM = 60;
const BED_FOOT_CLEARANCE_CM = 75;
const OFFICE_CHAIR_ROLLBACK_CM = 90;
const COMPACT_COMBINED_AREA_CM2 = 200_000;

export const spatialDesignRules = [
  rule("L1", "Primary seating addresses the focal point", ["living_room", "living_plus_dining"], "vision-QA-only", true, [
    "focalPoint",
    "seatingPriority",
    "focal wall",
    "rendered seating placement"
  ]),
  rule("L2", "Seating forms a conversation zone", ["living_room", "living_plus_dining"], "vision-QA-only", true, [
    "seatingPriority",
    "rendered seating placement"
  ]),
  rule("L3", "Conversation distance is comfortable", ["living_room"], "prompt-checkable", true, [
    "seatingPriority",
    "room dimensions"
  ]),
  rule("L4", "Coffee table is reachable from primary seating", ["living_room"], "prompt-checkable", true, [
    "seating placement",
    "coffee table placement"
  ]),
  rule("L5", "Rug anchors the seating group", ["living_room"], "vision-QA-only", false, [
    "rug dimensions",
    "rendered seating placement"
  ]),
  rule("L6", "Main circulation avoids cutting through the conversation core", ["living_room"], "prompt-checkable", true, [
    "door/window positions",
    "circulation path",
    "seating placement"
  ]),
  rule("L7", "TV viewing distance and angle are plausible", ["living_room"], "prompt-checkable", true, [
    "TV size",
    "TV location",
    "sofa location"
  ]),
  rule("L8", "Side tables and lighting support real seats", ["living_room"], "vision-QA-only", false, [
    "seating placement",
    "lighting placement"
  ]),
  rule("L9", "Windows, views, and daylight are respected", ["living_room"], "vision-QA-only", true, [
    "window/door locations",
    "rendered furniture placement"
  ]),
  rule("L10", "Living furniture scale fits the measured envelope", ["living_room", "living_plus_dining"], "hard-checkable", true, [
    "room measurements",
    "sofa footprint"
  ]),
  rule("L11", "Dubai formal hosting / majlis mode changes the seating logic", ["living_room"], "prompt-checkable", false, [
    "seatingPriority",
    "hostingMode"
  ]),
  rule("C1", "Living-only vs living + dining is explicit", ["living_room"], "hard-checkable", false, [
    "layoutMode"
  ]),
  rule("C2", "Zones are distinct but cohesive", ["living_plus_dining"], "vision-QA-only", true, [
    "layoutMode",
    "rendered zone placement"
  ]),
  rule("C3", "Each zone has its own anchor", ["living_plus_dining"], "prompt-checkable", false, [
    "focalPoint",
    "diningNeeded"
  ]),
  rule("C4", "Circulation spine connects entry, living, dining, and kitchen", ["living_plus_dining"], "prompt-checkable", true, [
    "entry/kitchen/balcony adjacency",
    "circulation path"
  ]),
  rule("C5", "Sofa, console, rugs, or lighting define the boundary", ["living_plus_dining"], "vision-QA-only", true, [
    "rendered zone placement"
  ]),
  rule("C6", "Combined role set is scaled, not duplicated", ["living_plus_dining"], "hard-checkable", true, [
    "layoutMode",
    "room measurements",
    "role list",
    "diningSeatCount"
  ]),
  rule("C7", "Dining belongs near kitchen or service flow when known", ["living_plus_dining"], "prompt-checkable", true, [
    "kitchen adjacency",
    "dining zone location"
  ]),
  rule("D1", "Dining table has adequate pull-out clearance", ["dining_room", "living_plus_dining"], "hard-checkable", true, [
    "room measurements",
    "dining table footprint"
  ]),
  rule("D2", "Chair count matches hosting intent and table size", ["dining_room", "living_plus_dining"], "hard-checkable", true, [
    "diningSeatCount",
    "role list"
  ]),
  rule("D3", "Pendant or over-table fixture centers on the table", ["dining_room"], "vision-QA-only", true, [
    "fixture coordinates",
    "table coordinates"
  ]),
  rule("D4", "Dining rug fits pulled-out chairs", ["dining_room"], "prompt-checkable", true, [
    "table dimensions",
    "rug dimensions"
  ]),
  rule("D5", "Sideboard does not block dining circulation", ["dining_room"], "prompt-checkable", true, [
    "room dimensions",
    "sideboard footprint",
    "table placement"
  ]),
  rule("B1", "Bed sits on a credible primary wall", ["bedroom"], "vision-QA-only", true, [
    "door/window/wardrobe positions",
    "rendered bed placement"
  ]),
  rule("B2", "Bed size and side clearances fit the room", ["bedroom"], "hard-checkable", true, [
    "room measurements",
    "bed footprint"
  ]),
  rule("B3", "Bedside tables and lighting serve both used sides", ["bedroom"], "prompt-checkable", true, [
    "bed access intent",
    "bedside footprints"
  ]),
  rule("B4", "Wardrobe, ensuite, and door paths stay clear", ["bedroom"], "vision-QA-only", true, [
    "door/wardrobe/ensuite positions",
    "rendered furniture placement"
  ]),
  rule("B5", "Bedroom rug is proportional to bed", ["bedroom"], "vision-QA-only", true, [
    "bed dimensions",
    "rug dimensions",
    "rug placement"
  ]),
  rule("O1", "Desk orientation supports work, sightline, and video calls", ["home_office"], "prompt-checkable", true, [
    "workMode",
    "door/window locations"
  ]),
  rule("O2", "Desk and chair have roll-back clearance", ["home_office"], "hard-checkable", true, [
    "room measurements",
    "desk footprint"
  ]),
  rule("O3", "Storage and task lighting are reachable", ["home_office"], "vision-QA-only", false, [
    "desk placement",
    "storage/lighting placement"
  ])
] as const satisfies readonly SpatialRule[];

export const hardCheckableSpatialRuleIds = spatialDesignRules
  .filter((ruleDefinition) => ruleDefinition.checkability === "hard-checkable")
  .map((ruleDefinition) => ruleDefinition.id);

export function evaluateSpatialRule(ruleId: SpatialRuleId, facts: SpatialRoomFacts): SpatialRuleVerdict {
  switch (ruleId) {
    case "C1":
      return evaluateLivingLayoutMode(facts);
    case "C6":
      return evaluateCombinedRoleScale(facts);
    case "D1":
      return evaluateDiningTableEnvelope(facts);
    case "D2":
      return evaluateDiningChairCount(facts);
    case "L10":
      return evaluateLivingScaleEnvelope(facts);
    case "B2":
      return evaluateBedroomBedEnvelope(facts);
    case "O2":
      return evaluateOfficeDeskEnvelope(facts);
    default:
      return {
        ruleId,
        status: "not_applicable",
        message: "This spatial rule is not hard-checkable from current structured facts.",
        warnings: []
      };
  }
}

export function evaluateHardCheckableSpatialRules(facts: SpatialRoomFacts): readonly SpatialRuleVerdict[] {
  return hardCheckableSpatialRuleIds.map((ruleId) => evaluateSpatialRule(ruleId, facts));
}

export function deriveSpatialDesignerWarnings(facts: SpatialRoomFacts): readonly SpatialDesignerWarning[] {
  const warnings: SpatialDesignerWarning[] = [];
  const intent = facts.intent ?? {};

  if (facts.roomType === "living_room" && !hasKnownLayoutMode(intent)) {
    warnings.push({
      code: "spatial_layout_mode_missing",
      message:
        "Confirm whether this is living-only or combined living + dining before concept generation so dining roles and circulation are planned."
    });
  }

  if (
    facts.roomType === "living_room" &&
    (!intent.focalPoint || intent.focalPoint === "unknown" || intent.focalPointConfidence === "assumed")
  ) {
    warnings.push({
      code: "spatial_focal_point_assumed",
      message:
        "Confirm the primary focal point; defaulting to TV/media wall can miss view, fireplace, art wall, or conversation-led rooms."
    });
  }

  if (!canSupportProductFit(facts)) {
    warnings.push({
      code: "spatial_measurement_confidence_low",
      message: "Measurements are not reliable enough for firm spatial fit checks; treat scale guidance as directional."
    });
  }

  warnings.push({
    code: "spatial_geometry_missing",
    message:
      "Door, window, focal-wall, and furniture placement coordinates are not captured, so orientation and circulation require manual QA."
  });

  if ((intent.mustKeepClear?.length ?? 0) > 0) {
    warnings.push({
      code: "spatial_must_keep_clear_unstructured",
      message:
        "Must-keep-clear constraints are captured as designer-readable notes until wall, door, window, and object geometry are available."
    });
  }

  return warnings;
}

function evaluateLivingLayoutMode(facts: SpatialRoomFacts): SpatialRuleVerdict {
  if (facts.roomType !== "living_room") {
    return notApplicable("C1", "Living layout mode applies only to living rooms.");
  }

  if (hasKnownLayoutMode(facts.intent ?? {})) {
    return pass("C1", "Living layout mode is explicit.");
  }

  return fail("C1", "Living rooms must capture living-only vs combined living + dining before concept generation.", [
    "Ask whether the room is living-only or combined living + dining."
  ]);
}

function evaluateCombinedRoleScale(facts: SpatialRoomFacts): SpatialRuleVerdict {
  if (facts.intent?.layoutMode !== "living_plus_dining") {
    return notApplicable("C6", "Combined role scaling applies only when layoutMode is living_plus_dining.");
  }

  if (!canSupportProductFit(facts)) {
    return needsMeasurement("C6", "Combined role scaling needs reliable room measurements.");
  }

  const roles = facts.roles ?? [];
  const roleIds = new Set(roles.map((roleItem) => roleItem.id));
  const hasLivingAnchor = roleIds.has("sofa") || roleIds.has("living_seating") || roleIds.has("anchor_seating");
  const hasDiningAnchor = roleIds.has("dining_table") && roleIds.has("dining_chairs");

  if (!hasLivingAnchor || !hasDiningAnchor) {
    return fail("C6", "Combined living + dining role set must include both living and dining anchors.", [
      "Use a scaled union of living and dining roles instead of treating the space as one room type."
    ]);
  }

  const areaCm2 = roomAreaCm2(facts.measurements);
  const diningSeatCount = facts.intent?.diningSeatCount ?? roleQuantity(roles, "dining_chairs");

  if (areaCm2 !== null && areaCm2 < COMPACT_COMBINED_AREA_CM2 && roles.length > 8) {
    return fail("C6", "Compact combined rooms should not carry a full duplicated living and dining role load.", [
      "Downgrade supporting pieces before prompt or product selection; do not cram every supporting role."
    ]);
  }

  if (areaCm2 !== null && areaCm2 < COMPACT_COMBINED_AREA_CM2 && diningSeatCount > 4) {
    return fail("C6", "Compact combined rooms should cap day-to-day dining scale unless the user confirms otherwise.", [
      "Ask for dining seat count and warn when more than four seats may overfill the room."
    ]);
  }

  return pass("C6", "Combined role set includes living and dining anchors without obvious compact-room overloading.");
}

function evaluateDiningTableEnvelope(facts: SpatialRoomFacts): SpatialRuleVerdict {
  if (facts.roomType !== "dining_room" && facts.intent?.layoutMode !== "living_plus_dining") {
    return notApplicable("D1", "Dining table pull-out clearance applies only to dining or combined dining zones.");
  }

  if (!canSupportTightClearance(facts)) {
    return needsMeasurement("D1", "Dining pull-out clearance needs designer-verified measurements.");
  }

  const table = footprintFor(facts, "dining_table");
  if (!hasFootprint(table)) {
    return needsMeasurement("D1", "Dining pull-out clearance needs dining table dimensions.");
  }

  return envelopeFits("D1", facts, table, TIGHT_CLEARANCE_CM, TIGHT_CLEARANCE_CM, {
    passMessage: "Dining table envelope leaves baseline pull-out clearance in the measured room.",
    failMessage: "Dining table plus pull-out clearance may overfill the measured room.",
    warning: "Consider fewer seats, a smaller/round table, or removing nearby supporting storage."
  });
}

function evaluateDiningChairCount(facts: SpatialRoomFacts): SpatialRuleVerdict {
  if (facts.roomType !== "dining_room" && facts.intent?.layoutMode !== "living_plus_dining") {
    return notApplicable("D2", "Dining chair count applies only to dining or combined dining zones.");
  }

  const roles = facts.roles ?? [];
  const roleSeatCount = roleQuantity(roles, "dining_chairs");
  const requestedSeatCount = facts.intent?.diningSeatCount ?? null;

  if (!roleSeatCount && requestedSeatCount === null) {
    return needsMeasurement("D2", "Dining chair count needs either dining role quantity or requested seat count.");
  }

  if (requestedSeatCount !== null && roleSeatCount && roleSeatCount !== requestedSeatCount) {
    return fail("D2", "Dining chair role quantity does not match captured dining seat intent.", [
      `Requested ${requestedSeatCount} seats but role quantity is ${roleSeatCount}.`
    ]);
  }

  if (!canSupportProductFit(facts)) {
    return needsMeasurement("D2", "Dining chair count is captured, but scale fit still needs reliable measurements.");
  }

  return pass("D2", "Dining chair count matches available intent and role quantity.");
}

function evaluateLivingScaleEnvelope(facts: SpatialRoomFacts): SpatialRuleVerdict {
  if (facts.roomType !== "living_room" && facts.intent?.layoutMode !== "living_plus_dining") {
    return notApplicable("L10", "Living scale fit applies only to living or combined living zones.");
  }

  if (!canSupportProductFit(facts)) {
    return needsMeasurement("L10", "Living scale fit needs reliable room measurements.");
  }

  const sofa = footprintFor(facts, "sofa") ?? footprintFor(facts, "anchor_seating") ?? footprintFor(facts, "living_seating");
  if (!hasFootprint(sofa)) {
    return needsMeasurement("L10", "Living scale fit needs sofa or anchor seating dimensions.");
  }

  return envelopeFits("L10", facts, sofa, BASE_WALKWAY_CM, 0, {
    passMessage: "Anchor seating fits within the measured living envelope with baseline circulation allowance.",
    failMessage: "Anchor seating may overfill the measured living envelope.",
    warning: "Consider a smaller sofa, loveseat, or reduced secondary seating before concept generation."
  });
}

function evaluateBedroomBedEnvelope(facts: SpatialRoomFacts): SpatialRuleVerdict {
  if (facts.roomType !== "bedroom") {
    return notApplicable("B2", "Bed clearance applies only to bedrooms.");
  }

  if (!canSupportTightClearance(facts)) {
    return needsMeasurement("B2", "Bed side-clearance checks need designer-verified measurements.");
  }

  const bed = footprintFor(facts, "bed");
  if (!hasFootprint(bed)) {
    return needsMeasurement("B2", "Bed clearance checks need bed dimensions.");
  }

  return envelopeFits("B2", facts, bed, BED_SIDE_CLEARANCE_CM, BED_FOOT_CLEARANCE_CM, {
    passMessage: "Bed envelope fits with baseline side and foot clearance.",
    failMessage: "Bed plus baseline clearances may overfill the measured bedroom.",
    warning: "Confirm bed size and whether both sides need usable access."
  });
}

function evaluateOfficeDeskEnvelope(facts: SpatialRoomFacts): SpatialRuleVerdict {
  if (facts.roomType !== "home_office") {
    return notApplicable("O2", "Desk rollback clearance applies only to home offices.");
  }

  if (!canSupportTightClearance(facts)) {
    return needsMeasurement("O2", "Desk rollback checks need designer-verified measurements.");
  }

  const desk = footprintFor(facts, "desk");
  if (!hasFootprint(desk)) {
    return needsMeasurement("O2", "Desk rollback checks need desk dimensions.");
  }

  return envelopeFits("O2", facts, desk, 0, OFFICE_CHAIR_ROLLBACK_CM, {
    passMessage: "Desk envelope leaves baseline chair rollback clearance.",
    failMessage: "Desk plus chair rollback clearance may overfill the measured office.",
    warning: "Use a smaller desk or compact occasional-work setup."
  });
}

function envelopeFits(
  ruleId: SpatialRuleId,
  facts: SpatialRoomFacts,
  footprint: SpatialFootprint,
  widthAllowanceCm: number,
  depthAllowanceCm: number,
  messages: { passMessage: string; failMessage: string; warning: string }
): SpatialRuleVerdict {
  const widthCm = footprint.widthCm ?? null;
  const depthCm = footprint.depthCm ?? null;
  const roomWidthCm = facts.measurements?.wallLengthCm ?? null;
  const roomDepthCm = facts.measurements?.roomDepthCm ?? null;

  if (!widthCm || !depthCm || !roomWidthCm || !roomDepthCm) {
    return needsMeasurement(ruleId, `${ruleId} needs complete room and product dimensions.`);
  }

  const orientationA =
    widthCm + widthAllowanceCm * 2 <= roomWidthCm && depthCm + depthAllowanceCm <= roomDepthCm;
  const orientationB =
    depthCm + widthAllowanceCm * 2 <= roomWidthCm && widthCm + depthAllowanceCm <= roomDepthCm;

  if (orientationA || orientationB) {
    return pass(ruleId, messages.passMessage);
  }

  return fail(ruleId, messages.failMessage, [messages.warning]);
}

function rule(
  id: SpatialRuleId,
  name: string,
  roomTypes: readonly (CatalogFirstRoomType | "living_plus_dining")[],
  checkability: SpatialRuleCheckability,
  requiresMeasurementConfidence: boolean,
  requiredInputs: readonly string[]
): SpatialRule {
  return {
    id,
    name,
    roomTypes,
    checkability,
    requiresMeasurementConfidence,
    requiredInputs,
    surfaces:
      checkability === "hard-checkable"
        ? ["hard_check", "designer_warning"]
        : checkability === "prompt-checkable"
          ? ["concept_prompt", "designer_warning"]
          : ["manual_qa", "designer_warning"],
    betaSafeNote:
      checkability === "hard-checkable"
        ? "Evaluate only from current structured facts and return needs_measurement when confidence or dimensions are insufficient."
        : "Do not enforce as deterministic logic until geometry and placement data exist."
  };
}

function hasKnownLayoutMode(intent: SpatialIntent) {
  return intent.layoutMode === "living_only" || intent.layoutMode === "living_plus_dining";
}

function canSupportProductFit(facts: SpatialRoomFacts) {
  const source = facts.measurements?.source ?? null;
  const confidence = facts.measurements?.confidence ?? null;

  return Boolean(
    source &&
      confidence &&
      facts.measurements?.wallLengthCm &&
      facts.measurements?.roomDepthCm &&
      fitConfidenceUsePolicy(source, confidence).canSupportProductFit
  );
}

function canSupportTightClearance(facts: SpatialRoomFacts) {
  const source = facts.measurements?.source ?? null;
  const confidence = facts.measurements?.confidence ?? null;

  return Boolean(
    source &&
      confidence &&
      facts.measurements?.wallLengthCm &&
      facts.measurements?.roomDepthCm &&
      fitConfidenceUsePolicy(source, confidence).canSupportTightClearance
  );
}

function roomAreaCm2(measurements: SpatialRoomMeasurements | null | undefined) {
  const wallLengthCm = measurements?.wallLengthCm ?? null;
  const roomDepthCm = measurements?.roomDepthCm ?? null;

  return wallLengthCm && roomDepthCm ? wallLengthCm * roomDepthCm : null;
}

function footprintFor(facts: SpatialRoomFacts, roleId: string) {
  return facts.footprintsByRoleId?.[roleId] ?? null;
}

function hasFootprint(footprint: SpatialFootprint | null | undefined): footprint is Required<SpatialFootprint> {
  return Boolean(footprint?.widthCm && footprint.depthCm);
}

function roleQuantity(roles: readonly SpatialRoleFact[], roleId: string) {
  return roles.find((roleItem) => roleItem.id === roleId)?.quantity ?? 0;
}

function pass(ruleId: SpatialRuleId, message: string): SpatialRuleVerdict {
  return { ruleId, status: "pass", message, warnings: [] };
}

function fail(ruleId: SpatialRuleId, message: string, warnings: readonly string[]): SpatialRuleVerdict {
  return { ruleId, status: "fail", message, warnings };
}

function needsMeasurement(ruleId: SpatialRuleId, message: string): SpatialRuleVerdict {
  return { ruleId, status: "needs_measurement", message, warnings: [message] };
}

function notApplicable(ruleId: SpatialRuleId, message: string): SpatialRuleVerdict {
  return { ruleId, status: "not_applicable", message, warnings: [] };
}
