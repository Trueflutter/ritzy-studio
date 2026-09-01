import { z } from "zod";

export {
  conceptViewCameraLanguage,
  conceptViewConsistencyLanguage,
  finalRenderProductFidelityLanguage,
  finalRenderViewConsistencyLanguage,
  globalPhotorealismLanguage,
  paletteRegisterLanguage,
  productRoleLanguage,
  roomBlueprintDefaultsLanguage,
  roomDesignLanguage,
  roomSpatialPlacementGuardrailLanguage,
  sourceRoomPreservationLanguage,
  spatialLayoutLanguage,
  styleDesignLanguage,
  styleDesignModules,
  type ConceptViewKey,
  type RitzyRoomType,
  type RitzyStyleModule,
  type SpatialPromptIntent
} from "./interior-design-language";

export const clarifyingQuestionsPrompt = {
  key: "brief.clarifying_questions",
  version: "2026-04-29.1",
  system: [
    "You are Ritzy Studio's interior design intake assistant.",
    "Generate only the few clarifying questions that materially change the design direction, budget, fit, or client approval.",
    "Do not ask for facts already provided.",
    "Do not ask more than five questions.",
    "Do not ask for exact dimensions if the designer already provided useful measurements.",
    "Keep every question concise, practical, and suitable for a Dubai residential interior design workflow."
  ].join("\n")
} as const;

export const clarifyingQuestionSchema = z.object({
  question: z.string().min(8).max(220),
  reason: z.string().min(8).max(180)
});

export const clarifyingQuestionsResponseSchema = z.object({
  questions: z.array(clarifyingQuestionSchema).max(5)
});

export const clarifyingQuestionsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: {
            type: "string",
            minLength: 8,
            maxLength: 220
          },
          reason: {
            type: "string",
            minLength: 8,
            maxLength: 180
          }
        },
        required: ["question", "reason"]
      }
    }
  },
  required: ["questions"]
} as const;

export type ClarifyingQuestionsResponse = z.infer<typeof clarifyingQuestionsResponseSchema>;

export const inspirationAnalysisPrompt = {
  key: "brief.inspiration_analysis",
  version: "2026-05-19.1",
  system: [
    "You are Ritzy Studio's senior interior design image analyst.",
    "Read the user's inspiration images as references for style, palette, materials, and mood.",
    "Do not describe every object. Synthesize the useful design direction a client can edit.",
    "Keep the output concise, premium, and practical for a Dubai residential interior design brief."
  ].join("\n")
} as const;

export const inspirationAnalysisResponseSchema = z.object({
  styleDirection: z.string().min(12).max(420),
  palette: z.array(z.string().min(2).max(40)).min(1).max(8),
  materials: z.array(z.string().min(2).max(50)).min(1).max(8),
  mood: z.string().min(12).max(320)
});

export const inspirationAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    styleDirection: { type: "string", minLength: 12, maxLength: 420 },
    palette: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: { type: "string", minLength: 2, maxLength: 40 }
    },
    materials: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: { type: "string", minLength: 2, maxLength: 50 }
    },
    mood: { type: "string", minLength: 12, maxLength: 320 }
  },
  required: ["styleDirection", "palette", "materials", "mood"]
} as const;

export type InspirationAnalysisResponse = z.infer<typeof inspirationAnalysisResponseSchema>;

export const conceptPalettePrompt = {
  key: "concept.palette_extraction",
  version: "2026-07-10.1",
  system: [
    "You are Ritzy Studio's interior palette analyst.",
    "Read the generated interior concept image and report the palette AS RENDERED, not as briefed.",
    "Use lowercase canonical color-family tokens where possible: black, blue, brown, camel, tan, charcoal, cream, ivory, beige, taupe, oatmeal, sand, green, sage, olive, grey, red, terracotta, rust, burgundy, white, gold, brass, bronze, walnut, oak, purple, orange, pink.",
    "Use lowercase canonical material tokens where possible: linen, boucle, velvet, leather, chenille, wool, fabric, wood, walnut, oak, marble, travertine, stone, glass, brass, bronze, metal, plaster, ceramic, rattan, jute.",
    "dominantColors: the 2-4 color families that define large surfaces and anchor furniture.",
    "accentColors: the 1-4 color families used in smaller doses (decor, art, plants, metal finishes).",
    "dominantMaterials: the 2-6 material families that visibly define the room.",
    "avoidColors: 1-4 color families that would clash with this palette if a product carried them."
  ].join("\n")
} as const;

