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
  conceptRevisionPrompt,
  initialConceptJsonSchema,
  initialConceptPrompt,
  initialConceptResponseSchema,
  finalGroundedRenderPrompt,
  productMetadataEnrichmentJsonSchema,
  productMetadataEnrichmentPrompt
} from "@ritzy-studio/prompts";
import { createHash } from "node:crypto";
import OpenAI, { toFile } from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GenerateClarifyingQuestionsInput = {
  roomType: string;
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

export type GenerateInitialConceptInput = {
  roomType: string;
  roomPhotoUrl: string;
  roomPhotoBytes: Buffer;
  roomPhotoMimeType: string;
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
  roomPhotoBytes: Buffer;
  roomPhotoMimeType: string;
  conceptTitle: string;
  conceptDescription?: string | null;
  products: Array<{
    name: string;
    retailerName: string;
    category: string;
    priceAed?: number | null;
    dimensions?: string | null;
    imageBytes?: Buffer | null;
    imageMimeType?: string | null;
  }>;
};

export type GenerateFinalGroundedRenderResult = {
  promptKey: string;
  promptVersion: string;
  imageModel: string;
  imageBase64: string;
  revisedPrompt?: string | null;
};

export async function generateClarifyingQuestions(
  input: GenerateClarifyingQuestionsInput
): Promise<GenerateClarifyingQuestionsResult> {
  const env = parseServerEnv(process.env);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: env.OPENAI_TEXT_MODEL,
    input: [
      {
        role: "system",
        content: clarifyingQuestionsPrompt.system
      },
      {
        role: "user",
        content: JSON.stringify(input)
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

  return {
    promptKey: clarifyingQuestionsPrompt.key,
    promptVersion: clarifyingQuestionsPrompt.version,
    model: env.OPENAI_TEXT_MODEL,
    questions: parsed.questions
  };
}

export async function generateInitialConcept(
  input: GenerateInitialConceptInput
): Promise<GenerateInitialConceptResult> {
  const env = parseServerEnv(process.env);
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const brief = {
    roomType: input.roomType,
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
        content: initialConceptPrompt.system
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
          }
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
  const roomFile = await toFile(input.roomPhotoBytes, `room.${extensionForMime(input.roomPhotoMimeType)}`, {
    type: input.roomPhotoMimeType
  });

  const imagePrompt = [
    direction.concept.generationPrompt,
    "",
    "Use the uploaded room photo as the base image.",
    "Preserve visible architecture, walls, windows, doors, ceiling details, AC vents, sockets, built-ins, and fixed bathroom fixtures where present.",
    "Redesign movable furniture, lighting, textiles, accessories, and decor according to the concept direction.",
    "Keep the result realistic and residential. Do not add text labels, prices, product names, or retailer claims."
  ].join("\n");

  const imageResponse = await client.images.edit({
    model: env.OPENAI_IMAGE_MODEL,
    image: roomFile,
    prompt: imagePrompt,
    size: "1536x1024",
    quality: "medium",
    output_format: "png"
  });

  const firstImage = imageResponse.data?.[0];
  const imageBase64 = firstImage?.b64_json;

  if (!imageBase64) {
    throw new Error("OpenAI image generation returned no image data.");
  }

  return {
    promptKey: initialConceptPrompt.key,
    promptVersion: initialConceptPrompt.version,
    textModel: env.OPENAI_TEXT_MODEL,
    imageModel: env.OPENAI_IMAGE_MODEL,
    analysis: direction.roomAnalysis,
    concept: direction.concept,
    imageBase64,
    revisedPrompt: firstImage.revised_prompt ?? null
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
  const roomFile = await toFile(input.roomPhotoBytes, `room.${extensionForMime(input.roomPhotoMimeType)}`, {
    type: input.roomPhotoMimeType
  });

  const imagePrompt = [
    direction.concept.generationPrompt,
    "",
    "Use the uploaded original room photo as the base image.",
    "Apply the designer critique while preserving approved qualities from the previous concept.",
    "Preserve visible architecture, walls, windows, doors, ceiling details, AC vents, sockets, built-ins, and fixed bathroom fixtures where present.",
    "Keep the result realistic and residential. Do not add text labels, prices, product names, or retailer claims."
  ].join("\n");

  const imageResponse = await client.images.edit({
    model: env.OPENAI_IMAGE_MODEL,
    image: roomFile,
    prompt: imagePrompt,
    size: "1536x1024",
    quality: "medium",
    output_format: "png"
  });

  const firstImage = imageResponse.data?.[0];
  const imageBase64 = firstImage?.b64_json;

  if (!imageBase64) {
    throw new Error("OpenAI image revision returned no image data.");
  }

  return {
    promptKey: conceptRevisionPrompt.key,
    promptVersion: conceptRevisionPrompt.version,
    textModel: env.OPENAI_TEXT_MODEL,
    imageModel: env.OPENAI_IMAGE_MODEL,
    analysis: direction.roomAnalysis,
    concept: direction.concept,
    imageBase64,
    revisedPrompt: firstImage.revised_prompt ?? null
  };
}

function extensionForMime(mimeType: string) {
  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "jpg";
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
  const roomFile = await toFile(input.roomPhotoBytes, `room.${extensionForMime(input.roomPhotoMimeType)}`, {
    type: input.roomPhotoMimeType
  });
  const productFiles = await Promise.all(
    input.products
      .filter((product) => product.imageBytes && product.imageMimeType)
      .slice(0, 8)
      .map((product, index) =>
        toFile(
          product.imageBytes as Buffer,
          `product-${index}.${extensionForMime(product.imageMimeType as string)}`,
          {
            type: product.imageMimeType as string
          }
        )
      )
  );
  const productSummary = input.products
    .map((product, index) =>
      [
        `${index + 1}. ${product.category}: ${product.name}`,
        `retailer: ${product.retailerName}`,
        product.priceAed ? `price: AED ${product.priceAed}` : null,
        product.dimensions ? `dimensions: ${product.dimensions}` : null
      ]
        .filter(Boolean)
        .join("; ")
    )
    .join("\n");
  const prompt = [
    finalGroundedRenderPrompt.system,
    "",
    `Selected concept: ${input.conceptTitle}`,
    input.conceptDescription ? `Concept notes: ${input.conceptDescription}` : null,
    "",
    "Selected catalog products:",
    productSummary,
    "",
    "Generate a polished final client-facing room render. Keep the shopping list as the source of truth; the image is a best-effort visual composition."
  ]
    .filter(Boolean)
    .join("\n");

  const imageResponse = await client.images.edit({
    model: env.OPENAI_IMAGE_MODEL,
    image: [roomFile, ...productFiles],
    prompt,
    size: "1536x1024",
    quality: "medium",
    output_format: "png"
  });
  const firstImage = imageResponse.data?.[0];
  const imageBase64 = firstImage?.b64_json;

  if (!imageBase64) {
    throw new Error("OpenAI final render generation returned no image data.");
  }

  return {
    promptKey: finalGroundedRenderPrompt.key,
    promptVersion: finalGroundedRenderPrompt.version,
    imageModel: env.OPENAI_IMAGE_MODEL,
    imageBase64,
    revisedPrompt: firstImage.revised_prompt ?? null
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
