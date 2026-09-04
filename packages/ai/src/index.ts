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
  paletteRegisterLanguage,
  productDesignVerificationPrompt,
  productDesignVerificationJsonSchema,
  productDesignVerificationResponseSchema,
  anchorSetSelectionPrompt,
  anchorSetSelectionJsonSchema,
  anchorSetSelectionResponseSchema
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
  const effort = resolveStageTextEffort(stage, env, model);
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
  // Real catalogue pieces chosen for this room BEFORE the render, passed as
  // references so the render is built around them.
  //
  // Bytes only, and no URL field at all. The caller has already fetched every
  // one of these through the reference guard, so a URL would add nothing but a
  // way back to the failure it was added to prevent: a retailer host that
  // answers the image provider with a resize error costs the render its primary
  // provider, which was measured at 232 s against a 300 s route limit.
  anchorProducts?: Array<{
    roleLabel: string;
    bytes: Buffer;
    mimeType: string;
  }>;
  // What the caller can still wait for a picture, once everything before the
  // render has taken its share of the request. Without it the render honours
  // only the providers' own ceilings, which outlast every route that calls it.
  imageDeadlineMs?: number;
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
  // Provider deadline for this run's pass; the caller derives it from the
  // time left in its request. Defaults to PRODUCT_SOURCING_TIMEOUT_MS.
  timeoutMs?: number;
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
    // The pass's own visual similarity (0 to 1) for the product it proposes.
    // The app pre-selects only at or above the committed bar.
    similarity: number;
    reason: string;
    // Set when the validator synthesized this entry (no valid verdict, or a
    // pick outside the pool): not the pass's own judgement, so callers must
    // never present it as one.
    synthesized?: boolean;
  }>;
};

export type ValidatedConceptProductSourcingResult = Pick<
  SourceProductsFromConceptResult,
  "selectedProducts" | "roleResults"
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
  // Real catalogue pieces already chosen for this room, supplied as the LAST
  // reference images. The render is built around them, which is what makes the
  // shopping list buyable instead of hopeful.
  anchorProducts?: Array<{ roleLabel: string }>;
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
  additionalRoomPhotoCount = 0,
  anchorProducts = []
}: InitialConceptImagePromptInput) {
  return [
    generationPrompt,
    "",
    additionalRoomPhotoCount > 0
      ? `The first ${additionalRoomPhotoCount + 1} input images are photos of the SAME room from different corners. Use the FIRST photo's camera perspective as the base image; use the other angles only to understand the room's true walls, openings, and proportions.`
      : "Use the uploaded room photo as the base image.",
    anchorProducts.length > 0
      ? [
          `The LAST ${anchorProducts.length} input ${anchorProducts.length === 1 ? "image is a photograph" : "images are photographs"} of real furniture already chosen for this room: ${anchorProducts
            .map((product, index) => `image ${index + 1} of that set is the ${product.roleLabel}`)
            .join(", ")}.`,
          "Put those exact pieces in the room. Keep each one's silhouette, proportions, colour and material as photographed. You may change only where it stands, its angle to the camera, and how the room's light falls on it.",
          "Do not swap any of them for a similar-looking piece, do not restyle them to suit a palette, and do not leave one out. Design everything else in the room around them, so the finished room and these pieces read as one scheme."
        ].join(" ")
      : null,
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

// What the OpenAI image fallback is given when there is room for it, and the
// window below which it is not started at all. Sized from what the provider
// actually takes: this module's own note puts gpt-image-2 at roughly 140 s, the
// repo's bake-off outputs at 132 to 143 s, and the S3b prototype's fallback at
// 232 s. An earlier 60 s reserve was worse than no fallback at all: it cut the
// primary's polling window by a minute to buy a window the fallback could not
// land in, so a render the primary would have returned late became no render.
export const IMAGE_FALLBACK_RESERVE_MS = 150_000;
export const IMAGE_FALLBACK_MIN_MS = 120_000;

// What is left of a caller's deadline, capped so no caller can extend the
// provider ceiling past what this module is willing to wait. NOT floored:
// flooring it made the primary and the fallback together overrun the caller,
// which is the failure the deadline exists to prevent. Below the minimum the
// caller skips the fallback instead.
export function imageCallTimeoutMs(deadlineMs: number | undefined, startedAt: number, now = Date.now()): number {
  if (deadlineMs === undefined) {
    return IMAGE_CALL_TIMEOUT_MS;
  }
  return Math.max(0, Math.min(IMAGE_CALL_TIMEOUT_MS, deadlineMs - Math.max(0, now - startedAt)));
}

// What the result download may take: BOTH the per-hop timeout and the overall
// one. followGuardedRedirects defaults its overall budget to twice the per-hop
// value, so a caller passing only timeoutMs hands a redirecting result two
// windows, and the body read then starts after those. The download is the last
// stage of the render and has to finish inside the same window as the rest.
// Null when nothing is left: a floor here, however small, is still a promise
// the caller did not make. One second past a 285 s budget cannot breach the
// route on its own, but a helper whose comment says "what is left" and whose
// code says "at least a second" is one the next reader will trust for the
// larger number too.
export function evolinkDownloadBudgetMs(
  deadline: number,
  now = Date.now()
): { timeoutMs: number; overallTimeoutMs: number } | null {
  const remaining = deadline - now;
  if (remaining <= 0) {
    return null;
  }
  return { timeoutMs: Math.min(60_000, remaining), overallTimeoutMs: remaining };
}

// The primary's share of a caller's deadline: everything except what the
// fallback would need. A fixed fraction was wrong in both directions — two
// thirds of a 170 s budget left the fallback 58 s against a provider that needs
// well over twice that, so a stalled primary produced no concept at all where
// the un-deadlined code produced a slow one.
//
// The primary keeps the deadline itself when there is not enough for both. That
// is the honest trade inside one request: a provider outage then costs the run,
// which the shopper retries, rather than costing the request, which the platform
// kills without a catch path and locks them out of retrying for fifteen minutes.
export function evolinkPollWindowMs(deadlineMs: number | undefined): number | undefined {
  if (deadlineMs === undefined) {
    return undefined;
  }
  const share = deadlineMs - IMAGE_FALLBACK_RESERVE_MS;
  // Split only when BOTH halves are usable: the fallback needs a window it can
  // land in, and the primary must not be cut below half the budget to buy one.
  // Otherwise the primary keeps the whole deadline, because a fallback that
  // cannot return is not worth taking time from the provider that can. Under a
  // concept route's reserve that means no fallback at all, which is the honest
  // answer: one request cannot hold two renders of this length, and a run that
  // fails cleanly is retryable where a killed one locks the shopper out.
  const usableSplit = share >= Math.floor(deadlineMs / 2);
  return Math.max(EVOLINK_POLL_INTERVAL_MS * 2, usableSplit ? share : deadlineMs);
}
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

export function createOpenAiImageFallbackClient(
  env: {
    OPENAI_API_KEY: string;
    OPENAI_FALLBACK_API_KEY?: string;
    OPENAI_BASE_URL?: string;
  },
  timeoutMs: number = IMAGE_CALL_TIMEOUT_MS
): OpenAI {
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
    timeout: timeoutMs,
    maxRetries: 0
  });
}

