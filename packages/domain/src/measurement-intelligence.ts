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

export type PropertyCommunity = {
  id: string;
  name: string;
  aliases: PropertyLayoutAlias[];
  city: "Dubai" | string;
};

export type PropertyDevelopment = {
  id: string;
  communityId: string;
  name: string;
  developer: string;
  aliases: PropertyLayoutAlias[];
};

export type PropertyLayout = {
  id: string;
  communityId: string;
  developmentId: string;
  name: string;
  typeCode: string | null;
  bedroomCount: number | null;
  propertyType: "villa" | "townhouse" | "apartment" | "other";
  aliases: PropertyLayoutAlias[];
  rooms: PropertyLayoutRoom[];
  source: PropertyLayoutSource;
};

export type PropertyLayoutAlias = {
  value: string;
  normalized: string;
  kind: "community" | "development" | "layout_code" | "marketing_name" | "user_phrase";
};

export type PropertyLayoutRoom = {
  id: string;
  name: string;
  roomType: string;
  floor: "ground" | "first" | "second" | "other" | null;
  wallLengthCm: number | null;
  roomDepthCm: number | null;
  ceilingHeightCm: number | null;
  source: MeasurementSourceKind;
  confidence: MeasurementConfidence;
  notes?: string;
};

export type PropertyLayoutSource = {
  kind: "developer_brochure" | "broker_floor_plan" | "public_listing" | "internal_research" | "user_upload";
  label: string;
  url?: string;
  retrievedAt?: string;
  disclaimer?: string;
};

export type RoomMeasurementSourceSelection = {
  source: MeasurementSourceKind;
  confidence: MeasurementConfidence;
  propertyLayoutId?: string;
  propertyLayoutRoomId?: string;
  userConfirmedAt?: string | null;
  designerVerifiedAt?: string | null;
};

export type FitConfidenceUsePolicy = {
  source: MeasurementSourceKind;
  confidence: MeasurementConfidence;
  requiresConfirmation: boolean;
  canSupportProductFit: boolean;
  canSupportTightClearance: boolean;
};

export type LayoutCandidateRankInput = {
  community?: string | null;
  development?: string | null;
  layout?: string | null;
  bedroomCount?: number | null;
  propertyType?: PropertyLayout["propertyType"] | null;
};

export type RankedPropertyLayoutCandidate = {
  layout: PropertyLayout;
  score: number;
  matchedAliases: string[];
};

export const dubaiMeasurementLayoutFixtures: PropertyLayout[] = [
  {
    id: "damac-hills-2-th12-4e",
    communityId: "damac-hills-2",
    developmentId: "damac-hills-2",
    name: "DAMAC Hills 2 TH12 4E townhouse",
    typeCode: "TH12-4E",
    bedroomCount: 4,
    propertyType: "townhouse",
    aliases: aliases([
      ["Akoya Oxygen", "community"],
      ["Damac Hills 2", "community"],
      ["DAMAC Hills 2", "development"],
      ["TH12-4E", "layout_code"],
      ["TH12 4E", "layout_code"],
      ["4 bedroom end unit", "user_phrase"]
    ]),
    rooms: [
      layoutRoom("damac-hills-2-th12-4e-living", "Living / Dining", "Living Room", 610, 420),
      layoutRoom("damac-hills-2-th12-4e-primary", "Primary Bedroom", "Bedroom", 420, 390)
    ],
    source: {
      kind: "broker_floor_plan",
      label: "DAMAC Hills 2 public floor-plan research",
      disclaimer: "Developer and broker floor plans may be approximate and require user confirmation."
    }
  },
  {
    id: "murooj-al-furjan-4-bed-corner",
    communityId: "al-furjan",
    developmentId: "murooj-al-furjan",
    name: "Murooj Al Furjan 4-bed corner villa",
    typeCode: null,
    bedroomCount: 4,
    propertyType: "villa",
    aliases: aliases([
      ["Al Furjan", "community"],
      ["Murooj Al Furjan", "development"],
      ["Murooj Al Furjan 4-bed corner", "marketing_name"],
      ["Murooj Al Furjan 4 bedroom corner", "user_phrase"],
      ["Al Furjan villa/townhouse", "user_phrase"]
    ]),
    rooms: [
      layoutRoom("murooj-al-furjan-4-bed-corner-family", "Family Living", "Living Room", 680, 470),
      layoutRoom("murooj-al-furjan-4-bed-corner-dining", "Dining", "Dining Room", 430, 360)
    ],
    source: {
      kind: "developer_brochure",
      label: "Murooj Al Furjan developer layout research",
      disclaimer: "Structured example only; dimensions must be confirmed before fit-sensitive use."
    }
  },
  {
    id: "arabian-ranches-4-bed-villa",
    communityId: "arabian-ranches",
    developmentId: "arabian-ranches-villas",
    name: "Arabian Ranches 4-bed villa",
    typeCode: null,
    bedroomCount: 4,
    propertyType: "villa",
    aliases: aliases([
      ["Arabian Ranches", "community"],
      ["Arabian Ranches villa", "marketing_name"],
      ["Dubai Hills villa", "user_phrase"],
      ["4 bed villa", "user_phrase"]
    ]),
    rooms: [
      layoutRoom("arabian-ranches-4-bed-villa-living", "Living Room", "Living Room", 720, 520),
      layoutRoom("arabian-ranches-4-bed-villa-study", "Study", "Home Office", 340, 300)
    ],
    source: {
      kind: "internal_research",
      label: "Dubai villa measurement intelligence fixture",
      disclaimer: "Representative Dubai villa fixture for domain tests, not a production seed."
    }
  }
];

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

