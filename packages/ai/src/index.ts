import { parseServerEnv } from "@ritzy-studio/config";
import type { Database } from "@ritzy-studio/db";
import {
  buildProductSearchText,
  productEnrichmentInputSchema,
  productEnrichmentResponseSchema,
  type ProductEnrichmentInput,
  type ProductEnrichmentResponse
} from "@ritzy-studio/domain";
import {
  clarifyingQuestionsJsonSchema,
  clarifyingQuestionsPrompt,
  clarifyingQuestionsResponseSchema,
  conceptProductSourcingJsonSchema,
  conceptProductSourcingPrompt,
  conceptProductSourcingResponseSchema,
  conceptRevisionPrompt,
  conceptPaletteJsonSchema,
  conceptPalettePrompt,
  conceptPaletteResponseSchema,
  conceptViewCameraLanguage,
  conceptViewConsistencyLanguage,
  type ConceptViewKey,
  finalRenderProductFidelityLanguage,
  globalPhotorealismLanguage,
  initialConceptJsonSchema,
  initialConceptPrompt,
  initialConceptResponseSchema,
  finalGroundedRenderPrompt,
  productRoleLanguage,
  roomBlueprintDefaultsLanguage,
  roomDesignLanguage,
  roomSpatialPlacementGuardrailLanguage,
  sourceRoomPreservationLanguage,
  styleDesignLanguage,
  inspirationAnalysisJsonSchema,
  inspirationAnalysisPrompt,
  inspirationAnalysisResponseSchema,
  productMetadataEnrichmentJsonSchema,
  productMetadataEnrichmentPrompt,
  type ConceptProductSourcingResponse
} from "@ritzy-studio/prompts";
import { createHash, createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import OpenAI, { toFile } from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

type ImageProvider = "gemini" | "openai" | "evolink";

type ImageGenerationReference = {
  bytes: Buffer;
  mimeType: string;
  name: string;
  // Publicly fetchable URL for the same image (signed Storage URL or retailer CDN URL).
  // Required by URL-based providers such as Evolink; byte-based providers ignore it.
  url?: string | null;
};

type ImageGenerationAttempt = {
  provider: ImageProvider;
  model: string;
  imageBase64: string;
  revisedPrompt?: string | null;
  latencySeconds: number;
  fallbackUsed: boolean;
  error?: string | null;
};

export type GenerateClarifyingQuestionsInput = {
  roomType: string;
  intendedMode?: "homeowner" | "designer" | "both" | "unknown";
  inspirationImageUrls?: string[];
  styleNotes?: string;
  colorNotes?: string;
  budgetNotes?: string;
  functionalRequirements?: string;
  avoidNotes?: string;
  inspirationNotes?: string;
  measurements?: {
    wallLengthCm?: number;
    roomDepthCm?: number;
    ceilingHeightCm?: number;
    notes?: string;
  };
};

export type GenerateClarifyingQuestionsResult = {
  promptKey: string;
  promptVersion: string;
  model: string;
  questions: Array<{
    question: string;
    reason: string;
  }>;
};

export type AnalyzeInspirationImagesInput = {
  imageUrls: string[];
};

export type AnalyzeInspirationImagesResult = {
  promptKey: string;
  promptVersion: string;
  model: string;
  analysis: {
    styleDirection: string;
    palette: string[];
    materials: string[];
    mood: string;
  };
};

export type GenerateInitialConceptInput = {
  roomType: string;
  roomPhotoUrl: string;
  // Publicly fetchable URL for URL-based image providers; roomPhotoUrl may be a data URL.
  roomPhotoReferenceUrl?: string | null;
  roomPhotoBytes: Buffer;
  roomPhotoMimeType: string;
  catalogueProducts?: Array<{
    name: string;
    retailerName: string;
    category: string | null;
    roleLabel: string;
    selectionReason: string;
    description?: string | null;
    color?: string | null;
    material?: string | null;
    styleTags?: string[];
    colorTags?: string[];
    materialTags?: string[];
    dimensions?: string | null;
    primaryImageUrl?: string | null;
    imageBytes?: Buffer | null;
    imageMimeType?: string | null;
  }>;
  inspirationImageUrls?: string[];
  styleSlugs?: string[];
  styleNotes?: string | null;
  colorNotes?: string | null;
  budgetNotes?: string | null;
  functionalRequirements?: string | null;
  avoidNotes?: string | null;
  inspirationNotes?: string | null;
  clarifyingAnswers?: Array<{
    question: string;
    answer: string;
  }>;
  measurements?: {
    wallLengthCm?: number | null;
    roomDepthCm?: number | null;
    ceilingHeightCm?: number | null;
    notes?: string | null;
  } | null;
};

export type GenerateInitialConceptResult = {
  promptKey: string;
  promptVersion: string;
  textModel: string;
  imageModel: string;
  imageProvider: ImageProvider;
  imageLatencySeconds: number;
  imageFallbackUsed: boolean;
  imageFallbackError?: string | null;
  analysis: {
    detectedRoomType: string;
    fixedArchitecture: string[];
    editableZones: string[];
    fixedElementsToPreserve: string[];
    lightingNotes: string[];
    uncertaintyNotes: string[];
  };
  concept: {
    title: string;
    rationale: string;
    generationPrompt: string;
    preserveList: string[];
    allowedChangeList: string[];
    uncertaintyNote: string;
  };
  imageBase64: string;
  revisedPrompt?: string | null;
};

export type GenerateConceptRevisionInput = GenerateInitialConceptInput & {
  previousConcept: {
    title: string;
    description?: string | null;
  };
  critique: string;
};

export type GenerateProductEnrichmentResult = {
  promptKey: string;
  promptVersion: string;
  model: string;
  sourceHash: string;
  enrichment: ProductEnrichmentResponse;
};

export type ProductEmbeddingResult = {
  model: string;
  embeddingType: "product_text";
  sourceHash: string;
  vector: number[];
  searchText: string;
};

export type EnrichAndEmbedProductResult = {
  productId: string;
  status: "created" | "skipped";
  sourceHash: string;
  enrichmentModel: string;
  embeddingModel: string;
};

export type GenerateFinalGroundedRenderInput = {
  roomType: string;
  roomPhotoBytes: Buffer;
  roomPhotoMimeType: string;
  roomPhotoUrl?: string | null;
  conceptImageBytes?: Buffer | null;
  conceptImageMimeType?: string | null;
  conceptImageUrl?: string | null;
  conceptTitle: string;
  conceptDescription?: string | null;
  products: Array<{
    name: string;
    retailerName: string;
    category: string;
    roleLabel?: string | null;
    visualMatchReason?: string | null;
    description?: string | null;
    priceAed?: number | null;
    dimensions?: string | null;
    imageBytes?: Buffer | null;
    imageMimeType?: string | null;
    imageUrl?: string | null;
  }>;
};

export type GenerateFinalGroundedRenderResult = {
  promptKey: string;
  promptVersion: string;
  imageProvider: ImageProvider;
  imageModel: string;
  imageLatencySeconds: number;
  imageFallbackUsed: boolean;
  imageFallbackError?: string | null;
  imageBase64: string;
  revisedPrompt?: string | null;
};

export type ConceptProductSourcingCandidate = {
  id: string;
  name: string;
  retailerName: string;
  category: string | null;
  description?: string | null;
  priceAed?: number | null;
  salePriceAed?: number | null;
  availability?: string | null;
  color?: string | null;
  material?: string | null;
  primaryImageUrl?: string | null;
  dimensions?: string | null;
  searchTags?: string[];
};

export type ConceptProductSourcingRolePool = {
  category: string;
  roleLabel: string;
  visualBrief: string | null;
  quantity: number;
  priority: "required" | "supporting";
  candidateIds: string[];
};

export type ProductSourcingImageDetail = "low" | "high" | "auto";

export type SourceProductsFromConceptInput = {
  roomType: string;
  conceptTitle: string;
  conceptDescription?: string | null;
  conceptImageUrl: string;
  candidates: ConceptProductSourcingCandidate[];
  roleCandidatePools?: ConceptProductSourcingRolePool[];
  conceptImageDetail?: ProductSourcingImageDetail;
  candidateImageLimit?: number;
  candidateImageDetail?: ProductSourcingImageDetail;
};

export type ProductVisualMatchStatus =
  | "strong_match"
  | "acceptable_match"
  | "closest_available"
  | "missing_required"
  | "missing_supporting";

export type SourceProductsFromConceptResult = {
  promptKey: string;
  promptVersion: string;
  model: string;
  needs: Array<{
    category: string;
    roleLabel: string;
    visualBrief: string;
    quantity: number;
    priority: "required" | "supporting";
  }>;
  selectedProducts: Array<{
    productId: string;
    category: string;
    roleLabel: string;
    quantity: number;
    matchStatus: Exclude<ProductVisualMatchStatus, "missing_required" | "missing_supporting">;
    visualMatchReason: string;
    mismatchNote: string | null;
  }>;
  roleResults: Array<{
    category: string;
    roleLabel: string;
    status: ProductVisualMatchStatus;
    productId: string | null;
    reason: string;
  }>;
  missingRoles: string[];
};

export type ValidatedConceptProductSourcingResult = Pick<
  SourceProductsFromConceptResult,
  "selectedProducts" | "roleResults" | "missingRoles"
>;

const INITIAL_CONCEPT_PROMPT_V2_VERSION = "2026-05-21.2";
const FINAL_GROUNDED_RENDER_PROMPT_V2_VERSION = "2026-05-21.2";
const ENHANCED_RITZY_IMAGE_STYLING_VERSION = "enhanced-ritzy-styling-2026-05-21.1";
const STRICT_SOURCE_ROOM_PRESERVATION_VERSION = "strict-source-room-preservation-2026-05-27.1";

function localStrictSourceRoomPreservationEnabled() {
  return process.env.RITZY_AESTHETIC_TASTE_GATE === "1";
}

function strictSourceRoomPreservationLanguage() {
  return [
    `Strict source-room preservation layer (${STRICT_SOURCE_ROOM_PRESERVATION_VERSION}):`,
    "Treat the uploaded room photo as an editable photograph, not a loose layout reference.",
    "Do not close, fill, remove, or invent wall openings, pass-throughs, room-to-room views, doorways, windows, stairs, half walls, columns, ceiling planes, soffits, or built-in architectural boundaries.",
    "If an opening or adjacent room is visible behind furniture in the source photo, keep that opening and sightline visible in the generated image.",
    "Only change movable furnishings, rugs, lighting fixtures, styling, textiles, art, and non-structural decor."
  ].join("\n");
}

function enhancedRitzyInteriorStylingLanguage({
  mode
}: {
  mode: "initial-concept" | "final-grounded-render";
}) {
  return [
    `Ritzy enhanced image styling layer (${ENHANCED_RITZY_IMAGE_STYLING_VERSION}):`,
    "Make this editorial residential photography, not a CGI showroom, furniture catalog, mood board, hotel lobby, or bare staging.",
    "Design for a high-end but livable Dubai villa or townhouse interior: polished, residential, warm, collected, and usable.",
    "Add finished interior designer styling where appropriate: wall art, mirrors, paneling, shelves, or intentionally calm negative space; avoid empty walls unless the room architecture genuinely calls for restraint.",
    "Use layered lighting where architecturally plausible: floor lamps, table lamps, sconces, picture lights, pendants, ceiling lighting, or concealed lighting that feels residential and motivated.",
    "Use correctly scaled rugs with believable placement under seating or dining zones; add curtains or window treatment where softness, privacy, or proportion calls for it.",
    "Specify sofas and seating with clear material and color behavior; show tactile upholstery, cushion compression, seams, legs, and true scale.",
    "Layer side tables, coffee table styling, books, trays, vessels, branches or greenery, cushions, throws, and styled surfaces so the room feels complete.",
    "Follow the room blueprint defaults before leaving major room roles empty; user avoid-notes and fixed source-room constraints override these defaults.",
    "Avoid generic beige luxury, IKEA catalog feel, fantasy architecture, sterile hotel lobby styling, overdecorated render fluff, visible generated text, fake labels, and watermarks.",
    "Preserve source-room architecture exactly: windows, doors, ceiling, openings, fireplace, columns, staircase, built-ins, AC, fixed services, proportions, camera perspective, and fixed architectural constraints.",
    mode === "final-grounded-render"
      ? "For product-grounded final renders, preserve selected catalog product silhouette, color family, material, scale, and distinctive features wherever possible. Add non-commerce styling layers such as art, lamps, books, flowers, cushions, throws, and decor only when they do not conflict with the selected product list."
      : "For concept generation, prioritize strong interior-design art direction while keeping the source room physically plausible and residential."
  ].join("\n");
}

export function buildInitialConceptSystemPrompt({
  roomType,
  styleSlugs = [],
  useInteriorPromptV2 = false
}: {
  roomType: string;
  styleSlugs?: string[];
  useInteriorPromptV2?: boolean;
}) {
  if (!useInteriorPromptV2) {
    return initialConceptPrompt.system;
  }

  return [
    initialConceptPrompt.system,
    "",
    "Ritzy interior design language v2:",
    sourceRoomPreservationLanguage(roomType),
    globalPhotorealismLanguage(),
    roomDesignLanguage(roomType),
    roomBlueprintDefaultsLanguage(roomType),
    styleDesignLanguage(styleSlugs)
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildInitialConceptImagePrompt({
  generationPrompt,
  roomType,
  hasInspirationImages,
  catalogueProductSummary,
  styleSlugs = [],
  useInteriorPromptV2 = false,
  strictSourceRoomPreservation = false
}: {
  generationPrompt: string;
  roomType: string;
  hasInspirationImages?: boolean;
  catalogueProductSummary?: string | null;
  styleSlugs?: string[];
  useInteriorPromptV2?: boolean;
  strictSourceRoomPreservation?: boolean;
}) {
  if (!useInteriorPromptV2) {
    return [
      generationPrompt,
      "",
      "Use the uploaded room photo as the base image.",
      hasInspirationImages
        ? "Use the uploaded inspiration images as style references for palette, materials, atmosphere, and composition. Do not reproduce them exactly."
        : null,
      "Preserve visible architecture, walls, windows, doors, ceiling details, AC vents, sockets, built-ins, and fixed bathroom fixtures where present.",
      strictSourceRoomPreservation ? strictSourceRoomPreservationLanguage() : null,
      roomBlueprintDefaultsLanguage(roomType),
      enhancedRitzyInteriorStylingLanguage({ mode: "initial-concept" }),
      catalogueProductSummary
        ? [
            "Catalogue-grounded concept references:",
            catalogueProductSummary,
            "Compose the movable furniture, rugs, lighting, art, and decor from these selected catalogue references first. Preserve their room role, silhouette or shape language, color family, material, scale, and distinctive visible features wherever possible. Do not invent alternate anchor furniture when a selected catalogue reference exists for that role."
          ].join("\n")
        : null,
      "Redesign movable furniture, lighting, textiles, accessories, and decor according to the concept direction.",
      "Output must look like a photorealistic editorial interior photograph, not an illustration, 3D showroom render, sketch, or mood board.",
      "Use physically plausible scale, natural shadows, realistic upholstery grain, wood texture, rug fibers, wall finish, and lighting falloff.",
      "Keep the source-photo camera perspective and lens feel. Do not add text labels, prices, product names, or retailer claims."
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    generationPrompt,
    "",
    "Use the uploaded room photo as the base image.",
    hasInspirationImages
      ? "Use the uploaded inspiration images as style references for palette, materials, atmosphere, and composition. Do not reproduce them exactly."
      : null,
    sourceRoomPreservationLanguage(roomType),
    strictSourceRoomPreservation ? strictSourceRoomPreservationLanguage() : null,
    roomDesignLanguage(roomType),
    roomBlueprintDefaultsLanguage(roomType),
    styleDesignLanguage(styleSlugs),
    globalPhotorealismLanguage(),
    enhancedRitzyInteriorStylingLanguage({ mode: "initial-concept" }),
    catalogueProductSummary
      ? [
          "Catalogue-grounded concept references:",
          catalogueProductSummary,
          "Compose the movable furniture, rugs, lighting, art, and decor from these selected catalogue references first. Preserve their room role, silhouette or shape language, color family, material, scale, and distinctive visible features wherever possible. Do not invent alternate anchor furniture when a selected catalogue reference exists for that role."
        ].join("\n")
      : null,
    "Redesign movable furniture, lighting, textiles, accessories, and decor according to the concept direction.",
    "Keep the source-photo camera perspective and lens feel. Do not add text labels, prices, product names, retailer claims, or fake product labels."
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildFinalGroundedRenderPrompt({
  roomType,
  conceptTitle,
  conceptDescription,
  hasConceptImage,
  productSummary,
  useFinalRenderPromptV2 = false,
  strictSourceRoomPreservation = false
}: {
  roomType: string;
  conceptTitle: string;
  conceptDescription?: string | null;
  hasConceptImage?: boolean;
  productSummary: string;
  useFinalRenderPromptV2?: boolean;
  strictSourceRoomPreservation?: boolean;
}) {
  if (!useFinalRenderPromptV2) {
    return [
      finalGroundedRenderPrompt.system,
      "",
      sourceRoomPreservationLanguage(roomType),
      roomSpatialPlacementGuardrailLanguage(roomType),
      strictSourceRoomPreservation ? strictSourceRoomPreservationLanguage() : null,
      `Selected concept: ${conceptTitle}`,
      conceptDescription ? `Concept notes: ${conceptDescription}` : null,
      hasConceptImage
        ? "The second input image is the approved concept image. Preserve its overall design intent while replacing invented items with the selected catalog products."
        : null,
      "",
      "Selected catalog products:",
      productSummary,
      "",
      "Generate a polished final client-facing photorealistic interior photograph.",
      "The final image must be product-grounded: main visible furniture and decor should correspond to the selected catalog products by room role, silhouette, color family, and material where possible.",
      enhancedRitzyInteriorStylingLanguage({ mode: "final-grounded-render" }),
      "Do not introduce alternate sofas, armchairs, coffee tables, rugs, wall art, or decor that are not represented in the selected catalog references.",
      "Use realistic camera exposure, natural shadows, true material texture, believable furniture scale, and residential lighting.",
      "Avoid illustration, generic CGI showroom smoothness, warped furniture, and impossible reflections.",
      "Keep the shopping list as the source of truth; the image is a best-effort visual composition."
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    finalGroundedRenderPrompt.system,
    "",
    "Ritzy final render language v2:",
    sourceRoomPreservationLanguage(roomType),
    strictSourceRoomPreservation ? strictSourceRoomPreservationLanguage() : null,
    roomDesignLanguage(roomType),
    globalPhotorealismLanguage(),
    finalRenderProductFidelityLanguage(),
    enhancedRitzyInteriorStylingLanguage({ mode: "final-grounded-render" }),
    "",
    `Selected concept: ${conceptTitle}`,
    conceptDescription ? `Concept notes: ${conceptDescription}` : null,
    hasConceptImage
      ? "The second input image is the approved concept image. Preserve its overall design intent, but replace invented concept items with selected catalog products where product references are provided."
      : null,
    "",
    "Selected catalog products, in current reference order:",
    productSummary,
    "",
    "Generate a polished final client-facing editorial residential interior photograph.",
    "Treat the first selected product references as highest-priority anchor items. Preserve selected product silhouettes, color families, materials, proportions, and visible distinctive features such as legs, arms, seams, tufting, handles, texture, pattern, hardware, or frame shape.",
    "Do not introduce alternate anchor furniture, rugs, lighting, art, mirrors, or decor when selected product references exist for those roles.",
    "Keep the shopping list and real product cards as the source of truth; the image remains a best-effort representative interior visualization, not a promise of exact SKU reproduction."
  ]
    .filter(Boolean)
    .join("\n");
}

async function generateImageWithConfiguredProvider({
  client,
  prompt,
  references,
  noImageErrorMessage
}: {
  client: OpenAI;
  prompt: string;
  references: ImageGenerationReference[];
  noImageErrorMessage: string;
}): Promise<ImageGenerationAttempt> {
  const env = parseServerEnv(process.env);

  if (env.RITZY_IMAGE_PROVIDER === "evolink") {
    const startedAt = Date.now();

    try {
      return await generateEvolinkImage({
        prompt,
        references,
        model: env.EVOLINK_IMAGE_MODEL,
        apiKey: env.EVOLINK_API_KEY,
        quality: env.EVOLINK_IMAGE_QUALITY
      });
    } catch (error) {
      const fallbackError = formatImageGenerationError(error);
      const fallbackAttempt = await generateOpenAiImage({
        client,
        prompt,
        references,
        model: env.OPENAI_IMAGE_MODEL,
        noImageErrorMessage
      });

      return {
        ...fallbackAttempt,
        latencySeconds: secondsSince(startedAt),
        fallbackUsed: true,
        error: fallbackError
      };
    }
  }

  if (env.RITZY_IMAGE_PROVIDER === "gemini") {
    const startedAt = Date.now();

    try {
      return await generateGeminiImage({
        prompt,
        references,
        model: env.GEMINI_IMAGE_MODEL,
        projectId: env.GOOGLE_CLOUD_PROJECT,
        location: env.GOOGLE_CLOUD_LOCATION
      });
    } catch (error) {
      const fallbackError = formatImageGenerationError(error);
      const fallbackAttempt = await generateOpenAiImage({
        client,
        prompt,
        references,
        model: env.OPENAI_IMAGE_MODEL,
        noImageErrorMessage
      });

      return {
        ...fallbackAttempt,
        latencySeconds: secondsSince(startedAt),
        fallbackUsed: true,
        error: fallbackError
      };
    }
  }

  return generateOpenAiImage({
    client,
    prompt,
    references,
    model: env.OPENAI_IMAGE_MODEL,
    noImageErrorMessage
  });
}

async function generateOpenAiImage({
  client,
  prompt,
  references,
  model,
  noImageErrorMessage
}: {
  client: OpenAI;
  prompt: string;
  references: ImageGenerationReference[];
  model: string;
  noImageErrorMessage: string;
}): Promise<ImageGenerationAttempt> {
  const startedAt = Date.now();
  const files = await Promise.all(
    references.map((reference) => {
      const mimeType = normalizeImageMimeType(reference.mimeType);
      return toFile(reference.bytes, `${reference.name}.${extensionForMime(mimeType)}`, {
        type: mimeType
      });
    })
  );
  const imageResponse = await client.images.edit({
    model,
    image: files.length === 1 ? files[0] : files,
    prompt,
    size: "1536x1024",
    quality: "high",
    ...imageFidelityParams(model),
    output_format: "png"
  });

  const firstImage = imageResponse.data?.[0];
  const imageBase64 = firstImage?.b64_json;

  if (!imageBase64) {
    throw new Error(noImageErrorMessage);
  }

  return {
    provider: "openai",
    model,
    imageBase64,
    revisedPrompt: firstImage.revised_prompt ?? null,
    latencySeconds: secondsSince(startedAt),
    fallbackUsed: false,
    error: null
  };
}

async function generateGeminiImage({
  prompt,
  references,
  model,
  projectId,
  location
}: {
  prompt: string;
  references: ImageGenerationReference[];
  model: string;
  projectId?: string;
  location: string;
}): Promise<ImageGenerationAttempt> {
  const startedAt = Date.now();
  const auth = await getVertexAuthContext();
  const resolvedProjectId = projectId || auth.projectId;

  if (!resolvedProjectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT is required for Gemini image generation.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(
    resolvedProjectId
  )}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              ...references.map((reference) => ({
                inlineData: {
                  mimeType: reference.mimeType,
                  data: reference.bytes.toString("base64")
                }
              }))
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: "16:9"
          }
        }
      }),
      signal: controller.signal
    });

    const payload = (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null;

    if (!response.ok) {
      throw new Error(geminiErrorMessage(payload) ?? `Gemini image generation failed with HTTP ${response.status}.`);
    }

    const imageBase64 = extractGeminiImageBase64(payload);

    if (!imageBase64) {
      throw new Error("Gemini image generation returned no image data.");
    }

    return {
      provider: "gemini",
      model,
      imageBase64,
      revisedPrompt: null,
      latencySeconds: secondsSince(startedAt),
      fallbackUsed: false,
      error: null
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Gemini image generation timed out after 60 seconds.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// URL-based image providers can only fetch real, publicly reachable URLs. Data
// URLs (used for vision-model inputs) and localhost storage URLs are excluded so
// the provider fails fast into its byte-based fallback instead of erroring mid-task.
function publicReferenceUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  if (url.startsWith("data:")) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return null;
    }
  } catch {
    return null;
  }

  return url;
}

const EVOLINK_API_BASE = "https://api.evolink.ai";
const EVOLINK_POLL_INTERVAL_MS = 3_000;
const EVOLINK_POLL_TIMEOUT_MS = 300_000;
const EVOLINK_MAX_REFERENCE_URLS = 14;

type EvolinkTaskResponse = {
  id?: string;
  status?: "pending" | "processing" | "completed" | "failed" | string;
  results?: string[];
  error?: { message?: string } | string | null;
  fail_reason?: string | null;
};

async function generateEvolinkImage({
  prompt,
  references,
  model,
  apiKey,
  quality
}: {
  prompt: string;
  references: ImageGenerationReference[];
  model: string;
  apiKey?: string;
  quality: "1K" | "2K" | "4K";
}): Promise<ImageGenerationAttempt> {
  if (!apiKey) {
    throw new Error("EVOLINK_API_KEY is required for Evolink image generation.");
  }

  const startedAt = Date.now();
  const referenceUrls = references
    .map((reference) => publicReferenceUrl(reference.url))
    .filter((url): url is string => Boolean(url))
    .slice(0, EVOLINK_MAX_REFERENCE_URLS);

  if (references.length > 0 && referenceUrls.length === 0) {
    throw new Error(
      "Evolink image generation requires URL-based references, but none of the provided references carried a URL."
    );
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };

  const submitResponse = await fetch(`${EVOLINK_API_BASE}/v1/images/generations`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      prompt,
      size: "16:9",
      quality,
      ...(referenceUrls.length > 0 ? { image_urls: referenceUrls } : {})
    })
  });

  const submitPayload = (await submitResponse.json().catch(() => null)) as EvolinkTaskResponse | null;

  if (!submitResponse.ok || !submitPayload?.id) {
    throw new Error(
      evolinkErrorMessage(submitPayload) ??
        `Evolink image generation submit failed with HTTP ${submitResponse.status}.`
    );
  }

  const deadline = startedAt + EVOLINK_POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, EVOLINK_POLL_INTERVAL_MS));

    const pollResponse = await fetch(`${EVOLINK_API_BASE}/v1/tasks/${encodeURIComponent(submitPayload.id)}`, {
      method: "GET",
      headers
    });
    const task = (await pollResponse.json().catch(() => null)) as EvolinkTaskResponse | null;

    if (!pollResponse.ok) {
      throw new Error(
        evolinkErrorMessage(task) ?? `Evolink task polling failed with HTTP ${pollResponse.status}.`
      );
    }

    if (task?.status === "failed") {
      throw new Error(evolinkErrorMessage(task) ?? "Evolink image generation failed.");
    }

    if (task?.status === "completed") {
      const resultUrl = task.results?.[0];

      if (!resultUrl) {
        throw new Error("Evolink image generation completed without a result image URL.");
      }

      const imageResponse = await fetch(resultUrl);

      if (!imageResponse.ok) {
        throw new Error(`Evolink result image download failed with HTTP ${imageResponse.status}.`);
      }

      const imageBase64 = Buffer.from(await imageResponse.arrayBuffer()).toString("base64");

      return {
        provider: "evolink",
        model,
        imageBase64,
        revisedPrompt: null,
        latencySeconds: secondsSince(startedAt),
        fallbackUsed: false,
        error: null
      };
    }
  }

  throw new Error(`Evolink image generation timed out after ${EVOLINK_POLL_TIMEOUT_MS / 1000} seconds.`);
}

