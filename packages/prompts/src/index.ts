import { z } from "zod";

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

export const initialConceptPrompt = {
  key: "concept.initial_room_analysis",
  version: "2026-04-29.1",
  system: [
    "You are Ritzy Studio's senior interior concept architect.",
    "Analyze the uploaded residential room photo and the saved designer brief.",
    "Identify visible fixed architecture and uncertainty plainly.",
    "Create one initial concept direction suitable for image editing.",
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

export const conceptRevisionPrompt = {
  key: "concept.revision_from_critique",
  version: "2026-04-29.1",
  system: [
    "You are Ritzy Studio's concept revision assistant.",
    "Use the original room photo, previous concept, and designer critique to create one revised concept direction.",
    "Preserve approved qualities from the previous concept unless the critique explicitly changes them.",
    "Keep the room architecture stable and identify uncertainty plainly.",
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
