export type RitzyRoomType = "living" | "dining" | "bedroom" | "bathroom" | "office" | "default";

export type RitzyStyleModule = {
  slug: string;
  name: string;
  fragment: string;
};

const livingRoomFocalPlacementGuardrail = [
  "Spatial placement rule: the primary seating must be placed on a different wall or zone from the focal point and oriented toward it.",
  "For TV/media focal rooms, the TV/media wall and primary sofa must not be on the same wall.",
  "Place the primary sofa opposite the TV/media wall, or on a perpendicular adjacent wall when source-room constraints require it.",
  "The sofa seat/front should face the TV/media wall or declared focal point across the rug and coffee-table zone.",
  "Accent chairs should angle inward toward the sofa/focal-point axis.",
  "If the source room makes TV-first placement impossible, preserve architecture, make the focal-point assumption explicit, and avoid sofa-under-TV placement."
].join(" ");

const roomLanguage: Record<RitzyRoomType, string> = {
  living:
    [
      "Design the living room as a layered editorial residential seating group: sofa and lounge chairs arranged for conversation, anchored by a generously sized rug, usable coffee table and side tables, full-height window treatment where visible, layered warm lighting, scaled artwork or focal wall, and restrained styled surfaces with books, ceramics, tray, branches, and tactile cushions.",
      livingRoomFocalPlacementGuardrail,
      "Make it collected-not-matched, materially rich, and residential in scale."
    ].join(" "),
  dining:
    "Design a residential dining room around a properly scaled table, realistic chair spacing and pull-out clearance, a sculptural over-table fixture centered on the table, layered warm secondary lighting, and a sideboard or wall focal point where space allows. Use restrained tablescape styling, tactile materials, and residential hosting realism; choose a rug only if it can support pulled-out chairs.",
  bedroom:
    "Design the bedroom around a credible bed wall: scaled headboard, usable bedside tables, warm layered bedside lighting, properly sized rug under the bed, finished window treatments, tactile layered bedding, and restrained art or wall treatment. Make it restful, residential, materially specific, and softly lived-in rather than generic hotel or catalog styling.",
  bathroom:
    "Preserve the existing bathroom layout and fixed fixtures. Upgrade only finishes, vanity/mirror/lighting composition, hardware, glass, towels, and decor unless renovation changes are requested. Resolve the vanity wall as a coherent designer elevation, define wet/dry zones, use believable stone/tile scale and aligned grout/seams, show realistic glass thickness and mirror reflections, and keep styling edited and residential.",
  office:
    "Design the home office as a composed residential work room: proper desk placement, ergonomic task chair, storage or shelving, task lighting, softened acoustics/textiles, art or styled background, and cable-conscious practical details. Make it productive, elegant, warm, and camera-ready without becoming corporate.",
  default:
    "Design the room as high-end editorial residential interior photography: layered, warm, tactile, realistic, and livable. Use credible furniture scale, restrained styling, layered lighting, real material texture, and residential composition. Avoid generic catalog staging, fantasy architecture, showroom smoothness, and decorative clutter."
};