export const conceptPaletteResponseSchema = z.object({
  dominantColors: z.array(z.string().min(2).max(30)).min(1).max(4),
  accentColors: z.array(z.string().min(2).max(30)).max(4),
  dominantMaterials: z.array(z.string().min(2).max(30)).min(1).max(6),
  avoidColors: z.array(z.string().min(2).max(30)).max(4)
});

export const conceptPaletteJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    dominantColors: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string", minLength: 2, maxLength: 30 }
    },
    accentColors: {
      type: "array",
      maxItems: 4,
      items: { type: "string", minLength: 2, maxLength: 30 }
    },
    dominantMaterials: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string", minLength: 2, maxLength: 30 }
    },
    avoidColors: {
      type: "array",
      maxItems: 4,
      items: { type: "string", minLength: 2, maxLength: 30 }
    }
  },
  required: ["dominantColors", "accentColors", "dominantMaterials", "avoidColors"]
} as const;

export type ConceptPaletteResponse = z.infer<typeof conceptPaletteResponseSchema>;

export const renderSpatialQaPrompt = {
  key: "render.spatial_qa",
  version: "2026-07-10.1",
  system: [
    "You are Ritzy Studio's spatial quality reviewer for generated interior images.",
    "Judge the image like a senior interior designer reviewing a junior's render before it goes to a client.",
    "Checks:",
    "- focalOrientation: primary seating (or bed/desk for those rooms) addresses the room's focal point; seating is not turned away from it. Use not_applicable when the room type has no seating-focal relationship.",
    "- anchorAlignment: the primary sofa/bed/table reads parallel to its wall and square to the rug and room grid, not canted diagonally without an architectural reason.",
    "- scalePlausibility: furniture sizes and clearances are physically believable for the room; no giant rugs, doll furniture, blocked doors, or impossible walkways. An area rug must anchor its furniture group (at least the front legs of the seating on it); a rug floating like a bath mat near the coffee table is a fail.",
    "- compositionIntegrity: no warped furniture, floating objects, impossible reflections, duplicated limbs of furniture, or visible AI artifacts a client would notice.",
    "- zoning (combined living+dining only, else not_applicable): living and dining read as two coherent zones with a clear boundary and circulation, dining never between the sofa and its focal wall.",
    "Judge strictly, as if your name goes on the presentation. When a check is genuinely borderline, mark the check fail and let the verdict be warn rather than silently passing it.",
    "verdict: pass when a professional would present this image as-is; warn for real but presentable flaws; regenerate for faux pas a client would reject (wrong orientation, clearly canted anchor, broken or missing rug anchoring, broken scale, obvious artifacts).",
    "issues: short, specific, designer-voiced descriptions of each failed check. Empty when everything passes."
  ].join("\n")
} as const;

const qaCheckEnum = z.enum(["pass", "fail", "not_applicable"]);

export const renderSpatialQaResponseSchema = z.object({
  focalOrientation: qaCheckEnum,
  anchorAlignment: qaCheckEnum,
  scalePlausibility: qaCheckEnum,
  compositionIntegrity: qaCheckEnum,
  zoning: qaCheckEnum,
  verdict: z.enum(["pass", "warn", "regenerate"]),
  issues: z.array(z.string().min(4).max(240)).max(6)
});

export const renderSpatialQaJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    focalOrientation: { type: "string", enum: ["pass", "fail", "not_applicable"] },
    anchorAlignment: { type: "string", enum: ["pass", "fail", "not_applicable"] },
    scalePlausibility: { type: "string", enum: ["pass", "fail", "not_applicable"] },
    compositionIntegrity: { type: "string", enum: ["pass", "fail", "not_applicable"] },
    zoning: { type: "string", enum: ["pass", "fail", "not_applicable"] },
    verdict: { type: "string", enum: ["pass", "warn", "regenerate"] },
    issues: {
      type: "array",
      maxItems: 6,
      items: { type: "string", minLength: 4, maxLength: 240 }
    }
  },
  required: [
    "focalOrientation",
    "anchorAlignment",
    "scalePlausibility",
    "compositionIntegrity",
    "zoning",
    "verdict",
    "issues"
  ]
} as const;

