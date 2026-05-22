import { z } from "zod";

const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_TEXT_MODEL: z.string().min(1, "OPENAI_TEXT_MODEL is required").default("gpt-5-mini"),
  OPENAI_IMAGE_MODEL: z.string().min(1, "OPENAI_IMAGE_MODEL is required").default("gpt-image-2"),
  RITZY_IMAGE_PROVIDER: z.enum(["gemini", "openai"]).default("openai"),
  GEMINI_IMAGE_MODEL: z.string().min(1, "GEMINI_IMAGE_MODEL is required").default("gemini-3.1-flash-image-preview"),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().min(1, "GOOGLE_CLOUD_LOCATION is required").default("global"),
  GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64: z.string().optional(),
  OPENAI_EMBEDDING_MODEL: z
    .string()
    .min(1, "OPENAI_EMBEDDING_MODEL is required")
    .default("text-embedding-3-small"),
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  NEXT_PUBLIC_APP_URL: z.url("NEXT_PUBLIC_APP_URL must be a valid URL").default("http://localhost:3000"),
  RITZY_INTERIOR_PROMPT_V2_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  RITZY_FINAL_RENDER_PROMPT_V2_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  RITZY_PRODUCT_REFERENCE_ORDERING_V2_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional()
});

const clientEnvSchema = serverEnvSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
  NEXT_PUBLIC_APP_URL: true
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

export function parseServerEnv(env: NodeJS.ProcessEnv): ServerEnv {
  return serverEnvSchema.parse(env);
}

export function parseClientEnv(env: NodeJS.ProcessEnv): ClientEnv {
  return clientEnvSchema.parse(env);
}

export function formatEnvError(error: unknown): string {
  if (!(error instanceof z.ZodError)) {
    return "Unknown environment validation error.";
  }

  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
}
