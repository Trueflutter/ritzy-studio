// The measurement-confidence policy kept from the retired measurement-intelligence
// module (Gate 1 disposition): spatial-design-rules needs exactly this slice, the
// property-layout apparatus around it had no live consumer.

export type MeasurementSourceKind =
  | "manual"
  | "user_measured"
  | "floor_plan"
  | "floor_plan_upload"
  | "annotation"
  | "known_developer_layout"
  | "third_party_scan_import"
  | "native_room_scan"
  | "designer_verified"
  | "estimated";

export type MeasurementConfidence =
  | "unknown"
  | "estimated"
  | "assumed"
  | "prefill"
  | "user_confirmed"
  | "verified"
  | "designer_verified";

export type FitConfidenceUsePolicy = {
  source: MeasurementSourceKind;
  confidence: MeasurementConfidence;
  requiresConfirmation: boolean;
  canSupportProductFit: boolean;
  canSupportTightClearance: boolean;
};

function isUserConfirmed(confidence: MeasurementConfidence) {
  return confidence === "user_confirmed" || confidence === "verified" || confidence === "designer_verified";
}

function isDesignerVerified(source: MeasurementSourceKind, confidence: MeasurementConfidence) {
  return source === "designer_verified" || confidence === "designer_verified";
}

export function measurementSourceRequiresConfirmation(
  source: MeasurementSourceKind,
  confidence: MeasurementConfidence
) {
  if (isDesignerVerified(source, confidence) || isUserConfirmed(confidence)) {
    return false;
  }

  return true;
}

export function measurementCanSupportProductFit(source: MeasurementSourceKind, confidence: MeasurementConfidence) {
  if (measurementSourceRequiresConfirmation(source, confidence)) {
    return false;
  }

  if (isDesignerVerified(source, confidence) || isUserConfirmed(confidence)) {
    return true;
  }

  return ["manual", "user_measured", "native_room_scan", "third_party_scan_import"].includes(source);
}

export function measurementCanSupportTightClearance(source: MeasurementSourceKind, confidence: MeasurementConfidence) {
  return isDesignerVerified(source, confidence);
}

export function fitConfidenceUsePolicy(
  source: MeasurementSourceKind,
  confidence: MeasurementConfidence
): FitConfidenceUsePolicy {
  return {
    source,
    confidence,
    requiresConfirmation: measurementSourceRequiresConfirmation(source, confidence),
    canSupportProductFit: measurementCanSupportProductFit(source, confidence),
    canSupportTightClearance: measurementCanSupportTightClearance(source, confidence)
  };
}