const roomBlueprintLanguage: Record<RitzyRoomType, string> = {
  living: [
    "Ritzy living room blueprint: assume a complete Dubai living room includes a TV/media focal wall with an elegant media console and a primary sofa or sectional placed on a separate opposite wall/zone, or on a perpendicular adjacent wall when constraints require it, facing the TV/media wall across the rug and coffee-table zone.",
    "The TV/media wall and primary sofa must not be on the same wall; do not place the sofa directly under or against the TV/media wall facing away from it.",
    "Complete the seating group with secondary seating angled inward toward the sofa/focal-point axis, coffee table, generous rug, side tables, layered lamps or sconces, wall art or mirror/wall treatment, cushions, throws, greenery, and edited decor.",
    "Do not omit the TV/media layer unless the brief explicitly asks for no TV, a formal TV-free salon, a protected existing media wall, or a source-room constraint makes it impossible.",
    "Treat the TV and console as residential and elegant: widescreen TV, refined low console or built-in media unit, concealed cable logic, calm styling, and proportionate placement rather than a showroom electronics wall. If TV-first placement is impossible, preserve architecture, state the focal-point assumption in the concept, and avoid sofa-under-TV placement."
  ].join(" "),
  dining: [
    "Ritzy dining room blueprint: assume a complete dining room includes a correctly scaled dining table, enough dining chairs for the implied household/hosting count, an over-table pendant or chandelier, sideboard/credenza or console where wall space allows, wall art or mirror/wall treatment, restrained table styling, and warm secondary lighting.",
    "Do not omit the sideboard/credenza layer unless the source room has no credible wall or circulation clearance for it.",
    "Use a rug only when chair pull-out clearance and scale remain believable."
  ].join(" "),
  bedroom: [
    "Ritzy bedroom blueprint: assume a complete bedroom includes a bed or bed frame, considered headboard or bed wall, paired bedside tables where space allows, bedside lamps or sconces, properly scaled rug, curtains or window softness, layered bedding, wall art or mirror, and a dresser, bench, chair, or storage piece when the room size supports it.",
    "Keep the bedroom calm and uncluttered, but not unfinished; the result should feel designed, not like a bed placed in an empty room."
  ].join(" "),
  bathroom: [
    "Ritzy bathroom blueprint: preserve plumbing and fixed wet/dry zones while completing the designer layer with vanity lighting, mirror composition, towels, bath mat, tray/vessel styling, hardware, and edited greenery or decor where appropriate.",
    "Do not invent major plumbing moves unless the brief explicitly requests renovation-level change."
  ].join(" "),
  office: [
    "Ritzy home office blueprint: assume a complete home office includes a properly scaled desk, ergonomic task chair, storage/shelving or credenza, task lamp or layered lighting, rug or textile layer where appropriate, art/pinboard/shelves or a styled video-call background, and cable-conscious practical details.",
    "Keep it residential and refined, not corporate; include enough storage and lighting that it feels usable rather than staged."
  ].join(" "),
  default: [
    "Ritzy room blueprint: make the room feel complete by including the expected anchor furniture, supporting pieces, lighting, rug or textile layer where appropriate, storage or console where useful, wall art or mirror/wall treatment, and restrained decor.",
    "Let explicit user avoid-notes override blueprint defaults."
  ].join(" ")
};

export const styleDesignModules = [
  {
    slug: "warm-contemporary-gallery",
    name: "Warm Contemporary Gallery",
    fragment:
      "warm contemporary gallery style with plaster walls, walnut, travertine, tactile upholstery, oversized art, sculptural lighting, edited negative space, and collected ceramics"
  },
  {
    slug: "quiet-luxury-residential",
    name: "Quiet Luxury Residential",
    fragment:
      "quiet luxury residential style: tailored proportions, warm neutrals, honed stone, walnut, linen, wool, brushed bronze, layered warm lighting, custom-looking joinery, restrained styling"
  },
  {
    slug: "soft-modern-mediterranean",
    name: "Soft Modern Mediterranean",
    fragment:
      "soft modern Mediterranean style with limewashed plaster, warm stone, dark wood, woven texture, aged bronze, handmade ceramics, filtered daylight, and restrained architectural warmth"
  },
  {
    slug: "japandi-atelier",
    name: "Japandi Atelier",
    fragment:
      "Japandi atelier style with low balanced furniture, pale oak and walnut, matte plaster, linen, wool, handmade ceramics, concealed storage, soft filtered daylight, and warm sparse styling"
  },
  {
    slug: "parisian-contemporary",
    name: "Parisian Contemporary",
    fragment:
      "Parisian contemporary style with classic wall molding, warm plaster, modern sculptural upholstery, vintage accents, aged brass lighting, oversized art, and collected restraint"
  },
  {
    slug: "new-classic-dubai",
    name: "New Classic Dubai",
    fragment:
      "New Classic Dubai style with warm neutrals, limestone/travertine, walnut joinery, tailored upholstery, brushed bronze, soft paneling, integrated cove lighting, and calm villa-scale luxury"
  },
  {
    slug: "organic-modern",
    name: "Organic Modern",
    fragment:
      "organic modern style with rounded silhouettes, tactile neutrals, natural wood, travertine, plaster, linen, wool, handmade ceramics, and soft diffused light"
  },
  {
    slug: "contemporary-hotel-residence",
    name: "Contemporary Hotel Residence",
    fragment:
      "contemporary hotel-residence style with hospitality polish, residential scale, tailored upholstery, walnut, honed stone, layered warm lighting, full-height drapery, and edited luxury details"
  },
  {
    slug: "sculptural-minimal",
    name: "Sculptural Minimal",
    fragment:
      "sculptural minimal style with generous negative space, monolithic forms, warm plaster, honed stone, pale wood, tactile textiles, one sculptural light, and precise proportions"
  },
  {
    slug: "textured-neutral",
    name: "Textured Neutral",
    fragment:
      "textured neutral style with layered ivory, taupe, camel and walnut tones, boucle, linen, wool, travertine, plaster, warm lamps, and visible textile/material depth"
  },
  {
    slug: "collected-eclectic",
    name: "Collected Eclectic",
    fragment:
      "collected eclectic style with a controlled palette, contemporary anchor pieces, vintage accents, layered art, patterned rug, warm lamps, books, ceramics, and refined asymmetry"
  },
  {
    slug: "refined-coastal",
    name: "Refined Coastal",
    fragment:
      "refined coastal style with warm whites, linen, pale oak, natural fiber rugs, limestone, woven accents, filtered daylight, soft blue-grey notes, and no nautical theme decor"
  },
  {
    slug: "modern-arabic-luxury",
    name: "Modern Arabic Luxury",
    fragment:
      "modern Arabic luxury style with warm plaster, limestone, walnut, bronze, subtle geometric craft, bespoke joinery, generous hospitality-minded seating, warm layered light, and contemporary restraint"
  }
] satisfies RitzyStyleModule[];

