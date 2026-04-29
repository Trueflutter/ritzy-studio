import { parseServerEnv } from "@ritzy-studio/config";
import {
  clarifyingQuestionsJsonSchema,
  clarifyingQuestionsPrompt,
  clarifyingQuestionsResponseSchema,
  initialConceptJsonSchema,
  initialConceptPrompt,
  initialConceptResponseSchema,
  conceptRevisionPrompt
} from "@ritzy-studio/prompts";
import OpenAI, { toFile } from "openai";

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