function evolinkErrorMessage(payload: EvolinkTaskResponse | null): string | null {
  if (!payload) {
    return null;
  }

  if (typeof payload.error === "string" && payload.error) {
    return `Evolink: ${payload.error}`;
  }

  if (payload.error && typeof payload.error === "object" && payload.error.message) {
    return `Evolink: ${payload.error.message}`;
  }

  if (payload.fail_reason) {
    return `Evolink: ${payload.fail_reason}`;
  }

  return null;
}

export async function generateClarifyingQuestions(
  input: GenerateClarifyingQuestionsInput
): Promise<GenerateClarifyingQuestionsResult> {
  const env = parseServerEnv(process.env);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const { inspirationImageUrls, ...briefInput } = input;
  const modePrompt =
    input.intendedMode === "homeowner"
      ? [
          "This is a homeowner intake. Ask at most three questions.",
          "Allowed topics: primary use of the space, fixed elements to preserve, kids, pets, maintenance, or high-traffic durability.",
          "Do not ask about timeline, decision-maker, bespoke versus off-the-shelf, procurement process, or client approval workflow."
        ].join("\n")
      : [
          "This is a designer or professional intake. Ask at most five questions.",
          "You may include practical approval, timeline, bespoke versus off-the-shelf, or decision-maker questions only if they materially affect the brief."
        ].join("\n");

  const response = await client.responses.create({
    model: env.OPENAI_TEXT_MODEL,
    input: [
      {
        role: "system",
        content: `${clarifyingQuestionsPrompt.system}\n\n${modePrompt}`
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(briefInput)
          },
          ...(inspirationImageUrls ?? []).flatMap((imageUrl, index) => [
            {
              type: "input_text" as const,
              text: `User inspiration image ${index + 1}. Use this to infer style, colour, materials, and mood so you only ask questions that are still genuinely unresolved.`
            },
            {
              type: "input_image" as const,
              image_url: imageUrl,
              detail: "high" as const
            }
          ])
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ritzy_clarifying_questions",
        schema: clarifyingQuestionsJsonSchema,
        strict: true
      }
    }
  });

  const parsed = clarifyingQuestionsResponseSchema.parse(JSON.parse(response.output_text));
  const questions = input.intendedMode === "homeowner" ? parsed.questions.slice(0, 3) : parsed.questions;

  return {
    promptKey: clarifyingQuestionsPrompt.key,
    promptVersion: clarifyingQuestionsPrompt.version,
    model: env.OPENAI_TEXT_MODEL,
    questions
  };
}