const legacyStyleSlugMap: Record<string, string[]> = {
  modern: ["sculptural-minimal", "warm-contemporary-gallery"],
  contemporary: ["warm-contemporary-gallery", "organic-modern"],
  scandinavian: ["japandi-atelier", "textured-neutral"],
  industrial: ["warm-contemporary-gallery"],
  traditional: ["parisian-contemporary", "new-classic-dubai"],
  bohemian: ["collected-eclectic", "organic-modern"]
};

export function roomDesignLanguage(roomType: string) {
  return roomLanguage[resolveRoomType(roomType)];
}

export function roomBlueprintDefaultsLanguage(roomType: string) {
  return roomBlueprintLanguage[resolveRoomType(roomType)];
}

export function roomSpatialPlacementGuardrailLanguage(roomType: string) {
  return resolveRoomType(roomType) === "living" ? livingRoomFocalPlacementGuardrail : null;
}

export function styleDesignLanguage(styleSlugs: string[]) {
  const resolvedSlugs = resolveStyleSlugs(styleSlugs);
  const selected = resolvedSlugs
    .map((slug) => styleDesignModules.find((style) => style.slug === slug))
    .filter((style): style is RitzyStyleModule => Boolean(style));
  if (selected.length === 0) {
    return null;
  }

  return selected.map((style) => `${style.name}: ${style.fragment}.`).join("\n");
}

export function globalPhotorealismLanguage() {
  return [
    "Generate high-end editorial residential interior photography, not an illustration, sketch, mood board, or CGI showroom.",
    "Use physically plausible scale, corrected verticals, motivated daylight and practical lighting, realistic global illumination, contact shadows, balanced exposure, and preserved window highlights.",
    "Show tactile real materials: wool pile, linen weave, upholstery texture, wood grain direction, honed stone, plaster variation, brushed metal, glass reflections, roughness variation, softened bevels, curtain folds, cushion compression, and subtle lived-in asymmetry.",
    "Avoid fisheye distortion, warped furniture, floating objects, impossible reflections, fake labels, visible generated text, showroom sterility, generic beige luxury, and overdecorated surfaces."
  ].join(" ");
}

export function sourceRoomPreservationLanguage(roomType: string) {
  const base = [
    "Preserve the uploaded source room as the architectural anchor.",
    "Keep visible walls, windows, doors, ceiling plane, AC vents, switches, sockets, built-ins, openings, floor boundaries, camera perspective, and residential scale stable.",
    "Do not invent architectural renovations, change room proportions, or infer exact dimensions unless the user explicitly provides them."
  ];

  if (resolveRoomType(roomType) === "bathroom") {
    base.push(bathroomPreservationDetail(roomType));
  }

  return base.join(" ");
}

