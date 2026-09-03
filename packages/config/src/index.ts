import { z } from "zod";

const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_TEXT_MODEL: z.string().min(1, "OPENAI_TEXT_MODEL is required").default("gpt-5-mini"),
  OPENAI_IMAGE_MODEL: z.string().min(1, "OPENAI_IMAGE_MODEL is required").default("gpt-image-2"),
  RITZY_IMAGE_PROVIDER: z.enum(["gemini", "openai", "evolink"]).default("openai"),
  GEMINI_IMAGE_MODEL: z.string().min(1, "GEMINI_IMAGE_MODEL is required").default("gemini-3.1-flash-image-preview"),
  EVOLINK_API_KEY: z.string().optional(),
  // Evolink gateway origin; overridable so tests and the zero-cost E2E suite can stub
  // the image provider the same way OPENAI_BASE_URL allows for text. Empty or blank
  // values resolve to the default.
  EVOLINK_BASE_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
    z.string().default("https://api.evolink.ai")
  ),
  EVOLINK_IMAGE_MODEL: z
    .string()
    .min(1, "EVOLINK_IMAGE_MODEL is required")
    .default("gemini-3.1-flash-image-preview"),
  EVOLINK_IMAGE_QUALITY: z.enum(["1K", "2K", "4K"]).default("1K"),
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
  RITZY_PRODUCT_REFERENCE_ORDERING_V2_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  RITZY_RENDER_EXECUTION: z.enum(["queue", "inline"]).optional(),
  // Visual sourcing image budget (S3): candidate product images shown to the
  // visual pass per spec role and in total, at low detail. Unset uses the
  // defaults below; "0" disables images (ranking-only sourcing) and is never
  // the default, so "visual" sourcing is visual unless someone turns it off.
  RITZY_PRODUCT_SOURCING_IMAGES_PER_ROLE: z.string().optional(),
  RITZY_PRODUCT_SOURCING_IMAGE_TOTAL: z.string().optional(),
  // Comma-separated extra hosts allowed as remote reference-image sources, and hosts
  // whose query strings are stripped before use (defaults live in the ai package's
  // reference guard; these only extend or override them).
  RITZY_REFERENCE_IMAGE_HOSTS: z.string().optional(),
  RITZY_REFERENCE_STRIP_QUERY_HOSTS: z.string().optional(),
  // Client-side deadline (ms) for text/vision provider calls; unset uses the ai
  // package default of 90000.
  RITZY_TEXT_TIMEOUT_MS: z.string().optional(),
  // The OpenAI SDK reads OPENAI_BASE_URL implicitly; declaring it here makes the
  // gateway override visible to validation and to the fallback-credential guard.
  OPENAI_BASE_URL: z.string().optional(),
  // Distinct credential for the api.openai.com image fallback when the primary key
  // belongs to a gateway (OPENAI_BASE_URL set).
  OPENAI_FALLBACK_API_KEY: z.string().optional(),
  RITZY_SIGNUP_ALLOWLIST: z.string().optional(),
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

// Single-source accessors for values that used to be re-read raw (with hand-copied
// defaults) across the app. Each parses exactly one schema field, so the default
// lives in one place: the schema above.
export function configuredTextModel(env: NodeJS.ProcessEnv = process.env): string {
  return serverEnvSchema.shape.OPENAI_TEXT_MODEL.parse(env.OPENAI_TEXT_MODEL);
}

export function configuredImageProvider(env: NodeJS.ProcessEnv = process.env): "gemini" | "openai" | "evolink" {
  return serverEnvSchema.shape.RITZY_IMAGE_PROVIDER.parse(env.RITZY_IMAGE_PROVIDER);
}

export function configuredImageModelName(env: NodeJS.ProcessEnv = process.env): string {
  const provider = configuredImageProvider(env);
  if (provider === "evolink") {
    return serverEnvSchema.shape.EVOLINK_IMAGE_MODEL.parse(env.EVOLINK_IMAGE_MODEL);
  }
  if (provider === "gemini") {
    return serverEnvSchema.shape.GEMINI_IMAGE_MODEL.parse(env.GEMINI_IMAGE_MODEL);
  }
  return serverEnvSchema.shape.OPENAI_IMAGE_MODEL.parse(env.OPENAI_IMAGE_MODEL);
}

export function configuredAppUrl(env: NodeJS.ProcessEnv = process.env): string {
  return serverEnvSchema.shape.NEXT_PUBLIC_APP_URL.parse(env.NEXT_PUBLIC_APP_URL);
}

export function productReferenceOrderingV2Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return serverEnvSchema.shape.RITZY_PRODUCT_REFERENCE_ORDERING_V2_ENABLED.parse(
    env.RITZY_PRODUCT_REFERENCE_ORDERING_V2_ENABLED
  );
}

export const DEFAULT_PRODUCT_SOURCING_IMAGES_PER_ROLE = 4;
export const DEFAULT_PRODUCT_SOURCING_IMAGE_TOTAL = 32;

function nonNegativeIntegerEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function productSourcingImageBudget(env: NodeJS.ProcessEnv = process.env): {
  perRole: number;
  total: number;
} {
  return {
    perRole: nonNegativeIntegerEnv(env.RITZY_PRODUCT_SOURCING_IMAGES_PER_ROLE, DEFAULT_PRODUCT_SOURCING_IMAGES_PER_ROLE),
    total: nonNegativeIntegerEnv(env.RITZY_PRODUCT_SOURCING_IMAGE_TOTAL, DEFAULT_PRODUCT_SOURCING_IMAGE_TOTAL)
  };
}

export function formatEnvError(error: unknown): string {
  if (!(error instanceof z.ZodError)) {
    return "Unknown environment validation error.";
  }

  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
}

export type RenderExecutionMode = "queue" | "inline";

// Where the final render executes after generateFinalRenderAction inserts the job.
// "queue" = durable Vercel Queues consumer (only exists on Vercel infra);
// "inline" = the in-request after() task (local dev, harness, and the production
// fallback when enqueueing fails). RITZY_RENDER_EXECUTION is the explicit override
// and the production kill-switch; without it, queue on Vercel, inline elsewhere.
export function renderExecutionMode(
  env: Record<string, string | undefined> = process.env
): RenderExecutionMode {
  if (env.RITZY_RENDER_EXECUTION === "queue" || env.RITZY_RENDER_EXECUTION === "inline") {
    return env.RITZY_RENDER_EXECUTION;
  }
  return env.VERCEL ? "queue" : "inline";
}

// Who may create an account. RITZY_SIGNUP_ALLOWLIST is a comma-separated mix of full email
// addresses and domains (with or without a leading @); "*" opens signup to everyone. Unset,
// it preserves the original internal-pilot gate: ritzyinteriors.com only.
export function signupAllowed(
  email: string,
  env: Record<string, string | undefined> = process.env
): boolean {
  const normalized = email.trim().toLowerCase();
  // Exactly one @ with non-empty local and domain parts: values like
  // "foo@ritzyinteriors.com@evil.com" or "@ritzyinteriors.com" must never resolve to an
  // allowlisted domain, regardless of what downstream auth would do with them.
  const parts = normalized.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }
  const domain = parts[1];
  const entries = (env.RITZY_SIGNUP_ALLOWLIST ?? "ritzyinteriors.com")
    .split(",")
    .map((entry) => entry.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  return entries.some((entry) => entry === "*" || entry === normalized || entry === domain);
}