export type RenderSpatialQaResponse = z.infer<typeof renderSpatialQaResponseSchema>;

export const initialConceptPrompt = {
  key: "concept.initial_room_analysis",
  version: "2026-05-04.1",
  system: [
    "You are Ritzy Studio's senior interior concept architect.",
    "Analyze the uploaded residential room photo and the saved designer brief.",
    "Identify visible fixed architecture and uncertainty plainly.",
    "Create one initial concept direction suitable for image editing.",
    "The image direction must read as a photorealistic interior-design photograph, not an illustration, sketch, collage, CGI showroom, or mood board.",
    "Specify camera-realistic materials, natural shadows, physically plausible scale, believable furniture placement, and residential lens perspective.",
    "Do not claim real product availability or exact SKU matching.",
    "Do not infer exact dimensions from a photo; use only provided measurements as verified.",
    "Keep the output practical for a Dubai residential interior designer."
  ].join("\n")
} as const;

export const initialConceptResponseSchema = z.object({
  roomAnalysis: z.object({
    detectedRoomType: z.string().min(2).max(80),
    fixedArchitecture: z.array(z.string().min(2).max(140)).max(10),
    editableZones: z.array(z.string().min(2).max(140)).max(10),
    fixedElementsToPreserve: z.array(z.string().min(2).max(140)).max(12),
    lightingNotes: z.array(z.string().min(2).max(140)).max(8),
    uncertaintyNotes: z.array(z.string().min(2).max(160)).max(8)
  }),
  concept: z.object({
    title: z.string().min(4).max(80),
    rationale: z.string().min(20).max(600),
    generationPrompt: z.string().min(80).max(2800),
    preserveList: z.array(z.string().min(2).max(140)).max(12),
    allowedChangeList: z.array(z.string().min(2).max(140)).max(12),
    uncertaintyNote: z.string().min(8).max(300)
  })
});

export const initialConceptJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    roomAnalysis: {
      type: "object",
      additionalProperties: false,
      properties: {
        detectedRoomType: { type: "string", minLength: 2, maxLength: 80 },
        fixedArchitecture: {
          type: "array",
          maxItems: 10,
          items: { type: "string", minLength: 2, maxLength: 140 }
        },
        editableZones: {
          type: "array",
          maxItems: 10,
          items: { type: "string", minLength: 2, maxLength: 140 }
        },
        fixedElementsToPreserve: {
          type: "array",
          maxItems: 12,
          items: { type: "string", minLength: 2, maxLength: 140 }
        },
        lightingNotes: {
          type: "array",
          maxItems: 8,
          items: { type: "string", minLength: 2, maxLength: 140 }
        },
        uncertaintyNotes: {
          type: "array",
          maxItems: 8,
          items: { type: "string", minLength: 2, maxLength: 160 }
        }
      },
      required: [
        "detectedRoomType",
        "fixedArchitecture",
        "editableZones",
        "fixedElementsToPreserve",
        "lightingNotes",
        "uncertaintyNotes"
      ]
    },
    concept: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string", minLength: 4, maxLength: 80 },
        rationale: { type: "string", minLength: 20, maxLength: 600 },
        generationPrompt: { type: "string", minLength: 80, maxLength: 2800 },
        preserveList: {
          type: "array",
          maxItems: 12,
          items: { type: "string", minLength: 2, maxLength: 140 }
        },
        allowedChangeList: {
          type: "array",
          maxItems: 12,
          items: { type: "string", minLength: 2, maxLength: 140 }
        },
        uncertaintyNote: { type: "string", minLength: 8, maxLength: 300 }
      },
      required: [
        "title",
        "rationale",
        "generationPrompt",
        "preserveList",
        "allowedChangeList",
        "uncertaintyNote"
      ]
    }
  },
  required: ["roomAnalysis", "concept"]
} as const;

export type InitialConceptResponse = z.infer<typeof initialConceptResponseSchema>;

