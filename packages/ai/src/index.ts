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
  designSpecSourcingLanguage,
  specProductSourcingPrompt,
  type DesignSpecSourcingRoleLanguageInput,
  conceptProductSourcingResponseSchema,
  conceptRevisionJsonSchema,
  conceptRevisionPrompt,
  conceptRevisionResponseSchema,
  revisionVisualDiffJsonSchema,
  revisionVisualDiffPrompt,
  revisionVisualDiffResponseSchema,
  specExtractionJsonSchema,
  specExtractionPrompt,
  specExtractionResponseSchema,
  type SpecExtractionResponse,
  conceptPaletteJsonSchema,
  conceptPalettePrompt,
  conceptPaletteResponseSchema,
  renderSpatialQaJsonSchema,
  renderSpatialQaPrompt,
  renderSpatialQaResponseSchema,
  type RenderSpatialQaResponse,
  conceptViewCameraLanguage,
  conceptViewConsistencyLanguage,
  type ConceptViewKey,
  finalRenderProductFidelityLanguage,
  finalRenderViewConsistencyLanguage,
  globalPhotorealismLanguage,
  initialConceptJsonSchema,
  initialConceptPrompt,
  initialConceptResponseSchema,
  finalGroundedRenderPrompt,
  roomBlueprintDefaultsLanguage,
  roomDesignLanguage,
  roomSpatialPlacementGuardrailLanguage,
  sourceRoomPreservationLanguage,
  spatialLayoutLanguage,
  type SpatialPromptIntent,
  styleDesignLanguage,
  inspirationAnalysisJsonSchema,
  inspirationAnalysisPrompt,
  inspirationAnalysisResponseSchema,
  productMetadataEnrichmentJsonSchema,
  productMetadataEnrichmentPrompt,
  type ConceptProductSourcingResponse,
  paletteRegisterLanguage
} from "@ritzy-studio/prompts";
import { createHash, createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";

import {
  buildReferenceHostAllowlist,
  checkReferenceImageUrl,
  followGuardedRedirects,
  guardReferenceUrl,
  preflightReferenceImage,
  readResponseBytesCapped
} from "./reference-guard";

export {
  buildReferenceHostAllowlist,
  checkReferenceImageUrl,
  followGuardedRedirects,
  guardReferenceUrl,
  preflightReferenceImage,
  readResponseBytesCapped,
  sanitizeReferenceImageUrl
} from "./reference-guard";

import { estimateTextCostUsd } from "./text-cost";
import { resolveStageTextEffort, resolveStageTextModel, type TextStage } from "./model-routing";

// One composed lookup per stage: the model for calls AND job labels, plus the request
// params to spread into responses.create. A single stage string per call site keeps
// job-row attribution and the actual call in lockstep.
export function stageTextConfig(
  stage: TextStage,
  baseModel?: string,
  env: Record<string, string | undefined> = process.env
): { model: string; requestParams: { model: string; reasoning?: { effort: "minimal" | "low" | "medium" | "high" } } } {
  const resolvedBase = baseModel ?? serverEnvTextModel();
  const model = resolveStageTextModel(stage, env, resolvedBase);
  const effort = resolveStageTextEffort(stage, env);
  return { model, requestParams: { model, ...(effort ? { reasoning: { effort } } : {}) } };
}

function serverEnvTextModel(): string {
  return parseServerEnv(process.env).OPENAI_TEXT_MODEL;
}

export { estimateTextCostUsd, sumImagePlusTextUsd, sumUsdCosts, sumUsdCostsStrict } from "./text-cost";
export { resolveStageTextEffort, resolveStageTextModel, TEXT_STAGES } from "./model-routing";
export type { TextStage, TextEffort } from "./model-routing";
import type { SupabaseClient } from "@supabase/supabase-js";

type ImageProvider = "gemini" | "openai" | "evolink";

type ImageGenerationReference = {
  bytes: Buffer;
  mimeType: string;
  name: string;
  // Publicly fetchable URL for the same image (signed Storage URL or retailer CDN URL).
  // Required by URL-based providers such as Evolink; byte-based providers ignore it.
  url?: string | null;
  // A reference the render is meaningless without (the room photo, the approved
  // concept). URL-based providers must fail over to a byte-based provider rather
  // than generate without it.
  required?: boolean;
};

type ImageGenerationAttempt = {
  provider: ImageProvider;
  model: string;
  imageBase64: string;
  revisedPrompt?: string | null;
  latencySeconds: number;
  fallbackUsed: boolean;
  error?: string | null;
  // Gateway credits consumed by this generation (Evolink only; null for other providers).
  creditsUsed?: number | null;
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
  textCostUsd?: number | null;
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
  textCostUsd?: number | null;
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
  // Additional photos of the SAME room from other corners. They give the model
  // real spatial coverage instead of hallucinating occluded walls from one frame.
  additionalRoomPhotos?: Array<{
    url: string;
    referenceUrl?: string | null;
    bytes: Buffer;
    mimeType: string;
  }>;
  inspirationImageUrls?: string[];
  // Data URL of the uploaded floor plan image, when one exists. Read by the
  // direction model for layout reasoning; never used as a render reference.
  floorPlanImageUrl?: string | null;
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
  spatialIntent?: SpatialPromptIntent | null;
  measurements?: {
    wallLengthCm?: number | null;
    roomDepthCm?: number | null;
    ceilingHeightCm?: number | null;
    notes?: string | null;
  } | null;
};

export type GenerateInitialConceptResult = {
  promptKey: string;
  textCostUsd?: number | null;
  promptVersion: string;
  textModel: string;
  imageModel: string;
  imageProvider: ImageProvider;
  imageLatencySeconds: number;
  imageFallbackUsed: boolean;
  imageFallbackError?: string | null;
  imageCreditsUsed: number | null;
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
  // The image being edited: the previous concept render. The revision is a
  // reference-preserving edit of THIS image, with the room photos as
  // architecture ground truth.
  previousConceptImage: {
    bytes: Buffer;
    mimeType: string;
    url?: string | null;
  };
  critique: string;
};

export type GenerateConceptRevisionResult = GenerateInitialConceptResult & {
  changePlan: {
    mustChange: string[];
    mustPreserve: string[];
  };
};

export type RevisionVisualDiffResult = {
  changeApplied: "yes" | "partial" | "no";
  unintendedChanges: string[];
  summary: string;
  textCostUsd?: number | null;
  model: string;
};

export type GenerateProductEnrichmentResult = {
  promptKey: string;
  textCostUsd?: number | null;
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
  spatialIntent?: SpatialPromptIntent | null;
  // Extra corrective instructions (e.g. from spatial QA) appended to the prompt.
  promptSuffix?: string | null;
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
  textCostUsd?: number | null;
  promptVersion: string;
  imageProvider: ImageProvider;
  imageModel: string;
  imageLatencySeconds: number;
  imageFallbackUsed: boolean;
  imageFallbackError?: string | null;
  imageCreditsUsed: number | null;
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
  candidateImageDetail?: ProductSourcingImageDetail;
  candidateImageDataUrls?: Record<string, string>;
  // S3: the design spec drives the roles (the confirmed spec, or the
  // room-blueprint roles carried through the same contract when no spec could
  // be read). Every supplied candidate is listed (the pools are role-scoped
  // and contract-clean), and the ONLY candidate images shown are the
  // app-fetched data URLs in candidateImageDataUrls: the provider never
  // downloads from retailer hosts.
  designSpec: {
    roles: DesignSpecSourcingRoleLanguageInput[];
    mustPreserve?: readonly string[];
  };
};

export type ProductVisualMatchStatus =
  | "strong_match"
  | "acceptable_match"
  | "closest_available"
  | "missing_required"
  | "missing_supporting";

export type SourceProductsFromConceptResult = {
  promptKey: string;
  textCostUsd?: number | null;
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

// Concept-first (S2): single prompt path, no pre-approval catalogue anchors.
const INITIAL_CONCEPT_PROMPT_VERSION = "2026-09-01.1";
const FINAL_GROUNDED_RENDER_PROMPT_VERSION = "2026-09-01.1";
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

function roomMeasurementsLanguage(measurements?: {
  wallLengthCm?: number | null;
  roomDepthCm?: number | null;
  ceilingHeightCm?: number | null;
} | null) {
  if (!measurements?.wallLengthCm || !measurements.roomDepthCm) {
    return null;
  }

  return [
    `The real room measures approximately ${Math.round(measurements.wallLengthCm)} cm along the main wall and ${Math.round(
      measurements.roomDepthCm
    )} cm deep${measurements.ceilingHeightCm ? ` with a ${Math.round(measurements.ceilingHeightCm)} cm ceiling` : ""}.`,
    "Keep every furniture piece, rug, and clearance physically plausible for these dimensions; do not compress or stretch the room."
  ].join(" ");
}

export function buildInitialConceptSystemPrompt({
  roomType,
  styleSlugs = []
}: {
  roomType: string;
  styleSlugs?: string[];
}) {
  return [
    initialConceptPrompt.system,
    "",
    "Ritzy interior design language:",
    sourceRoomPreservationLanguage(roomType),
    globalPhotorealismLanguage(),
    roomDesignLanguage(roomType),
    roomBlueprintDefaultsLanguage(roomType),
    styleDesignLanguage(styleSlugs),
    paletteRegisterLanguage()
  ]
    .filter(Boolean)
    .join("\n");
}

type InitialConceptImagePromptInput = {
  generationPrompt: string;
  roomType: string;
  hasInspirationImages?: boolean;
  styleSlugs?: string[];
  strictSourceRoomPreservation?: boolean;
  spatialIntent?: SpatialPromptIntent | null;
  additionalRoomPhotoCount?: number;
  measurements?: {
    wallLengthCm?: number | null;
    roomDepthCm?: number | null;
    ceilingHeightCm?: number | null;
  } | null;
};

// Evolink rejects image prompts past a ~4000-token cap. This prompt's prose measures
// 5.27 chars/token on the o200k tokenizer (2026-07-13 audit); 17k chars is ~3,225 tokens at
// that ratio and stays under the cap even at a pessimistic 4.4 chars/token. The clamp below
// degrades the VARIABLE inputs (catalogue summary first, then the generation prompt) and
// never touches the fixed design-language blocks, so a worst-case brief cannot push the
// submit over the cap. See initial-concept-prompt-budget.test.ts for the adversarial proof.
export const INITIAL_CONCEPT_IMAGE_PROMPT_CHAR_BUDGET = 17_000;
const INITIAL_CONCEPT_GENERATION_PROMPT_FLOOR_CHARS = 800;

export function buildInitialConceptImagePrompt(input: InitialConceptImagePromptInput) {
  let current = { ...input };
  let prompt = assembleInitialConceptImagePrompt(current);

  // Give back the overflow from the generation prompt (the only variable input now
  // that concepts are catalogue-free pre-approval), never below a floor that keeps
  // the concept direction intact. Iterative because each trim changes the assembled
  // length non-linearly.
  for (let pass = 0; pass < 4 && prompt.length > INITIAL_CONCEPT_IMAGE_PROMPT_CHAR_BUDGET; pass++) {
    const overflow = prompt.length - INITIAL_CONCEPT_IMAGE_PROMPT_CHAR_BUDGET;
    if (current.generationPrompt.length > INITIAL_CONCEPT_GENERATION_PROMPT_FLOOR_CHARS) {
      current = {
        ...current,
        generationPrompt: truncateForPrompt(
          current.generationPrompt,
          Math.max(
            INITIAL_CONCEPT_GENERATION_PROMPT_FLOOR_CHARS,
            current.generationPrompt.length - overflow
          )
        )
      };
    } else {
      break;
    }
    prompt = assembleInitialConceptImagePrompt(current);
  }

  return prompt;
}

function assembleInitialConceptImagePrompt({
  generationPrompt,
  roomType,
  hasInspirationImages,
  styleSlugs = [],
  strictSourceRoomPreservation = false,
  spatialIntent = null,
  measurements = null,
  additionalRoomPhotoCount = 0
}: InitialConceptImagePromptInput) {
  return [
    generationPrompt,
    "",
    additionalRoomPhotoCount > 0
      ? `The first ${additionalRoomPhotoCount + 1} input images are photos of the SAME room from different corners. Use the FIRST photo's camera perspective as the base image; use the other angles only to understand the room's true walls, openings, and proportions.`
      : "Use the uploaded room photo as the base image.",
    hasInspirationImages
      ? "Use the uploaded inspiration images as style references for palette, materials, atmosphere, and composition. Do not reproduce them exactly."
      : null,
    sourceRoomPreservationLanguage(roomType),
    strictSourceRoomPreservation ? strictSourceRoomPreservationLanguage() : null,
    roomDesignLanguage(roomType),
    roomBlueprintDefaultsLanguage(roomType),
    spatialLayoutLanguage(roomType, spatialIntent),
    roomMeasurementsLanguage(measurements),
    styleDesignLanguage(styleSlugs),
    paletteRegisterLanguage(),
    globalPhotorealismLanguage(),
    enhancedRitzyInteriorStylingLanguage({ mode: "initial-concept" }),
    "Redesign movable furniture, lighting, textiles, accessories, and decor according to the concept direction.",
    "Keep the source-photo camera perspective and lens feel. Do not add text labels, prices, product names, retailer claims, or fake product labels."
  ]
    .filter(Boolean)
    .join("\n");
}

function truncateForPrompt(value: string, maxChars: number) {
  if (maxChars <= 0) {
    return "";
  }
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length <= maxChars ? collapsed : `${collapsed.slice(0, maxChars - 1)}…`;
}

// Same Evolink ~4000-token submit cap as the initial concept prompt, but the
// render path appends a spatial-QA retry suffix (up to ~1.5k chars) AFTER this
// builder runs, so the build budget leaves that headroom: 15k chars ≈ 3.4k tokens
// at the audited 5.27 chars/token, ≈ 3.9k with a max suffix at the pessimistic
// 4.4 ratio — under the cap either way.
export const FINAL_GROUNDED_RENDER_PROMPT_CHAR_BUDGET = 15_000;
const FINAL_RENDER_PRODUCT_SUMMARY_FLOOR_CHARS = 1_500;

export function buildFinalGroundedRenderPrompt(input: {
  roomType: string;
  conceptTitle: string;
  conceptDescription?: string | null;
  hasConceptImage?: boolean;
  productSummary: string;
  spatialIntent?: SpatialPromptIntent | null;
  strictSourceRoomPreservation?: boolean;
}) {
  let current = { ...input };
  let prompt = assembleFinalGroundedRenderPrompt(current);

  // Give back the overflow from the product summary first (entries are already
  // priority-ordered, so truncation drops the tail, never the anchors), then from
  // the concept description. Iterative because each trim changes the assembled
  // length non-linearly.
  for (let pass = 0; pass < 4 && prompt.length > FINAL_GROUNDED_RENDER_PROMPT_CHAR_BUDGET; pass++) {
    const overflow = prompt.length - FINAL_GROUNDED_RENDER_PROMPT_CHAR_BUDGET;
    if (current.productSummary.length - overflow > FINAL_RENDER_PRODUCT_SUMMARY_FLOOR_CHARS) {
      current = {
        ...current,
        productSummary: truncateForPrompt(current.productSummary, current.productSummary.length - overflow)
      };
    } else if (current.conceptDescription) {
      current = { ...current, conceptDescription: null };
    } else {
      break;
    }
    prompt = assembleFinalGroundedRenderPrompt(current);
  }

  return prompt;
}

function assembleFinalGroundedRenderPrompt({
  roomType,
  conceptTitle,
  conceptDescription,
  hasConceptImage,
  productSummary,
  strictSourceRoomPreservation = false,
  spatialIntent = null
}: {
  roomType: string;
  conceptTitle: string;
  conceptDescription?: string | null;
  hasConceptImage?: boolean;
  productSummary: string;
  spatialIntent?: SpatialPromptIntent | null;
  strictSourceRoomPreservation?: boolean;
}) {
  return [
    finalGroundedRenderPrompt.system,
    "",
    "Ritzy final render language:",
    sourceRoomPreservationLanguage(roomType),
    strictSourceRoomPreservation ? strictSourceRoomPreservationLanguage() : null,
    roomDesignLanguage(roomType),
    roomSpatialPlacementGuardrailLanguage(roomType),
    spatialLayoutLanguage(roomType, spatialIntent),
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

// Text/vision calls get a hard client-side deadline so a hung provider can never hold
// a user request open indefinitely (observed 12+ minutes in Phase 0). Image calls get a
// longer one sized to the slowest observed legitimate provider (gpt-image-2 at ~140s).
const DEFAULT_TEXT_TIMEOUT_MS = 90_000;
const IMAGE_CALL_TIMEOUT_MS = 240_000;
// The spec-driven sourcing pass reads the concept image plus up to a few
// dozen product images across every role of the design in one call; it is
// the one text call allowed past the 90s default. The route that runs it
// (/product-matching, 300s) must outlast it: PRODUCT_SOURCING_TIMEOUT_MS +
// image fetch + persistence stays well inside that budget.
export const PRODUCT_SOURCING_TIMEOUT_MS = 150_000;

export function textTimeoutMs(env: { RITZY_TEXT_TIMEOUT_MS?: string }): number {
  const configured = Number(env.RITZY_TEXT_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TEXT_TIMEOUT_MS;
}

function createTextClient(env: { OPENAI_API_KEY: string; RITZY_TEXT_TIMEOUT_MS?: string }): OpenAI {
  return new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: textTimeoutMs(env), maxRetries: 0 });
}

// The image fallback must be a genuinely distinct provider: pin api.openai.com so an
// OPENAI_BASE_URL gateway override (the config that made the old fallback 404 on
// /v1/images/edits) can never route the fallback through the failing primary.
function isOpenAiOwnOrigin(baseUrl: string | undefined): boolean {
  if (!baseUrl || !baseUrl.trim()) {
    return true;
  }
  try {
    return new URL(baseUrl).origin === "https://api.openai.com";
  } catch {
    return false;
  }
}

export function createOpenAiImageFallbackClient(env: {
  OPENAI_API_KEY: string;
  OPENAI_FALLBACK_API_KEY?: string;
  OPENAI_BASE_URL?: string;
}): OpenAI {
  // A gateway credential (the config that sets OPENAI_BASE_URL) cannot authenticate
  // against api.openai.com; pairing it with the pin would just turn the dead
  // fallback's 404 into a dead fallback's 401. Require a real credential: a
  // dedicated fallback key, or the primary key only when no gateway override is set.
  const apiKey =
    env.OPENAI_FALLBACK_API_KEY ?? (isOpenAiOwnOrigin(env.OPENAI_BASE_URL) ? env.OPENAI_API_KEY : null);
  if (!apiKey) {
    throw new Error(
      "No distinct OpenAI fallback credential: OPENAI_BASE_URL routes the primary key through a gateway and OPENAI_FALLBACK_API_KEY is unset."
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.openai.com/v1",
    timeout: IMAGE_CALL_TIMEOUT_MS,
    maxRetries: 0
  });
}

async function generateImageWithConfiguredProvider({
  prompt,
  references,
  noImageErrorMessage
}: {
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
        references: await hardenReferenceUrls(references, env),
        model: env.EVOLINK_IMAGE_MODEL,
        apiKey: env.EVOLINK_API_KEY,
        quality: env.EVOLINK_IMAGE_QUALITY,
        baseUrl: env.EVOLINK_BASE_URL
      });
    } catch (error) {
      const fallbackError = formatImageGenerationError(error);
      try {
        const fallbackAttempt = await generateOpenAiImage({
          client: createOpenAiImageFallbackClient(env),
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
      } catch (fallbackFailure) {
        throw new Error(
          `Evolink image generation failed (${fallbackError}); OpenAI fallback also failed (${formatImageGenerationError(fallbackFailure)}).`
        );
      }
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
      try {
        const fallbackAttempt = await generateOpenAiImage({
          client: createOpenAiImageFallbackClient(env),
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
      } catch (fallbackFailure) {
        throw new Error(
          `Gemini image generation failed (${fallbackError}); OpenAI fallback also failed (${formatImageGenerationError(fallbackFailure)}).`
        );
      }
    }
  }

  return generateOpenAiImage({
    client: new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: IMAGE_CALL_TIMEOUT_MS, maxRetries: 0 }),
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

// Exported for the timeout regression test: the Vertex token exchange must be inside
// the image deadline, and that is only provable against this function directly.
export async function generateGeminiImage({
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
  // The deadline covers EVERYTHING, including the service-account token exchange: a
  // hanging OAuth request must not run outside the Gemini timeout.
  const deadlineMs = Number(process.env.RITZY_GEMINI_TIMEOUT_MS) || 60_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deadlineMs);

  try {
    const auth = await getVertexAuthContext(controller.signal);
    const resolvedProjectId = projectId || auth.projectId;

    if (!resolvedProjectId) {
      throw new Error("GOOGLE_CLOUD_PROJECT is required for Gemini image generation.");
    }

    const endpoint = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(
      resolvedProjectId
    )}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;

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
      throw new Error(`Gemini image generation timed out after ${Math.round(deadlineMs / 1000)} seconds.`);
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

// Hardens every remote reference URL before a URL-based provider sees it: strip
// known-breaking resize params (the 2XL "Invalid parameters" outage), refuse hosts
// outside the reference-image allowlist, and preflight deliverability. A reference
// that fails hardening keeps its bytes and loses its URL, so the provider inlines it
// as a data URL instead of dying on an unfetchable or hostile link.
export async function hardenReferenceUrls(
  references: ImageGenerationReference[],
  env: { RITZY_REFERENCE_IMAGE_HOSTS?: string; RITZY_REFERENCE_STRIP_QUERY_HOSTS?: string; NEXT_PUBLIC_SUPABASE_URL: string },
  fetchImpl?: (input: string | URL, init?: RequestInit) => Promise<Response>
): Promise<ImageGenerationReference[]> {
  const allowlist = buildReferenceHostAllowlist({
    configured: env.RITZY_REFERENCE_IMAGE_HOSTS,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL
  });
  const stripHosts = env.RITZY_REFERENCE_STRIP_QUERY_HOSTS
    ? env.RITZY_REFERENCE_STRIP_QUERY_HOSTS.split(",").map((entry) => entry.trim()).filter(Boolean)
    : undefined;

  return Promise.all(
    references.map(async (reference) => {
      const remoteUrl = publicReferenceUrl(reference.url);
      if (!remoteUrl) {
        return reference;
      }

      const guarded = guardReferenceUrl(remoteUrl, { allowlist, stripQueryHosts: stripHosts });
      if (!guarded.ok) {
        console.warn(`[reference-guard] inlining "${reference.name}": ${guarded.reason}`);
        return { ...reference, url: null };
      }

      // Preflight repeats the policy check on its first hop and then proves
      // deliverability; a failed reference keeps its bytes and inlines.
      const preflight = await preflightReferenceImage(guarded.url, { allowlist, fetchImpl, stripQueryHosts: stripHosts });
      if (!preflight.ok) {
        console.warn(`[reference-guard] inlining "${reference.name}" after failed preflight: ${preflight.reason}`);
        return { ...reference, url: null };
      }

      return { ...reference, url: preflight.finalUrl ?? guarded.url };
    })
  );
}

const EVOLINK_POLL_INTERVAL_MS = 3_000;
const EVOLINK_POLL_TIMEOUT_MS = 300_000;
const EVOLINK_MAX_REFERENCE_URLS = 14;
// Evolink's public pricing pages list USD and credit figures side by side and both imply the
// same rate: $0.494 = 33.6 credits and $2.250 = 153 credits, i.e. 68 credits per USD. The rate
// is a gateway-level constant, not per-model; override via env if Evolink ever reprices.
const EVOLINK_CREDITS_PER_USD_DEFAULT = 68;

// Converts gateway credits into the USD estimate recorded on ai_jobs.cost_estimate_usd.
export function evolinkCreditsToUsd(credits: number | null | undefined): number | null {
  if (typeof credits !== "number" || !Number.isFinite(credits)) {
    return null;
  }
  const configured = Number(process.env.EVOLINK_CREDITS_PER_USD);
  const creditsPerUsd =
    Number.isFinite(configured) && configured > 0 ? configured : EVOLINK_CREDITS_PER_USD_DEFAULT;
  // ai_jobs.cost_estimate_usd is numeric(10, 4).
  return Math.round((credits / creditsPerUsd) * 10_000) / 10_000;
}

type EvolinkTaskResponse = {
  id?: string;
  status?: "pending" | "processing" | "completed" | "failed" | string;
  results?: string[];
  error?: { message?: string } | string | null;
  fail_reason?: string | null;
  usage?: {
    billing_rule?: string;
    credits_reserved?: number;
    credits_used?: number;
    user_group?: string;
  } | null;
};

async function generateEvolinkImage({
  prompt,
  references,
  model,
  apiKey,
  quality,
  baseUrl
}: {
  prompt: string;
  references: ImageGenerationReference[];
  model: string;
  apiKey?: string;
  quality: "1K" | "2K" | "4K";
  baseUrl: string;
}): Promise<ImageGenerationAttempt> {
  const apiBase = baseUrl;
  if (!apiKey) {
    throw new Error("EVOLINK_API_KEY is required for Evolink image generation.");
  }

  const startedAt = Date.now();
  // Prefer real public URLs (small request payloads); inline bytes as data URLs
  // otherwise. Verified live: the API accepts data URLs, so a required
  // reference (the room, the approved concept) can never be silently dropped.
  // Inlined references are recompressed so a full reference set stays a few
  // megabytes instead of tens.
  const referenceUrls = (
    await Promise.all(
      references.map(
        async (reference) =>
          publicReferenceUrl(reference.url) ?? (await referenceDataUrl(reference))
      )
    )
  ).slice(0, EVOLINK_MAX_REFERENCE_URLS);

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };

  const submitResponse = await fetch(`${apiBase}/v1/images/generations`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(Number(process.env.RITZY_EVOLINK_SUBMIT_TIMEOUT_MS) || 30_000),
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

    let pollResponse: Response;
    try {
      pollResponse = await fetch(`${apiBase}/v1/tasks/${encodeURIComponent(submitPayload.id)}`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(15_000)
      });
    } catch {
      // One slow or dropped status poll must not abandon a live task; the outer
      // EVOLINK_POLL_TIMEOUT_MS deadline still bounds the loop.
      continue;
    }
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

      // The result URL is data from the gateway response. Two trusted cases only:
      // the configured gateway's own origin (operator-trusted, covers stubs), fetched
      // with redirects REFUSED outright; or an allowlisted public host, fetched
      // through the guarded redirect follower so no hop can escape policy. Either
      // way the download is capped and deadline-bound.
      let imageResponse: Response;
      const sameOriginAsGateway = (() => {
        try {
          return new URL(resultUrl).origin === new URL(apiBase).origin;
        } catch {
          return false;
        }
      })();
      if (sameOriginAsGateway) {
        imageResponse = await fetch(resultUrl, {
          redirect: "manual",
          signal: AbortSignal.timeout(60_000)
        });
        if (imageResponse.status >= 300 && imageResponse.status < 400) {
          throw new Error("Evolink result URL attempted a redirect; refusing.");
        }
      } else {
        const allowlist = buildReferenceHostAllowlist({
          configured: process.env.RITZY_REFERENCE_IMAGE_HOSTS,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
        });
        const followed = await followGuardedRedirects(resultUrl, { allowlist, timeoutMs: 60_000, method: "GET" });
        if (!followed.ok) {
          throw new Error(`Evolink result URL refused: ${followed.reason}`);
        }
        imageResponse = followed.response;
      }

      if (!imageResponse.ok) {
        throw new Error(`Evolink result image download failed with HTTP ${imageResponse.status}.`);
      }
      const resultContentType = imageResponse.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
      if (!resultContentType.startsWith("image/")) {
        throw new Error(
          resultContentType
            ? `Evolink result was not an image (content type ${resultContentType}).`
            : "Evolink result had no content type; refusing to store it as an image."
        );
      }

      const resultBytes = await readResponseBytesCapped(imageResponse, 30 * 1024 * 1024, 60_000);
      if (!resultBytes) {
        throw new Error("Evolink result image exceeded the 30MB download cap or had no body.");
      }
      const imageBase64 = resultBytes.toString("base64");

      // Prefer the final consumption figure; fall back to the reservation (the submit
      // response only carries credits_reserved) so spend is never silently unrecorded.
      const creditsUsed =
        task.usage?.credits_used ??
        task.usage?.credits_reserved ??
        submitPayload.usage?.credits_used ??
        submitPayload.usage?.credits_reserved ??
        null;

      return {
        provider: "evolink",
        model,
        imageBase64,
        revisedPrompt: null,
        latencySeconds: secondsSince(startedAt),
        fallbackUsed: false,
        error: null,
        creditsUsed
      };
    }
  }

  throw new Error(`Evolink image generation timed out after ${EVOLINK_POLL_TIMEOUT_MS / 1000} seconds.`);
}

// Downscaled data URL for a vision input; same pipeline as image references.
async function visionDataUrl(bytes: Buffer, mimeType: string) {
  return referenceDataUrl({ bytes, mimeType, name: "vision-input", url: null });
}

async function referenceDataUrl(reference: ImageGenerationReference) {
  try {
    const compressed = await sharp(reference.bytes)
      .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${compressed.toString("base64")}`;
  } catch {
    return `data:${normalizeImageMimeType(reference.mimeType)};base64,${reference.bytes.toString("base64")}`;
  }
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
  const client = createTextClient(env);
  const { model: stageModel, requestParams: stageRequestParams } = stageTextConfig("clarifying_questions", env.OPENAI_TEXT_MODEL);
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
    max_output_tokens: 4000,
    ...stageRequestParams,
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
    model: stageModel,
    textCostUsd: estimateTextCostUsd(stageModel, response.usage),
    questions
  };
}

export async function analyzeInspirationImages(
  input: AnalyzeInspirationImagesInput
): Promise<AnalyzeInspirationImagesResult> {
  const env = parseServerEnv(process.env);
  const client = createTextClient(env);
  const { model: stageModel, requestParams: stageRequestParams } = stageTextConfig("inspiration_analysis", env.OPENAI_TEXT_MODEL);

  const response = await client.responses.create({
    max_output_tokens: 4000,
    ...stageRequestParams,
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
    textCostUsd: estimateTextCostUsd(stageModel, response.usage),
    promptVersion: inspirationAnalysisPrompt.version,
    model: stageModel,
    analysis
  };
}

export async function sourceProductsFromConcept(
  input: SourceProductsFromConceptInput
): Promise<SourceProductsFromConceptResult> {
  // The pools are the contract: without them the response cannot be held to
  // one result per role inside its pool, so the pass is refused up front
  // rather than run with prompt-only guarantees.
  const roleCandidatePools = input.roleCandidatePools ?? [];
  if (roleCandidatePools.length === 0) {
    throw new Error("Product sourcing needs role candidate pools; refusing to run the visual pass without them.");
  }
  const env = parseServerEnv(process.env);
  const client = createTextClient(env);
  const { model: stageModel, requestParams: stageRequestParams } = stageTextConfig("product_sourcing", env.OPENAI_TEXT_MODEL);
  const prompt = specProductSourcingPrompt;
  // The candidates are already the per-role pools, so every one of them is listed.
  const candidateLimit = Math.max(1, input.candidates.length);
  const allowedProductIds = new Set(input.candidates.map((candidate) => candidate.id));
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
  const candidateImageContent = productSourcingProvidedImageContent(
    input.candidates,
    input.candidateImageDataUrls ?? {},
    input.candidateImageDetail ?? "low"
  );
  const roleContextLines = [designSpecSourcingLanguage(input.designSpec)];

  const response = await client.responses.create(
    {
    max_output_tokens: 32000,
    ...stageRequestParams,
    input: [
      {
        role: "system",
        content: prompt.system
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Room type: ${input.roomType}`,
              ...roleContextLines,
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
    },
    { timeout: PRODUCT_SOURCING_TIMEOUT_MS }
  );

  const parsed = conceptProductSourcingResponseSchema.parse(JSON.parse(response.output_text));
  const validated = validateProductSourcingRoleContract(parsed, roleCandidatePools, allowedProductIds);

  return {
    promptKey: prompt.key,
    promptVersion: prompt.version,
    model: stageModel,
    textCostUsd: estimateTextCostUsd(stageModel, response.usage),
    needs: parsed.needs,
    ...validated
  };
}

// S3 image content: exactly the candidates the app fetched a data URL for, in
// candidate order, at the given detail. A candidate without a provided data
// URL gets no image, never a raw retailer URL for the provider to download.
export function productSourcingProvidedImageContent(
  candidates: ConceptProductSourcingCandidate[],
  imageDataUrls: Record<string, string>,
  detail: ProductSourcingImageDetail = "low"
) {
  return candidates
    .filter((candidate) => Boolean(imageDataUrls[candidate.id]))
    .flatMap((candidate) => [
      {
        type: "input_text" as const,
        text: `Candidate product image for id ${candidate.id}: ${candidate.name}`
      },
      {
        type: "input_image" as const,
        image_url: imageDataUrls[candidate.id],
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

export async function generateInitialConcept(
  input: GenerateInitialConceptInput
): Promise<GenerateInitialConceptResult> {
  const env = parseServerEnv(process.env);
  const client = createTextClient(env);
  const { model: stageModel, requestParams: stageRequestParams } = stageTextConfig("concept_direction", env.OPENAI_TEXT_MODEL);

  const brief = {
    roomType: input.roomType,
    ...(input.styleSlugs?.length ? { styleSlugs: input.styleSlugs } : {}),
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
    max_output_tokens: 24000,
    ...stageRequestParams,
    input: [
      {
        role: "system",
        content: buildInitialConceptSystemPrompt({
          roomType: input.roomType,
          styleSlugs: input.styleSlugs
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
          ...(input.additionalRoomPhotos ?? []).flatMap((photo, index) => [
            {
              type: "input_text" as const,
              text: `Additional photo ${index + 2} of the SAME room from another corner. Use it to understand walls, openings, and proportions that the first photo cannot see.`
            },
            {
              type: "input_image" as const,
              image_url: photo.url,
              detail: "high" as const
            }
          ]),
          ...(input.floorPlanImageUrl
            ? [
                {
                  type: "input_text" as const,
                  text: "The next image is the room's floor plan. Use it to understand the room's true footprint, door and window positions, and circulation before deciding the furniture layout. Reference it in the layout logic of your generation prompt."
                },
                {
                  type: "input_image" as const,
                  image_url: input.floorPlanImageUrl,
                  detail: "high" as const
                }
              ]
            : []),
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
    styleSlugs: input.styleSlugs,
    strictSourceRoomPreservation: localStrictSourceRoomPreservationEnabled(),
    spatialIntent: input.spatialIntent ?? null,
    measurements: input.measurements ?? null,
    additionalRoomPhotoCount: input.additionalRoomPhotos?.length ?? 0
  });

  const imageResult = await generateImageWithConfiguredProvider({
    prompt: imagePrompt,
    references: [
      {
        bytes: input.roomPhotoBytes,
        mimeType: input.roomPhotoMimeType,
        name: "room",
        url: publicReferenceUrl(input.roomPhotoReferenceUrl ?? input.roomPhotoUrl),
        required: true
      },
      ...(input.additionalRoomPhotos ?? []).slice(0, 2).map((photo, index) => ({
        bytes: photo.bytes,
        mimeType: photo.mimeType,
        name: `room-angle-${index + 2}`,
        url: publicReferenceUrl(photo.referenceUrl ?? photo.url)
      }))
    ],
    noImageErrorMessage: "OpenAI image generation returned no image data."
  });

  return {
    promptKey: initialConceptPrompt.key,
    promptVersion: INITIAL_CONCEPT_PROMPT_VERSION,
    textModel: stageModel,
    textCostUsd: estimateTextCostUsd(stageModel, directionResponse.usage),
    imageProvider: imageResult.provider,
    imageModel: imageResult.model,
    imageLatencySeconds: imageResult.latencySeconds,
    imageFallbackUsed: imageResult.fallbackUsed,
    imageFallbackError: imageResult.error ?? null,
    imageCreditsUsed: imageResult.creditsUsed ?? null,
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
  imageCreditsUsed: number | null;
  imageBase64: string;
};

export const CONCEPT_VIEW_PROMPT_VERSION = "concept-view.2026-07-13.1";

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
  const client = createTextClient(env);
  const prompt = buildConceptViewPrompt(input);

  const imageResult = await generateImageWithConfiguredProvider({
    prompt,
    references: [
      {
        bytes: input.heroImageBytes,
        mimeType: input.heroImageMimeType,
        name: "approved-concept",
        url: input.heroImageUrl ?? null,
        required: true
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
    imageCreditsUsed: imageResult.creditsUsed ?? null,
    imageBase64: imageResult.imageBase64
  };
}

// Additional camera angles of the FINAL grounded render. Mirrors generateConceptView but takes the
// completed hero render (which already composites the real purchased products) as the reference and
// uses truth-separation-aware consistency language so the second/third angles reproduce the exact
// same products, not a restyle. Camera language is shared with concept views (same room geometry).
export type GenerateFinalRenderViewInput = {
  roomType: string;
  viewKey: ConceptViewKey;
  conceptTitle: string;
  conceptDescription?: string | null;
  heroImageBytes: Buffer;
  heroImageMimeType: string;
  heroImageUrl?: string | null;
};

export type GenerateFinalRenderViewResult = GenerateConceptViewResult;

export const FINAL_RENDER_VIEW_PROMPT_VERSION = "final-render-view.2026-07-13.1";

export function buildFinalRenderViewPrompt(input: {
  roomType: string;
  viewKey: ConceptViewKey;
  conceptTitle: string;
  conceptDescription?: string | null;
}) {
  return [
    finalRenderViewConsistencyLanguage(),
    "",
    conceptViewCameraLanguage(input.roomType, input.viewKey),
    "",
    `Room design: ${input.conceptTitle}`,
    input.conceptDescription ? `Design notes: ${input.conceptDescription}` : null,
    "",
    globalPhotorealismLanguage(),
    "Do not add text labels, prices, product names, or retailer claims."
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export async function generateFinalRenderView(
  input: GenerateFinalRenderViewInput
): Promise<GenerateFinalRenderViewResult> {
  const env = parseServerEnv(process.env);
  const client = createTextClient(env);
  const prompt = buildFinalRenderViewPrompt(input);

  const imageResult = await generateImageWithConfiguredProvider({
    prompt,
    references: [
      {
        bytes: input.heroImageBytes,
        mimeType: input.heroImageMimeType,
        name: "final-render",
        url: input.heroImageUrl ?? null,
        required: true
      }
    ],
    noImageErrorMessage: "Final render view generation returned no image data."
  });

  return {
    viewKey: input.viewKey,
    promptVersion: FINAL_RENDER_VIEW_PROMPT_VERSION,
    imageProvider: imageResult.provider,
    imageModel: imageResult.model,
    imageLatencySeconds: imageResult.latencySeconds,
    imageFallbackUsed: imageResult.fallbackUsed,
    imageFallbackError: imageResult.error ?? null,
    imageCreditsUsed: imageResult.creditsUsed ?? null,
    imageBase64: imageResult.imageBase64
  };
}

export type ExtractConceptImagePaletteInput = {
  // Data URL or fetchable URL of the generated concept image.
  imageUrl: string;
};

export type ExtractConceptImagePaletteResult = {
  promptKey: string;
  textCostUsd?: number | null;
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
  const client = createTextClient(env);
  const { model: stageModel, requestParams: stageRequestParams } = stageTextConfig("concept_palette", env.OPENAI_TEXT_MODEL);

  const response = await client.responses.create({
    max_output_tokens: 4000,
    ...stageRequestParams,
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
    textCostUsd: estimateTextCostUsd(stageModel, response.usage),
    promptVersion: conceptPalettePrompt.version,
    model: stageModel,
    palette
  };
}

export type AssessRenderSpatialQualityInput = {
  // Data URL or fetchable URL of the rendered image.
  imageUrl: string;
  roomType: string;
  spatialIntent?: SpatialPromptIntent | null;
};

export type AssessRenderSpatialQualityResult = {
  promptKey: string;
  textCostUsd?: number | null;
  promptVersion: string;
  model: string;
  qa: RenderSpatialQaResponse;
};

export async function assessRenderSpatialQuality(
  input: AssessRenderSpatialQualityInput
): Promise<AssessRenderSpatialQualityResult> {
  const env = parseServerEnv(process.env);
  const client = createTextClient(env);
  const { model: stageModel, requestParams: stageRequestParams } = stageTextConfig("spatial_qa", env.OPENAI_TEXT_MODEL);

  const context = [
    `Room type: ${input.roomType}.`,
    input.spatialIntent?.focalPoint && input.spatialIntent.focalPoint !== "unknown"
      ? `The user chose the focal point: ${input.spatialIntent.focalPoint.replace(/_/g, " ")}.`
      : "Focal point was not specified; judge against the most credible focal point in the image.",
    input.spatialIntent?.mustKeepClear?.length
      ? `The user asked to keep clear: ${input.spatialIntent.mustKeepClear.join("; ")}.`
      : null
  ]
    .filter(Boolean)
    .join(" ");

  const response = await client.responses.create({
    max_output_tokens: 4000,
    ...stageRequestParams,
    input: [
      {
        role: "system",
        content: renderSpatialQaPrompt.system
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: context },
          {
            type: "input_image",
            image_url: input.imageUrl,
            detail: "high"
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ritzy_render_spatial_qa",
        schema: renderSpatialQaJsonSchema,
        strict: true
      }
    }
  });

  const qa = renderSpatialQaResponseSchema.parse(JSON.parse(response.output_text));

  return {
    promptKey: renderSpatialQaPrompt.key,
    promptVersion: renderSpatialQaPrompt.version,
    model: stageModel,
    textCostUsd: estimateTextCostUsd(stageModel, response.usage),
    qa
  };
}

// Corrective language appended to an image prompt when spatial QA asked for a
// regeneration; the issues come straight from the QA verdict.
export function spatialQaCorrectionLanguage(issues: string[]) {
  return [
    "A design review of the previous attempt found these placement problems; fix every one of them this time:",
    ...issues.map((issue) => `- ${issue}`),
    "Keep the same design direction, palette, and products; only correct the placement, orientation, scale, or artifact problems named above."
  ].join("\n");
}

export async function generateConceptRevision(
  input: GenerateConceptRevisionInput
): Promise<GenerateConceptRevisionResult> {
  const env = parseServerEnv(process.env);
  const client = createTextClient(env);
  const { model: stageModel, requestParams: stageRequestParams } = stageTextConfig("revision_direction", env.OPENAI_TEXT_MODEL);
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
    max_output_tokens: 24000,
    ...stageRequestParams,
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
            type: "input_text",
            text: "The next image is the PREVIOUS concept being revised. Derive the change plan and generation prompt as an edit of this image."
          },
          {
            type: "input_image",
            image_url: await visionDataUrl(input.previousConceptImage.bytes, input.previousConceptImage.mimeType),
            detail: "high"
          },
          {
            type: "input_text",
            text: "The next image is a photo of the real room. It is the architecture ground truth."
          },
          {
            type: "input_image",
            image_url: input.roomPhotoUrl,
            detail: "high"
          },
          ...(input.additionalRoomPhotos ?? []).flatMap((photo, index) => [
            {
              type: "input_text" as const,
              text: `Additional photo ${index + 2} of the SAME room from another corner. Use it to understand walls, openings, and proportions the first photo cannot see.`
            },
            {
              type: "input_image" as const,
              image_url: photo.url,
              detail: "high" as const
            }
          ]),
          ...(input.floorPlanImageUrl
            ? [
                {
                  type: "input_text" as const,
                  text: "The next image is the room's floor plan. Use it for the room's true footprint and circulation."
                },
                {
                  type: "input_image" as const,
                  image_url: input.floorPlanImageUrl,
                  detail: "high" as const
                }
              ]
            : [])
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ritzy_concept_revision",
        schema: conceptRevisionJsonSchema,
        strict: true
      }
    }
  });

  const direction = conceptRevisionResponseSchema.parse(JSON.parse(directionResponse.output_text));
  const imagePrompt = [
    direction.concept.generationPrompt,
    "",
    "This is a reference-preserving EDIT. The FIRST input image is the previous concept: use it as the base image and keep everything not listed under MUST CHANGE visually identical.",
    "The following room photos are the architecture ground truth. Preserve visible architecture, walls, windows, doors, ceiling details, AC vents, sockets, and built-ins exactly.",
    "MUST CHANGE (apply every item):",
    ...direction.changePlan.mustChange.map((item, index) => `${index + 1}. ${item}`),
    direction.changePlan.mustPreserve.length > 0 ? "MUST PRESERVE (keep visually identical):" : null,
    ...direction.changePlan.mustPreserve.map((item, index) => `${index + 1}. ${item}`),
    "Preserve the previous concept's palette and material register unless a MUST CHANGE item changes it.",
    "Output must look like a photorealistic editorial interior photograph, not an illustration, 3D showroom render, sketch, or mood board.",
    "Use physically plausible scale, natural shadows, realistic upholstery grain, wood texture, rug fibers, wall finish, and lighting falloff.",
    "Keep the previous concept's camera perspective and lens feel. Do not add text labels, prices, product names, or retailer claims."
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const imageResult = await generateImageWithConfiguredProvider({
    prompt: imagePrompt,
    references: [
      {
        bytes: input.previousConceptImage.bytes,
        mimeType: input.previousConceptImage.mimeType,
        name: "previous-concept",
        url: publicReferenceUrl(input.previousConceptImage.url),
        required: true
      },
      {
        bytes: input.roomPhotoBytes,
        mimeType: input.roomPhotoMimeType,
        name: "room",
        url: publicReferenceUrl(input.roomPhotoReferenceUrl ?? input.roomPhotoUrl)
      },
      ...(input.additionalRoomPhotos ?? []).slice(0, 2).map((photo, index) => ({
        bytes: photo.bytes,
        mimeType: photo.mimeType,
        name: `room-angle-${index + 2}`,
        url: publicReferenceUrl(photo.referenceUrl ?? photo.url)
      }))
    ],
    noImageErrorMessage: "OpenAI image revision returned no image data."
  });

  return {
    promptKey: conceptRevisionPrompt.key,
    promptVersion: conceptRevisionPrompt.version,
    textModel: stageModel,
    textCostUsd: estimateTextCostUsd(stageModel, directionResponse.usage),
    imageProvider: imageResult.provider,
    imageModel: imageResult.model,
    imageLatencySeconds: imageResult.latencySeconds,
    imageFallbackUsed: imageResult.fallbackUsed,
    imageFallbackError: imageResult.error ?? null,
    imageCreditsUsed: imageResult.creditsUsed ?? null,
    analysis: direction.roomAnalysis,
    concept: direction.concept,
    imageBase64: imageResult.imageBase64,
    revisedPrompt: imageResult.revisedPrompt ?? null,
    changePlan: direction.changePlan
  };
}

export type ExtractRoomDesignSpecInput = {
  roomType: string;
  conceptImage: { bytes: Buffer; mimeType: string };
  brief: {
    styleNotes?: string | null;
    colorNotes?: string | null;
    functionalRequirements?: string | null;
    avoidNotes?: string | null;
  };
  measurements?: {
    wallLengthCm?: number | null;
    roomDepthCm?: number | null;
    ceilingHeightCm?: number | null;
  } | null;
};

export type ExtractRoomDesignSpecResult = {
  promptKey: string;
  promptVersion: string;
  model: string;
  textCostUsd?: number | null;
  objects: SpecExtractionResponse["objects"];
  mustPreserve: SpecExtractionResponse["mustPreserve"];
};

// The spec-at-approval vision pass (S2): reads the approved concept image and
// produces the canonical object list plus the must-preserve architecture. The
// caller persists it to room_design_specs and the /spec screen makes it editable
// truth.
export async function extractRoomDesignSpec(
  input: ExtractRoomDesignSpecInput
): Promise<ExtractRoomDesignSpecResult> {
  const env = parseServerEnv(process.env);
  const client = createTextClient(env);
  const { model: stageModel, requestParams: stageRequestParams } = stageTextConfig("spec_extraction", env.OPENAI_TEXT_MODEL);

  const response = await client.responses.create({
    max_output_tokens: 8000,
    ...stageRequestParams,
    input: [
      {
        role: "system",
        content: specExtractionPrompt.system
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              roomType: input.roomType,
              brief: input.brief,
              measurements: input.measurements ?? null
            })
          },
          {
            type: "input_text",
            text: "The next image is the APPROVED concept. Extract the design spec from it."
          },
          {
            type: "input_image",
            image_url: await visionDataUrl(input.conceptImage.bytes, input.conceptImage.mimeType),
            detail: "high"
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ritzy_room_design_spec",
        schema: specExtractionJsonSchema,
        strict: true
      }
    }
  });

  const spec = specExtractionResponseSchema.parse(JSON.parse(response.output_text));
  return {
    promptKey: specExtractionPrompt.key,
    promptVersion: specExtractionPrompt.version,
    model: stageModel,
    textCostUsd: estimateTextCostUsd(stageModel, response.usage),
    objects: spec.objects,
    mustPreserve: spec.mustPreserve
  };
}

// Judges a revision against its change plan: did the asked change happen, did
// anything outside the plan drift. Non-fatal by contract: callers treat a thrown
// error as "diff unavailable", never as a failed revision.
export async function assessRevisionVisualDiff({
  previousImage,
  revisedImage,
  mustChange,
  mustPreserve
}: {
  previousImage: { bytes: Buffer; mimeType: string };
  revisedImage: { bytes: Buffer; mimeType: string };
  mustChange: string[];
  mustPreserve: string[];
}): Promise<RevisionVisualDiffResult> {
  const env = parseServerEnv(process.env);
  const client = createTextClient(env);
  const { model: stageModel, requestParams: stageRequestParams } = stageTextConfig("spatial_qa", env.OPENAI_TEXT_MODEL);

  const response = await client.responses.create({
    max_output_tokens: 4000,
    ...stageRequestParams,
    input: [
      {
        role: "system",
        content: revisionVisualDiffPrompt.system
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({ changePlan: { mustChange, mustPreserve } })
          },
          {
            type: "input_text",
            text: "Image 1: the PREVIOUS concept."
          },
          {
            type: "input_image",
            image_url: await visionDataUrl(previousImage.bytes, previousImage.mimeType),
            detail: "high"
          },
          {
            type: "input_text",
            text: "Image 2: the REVISED concept."
          },
          {
            type: "input_image",
            image_url: await visionDataUrl(revisedImage.bytes, revisedImage.mimeType),
            detail: "high"
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "ritzy_revision_visual_diff",
        schema: revisionVisualDiffJsonSchema,
        strict: true
      }
    }
  });

  const verdict = revisionVisualDiffResponseSchema.parse(JSON.parse(response.output_text));
  return {
    ...verdict,
    model: stageModel,
    textCostUsd: estimateTextCostUsd(stageModel, response.usage)
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
  const client = createTextClient(env);
  const { model: stageModel, requestParams: stageRequestParams } = stageTextConfig("product_enrichment", env.OPENAI_TEXT_MODEL);
  const parsedInput = productEnrichmentInputSchema.parse(input);
  const sourceHash = createProductEnrichmentSourceHash(parsedInput);

  const response = await client.responses.create({
    max_output_tokens: 8000,
    ...stageRequestParams,
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
    textCostUsd: estimateTextCostUsd(stageModel, response.usage),
    promptVersion: productMetadataEnrichmentPrompt.version,
    model: stageModel,
    sourceHash,
    enrichment: productEnrichmentResponseSchema.parse(JSON.parse(response.output_text))
  };
}

export async function generateProductTextEmbedding(
  input: ProductEnrichmentInput,
  enrichment: ProductEnrichmentResponse
): Promise<ProductEmbeddingResult> {
  const env = parseServerEnv(process.env);
  const client = createTextClient(env);
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
  const client = createTextClient(env);
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
  // The image model has tight prompt-token limits; keep the product summary to
  // the visual facts it can act on. Selection rationales are provenance, not
  // render guidance.
  const productSummary = input.products
    .map((product, index) =>
      [
        `${index + 1}. ${product.category}: ${product.name}`,
        product.roleLabel ? `room role: ${product.roleLabel}` : null,
        product.description ? `description: ${truncateForPrompt(product.description, 140)}` : null,
        product.dimensions ? `dimensions: ${product.dimensions}` : null
      ]
        .filter(Boolean)
        .join("; ")
    )
    .join("\n");
  const basePrompt = buildFinalGroundedRenderPrompt({
    roomType: input.roomType,
    conceptTitle: input.conceptTitle,
    conceptDescription: input.conceptDescription
      ? truncateForPrompt(input.conceptDescription, 600)
      : input.conceptDescription,
    hasConceptImage,
    productSummary,
    strictSourceRoomPreservation: localStrictSourceRoomPreservationEnabled(),
    spatialIntent: input.spatialIntent ?? null
  });
  const prompt = input.promptSuffix ? `${basePrompt}\n\n${input.promptSuffix}` : basePrompt;

  const imageResult = await generateImageWithConfiguredProvider({
    prompt,
    references: [
      {
        bytes: input.roomPhotoBytes,
        mimeType: input.roomPhotoMimeType,
        name: "room",
        url: input.roomPhotoUrl ?? null,
        required: true
      },
      ...(input.conceptImageBytes && input.conceptImageMimeType
        ? [
            {
              bytes: input.conceptImageBytes,
              mimeType: input.conceptImageMimeType,
              name: "concept",
              url: input.conceptImageUrl ?? null,
              required: true
            }
          ]
        : []),
      ...productReferences
    ],
    noImageErrorMessage: "OpenAI final render generation returned no image data."
  });

  return {
    promptKey: finalGroundedRenderPrompt.key,
    promptVersion: FINAL_GROUNDED_RENDER_PROMPT_VERSION,
    imageProvider: imageResult.provider,
    imageModel: imageResult.model,
    imageLatencySeconds: imageResult.latencySeconds,
    imageFallbackUsed: imageResult.fallbackUsed,
    imageFallbackError: imageResult.error ?? null,
    imageCreditsUsed: imageResult.creditsUsed ?? null,
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

async function getVertexAuthContext(signal?: AbortSignal) {
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
    signal,
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
