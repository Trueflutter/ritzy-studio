export type RitzyRoomType = "living" | "dining" | "bedroom" | "bathroom" | "default";

export type RitzyStyleModule = {
  slug: string;
  name: string;
  fragment: string;
};

const roomLanguage: Record<RitzyRoomType, string> = {
  living:
    "Design the living room as a layered editorial residential seating group: sofa and lounge chairs arranged for conversation, anchored by a generously sized rug, usable coffee table and side tables, full-height window treatment where visible, layered warm lighting, scaled artwork or focal wall, and restrained styled surfaces with books, ceramics, tray, branches, and tactile cushions. Make it collected-not-matched, materially rich, and residential in scale.",
  dining:
    "Design a residential dining room around a properly scaled table, realistic chair spacing and pull-out clearance, a sculptural over-table fixture centered on the table, layered warm secondary lighting, and a sideboard or wall focal point where space allows. Use restrained tablescape styling, tactile materials, and residential hosting realism; choose a rug only if it can support pulled-out chairs.",
  bedroom:
    "Design the bedroom around a credible bed wall: scaled headboard, usable bedside tables, warm layered bedside lighting, properly sized rug under the bed, finished window treatments, tactile layered bedding, and restrained art or wall treatment. Make it restful, residential, materially specific, and softly lived-in rather than generic hotel or catalog styling.",
  bathroom:
    "Preserve the existing bathroom layout and fixed fixtures. Upgrade only finishes, vanity/mirror/lighting composition, hardware, glass, towels, and decor unless renovation changes are requested. Resolve the vanity wall as a coherent designer elevation, define wet/dry zones, use believable stone/tile scale and aligned grout/seams, show realistic glass thickness and mirror reflections, and keep styling edited and residential.",
  default:
    "Design the room as high-end editorial residential interior photography: layered, warm, tactile, realistic, and livable. Use credible furniture scale, restrained styling, layered lighting, real material texture, and residential composition. Avoid generic catalog staging, fantasy architecture, showroom smoothness, and decorative clutter."
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
    "Adapt the room around the products, keep selected products distinct, and allow only natural perspective, shadows, and room lighting to change their appearance.",
    "If exact SKU reproduction is not reliable, create a representative room render and do not imply exact product accuracy."
  ].join(" ");
}

export function productRoleLanguage(roomType: string) {
  const resolved = resolveRoomType(roomType);

  if (resolved === "living") {
    return "Consider layered living room product roles without forcing every item: anchor seating, secondary seating, coffee table, side/end tables, generous rug, floor/table lighting, wall art or mirror, curtains/textiles when catalog supports them, cushions/decor, and console/media/storage when the room needs a wall anchor.";
  }

  if (resolved === "dining") {
    return "Consider layered dining room product roles without forcing every item: dining table, dining chairs, over-table lighting, sideboard/credenza/bar cabinet when wall space allows, rug only when practical, wall art or mirror, restrained table decor, and curtains/textiles when visible and catalog-supported.";
  }

  if (resolved === "bedroom") {
    return "Consider layered bedroom product roles without forcing every item: bed or bed frame, headboard when relevant, bedside tables, bedside lighting, rug, bedding/textiles when catalog supports them, curtains/window treatment, bench/stool/chair only when space allows, wall art or mirror, and restrained decor.";
  }

  if (resolved === "bathroom") {
    return "Consider conservative bathroom product roles without moving plumbing: mirror or medicine cabinet, vanity lighting/sconces, towels, bath mat, stool/bench if space allows, tray/vessel/plant/decor, and only hard fixtures if catalog support and renovation scope are explicit.";
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

  return "default";
}
