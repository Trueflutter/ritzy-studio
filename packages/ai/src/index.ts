import { parseServerEnv } from "@ritzy-studio/config";
import {
  clarifyingQuestionsJsonSchema,
  clarifyingQuestionsPrompt,
  clarifyingQuestionsResponseSchema
} from "@ritzy-studio/prompts";
import OpenAI from "openai";

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