// The one fallback, shared by every primary. It was pasted per branch, and the
// copies differed only in a provider name inside an error string, which is how
// the Gemini copy shipped naming Evolink; a tuning applied to the production
// branch would have missed the other in the same way.
async function openAiImageFallback({
  env,
  prompt,
  references,
  noImageErrorMessage,
  deadlineMs,
  startedAt,
  providerName,
  fallbackError
}: {
  env: Parameters<typeof createOpenAiImageFallbackClient>[0] & { OPENAI_IMAGE_MODEL: string };
  prompt: string;
  references: ImageGenerationReference[];
  noImageErrorMessage: string;
  deadlineMs: number | undefined;
  startedAt: number;
  providerName: string;
  fallbackError: string;
}) {
  const fallbackMs = imageCallTimeoutMs(deadlineMs, startedAt);
  // Not started at all below the minimum: a window too small to return a
  // picture only spends the budget the caller still needs to record what it has.
  if (deadlineMs !== undefined && fallbackMs < IMAGE_FALLBACK_MIN_MS) {
    throw new Error(
      `${providerName} image generation failed (${fallbackError}); too little of the request budget remained to try the OpenAI fallback.`
    );
  }
  return generateOpenAiImage({
    client: createOpenAiImageFallbackClient(env, fallbackMs),
    prompt,
    references,
    model: env.OPENAI_IMAGE_MODEL,
    noImageErrorMessage
  });
}