export async function analyzeInspirationImages(
  input: AnalyzeInspirationImagesInput
): Promise<AnalyzeInspirationImagesResult> {
  const env = parseServerEnv(process.env);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: env.OPENAI_TEXT_MODEL,
    input: [
      {
        role: "system",
        content: inspirationAnalysisPrompt.system
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Analyze these inspiration images and return only the requested JSON."
          },
          ...input.imageUrls.flatMap((imageUrl, index) => [
            {
              type: "input_text" as const,
              text: `Inspiration image ${index + 1}.`
            },
            {
              type: "input_image" as const,
              image_url: imageUrl,
              detail: "high" as const
            }
          ])
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ritzy_inspiration_analysis",
        schema: inspirationAnalysisJsonSchema,
        strict: true
      }
    }
  });

  const analysis = inspirationAnalysisResponseSchema.parse(JSON.parse(response.output_text));

  return {
    promptKey: inspirationAnalysisPrompt.key,
    promptVersion: inspirationAnalysisPrompt.version,
    model: env.OPENAI_TEXT_MODEL,
    analysis
  };
}

export async function sourceProductsFromConcept(
  input: SourceProductsFromConceptInput
): Promise<SourceProductsFromConceptResult> {
  const env = parseServerEnv(process.env);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const candidateLimit = 36;
  const allowedProductIds = new Set(input.candidates.map((candidate) => candidate.id));
  const roleCandidatePools = input.roleCandidatePools ?? [];
  const candidateSummary = input.candidates
    .slice(0, candidateLimit)
    .map((candidate, index) =>
      [
        `${index + 1}. id: ${candidate.id}`,
        `name: ${candidate.name}`,
        `retailer: ${candidate.retailerName}`,
        `category: ${candidate.category ?? "unknown"}`,
        candidate.description ? `description: ${candidate.description}` : null,
        candidate.salePriceAed ?? candidate.priceAed
          ? `price: AED ${candidate.salePriceAed ?? candidate.priceAed}`
          : null,
        candidate.availability ? `availability: ${candidate.availability}` : null,
        candidate.color ? `color: ${candidate.color}` : null,
        candidate.material ? `material: ${candidate.material}` : null,
        candidate.dimensions ? `dimensions: ${candidate.dimensions}` : null,
        candidate.searchTags?.length ? `tags: ${candidate.searchTags.join(", ")}` : null,
        candidate.primaryImageUrl ? `image: ${candidate.primaryImageUrl}` : null
      ]
        .filter(Boolean)
        .join("; ")
    )
    .join("\n");
  const rolePoolSummary =
    roleCandidatePools.length > 0
      ? roleCandidatePools
          .map((role, index) =>
            [
              `${index + 1}. role: ${role.roleLabel}`,
              `category: ${role.category}`,
              `priority: ${role.priority}`,
              `quantity: ${role.quantity}`,
              role.visualBrief ? `visual brief: ${role.visualBrief}` : null,
              `candidate IDs: ${role.candidateIds.join(", ") || "none"}`
            ]
              .filter(Boolean)
              .join("; ")
          )
          .join("\n")
      : "No role-scoped pools supplied. Use the expected product roles and candidate list.";
  const candidateImageContent = productSourcingCandidateImageContent(input.candidates, {
    candidateLimit,
    candidateImageLimit: input.candidateImageLimit,
    detail: input.candidateImageDetail
  });

  const response = await client.responses.create({
    model: env.OPENAI_TEXT_MODEL,
    input: [
      {
        role: "system",
        content: conceptProductSourcingPrompt.system
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Room type: ${input.roomType}`,
              `Room blueprint: ${roomBlueprintDefaultsLanguage(input.roomType)}`,
              `Expected product roles: ${productRoleLanguage(input.roomType)}`,
              `Approved concept title: ${input.conceptTitle}`,
              input.conceptDescription ? `Approved concept notes: ${input.conceptDescription}` : null,
              "",
              "Role-scoped candidate pools:",
              rolePoolSummary,
              "",
              "Candidate catalog products:",
              candidateSummary
            ]
              .filter(Boolean)
              .join("\n")
          },
          {
            type: "input_image",
            image_url: input.conceptImageUrl,
            detail: input.conceptImageDetail ?? "high"
          },
          ...candidateImageContent
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ritzy_concept_product_sourcing",
        schema: conceptProductSourcingJsonSchema,
        strict: true
      }
    }
  });

  const parsed = conceptProductSourcingResponseSchema.parse(JSON.parse(response.output_text));
  const validated = validateProductSourcingRoleContract(parsed, roleCandidatePools, allowedProductIds);

  return {
    promptKey: conceptProductSourcingPrompt.key,
    promptVersion: conceptProductSourcingPrompt.version,
    model: env.OPENAI_TEXT_MODEL,
    needs: parsed.needs,
    ...validated
  };
}

export function productSourcingCandidateImageContent(
  candidates: ConceptProductSourcingCandidate[],
  {
    candidateLimit = 36,
    candidateImageLimit = candidateLimit,
    detail = "high"
  }: {
    candidateLimit?: number;
    candidateImageLimit?: number;
    detail?: ProductSourcingImageDetail;
  } = {}
) {
  const imageLimit = Math.max(0, Math.min(candidateLimit, candidateImageLimit));

  return candidates
    .slice(0, candidateLimit)
    .filter((candidate) => candidate.primaryImageUrl)
    .slice(0, imageLimit)
    .flatMap((candidate) => [
      {
        type: "input_text" as const,
        text: `Candidate product image for id ${candidate.id}: ${candidate.name}`
      },
      {
        type: "input_image" as const,
        image_url: candidate.primaryImageUrl as string,
        detail
      }
    ]);
}

export function validateProductSourcingRoleContract(
  parsed: ConceptProductSourcingResponse,
  roleCandidatePools: ConceptProductSourcingRolePool[],
  allowedProductIds = new Set(parsed.selectedProducts.map((selection) => selection.productId))
): ValidatedConceptProductSourcingResult {
  const rolePoolsByKey = new Map(
    roleCandidatePools.map((role) => [sourcingRoleKey(role.category, role.roleLabel), role])
  );
  const rolePoolsByProductId = rolePoolsForProductIds(roleCandidatePools);

  if (roleCandidatePools.length === 0) {
    return {
      selectedProducts: parsed.selectedProducts.filter((selection) => allowedProductIds.has(selection.productId)),
      roleResults: parsed.roleResults.filter(
        (result) => result.productId === null || allowedProductIds.has(result.productId)
      ),
      missingRoles: parsed.missingRoles
    };
  }

  let validRoleResults = parsed.roleResults
    .map((result) => {
      const role = canonicalRoleForResult({
        result,
        rolePoolsByKey,
        rolePoolsByProductId,
        allowedProductIds
      });
      return role ? { result, role } : null;
    })
    .filter((entry): entry is { result: (typeof parsed.roleResults)[number]; role: ConceptProductSourcingRolePool } =>
      Boolean(entry)
    )
    .map((result) => {
      const { role } = result;
      const roleResult = result.result;
      const productBelongsToRole =
        roleResult.productId !== null &&
        allowedProductIds.has(roleResult.productId) &&
        role.candidateIds.includes(roleResult.productId);

      if (roleResult.productId === null) {
        return {
          ...roleResult,
          category: role.category,
          roleLabel: role.roleLabel
        };
      }

      if (!productBelongsToRole) {
        return missingRoleResult(
          role,
          `The model returned product ${roleResult.productId} outside this role pool.`
        );
      }

      return {
        ...roleResult,
        category: role.category,
        roleLabel: role.roleLabel,
        status:
          roleResult.status === "missing_required" || roleResult.status === "missing_supporting"
            ? "closest_available"
            : roleResult.status
      };
    });

  for (const role of roleCandidatePools) {
    const key = sourcingRoleKey(role.category, role.roleLabel);
    if (validRoleResults.some((result) => sourcingRoleKey(result.category, result.roleLabel) === key)) {
      continue;
    }

    validRoleResults.push(missingRoleResult(role, "The model did not return a valid status for this role pool."));
  }

  const selectedProducts = parsed.selectedProducts
    .filter((selection) => {
      if (!allowedProductIds.has(selection.productId)) {
        return false;
      }

      const role = canonicalRoleForSelection({
        selection,
        rolePoolsByKey,
        rolePoolsByProductId,
        allowedProductIds
      });
      return Boolean(role?.candidateIds.includes(selection.productId));
    })
    .map((selection) => {
      const role = canonicalRoleForSelection({
        selection,
        rolePoolsByKey,
        rolePoolsByProductId,
        allowedProductIds
      });

      return role
        ? {
            ...selection,
            category: role.category,
            roleLabel: role.roleLabel,
            quantity: role.quantity
          }
        : selection;
    });

  validRoleResults = repairRoleResultsForSelectedProducts({
    roleResults: validRoleResults,
    selectedProducts,
    rolePoolsByKey
  });

  const satisfiedRoleKeys = new Set(
    validRoleResults
      .filter((result) => result.status !== "missing_required" && result.status !== "missing_supporting")
      .map((result) => sourcingRoleKey(result.category, result.roleLabel))
  );

  return {
    selectedProducts,
    roleResults: validRoleResults,
    missingRoles: Array.from(
      new Set([
        ...parsed.missingRoles.filter(
          (missingRole) =>
            !roleCandidatePools.some(
              (role) =>
                satisfiedRoleKeys.has(sourcingRoleKey(role.category, role.roleLabel)) &&
                missingRoleMatchesRole(missingRole, role)
            )
        ),
        ...validRoleResults
          .filter((result) => result.status === "missing_required" || result.status === "missing_supporting")
          .map((result) => `${result.category} ${result.roleLabel}`)
      ])
    )
  };
}

function repairRoleResultsForSelectedProducts({
  roleResults,
  selectedProducts,
  rolePoolsByKey
}: {
  roleResults: ValidatedConceptProductSourcingResult["roleResults"];
  selectedProducts: ValidatedConceptProductSourcingResult["selectedProducts"];
  rolePoolsByKey: Map<string, ConceptProductSourcingRolePool>;
}) {
  const roleResultsByKey = new Map(
    roleResults.map((result) => [sourcingRoleKey(result.category, result.roleLabel), result])
  );

  for (const selection of selectedProducts) {
    const roleKey = sourcingRoleKey(selection.category, selection.roleLabel);
    const role = rolePoolsByKey.get(roleKey);

    if (!role) {
      continue;
    }

    const existing = roleResultsByKey.get(roleKey);
    roleResultsByKey.set(roleKey, {
      category: role.category,
      roleLabel: role.roleLabel,
      status: selection.matchStatus,
      productId: selection.productId,
      reason:
        existing?.productId === selection.productId &&
        existing.status !== "missing_required" &&
        existing.status !== "missing_supporting"
          ? existing.reason
          : `Selected product validated for this role: ${selection.visualMatchReason}`
    });
  }

  return Array.from(roleResultsByKey.values());
}

function canonicalRoleForResult({
  result,
  rolePoolsByKey,
  rolePoolsByProductId,
  allowedProductIds
}: {
  result: ConceptProductSourcingResponse["roleResults"][number];
  rolePoolsByKey: Map<string, ConceptProductSourcingRolePool>;
  rolePoolsByProductId: Map<string, ConceptProductSourcingRolePool[]>;
  allowedProductIds: Set<string>;
}) {
  const keyedRole = rolePoolsByKey.get(sourcingRoleKey(result.category, result.roleLabel)) ?? null;

  if (result.productId === null) {
    return keyedRole;
  }

  if (!allowedProductIds.has(result.productId)) {
    return null;
  }

  const uniqueProductRole = uniqueRoleForProductId(result.productId, rolePoolsByProductId);

  if (!uniqueProductRole) {
    return null;
  }

  return keyedRole ?? uniqueProductRole;
}

function canonicalRoleForSelection({
  selection,
  rolePoolsByKey,
  rolePoolsByProductId,
  allowedProductIds
}: {
  selection: ConceptProductSourcingResponse["selectedProducts"][number];
  rolePoolsByKey: Map<string, ConceptProductSourcingRolePool>;
  rolePoolsByProductId: Map<string, ConceptProductSourcingRolePool[]>;
  allowedProductIds: Set<string>;
}) {
  const keyedRole = rolePoolsByKey.get(sourcingRoleKey(selection.category, selection.roleLabel)) ?? null;

  if (!allowedProductIds.has(selection.productId)) {
    return null;
  }

  const uniqueProductRole = uniqueRoleForProductId(selection.productId, rolePoolsByProductId);

  if (!uniqueProductRole) {
    return null;
  }

  return keyedRole ?? uniqueProductRole;
}

function rolePoolsForProductIds(roleCandidatePools: ConceptProductSourcingRolePool[]) {
  const rolePoolsByProductId = new Map<string, ConceptProductSourcingRolePool[]>();

  for (const role of roleCandidatePools) {
    for (const productId of role.candidateIds) {
      rolePoolsByProductId.set(productId, [...(rolePoolsByProductId.get(productId) ?? []), role]);
    }
  }

  return rolePoolsByProductId;
}

function uniqueRoleForProductId(
  productId: string,
  rolePoolsByProductId: Map<string, ConceptProductSourcingRolePool[]>
) {
  const roles = rolePoolsByProductId.get(productId) ?? [];
  return roles.length === 1 ? roles[0] : null;
}

function missingRoleMatchesRole(missingRole: string, role: ConceptProductSourcingRolePool) {
  const normalizedMissingRole = normalizeMissingRoleText(missingRole);
  const normalizedRole = normalizeMissingRoleText(`${role.category} ${role.roleLabel}`);
  const normalizedRoleLabel = normalizeMissingRoleText(role.roleLabel);

  return normalizedMissingRole === normalizedRole || normalizedMissingRole === normalizedRoleLabel;
}

function normalizeMissingRoleText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function missingRoleResult(role: ConceptProductSourcingRolePool, reason: string) {
  return {
    category: role.category,
    roleLabel: role.roleLabel,
    status: role.priority === "required" ? ("missing_required" as const) : ("missing_supporting" as const),
    productId: null,
    reason
  };
}

function sourcingRoleKey(category: string, roleLabel: string) {
  return `${category}::${roleLabel}`.toLowerCase().replace(/[^a-z0-9:]+/g, "_");
}

function catalogueProductSummary(
  products: NonNullable<GenerateInitialConceptInput["catalogueProducts"]>
) {
  return products
    .map((product, index) =>
      [
        `${index + 1}. ${product.roleLabel}: ${product.name}`,
        product.category ? `category: ${product.category}` : null,
        `retailer: ${product.retailerName}`,
        product.description ? `description: ${product.description}` : null,
        product.color ? `color: ${product.color}` : null,
        product.material ? `material: ${product.material}` : null,
        product.styleTags?.length ? `style: ${product.styleTags.join(", ")}` : null,
        product.colorTags?.length ? `color tags: ${product.colorTags.join(", ")}` : null,
        product.materialTags?.length ? `material tags: ${product.materialTags.join(", ")}` : null,
        product.dimensions ? `dimensions: ${product.dimensions}` : null,
        `why selected: ${product.selectionReason}`
      ]
        .filter(Boolean)
        .join("; ")
    )
    .join("\n");
}

function catalogueProductDirectionContent(
  products: NonNullable<GenerateInitialConceptInput["catalogueProducts"]>
) {
  const summary = catalogueProductSummary(products);

  if (!summary) {
    return [];
  }

  return [
    {
      type: "input_text" as const,
      text: [
        "Selected catalogue products for this concept. Use these as the source of truth for movable anchor pieces before writing the image-generation direction.",
        summary
      ].join("\n")
    },
    ...products
      .filter((product) => product.primaryImageUrl)
      .flatMap((product, index) => [
        {
          type: "input_text" as const,
          text: `Catalogue product reference ${index + 1} for role ${product.roleLabel}: ${product.name}`
        },
        {
          type: "input_image" as const,
          image_url: product.primaryImageUrl as string,
          detail: "low" as const
        }
      ])
  ];
}

export async function generateInitialConcept(
  input: GenerateInitialConceptInput
): Promise<GenerateInitialConceptResult> {
  const env = parseServerEnv(process.env);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const useInteriorPromptV2 = env.RITZY_INTERIOR_PROMPT_V2_ENABLED;

  const brief = {
    roomType: input.roomType,
    ...(useInteriorPromptV2 && input.styleSlugs?.length ? { styleSlugs: input.styleSlugs } : {}),
    styleNotes: input.styleNotes,
    colorNotes: input.colorNotes,
    budgetNotes: input.budgetNotes,
    functionalRequirements: input.functionalRequirements,
    avoidNotes: input.avoidNotes,
    inspirationNotes: input.inspirationNotes,
    clarifyingAnswers: input.clarifyingAnswers ?? [],
    measurements: input.measurements
  };

  const directionResponse = await client.responses.create({
    model: env.OPENAI_TEXT_MODEL,
    input: [
      {
        role: "system",
        content: buildInitialConceptSystemPrompt({
          roomType: input.roomType,
          styleSlugs: input.styleSlugs,
          useInteriorPromptV2
        })
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(brief)
          },
          {
            type: "input_image",
            image_url: input.roomPhotoUrl,
            detail: "high"
          },
          ...catalogueProductDirectionContent(input.catalogueProducts ?? []),
          ...(input.inspirationImageUrls ?? []).flatMap((imageUrl, index) => [
            {
              type: "input_text" as const,
              text: `User inspiration image ${index + 1}. Extract colour, material, mood, composition, and style cues only. Do not copy private artwork or exact furniture unless the user explicitly requested that in the brief.`
            },
            {
              type: "input_image" as const,
              image_url: imageUrl,
              detail: "high" as const
            }
          ])
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ritzy_initial_concept",
        schema: initialConceptJsonSchema,
        strict: true
      }
    }
  });

  const direction = initialConceptResponseSchema.parse(JSON.parse(directionResponse.output_text));
  const imagePrompt = buildInitialConceptImagePrompt({
    generationPrompt: direction.concept.generationPrompt,
    roomType: input.roomType,
    hasInspirationImages: Boolean(input.inspirationImageUrls?.length),
    catalogueProductSummary: input.catalogueProducts?.length
      ? catalogueProductSummary(input.catalogueProducts)
      : null,
    styleSlugs: input.styleSlugs,
    useInteriorPromptV2,
    strictSourceRoomPreservation: localStrictSourceRoomPreservationEnabled()
  });
  const catalogueReferences = (input.catalogueProducts ?? [])
    .filter((product) => product.imageBytes && product.imageMimeType)
    .slice(0, 8)
    .map((product, index) => ({
      bytes: product.imageBytes as Buffer,
      mimeType: product.imageMimeType as string,
      name: `catalogue-product-${index}`,
      url: product.primaryImageUrl ?? null
    }));

  const imageResult = await generateImageWithConfiguredProvider({
    client,
    prompt: imagePrompt,
    references: [
      {
        bytes: input.roomPhotoBytes,
        mimeType: input.roomPhotoMimeType,
        name: "room",
        url: publicReferenceUrl(input.roomPhotoReferenceUrl ?? input.roomPhotoUrl)
      },
      ...catalogueReferences
    ],
    noImageErrorMessage: "OpenAI image generation returned no image data."
  });

  return {
    promptKey: initialConceptPrompt.key,
    promptVersion: useInteriorPromptV2
      ? INITIAL_CONCEPT_PROMPT_V2_VERSION
      : `${initialConceptPrompt.version}+${ENHANCED_RITZY_IMAGE_STYLING_VERSION}`,
    textModel: env.OPENAI_TEXT_MODEL,
    imageProvider: imageResult.provider,
    imageModel: imageResult.model,
    imageLatencySeconds: imageResult.latencySeconds,
    imageFallbackUsed: imageResult.fallbackUsed,
    imageFallbackError: imageResult.error ?? null,
    analysis: direction.roomAnalysis,
    concept: direction.concept,
    imageBase64: imageResult.imageBase64,
    revisedPrompt: imageResult.revisedPrompt ?? null
  };
}

export type { ConceptViewKey };

export type GenerateConceptViewInput = {
  roomType: string;
  viewKey: ConceptViewKey;
  conceptTitle: string;
  conceptDescription?: string | null;
  conceptGenerationPrompt?: string | null;
  heroImageBytes: Buffer;
  heroImageMimeType: string;
  heroImageUrl?: string | null;
};

export type GenerateConceptViewResult = {
  viewKey: ConceptViewKey;
  promptVersion: string;
  imageProvider: ImageProvider;
  imageModel: string;
  imageLatencySeconds: number;
  imageFallbackUsed: boolean;
  imageFallbackError?: string | null;
  imageBase64: string;
};

export const CONCEPT_VIEW_PROMPT_VERSION = "concept-view.2026-07-10.1";

export function buildConceptViewPrompt(input: {
  roomType: string;
  viewKey: ConceptViewKey;
  conceptTitle: string;
  conceptDescription?: string | null;
  conceptGenerationPrompt?: string | null;
}) {
  return [
    conceptViewConsistencyLanguage(),
    "",
    conceptViewCameraLanguage(input.roomType, input.viewKey),
    "",
    `Approved concept: ${input.conceptTitle}`,
    input.conceptDescription ? `Concept notes: ${input.conceptDescription}` : null,
    input.conceptGenerationPrompt
      ? `The room was designed to this brief; use it only to keep the design identical, never to redesign: ${input.conceptGenerationPrompt}`
      : null,
    "",
    globalPhotorealismLanguage(),
    "Do not add text labels, prices, product names, or retailer claims."
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export async function generateConceptView(
  input: GenerateConceptViewInput
): Promise<GenerateConceptViewResult> {
  const env = parseServerEnv(process.env);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const prompt = buildConceptViewPrompt(input);

  const imageResult = await generateImageWithConfiguredProvider({
    client,
    prompt,
    references: [
      {
        bytes: input.heroImageBytes,
        mimeType: input.heroImageMimeType,
        name: "approved-concept",
        url: input.heroImageUrl ?? null
      }
    ],
    noImageErrorMessage: "Concept view generation returned no image data."
  });

  return {
    viewKey: input.viewKey,
    promptVersion: CONCEPT_VIEW_PROMPT_VERSION,
    imageProvider: imageResult.provider,
    imageModel: imageResult.model,
    imageLatencySeconds: imageResult.latencySeconds,
    imageFallbackUsed: imageResult.fallbackUsed,
    imageFallbackError: imageResult.error ?? null,
    imageBase64: imageResult.imageBase64
  };
}

export type ExtractConceptImagePaletteInput = {
  // Data URL or fetchable URL of the generated concept image.
  imageUrl: string;
};

export type ExtractConceptImagePaletteResult = {
  promptKey: string;
  promptVersion: string;
  model: string;
  palette: {
    dominantColors: string[];
    accentColors: string[];
    dominantMaterials: string[];
    avoidColors: string[];
  };
};

export async function extractConceptImagePalette(
  input: ExtractConceptImagePaletteInput
): Promise<ExtractConceptImagePaletteResult> {
  const env = parseServerEnv(process.env);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: env.OPENAI_TEXT_MODEL,
    input: [
      {
        role: "system",
        content: conceptPalettePrompt.system
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Extract the rendered palette of this interior design concept image."
          },
          {
            type: "input_image",
            image_url: input.imageUrl,
            detail: "low"
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ritzy_concept_palette",
        schema: conceptPaletteJsonSchema,
        strict: true
      }
    }
  });

  const palette = conceptPaletteResponseSchema.parse(JSON.parse(response.output_text));

  return {
    promptKey: conceptPalettePrompt.key,
    promptVersion: conceptPalettePrompt.version,
    model: env.OPENAI_TEXT_MODEL,
    palette
  };
}

export async function generateConceptRevision(
  input: GenerateConceptRevisionInput
): Promise<GenerateInitialConceptResult> {
  const env = parseServerEnv(process.env);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const revisionInput = {
    roomType: input.roomType,
    previousConcept: input.previousConcept,
    designerCritique: input.critique,
    brief: {
      styleNotes: input.styleNotes,
      colorNotes: input.colorNotes,
      budgetNotes: input.budgetNotes,
      functionalRequirements: input.functionalRequirements,
      avoidNotes: input.avoidNotes,
      inspirationNotes: input.inspirationNotes,
      clarifyingAnswers: input.clarifyingAnswers ?? [],
      measurements: input.measurements
    }
  };

  const directionResponse = await client.responses.create({
    model: env.OPENAI_TEXT_MODEL,
    input: [
      {
        role: "system",
        content: conceptRevisionPrompt.system
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(revisionInput)
          },
          {
            type: "input_image",
            image_url: input.roomPhotoUrl,
            detail: "high"
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ritzy_concept_revision",
        schema: initialConceptJsonSchema,
        strict: true
      }
    }
  });

  const direction = initialConceptResponseSchema.parse(JSON.parse(directionResponse.output_text));
  const imagePrompt = [
    direction.concept.generationPrompt,
    "",
    "Use the uploaded original room photo as the base image.",
    "Apply the designer critique while preserving approved qualities from the previous concept.",
    "Preserve visible architecture, walls, windows, doors, ceiling details, AC vents, sockets, built-ins, and fixed bathroom fixtures where present.",
    "Output must look like a photorealistic editorial interior photograph, not an illustration, 3D showroom render, sketch, or mood board.",
    "Use physically plausible scale, natural shadows, realistic upholstery grain, wood texture, rug fibers, wall finish, and lighting falloff.",
    "Keep the source-photo camera perspective and lens feel. Do not add text labels, prices, product names, or retailer claims."
  ].join("\n");

  const imageResult = await generateImageWithConfiguredProvider({
    client,
    prompt: imagePrompt,
    references: [
      {
        bytes: input.roomPhotoBytes,
        mimeType: input.roomPhotoMimeType,
        name: "room",
        url: publicReferenceUrl(input.roomPhotoReferenceUrl ?? input.roomPhotoUrl)
      }
    ],
    noImageErrorMessage: "OpenAI image revision returned no image data."
  });

  return {
    promptKey: conceptRevisionPrompt.key,
    promptVersion: conceptRevisionPrompt.version,
    textModel: env.OPENAI_TEXT_MODEL,
    imageProvider: imageResult.provider,
    imageModel: imageResult.model,
    imageLatencySeconds: imageResult.latencySeconds,
    imageFallbackUsed: imageResult.fallbackUsed,
    imageFallbackError: imageResult.error ?? null,
    analysis: direction.roomAnalysis,
    concept: direction.concept,
    imageBase64: imageResult.imageBase64,
    revisedPrompt: imageResult.revisedPrompt ?? null
  };
}

function extensionForMime(mimeType: string) {
  const normalizedMimeType = normalizeImageMimeType(mimeType);
  if (normalizedMimeType === "image/png") {
    return "png";
  }

  if (normalizedMimeType === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function normalizeImageMimeType(mimeType: string) {
  return mimeType.toLowerCase() === "image/jpg" ? "image/jpeg" : mimeType;
}

export async function generateProductEnrichment(
  input: ProductEnrichmentInput
): Promise<GenerateProductEnrichmentResult> {
  const env = parseServerEnv(process.env);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const parsedInput = productEnrichmentInputSchema.parse(input);
  const sourceHash = createProductEnrichmentSourceHash(parsedInput);

  const response = await client.responses.create({
    model: env.OPENAI_TEXT_MODEL,
    input: [
      {
        role: "system",
        content: productMetadataEnrichmentPrompt.system
      },
      {
        role: "user",
        content: JSON.stringify(parsedInput)
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ritzy_product_metadata_enrichment",
        schema: productMetadataEnrichmentJsonSchema,
        strict: true
      }
    }
  });

  return {
    promptKey: productMetadataEnrichmentPrompt.key,
    promptVersion: productMetadataEnrichmentPrompt.version,
    model: env.OPENAI_TEXT_MODEL,
    sourceHash,
    enrichment: productEnrichmentResponseSchema.parse(JSON.parse(response.output_text))
  };
}

export async function generateProductTextEmbedding(
  input: ProductEnrichmentInput,
  enrichment: ProductEnrichmentResponse
): Promise<ProductEmbeddingResult> {
  const env = parseServerEnv(process.env);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const parsedInput = productEnrichmentInputSchema.parse(input);
  const parsedEnrichment = productEnrichmentResponseSchema.parse(enrichment);
  const sourceHash = createProductEnrichmentSourceHash(parsedInput);
  const searchText = buildProductSearchText(parsedInput, parsedEnrichment);

  const response = await client.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input: searchText
  });
  const vector = response.data[0]?.embedding;

  if (!vector?.length) {
    throw new Error("OpenAI embedding generation returned no vector.");
  }

  return {
    model: env.OPENAI_EMBEDDING_MODEL,
    embeddingType: "product_text",
    sourceHash,
    vector,
    searchText
  };
}

export async function enrichAndEmbedProduct({
  supabase,
  productId,
  force = false
}: {
  supabase: SupabaseClient<Database>;
  productId: string;
  force?: boolean;
}): Promise<EnrichAndEmbedProductResult> {
  const env = parseServerEnv(process.env);
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  if (productError) {
    throw new Error(productError.message);
  }

  const [
    { data: retailer, error: retailerError },
    { data: dimensions, error: dimensionsError }
  ] = await Promise.all([
    supabase.from("retailers").select("name").eq("id", product.retailer_id).maybeSingle(),
    supabase.from("product_dimensions").select("*").eq("product_id", product.id).maybeSingle()
  ]);

  if (retailerError) {
    throw new Error(retailerError.message);
  }

  if (dimensionsError) {
    throw new Error(dimensionsError.message);
  }

  const input = productRowToEnrichmentInput(product, retailer?.name ?? null, dimensions ?? null);
  const sourceHash = createProductEnrichmentSourceHash(input);

  if (!force && product.enrichment_source_hash === sourceHash) {
    const { data: existingEmbedding } = await supabase
      .from("product_embeddings")
      .select("id")
      .eq("product_id", product.id)
      .eq("embedding_type", "product_text")
      .eq("model", env.OPENAI_EMBEDDING_MODEL)
      .eq("source_hash", sourceHash)
      .maybeSingle();

    if (existingEmbedding) {
      return {
        productId: product.id,
        status: "skipped",
        sourceHash,
        enrichmentModel: product.enrichment_model ?? env.OPENAI_TEXT_MODEL,
        embeddingModel: env.OPENAI_EMBEDDING_MODEL
      };
    }
  }

  const enrichmentResult = await generateProductEnrichment(input);
  const embedding = await generateProductTextEmbedding(input, enrichmentResult.enrichment);

  const { error: updateError } = await supabase
    .from("products")
    .update({
      category_normalized: enrichmentResult.enrichment.normalizedCategory ?? product.category_normalized,
      style_tags: enrichmentResult.enrichment.styleTags,
      color_tags: enrichmentResult.enrichment.colorTags,
      material_tags: enrichmentResult.enrichment.materialTags,
      room_tags: enrichmentResult.enrichment.roomTags,
      enrichment_source_hash: sourceHash,
      enrichment_model: enrichmentResult.model,
      enriched_at: new Date().toISOString()
    })
    .eq("id", product.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: embeddingError } = await supabase.from("product_embeddings").upsert(
    {
      product_id: product.id,
      embedding_type: embedding.embeddingType,
      model: embedding.model,
      vector: formatPgVector(embedding.vector),
      source_hash: sourceHash
    },
    { onConflict: "product_id,embedding_type,model,source_hash" }
  );

  if (embeddingError) {
    throw new Error(embeddingError.message);
  }

  return {
    productId: product.id,
    status: "created",
    sourceHash,
    enrichmentModel: enrichmentResult.model,
    embeddingModel: embedding.model
  };
}

export async function generateFinalGroundedRender(
  input: GenerateFinalGroundedRenderInput
): Promise<GenerateFinalGroundedRenderResult> {
  const env = parseServerEnv(process.env);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const useFinalRenderPromptV2 = env.RITZY_FINAL_RENDER_PROMPT_V2_ENABLED;
  const hasConceptImage = Boolean(input.conceptImageBytes && input.conceptImageMimeType);
  const maxProductReferences =
    process.env.RITZY_AESTHETIC_TASTE_GATE === "1" && process.env.NODE_ENV !== "production" ? 12 : 8;
  const productReferences = input.products
    .filter((product) => product.imageBytes && product.imageMimeType)
    .slice(0, maxProductReferences)
    .map((product, index) => ({
      bytes: product.imageBytes as Buffer,
      mimeType: product.imageMimeType as string,
      name: `product-${index}`,
      url: product.imageUrl ?? null
    }));
  const productSummary = input.products
    .map((product, index) =>
      [
        `${index + 1}. ${product.category}: ${product.name}`,
        product.roleLabel ? `room role: ${product.roleLabel}` : null,
        `retailer: ${product.retailerName}`,
        product.description ? `description: ${product.description}` : null,
        product.priceAed ? `price: AED ${product.priceAed}` : null,
        product.dimensions ? `dimensions: ${product.dimensions}` : null,
        product.visualMatchReason ? `why selected: ${product.visualMatchReason}` : null
      ]
        .filter(Boolean)
        .join("; ")
    )
    .join("\n");
  const prompt = buildFinalGroundedRenderPrompt({
    roomType: input.roomType,
    conceptTitle: input.conceptTitle,
    conceptDescription: input.conceptDescription,
    hasConceptImage,
    productSummary,
    useFinalRenderPromptV2,
    strictSourceRoomPreservation: localStrictSourceRoomPreservationEnabled()
  });

  const imageResult = await generateImageWithConfiguredProvider({
    client,
    prompt,
    references: [
      {
        bytes: input.roomPhotoBytes,
        mimeType: input.roomPhotoMimeType,
        name: "room",
        url: input.roomPhotoUrl ?? null
      },
      ...(input.conceptImageBytes && input.conceptImageMimeType
        ? [
            {
              bytes: input.conceptImageBytes,
              mimeType: input.conceptImageMimeType,
              name: "concept",
              url: input.conceptImageUrl ?? null
            }
          ]
        : []),
      ...productReferences
    ],
    noImageErrorMessage: "OpenAI final render generation returned no image data."
  });

  return {
    promptKey: finalGroundedRenderPrompt.key,
    promptVersion: useFinalRenderPromptV2
      ? FINAL_GROUNDED_RENDER_PROMPT_V2_VERSION
      : `${finalGroundedRenderPrompt.version}+${ENHANCED_RITZY_IMAGE_STYLING_VERSION}`,
    imageProvider: imageResult.provider,
    imageModel: imageResult.model,
    imageLatencySeconds: imageResult.latencySeconds,
    imageFallbackUsed: imageResult.fallbackUsed,
    imageFallbackError: imageResult.error ?? null,
    imageBase64: imageResult.imageBase64,
    revisedPrompt: imageResult.revisedPrompt ?? null
  };
}

export function createProductEnrichmentSourceHash(input: ProductEnrichmentInput) {
  const parsed = productEnrichmentInputSchema.parse(input);
  return createHash("sha256").update(stableStringify(productEnrichmentSourcePayload(parsed))).digest("hex");
}

export function formatPgVector(vector: number[]) {
  return `[${vector.join(",")}]`;
}

function productRowToEnrichmentInput(
  product: Database["public"]["Tables"]["products"]["Row"],
  retailerName: string | null,
  dimensions: Database["public"]["Tables"]["product_dimensions"]["Row"] | null
): ProductEnrichmentInput {
  return {
    productId: product.id,
    retailerName,
    name: product.name,
    description: product.description,
    categoryRaw: product.category_raw,
    categoryNormalized: product.category_normalized,
    color: product.color,
    material: product.material,
    priceAed: product.price_aed,
    salePriceAed: product.sale_price_aed,
    availability: product.availability,
    primaryImageUrl: product.primary_image_url,
    dimensions: dimensions
      ? {
          widthCm: dimensions.width_cm,
          depthCm: dimensions.depth_cm,
          heightCm: dimensions.height_cm,
          diameterCm: dimensions.diameter_cm,
          sourceText: dimensions.source_text
        }
      : null
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function productEnrichmentSourcePayload(input: ProductEnrichmentInput) {
  return {
    productId: input.productId ?? null,
    retailerName: input.retailerName ?? null,
    name: input.name,
    description: input.description ?? null,
    categoryRaw: input.categoryRaw ?? null,
    categoryNormalized: input.categoryNormalized ?? null,
    color: input.color ?? null,
    material: input.material ?? null,
    primaryImageUrl: input.primaryImageUrl ?? null,
    dimensions: input.dimensions ?? null
  };
}

function imageFidelityParams(model: string) {
  return model.includes("gpt-image-2") ? {} : { input_fidelity: "high" as const };
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
        inline_data?: {
          mime_type?: string;
          data?: string;
        };
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    message?: string;
    status?: string;
  };
};

type VertexServiceAccountCredentials = {
  type?: string;
  project_id?: string;
  private_key?: string;
  client_email?: string;
  token_uri?: string;
};

let cachedVertexToken:
  | {
      accessToken: string;
      expiresAtMs: number;
      projectId: string | null;
      credentialsSource: string | null;
    }
  | null = null;

async function getVertexAuthContext() {
  const directToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN ?? process.env.VERTEX_ACCESS_TOKEN;

  if (directToken) {
    return {
      accessToken: directToken,
      projectId: process.env.GOOGLE_CLOUD_PROJECT ?? null
    };
  }

  const credentialsJsonBase64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credentialsSource = credentialsJsonBase64 ? "env:GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64" : credentialsPath;

  if (!credentialsSource) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64, GOOGLE_APPLICATION_CREDENTIALS, or VERTEX_ACCESS_TOKEN is required for Gemini image generation."
    );
  }

  if (
    cachedVertexToken?.credentialsSource === credentialsSource &&
    cachedVertexToken.expiresAtMs > Date.now() + 60_000
  ) {
    return {
      accessToken: cachedVertexToken.accessToken,
      projectId: cachedVertexToken.projectId
    };
  }

  const credentials = credentialsJsonBase64
    ? (JSON.parse(Buffer.from(credentialsJsonBase64, "base64").toString("utf8")) as VertexServiceAccountCredentials)
    : (JSON.parse(await readFile(credentialsPath as string, "utf8")) as VertexServiceAccountCredentials);

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Google service account JSON must include client_email and private_key.");
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt({
    header: {
      alg: "RS256",
      typ: "JWT"
    },
    payload: {
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: credentials.token_uri ?? "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    },
    privateKey: credentials.private_key
  });
  const tokenResponse = await fetch(credentials.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const tokenPayload = (await tokenResponse.json().catch(() => null)) as
    | {
        access_token?: string;
        expires_in?: number;
        error_description?: string;
        error?: string;
      }
    | null;

  if (!tokenResponse.ok || !tokenPayload?.access_token) {
    throw new Error(tokenPayload?.error_description ?? tokenPayload?.error ?? "Could not fetch Google access token.");
  }

  cachedVertexToken = {
    accessToken: tokenPayload.access_token,
    expiresAtMs: Date.now() + (tokenPayload.expires_in ?? 3600) * 1000,
    projectId: credentials.project_id ?? null,
    credentialsSource
  };

  return {
    accessToken: cachedVertexToken.accessToken,
    projectId: cachedVertexToken.projectId
  };
}

function signJwt({
  header,
  payload,
  privateKey
}: {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  privateKey: string;
}) {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKey);

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function extractGeminiImageBase64(payload: GeminiGenerateContentResponse | null) {
  for (const candidate of payload?.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const imageData = part.inlineData?.data ?? part.inline_data?.data;

      if (imageData) {
        return imageData;
      }
    }
  }

  return null;
}

function geminiErrorMessage(payload: GeminiGenerateContentResponse | null) {
  return payload?.error?.message ?? payload?.error?.status ?? null;
}

function formatImageGenerationError(error: unknown) {
  return error instanceof Error ? error.message : "Image generation failed.";
}

function secondsSince(startedAt: number) {
  return Number(((Date.now() - startedAt) / 1000).toFixed(2));
}