export function finalRenderProductFidelityLanguage() {
  return [
    "Treat selected product images as commerce-critical visual references, not mood-board inspiration.",
    "Product order indicates priority; preserve anchor products most strictly by silhouette, color family, material, proportions, and visible distinctive features.",
    "Do not substitute, recolor, merge, or restyle selected products into nicer invented alternatives.",
    "Every visible purchasable furniture, lighting, rug, mirror, art, curtain, textile, storage, or decor object should correspond to a selected product reference when that role is listed.",
    "Do not add purchasable-looking lamps, media consoles, ottomans, side tables, mirrors, wall art, plants, cushions, trays, or decor unless they are explicitly represented in the selected product list; if a support role is missing, leave the composition simpler instead of inventing it.",
    "When dimensions are provided, respect the product's approximate width, depth, height, seat count, and room role; do not stretch a compact two-seater into a sectional or turn one lounge chair SKU into a different chair silhouette.",
    "Adapt the room around the products, keep selected products distinct, and allow only natural perspective, shadows, and room lighting to change their appearance.",
    "If exact SKU reproduction is not reliable, create a representative room render and do not imply exact product accuracy."
  ].join(" ");
}

export function productRoleLanguage(roomType: string) {
  const resolved = resolveRoomType(roomType);

  if (resolved === "living") {
    return "Consider layered living room product roles from the Ritzy blueprint: anchor seating, secondary seating, coffee table, side/end tables, generous rug, TV/media console or built-in media unit by default, floor/table lighting, wall art or mirror, curtains/textiles when catalog supports them, and cushions/decor.";
  }

  if (resolved === "dining") {
    return "Consider layered dining room product roles from the Ritzy blueprint: dining table, dining chairs, over-table lighting, sideboard/credenza/dining console where wall space allows, rug only when practical, wall art or mirror, restrained table decor, and curtains/textiles when visible and catalog-supported.";
  }

  if (resolved === "bedroom") {
    return "Consider layered bedroom product roles without forcing every item: bed or bed frame, headboard when relevant, bedside tables, bedside lighting, rug, bedding/textiles when catalog supports them, curtains/window treatment, bench/stool/chair only when space allows, wall art or mirror, and restrained decor.";
  }

  if (resolved === "bathroom") {
    return "Consider conservative bathroom product roles without moving plumbing: mirror or medicine cabinet, vanity lighting/sconces, towels, bath mat, stool/bench if space allows, tray/vessel/plant/decor, and only hard fixtures if catalog support and renovation scope are explicit.";
  }

  if (resolved === "office") {
    return "Consider layered home office product roles without forcing every item: desk, ergonomic task chair, storage/shelving or credenza, task lamp, rug/textiles, wall art or pinboard, and decor that makes the workspace residential, organized, and camera-ready.";
  }

  return "Consider layered product roles that materially define the room: anchor furniture, supporting furniture, rug/textiles, lighting, art or mirror, storage where useful, and restrained decor. Do not force every layer into every room.";
}

function resolveStyleSlugs(styleSlugs: string[]) {
  const resolved: string[] = [];

  for (const slug of styleSlugs) {
    const mapped = legacyStyleSlugMap[slug] ?? [slug];
    for (const mappedSlug of mapped) {
      if (!resolved.includes(mappedSlug)) {
        resolved.push(mappedSlug);
      }
    }
  }

  return resolved;
}

function bathroomPreservationDetail(roomType: string) {
  const normalized = roomType.toLowerCase();

  if (normalized.includes("powder") || normalized.includes("wc")) {
    return "For powder rooms and WCs, preserve toilet, basin/vanity location, drains, windows, doors, ceiling, visible wall boundaries, and plumbing locations unless renovation-level changes are explicitly requested.";
  }

  return "For bathrooms, preserve toilet, shower/tub footprint, basin/vanity location, drains, windows, doors, ceiling, visible wet/dry boundaries, and plumbing locations unless renovation-level changes are explicitly requested.";
}

function resolveRoomType(roomType: string): RitzyRoomType {
  const normalized = roomType.toLowerCase();

  if (normalized.includes("living") || normalized.includes("lounge") || normalized.includes("family")) {
    return "living";
  }

  if (normalized.includes("dining")) {
    return "dining";
  }

  if (normalized.includes("bed") || normalized.includes("primary suite")) {
    return "bedroom";
  }

  if (
    normalized.includes("bath") ||
    normalized.includes("powder") ||
    normalized.includes("ensuite") ||
    normalized.includes("washroom") ||
    normalized.includes("wc")
  ) {
    return "bathroom";
  }

  if (normalized.includes("office") || normalized.includes("study") || normalized.includes("workspace")) {
    return "office";
  }

  return "default";
}