async function generateImageWithConfiguredProvider({
  prompt,
  references,
  noImageErrorMessage,
  // How long the caller can wait for a picture. The providers' own ceilings
  // (300 s of Evolink polling, a 240 s OpenAI call) outlast every route that
  // uses them, so without this a caller's budget is a number it subtracts
  // against and nothing honours. A request the platform kills runs no catch
  // path: its job row stays "running", and the dedupe reads that as a live
  // generation and refuses the shopper a retry for fifteen minutes.
  deadlineMs
}: {
  prompt: string;
  references: ImageGenerationReference[];
  noImageErrorMessage: string;
  deadlineMs?: number;
}): Promise<ImageGenerationAttempt> {
  const env = parseServerEnv(process.env);
  // Taken once, at the top, so every branch measures the caller's deadline from
  // the same moment. RITZY_IMAGE_PROVIDER defaults to "openai", so the branch
  // that ignored deadlineMs entirely is the one a preview deploy or a fresh
  // production project takes.
  const providerStartedAt = Date.now();

  if (env.RITZY_IMAGE_PROVIDER === "evolink") {
    const startedAt = Date.now();

    try {
      return await generateEvolinkImage({
        prompt,
        references: await hardenReferenceUrls(references, env),
        model: env.EVOLINK_IMAGE_MODEL,
        apiKey: env.EVOLINK_API_KEY,
        quality: env.EVOLINK_IMAGE_QUALITY,
        baseUrl: env.EVOLINK_BASE_URL,
        // Everything except the fallback's reserve, when there is room for both.
        pollTimeoutMs: evolinkPollWindowMs(deadlineMs)
      });
    } catch (error) {
      const fallbackError = formatImageGenerationError(error);
      try {
        const fallbackAttempt = await openAiImageFallback({
          env,
          prompt,
          references,
          noImageErrorMessage,
          deadlineMs,
          startedAt,
          providerName: "Evolink",
          fallbackError
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
        location: env.GOOGLE_CLOUD_LOCATION,
        // Every provider is held to the caller's deadline, not to an env
        // constant of its own; a branch that ignores it is a branch that can
        // overrun the route.
        timeoutMs: imageCallTimeoutMs(deadlineMs, providerStartedAt)
      });
    } catch (error) {
      const fallbackError = formatImageGenerationError(error);
      try {
        const fallbackAttempt = await openAiImageFallback({
          env,
          prompt,
          references,
          noImageErrorMessage,
          deadlineMs,
          startedAt,
          providerName: "Gemini",
          fallbackError
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

  // Never floored above what is left. A floor here started a two-minute paid
  // call on a request with forty-five seconds to live, overrunning both the run
  // budget and the route: the platform then kills it with no catch path, and
  // the job row is left running.
  const primaryMs = imageCallTimeoutMs(deadlineMs, providerStartedAt);
  if (deadlineMs !== undefined && primaryMs < IMAGE_FALLBACK_MIN_MS) {
    throw new Error(
      `Too little of the request budget remained to generate an image (${Math.round(primaryMs / 1000)}s left).`
    );
  }
  return generateOpenAiImage({
    client: new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: primaryMs, maxRetries: 0 }),
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
  location,
  timeoutMs
}: {
  prompt: string;
  references: ImageGenerationReference[];
  model: string;
  projectId?: string;
  location: string;
  timeoutMs?: number;
}): Promise<ImageGenerationAttempt> {
  const startedAt = Date.now();
  // The deadline covers EVERYTHING, including the service-account token exchange: a
  // hanging OAuth request must not run outside the Gemini timeout.
  // The caller's remaining budget when it gave one, capped by this provider's
  // own ceiling. An env constant alone is a branch that can outlive its route.
  const ownCeilingMs = Number(process.env.RITZY_GEMINI_TIMEOUT_MS) || 60_000;
  const deadlineMs = timeoutMs === undefined ? ownCeilingMs : Math.max(1_000, Math.min(ownCeilingMs, timeoutMs));
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
  baseUrl,
  pollTimeoutMs
}: {
  prompt: string;
  references: ImageGenerationReference[];
  model: string;
  apiKey?: string;
  quality: "1K" | "2K" | "4K";
  baseUrl: string;
  pollTimeoutMs?: number;
}): Promise<ImageGenerationAttempt> {
  const apiBase = baseUrl;
  if (!apiKey) {
    throw new Error("EVOLINK_API_KEY is required for Evolink image generation.");
  }

  const startedAt = Date.now();
  // One window for the whole exchange: submission, every poll, and the result
  // download. Computed before the first request so none of them sits outside it.
  const pollWindowMs = Math.min(EVOLINK_POLL_TIMEOUT_MS, pollTimeoutMs ?? EVOLINK_POLL_TIMEOUT_MS);
  const deadline = startedAt + pollWindowMs;
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
    // Bounded by what is left of the poll window, not only by its own constant:
    // submission, polling and the result download all happen inside the
    // caller's deadline rather than beside it.
    signal: AbortSignal.timeout(
      Math.max(1_000, Math.min(Number(process.env.RITZY_EVOLINK_SUBMIT_TIMEOUT_MS) || 30_000, deadline - Date.now()))
    ),
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

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, EVOLINK_POLL_INTERVAL_MS));

    let pollResponse: Response;
    try {
      pollResponse = await fetch(`${apiBase}/v1/tasks/${encodeURIComponent(submitPayload.id)}`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(Math.max(1_000, Math.min(15_000, deadline - Date.now())))
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
          signal: AbortSignal.timeout(Math.max(1_000, Math.min(60_000, deadline - Date.now())))
        });
        if (imageResponse.status >= 300 && imageResponse.status < 400) {
          throw new Error("Evolink result URL attempted a redirect; refusing.");
        }
      } else {
        const allowlist = buildReferenceHostAllowlist({
          configured: process.env.RITZY_REFERENCE_IMAGE_HOSTS,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
        });
        // The result download is inside the caller's window too. It was the last
        // stage still carrying its own fixed minute, which meant a run could
        // finish polling on time and then spend two more minutes fetching.
        const budget = evolinkDownloadBudgetMs(deadline);
        if (!budget) {
          throw new Error("Evolink returned a result after the request budget was spent; it was not downloaded.");
        }
        const followed = await followGuardedRedirects(resultUrl, {
          allowlist,
          timeoutMs: budget.timeoutMs,
          overallTimeoutMs: budget.overallTimeoutMs,
          method: "GET"
        });
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

      const readBudget = evolinkDownloadBudgetMs(deadline);
      if (!readBudget) {
        throw new Error("Evolink's result body could not be read inside the request budget.");
      }
      const resultBytes = await readResponseBytesCapped(imageResponse, 30 * 1024 * 1024, readBudget.timeoutMs);
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

  throw new Error(`Evolink image generation timed out after ${Math.round(pollWindowMs / 1000)} seconds.`);
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
  // The candidates are already the per-role pools, so every one of them is
  // listed. Names and descriptions are scraped from retailer HTML into a
  // shared catalogue: they are data, fenced and capped, never instruction.
  const allowedProductIds = new Set(input.candidates.map((candidate) => candidate.id));
  const candidateSummary = input.candidates
    .map((candidate, index) =>
      [
        `${index + 1}. id: ${candidate.id}`,
        `name: ${fenceUntrustedText(candidate.name)}`,
        `retailer: ${fenceUntrustedText(candidate.retailerName, 60)}`,
        `category: ${fenceUntrustedText(candidate.category ?? "unknown", 60)}`,
        candidate.description ? `description: ${fenceUntrustedText(candidate.description, 220)}` : null,
        candidate.salePriceAed ?? candidate.priceAed
          ? `price: AED ${candidate.salePriceAed ?? candidate.priceAed}`
          : null,
        candidate.availability ? `availability: ${fenceUntrustedText(candidate.availability, 40)}` : null,
        candidate.color ? `color: ${fenceUntrustedText(candidate.color, 40)}` : null,
        candidate.material ? `material: ${fenceUntrustedText(candidate.material, 60)}` : null,
        // product_dimensions.source_text is raw scraped page text.
        candidate.dimensions ? `dimensions: ${fenceUntrustedText(candidate.dimensions, 80)}` : null,
        candidate.searchTags?.length
          ? `tags: ${candidate.searchTags.map((tag) => fenceUntrustedText(tag, 30)).filter(Boolean).join(", ")}`
          : null
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
      : /* unreachable: the guard above refuses to run without pools */ "";
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
    { timeout: input.timeoutMs ?? PRODUCT_SOURCING_TIMEOUT_MS }
  );

  const parsed = conceptProductSourcingResponseSchema.parse(JSON.parse(response.output_text));
  const validated = validateProductSourcingRoleContract(parsed, roleCandidatePools, allowedProductIds);

  return {
    promptKey: prompt.key,
    promptVersion: prompt.version,
    model: stageModel,
    textCostUsd: estimateTextCostUsd(stageModel, response.usage),
    ...validated
  };
}

// S3 design check: the product the app is about to present as its own choice,
// judged against the approved render by a pass with no roles to fill. Runs on
// the production vision model by default (model-routing), because the gate
// that asks the same question does.
// The check's own deadline when the caller does not derive one from the
// request budget. The web app's budget reserves the same 90 s for it.
export const PRODUCT_VERIFICATION_TIMEOUT_MS = 90_000;

// Text that reaches a model but did not come from us: a spec label the user
// typed on /spec, a product name scraped from a retailer's HTML. It is DATA,
// never instruction. Quotes, newlines, braces and control characters are
// stripped so it cannot close a field or open a new one, and it is hard
// capped so one poisoned catalogue row cannot flood the context. The design
// check's boolean is the only thing standing between an unverified product
// and the shopper's list, so this matters most there.
export const UNTRUSTED_TEXT_MAX = 140;

export function fenceUntrustedText(value: string | null | undefined, max = UNTRUSTED_TEXT_MAX): string {
  const flattened = (value ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    // Quotes and brackets so a value cannot close the structure it sits in;
    // semicolons and colons because the candidate summary joins fields with
    // them, so a scraped value could otherwise forge the fields beside it.
    .replace(/["'`{}<>\\;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return flattened.length > max ? `${flattened.slice(0, max)}...` : flattened;
}

export type ProductDesignVerificationCandidate = {
  productId: string;
  productName: string;
  roleLabel: string;
  category: string;
  imageDataUrl: string;
};

export type ProductDesignVerificationResult = {
  promptKey: string;
  promptVersion: string;
  model: string;
  textCostUsd: number | null;
  verdicts: Array<{
    productId: string;
    categoryMatches: boolean;
    similarity: number;
    matchedObject: string;
    notes: string;
  }>;
};

// One poisoned product image, on a retailer host we allow, could otherwise
// carry a verdict for every other piece sharing its call. Judging in small
// groups bounds that blast radius; the prompt tells the judge that text inside
// an image is data and speaks only for its own product.
export const PRODUCT_VERIFICATION_BATCH = 4;

// Names and role labels are user- and retailer-supplied. They appear only
// inside a block the system prompt declares to be data; the instruction text
// around each image refers to products by index and id alone, so nothing a
// shopper typed on /spec or a retailer put in a product title can read as an
// instruction to this judge. Exported so the fencing is pinned where it is
// applied, not only as a unit.
export function productDesignVerificationContent(
  products: ProductDesignVerificationCandidate[],
  conceptImageUrl: string,
  threshold: number
): Array<Record<string, unknown>> {
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: JSON.stringify({
        threshold,
        products: products.map((product, index) => ({
          index: index + 1,
          productId: product.productId,
          untrustedProductName: fenceUntrustedText(product.productName),
          untrustedRoleLabel: fenceUntrustedText(product.roleLabel),
          category: fenceUntrustedText(product.category, 60)
        }))
      })
    },
    { type: "input_text", text: "Image 1: the approved concept render every product must belong to." },
    { type: "input_image", image_url: conceptImageUrl, detail: "high" }
  ];
  products.forEach((product, index) => {
    content.push(
      { type: "input_text", text: `Product ${index + 1} (id ${product.productId}).` },
      { type: "input_image", image_url: product.imageDataUrl, detail: "low" }
    );
  });
  return content;
}

export async function verifyProductsAgainstConcept(input: {
  conceptImageUrl: string;
  products: ProductDesignVerificationCandidate[];
  // The bar the judge is anchored to, sent in the payload exactly as the
  // critique harness sends it to its own judge.
  threshold: number;
  timeoutMs?: number;
}): Promise<ProductDesignVerificationResult> {
  if (input.products.length === 0) {
    throw new Error("The design check needs at least one product to judge.");
  }
  if (input.products.length > PRODUCT_VERIFICATION_BATCH) {
    const groups: ProductDesignVerificationCandidate[][] = [];
    for (let index = 0; index < input.products.length; index += PRODUCT_VERIFICATION_BATCH) {
      groups.push(input.products.slice(index, index + PRODUCT_VERIFICATION_BATCH));
    }
    const results = await Promise.all(groups.map((products) => verifyProductsAgainstConcept({ ...input, products })));
    return {
      promptKey: results[0].promptKey,
      promptVersion: results[0].promptVersion,
      model: results[0].model,
      textCostUsd: results.reduce<number | null>(
        (total, result) => (result.textCostUsd === null ? total : (total ?? 0) + result.textCostUsd),
        null
      ),
      verdicts: results.flatMap((result) => result.verdicts)
    };
  }
  const env = parseServerEnv(process.env);
  const client = createTextClient(env);
  const { model: stageModel, requestParams: stageRequestParams } = stageTextConfig("product_verification", env.OPENAI_TEXT_MODEL);

  const content = productDesignVerificationContent(input.products, input.conceptImageUrl, input.threshold);

  const response = await client.responses.create(
    {
      max_output_tokens: 6000,
      ...stageRequestParams,
      input: [
        { role: "system", content: productDesignVerificationPrompt.system },
        { role: "user", content: content as never }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ritzy_product_design_verification",
          schema: productDesignVerificationJsonSchema(input.products.length),
          strict: true
        }
      }
    },
    { timeout: input.timeoutMs ?? PRODUCT_VERIFICATION_TIMEOUT_MS }
  );

  const parsed = productDesignVerificationResponseSchema.parse(JSON.parse(response.output_text));
  const known = new Set(input.products.map((product) => product.productId));
  return {
    promptKey: productDesignVerificationPrompt.key,
    promptVersion: productDesignVerificationPrompt.version,
    model: stageModel,
    textCostUsd: estimateTextCostUsd(stageModel, response.usage),
    // A verdict for a product that was never sent is not a verdict.
    verdicts: parsed.products.filter((product) => known.has(product.productId))
  };
}

// The anchor set pass (S3b). One call, before the render, that turns the ranked
// shortlists for a room's hero roles into one SET of real pieces the render is
// then built around.
//
// It is not a second opinion on the ranking. A scorer judges each role's
// candidates alone and cannot see that the sofa it ranked first and the rug it
// ranked first belong to two different rooms; and it can only enforce what the
// brief forbids, never deliver what the brief asks for. Both of those are
// properties of the set, which is what this call is shown.
//
// Its deadline is its own rather than borrowed from the design check's: it runs
// inside the concept generation request, ahead of an image generation that can
// itself take two minutes, so it has to be the cheap part of that budget.
export const ANCHOR_SET_TIMEOUT_MS = 60_000;

// What one call may see. Five candidates for each of four roles is twenty
// product photographs beside the room's own; more buys little, because the
// shortlist is already de-duplicated by product family, and every extra image
// is context the room photograph has to compete with. Enforced here rather
// than trusted to the caller, because the caller is what grows.
export const ANCHOR_SET_MAX_CANDIDATES_PER_ROLE = 5;
export const ANCHOR_SET_MAX_ROLES = 6;

export type AnchorSetCandidate = {
  productId: string;
  name: string;
  retailerName: string | null;
  color: string | null;
  material: string | null;
  priceAed: number | null;
  imageDataUrl: string;
};

export type AnchorSetRoleInput = {
  roleKey: string;
  roleLabel: string;
  category: string;
  candidates: AnchorSetCandidate[];
};

export type AnchorSetBriefInput = {
  roomType: string;
  styleSlugs?: string[];
  styleNotes?: string | null;
  colorNotes?: string | null;
  inspirationNotes?: string | null;
  functionalRequirements?: string | null;
  avoidNotes?: string | null;
};

export type AnchorSetPick = { roleKey: string; productId: string; reason: string };

export type AnchorSetResult = {
  promptKey: string;
  promptVersion: string;
  model: string;
  textCostUsd: number | null;
  picks: AnchorSetPick[];
  // Answers that did not survive validation. Empty on a healthy call; anything
  // here means the pass answered for roles the caller then could not use, which
  // is a protocol problem and not a taste one.
  dropped: AnchorSetDrop[];
  setNote: string;
};

// Everything a shopper typed and everything a retailer published reaches this
// call inside one JSON block the prompt declares to be data, under untrusted
// keys. The instruction text beside each image names its role and product id
// and nothing else, so no catalogue row can address the stylist. Exported so
// the fencing is pinned where it is applied, not only as a unit.
export function anchorSetSelectionContent(
  inputRoles: AnchorSetRoleInput[],
  brief: AnchorSetBriefInput,
  roomPhotoUrl: string
): Array<Record<string, unknown>> {
  // The caps live here, at the point the payload is built, so they hold for
  // every caller of this exported builder and not only for selectAnchorSet.
  const roles = inputRoles
    .slice(0, ANCHOR_SET_MAX_ROLES)
    .map((role) => ({ ...role, candidates: role.candidates.slice(0, ANCHOR_SET_MAX_CANDIDATES_PER_ROLE) }));

  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: JSON.stringify({
        untrustedBrief: {
          roomType: fenceUntrustedText(brief.roomType, 60),
          styles: (brief.styleSlugs ?? []).slice(0, 8).map((slug) => fenceUntrustedText(slug, 40)).filter(Boolean),
          style: fenceUntrustedText(brief.styleNotes, 400),
          colour: fenceUntrustedText(brief.colorNotes, 400),
          inspiration: fenceUntrustedText(brief.inspirationNotes, 400),
          function: fenceUntrustedText(brief.functionalRequirements, 400),
          avoid: fenceUntrustedText(brief.avoidNotes, 400)
        },
        roles: roles.map((role) => ({
          roleKey: role.roleKey,
          category: fenceUntrustedText(role.category, 60),
          untrustedRoleLabel: fenceUntrustedText(role.roleLabel),
          candidates: role.candidates.map((candidate, index) => ({
            index: index + 1,
            productId: candidate.productId,
            untrustedName: fenceUntrustedText(candidate.name),
            untrustedRetailer: fenceUntrustedText(candidate.retailerName, 60),
            untrustedColour: fenceUntrustedText(candidate.color, 40),
            untrustedMaterial: fenceUntrustedText(candidate.material, 60),
            priceAed: candidate.priceAed
          }))
        }))
      })
    },
    { type: "input_text", text: "Image 1: the room as it is today. Every chosen piece has to live in it." },
    { type: "input_image", image_url: roomPhotoUrl, detail: "high" }
  ];
  roles.forEach((role) => {
    role.candidates.forEach((candidate) => {
      content.push(
        { type: "input_text", text: `Role ${role.roleKey}, product id ${candidate.productId}.` },
        { type: "input_image", image_url: candidate.imageDataUrl, detail: "low" }
      );
    });
  });
  return content;
}

export type AnchorSetDrop = AnchorSetPick & { dropped: "not_offered_for_role" | "role_already_answered" | "product_already_used" };

// A pass that names a product for a role it was never offered in, answers twice
// for one role, or puts one product in two roles has not chosen a set. Each of
// those picks is dropped rather than failing the whole call, so a confused
// response degrades to a smaller set instead of a contradictory one.
//
// The drops come back with it. A role the stylist DECLINED and a role whose
// answer we threw away are the same thing to a caller that only sees survivors,
// and they are not the same thing at all: the first is the pass working, the
// second is the pass having no effect while still being paid for. A protocol
// regression that dropped every pick in every room would otherwise look exactly
// like a stylist that liked nothing.
export function validateAnchorSetPicks(
  roles: ReadonlyArray<{ roleKey: string; candidates: ReadonlyArray<{ productId: string }> }>,
  picks: ReadonlyArray<AnchorSetPick>
): { kept: AnchorSetPick[]; dropped: AnchorSetDrop[] } {
  const offered = new Map(
    roles.map((role) => [role.roleKey, new Set(role.candidates.map((candidate) => candidate.productId))])
  );
  const usedRoles = new Set<string>();
  const usedProducts = new Set<string>();
  const kept: AnchorSetPick[] = [];
  const dropped: AnchorSetDrop[] = [];
  for (const pick of picks) {
    if (!offered.get(pick.roleKey)?.has(pick.productId)) {
      dropped.push({ ...pick, dropped: "not_offered_for_role" });
      continue;
    }
    if (usedRoles.has(pick.roleKey)) {
      dropped.push({ ...pick, dropped: "role_already_answered" });
      continue;
    }
    if (usedProducts.has(pick.productId)) {
      dropped.push({ ...pick, dropped: "product_already_used" });
      continue;
    }
    usedRoles.add(pick.roleKey);
    usedProducts.add(pick.productId);
    kept.push(pick);
  }
  return { kept, dropped };
}

// What the constrained decoder is allowed to name. Deduped, because a role
// contract can admit a product another role also admits and a JSON Schema enum
// with a repeated value is invalid; the validator still catches one product
// answering for two roles. Exported so the dedupe is pinned where it is
// applied, not only through a call that needs a provider.
export function anchorSetSelectionEnums(
  roles: ReadonlyArray<{ roleKey: string; candidates: ReadonlyArray<{ productId: string }> }>
): { roleKeyEnum: string[]; productIdEnum: string[] } {
  return {
    roleKeyEnum: Array.from(new Set(roles.map((role) => role.roleKey))),
    productIdEnum: Array.from(new Set(roles.flatMap((role) => role.candidates.map((candidate) => candidate.productId))))
  };
}

export async function selectAnchorSet(input: {
  roomPhotoUrl: string;
  brief: AnchorSetBriefInput;
  roles: AnchorSetRoleInput[];
  timeoutMs?: number;
}): Promise<AnchorSetResult> {
  // Empty roles are dropped here; the caps are applied by the payload builder,
  // and this list is trimmed the same way so the schema's enums describe
  // exactly what the payload shows.
  const roles = input.roles
    .filter((role) => role.candidates.length > 0)
    .slice(0, ANCHOR_SET_MAX_ROLES)
    .map((role) => ({ ...role, candidates: role.candidates.slice(0, ANCHOR_SET_MAX_CANDIDATES_PER_ROLE) }));

  if (roles.length === 0) {
    throw new Error("The anchor set pass needs at least one role with candidates.");
  }

  const env = parseServerEnv(process.env);
  const client = createTextClient(env);
  const { model: stageModel, requestParams: stageRequestParams } = stageTextConfig("anchor_set", env.OPENAI_TEXT_MODEL);

  const content = anchorSetSelectionContent(roles, input.brief, input.roomPhotoUrl);
  const enums = anchorSetSelectionEnums(roles);

  const response = await client.responses.create(
    {
      max_output_tokens: 4000,
      ...stageRequestParams,
      input: [
        { role: "system", content: anchorSetSelectionPrompt.system },
        { role: "user", content: content as never }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ritzy_anchor_set_selection",
          schema: anchorSetSelectionJsonSchema(enums.roleKeyEnum, enums.productIdEnum),
          strict: true
        }
      }
    },
    { timeout: input.timeoutMs ?? ANCHOR_SET_TIMEOUT_MS }
  );

  const parsed = anchorSetSelectionResponseSchema.parse(JSON.parse(response.output_text));
  const validated = validateAnchorSetPicks(roles, parsed.picks);
  return {
    promptKey: anchorSetSelectionPrompt.key,
    promptVersion: anchorSetSelectionPrompt.version,
    model: stageModel,
    textCostUsd: estimateTextCostUsd(stageModel, response.usage),
    picks: validated.kept,
    dropped: validated.dropped,
    setNote: parsed.setNote
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
        text: `Candidate product image for id ${candidate.id}: ${fenceUntrustedText(candidate.name)}`
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
      )
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

  // The honest gap is derived from the statuses, by the caller, from
  // roleResults; there is no second list to reconcile.
  return { selectedProducts, roleResults: validRoleResults };
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
      // A score belongs to the piece it was given for: keep it only when the
      // repaired entry names the same product, else leave the pick unscored
      // so it can never clear the bar and be chosen for the shopper.
      similarity:
        existing?.productId === selection.productId && typeof existing.similarity === "number" ? existing.similarity : 0,
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


function missingRoleResult(role: ConceptProductSourcingRolePool, reason: string) {
  return {
    category: role.category,
    roleLabel: role.roleLabel,
    status: role.priority === "required" ? ("missing_required" as const) : ("missing_supporting" as const),
    productId: null,
    similarity: 0,
    reason,
    synthesized: true as const
  };
}

function sourcingRoleKey(category: string, roleLabel: string) {
  return `${category}::${roleLabel}`.toLowerCase().replace(/[^a-z0-9:]+/g, "_");
}

// The images the render is built from, in the order the prompt describes them.
// Exported because it IS the anchoring mechanism: the prompt tells the model
// that the last N images are the pieces to keep, so the order, the count and
// the "required" flags are not incidental to this slice, they are the slice.
// A change here that silently dropped the anchors would leave every other part
// of the pipeline intact — the pass paid for, the pieces persisted, the list
// claiming they are in the design — around a render that never saw them.
export function initialConceptReferences(
  input: Pick<
    GenerateInitialConceptInput,
    "roomPhotoBytes" | "roomPhotoMimeType" | "roomPhotoUrl" | "roomPhotoReferenceUrl" | "additionalRoomPhotos" | "anchorProducts"
  >
): ImageGenerationReference[] {
  return [
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
    })),
    // Anchors come last so the prompt can refer to "the last N images", and
    // each is required: a render that silently dropped one would be a render
    // of furniture the shopper is not buying.
    ...(input.anchorProducts ?? []).map((product, index) => ({
      bytes: product.bytes,
      mimeType: product.mimeType,
      name: `anchor-${index + 1}`,
      // Never a URL. See the input type: these bytes are already fetched and
      // guarded, and a link is only a way back to the provider fallback.
      url: null,
      required: true
    }))
  ];
}