// Revision extends the concept response with the critique-derived change plan:
// what must change, and what must stay visually identical. The visual-diff QA
// judges the revised image against exactly these two lists.
export const conceptRevisionResponseSchema = initialConceptResponseSchema.extend({
  changePlan: z.object({
    mustChange: z.array(z.string().min(2).max(160)).min(1).max(10),
    mustPreserve: z.array(z.string().min(2).max(160)).max(14)
  })
});

export const conceptRevisionJsonSchema = {
  ...initialConceptJsonSchema,
  properties: {
    ...initialConceptJsonSchema.properties,
    changePlan: {
      type: "object",
      additionalProperties: false,
      properties: {
        mustChange: {
          type: "array",
          minItems: 1,
          maxItems: 10,
          items: { type: "string", minLength: 2, maxLength: 160 }
        },
        mustPreserve: {
          type: "array",
          maxItems: 14,
          items: { type: "string", minLength: 2, maxLength: 160 }
        }
      },
      required: ["mustChange", "mustPreserve"]
    }
  },
  required: ["roomAnalysis", "concept", "changePlan"]
} as const;

export type ConceptRevisionResponse = z.infer<typeof conceptRevisionResponseSchema>;

// Visual-diff QA over a revision: did the asked change happen, did anything
// outside the change plan drift. The summary is written to concepts.diff_summary
// and shown on the concepts screen.
export const revisionVisualDiffPrompt = {
  key: "concept.revision_visual_diff",
  version: "2026-09-01.1",
  system: [
    "You are Ritzy Studio's revision QA reviewer.",
    "Image 1 is the PREVIOUS concept. Image 2 is the REVISED concept.",
    "Judge the revision against the provided change plan only.",
    "changeApplied: yes when every mustChange item is visibly applied in image 2; partial when some are; no when none are.",
    "unintendedChanges: elements that differ between the images but appear in neither mustChange nor mustPreserve as an allowed change — palette shifts, swapped furniture, moved layout, altered architecture. Empty when the edit stayed scoped.",
    "summary: one or two plain sentences a homeowner understands, stating what changed and whether anything drifted. No scores, no jargon.",
    "Be strict about architecture: any wall, window, door, or opening difference is always an unintended change."
  ].join("\n")
} as const;

export const revisionVisualDiffResponseSchema = z.object({
  changeApplied: z.enum(["yes", "partial", "no"]),
  unintendedChanges: z.array(z.string().min(2).max(200)).max(10),
  summary: z.string().min(8).max(400)
});

export const revisionVisualDiffJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    changeApplied: { type: "string", enum: ["yes", "partial", "no"] },
    unintendedChanges: {
      type: "array",
      maxItems: 10,
      items: { type: "string", minLength: 2, maxLength: 200 }
    },
    summary: { type: "string", minLength: 8, maxLength: 400 }
  },
  required: ["changeApplied", "unintendedChanges", "summary"]
} as const;

export type RevisionVisualDiffResponse = z.infer<typeof revisionVisualDiffResponseSchema>;

export const conceptProductSourcingPrompt = {
  key: "sourcing.concept_visual_product_match",
  version: "2026-05-22.1",
  system: [
    "You are Ritzy Studio's visual product sourcing assistant.",
    "Use the approved concept image as the visual source of truth.",
    "First identify the visible and blueprint-expected movable product roles that materially define the design: seating, tables, rug, lighting, wall art, decor, storage, media units, sideboards, and mirrors.",
    "Use the room blueprint and expected product roles supplied by the app as required context; do not ignore designer-standard roles just because they are secondary styling layers.",
    "The app provides candidates grouped by role. Treat each role pool independently; do not choose a sofa for a chair role, a lounge chair for dining chairs, or a bookcase for a TV/media console when role-specific products are available.",
    "For living rooms, consider TV/media console or built-in media storage as a normal Dubai living-room role unless the brief excludes TV.",
    "For dining rooms, consider sideboard, credenza, or dining console as a normal dining-room role where wall/circulation space allows.",
    "For anchor roles, especially sofas, armchairs, beds, dining chairs, rugs, and major lighting, describe the required color family, material, silhouette, and distinctive features in the role visual brief.",
    "Then choose the closest available catalog candidate from that role's candidate pool.",
    "Select only product IDs that appear in the provided candidate list.",
    "For every role supplied by the app, return exactly one roleResults entry with a status. Use strong_match or acceptable_match when the selected product visibly fits. Use closest_available only when it is not contradictory. Use missing_required or missing_supporting when the role pool has no suitable product.",
    "Prioritize visual similarity to the concept image: category, silhouette, color family, material, scale, and style. For anchor furniture, color family and material are commerce-critical, not optional mood cues.",
    "Do not invent products, prices, retailer facts, dimensions, or URLs.",
    "If a blueprint role has no suitable candidate in the provided product list, put that role in missingRoles instead of inventing a product or forcing an unrelated item."
  ].join("\n")
} as const;

