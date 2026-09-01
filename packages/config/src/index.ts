import { z } from "zod";

const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_TEXT_MODEL: z.string().min(1, "OPENAI_TEXT_MODEL is required").default("gpt-5-mini"),
  OPENAI_IMAGE_MODEL: z.string().min(1, "OPENAI_IMAGE_MODEL is required").default("gpt-image-2"),
  RITZY_IMAGE_PROVIDER: z.enum(["gemini", "openai", "evolink"]).default("openai"),
  GEMINI_IMAGE_MODEL: z.string().min(1, "GEMINI_IMAGE_MODEL is required").default("gemini-3.1-flash-image-preview"),
  EVOLINK_API_KEY: z.string().optional(),
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
  RITZY_PRODUCT_MATCHING_ENGINE_V1_CONTROLLED_PREVIEW_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_PROJECT_IDS: z.string().optional(),
  RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_ROOM_IDS: z.string().optional(),
  RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_USER_IDS: z.string().optional(),
  RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_USER_EMAILS: z.string().optional(),
  RITZY_RENDER_EXECUTION: z.enum(["queue", "inline"]).optional(),
  // Comma-separated extra hosts allowed as remote reference-image sources, and hosts
  // whose query strings are stripped before use (defaults live in the ai package's
  // reference guard; these only extend or override them).
  RITZY_REFERENCE_IMAGE_HOSTS: z.string().optional(),
  RITZY_REFERENCE_STRIP_QUERY_HOSTS: z.string().optional(),
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

export type ProductMatchingControlledPreviewGateInput = {
  env: Record<string, string | undefined>;
  projectId?: string | null;
  roomId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
};

export type ProductMatchingControlledPreviewGate = {
  configured: boolean;
  enabled: boolean;
  allowed: boolean;
  matchedScopes: Array<"project" | "room" | "user" | "email">;
};

function commaSeparatedValues(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

function commaSeparatedLowercaseValues(value: string | undefined) {
  return new Set(Array.from(commaSeparatedValues(value)).map((entry) => entry.toLowerCase()));
}

export function productMatchingControlledPreviewGate({
  env,
  projectId,
  roomId,
  userId,
  userEmail
}: ProductMatchingControlledPreviewGateInput): ProductMatchingControlledPreviewGate {
  const projectIds = commaSeparatedValues(env.RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_PROJECT_IDS);
  const roomIds = commaSeparatedValues(env.RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_ROOM_IDS);
  const userIds = commaSeparatedValues(env.RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_USER_IDS);
  const userEmails = commaSeparatedLowercaseValues(
    env.RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_USER_EMAILS
  );
  const enabled = env.RITZY_PRODUCT_MATCHING_ENGINE_V1_CONTROLLED_PREVIEW_ENABLED === "true";
  const configured =
    enabled || projectIds.size > 0 || roomIds.size > 0 || userIds.size > 0 || userEmails.size > 0;

  const matchedScopes: ProductMatchingControlledPreviewGate["matchedScopes"] = [];
  if (projectId && projectIds.has(projectId)) {
    matchedScopes.push("project");
  }
  if (roomId && roomIds.has(roomId)) {
    matchedScopes.push("room");
  }
  if (userId && userIds.has(userId)) {
    matchedScopes.push("user");
  }
  if (userEmail && userEmails.has(userEmail.toLowerCase())) {
    matchedScopes.push("email");
  }

  return {
    configured,
    enabled,
    allowed: enabled && matchedScopes.length > 0,
    matchedScopes
  };
}