// The prompt and the pictures, built together, because they only work together:
// the prompt says "the LAST N input images are the pieces to keep" and the
// references are what makes that sentence true. Split across two call sites,
// either half could be severed with every test still green — and both were,
// which is the one failure the rest of the pipeline cannot detect. It keeps
// paying for the anchor pass, writing concept_anchors, skipping those roles in
// sourcing and judging them at the anchor bar, around a render that never saw
// them.
export function initialConceptImagePayload(
  input: GenerateInitialConceptInput,
  generationPrompt: string
): { prompt: string; references: ImageGenerationReference[] } {
  return {
    prompt: buildInitialConceptImagePrompt({
      generationPrompt,
      roomType: input.roomType,
      hasInspirationImages: Boolean(input.inspirationImageUrls?.length),
      styleSlugs: input.styleSlugs,
      strictSourceRoomPreservation: localStrictSourceRoomPreservationEnabled(),
      spatialIntent: input.spatialIntent ?? null,
      measurements: input.measurements ?? null,
      additionalRoomPhotoCount: input.additionalRoomPhotos?.length ?? 0,
      anchorProducts: (input.anchorProducts ?? []).map((product) => ({ roleLabel: product.roleLabel }))
    }),
    references: initialConceptReferences(input)
  };
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

  // The caller's deadline covers this call as well as the picture. It was
  // documented as covering "the direction call and the image generation" and
  // bounded only the second, so a slow direction call pushed the image past the
  // route limit; the platform kills the request with no catch path and the job
  // is left "running", which the dedupe reads as a live run and refuses the
  // shopper a retry for fifteen minutes.
  const renderStartedAt = Date.now();
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
  }, {
    // A third of the render's budget, so a slow direction call cannot eat the
    // picture's share. Its own 90 s ceiling still applies when the caller sets
    // no deadline.
    timeout:
      input.imageDeadlineMs === undefined ? undefined : Math.max(15_000, Math.floor(input.imageDeadlineMs / 3))
  });

  const direction = initialConceptResponseSchema.parse(JSON.parse(directionResponse.output_text));
  const { prompt: imagePrompt, references } = initialConceptImagePayload(input, direction.concept.generationPrompt);

  const imageResult = await generateImageWithConfiguredProvider({
    prompt: imagePrompt,
    references,
    noImageErrorMessage: "OpenAI image generation returned no image data.",
    // What is left of it after the direction call.
    deadlineMs:
      input.imageDeadlineMs === undefined
        ? undefined
        : Math.max(0, input.imageDeadlineMs - (Date.now() - renderStartedAt))
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

// The palette call's own deadline when the caller does not derive one from a
// request budget.
export const CONCEPT_PALETTE_TIMEOUT_MS = 45_000;

export type ExtractConceptImagePaletteInput = {
  // Data URL or fetchable URL of the generated concept image.
  imageUrl: string;
  // Provider deadline for this call, derived by the caller from the time its
  // request has left. Without one, a slow call keeps running and keeps
  // spending after a local race has discarded its result.
  timeoutMs?: number;
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

  // A caller-derived deadline the SDK actually enforces. Racing a promise
  // locally would let the request keep running and keep spending after its
  // result was discarded, and carry the run past the route's budget.
  const response = await client.responses.create(
    {
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
    },
    { timeout: input.timeoutMs ?? CONCEPT_PALETTE_TIMEOUT_MS }
  );

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