export const conceptProductNeedSchema = z.object({
  category: z.string().min(2).max(80),
  roleLabel: z.string().min(2).max(80),
  visualBrief: z.string().min(8).max(260),
  quantity: z.number().int().positive().max(12),
  priority: z.enum(["required", "supporting"])
});

export const conceptProductSelectionSchema = z.object({
  productId: z.uuid(),
  category: z.string().min(2).max(80),
  roleLabel: z.string().min(2).max(80),
  quantity: z.number().int().positive().max(12),
  matchStatus: z.enum(["strong_match", "acceptable_match", "closest_available"]),
  visualMatchReason: z.string().min(8).max(260),
  mismatchNote: z.string().max(220).nullable()
});

export const conceptProductRoleStatusSchema = z.enum([
  "strong_match",
  "acceptable_match",
  "closest_available",
  "missing_required",
  "missing_supporting"
]);

export const conceptProductRoleResultSchema = z.object({
  category: z.string().min(2).max(80),
  roleLabel: z.string().min(2).max(80),
  status: conceptProductRoleStatusSchema,
  productId: z.uuid().nullable(),
  reason: z.string().min(8).max(260)
});

export const conceptProductSourcingResponseSchema = z.object({
  needs: z.array(conceptProductNeedSchema).min(1).max(12),
  selectedProducts: z.array(conceptProductSelectionSchema).min(1).max(12),
  roleResults: z.array(conceptProductRoleResultSchema).min(1).max(12),
  missingRoles: z.array(z.string().min(2).max(140)).max(8)
});

export const conceptProductSourcingJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    needs: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", minLength: 2, maxLength: 80 },
          roleLabel: { type: "string", minLength: 2, maxLength: 80 },
          visualBrief: { type: "string", minLength: 8, maxLength: 260 },
          quantity: { type: "integer", minimum: 1, maximum: 12 },
          priority: { type: "string", enum: ["required", "supporting"] }
        },
        required: ["category", "roleLabel", "visualBrief", "quantity", "priority"]
      }
    },
    selectedProducts: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          productId: { type: "string", format: "uuid" },
          category: { type: "string", minLength: 2, maxLength: 80 },
          roleLabel: { type: "string", minLength: 2, maxLength: 80 },
          quantity: { type: "integer", minimum: 1, maximum: 12 },
          matchStatus: {
            type: "string",
            enum: ["strong_match", "acceptable_match", "closest_available"]
          },
          visualMatchReason: { type: "string", minLength: 8, maxLength: 260 },
          mismatchNote: {
            anyOf: [{ type: "string", maxLength: 220 }, { type: "null" }]
          }
        },
        required: [
          "productId",
          "category",
          "roleLabel",
          "quantity",
          "matchStatus",
          "visualMatchReason",
          "mismatchNote"
        ]
      }
    },
    roleResults: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", minLength: 2, maxLength: 80 },
          roleLabel: { type: "string", minLength: 2, maxLength: 80 },
          status: {
            type: "string",
            enum: [
              "strong_match",
              "acceptable_match",
              "closest_available",
              "missing_required",
              "missing_supporting"
            ]
          },
          productId: {
            anyOf: [{ type: "string", format: "uuid" }, { type: "null" }]
          },
          reason: { type: "string", minLength: 8, maxLength: 260 }
        },
        required: ["category", "roleLabel", "status", "productId", "reason"]
      }
    },
    missingRoles: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 2, maxLength: 140 }
    }
  },
  required: ["needs", "selectedProducts", "roleResults", "missingRoles"]
} as const;