export function normalizeLayoutAlias(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bbr\b/g, " bedroom ")
    .replace(/\bbedrooms?\b/g, " bed ")
    .replace(/\btown\s*houses?\b/g, " townhouse ")
    .replace(/\bvillas?\b/g, " villa ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b([a-z]+)(\d+)\b/g, "$1 $2")
    .replace(/\b(\d+)([a-z]+)\b/g, "$1 $2")
    .trim()
    .replace(/\s+/g, " ");
}

export function rankLayoutCandidates(
  input: LayoutCandidateRankInput,
  layouts: PropertyLayout[]
): RankedPropertyLayoutCandidate[] {
  const inputAliases = [
    input.community,
    input.development,
    input.layout,
    input.bedroomCount ? `${input.bedroomCount} bed` : null,
    input.propertyType ?? null
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeLayoutAlias)
    .filter(Boolean);

  if (inputAliases.length === 0) {
    return [];
  }

  return layouts
    .map((layout) => {
      const candidateAliases = aliasesForLayout(layout);
      const matchedAliases: string[] = [];
      let score = 0;

      for (const inputAlias of inputAliases) {
        for (const candidateAlias of candidateAliases) {
          const aliasScore = scoreAliasMatch(inputAlias, candidateAlias);
          if (aliasScore > 0) {
            score += aliasScore;
            matchedAliases.push(candidateAlias);
          }
        }
      }

      if (input.bedroomCount !== undefined && input.bedroomCount !== null && layout.bedroomCount === input.bedroomCount) {
        score += 8;
      }

      if (input.propertyType && layout.propertyType === input.propertyType) {
        score += 6;
      }

      return {
        layout,
        score,
        matchedAliases: Array.from(new Set(matchedAliases))
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.layout.name.localeCompare(right.layout.name));
}

function isUserConfirmed(confidence: MeasurementConfidence) {
  return confidence === "user_confirmed" || confidence === "verified" || confidence === "designer_verified";
}

function isDesignerVerified(source: MeasurementSourceKind, confidence: MeasurementConfidence) {
  return source === "designer_verified" || confidence === "designer_verified";
}

function aliases(values: Array<[value: string, kind: PropertyLayoutAlias["kind"]]>): PropertyLayoutAlias[] {
  return values.map(([value, kind]) => ({
    value,
    normalized: normalizeLayoutAlias(value),
    kind
  }));
}

function layoutRoom(
  id: string,
  name: string,
  roomType: string,
  wallLengthCm: number,
  roomDepthCm: number
): PropertyLayoutRoom {
  return {
    id,
    name,
    roomType,
    floor: "ground",
    wallLengthCm,
    roomDepthCm,
    ceilingHeightCm: null,
    source: "known_developer_layout",
    confidence: "prefill"
  };
}

function aliasesForLayout(layout: PropertyLayout) {
  return [
    normalizeLayoutAlias(layout.name),
    layout.typeCode ? normalizeLayoutAlias(layout.typeCode) : null,
    layout.bedroomCount ? normalizeLayoutAlias(`${layout.bedroomCount} bed`) : null,
    normalizeLayoutAlias(layout.propertyType),
    ...layout.aliases.map((alias) => alias.normalized)
  ].filter((value): value is string => Boolean(value));
}

function scoreAliasMatch(inputAlias: string, candidateAlias: string) {
  if (inputAlias === candidateAlias) {
    return 30;
  }

  if (inputAlias.includes(candidateAlias) || candidateAlias.includes(inputAlias)) {
    return 16;
  }

  const inputTokens = new Set(inputAlias.split(" "));
  const candidateTokens = new Set(candidateAlias.split(" "));
  const overlap = Array.from(inputTokens).filter((token) => candidateTokens.has(token));

  return overlap.length >= 2 ? overlap.length * 3 : 0;
}