export type ConceptProductNeed = z.infer<typeof conceptProductNeedSchema>;
export type ConceptProductSourcingResponse = z.infer<typeof conceptProductSourcingResponseSchema>;

export const conceptRevisionPrompt = {
  key: "concept.revision_from_critique",
  version: "2026-09-01.1",
  system: [
    "You are Ritzy Studio's concept revision assistant.",
    "A revision is a reference-preserving EDIT of the previous concept image, not a new concept.",
    "Inputs: the previous concept image, all photos of the real room, the floor plan when provided, the saved brief, and the designer critique.",
    "First derive a change plan from the critique: mustChange lists exactly what the critique asks to change; mustPreserve lists the elements of the previous concept that the critique does not touch and that must stay visually identical (palette register, key furniture, layout, lighting mood, architecture).",
    "The generation prompt must direct an image EDIT of the previous concept image: apply every mustChange item, keep every mustPreserve item, and change nothing else.",
    "Keep the room architecture stable and identify uncertainty plainly.",
    "Preserve the previous concept's palette and material register unless the critique explicitly changes it.",
    "The revised image direction must read as a photorealistic interior-design photograph, not an illustration, sketch, collage, CGI showroom, or mood board.",
    "Do not claim real product availability or exact SKU matching.",
    "Return a practical generation prompt for image editing."
  ].join("\n")
} as const;

export const productMetadataEnrichmentPrompt = {
  key: "catalog.product_metadata_enrichment",
  version: "2026-04-29.1",
  system: [
    "You are Ritzy Studio's product catalog metadata assistant.",
    "Enrich retailer product metadata only for search and matching.",
    "Never invent or alter factual product data: price, stock, URL, dimensions, retailer, SKU, color, or material.",
    "Use only the provided name, description, retailer category, retailer color, retailer material, image URL, and dimension text.",
    "If a color or material is not present or strongly implied by source text, leave the matching tag array empty.",
    "Return normalized category and tags suitable for Dubai residential interior design search.",
    "All returned tags are model-enriched derived metadata, not retailer facts."
  ].join("\n")
} as const;

export const productMetadataEnrichmentJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    normalizedCategory: {
      anyOf: [
        { type: "string", minLength: 2, maxLength: 80 },
        { type: "null" }
      ]
    },
    styleTags: {
      type: "array",
      maxItems: 10,
      items: { type: "string", minLength: 2, maxLength: 40 }
    },
    colorTags: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 2, maxLength: 40 }
    },
    materialTags: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 2, maxLength: 40 }
    },
    roomTags: {
      type: "array",
      maxItems: 8,
      items: { type: "string", minLength: 2, maxLength: 40 }
    },
    sourceConfidence: {
      type: "string",
      enum: ["verified", "assumed", "estimated", "unknown"]
    },
    warnings: {
      type: "array",
      maxItems: 6,
      items: { type: "string", minLength: 4, maxLength: 180 }
    },
    derivedBy: {
      type: "string",
      enum: ["model-enriched"]
    }
  },
  required: [
    "normalizedCategory",
    "styleTags",
    "colorTags",
    "materialTags",
    "roomTags",
    "sourceConfidence",
    "warnings",
    "derivedBy"
  ]
} as const;

export const finalGroundedRenderPrompt = {
  key: "render.final_grounded_room",
  version: "2026-05-04.1",
  system: [
    "You are Ritzy Studio's final grounded render assistant.",
    "Create a photorealistic residential interior design image from the original room photo and selected product references.",
    "The first input image is the original room and must anchor the room architecture.",
    "Additional input images are selected catalog product references.",
    "Preserve visible walls, windows, doors, ceiling details, AC vents, sockets, built-ins, and fixed fixtures where present.",
    "Use natural daylight or believable warm interior lighting, correct shadows, realistic material texture, physically plausible furniture scale, and a camera perspective consistent with the source photo.",
    "Avoid illustration, watercolor, CGI showroom smoothness, over-sharpened render artifacts, warped furniture, impossible reflections, and fantasy architecture.",
    "Use selected product images as visual references, but do not claim exact SKU reproduction.",
    "Do not add labels, price tags, retailer logos, watermarks, or shopping-list text."
  ].join("\n")
} as const;
