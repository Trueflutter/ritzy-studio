"use server";

import {
  analyzeInspirationImages,
  generateClarifyingQuestions,
  assessRenderSpatialQuality,
  extractConceptImagePalette,
  generateConceptRevision,
  generateConceptView,
  generateFinalGroundedRender,
  generateInitialConcept,
  sourceProductsFromConcept,
  spatialQaCorrectionLanguage,
  type ConceptViewKey
} from "@ritzy-studio/ai";
import type { Database } from "@ritzy-studio/db";
import {
  createHomeownerRoomSchema,
  createProjectSchema,
  createRoomSchema,
  designBriefSchema,
  assessAestheticFitForRole,
  buildRoleScopedCandidatePools,
  buildProductSourcingRuntimePlan,
  buildShoppingListItemRows,
  buildPersistedSelectionSnapshot,
  composeRoomProductOptions,
  conceptPaletteMatchingText,
  deriveSpatialDesignerWarnings,
  normalizeCatalogFirstRoomType,
  parseConceptImagePalette,
  parseSpatialIntent,
  filterSubstitutionCandidates,
  enhancedProductRolesForRoom,
  normalizeProductMatchRoleResultCategory,
  buildProductMatchVisualSourcingEvidence,
  productMatchConfidenceOutputSummary,
  productMatchQaStopRuleOutputSummary,
  productMatchRequiredRoleDescriptor,
  productRolesForRoom,
  rankProductMatches,
  renderReferencePriorityForProduct,
  selectedItemsTotalAed,
  setUserModeSchema,
  sortProductsForRenderReferences,
  scopedCategoriesForProductRole,
  substitutionModeSchema,
  summarizeRolePoolDiversity,
  summarizeRolePoolQuality,
  summarizePoolQaRollup,
  visualStyleOptions,
  visualStyleSummary,
  type RankedProductMatch,
  type ProductMatchCandidate,
  type ProductRefreshDiversityHistory,
  type RoleProductOptions,
  type RoleScopedCandidatePool,
  type RoomProductRoleSpec
} from "@ritzy-studio/domain";
import { productMatchingControlledPreviewGate } from "@ritzy-studio/config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import sharp from "sharp";

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { FINAL_RENDER_STALE_MS } from "@/lib/render";
import {
  appUrl,
  DESIGNER_MONTHLY_AMOUNT_USD,
  getStripe,
  HOMEOWNER_ROOM_UNLOCK_AMOUNT_AED
} from "@/lib/billing/stripe";
import {
  buildProductImagePreflightGate,
  preflightProductCandidateImages,
  type ProductImagePreflightSummary
} from "./product-image-preflight";
import {
  classifyProductSourcingFailure,
  isProviderImageDownloadError,
  isProductSourcingTimeoutError,
  productSourcingGenericFailureMessage,
  productSourcingTimeoutMessage
} from "./product-sourcing-failure";
import { buildProductSourcingTextFallbackResult } from "./product-sourcing-text-fallback";
import { buildProductSourcingTimeoutDiagnostics } from "./product-sourcing-timeout-diagnostics";
import {
  productSourcingRetryFallbackEvidenceForStrategy,
  productSourcingVisualStrategy
} from "./product-sourcing-visual-strategy";
import {
  inspirationAnalysisContinueDecision,
  INSPIRATION_ANALYSIS_CONTINUE_FAILURE_MESSAGE
} from "./inspiration-analysis-continue";

const PRODUCT_SOURCING_AI_TIMEOUT_MS = 45_000;
const PRODUCT_MATCHING_CATALOG_LIMIT = 1500;
const PRODUCT_SOURCING_IMAGE_PREFLIGHT_TIMEOUT_MS = 2_500;
const PRODUCT_SOURCING_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const PRODUCT_SOURCING_AI_CONCEPT_IMAGE_DETAIL = "low" as const;
const PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT = 0;
const PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_DETAIL = "low" as const;
const PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED = PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT > 0;
const CATALOGUE_GROUNDED_CONCEPT_ANCHOR_LIMIT = 6;
const CATALOGUE_GROUNDED_CONCEPT_PRODUCTS_PER_CATEGORY = 300;
const CATALOGUE_GROUNDED_CONCEPT_CANDIDATES_PER_ROLE = 12;
const CATALOGUE_GROUNDED_CONCEPT_FLAT_CANDIDATE_LIMIT = 48;
const CATALOGUE_GROUNDED_CONCEPT_MIN_ATTRIBUTE_TOTAL = 35;
// Real catalogue reference images (Home Centre media CDN) are frequently 2-3 MB and take longer
// than a couple of seconds to download. At 2.5s the largest-image roles (rugs especially) had
// EVERY candidate time out ("without a fetchable reference image"), which blocked the whole
// concept ("we need a little more catalogue evidence"). The grounding loop breaks on the first
// fetchable candidate, so a longer ceiling keeps the happy path fast while rescuing large images.
const CATALOGUE_GROUNDED_CONCEPT_IMAGE_FETCH_TIMEOUT_MS = 12_000;
// Per-image timeout is generous (large catalogue images), so bound the WHOLE grounding: without a
// ceiling, a role whose top candidates all have unfetchable images would fetch each sequentially
// (~24.75s incl. retry) and could stall the synchronous concept action for minutes. Once this
// wall-clock budget is spent, stop evaluating further candidates and block fast instead. The happy
// path (first candidate resolves in a few seconds) never approaches it.
const CATALOGUE_GROUNDED_CONCEPT_IMAGE_FETCH_BUDGET_MS = 90_000;
const CATALOGUE_GROUNDED_CONCEPT_USER_SAFE_BLOCK_MESSAGE =
  "We need a little more catalogue evidence before building this room direction. Try broadening the style or colour notes, then generate again.";
const CATALOGUE_GROUNDED_CONCEPT_REFERENCE_IMAGE_BLOCK_MESSAGE =
  "We found catalogue pieces for this room, but their reference images are not ready yet. Try again in a moment.";
const LOCAL_SKU_FIDELITY_CANDIDATES_PER_ROLE = 18;
const LOCAL_SKU_FIDELITY_RENDER_REFERENCE_LIMIT = 12;
const INTERNAL_PILOT_SIGNUP_MESSAGE =
  "Internal pilot. Only ritzyinteriors.com email domains currently permitted";

function productReferenceOrderingV2Enabled() {
  return process.env.RITZY_PRODUCT_REFERENCE_ORDERING_V2_ENABLED === "true";
}

const CONCEPT_VIEW_KEYS: ConceptViewKey[] = ["reverse_wide", "anchor_detail"];

// Downscaled data URLs for the candidate images an AI sourcing call will see.
// Fetched app-side (with retry) so the vision provider never has to download
// from rate-limited retailer CDNs or non-public storage hosts.
async function sourcingCandidateImageDataUrls(
  candidates: Array<{ id: string; primaryImageUrl?: string | null }>,
  limit: number
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    candidates.slice(0, limit).map(async (candidate) => {
      if (!candidate.primaryImageUrl) {
        return null;
      }
      const image = await fetchRemoteImage(candidate.primaryImageUrl);
      if (!image) {
        return null;
      }
      return [candidate.id, await visionImageDataUrl(image.bytes, image.mimeType)] as const;
    })
  );
  return Object.fromEntries(entries.filter((entry): entry is [string, string] => Boolean(entry)));
}

// Product ids the user has already kept in OTHER rooms. Matching demotes (not
// excludes) them so the same anchor pieces stop reappearing across projects
// while thin pools can still fall back to them.
async function recentlyUsedProductIdsForUser({
  serviceSupabase,
  userId,
  excludeRoomId
}: {
  serviceSupabase: ReturnType<typeof createServiceClient>;
  userId: string;
  excludeRoomId: string;
}): Promise<string[]> {
  const { data, error } = await serviceSupabase
    .from("shopping_list_items")
    .select(
      "product_id, shopping_list:shopping_lists!inner(room_id, room:rooms!inner(project:projects!inner(owner_user_id)))"
    )
    .eq("shopping_list.room.project.owner_user_id", userId)
    .neq("shopping_list.room_id", excludeRoomId)
    .eq("status", "selected")
    .limit(600);

  if (error || !data) {
    return [];
  }

  return Array.from(new Set(data.map((row) => row.product_id).filter(Boolean)));
}

// Generates the additional camera angles for a stored concept and records them as
// concept-linked room assets. Runs inside after(): view failures must never fail
// the concept itself, so each view is best-effort.
async function generateAndStoreConceptViews({
  serviceSupabase,
  userId,
  roomId,
  conceptId,
  roomType,
  conceptTitle,
  conceptDescription,
  conceptGenerationPrompt,
  heroImageBytes,
  heroImageStoragePath
}: {
  serviceSupabase: ReturnType<typeof createServiceClient>;
  userId: string;
  roomId: string;
  conceptId: string;
  roomType: string;
  conceptTitle: string;
  conceptDescription?: string | null;
  conceptGenerationPrompt?: string | null;
  heroImageBytes: Buffer;
  heroImageStoragePath: string;
}) {
  const { data: signedHero } = await serviceSupabase.storage
    .from("generated-renders")
    .createSignedUrl(heroImageStoragePath, 60 * 30);

  // Tracked as an ai_job so silent failures are observable and retryable; the
  // two views generate in parallel to stay well inside the task lifetime.
  const { data: viewsJob } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: userId,
      room_id: roomId,
      job_type: "concept_views",
      status: "running",
      provider: configuredImageProvider(),
      model: configuredImageModel(),
      input_summary: { conceptId, viewKeys: CONCEPT_VIEW_KEYS }
    })
    .select("id")
    .single();

  const outcomes = await Promise.all(
    CONCEPT_VIEW_KEYS.map(async (viewKey) => {
      try {
        const view = await generateConceptView({
          roomType,
          viewKey,
          conceptTitle,
          conceptDescription,
          conceptGenerationPrompt,
          heroImageBytes,
          heroImageMimeType: "image/png",
          heroImageUrl: signedHero?.signedUrl ?? null
        });
        const viewPath = `${userId}/${roomId}/${conceptId}-${viewKey}.png`;
        const { error: uploadError } = await serviceSupabase.storage
          .from("generated-renders")
          .upload(viewPath, Buffer.from(view.imageBase64, "base64"), {
            contentType: "image/png",
            upsert: true
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { error: assetError } = await serviceSupabase.from("room_assets").insert({
          room_id: roomId,
          asset_type: "concept_render",
          storage_path: viewPath,
          mime_type: "image/png",
          is_primary: false,
          concept_id: conceptId,
          view_key: viewKey
        });

        if (assetError) {
          throw new Error(assetError.message);
        }

        return { viewKey, ok: true as const, provider: view.imageProvider, fallbackUsed: view.imageFallbackUsed };
      } catch (error) {
        console.error(`Concept view generation failed (${viewKey}, concept ${conceptId}):`, error);
        return {
          viewKey,
          ok: false as const,
          error: error instanceof Error ? error.message : "Concept view generation failed."
        };
      }
    })
  );

  if (viewsJob) {
    const failed = outcomes.filter((outcome) => !outcome.ok);
    await serviceSupabase
      .from("ai_jobs")
      .update({
        // Any missing view is a failed job: partial success must stay visible
        // and retryable by status, not silently ship a one-view concept.
        status: failed.length > 0 ? "failed" : "succeeded",
        completed_at: new Date().toISOString(),
        error_message: failed.length > 0 ? failed.map((outcome) => `${outcome.viewKey}: ${outcome.error}`).join("; ") : null,
        output_summary: { conceptId, outcomes }
      })
      .eq("id", viewsJob.id);
  }
}

function configuredImageProvider() {
  return process.env.RITZY_IMAGE_PROVIDER ?? "openai";
}

function configuredImageModel() {
  const provider = configuredImageProvider();
  if (provider === "evolink") {
    return process.env.EVOLINK_IMAGE_MODEL ?? "gemini-3.1-flash-image-preview";
  }
  if (provider === "gemini") {
    return process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image-preview";
  }
  return process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
}

function productMatchingEngineV1Enabled() {
  return process.env.RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED === "true";
}

function productMatchingEngineV1EnabledForRequest({
  projectId,
  roomId,
  userId,
  userEmail,
  roomType
}: {
  projectId: string;
  roomId: string;
  userId: string;
  userEmail?: string | null;
  roomType: string;
}) {
  const engineFlagEnabled = productMatchingEngineV1Enabled();
  const previewGate = productMatchingControlledPreviewGate({
    env: process.env,
    projectId,
    roomId,
    userId,
    userEmail
  });

  return {
    enabled:
      (engineFlagEnabled && (!previewGate.configured || previewGate.allowed)) ||
      localSkuFidelityModeEnabled(roomType),
    gate: previewGate
  };
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : undefined;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function optionalNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "")
    .replace(/,/g, "")
    .trim();
  if (value.length === 0) {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function hasRequiredRoomSize(measurements: {
  wall_length_cm?: number | null;
  room_depth_cm?: number | null;
  ceiling_height_cm?: number | null;
}) {
  return Boolean(
    measurements.wall_length_cm && measurements.room_depth_cm && measurements.ceiling_height_cm
  );
}

type StructuredBriefJson = Record<string, unknown> & {
  visualPreferences?: unknown;
  measurements?: unknown;
  inspirationAnalysis?: unknown;
  spatialIntent?: unknown;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ServiceSupabaseClient = ReturnType<typeof createServiceClient>;
type InspirationAnalysisAsset = { storage_path: string };

function structuredBriefJson(value: unknown): StructuredBriefJson {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as Record<string, unknown>) } as StructuredBriefJson)
    : {};
}

function likedStyleSlugsFromStructuredBrief(value: unknown) {
  const structuredJson = structuredBriefJson(value);
  const visualPreferences = structuredJson.visualPreferences;

  if (!visualPreferences || typeof visualPreferences !== "object" || Array.isArray(visualPreferences)) {
    return [];
  }

  const likedStyleSlugs = (visualPreferences as { likedStyleSlugs?: unknown }).likedStyleSlugs;
  return Array.isArray(likedStyleSlugs)
    ? likedStyleSlugs.filter((slug): slug is string => typeof slug === "string")
    : [];
}

function optionalValueForPresentField<T>(formData: FormData, key: string, value: T | undefined) {
  return formData.has(key) ? (value ?? null) : undefined;
}

function currentAppUrl() {
  return appUrl();
}

function checkoutRedirectUrl(baseUrl: string, returnTo: string | undefined, message: string) {
  const safePath = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  const url = new URL(safePath, baseUrl);
  url.searchParams.set("message", message);
  return url.toString();
}

async function canAccessRoomCommerce(roomId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_access_room_commerce", { room_id: roomId });
  return Boolean(data);
}

async function requireRoomCommerceAccess(roomId: string, redirectPath: string) {
  if (!(await canAccessRoomCommerce(roomId))) {
    redirect(`${redirectPath}?message=${encodeURIComponent("Generate the shopping list to use retailer links and product swaps.")}`);
  }
}

async function hasActiveDesignerSubscription(userId: string) {
  const serviceSupabase = createServiceClient();
  const { data, error } = await serviceSupabase.rpc("has_active_designer_subscription", {
    user_id: userId
  });

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

async function countOwnedRooms(userId: string) {
  const serviceSupabase = createServiceClient();
  const { data: projects, error: projectsError } = await serviceSupabase
    .from("projects")
    .select("id")
    .eq("owner_user_id", userId);

  if (projectsError) {
    throw new Error(projectsError.message);
  }

  const projectIds = (projects ?? []).map((project) => project.id);

  if (projectIds.length === 0) {
    return 0;
  }

  const { count, error: roomsError } = await serviceSupabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .in("project_id", projectIds);

  if (roomsError) {
    throw new Error(roomsError.message);
  }

  return count ?? 0;
}

async function requireDesignerFreeRoomAccess(userId: string, roomId: string, redirectPath: string) {
  const serviceSupabase = createServiceClient();
  const { data: profile, error: profileError } = await serviceSupabase
    .from("user_profiles")
    .select("intended_mode")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const isDesignerMode = profile?.intended_mode === "designer" || profile?.intended_mode === "both";

  if (!isDesignerMode || (await hasActiveDesignerSubscription(userId))) {
    return;
  }

  const { data: projects, error: projectsError } = await serviceSupabase
    .from("projects")
    .select("id")
    .eq("owner_user_id", userId);

  if (projectsError) {
    throw new Error(projectsError.message);
  }

  const projectIds = (projects ?? []).map((project) => project.id);

  if (projectIds.length === 0) {
    return;
  }

  const { data: roomsResult, error: roomsError } = await serviceSupabase
    .from("rooms")
    .select("id")
    .in("project_id", projectIds)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (roomsError) {
    throw new Error(roomsError.message);
  }

  const rooms = roomsResult ?? [];
  const firstRoom = rooms[0];

  if (!firstRoom || firstRoom.id === roomId) {
    return;
  }

  redirect(
    `${redirectPath}?message=${encodeURIComponent(
      "Your free designer room is already in progress. Start the designer plan to generate another room."
    )}`
  );
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = optionalString(formData, "name");

  if (!email.toLowerCase().endsWith("@ritzyinteriors.com")) {
    redirect(`/login?message=${encodeURIComponent(INTERNAL_PILOT_SIGNUP_MESSAGE)}`);
  }

  const supabase = await createClient();

  const signUpResult = await supabase.auth
    .signUp({
      email,
      password,
      options: {
        data: {
          name
        }
      }
    })
    .catch(() => null);

  if (!signUpResult) {
    redirect(`/login?message=${encodeURIComponent(INTERNAL_PILOT_SIGNUP_MESSAGE)}`);
  }

  if (signUpResult.error) {
    redirect(`/login?message=${encodeURIComponent(signUpResult.error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await createClient();

  if (!email) {
    redirect(`/login?message=${encodeURIComponent("Enter your email address to receive a reset link.")}`);
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${currentAppUrl()}/login`
  });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  redirect(
    `/login?message=${encodeURIComponent(
      "If that email has an account, a password reset link has been sent."
    )}`
  );
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function setUserModeAction(formData: FormData) {
  const parsed = setUserModeSchema.parse({
    intendedMode: String(formData.get("intendedMode") ?? "unknown")
  });
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { error: profileError } = await supabase.from("user_profiles").upsert({
    user_id: user.id,
    display_name: user.user_metadata?.name ?? user.email ?? null,
    intended_mode: parsed.intendedMode,
    onboarding_completed_at: new Date().toISOString()
  });

  if (profileError) {
    redirect(`/onboarding?message=${encodeURIComponent(profileError.message)}`);
  }

  if (parsed.intendedMode === "designer" || parsed.intendedMode === "both") {
    const serviceSupabase = createServiceClient();
    const { data: existingDesignerAccount } = await serviceSupabase
      .from("designer_accounts")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();
    const { error: designerError } = existingDesignerAccount
      ? { error: null }
      : await serviceSupabase.from("designer_accounts").insert({
          owner_user_id: user.id,
          subscription_status: "incomplete",
          plan_key: "designer_monthly_usd_99"
        });

    if (designerError) {
      redirect(`/onboarding?message=${encodeURIComponent(designerError.message)}`);
    }
  }

  revalidatePath("/", "layout");
  redirect("/projects/new");
}

export async function createHomeownerRoomAction(formData: FormData) {
  const parsed = createHomeownerRoomSchema.parse({
    roomName: String(formData.get("roomName") ?? "").trim(),
    roomType: String(formData.get("roomType") ?? "").trim(),
    location: optionalString(formData, "location"),
    budgetMaxAed: optionalNumber(formData, "budgetMaxAed")
  });
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const now = new Date().toISOString();
  const { error: profileError } = await supabase.from("user_profiles").upsert({
    user_id: user.id,
    display_name: user.user_metadata?.name ?? user.email ?? null,
    intended_mode: "homeowner",
    onboarding_completed_at: now
  });

  if (profileError) {
    redirect(`/onboarding?message=${encodeURIComponent(profileError.message)}`);
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      owner_user_id: user.id,
      name: parsed.projectName,
      location: parsed.location ?? "Dubai",
      budget_max_aed: parsed.budgetMaxAed ?? null,
      status: "active"
    })
    .select("id")
    .single();

  if (projectError || !project) {
    redirect(`/onboarding?message=${encodeURIComponent(projectError?.message ?? "Project could not be created.")}`);
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      project_id: project.id,
      name: parsed.roomName,
      room_type: parsed.roomType,
      status: "draft"
    })
    .select("id")
    .single();

  if (roomError || !room) {
    redirect(`/onboarding?message=${encodeURIComponent(roomError?.message ?? "Room could not be created.")}`);
  }

  const serviceSupabase = createServiceClient();
  await serviceSupabase.from("entitlement_events").insert({
    user_id: user.id,
    room_id: room.id,
    event_type: "user_mode_set",
    source: "onboarding",
    metadata_json: {
      intended_mode: "homeowner"
    }
  });

  revalidatePath("/", "layout");
  redirect(`/projects/${project.id}/rooms/${room.id}/photos?message=${encodeURIComponent("Room created. Upload photographs to begin.")}`);
}

export async function createHomeownerRoomUnlockCheckoutAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const defaultRedirectPath = `/projects/${projectId}/rooms/${roomId}/shopping-list`;
  const requestedReturnTo = optionalString(formData, "returnTo");
  const redirectPath =
    requestedReturnTo?.startsWith("/") && !requestedReturnTo.startsWith("//")
      ? requestedReturnTo
      : defaultRedirectPath;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, name, project:projects(id, name)")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  if (!room) {
    redirect("/");
  }

  const { data: alreadyEntitled } = await supabase.rpc("can_access_room_commerce", { room_id: roomId });
  if (alreadyEntitled) {
    redirect(`${redirectPath}?message=${encodeURIComponent("This room is already unlocked.")}`);
  }

  const stripe = getStripe();
  const serviceSupabase = createServiceClient();
  const baseUrl = currentAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "aed",
          unit_amount: HOMEOWNER_ROOM_UNLOCK_AMOUNT_AED,
          product_data: {
            name: `Ritzy Studio shopping list — ${room.name}`,
            description: "Generate the final shopping list with retailer links and eligible partner discounts."
          }
        }
      }
    ],
    metadata: {
      type: "room_unlock",
      user_id: user.id,
      room_id: roomId,
      project_id: projectId
    },
    success_url: `${baseUrl}${redirectPath}?message=${encodeURIComponent("Shopping list payment complete.")}`,
    cancel_url: `${baseUrl}${redirectPath}?message=${encodeURIComponent("Shopping list payment cancelled.")}`
  });

  const { data: existingUnlock } = await serviceSupabase
    .from("room_unlocks")
    .select("id, status")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingUnlock?.status === "active") {
    redirect(`${redirectPath}?message=${encodeURIComponent("This room is already unlocked.")}`);
  }

  const unlockMutation = existingUnlock
    ? serviceSupabase
        .from("room_unlocks")
        .update({
          status: "pending",
          price_aed: 500,
          billing_provider: "stripe",
          billing_checkout_id: session.id,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingUnlock.id)
        .neq("status", "active")
    : serviceSupabase.from("room_unlocks").insert({
        room_id: roomId,
        user_id: user.id,
        status: "pending",
        price_aed: 500,
        billing_provider: "stripe",
        billing_checkout_id: session.id
      });

  const { error: unlockError } = await unlockMutation;

  if (unlockError) {
    redirect(`${redirectPath}?message=${encodeURIComponent(unlockError.message)}`);
  }

  if (!session.url) {
    redirect(`${redirectPath}?message=${encodeURIComponent("Stripe checkout could not be created.")}`);
  }

  redirect(session.url);
}

export async function createDesignerSubscriptionCheckoutAction(formData?: FormData) {
  const returnTo = formData ? optionalString(formData, "returnTo") : undefined;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const serviceSupabase = createServiceClient();
  const { data: existingDesignerAccount } = await serviceSupabase
    .from("designer_accounts")
    .select("id, subscription_status")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (existingDesignerAccount?.subscription_status === "active" || existingDesignerAccount?.subscription_status === "trialing") {
    redirect(`/?message=${encodeURIComponent("Your designer subscription is already active.")}`);
  }

  const designerAccountResult = existingDesignerAccount
    ? await serviceSupabase.from("designer_accounts").select("id").eq("id", existingDesignerAccount.id).single()
    : await serviceSupabase
        .from("designer_accounts")
        .insert({
          owner_user_id: user.id,
          subscription_status: "incomplete",
          plan_key: "designer_monthly_usd_99"
        })
        .select("id")
        .single();

  const { data: designerAccount, error: designerError } = designerAccountResult;

  if (designerError || !designerAccount) {
    redirect(`/onboarding?message=${encodeURIComponent(designerError?.message ?? "Designer account could not be prepared.")}`);
  }

  const stripe = getStripe();
  const baseUrl = currentAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: DESIGNER_MONTHLY_AMOUNT_USD,
          recurring: {
            interval: "month"
          },
          product_data: {
            name: "Ritzy Studio Designer",
            description: "Professional project workflow, product-grounded renders, and client presentations."
          }
        }
      }
    ],
    metadata: {
      type: "designer_subscription",
      user_id: user.id,
      designer_account_id: designerAccount.id
    },
    subscription_data: {
      metadata: {
        user_id: user.id,
        designer_account_id: designerAccount.id,
        plan_key: "designer_monthly_usd_99"
      }
    },
    success_url: checkoutRedirectUrl(baseUrl, returnTo, "Designer subscription activated."),
    cancel_url: checkoutRedirectUrl(
      baseUrl,
      returnTo ?? "/onboarding",
      "Designer subscription checkout cancelled."
    )
  });

  if (!session.url) {
    redirect(`/onboarding?message=${encodeURIComponent("Stripe checkout could not be created.")}`);
  }

  redirect(session.url);
}

export async function deleteRoomPhotoAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  const redirectPath = `/projects/${projectId}/rooms/${roomId}/photos`;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  if (!room) {
    redirect("/");
  }

  const { data: asset, error: assetError } = await supabase
    .from("room_assets")
    .select("id, storage_path, is_primary")
    .eq("id", assetId)
    .eq("room_id", roomId)
    .eq("asset_type", "room_photo")
    .single();

  if (assetError || !asset) {
    redirect(`${redirectPath}?message=${encodeURIComponent("The photograph could not be found.")}`);
  }

  const { error: storageError } = await supabase.storage
    .from("room-assets")
    .remove([asset.storage_path]);

  if (storageError) {
    redirect(`${redirectPath}?message=${encodeURIComponent(storageError.message)}`);
  }

  const { error: deleteError } = await supabase
    .from("room_assets")
    .delete()
    .eq("id", asset.id)
    .eq("room_id", roomId);

  if (deleteError) {
    redirect(`${redirectPath}?message=${encodeURIComponent(deleteError.message)}`);
  }

  if (asset.is_primary) {
    const { data: nextAsset } = await supabase
      .from("room_assets")
      .select("id")
      .eq("room_id", roomId)
      .eq("asset_type", "room_photo")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextAsset) {
      await supabase.from("room_assets").update({ is_primary: true }).eq("id", nextAsset.id);
    }
  }

  revalidatePath(redirectPath);
  redirect(`${redirectPath}?message=${encodeURIComponent("Photograph removed.")}`);
}

export async function deleteInspirationImageAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const assetId = String(formData.get("assetId") ?? "");
  const redirectPath = `/projects/${projectId}/rooms/${roomId}/brief/inspiration`;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  if (!room) {
    redirect("/");
  }

  const { data: asset, error: assetError } = await supabase
    .from("room_assets")
    .select("id, storage_path")
    .eq("id", assetId)
    .eq("room_id", roomId)
    .eq("asset_type", "inspiration_image")
    .single();

  if (assetError || !asset) {
    redirect(`${redirectPath}?message=${encodeURIComponent("The inspiration photo could not be found.")}`);
  }

  const { error: storageError } = await supabase.storage
    .from("room-assets")
    .remove([asset.storage_path]);

  if (storageError) {
    redirect(`${redirectPath}?message=${encodeURIComponent(storageError.message)}`);
  }

  const { error: deleteError } = await supabase
    .from("room_assets")
    .delete()
    .eq("id", asset.id)
    .eq("room_id", roomId);

  if (deleteError) {
    redirect(`${redirectPath}?message=${encodeURIComponent(deleteError.message)}`);
  }

  revalidatePath(redirectPath);
  redirect(redirectPath);
}

export async function createProjectAction(formData: FormData) {
  const parsed = createProjectSchema.parse({
    name: String(formData.get("name") ?? "").trim(),
    clientName: optionalString(formData, "clientName"),
    location: optionalString(formData, "location"),
    budgetMinAed: optionalNumber(formData, "budgetMinAed"),
    budgetMaxAed: optionalNumber(formData, "budgetMaxAed")
  });

  if (
    parsed.budgetMinAed !== undefined &&
    parsed.budgetMaxAed !== undefined &&
    parsed.budgetMinAed > parsed.budgetMaxAed
  ) {
    redirect(
      `/projects/new?message=${encodeURIComponent(
        "Budget minimum must be less than or equal to budget maximum."
      )}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("intended_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile || profile.intended_mode === "unknown") {
    redirect("/onboarding");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      owner_user_id: user.id,
      name: parsed.name,
      client_name: parsed.clientName ?? null,
      location: parsed.location ?? null,
      budget_min_aed: parsed.budgetMinAed ?? null,
      budget_max_aed: parsed.budgetMaxAed ?? null,
      status: "active"
    })
    .select("id")
    .single();

  if (projectError) {
    throw new Error(projectError.message);
  }

  revalidatePath("/");
  redirect(`/projects/${project.id}/rooms/new`);
}

export async function createRoomAction(formData: FormData) {
  const rawName = String(formData.get("name") ?? "").trim();
  const rawRoomType = String(formData.get("roomType") ?? "").trim();

  const parsed = createRoomSchema.parse({
    projectId: String(formData.get("projectId") ?? "").trim(),
    name: rawName || rawRoomType,
    roomType: rawRoomType
  });

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_user_id")
    .eq("id", parsed.projectId)
    .maybeSingle();

  if (projectError) {
    throw new Error(projectError.message);
  }

  if (!project || project.owner_user_id !== user.id) {
    redirect("/");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("intended_mode")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profile || profile.intended_mode === "unknown") {
    redirect("/onboarding");
  }

  const isDesignerMode = profile.intended_mode === "designer" || profile.intended_mode === "both";
  const designerIsSubscribed = isDesignerMode ? await hasActiveDesignerSubscription(user.id) : false;
  const existingRoomCount = isDesignerMode ? await countOwnedRooms(user.id) : 0;

  if (isDesignerMode && !designerIsSubscribed && existingRoomCount >= 1) {
    redirect(
      `/projects/${parsed.projectId}/rooms/new?message=${encodeURIComponent(
        "Your free designer room is already in progress. Start the designer plan to create another room."
      )}`
    );
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      project_id: project.id,
      name: rawName || parsed.roomType,
      room_type: parsed.roomType,
      status: "draft"
    })
    .select("id")
    .single();

  if (roomError) {
    throw new Error(roomError.message);
  }

  revalidatePath("/");
  redirect(`/projects/${project.id}/rooms/${room.id}/photos`);
}

export async function saveDesignBriefAction(formData: FormData) {
  const briefStep = String(formData.get("briefStep") ?? "details");
  const nextPath = String(formData.get("nextPath") ?? "");
  const parsed = designBriefSchema.parse({
    projectId: String(formData.get("projectId") ?? ""),
    roomId: String(formData.get("roomId") ?? ""),
    roomType: String(formData.get("roomType") ?? ""),
    styleSlugs: formData.getAll("styleSlugs").map(String),
    avoidStyleSlugs: formData.getAll("avoidStyleSlugs").map(String),
    styleNotes: optionalString(formData, "styleNotes"),
    colorNotes: optionalString(formData, "colorNotes"),
    budgetNotes: optionalString(formData, "budgetNotes"),
    functionalRequirements: optionalString(formData, "functionalRequirements"),
    avoidNotes: optionalString(formData, "avoidNotes"),
    inspirationNotes: optionalString(formData, "inspirationNotes"),
    wallLengthCm: optionalNumber(formData, "wallLengthCm"),
    roomDepthCm: optionalNumber(formData, "roomDepthCm"),
    ceilingHeightCm: optionalNumber(formData, "ceilingHeightCm"),
    measurementNotes: optionalString(formData, "measurementNotes")
  });

  const briefRootPath = `/projects/${parsed.projectId}/rooms/${parsed.roomId}/brief`;
  const redirectPath = nextPath.startsWith(briefRootPath)
    ? nextPath
    : `${briefRootPath}/details`;
  const submittedDetailsStep = briefStep === "details";

  if (
    submittedDetailsStep &&
    (!parsed.wallLengthCm || !parsed.roomDepthCm || !parsed.ceilingHeightCm)
  ) {
    redirect(
      `${briefRootPath}/details?message=${encodeURIComponent(
        "Room measurements are required before we can design and size furniture for this room."
      )}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", parsed.roomId)
    .eq("project_id", parsed.projectId)
    .single();

  if (!room) {
    redirect("/");
  }

  const hasMeasurements =
    parsed.wallLengthCm !== undefined ||
    parsed.roomDepthCm !== undefined ||
    parsed.ceilingHeightCm !== undefined ||
    parsed.measurementNotes !== undefined;

  const selectedStyleSummary = visualStyleSummary(parsed.styleSlugs);
  const avoidedStyleSummary = parsed.avoidStyleSlugs.length
    ? visualStyleOptions
        .filter((option) => parsed.avoidStyleSlugs.includes(option.slug))
        .map((option) => option.name)
        .join(", ")
    : null;
  const resolvedStyleNotes = [
    selectedStyleSummary ? `Selected visual styles: ${selectedStyleSummary}` : null,
    parsed.styleNotes ?? null,
    avoidedStyleSummary ? `Avoid styles: ${avoidedStyleSummary}.` : null
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data: existingBrief } = await supabase
    .from("design_briefs")
    .select("*")
    .eq("room_id", parsed.roomId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const structuredJson = structuredBriefJson(existingBrief?.structured_json);

  if (formData.has("styleSlugs") || formData.has("avoidStyleSlugs")) {
    structuredJson.visualPreferences = {
      likedStyleSlugs: parsed.styleSlugs,
      avoidedStyleSlugs: parsed.avoidStyleSlugs,
      likedStyles: visualStyleOptions
        .filter((option) => parsed.styleSlugs.includes(option.slug))
        .map((option) => ({
          slug: option.slug,
          name: option.name,
          description: option.description,
          tags: option.tags
        })),
      avoidedStyles: visualStyleOptions
        .filter((option) => parsed.avoidStyleSlugs.includes(option.slug))
        .map((option) => ({
          slug: option.slug,
          name: option.name
        }))
    };
  }

  if (hasMeasurements) {
    structuredJson.measurements = {
      wallLengthCm: parsed.wallLengthCm ?? null,
      roomDepthCm: parsed.roomDepthCm ?? null,
      ceilingHeightCm: parsed.ceilingHeightCm ?? null,
      notes: parsed.measurementNotes ?? null,
      source: "manual",
      confidence: "verified"
    };
  }

  if (
    formData.has("focalPoint") ||
    formData.has("seatingPriority") ||
    formData.has("diningSeatCount") ||
    formData.has("mustKeepClear")
  ) {
    const existingIntent =
      structuredJson.spatialIntent && typeof structuredJson.spatialIntent === "object"
        ? (structuredJson.spatialIntent as Record<string, unknown>)
        : {};
    const diningSeatCountRaw = optionalNumber(formData, "diningSeatCount");
    structuredJson.spatialIntent = {
      ...existingIntent,
      ...(formData.has("focalPoint") ? { focalPoint: optionalString(formData, "focalPoint") ?? null } : {}),
      ...(formData.has("seatingPriority")
        ? { seatingPriority: optionalString(formData, "seatingPriority") ?? null }
        : {}),
      ...(formData.has("diningSeatCount") ? { diningSeatCount: diningSeatCountRaw ?? null } : {}),
      ...(formData.has("mustKeepClear")
        ? { mustKeepClear: optionalString(formData, "mustKeepClear") ?? null }
        : {})
    };
  }

  const briefPayload: Database["public"]["Tables"]["design_briefs"]["Update"] & {
    room_id: string;
  } = {
    room_id: parsed.roomId,
    structured_json: structuredJson as Database["public"]["Tables"]["design_briefs"]["Update"]["structured_json"]
  };

  if (formData.has("styleSlugs") || formData.has("avoidStyleSlugs") || formData.has("styleNotes")) {
    briefPayload.style_notes = resolvedStyleNotes || null;
  }

  const colorNotes = optionalValueForPresentField(formData, "colorNotes", parsed.colorNotes);
  const budgetNotes = optionalValueForPresentField(formData, "budgetNotes", parsed.budgetNotes);
  const functionalRequirements = optionalValueForPresentField(
    formData,
    "functionalRequirements",
    parsed.functionalRequirements
  );
  const avoidNotes = optionalValueForPresentField(formData, "avoidNotes", parsed.avoidNotes);
  const inspirationNotes = optionalValueForPresentField(formData, "inspirationNotes", parsed.inspirationNotes);

  if (colorNotes !== undefined) briefPayload.color_notes = colorNotes;
  if (budgetNotes !== undefined) briefPayload.budget_notes = budgetNotes;
  if (functionalRequirements !== undefined) briefPayload.functional_requirements = functionalRequirements;
  if (avoidNotes !== undefined) briefPayload.avoid_notes = avoidNotes;
  if (inspirationNotes !== undefined) briefPayload.inspiration_notes = inspirationNotes;

  const briefResult = existingBrief
    ? await supabase
        .from("design_briefs")
        .update(briefPayload)
        .eq("id", existingBrief.id)
        .select("id")
        .single()
    : await supabase.from("design_briefs").insert(briefPayload).select("id").single();

  if (briefResult.error) {
    throw new Error(briefResult.error.message);
  }

  const designBriefId = briefResult.data.id;

  if (hasMeasurements) {
    const { error: measurementError } = await supabase.from("room_measurements").insert({
      room_id: parsed.roomId,
      source: "manual",
      confidence: "verified",
      wall_length_cm: parsed.wallLengthCm ?? null,
      room_depth_cm: parsed.roomDepthCm ?? null,
      ceiling_height_cm: parsed.ceilingHeightCm ?? null,
      notes: parsed.measurementNotes ?? null
    });

    if (measurementError) {
      throw new Error(measurementError.message);
    }
  }

  await supabase.from("rooms").update({ status: "briefing" }).eq("id", parsed.roomId);

  if (briefStep === "inspiration") {
    try {
      await ensureInspirationAnalysisBeforeDetails({
        roomId: parsed.roomId,
        supabase,
        userId: user.id
      });
    } catch {
      redirect(
        `${redirectPath}?message=${encodeURIComponent(
          INSPIRATION_ANALYSIS_CONTINUE_FAILURE_MESSAGE
        )}`
      );
    }
  }

  if (briefStep !== "details") {
    revalidatePath(briefRootPath);
    redirect(redirectPath);
  }

  const { data: inspirationAssets = [] } = await supabase
    .from("room_assets")
    .select("storage_path")
    .eq("room_id", parsed.roomId)
    .eq("asset_type", "inspiration_image")
    .order("created_at", { ascending: true })
    .limit(6);

  const signedInspirationUrls = (
    await Promise.all(
      (inspirationAssets ?? []).map((asset) =>
        storageImageDataUrl(supabase, "room-assets", asset.storage_path)
      )
    )
  ).filter((url): url is string => Boolean(url));

  const serviceSupabase = createServiceClient();
  const { data: profile } = await serviceSupabase
    .from("user_profiles")
    .select("intended_mode")
    .eq("user_id", user.id)
    .maybeSingle();
  const currentStyleNotes =
    formData.has("styleSlugs") || formData.has("avoidStyleSlugs") || formData.has("styleNotes")
      ? (briefPayload.style_notes ?? null)
      : (existingBrief?.style_notes ?? null);
  const currentColorNotes = formData.has("colorNotes")
    ? (briefPayload.color_notes ?? null)
    : (existingBrief?.color_notes ?? null);
  const currentBudgetNotes = formData.has("budgetNotes")
    ? (briefPayload.budget_notes ?? null)
    : (existingBrief?.budget_notes ?? null);
  const currentFunctionalRequirements = formData.has("functionalRequirements")
    ? (briefPayload.functional_requirements ?? null)
    : (existingBrief?.functional_requirements ?? null);
  const currentAvoidNotes = formData.has("avoidNotes")
    ? (briefPayload.avoid_notes ?? null)
    : (existingBrief?.avoid_notes ?? null);
  const currentInspirationNotes = formData.has("inspirationNotes")
    ? (briefPayload.inspiration_notes ?? null)
    : (existingBrief?.inspiration_notes ?? null);

  const inputSummary = {
    roomType: parsed.roomType,
    intendedMode: profile?.intended_mode ?? "unknown",
    styleNotes: currentStyleNotes,
    colorNotes: currentColorNotes,
    budgetNotes: currentBudgetNotes,
    hasMeasurements,
    inspirationAssetCount: signedInspirationUrls.length
  };

  const { data: job, error: jobError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: user.id,
      room_id: parsed.roomId,
      job_type: "clarifying_questions",
      status: "running",
      provider: "openai",
      model: process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini",
      prompt_version: null,
      input_summary: inputSummary
    })
    .select("id")
    .single();

  if (jobError) {
    throw new Error(jobError.message);
  }

  let shouldGenerateAfterBrief = false;

  try {
    const result = await generateClarifyingQuestions({
      roomType: parsed.roomType,
      intendedMode: profile?.intended_mode ?? "unknown",
      inspirationImageUrls: signedInspirationUrls,
      styleNotes: currentStyleNotes || undefined,
      colorNotes: currentColorNotes || undefined,
      budgetNotes: currentBudgetNotes || undefined,
      functionalRequirements: currentFunctionalRequirements || undefined,
      avoidNotes: currentAvoidNotes || undefined,
      inspirationNotes: currentInspirationNotes || undefined,
      measurements: hasMeasurements
        ? {
            wallLengthCm: parsed.wallLengthCm,
            roomDepthCm: parsed.roomDepthCm,
            ceilingHeightCm: parsed.ceilingHeightCm,
            notes: parsed.measurementNotes
          }
        : undefined
    });

    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        model: result.model,
        prompt_version: result.promptVersion,
        output_summary: {
          promptKey: result.promptKey,
          questionCount: result.questions.length
        }
      })
      .eq("id", job.id);

    await supabase.from("clarifying_questions").delete().eq("design_brief_id", designBriefId);

    if (result.questions.length > 0) {
      const generatedAt = Date.now();
      const { error: questionsError } = await supabase.from("clarifying_questions").insert(
        result.questions.map((question, index) => ({
          created_at: new Date(generatedAt + index).toISOString(),
          design_brief_id: designBriefId,
          question: question.question,
          status: "open" as const
        }))
      );

      if (questionsError) {
        throw new Error(questionsError.message);
      }
    }

    shouldGenerateAfterBrief = result.questions.length === 0;
  } catch (error) {
    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Clarifying question generation failed."
      })
      .eq("id", job.id);

    redirect(`${briefRootPath}/details?message=${encodeURIComponent("Brief saved. Clarifying questions could not be generated yet.")}`);
  }

  revalidatePath(briefRootPath);
  if (shouldGenerateAfterBrief) {
    redirect(`/projects/${parsed.projectId}/rooms/${parsed.roomId}/concepts?autogenerate=1`);
  }

  redirect(`${briefRootPath}/questions/0`);
}

export async function saveClarifyingAnswersAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const updates = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("answer:"))
    .map(([key, value]) => ({
      id: key.replace("answer:", ""),
      answer: String(value ?? "").trim()
    }))
    .filter((update) => update.id.length > 0);

  for (const update of updates) {
    await supabase
      .from("clarifying_questions")
      .update({
        answer: update.answer.length > 0 ? update.answer : null,
        status: update.answer.length > 0 ? "answered" : "open",
        answered_at: update.answer.length > 0 ? new Date().toISOString() : null
      })
      .eq("id", update.id);
  }

  const redirectPath = `/projects/${projectId}/rooms/${roomId}/brief`;
  revalidatePath(redirectPath);
  redirect(`${redirectPath}?message=${encodeURIComponent("Clarifying answers saved.")}`);
}

export async function saveClarifyingQuestionAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const questionId = String(formData.get("questionId") ?? "");
  const currentIndex = Number(formData.get("currentIndex") ?? "0");
  const questionCount = Number(formData.get("questionCount") ?? "0");
  const answer = String(formData.get("answer") ?? "").trim();
  const skip = String(formData.get("skip") ?? "") === "1";
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  if (!room || !questionId) {
    redirect("/");
  }

  await supabase
    .from("clarifying_questions")
    .update({
      answer: !skip && answer.length > 0 ? answer : null,
      status: !skip && answer.length > 0 ? "answered" : "skipped",
      answered_at: !skip && answer.length > 0 ? new Date().toISOString() : null
    })
    .eq("id", questionId);

  const nextIndex = currentIndex + 1;
  const questionsRoot = `/projects/${projectId}/rooms/${roomId}/brief/questions`;
  revalidatePath(questionsRoot);

  if (nextIndex >= questionCount) {
    redirect(`/projects/${projectId}/rooms/${roomId}/concepts?autogenerate=1`);
  }

  redirect(`${questionsRoot}/${nextIndex}`);
}

export async function analyzeInspirationAction(roomId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Sign in to analyze inspiration images.");
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .single();

  if (!room) {
    throw new Error("Room not found.");
  }

  await analyzeAndWriteInspirationForRoom({
    roomId,
    serviceSupabase: createServiceClient(),
    supabase,
    userId: user.id
  });
}

async function ensureInspirationAnalysisBeforeDetails({
  roomId,
  supabase,
  userId
}: {
  roomId: string;
  supabase: SupabaseServerClient;
  userId: string;
}) {
  const { data: existingBrief } = await supabase
    .from("design_briefs")
    .select("structured_json")
    .eq("room_id", roomId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: inspirationAssets = [] } = await supabase
    .from("room_assets")
    .select("storage_path")
    .eq("room_id", roomId)
    .eq("asset_type", "inspiration_image")
    .order("created_at", { ascending: true })
    .limit(6);

  const decision = inspirationAnalysisContinueDecision({
    inspirationAssetCount: inspirationAssets?.length ?? 0,
    structuredJson: existingBrief?.structured_json
  });

  if (decision !== "run_analysis") {
    return;
  }

  await analyzeAndWriteInspirationForRoom({
    inspirationAssets: inspirationAssets ?? [],
    requireSignedUrls: true,
    roomId,
    serviceSupabase: createServiceClient(),
    supabase,
    userId
  });
}

// AI vision calls receive storage images as data URLs instead of signed URLs:
// signed URLs can expire mid-flow and are unreachable from the provider when the
// storage host is not public (e.g. local development). The bytes are small and
// already one storage read away.
async function storageImageDataUrl(
  client: ServiceSupabaseClient | SupabaseServerClient,
  bucket: string,
  path: string,
  mimeType?: string | null
) {
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) {
    return null;
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const contentType = mimeType ?? (data.type || "image/jpeg");
  return visionImageDataUrl(buffer, contentType);
}

function bytesToDataUrl(bytes: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

// Vision models tile images at ~1k px; sending multi-megabyte originals only
// adds cost, latency, and gateway cost-estimate rejections. Downscale for
// vision inputs; image-GENERATION references keep original bytes.
async function visionImageDataUrl(bytes: Buffer, mimeType: string) {
  try {
    const resized = await sharp(bytes)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    return `data:image/jpeg;base64,${resized.toString("base64")}`;
  } catch {
    return bytesToDataUrl(bytes, mimeType);
  }
}

async function analyzeAndWriteInspirationForRoom({
  inspirationAssets,
  requireSignedUrls = false,
  roomId,
  serviceSupabase,
  supabase,
  userId
}: {
  inspirationAssets?: InspirationAnalysisAsset[];
  requireSignedUrls?: boolean;
  roomId: string;
  serviceSupabase: ServiceSupabaseClient;
  supabase: SupabaseServerClient;
  userId: string;
}) {
  const assets = inspirationAssets ?? (await listInspirationAnalysisAssets({ roomId, supabase }));

  const signedUrls = (
    await Promise.all(
      assets.map((asset) => storageImageDataUrl(supabase, "room-assets", asset.storage_path))
    )
  ).filter((url): url is string => Boolean(url));

  if (signedUrls.length === 0) {
    if (requireSignedUrls && assets.length > 0) {
      throw new Error("Inspiration images could not be prepared for analysis.");
    }
    return;
  }

  const { data: job, error: jobError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: userId,
      room_id: roomId,
      job_type: "inspiration_analysis",
      status: "running",
      provider: "openai",
      model: process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini",
      prompt_version: null,
      input_summary: { inspirationAssetCount: signedUrls.length }
    })
    .select("id")
    .single();

  if (jobError) {
    throw new Error(jobError.message);
  }

  try {
    const result = await analyzeInspirationImages({ imageUrls: signedUrls });
    const { data: existingBrief } = await supabase
      .from("design_briefs")
      .select("id, structured_json")
      .eq("room_id", roomId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const structuredJson = structuredBriefJson(existingBrief?.structured_json);
    structuredJson.inspirationAnalysis = result.analysis;

    const payload = {
      room_id: roomId,
      structured_json: structuredJson as Database["public"]["Tables"]["design_briefs"]["Update"]["structured_json"]
    };

    const writeResult = existingBrief
      ? await supabase.from("design_briefs").update(payload).eq("id", existingBrief.id)
      : await supabase.from("design_briefs").insert(payload);

    if (writeResult.error) {
      throw new Error(writeResult.error.message);
    }

    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        model: result.model,
        prompt_version: result.promptVersion,
        output_summary: {
          promptKey: result.promptKey,
          palette: result.analysis.palette,
          materials: result.analysis.materials
        }
      })
      .eq("id", job.id);
  } catch (error) {
    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Inspiration analysis failed."
      })
      .eq("id", job.id);

    throw error;
  }
}

async function listInspirationAnalysisAssets({
  roomId,
  supabase
}: {
  roomId: string;
  supabase: SupabaseServerClient;
}): Promise<InspirationAnalysisAsset[]> {
  const { data: inspirationAssets = [] } = await supabase
    .from("room_assets")
    .select("storage_path")
    .eq("room_id", roomId)
    .eq("asset_type", "inspiration_image")
    .order("created_at", { ascending: true })
    .limit(6);

  return inspirationAssets ?? [];
}

export async function generateInitialConceptAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const redirectPath = `/projects/${projectId}/rooms/${roomId}/concepts`;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  if (!room) {
    redirect("/");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, budget_max_aed")
    .eq("id", projectId)
    .single();

  if (!project) {
    redirect("/");
  }

  await requireDesignerFreeRoomAccess(user.id, roomId, redirectPath);

  const { data: designBrief } = await supabase
    .from("design_briefs")
    .select("*")
    .eq("room_id", roomId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!designBrief) {
    redirect(`/projects/${projectId}/rooms/${roomId}/brief`);
  }

  const { data: existingConcept } = await supabase
    .from("concepts")
    .select("id")
    .eq("room_id", roomId)
    .eq("design_brief_id", designBrief.id)
    .in("status", ["generated", "selected"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingConcept) {
    redirect(`${redirectPath}?message=${encodeURIComponent("Initial concept already generated.")}`);
  }

  const { data: roomPhotos = [] } = await supabase
    .from("room_assets")
    .select("*")
    .eq("room_id", roomId)
    .eq("asset_type", "room_photo")
    .order("created_at", { ascending: true })
    .limit(3);
  const roomPhoto = roomPhotos?.[0] ?? null;
  const additionalRoomPhotoAssets = (roomPhotos ?? []).slice(1);

  if (!roomPhoto) {
    redirect(`/projects/${projectId}/rooms/${roomId}/photos`);
  }

  const serviceSupabase = createServiceClient();
  const runningSince = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: runningConceptJob } = await serviceSupabase
    .from("ai_jobs")
    .select("id")
    .eq("room_id", roomId)
    .eq("job_type", "initial_concept_generation")
    .eq("status", "running")
    .gte("created_at", runningSince)
    .contains("input_summary", { designBriefId: designBrief.id })
    .limit(1)
    .maybeSingle();

  if (runningConceptJob) {
    redirect(`${redirectPath}?message=${encodeURIComponent("Concept generation is already running.")}`);
  }

  const { data: signedPhoto } = await supabase.storage
    .from("room-assets")
    .createSignedUrl(roomPhoto.storage_path, 60 * 30);

  const { data: inspirationAssets = [] } = await supabase
    .from("room_assets")
    .select("id, storage_path")
    .eq("room_id", roomId)
    .eq("asset_type", "inspiration_image")
    .order("created_at", { ascending: true })
    .limit(6);

  const signedInspirationUrls = (
    await Promise.all(
      (inspirationAssets ?? []).map((asset) =>
        storageImageDataUrl(supabase, "room-assets", asset.storage_path)
      )
    )
  ).filter((url): url is string => Boolean(url));

  const { data: photoBlob, error: downloadError } = await supabase.storage
    .from("room-assets")
    .download(roomPhoto.storage_path);

  if (!signedPhoto?.signedUrl || downloadError || !photoBlob) {
    redirect(`${redirectPath}?message=${encodeURIComponent("The room photo could not be prepared for generation.")}`);
  }

  const additionalRoomPhotos = (
    await Promise.all(
      additionalRoomPhotoAssets.map(async (asset) => {
        const { data: blob, error: blobError } = await supabase.storage
          .from("room-assets")
          .download(asset.storage_path);
        if (blobError || !blob) {
          return null;
        }
        const bytes = Buffer.from(await blob.arrayBuffer());
        const { data: signed } = await supabase.storage
          .from("room-assets")
          .createSignedUrl(asset.storage_path, 60 * 30);
        return {
          url: await visionImageDataUrl(bytes, asset.mime_type),
          referenceUrl: signed?.signedUrl ?? null,
          bytes,
          mimeType: asset.mime_type
        };
      })
    )
  ).filter((photo): photo is NonNullable<typeof photo> => Boolean(photo));

  const { data: floorPlanAsset } = await supabase
    .from("room_assets")
    .select("storage_path, mime_type")
    .eq("room_id", roomId)
    .eq("asset_type", "floor_plan")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const floorPlanImageUrl = floorPlanAsset?.mime_type?.startsWith("image/")
    ? await storageImageDataUrl(supabase, "room-assets", floorPlanAsset.storage_path, floorPlanAsset.mime_type)
    : null;

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Measurements no longer hard-gate generation: a user who just wants to snap a
  // photo still gets a concept, with the missing-scale assumption recorded and
  // surfaced instead of a dead end.
  const measurementsMissing = !measurements || !hasRequiredRoomSize(measurements);

  const spatialIntent = parseSpatialIntent(designBrief.structured_json, room.room_type);
  const spatialWarnings = deriveSpatialDesignerWarnings({
    roomType: normalizeCatalogFirstRoomType(room.room_type),
    intent: spatialIntent,
    measurements: measurements
      ? {
          wallLengthCm: measurements.wall_length_cm,
          roomDepthCm: measurements.room_depth_cm,
          ceilingHeightCm: measurements.ceiling_height_cm,
          source: measurements.source,
          confidence: measurements.confidence
        }
      : null
  });
  const spatialAssumptions = [
    ...(spatialIntent.assumptions ?? []),
    ...(measurementsMissing
      ? ["Room measurements were not provided; furniture scale is directional until dimensions are added."]
      : [])
  ];

  const { data: answeredQuestions = [] } = await supabase
    .from("clarifying_questions")
    .select("question, answer")
    .eq("design_brief_id", designBrief.id)
    .eq("status", "answered")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const catalogueGroundingPlan = await buildCatalogueGroundedConceptPlan({
    serviceSupabase,
    roomType: room.room_type,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? {
          wallLengthCm: measurements.wall_length_cm,
          roomDepthCm: measurements.room_depth_cm
        }
      : null,
    designBrief,
    answeredQuestions: answeredQuestions ?? []
  });

  if (catalogueGroundingPlan.blockers.length > 0) {
    // Record WHY grounding blocked; the user-facing message is deliberately
    // generic, and without this record the blockers are undiagnosable.
    await serviceSupabase.from("ai_jobs").insert({
      user_id: user.id,
      room_id: roomId,
      job_type: "initial_concept_generation",
      status: "failed",
      provider: configuredImageProvider(),
      model: configuredImageModel(),
      error_message: "Catalogue grounding blocked before generation.",
      input_summary: {
        roomId,
        designBriefId: designBrief.id,
        blockers: catalogueGroundingPlan.blockers,
        catalogueGrounding: catalogueGroundingPlan.summary
      }
    });
    redirect(
      `${redirectPath}?message=${encodeURIComponent(CATALOGUE_GROUNDED_CONCEPT_USER_SAFE_BLOCK_MESSAGE)}`
    );
  }

  const catalogueProducts = await Promise.all(
    catalogueGroundingPlan.products.map(async ({ match, role, referenceImage }) => ({
      name: match.name,
      retailerName: match.retailerName,
      category: match.categoryNormalized,
      roleLabel: role.label,
      selectionReason: match.selectionReason,
      description: match.description,
      color: match.color,
      material: match.material,
      styleTags: match.styleTags,
      colorTags: match.colorTags,
      materialTags: match.materialTags,
      dimensions: match.dimensions?.sourceText ?? null,
      primaryImageUrl: match.primaryImageUrl,
      imageBytes: referenceImage.bytes,
      imageMimeType: referenceImage.mimeType,
      visionImageUrl: await visionImageDataUrl(referenceImage.bytes, referenceImage.mimeType)
    }))
  );
  const missingCatalogueReferenceImages = catalogueProducts
    .filter((product) => !product.imageBytes || !product.imageMimeType)
    .map((product) => product.roleLabel);

  if (missingCatalogueReferenceImages.length > 0) {
    redirect(
      `${redirectPath}?message=${encodeURIComponent(
        CATALOGUE_GROUNDED_CONCEPT_REFERENCE_IMAGE_BLOCK_MESSAGE
      )}`
    );
  }

  const { data: job, error: jobError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: user.id,
      room_id: roomId,
      job_type: "initial_concept_generation",
      status: "running",
      provider: configuredImageProvider(),
      model: `${process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini"} + ${configuredImageModel()}`,
      prompt_version: null,
      input_summary: {
        roomId,
        designBriefId: designBrief.id,
        roomPhotoAssetId: roomPhoto.id,
        catalogueGrounding: catalogueGroundingPlan.summary,
        inspirationAssetCount: signedInspirationUrls.length,
        answeredQuestionCount: answeredQuestions?.length ?? 0
      }
    })
    .select("id")
    .single();

  if (jobError) {
    throw new Error(jobError.message);
  }

  try {
    const photoBytes = Buffer.from(await photoBlob.arrayBuffer());
    const result = await generateInitialConcept({
      roomType: room.room_type,
      roomPhotoUrl: await visionImageDataUrl(photoBytes, roomPhoto.mime_type),
      roomPhotoReferenceUrl: signedPhoto.signedUrl,
      roomPhotoBytes: photoBytes,
      roomPhotoMimeType: roomPhoto.mime_type,
      additionalRoomPhotos,
      catalogueProducts,
      inspirationImageUrls: signedInspirationUrls,
      floorPlanImageUrl,
      spatialIntent: {
        focalPoint: spatialIntent.focalPoint,
        seatingPriority: spatialIntent.seatingPriority,
        diningSeatCount: spatialIntent.diningSeatCount,
        mustKeepClear: spatialIntent.mustKeepClear
      },
      styleSlugs: likedStyleSlugsFromStructuredBrief(designBrief.structured_json),
      styleNotes: designBrief.style_notes,
      colorNotes: designBrief.color_notes,
      budgetNotes: designBrief.budget_notes,
      functionalRequirements: designBrief.functional_requirements,
      avoidNotes: designBrief.avoid_notes,
      inspirationNotes: designBrief.inspiration_notes,
      clarifyingAnswers: (answeredQuestions ?? [])
        .filter((question) => question.answer)
        .map((question) => ({
          question: question.question,
          answer: question.answer ?? ""
        })),
      measurements: measurements
        ? {
            wallLengthCm: measurements.wall_length_cm,
            roomDepthCm: measurements.room_depth_cm,
            ceilingHeightCm: measurements.ceiling_height_cm,
            notes: measurements.notes
          }
        : null
    });

    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        provider: result.imageProvider,
        model: `${result.textModel} + ${result.imageModel}`,
        prompt_version: result.promptVersion,
        output_summary: {
          promptKey: result.promptKey,
          title: result.concept.title,
          catalogueGrounding: catalogueGroundingPlan.summary,
          uncertaintyNotes: result.analysis.uncertaintyNotes,
          revisedPrompt: result.revisedPrompt ?? null,
          imageProvider: result.imageProvider,
          imageModel: result.imageModel,
          imagePromptVersion: result.promptVersion,
          imageLatencySeconds: result.imageLatencySeconds,
          imageFallbackUsed: result.imageFallbackUsed,
          imageFallbackError: result.imageFallbackError ?? null
        }
      })
      .eq("id", job.id);

    const { data: concept, error: conceptError } = await supabase
      .from("concepts")
      .insert({
        room_id: roomId,
        design_brief_id: designBrief.id,
        generation_job_id: job.id,
        title: result.concept.title,
        description: [
          result.concept.rationale,
          "",
          `Uncertainty: ${[
            result.concept.uncertaintyNote,
            ...spatialAssumptions,
            ...spatialWarnings
              .filter((warning) => warning.code !== "spatial_geometry_missing")
              .map((warning) => warning.message)
          ].join(" ")}`
        ].join("\n"),
        status: "generated"
      })
      .select("id")
      .single();

    if (conceptError) {
      throw new Error(conceptError.message);
    }

    const renderPath = `${user.id}/${roomId}/${concept.id}.png`;
    const renderBytes = Buffer.from(result.imageBase64, "base64");
    const { error: uploadError } = await serviceSupabase.storage
      .from("generated-renders")
      .upload(renderPath, renderBytes, {
        contentType: "image/png",
        upsert: true
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: renderAsset, error: renderAssetError } = await supabase
      .from("room_assets")
      .insert({
        room_id: roomId,
        asset_type: "concept_render",
        storage_path: renderPath,
        mime_type: "image/png",
        is_primary: true
      })
      .select("id")
      .single();

    if (renderAssetError) {
      throw new Error(renderAssetError.message);
    }

    await supabase
      .from("concepts")
      .update({ primary_image_asset_id: renderAsset.id })
      .eq("id", concept.id);

    await supabase.from("rooms").update({ status: "concepting" }).eq("id", roomId);

    after(async () => {
      await generateAndStoreConceptViews({
        serviceSupabase,
        userId: user.id,
        roomId,
        conceptId: concept.id,
        roomType: room.room_type,
        conceptTitle: result.concept.title,
        conceptDescription: result.concept.rationale,
        conceptGenerationPrompt: result.concept.generationPrompt,
        heroImageBytes: renderBytes,
        heroImageStoragePath: renderPath
      });
      revalidatePath(redirectPath);
    });
  } catch (error) {
    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Initial concept generation failed."
      })
      .eq("id", job.id);

    redirect(`${redirectPath}?message=${encodeURIComponent("Concept generation failed. The brief and room photo are still saved.")}`);
  }

  revalidatePath(redirectPath);
  redirect(`${redirectPath}?message=${encodeURIComponent("Initial concept generated.")}`);
}

export async function selectConceptAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const conceptId = String(formData.get("conceptId") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  await supabase.from("concepts").update({ status: "rejected" }).eq("room_id", roomId);
  await supabase.from("concepts").update({ status: "selected" }).eq("id", conceptId);

  const redirectPath = `/projects/${projectId}/rooms/${roomId}/product-matching`;
  revalidatePath(redirectPath);
  redirect(redirectPath);
}

export async function groundProductsAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const conceptId = String(formData.get("conceptId") ?? "");
  const redirectPath = `/projects/${projectId}/rooms/${roomId}/product-matching`;
  const successRedirectPath = `/projects/${projectId}/rooms/${roomId}/shopping-list`;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const serviceSupabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, budget_max_aed")
    .eq("id", projectId)
    .single();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  const { data: concept } = await supabase
    .from("concepts")
    .select("id, title, description, status, generation_job_id, palette_json, primary_image_asset:room_assets!concepts_primary_image_asset_id_fkey(*)")
    .eq("id", conceptId)
    .eq("room_id", roomId)
    .single();

  if (!project || !room || !concept) {
    redirect("/");
  }

  if (concept.status !== "selected") {
    redirect(`${redirectPath}?message=${encodeURIComponent("Select a concept before product grounding.")}`);
  }

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("wall_length_cm, room_depth_cm")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseConceptText = `${concept.title}\n${concept.description ?? ""}`;
  const blueprintRoles: RoomProductRoleSpec[] = enhancedProductRolesForRoom(room.room_type).map((role) => ({
    category: role.category,
    label: role.label,
    visualBrief: role.visualBrief ?? null,
    quantity: role.quantity,
    priority: role.required ? "required" : "supporting"
  }));
  const localSkuFidelityMode = localSkuFidelityModeEnabled(room.room_type);

  const { data: products = [], error: productsError } = await serviceSupabase
    .from("products")
    .select(
      `
      *,
      retailer:retailers(name, status),
      dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
    `
    )
    .not("price_aed", "is", null)
    .not("primary_image_url", "is", null)
    .order("last_checked_at", { ascending: false, nullsFirst: false })
    .limit(PRODUCT_MATCHING_CATALOG_LIMIT);

  if (productsError) {
    throw new Error(productsError.message);
  }

  const candidates = (products ?? [])
    .map(productToMatchCandidate)
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));
  const localRoleWindowCandidates = localSkuFidelityMode
    ? await fetchLocalSkuFidelityRoleWindowCandidates({
        serviceSupabase,
        roomType: room.room_type,
        roles: blueprintRoles,
        conceptText: baseConceptText
      })
    : [];

  if (candidates.length === 0) {
    const message = catalogUnavailableMessage(products ?? []);
    redirect(`${redirectPath}?message=${encodeURIComponent(message)}`);
  }

  const catalogueGroundingAnchors = await catalogueGroundingAnchorsForConcept({
    serviceSupabase,
    generationJobId: concept.generation_job_id
  });
  const catalogueAnchorIdsByCategory = new Map(
    catalogueGroundingAnchors.map((anchor) => [
      normalizeSourcingCategory(anchor.category, anchor.roleLabel),
      anchor.productId
    ])
  );
  const catalogueAnchorProducts = await fetchProductsById({
    serviceSupabase,
    productIds: catalogueGroundingAnchors.map((anchor) => anchor.productId)
  });
  const catalogueAnchorCandidates = catalogueAnchorProducts
    .map(productToMatchCandidate)
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));
  const matchingCandidates = mergeProductMatchCandidates(
    mergeProductMatchCandidates(candidates, localRoleWindowCandidates),
    catalogueAnchorCandidates
  );

  const conceptImageAsset = Array.isArray(concept.primary_image_asset)
    ? concept.primary_image_asset[0]
    : concept.primary_image_asset;
  const conceptImageVisionUrl = conceptImageAsset?.storage_path
    ? await storageImageDataUrl(
        serviceSupabase,
        "generated-renders",
        conceptImageAsset.storage_path,
        conceptImageAsset.mime_type
      )
    : null;
  const conceptSignedImage = conceptImageVisionUrl ? { signedUrl: conceptImageVisionUrl } : null;
  if (!conceptSignedImage?.signedUrl) {
    redirect(
      `${redirectPath}?message=${encodeURIComponent(
        "Product sourcing needs the concept image before it can match catalog pieces."
      )}`
    );
  }

  // Aesthetic coherence is scored against the palette of the concept image as
  // rendered (extracted once, cached on the concept row), not only against the
  // concept's text tokens. Extraction failure degrades to text-only matching.
  let conceptPalette = parseConceptImagePalette(concept.palette_json);
  if (!conceptPalette) {
    try {
      const paletteResult = await extractConceptImagePalette({
        imageUrl: conceptSignedImage.signedUrl
      });
      conceptPalette = paletteResult.palette;
      await serviceSupabase
        .from("concepts")
        .update({ palette_json: conceptPalette })
        .eq("id", concept.id);
    } catch (error) {
      console.error("Concept palette extraction failed; matching falls back to text tokens.", error);
    }
  }
  const conceptPaletteText = conceptPalette ? conceptPaletteMatchingText(conceptPalette) : null;
  const paletteGroundedConceptText = conceptPaletteText
    ? `${baseConceptText}
${conceptPaletteText}`
    : baseConceptText;
  const conceptAvoidColorTags = conceptPalette?.avoidColors ?? [];

  const productMatchingPreview = productMatchingEngineV1EnabledForRequest({
    projectId,
    roomId,
    userId: user.id,
    userEmail: user.email,
    roomType: room.room_type
  });
  const productMatchingEngineEnabled = productMatchingPreview.enabled;
  const recentlyUsedProductIds = await recentlyUsedProductIdsForUser({
    serviceSupabase,
    userId: user.id,
    excludeRoomId: roomId
  });
  const candidatesPerRole = localSkuFidelityMode ? LOCAL_SKU_FIDELITY_CANDIDATES_PER_ROLE : 6;
  const flatCandidateLimit = localSkuFidelityMode
    ? Math.max(72, blueprintRoles.length * candidatesPerRole)
    : 36;
  const sourcingPlan = buildProductSourcingRuntimePlan({
    engineEnabled: productMatchingEngineEnabled,
    roomType: room.room_type,
    conceptText: paletteGroundedConceptText,
    roles: blueprintRoles,
    candidates: matchingCandidates,
    recentlyUsedProductIds,
    avoidColorTags: conceptAvoidColorTags,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? {
          wallLengthCm: measurements.wall_length_cm,
          roomDepthCm: measurements.room_depth_cm
        }
      : null,
    candidatesPerRole,
    flatCandidateLimit
  });
  const sourcingPools = localSkuFidelityMode
    ? sourcingPlan.roleScopedPools.map((pool) =>
        rerankRolePoolForAestheticFit(pool, room.room_type, paletteGroundedConceptText)
      )
    : sourcingPlan.roleScopedPools;
  const sourcingCandidates = localSkuFidelityMode
    ? roleScopedCandidatesForLocalSkuFidelityPlan(sourcingPools, flatCandidateLimit)
    : sourcingPlan.candidates;
  const legacyRequiredRoles: RoomProductRoleSpec[] = productRolesForRoom(room.room_type)
    .filter((role) => role.required)
    .map((role) => ({
      category: role.category,
      label: role.label,
      visualBrief: role.visualBrief ?? null,
      quantity: role.quantity,
      priority: "required"
    }));
  const staticRoles = mergeRoomRoles(blueprintRoles, legacyRequiredRoles);
  const initialImagePreflight = await preflightProductCandidateImages(sourcingCandidates, {
    timeoutMs: PRODUCT_SOURCING_IMAGE_PREFLIGHT_TIMEOUT_MS,
    maxBytes: PRODUCT_SOURCING_MAX_IMAGE_BYTES
  });
  const aiSourcingCandidates = PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED
    ? initialImagePreflight.candidates
    : sourcingCandidates;
  const sourcingCandidateIds = new Set(sourcingCandidates.map((candidate) => candidate.id));
  const sourcingCandidatePools = sourcingPools.map((pool) => poolToSourcingRolePool(pool, sourcingCandidateIds));
  const initialImageGate = buildProductImagePreflightGate({
    candidateCount: sourcingCandidates.length,
    acceptedCandidateIds: initialImagePreflight.acceptedCandidateIds,
    rolePools: sourcingPools
  });
  const rolePoolDiversity = productMatchingEngineEnabled ? summarizeRolePoolDiversity(sourcingPools) : undefined;
  const rolePoolQuality = productMatchingEngineEnabled ? summarizeRolePoolQuality(sourcingPools) : undefined;
  const productMatchingRoomMeasurements = measurements
    ? {
        wallLengthCm: measurements.wall_length_cm,
        roomDepthCm: measurements.room_depth_cm
      }
    : null;
  let latestConfidencePools = sourcingPools;
  const productMatchingLoggedAtMs = Date.now();
  const { data: sourcingJob, error: sourcingJobError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: user.id,
      room_id: roomId,
      job_type: "product_visual_sourcing",
      status: "running",
      provider: "openai",
      model: process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini",
      prompt_version: null,
      input_summary: {
        roomId,
        conceptId: concept.id,
        productMatchingEngineEnabled,
        localSkuFidelityMode,
        productMatchingPreviewGate: {
          configured: productMatchingPreview.gate.configured,
          enabled: productMatchingPreview.gate.enabled,
          allowed: productMatchingPreview.gate.allowed,
          matchedScopes: productMatchingPreview.gate.matchedScopes
        },
        candidateCount: sourcingCandidates.length,
        productSourcingAiPayload: productSourcingAiPayloadSummary(),
        productImagePreflight: initialImagePreflight.summary,
        productImagePreflightGate: initialImageGate,
        blueprintRoleCount: blueprintRoles.length,
        roleCandidateCounts: productMatchingEngineEnabled ? roleCandidateCountSummary(sourcingPools) : undefined,
        rolePoolDiversity,
        rolePoolQuality,
        rolePoolQaRollup:
          rolePoolQuality && rolePoolDiversity
            ? summarizePoolQaRollup({
                rolePoolQuality,
                rolePoolDiversity
              })
            : undefined
      }
    })
    .select("id")
    .single();

  if (sourcingJobError) {
    throw new Error(sourcingJobError.message);
  }

  if (PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED && !initialImageGate.usable) {
    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "Product visual sourcing did not have enough AI-usable product images.",
        output_summary: {
          productMatchingEngineEnabled,
          localSkuFidelityMode,
          productSourcingAiPayload: productSourcingAiPayloadSummary(),
          productImagePreflight: initialImagePreflight.summary,
          productImagePreflightGate: initialImageGate,
          usableProductImageCount: initialImagePreflight.summary.acceptedCount,
          minUsableProductImageCount: initialImageGate.minAcceptedCount
        }
      })
      .eq("id", sourcingJob.id);

    redirect(`${redirectPath}?message=${encodeURIComponent(productImageCatalogRefreshMessage())}`);
  }

  let sourcingResult: Awaited<ReturnType<typeof sourceProductsFromConcept>>;
  let productSourcingTextFallbackUsed = false;
  let productSourcingTextFallbackReason: string | null = null;
  let productSourcingInitialTimedOut = false;
  const productSourcingStrategy = productSourcingVisualStrategy({
    productCandidateImagesEnabled: PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED,
    candidateImageLimit: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT,
    rolePoolCount: sourcingCandidatePools.length
  });
  const productSourcingInitialAttemptStartedAtMs = Date.now();
  let productSourcingInitialAttemptDurationMs: number | null = null;
  try {
    if (!productSourcingStrategy.shouldAttemptVisualSourcing) {
      productSourcingTextFallbackUsed = true;
      productSourcingTextFallbackReason = productSourcingStrategy.fallbackReason;
      productSourcingInitialAttemptDurationMs = 0;
      sourcingResult = buildProductSourcingTextFallbackResult({
        roomType: room.room_type,
        conceptTitle: concept.title,
        conceptDescription: concept.description,
        roles: staticRoles,
        rankedCandidates: sourcingCandidates,
        model: process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini"
      });
    } else {
      sourcingResult = await withTimeout(
        sourceProductsFromConcept({
          roomType: room.room_type,
          conceptTitle: concept.title,
          conceptDescription: concept.description,
          conceptImageUrl: conceptSignedImage.signedUrl,
          candidates: aiSourcingCandidates.map(matchToSourcingCandidate),
          roleCandidatePools: productMatchingEngineEnabled ? sourcingCandidatePools : undefined,
          conceptImageDetail: PRODUCT_SOURCING_AI_CONCEPT_IMAGE_DETAIL,
          candidateImageLimit: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT,
          candidateImageDetail: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_DETAIL,
          candidateImageDataUrls: await sourcingCandidateImageDataUrls(
            aiSourcingCandidates,
            PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT
          )
        }),
        PRODUCT_SOURCING_AI_TIMEOUT_MS,
        "Product visual sourcing timed out."
      );
      productSourcingInitialAttemptDurationMs = Date.now() - productSourcingInitialAttemptStartedAtMs;
    }

    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        model: sourcingResult.model,
        prompt_version: sourcingResult.promptVersion,
        output_summary: {
          promptKey: sourcingResult.promptKey,
          needCount: sourcingResult.needs.length,
          selectedProductCount: sourcingResult.selectedProducts.length,
          missingRoleCount: sourcingResult.missingRoles.length,
          missingRoles: sourcingResult.missingRoles,
          productMatchingEngineEnabled,
          localSkuFidelityMode,
          productSourcingAiPayload: productSourcingAiPayloadSummary(),
          productSourcingVisualStrategy: productSourcingStrategy,
          productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
            attemptDurationMs: productSourcingInitialAttemptDurationMs,
            timedOut: false,
            fallbackUsed: productSourcingTextFallbackUsed,
            fallbackReason: productSourcingTextFallbackReason,
            candidateCount: aiSourcingCandidates.length,
            rolePoolCount: sourcingCandidatePools.length
          }),
          productSourcingTextFallbackUsed,
          productSourcingTextFallbackReason,
          productImagePreflight: initialImagePreflight.summary,
          productImagePreflightGate: initialImageGate,
          roleCandidateCounts: productMatchingEngineEnabled ? roleCandidateCountSummary(sourcingPools) : undefined,
          roleStatuses: productMatchingEngineEnabled ? roleStatusSummary(sourcingResult.roleResults) : undefined,
          ...(productMatchingEngineEnabled
            ? roleConfidenceOutputFields(
                sourcingPools,
                sourcingResult.roleResults,
                productMatchingLoggedAtMs,
                productMatchingRoomMeasurements,
                productSourcingTimeoutDiagnostics({
                  attemptDurationMs: productSourcingInitialAttemptDurationMs,
                  timedOut: false,
                  fallbackUsed: productSourcingTextFallbackUsed,
                  fallbackReason: productSourcingTextFallbackReason,
                  candidateCount: aiSourcingCandidates.length,
                  rolePoolCount: sourcingCandidatePools.length
                })
              )
            : {})
        }
      })
      .eq("id", sourcingJob.id);
  } catch (error) {
    productSourcingInitialAttemptDurationMs = Date.now() - productSourcingInitialAttemptStartedAtMs;
    const productSourcingTimedOut = isProductSourcingTimeoutError(error);
    productSourcingInitialTimedOut = productSourcingTimedOut;
    if (productSourcingTimedOut) {
      productSourcingTextFallbackUsed = true;
      productSourcingTextFallbackReason = "initial_visual_sourcing_timeout";
      sourcingResult = buildProductSourcingTextFallbackResult({
        roomType: room.room_type,
        conceptTitle: concept.title,
        conceptDescription: concept.description,
        roles: staticRoles,
        rankedCandidates: sourcingCandidates,
        model: process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini"
      });

      if (sourcingResult.needs.length > 0 && sourcingResult.selectedProducts.length > 0) {
        await serviceSupabase
          .from("ai_jobs")
          .update({
            status: "succeeded",
            completed_at: new Date().toISOString(),
            model: sourcingResult.model,
            prompt_version: sourcingResult.promptVersion,
            output_summary: {
              promptKey: sourcingResult.promptKey,
              needCount: sourcingResult.needs.length,
              selectedProductCount: sourcingResult.selectedProducts.length,
              missingRoleCount: sourcingResult.missingRoles.length,
              missingRoles: sourcingResult.missingRoles,
              productMatchingEngineEnabled,
              localSkuFidelityMode,
              productSourcingAiPayload: productSourcingAiPayloadSummary(),
              productSourcingVisualStrategy: productSourcingStrategy,
              productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
                attemptDurationMs: productSourcingInitialAttemptDurationMs,
                timedOut: productSourcingTimedOut,
                fallbackUsed: productSourcingTextFallbackUsed,
                fallbackReason: productSourcingTextFallbackReason,
                candidateCount: aiSourcingCandidates.length,
                rolePoolCount: sourcingCandidatePools.length
              }),
              productSourcingTimedOut,
              productSourcingTextFallbackUsed,
              productSourcingTextFallbackReason,
              productImagePreflight: initialImagePreflight.summary,
              productImagePreflightGate: initialImageGate,
              roleCandidateCounts: productMatchingEngineEnabled ? roleCandidateCountSummary(sourcingPools) : undefined,
              roleStatuses: productMatchingEngineEnabled ? roleStatusSummary(sourcingResult.roleResults) : undefined,
              ...(productMatchingEngineEnabled
                ? roleConfidenceOutputFields(
                    sourcingPools,
                    sourcingResult.roleResults,
                    productMatchingLoggedAtMs,
                    productMatchingRoomMeasurements,
                    productSourcingTimeoutDiagnostics({
                      attemptDurationMs: productSourcingInitialAttemptDurationMs,
                      timedOut: productSourcingTimedOut,
                      fallbackUsed: productSourcingTextFallbackUsed,
                      fallbackReason: productSourcingTextFallbackReason,
                      candidateCount: aiSourcingCandidates.length,
                      rolePoolCount: sourcingCandidatePools.length
                    })
                  )
                : {})
            }
          })
          .eq("id", sourcingJob.id);
      } else {
        await serviceSupabase
          .from("ai_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: "Product visual sourcing timed out and text fallback found no usable products.",
            output_summary: {
              productMatchingEngineEnabled,
              localSkuFidelityMode,
              productSourcingAiPayload: productSourcingAiPayloadSummary(),
              productSourcingVisualStrategy: productSourcingStrategy,
              productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
                attemptDurationMs: productSourcingInitialAttemptDurationMs,
                timedOut: productSourcingTimedOut,
                fallbackUsed: productSourcingTextFallbackUsed,
                fallbackReason: productSourcingTextFallbackReason,
                candidateCount: aiSourcingCandidates.length,
                rolePoolCount: sourcingCandidatePools.length
              }),
              productImagePreflight: initialImagePreflight.summary,
              productImagePreflightGate: initialImageGate,
              productSourcingTimedOut,
              productSourcingTextFallbackUsed,
              productSourcingTextFallbackReason,
              providerImageDownloadFailure: false
            }
          })
          .eq("id", sourcingJob.id);

        redirect(`${redirectPath}?message=${encodeURIComponent(productSourcingTimeoutMessage())}`);
      }
    } else {
      await serviceSupabase
        .from("ai_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : "Product visual sourcing failed.",
          output_summary: {
            productMatchingEngineEnabled,
            localSkuFidelityMode,
            productSourcingAiPayload: productSourcingAiPayloadSummary(),
            productSourcingVisualStrategy: productSourcingStrategy,
            productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
              attemptDurationMs: productSourcingInitialAttemptDurationMs,
              timedOut: productSourcingTimedOut,
              fallbackUsed: productSourcingTextFallbackUsed,
              fallbackReason: productSourcingTextFallbackReason,
              candidateCount: aiSourcingCandidates.length,
              rolePoolCount: sourcingCandidatePools.length
            }),
            productImagePreflight: initialImagePreflight.summary,
            productImagePreflightGate: initialImageGate,
            productSourcingTimedOut,
            productSourcingTextFallbackUsed,
            productSourcingTextFallbackReason,
            providerImageDownloadFailure: isProviderImageDownloadError(error)
          }
        })
        .eq("id", sourcingJob.id);

      const message = productSourcingFailureMessage(error);
      redirect(`${redirectPath}?message=${encodeURIComponent(message)}`);
    }
  }

  if (sourcingResult.needs.length === 0 || sourcingResult.selectedProducts.length === 0) {
    redirect(
      `${redirectPath}?message=${encodeURIComponent(
        "Product sourcing could not find enough visually relevant catalog pieces. Please try sourcing again."
      )}`
    );
  }
  const visualConceptText = [
    paletteGroundedConceptText,
    ...(sourcingResult?.needs.map(
      (need) => `${need.roleLabel}: ${need.visualBrief}`
    ) ?? [])
  ].join("\n");
  let visualMissingRoleCategories = new Set(
    sourcingResult.missingRoles.map((role) => normalizeSourcingCategory(role, role))
  );
  // The AI's read of the concept defines the room's roles; fall back to the
  // static room roles, and append any required static role the AI didn't name.
  const aiRoles: RoomProductRoleSpec[] = sourcingResult.needs.map((need) => ({
    category: normalizeSourcingCategory(need.category, need.roleLabel),
    label: need.roleLabel,
    visualBrief: need.visualBrief,
    quantity: Math.max(1, need.quantity),
    priority: need.priority === "required" ? "required" : "supporting"
  }));
  const usableAiRoles = aiRoles.filter((role) => !visualMissingRoleCategories.has(role.category));
  const aiRoleCategories = new Set(usableAiRoles.map((role) => role.category));
  const roles =
    usableAiRoles.length > 0
      ? [
          ...usableAiRoles,
          ...staticRoles.filter(
            (role) => !aiRoleCategories.has(role.category) && !visualMissingRoleCategories.has(role.category)
          )
        ]
      : staticRoles.filter((role) => !visualMissingRoleCategories.has(role.category));

  const baseVisualRanked = rankProductMatches({
    roomType: room.room_type,
    conceptText: visualConceptText,
    recentlyUsedProductIds,
    avoidColorTags: conceptAvoidColorTags,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? {
          wallLengthCm: measurements.wall_length_cm,
          roomDepthCm: measurements.room_depth_cm
        }
      : null,
    candidates: matchingCandidates
  });
  const visualRanked = localSkuFidelityMode
    ? rankMatchesForLocalSkuFidelity({
        ranked: baseVisualRanked,
        roles,
        roomType: room.room_type,
        conceptText: visualConceptText,
        roomMeasurements: measurements
          ? {
              wallLengthCm: measurements.wall_length_cm,
              roomDepthCm: measurements.room_depth_cm
            }
          : null
      })
    : baseVisualRanked;
  let missingRequiredVisualRoles = staticRoles.filter(
    (role) => role.priority === "required" && visualMissingRoleCategories.has(role.category)
  );
  let retryProductImagePreflightSummary: ProductImagePreflightSummary | null = null;
  let retryProductImagePreflightGate: ReturnType<typeof buildProductImagePreflightGate> | null = null;
  let retryProviderImageDownloadFailure = false;
  let retryProductSourcingTimedOut = false;
  let retryProductSourcingAttemptDurationMs: number | null = null;
  let retryProductSourcingTextFallbackUsed = false;
  let retryProductSourcingTextFallbackReason: string | null = null;

  if (!productSourcingTextFallbackUsed && missingRequiredVisualRoles.length > 0) {
    const retryRoles = mergeRoomRoles(missingRequiredVisualRoles, staticRoles);
    const retryPlan = buildProductSourcingRuntimePlan({
      engineEnabled: productMatchingEngineEnabled,
      roomType: room.room_type,
      conceptText: visualConceptText,
      roles: retryRoles,
      candidates: matchingCandidates,
      recentlyUsedProductIds,
      avoidColorTags: conceptAvoidColorTags,
      budgetMaxAed: project.budget_max_aed,
      roomMeasurements: measurements
        ? {
            wallLengthCm: measurements.wall_length_cm,
            roomDepthCm: measurements.room_depth_cm
          }
        : null,
      candidatesPerRole: localSkuFidelityMode ? LOCAL_SKU_FIDELITY_CANDIDATES_PER_ROLE : 8,
      flatCandidateLimit: localSkuFidelityMode
        ? Math.max(72, retryRoles.length * LOCAL_SKU_FIDELITY_CANDIDATES_PER_ROLE)
        : 36
    });
    const retryPools = retryPlan.roleScopedPools;
    const retryCandidates = retryPlan.candidates;
    const retryImagePreflight = await preflightProductCandidateImages(retryCandidates, {
      timeoutMs: PRODUCT_SOURCING_IMAGE_PREFLIGHT_TIMEOUT_MS,
      maxBytes: PRODUCT_SOURCING_MAX_IMAGE_BYTES
    });
    retryProductImagePreflightSummary = retryImagePreflight.summary;
    const aiRetryCandidates = PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED
      ? retryImagePreflight.candidates
      : retryCandidates;
    const retryCandidateIds = new Set(retryCandidates.map((candidate) => candidate.id));
    const retryImageGate = buildProductImagePreflightGate({
      candidateCount: retryCandidates.length,
      acceptedCandidateIds: retryImagePreflight.acceptedCandidateIds,
      rolePools: retryPools
    });
    retryProductImagePreflightGate = retryImageGate;
    const retryProductSourcingStrategy = productSourcingVisualStrategy({
      productCandidateImagesEnabled: PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED,
      candidateImageLimit: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT,
      rolePoolCount: retryPools.length
    });
    const retryFallbackEvidence = productSourcingRetryFallbackEvidenceForStrategy(retryProductSourcingStrategy);
    const retryAttemptStartedAtMs = Date.now();
    let retryResult: Awaited<ReturnType<typeof sourceProductsFromConcept>> | null = null;
    if (retryFallbackEvidence) {
      retryProductSourcingAttemptDurationMs = retryFallbackEvidence.retryAttemptDurationMs;
      retryProductSourcingTextFallbackUsed = retryFallbackEvidence.retryFallbackUsed;
      retryProductSourcingTextFallbackReason = retryFallbackEvidence.retryFallbackReason;
      retryProviderImageDownloadFailure = retryFallbackEvidence.retryProviderImageDownloadFailure;
      retryProductSourcingTimedOut = retryFallbackEvidence.retryTimedOut;
      retryResult = buildProductSourcingTextFallbackResult({
        roomType: room.room_type,
        conceptTitle: concept.title,
        conceptDescription: concept.description,
        roles: retryRoles,
        rankedCandidates: retryCandidates,
        model: process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini"
      });
    } else if (!PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED || retryImageGate.usable) {
      retryResult = await withTimeout(
        sourceProductsFromConcept({
          roomType: room.room_type,
          conceptTitle: concept.title,
          conceptDescription: concept.description,
          conceptImageUrl: conceptSignedImage.signedUrl,
          candidates: aiRetryCandidates.map(matchToSourcingCandidate),
          roleCandidatePools: productMatchingEngineEnabled
            ? retryPools.map((pool) => poolToSourcingRolePool(pool, retryCandidateIds))
            : undefined,
          conceptImageDetail: PRODUCT_SOURCING_AI_CONCEPT_IMAGE_DETAIL,
          candidateImageLimit: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT,
          candidateImageDetail: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_DETAIL,
          candidateImageDataUrls: await sourcingCandidateImageDataUrls(
            aiRetryCandidates,
            PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT
          )
        }),
        PRODUCT_SOURCING_AI_TIMEOUT_MS,
        "Product visual sourcing retry timed out."
      ).catch((error) => {
        retryProductSourcingAttemptDurationMs = Date.now() - retryAttemptStartedAtMs;
        retryProviderImageDownloadFailure = isProviderImageDownloadError(error);
        retryProductSourcingTimedOut = isProductSourcingTimeoutError(error);
        return null;
      });
    }
    if (retryResult && !retryFallbackEvidence) {
      retryProductSourcingAttemptDurationMs = Date.now() - retryAttemptStartedAtMs;
    }

    if (retryResult?.needs.length && retryResult.selectedProducts.length) {
      sourcingResult = retryResult;
      latestConfidencePools = retryPools;
      visualMissingRoleCategories = new Set(
        sourcingResult.missingRoles.map((role) => normalizeSourcingCategory(role, role))
      );
      missingRequiredVisualRoles = staticRoles.filter(
        (role) => role.priority === "required" && visualMissingRoleCategories.has(role.category)
      );

      await serviceSupabase
        .from("ai_jobs")
        .update({
          status: "succeeded",
          completed_at: new Date().toISOString(),
          model: sourcingResult.model,
          prompt_version: sourcingResult.promptVersion,
          output_summary: {
            promptKey: sourcingResult.promptKey,
            needCount: sourcingResult.needs.length,
            selectedProductCount: sourcingResult.selectedProducts.length,
            missingRoleCount: sourcingResult.missingRoles.length,
            missingRoles: sourcingResult.missingRoles,
            productMatchingEngineEnabled,
            localSkuFidelityMode,
            productSourcingAiPayload: productSourcingAiPayloadSummary(),
            productSourcingVisualStrategy: productSourcingStrategy,
            retryProductSourcingVisualStrategy: retryProductSourcingStrategy,
            productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
              attemptDurationMs: productSourcingInitialAttemptDurationMs,
              timedOut: productSourcingInitialTimedOut,
              fallbackUsed: productSourcingTextFallbackUsed,
              fallbackReason: productSourcingTextFallbackReason,
              candidateCount: aiSourcingCandidates.length,
              rolePoolCount: sourcingCandidatePools.length,
              retryAttempted: true,
              retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
              retryTimedOut: retryProductSourcingTimedOut,
              retryFallbackUsed: retryProductSourcingTextFallbackUsed,
              retryFallbackReason: retryProductSourcingTextFallbackReason,
              retryProviderImageDownloadFailure,
              retryImageGateUsable: retryImageGate.usable
            }),
            productSourcingTextFallbackUsed,
            productSourcingTextFallbackReason,
            retryProductSourcingTextFallbackUsed,
            retryProductSourcingTextFallbackReason,
            productImagePreflight: initialImagePreflight.summary,
            productImagePreflightGate: initialImageGate,
            retryProductImagePreflight: retryImagePreflight.summary,
            retryProductImagePreflightGate: retryImageGate,
            roleCandidateCounts: productMatchingEngineEnabled ? roleCandidateCountSummary(retryPools) : undefined,
            roleStatuses: productMatchingEngineEnabled ? roleStatusSummary(sourcingResult.roleResults) : undefined,
            ...(productMatchingEngineEnabled
              ? roleConfidenceOutputFields(
                  retryPools,
                  sourcingResult.roleResults,
                  productMatchingLoggedAtMs,
                  productMatchingRoomMeasurements,
                  productSourcingTimeoutDiagnostics({
                    attemptDurationMs: productSourcingInitialAttemptDurationMs,
                    timedOut: productSourcingInitialTimedOut,
                    fallbackUsed: productSourcingTextFallbackUsed,
                    fallbackReason: productSourcingTextFallbackReason,
                    candidateCount: aiRetryCandidates.length,
                    rolePoolCount: retryPools.length,
                    retryAttempted: true,
                    retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
                    retryTimedOut: retryProductSourcingTimedOut,
                    retryFallbackUsed: retryProductSourcingTextFallbackUsed,
                    retryFallbackReason: retryProductSourcingTextFallbackReason,
                    retryProviderImageDownloadFailure,
                    retryImageGateUsable: retryImageGate.usable
                  })
                )
              : {}),
            retryUsed: true,
            usable: missingRequiredVisualRoles.length === 0
          }
        })
        .eq("id", sourcingJob.id);
    }
  }

  if (missingRequiredVisualRoles.length > 0) {
    const missingLabels = missingRequiredVisualRoles.map((role) => role.label);
    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: `Visual sourcing reported missing required roles: ${missingLabels.join(", ")}.`,
        output_summary: {
          promptKey: sourcingResult.promptKey,
          needCount: sourcingResult.needs.length,
          selectedProductCount: sourcingResult.selectedProducts.length,
          missingRoleCount: sourcingResult.missingRoles.length,
          missingRoles: sourcingResult.missingRoles,
          productMatchingEngineEnabled,
          localSkuFidelityMode,
          productSourcingAiPayload: productSourcingAiPayloadSummary(),
          productSourcingVisualStrategy: productSourcingStrategy,
          productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
            attemptDurationMs: productSourcingInitialAttemptDurationMs,
            timedOut: productSourcingInitialTimedOut,
            fallbackUsed: productSourcingTextFallbackUsed,
            fallbackReason: productSourcingTextFallbackReason,
            candidateCount: aiSourcingCandidates.length,
            rolePoolCount: sourcingCandidatePools.length,
            retryAttempted: retryProductImagePreflightSummary !== null,
            retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
            retryTimedOut: retryProductSourcingTimedOut,
            retryFallbackUsed: retryProductSourcingTextFallbackUsed,
            retryFallbackReason: retryProductSourcingTextFallbackReason,
            retryProviderImageDownloadFailure,
            retryImageGateUsable: retryProductImagePreflightGate?.usable ?? null
          }),
          productSourcingTextFallbackUsed,
          productSourcingTextFallbackReason,
          productImagePreflight: initialImagePreflight.summary,
          productImagePreflightGate: initialImageGate,
          retryProductImagePreflight: retryProductImagePreflightSummary,
          retryProductImagePreflightGate,
          retryProductSourcingTimedOut,
          retryProductSourcingTextFallbackUsed,
          retryProductSourcingTextFallbackReason,
          retryProviderImageDownloadFailure,
          roleCandidateCounts: productMatchingEngineEnabled
            ? roleCandidateCountSummary(latestConfidencePools)
            : undefined,
          roleStatuses: productMatchingEngineEnabled ? roleStatusSummary(sourcingResult.roleResults) : undefined,
          ...(productMatchingEngineEnabled
            ? roleConfidenceOutputFields(
                latestConfidencePools,
                sourcingResult.roleResults,
                productMatchingLoggedAtMs,
                productMatchingRoomMeasurements,
                productSourcingTimeoutDiagnostics({
                  attemptDurationMs: productSourcingInitialAttemptDurationMs,
                  timedOut: productSourcingInitialTimedOut,
                  fallbackUsed: productSourcingTextFallbackUsed,
                  fallbackReason: productSourcingTextFallbackReason,
                  candidateCount: latestConfidencePools.reduce((count, pool) => count + pool.candidateCount, 0),
                  rolePoolCount: latestConfidencePools.length,
                  retryAttempted: retryProductImagePreflightSummary !== null,
                  retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
                  retryTimedOut: retryProductSourcingTimedOut,
                  retryFallbackUsed: retryProductSourcingTextFallbackUsed,
                  retryFallbackReason: retryProductSourcingTextFallbackReason,
                  retryProviderImageDownloadFailure,
                  retryImageGateUsable: retryProductImagePreflightGate?.usable ?? null
                })
              )
            : {}),
          usable: false
        }
      })
      .eq("id", sourcingJob.id);

    redirect(
      `${redirectPath}?message=${encodeURIComponent(
        retryProviderImageDownloadFailure
          ? productImageCatalogRefreshMessage()
          : retryProductSourcingTimedOut
            ? productSourcingTimeoutMessage()
          : "We need one more catalogue pass before this shopping list is ready. Please try sourcing again."
      )}`
    );
  }

  const sourceSelectionsById = new Map(
    sourcingResult.selectedProducts.map((selection) => [selection.productId, selection])
  );
  const sourceRoleResultsByCategory = productMatchingEngineEnabled
    ? new Map(
        sourcingResult.roleResults.map((result) => [
          normalizeSourcingCategory(result.category, result.roleLabel),
          result
        ])
      )
    : new Map<string, (typeof sourcingResult.roleResults)[number]>();
  const refreshDiversityHistory = localSkuFidelityMode
    ? await previousShoppingListRefreshHistory({
        serviceSupabase,
        roomId,
        conceptId
      })
    : [];

  const visualRankedById = new Map(visualRanked.map((match) => [match.id, match]));
  const optionsPerRole = localSkuFidelityMode ? LOCAL_SKU_FIDELITY_CANDIDATES_PER_ROLE : 6;
  const roleScopedOptionPools = productMatchingEngineEnabled
    ? buildRoleScopedCandidatePools({
        roomType: room.room_type,
        conceptText: visualConceptText,
        roles,
        candidates: matchingCandidates,
        recentlyUsedProductIds,
        avoidColorTags: conceptAvoidColorTags,
        budgetMaxAed: project.budget_max_aed,
        roomMeasurements: measurements
          ? {
              wallLengthCm: measurements.wall_length_cm,
              roomDepthCm: measurements.room_depth_cm
            }
          : null,
        candidatesPerRole: Math.max(optionsPerRole * 2, optionsPerRole)
      }).pools.map((pool) =>
        localSkuFidelityMode ? rerankRolePoolForAestheticFit(pool, room.room_type, visualConceptText) : pool
      )
    : [];
  const roleOptions = ensureLocalSkuFidelitySupportOptions({
    roleOptions: polishRoleOptionsForAestheticDemo({
      roleOptions: composeRoomProductOptions({
        ranked: visualRanked,
        roles,
        roleScopedPools: roleScopedOptionPools,
        roomType: room.room_type,
        // Store a reserve beyond the three shown, so rejecting an option reveals a
        // replacement instantly with no catalog round-trip.
        optionsPerRole,
        refreshDiversityHistory: localSkuFidelityMode ? refreshDiversityHistory : []
      }),
      ranked: visualRanked,
      rankedById: visualRankedById,
      catalogueGroundingAnchors,
      conceptText: visualConceptText,
      localSkuFidelityMode,
      optionsPerRole: 6
    }),
    roles,
    ranked: visualRanked,
    conceptText: visualConceptText,
    localSkuFidelityMode
  });
  const missingCatalogueAnchors = catalogueGroundingAnchors
    .filter((anchor) => anchor.priority === "required")
    .filter((anchor) => {
      const category = normalizeSourcingCategory(anchor.category, anchor.roleLabel);
      const role = roleOptions.find((option) => option.category === category);
      return !role?.options.some((option) => option.id === anchor.productId);
    });

  if (missingCatalogueAnchors.length > 0 && !localSkuFidelityMode) {
    const missingAnchorLabels = missingCatalogueAnchors.map((anchor) => anchor.roleLabel || anchor.category);
    const { data: currentSourcingJob } = await serviceSupabase
      .from("ai_jobs")
      .select("output_summary")
      .eq("id", sourcingJob.id)
      .maybeSingle();
    const currentSourcingSummary = isRecord(currentSourcingJob?.output_summary)
      ? currentSourcingJob.output_summary
      : {};

    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: `Required catalogue anchors were missing from product options: ${missingAnchorLabels.join(", ")}.`,
        output_summary: {
          ...currentSourcingSummary,
          promptKey: sourcingResult.promptKey,
          needCount: sourcingResult.needs.length,
          selectedProductCount: sourcingResult.selectedProducts.length,
          missingRoleCount: sourcingResult.missingRoles.length,
          missingRoles: sourcingResult.missingRoles,
          productMatchingEngineEnabled,
          localSkuFidelityMode,
          productSourcingAiPayload: productSourcingAiPayloadSummary(),
          productSourcingVisualStrategy: productSourcingStrategy,
          productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
            attemptDurationMs: productSourcingInitialAttemptDurationMs,
            timedOut: productSourcingInitialTimedOut,
            fallbackUsed: productSourcingTextFallbackUsed,
            fallbackReason: productSourcingTextFallbackReason,
            candidateCount: aiSourcingCandidates.length,
            rolePoolCount: sourcingCandidatePools.length,
            retryAttempted: retryProductImagePreflightSummary !== null,
            retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
            retryTimedOut: retryProductSourcingTimedOut,
            retryFallbackUsed: retryProductSourcingTextFallbackUsed,
            retryFallbackReason: retryProductSourcingTextFallbackReason,
            retryProviderImageDownloadFailure,
            retryImageGateUsable: retryProductImagePreflightGate?.usable ?? null
          }),
          productSourcingTextFallbackUsed,
          productSourcingTextFallbackReason,
          productImagePreflight: initialImagePreflight.summary,
          productImagePreflightGate: initialImageGate,
          retryProductImagePreflight: retryProductImagePreflightSummary,
          retryProductImagePreflightGate,
          retryProductSourcingTimedOut,
          retryProductSourcingTextFallbackUsed,
          retryProductSourcingTextFallbackReason,
          retryProviderImageDownloadFailure,
          roleCandidateCounts: productMatchingEngineEnabled
            ? roleCandidateCountSummary(latestConfidencePools)
            : undefined,
          roleStatuses: productMatchingEngineEnabled ? roleStatusSummary(sourcingResult.roleResults) : undefined,
          ...(productMatchingEngineEnabled
            ? roleConfidenceOutputFields(
                latestConfidencePools,
                sourcingResult.roleResults,
                productMatchingLoggedAtMs,
                productMatchingRoomMeasurements,
                productSourcingTimeoutDiagnostics({
                  attemptDurationMs: productSourcingInitialAttemptDurationMs,
                  timedOut: productSourcingInitialTimedOut,
                  fallbackUsed: productSourcingTextFallbackUsed,
                  fallbackReason: productSourcingTextFallbackReason,
                  candidateCount: latestConfidencePools.reduce((count, pool) => count + pool.candidateCount, 0),
                  rolePoolCount: latestConfidencePools.length,
                  retryAttempted: retryProductImagePreflightSummary !== null,
                  retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
                  retryTimedOut: retryProductSourcingTimedOut,
                  retryFallbackUsed: retryProductSourcingTextFallbackUsed,
                  retryFallbackReason: retryProductSourcingTextFallbackReason,
                  retryProviderImageDownloadFailure,
                  retryImageGateUsable: retryProductImagePreflightGate?.usable ?? null
                })
              )
            : {}),
          usable: false,
          catalogueAnchorDivergence: {
            missingRequiredAnchorCount: missingCatalogueAnchors.length,
            missingRequiredAnchors: missingCatalogueAnchors.map((anchor) => ({
              productId: anchor.productId,
              category: anchor.category,
              roleLabel: anchor.roleLabel
            }))
          }
        }
      })
      .eq("id", sourcingJob.id);

    redirect(
      `${redirectPath}?message=${encodeURIComponent(
        "We need one more catalogue pass before this shopping list is ready. Please try sourcing again."
      )}`
    );
  }
  if (missingCatalogueAnchors.length > 0 && localSkuFidelityMode) {
    const { data: currentSourcingJob } = await serviceSupabase
      .from("ai_jobs")
      .select("output_summary")
      .eq("id", sourcingJob.id)
      .maybeSingle();
    const currentSourcingSummary = isRecord(currentSourcingJob?.output_summary)
      ? currentSourcingJob.output_summary
      : {};

    await serviceSupabase
      .from("ai_jobs")
      .update({
        output_summary: {
          ...currentSourcingSummary,
          catalogueAnchorDivergence: {
            localReplacementAllowed: true,
            missingRequiredAnchorCount: missingCatalogueAnchors.length,
            missingRequiredAnchors: missingCatalogueAnchors.map((anchor) => ({
              category: normalizeSourcingCategory(anchor.category, anchor.roleLabel),
              roleLabel: anchor.roleLabel,
              productId: anchor.productId
            }))
          }
        }
      })
      .eq("id", sourcingJob.id);
  }

  const coveredCategories = new Set(roleOptions.map((role) => role.category));
  const missingRequiredRoles = roles
    .filter((role) => role.priority === "required" && !coveredCategories.has(role.category))
    .map((role) => role.label);

  if (missingRequiredRoles.length > 0) {
    const { data: currentSourcingJob } = await serviceSupabase
      .from("ai_jobs")
      .select("output_summary")
      .eq("id", sourcingJob.id)
      .maybeSingle();
    const currentSourcingSummary = isRecord(currentSourcingJob?.output_summary)
      ? currentSourcingJob.output_summary
      : {};

    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: `Required product roles were missing from product options: ${missingRequiredRoles.join(", ")}.`,
        output_summary: {
          ...currentSourcingSummary,
          missingRequiredRoles,
          productSourcingTimeoutDiagnostics: productSourcingTimeoutDiagnostics({
            attemptDurationMs: productSourcingInitialAttemptDurationMs,
            timedOut: productSourcingInitialTimedOut,
            fallbackUsed: productSourcingTextFallbackUsed,
            fallbackReason: productSourcingTextFallbackReason,
            candidateCount: aiSourcingCandidates.length,
            rolePoolCount: sourcingCandidatePools.length,
            retryAttempted: retryProductImagePreflightSummary !== null,
            retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
            retryTimedOut: retryProductSourcingTimedOut,
            retryFallbackUsed: retryProductSourcingTextFallbackUsed,
            retryFallbackReason: retryProductSourcingTextFallbackReason,
            retryProviderImageDownloadFailure,
            retryImageGateUsable: retryProductImagePreflightGate?.usable ?? null
          }),
          usable: false
        }
      })
      .eq("id", sourcingJob.id);

    redirect(
      `${redirectPath}?message=${encodeURIComponent(
        "We need one more catalogue pass before this shopping list is ready. Please try sourcing again."
      )}`
    );
  }

  const { data: existingList } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("room_id", roomId)
    .eq("concept_id", conceptId)
    .limit(1)
    .maybeSingle();

  const shoppingListResult = existingList
    ? { data: existingList, error: null }
    : await supabase
        .from("shopping_lists")
        .insert({
          room_id: roomId,
          concept_id: conceptId,
          status: "draft"
        })
        .select("id")
        .single();

  if (shoppingListResult.error) {
    throw new Error(shoppingListResult.error.message);
  }

  const shoppingListId = shoppingListResult.data.id;
  await supabase.from("shopping_list_items").delete().eq("shopping_list_id", shoppingListId);

  // Pre-select the AI's recommended product per role. If the AI does not pick
  // one, fall back to the top-ranked option so every role starts chosen.
  const selectedProductIdByRole = new Map<string, string>();
  for (const role of roleOptions) {
    if (localSkuFidelityMode && role.options[0]) {
      selectedProductIdByRole.set(role.category, role.options[0].id);
      continue;
    }

    const catalogueAnchorId = catalogueAnchorIdsByCategory.get(role.category);
    if (!localSkuFidelityMode && catalogueAnchorId && role.options.some((option) => option.id === catalogueAnchorId)) {
      selectedProductIdByRole.set(role.category, catalogueAnchorId);
      continue;
    }

    const roleResult = sourceRoleResultsByCategory.get(role.category);
    const roleResultOption = roleResult?.productId
      ? role.options.find((option) => option.id === roleResult.productId)
      : undefined;
    const aiPick = sourcingResult.selectedProducts.find(
      (selection) =>
        normalizeSourcingCategory(selection.category, selection.roleLabel) === role.category &&
        role.options.some((option) => option.id === selection.productId)
    );
    const aiPickOption = aiPick ? role.options.find((option) => option.id === aiPick.productId) : undefined;
    const themeAlignedPick = bestThemeAlignedOptionForRole({
      role,
      options: role.options,
      conceptText: visualConceptText,
      currentPick: roleResultOption ?? aiPickOption,
      localSkuFidelityMode
    });
    if (themeAlignedPick && themeAlignedPick.id !== (roleResultOption ?? aiPickOption)?.id) {
      selectedProductIdByRole.set(role.category, themeAlignedPick.id);
      continue;
    }

    if (roleResult?.productId && role.options.some((option) => option.id === roleResult.productId)) {
      selectedProductIdByRole.set(role.category, roleResult.productId);
      continue;
    }

    if (aiPick) {
      selectedProductIdByRole.set(role.category, aiPick.productId);
    } else if (role.options[0]) {
      const fallbackPick =
        bestThemeAlignedOptionForRole({
          role,
          options: role.options,
          conceptText: visualConceptText,
          currentPick: role.options[0],
          localSkuFidelityMode
        }) ?? role.options[0];
      selectedProductIdByRole.set(role.category, fallbackPick.id);
    }
  }

  const selectedFirstRoleOptions = roleOptions.map((role) => {
    const selectedId = selectedProductIdByRole.get(role.category);
    const selectedOption = selectedId ? role.options.find((option) => option.id === selectedId) : undefined;
    if (!selectedOption || role.options[0]?.id === selectedOption.id) {
      return role;
    }

    return {
      ...role,
      options: [selectedOption, ...role.options.filter((option) => option.id !== selectedOption.id)]
    };
  });

  const itemRows = buildShoppingListItemRows({
    roleOptions: selectedFirstRoleOptions,
    selectedProductIdByRole,
    reasonFor: (match) => {
      const sourceSelection = sourceSelectionsById.get(match.id);
      return [
        sourceSelection?.visualMatchReason ? `visual match: ${sourceSelection.visualMatchReason}` : null,
        sourceSelection?.mismatchNote ? `mismatch: ${sourceSelection.mismatchNote}` : null,
        match.selectionReason,
        ...match.warnings.filter((warning) => warning !== match.dimensionFitNote)
      ]
        .filter(Boolean)
        .join(" ");
    }
  });

  const { error: itemError } = await supabase
    .from("shopping_list_items")
    .insert(itemRows.map((row) => ({ ...row, shopping_list_id: shoppingListId })));

  if (itemError) {
    throw new Error(itemError.message);
  }

  const estimatedTotal = selectedItemsTotalAed(itemRows);
  await supabase
    .from("shopping_lists")
    .update({
      estimated_total_aed: estimatedTotal,
      updated_at: new Date().toISOString()
    })
    .eq("id", shoppingListId);
  if (localSkuFidelityMode && productMatchingEngineEnabled) {
    const sourceSelectedProductIdByCategory = new Map<string, string | null>();
    for (const result of sourcingResult.roleResults) {
      sourceSelectedProductIdByCategory.set(
        normalizeSourcingCategory(result.category, result.roleLabel),
        result.productId
      );
    }
    const conceptAnchorProductIdByCategory = new Map<string, string | null>();
    for (const anchor of catalogueGroundingAnchors) {
      if (anchor.priority !== "required") {
        continue;
      }
      conceptAnchorProductIdByCategory.set(
        normalizeSourcingCategory(anchor.category, anchor.roleLabel),
        anchor.productId
      );
    }

    const { data: currentSourcingJob } = await serviceSupabase
      .from("ai_jobs")
      .select("output_summary")
      .eq("id", sourcingJob.id)
      .maybeSingle();
    const currentSourcingSummary = isRecord(currentSourcingJob?.output_summary)
      ? currentSourcingJob.output_summary
      : {};

    const { error: persistedSelectionSnapshotError } = await serviceSupabase
      .from("ai_jobs")
      .update({
        output_summary: {
          ...currentSourcingSummary,
          productSourcingTimeoutDiagnostics:
            currentSourcingSummary.productSourcingTimeoutDiagnostics ??
            productSourcingTimeoutDiagnostics({
              attemptDurationMs: productSourcingInitialAttemptDurationMs,
              timedOut: productSourcingInitialTimedOut,
              fallbackUsed: productSourcingTextFallbackUsed,
              fallbackReason: productSourcingTextFallbackReason,
              candidateCount: aiSourcingCandidates.length,
              rolePoolCount: sourcingCandidatePools.length,
              retryAttempted: retryProductImagePreflightSummary !== null,
              retryAttemptDurationMs: retryProductSourcingAttemptDurationMs,
              retryTimedOut: retryProductSourcingTimedOut,
              retryFallbackUsed: retryProductSourcingTextFallbackUsed,
              retryFallbackReason: retryProductSourcingTextFallbackReason,
              retryProviderImageDownloadFailure,
              retryImageGateUsable: retryProductImagePreflightGate?.usable ?? null
            }),
          persistedSelectionSnapshot: buildPersistedSelectionSnapshot({
            shoppingListId,
            estimatedTotalAed: estimatedTotal,
            sourcePath: productSourcingTextFallbackUsed ? "text_fallback" : "visual",
            roleOptions: selectedFirstRoleOptions,
            itemRows,
            sourceSelectedProductIdByCategory,
            conceptAnchorProductIdByCategory
          })
        }
      })
      .eq("id", sourcingJob.id);
    if (persistedSelectionSnapshotError) {
      throw new Error(persistedSelectionSnapshotError.message);
    }
  }
  await supabase.from("rooms").update({ status: "sourcing" }).eq("id", roomId);

  revalidatePath(redirectPath);
  revalidatePath(successRedirectPath);
  redirect(successRedirectPath);
}

export async function substituteProductAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const shoppingListId = String(formData.get("shoppingListId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const mode = substitutionModeSchema.parse(String(formData.get("mode") ?? "cheaper"));
  const redirectPath = `/projects/${projectId}/rooms/${roomId}/product-matching`;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  await requireRoomCommerceAccess(roomId, redirectPath);
  const serviceSupabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, budget_max_aed")
    .eq("id", projectId)
    .single();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  const { data: shoppingList } = await supabase
    .from("shopping_lists")
    .select("id, concept_id")
    .eq("id", shoppingListId)
    .eq("room_id", roomId)
    .single();

  const { data: item } = await serviceSupabase
    .from("shopping_list_items")
    .select(
      `
      *,
      product:products(
        *,
        retailer:retailers(name, status),
        dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
      )
    `
    )
    .eq("id", itemId)
    .eq("shopping_list_id", shoppingListId)
    .single();

  if (!project || !room || !shoppingList?.concept_id || !item?.product) {
    redirect("/");
  }

  const { data: concept } = await supabase
    .from("concepts")
    .select("id, title, description")
    .eq("id", shoppingList.concept_id)
    .eq("room_id", roomId)
    .single();

  if (!concept) {
    redirect("/");
  }

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("wall_length_cm, room_depth_cm")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: selectedItems = [] } = await supabase
    .from("shopping_list_items")
    .select("product_id")
    .eq("shopping_list_id", shoppingListId);

  const { data: products = [], error: productsError } = await serviceSupabase
    .from("products")
    .select(
      `
      *,
      retailer:retailers(name, status),
      dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
    `
    )
    .not("price_aed", "is", null)
    .not("primary_image_url", "is", null)
    .order("last_checked_at", { ascending: false, nullsFirst: false })
    .limit(PRODUCT_MATCHING_CATALOG_LIMIT);

  if (productsError) {
    throw new Error(productsError.message);
  }

  const currentCandidate = productToMatchCandidate(item.product as ProductRow);
  const candidates = (products ?? [])
    .map(productToMatchCandidate)
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));

  if (!currentCandidate) {
    redirect(`${redirectPath}?message=${encodeURIComponent("The current product cannot be substituted yet.")}`);
  }

  const alternatives = filterSubstitutionCandidates({
    current: currentCandidate,
    candidates,
    mode,
    selectedProductIds: (selectedItems ?? []).map((selected) => selected.product_id)
  });

  const conceptText = `${concept.title}\n${concept.description ?? ""}`;
  const role = shoppingListRoleSpecFromRow(item);
  const ranked = roleScopedShoppingAlternates({
    roomType: room.room_type,
    conceptText,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? {
          wallLengthCm: measurements.wall_length_cm,
          roomDepthCm: measurements.room_depth_cm
        }
      : null,
    role,
    candidates: alternatives,
    excludeProductIds: new Set([currentCandidate.id]),
    limit: 1
  });
  const replacement = ranked[0];

  if (!replacement) {
    redirect(`${redirectPath}?message=${encodeURIComponent("No suitable replacement found for that line yet.")}`);
  }

  const previousPrice = Number(item.line_total_aed ?? item.unit_price_aed ?? 0);
  const unitPrice = replacement.salePriceAed ?? replacement.priceAed ?? 0;
  // The swap keeps the row's purchase quantity — a "Buy 2" role still buys 2.
  const lineTotal = unitPrice * item.quantity;
  const priceImpact = lineTotal - previousPrice;

  const { error: updateError } = await supabase
    .from("shopping_list_items")
    .update({
      product_id: replacement.id,
      category: replacement.categoryNormalized ?? item.category,
      unit_price_aed: unitPrice,
      line_total_aed: lineTotal,
      selection_reason: [
        replacement.selectionReason,
        ...replacement.warnings.filter((warning) => warning !== replacement.dimensionFitNote)
      ].join(" "),
      dimension_fit_note: replacement.dimensionFitNote,
      updated_at: new Date().toISOString()
    })
    .eq("id", item.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Estimate selected rows only — option pools must not inflate the total.
  const { data: updatedItems = [] } = await supabase
    .from("shopping_list_items")
    .select("status, unit_price_aed, quantity")
    .eq("shopping_list_id", shoppingListId);
  const estimatedTotal = selectedItemsTotalAed(updatedItems ?? []);

  await supabase
    .from("shopping_lists")
    .update({
      estimated_total_aed: estimatedTotal,
      updated_at: new Date().toISOString()
    })
    .eq("id", shoppingListId);

  const impactText =
    priceImpact === 0
      ? "no price change"
      : `${priceImpact > 0 ? "+" : "-"}${formatAedValue(Math.abs(priceImpact))}`;

  revalidatePath(redirectPath);
  redirect(`${redirectPath}?message=${encodeURIComponent(`Product swapped. Price impact: ${impactText}.`)}`);
}

async function recalculateShoppingListTotal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shoppingListId: string
) {
  const { data: rows } = await supabase
    .from("shopping_list_items")
    .select("status, unit_price_aed, quantity")
    .eq("shopping_list_id", shoppingListId);
  await supabase
    .from("shopping_lists")
    .update({
      estimated_total_aed: selectedItemsTotalAed(rows ?? []),
      updated_at: new Date().toISOString()
    })
    .eq("id", shoppingListId);
}

export async function selectShoppingItemAction(input: {
  projectId: string;
  roomId: string;
  shoppingListId: string;
  itemId: string;
}) {
  const { projectId, roomId, shoppingListId, itemId } = input;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: item } = await supabase
    .from("shopping_list_items")
    .select("id, category")
    .eq("id", itemId)
    .eq("shopping_list_id", shoppingListId)
    .single();

  if (!item) {
    return;
  }

  // One pick per role — clear the category's current selection, then set this.
  await supabase
    .from("shopping_list_items")
    .update({ status: "option" })
    .eq("shopping_list_id", shoppingListId)
    .eq("category", item.category)
    .eq("status", "selected");
  await supabase
    .from("shopping_list_items")
    .update({ status: "selected" })
    .eq("id", itemId)
    .eq("shopping_list_id", shoppingListId);

  await recalculateShoppingListTotal(supabase, shoppingListId);
  revalidatePath(`/projects/${projectId}/rooms/${roomId}/shopping-list`);
}

export async function rejectShoppingItemAction(input: {
  projectId: string;
  roomId: string;
  shoppingListId: string;
  itemId: string;
}) {
  const { projectId, roomId, shoppingListId, itemId } = input;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  await supabase
    .from("shopping_list_items")
    .update({ status: "rejected" })
    .eq("id", itemId)
    .eq("shopping_list_id", shoppingListId);

  await recalculateShoppingListTotal(supabase, shoppingListId);
  revalidatePath(`/projects/${projectId}/rooms/${roomId}/shopping-list`);
}

// Replace the non-selected options for a role while preserving the shopper's
// current pick. This keeps refresh scoped to exploration, not selection.
export async function refreshShoppingOptionsAction(input: {
  projectId: string;
  roomId: string;
  shoppingListId: string;
  category: string;
}) {
  const { projectId, roomId, shoppingListId, category } = input;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const shoppingListPath = `/projects/${projectId}/rooms/${roomId}/shopping-list`;

  const { data: shoppingList } = await supabase
    .from("shopping_lists")
    .select("id, concept_id")
    .eq("id", shoppingListId)
    .single();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  const { data: project } = await supabase
    .from("projects")
    .select("id, budget_max_aed")
    .eq("id", projectId)
    .single();

  if (!shoppingList?.concept_id || !room || !project) {
    return;
  }

  const { data: concept } = await supabase
    .from("concepts")
    .select("title, description")
    .eq("id", shoppingList.concept_id)
    .single();

  const { data: existingRows } = await supabase
    .from("shopping_list_items")
    .select(
      "id, product_id, status, role_label, role_visual_brief, role_priority, role_quantity, option_rank"
    )
    .eq("shopping_list_id", shoppingListId)
    .eq("category", category);

  const selectedRow = existingRows?.find((row) => row.status === "selected") ?? null;
  if (!concept || !existingRows || existingRows.length === 0 || !selectedRow) {
    return;
  }

  const usedProductIds = new Set(existingRows.map((row) => row.product_id));
  const template = existingRows.reduce(
    (best, row) => (row.option_rank > best.option_rank ? row : best),
    existingRows[0]
  );

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("wall_length_cm, room_depth_cm")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const serviceSupabase = createServiceClient();
  const { data: products } = await serviceSupabase
    .from("products")
    .select(
      `
      *,
      retailer:retailers(name, status),
      dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
    `
    )
    .not("price_aed", "is", null)
    .not("primary_image_url", "is", null)
    .order("last_checked_at", { ascending: false, nullsFirst: false })
    .limit(PRODUCT_MATCHING_CATALOG_LIMIT);

  const candidates = (products ?? [])
    .map(productToMatchCandidate)
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));

  const conceptText = `${concept.title}\n${concept.description ?? ""}`;
  const role = shoppingListRoleSpecFromRow({
    category,
    role_label: template.role_label,
    role_visual_brief: template.role_visual_brief,
    role_priority: template.role_priority,
    role_quantity: template.role_quantity
  });
  const fresh = roleScopedShoppingAlternates({
    roomType: room.room_type,
    conceptText,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? { wallLengthCm: measurements.wall_length_cm, roomDepthCm: measurements.room_depth_cm }
      : null,
    role,
    candidates,
    excludeProductIds: usedProductIds,
    limit: 2
  });

  if (fresh.length === 0) {
    return;
  }

  await supabase
    .from("shopping_list_items")
    .update({ status: "rejected" })
    .eq("shopping_list_id", shoppingListId)
    .eq("category", category)
    .neq("status", "selected");

  const rows = fresh.map((match, index) => {
    const unitPrice = match.salePriceAed ?? match.priceAed ?? 0;
    const optionRank = template.option_rank + 1 + index;
    return {
      shopping_list_id: shoppingListId,
      product_id: match.id,
      category,
      status: "option" as const,
      role_label: template.role_label,
      role_visual_brief: template.role_visual_brief,
      role_priority: template.role_priority,
      role_quantity: template.role_quantity,
      option_rank: optionRank,
      quantity: template.role_quantity,
      unit_price_aed: unitPrice,
      line_total_aed: unitPrice * template.role_quantity,
      selection_reason: [
        match.selectionReason,
        ...match.warnings.filter((warning) => warning !== match.dimensionFitNote)
      ]
        .filter(Boolean)
        .join(" "),
      dimension_fit_note: match.dimensionFitNote,
      sort_order: optionRank
    };
  });

  await supabase.from("shopping_list_items").insert(rows);
  revalidatePath(shoppingListPath);
}

// Rare path: every loaded option for a role was rejected. Rank the catalog for
// that category, skip products already in the list, and append fresh options.
export async function findMoreShoppingOptionsAction(input: {
  projectId: string;
  roomId: string;
  shoppingListId: string;
  category: string;
}) {
  const { projectId, roomId, shoppingListId, category } = input;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const shoppingListPath = `/projects/${projectId}/rooms/${roomId}/shopping-list`;

  const { data: shoppingList } = await supabase
    .from("shopping_lists")
    .select("id, concept_id")
    .eq("id", shoppingListId)
    .single();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  const { data: project } = await supabase
    .from("projects")
    .select("id, budget_max_aed")
    .eq("id", projectId)
    .single();

  if (!shoppingList?.concept_id || !room || !project) {
    return;
  }

  const { data: concept } = await supabase
    .from("concepts")
    .select("title, description")
    .eq("id", shoppingList.concept_id)
    .single();

  const { data: existingRows } = await supabase
    .from("shopping_list_items")
    .select("product_id, role_label, role_visual_brief, role_priority, role_quantity, option_rank")
    .eq("shopping_list_id", shoppingListId)
    .eq("category", category);

  if (!concept || !existingRows || existingRows.length === 0) {
    return;
  }

  const usedProductIds = new Set(existingRows.map((row) => row.product_id));
  const template = existingRows.reduce(
    (best, row) => (row.option_rank > best.option_rank ? row : best),
    existingRows[0]
  );

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("wall_length_cm, room_depth_cm")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const serviceSupabase = createServiceClient();
  const { data: products } = await serviceSupabase
    .from("products")
    .select(
      `
      *,
      retailer:retailers(name, status),
      dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
    `
    )
    .not("price_aed", "is", null)
    .not("primary_image_url", "is", null)
    .order("last_checked_at", { ascending: false, nullsFirst: false })
    .limit(PRODUCT_MATCHING_CATALOG_LIMIT);

  const candidates = (products ?? [])
    .map(productToMatchCandidate)
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));

  const conceptText = `${concept.title}\n${concept.description ?? ""}`;
  const role = shoppingListRoleSpecFromRow({
    category,
    role_label: template.role_label,
    role_visual_brief: template.role_visual_brief,
    role_priority: template.role_priority,
    role_quantity: template.role_quantity
  });
  const fresh = roleScopedShoppingAlternates({
    roomType: room.room_type,
    conceptText,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? { wallLengthCm: measurements.wall_length_cm, roomDepthCm: measurements.room_depth_cm }
      : null,
    role,
    candidates,
    excludeProductIds: usedProductIds,
    limit: 3
  });

  if (fresh.length > 0) {
    const rows = fresh.map((match, index) => {
      const unitPrice = match.salePriceAed ?? match.priceAed ?? 0;
      const optionRank = template.option_rank + 1 + index;
      return {
        shopping_list_id: shoppingListId,
        product_id: match.id,
        category,
        status: "option" as const,
        role_label: template.role_label,
        role_visual_brief: template.role_visual_brief,
        role_priority: template.role_priority,
        role_quantity: template.role_quantity,
        option_rank: optionRank,
        quantity: template.role_quantity,
        unit_price_aed: unitPrice,
        line_total_aed: unitPrice * template.role_quantity,
        selection_reason: [
          match.selectionReason,
          ...match.warnings.filter((warning) => warning !== match.dimensionFitNote)
        ]
          .filter(Boolean)
          .join(" "),
        dimension_fit_note: match.dimensionFitNote,
        sort_order: optionRank
      };
    });

    await supabase.from("shopping_list_items").insert(rows);
  }

  revalidatePath(shoppingListPath);
}

export async function generateFinalRenderAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const conceptId = String(formData.get("conceptId") ?? "");
  const shoppingListId = String(formData.get("shoppingListId") ?? "");
  const redirectPath = `/projects/${projectId}/rooms/${roomId}/product-matching`;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const serviceSupabase = createServiceClient();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  const { data: concept } = await supabase
    .from("concepts")
    .select("id, title, description, status, primary_image_asset:room_assets!concepts_primary_image_asset_id_fkey(*)")
    .eq("id", conceptId)
    .eq("room_id", roomId)
    .single();

  const { data: shoppingList } = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("id", shoppingListId)
    .eq("room_id", roomId)
    .eq("concept_id", conceptId)
    .single();

  if (!room || !concept || !shoppingList) {
    redirect("/");
  }

  const { data: roomPhoto } = await supabase
    .from("room_assets")
    .select("*")
    .eq("room_id", roomId)
    .eq("asset_type", "room_photo")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!roomPhoto) {
    redirect(`${redirectPath}?message=${encodeURIComponent("Upload a room photo before final rendering.")}`);
  }

  const { data: roomBlob, error: roomDownloadError } = await supabase.storage
    .from("room-assets")
    .download(roomPhoto.storage_path);

  if (roomDownloadError || !roomBlob) {
    redirect(`${redirectPath}?message=${encodeURIComponent("The original room photo could not be prepared for final rendering.")}`);
  }
  const conceptImageAsset = Array.isArray(concept.primary_image_asset)
    ? concept.primary_image_asset[0]
    : concept.primary_image_asset;
  const { data: conceptBlob } = conceptImageAsset?.storage_path
    ? await serviceSupabase.storage
        .from("generated-renders")
        .download(conceptImageAsset.storage_path)
    : { data: null };

  const selectedItemIdsRaw = formData.get("selectedItemIds")?.toString() ?? "";
  const selectedItemIds = selectedItemIdsRaw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  let itemsQuery = serviceSupabase
    .from("shopping_list_items")
    .select(
      `
      *,
      product:products(
        *,
        retailer:retailers(name, status),
        dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
      )
    `
    )
    .eq("shopping_list_id", shoppingListId)
    .neq("status", "rejected");

  if (selectedItemIds.length > 0) {
    // The picker passed an explicit selection — render exactly those pieces.
    itemsQuery = itemsQuery.in("id", selectedItemIds);
  } else {
    // No explicit picks — fall back to the sourced selected options.
    itemsQuery = itemsQuery.eq("status", "selected");
  }

  const { data: items = [] } = await itemsQuery.order("sort_order", { ascending: true });

  const selectedProducts = (items ?? []).filter((item) => item.product);

  if (selectedProducts.length === 0) {
    redirect(`${redirectPath}?message=${encodeURIComponent("Match products before final rendering.")}`);
  }

  if (localSkuFidelityModeEnabled(room.room_type)) {
    const missingRenderSupportRoles = missingLocalSkuFidelityRenderRoles({
      roomType: room.room_type,
      selectedCategories: selectedProducts.map((item) => item.category)
    });
    if (missingRenderSupportRoles.length > 0) {
      redirect(
        `${redirectPath}?message=${encodeURIComponent(
          `Complete product sourcing before final rendering. Missing: ${missingRenderSupportRoles.join(", ")}.`
        )}`
      );
    }
  }

  const invalidProducts = selectedProducts.filter((item) => !productToMatchCandidate(item.product as ProductRow));
  if (invalidProducts.length > 0) {
    redirect(
      `${redirectPath}?message=${encodeURIComponent(
        "Refresh product matching before final rendering. One or more selected products are unavailable."
      )}`
    );
  }

  const selectedShoppingItemIds = selectedProducts.map((item) => item.id).sort();
  const selectionKey = selectedShoppingItemIds.join(",");
  const revealPath = `/projects/${projectId}/rooms/${roomId}/presentation`;
  const revealPathForRenderJob = (renderJobId: string) =>
    `${revealPath}?renderJobId=${encodeURIComponent(renderJobId)}`;
  const commerceUnlocked = await canAccessRoomCommerce(roomId);
  const { data: matchingRenderJobs = [] } = await supabase
    .from("render_jobs")
    .select("id, status, output_asset_ids, input_summary, created_at")
    .eq("room_id", roomId)
    .eq("concept_id", conceptId)
    .eq("shopping_list_id", shoppingListId)
    .contains("input_summary", { selectionKey })
    .order("created_at", { ascending: false })
    .limit(1);
  const matchingRenderJob = matchingRenderJobs?.[0] ?? null;

  if (matchingRenderJob?.status === "running" || matchingRenderJob?.status === "queued") {
    const startedAt = matchingRenderJob.created_at ? Date.parse(matchingRenderJob.created_at) : Date.now();
    const isStale = Number.isFinite(startedAt) && Date.now() - startedAt > FINAL_RENDER_STALE_MS;

    if (!isStale) {
      redirect(
        `${revealPathForRenderJob(matchingRenderJob.id)}&message=${encodeURIComponent(
          "Final render is already running."
        )}`
      );
    }

    // Atomic compare-and-swap: only fail the job if it is STILL running/queued. Filtering on the
    // status (not just id) closes the race where the original after() task finishes between our
    // read above and this write — otherwise we would flip a freshly-succeeded job back to failed
    // and start a duplicate render. If we did not win the transition, the render resolved on its
    // own; defer to whatever it became rather than starting a new one.
    const { data: failedRows } = await supabase
      .from("render_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "Final render timed out before completion. Please retry."
      })
      .eq("id", matchingRenderJob.id)
      .in("status", ["running", "queued"])
      .select("id");

    if (!failedRows || failedRows.length === 0) {
      redirect(revealPathForRenderJob(matchingRenderJob.id));
    }
  }

  if (
    matchingRenderJob?.status === "succeeded" &&
    (matchingRenderJob.output_asset_ids?.length ?? 0) > 0 &&
    !commerceUnlocked
  ) {
    redirect(`${revealPathForRenderJob(matchingRenderJob.id)}&message=${encodeURIComponent("Final render is ready.")}`);
  }

  const productIds = selectedProducts.map((item) => item.product!.id);
  const { data: renderJob, error: renderJobError } = await supabase
    .from("render_jobs")
    .insert({
      room_id: roomId,
      concept_id: conceptId,
      shopping_list_id: shoppingListId,
      status: "running",
      input_asset_ids: [roomPhoto.id],
      product_ids: productIds,
      input_summary: {
        selectionKey,
        selectedShoppingItemIds,
        productCount: selectedProducts.length,
        conceptTitle: concept.title
      }
    })
    .select("id")
    .single();

  if (renderJobError) {
    if (renderJobError.code === "23505") {
      redirect(`${revealPath}?message=${encodeURIComponent("Final render is already running.")}`);
    }

    throw new Error(renderJobError.message);
  }

  after(async () => {
    try {
      const productReferencesForRender = productReferenceOrderingV2Enabled()
        ? sortProductsForRenderReferences(selectedProducts, room.room_type)
        : selectedProducts;
      const renderReferenceLimit = localSkuFidelityModeEnabled(room.room_type)
        ? LOCAL_SKU_FIDELITY_RENDER_REFERENCE_LIMIT
        : 8;
      const productsForRender = await Promise.all(
        productReferencesForRender.slice(0, renderReferenceLimit).map(async (item) => {
          const product = item.product!;
          const image = product.primary_image_url
            ? await fetchRemoteImage(product.primary_image_url)
            : null;
          const dimensions = formatProductDimensionsForRender(product.dimensions?.[0] ?? null);

          return {
            name: product.name,
            retailerName: product.retailer?.name ?? "Retailer",
            category: item.category,
            roleLabel: item.role_label ?? roleLabelFromSelectionReason(item.selection_reason) ?? item.category,
            visualMatchReason: item.selection_reason,
            description: product.description,
            priceAed: item.unit_price_aed,
            dimensions,
            imageBytes: image?.bytes ?? null,
            imageMimeType: image?.mimeType ?? null,
            imageUrl: product.primary_image_url ?? null
          };
        })
      );
      const { data: signedRoomPhotoForRender } = await serviceSupabase.storage
        .from("room-assets")
        .createSignedUrl(roomPhoto.storage_path, 60 * 30);
      const { data: signedConceptImageForRender } = conceptImageAsset?.storage_path
        ? await serviceSupabase.storage
            .from("generated-renders")
            .createSignedUrl(conceptImageAsset.storage_path, 60 * 30)
        : { data: null };
      const { data: renderDesignBrief } = await serviceSupabase
        .from("design_briefs")
        .select("structured_json")
        .eq("room_id", roomId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const renderSpatialIntent = parseSpatialIntent(renderDesignBrief?.structured_json, room.room_type);
      const renderSpatialIntentPrompt = {
        focalPoint: renderSpatialIntent.focalPoint,
        seatingPriority: renderSpatialIntent.seatingPriority,
        diningSeatCount: renderSpatialIntent.diningSeatCount,
        mustKeepClear: renderSpatialIntent.mustKeepClear
      };
      const renderInput = {
        roomType: room.room_type,
        spatialIntent: renderSpatialIntentPrompt,
        roomPhotoBytes: Buffer.from(await roomBlob.arrayBuffer()),
        roomPhotoMimeType: roomPhoto.mime_type,
        roomPhotoUrl: signedRoomPhotoForRender?.signedUrl ?? null,
        conceptImageBytes: conceptBlob ? Buffer.from(await conceptBlob.arrayBuffer()) : null,
        conceptImageMimeType: conceptImageAsset?.mime_type ?? null,
        conceptImageUrl: signedConceptImageForRender?.signedUrl ?? null,
        conceptTitle: concept.title,
        conceptDescription: concept.description,
        products: productsForRender
      };
      let result = await generateFinalGroundedRender(renderInput);

      // Post-render spatial QA: one corrective retry on a hard fail, then keep
      // the better of the two attempts. QA failure never fails the render.
      let renderQaVerdict: string | null = null;
      let renderQaIssues: string[] = [];
      let renderQaRegenerated = false;
      try {
        let qa = await assessRenderSpatialQuality({
          imageUrl: await visionImageDataUrl(Buffer.from(result.imageBase64, "base64"), "image/png"),
          roomType: room.room_type,
          spatialIntent: renderSpatialIntentPrompt
        });
        if (qa.qa.verdict === "regenerate" && qa.qa.issues.length > 0) {
          const retryResult = await generateFinalGroundedRender({
            ...renderInput,
            promptSuffix: spatialQaCorrectionLanguage([...qa.qa.issues])
          });
          const retryQa = await assessRenderSpatialQuality({
            imageUrl: await visionImageDataUrl(Buffer.from(retryResult.imageBase64, "base64"), "image/png"),
            roomType: room.room_type,
            spatialIntent: renderSpatialIntentPrompt
          });
          if (retryQa.qa.verdict !== "regenerate") {
            result = retryResult;
            qa = retryQa;
            renderQaRegenerated = true;
          }
        }
        renderQaVerdict = qa.qa.verdict;
        renderQaIssues = [...qa.qa.issues];
      } catch (error) {
        console.error("Final render spatial QA failed; shipping unreviewed render.", error);
      }
      const renderPath = `${user.id}/${roomId}/final-${renderJob.id}.png`;
      const { error: uploadError } = await serviceSupabase.storage
        .from("generated-renders")
        .upload(renderPath, Buffer.from(result.imageBase64, "base64"), {
          contentType: "image/png",
          upsert: true
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: renderAsset, error: renderAssetError } = await serviceSupabase
        .from("room_assets")
        .insert({
          room_id: roomId,
          asset_type: "final_render",
          storage_path: renderPath,
          mime_type: "image/png",
          is_primary: false
        })
        .select("id")
        .single();

      if (renderAssetError) {
        throw new Error(renderAssetError.message);
      }

      // Only record success if THIS job is still running. If a stale-retry reclaimed it (flipped
      // it to failed) while we were rendering, the `.eq("status", "running")` filter matches no
      // rows — do not resurrect the reclaimed job (that would duplicate work and leave two
      // succeeded jobs for one selection); discard the render we just produced instead.
      const { data: completedRows } = await serviceSupabase
        .from("render_jobs")
        .update({
          status: "succeeded",
          completed_at: new Date().toISOString(),
          prompt_key: result.promptKey,
          prompt_version: result.promptVersion,
          model: result.imageModel,
          output_asset_ids: [renderAsset.id],
          input_summary: {
            selectionKey,
            selectedShoppingItemIds,
            productCount: selectedProducts.length,
            productImageReferencesUsed: productsForRender.filter((product) => product.imageBytes).length,
            revisedPrompt: result.revisedPrompt ?? null,
            imageProvider: result.imageProvider,
            imageModel: result.imageModel,
            imagePromptVersion: result.promptVersion,
            imageLatencySeconds: result.imageLatencySeconds,
            imageFallbackUsed: result.imageFallbackUsed,
            imageFallbackError: result.imageFallbackError ?? null,
            spatialQaVerdict: renderQaVerdict,
            spatialQaIssues: renderQaIssues,
            spatialQaRegenerated: renderQaRegenerated
          }
        })
        .eq("id", renderJob.id)
        .eq("status", "running")
        .select("id");

      if (!completedRows || completedRows.length === 0) {
        await serviceSupabase.storage.from("generated-renders").remove([renderPath]);
        await serviceSupabase.from("room_assets").delete().eq("id", renderAsset.id);
        return;
      }

      await serviceSupabase.from("rooms").update({ status: "rendering" }).eq("id", roomId);
      revalidatePath(revealPath);
    } catch (error) {
      // Same guard: never overwrite a job that was already reclaimed/finalised by another path.
      await serviceSupabase
        .from("render_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : "Final render generation failed."
        })
        .eq("id", renderJob.id)
        .eq("status", "running");
      revalidatePath(revealPath);
    }
  });

  revalidatePath(redirectPath);
  revalidatePath(revealPath);
  redirect(`${revealPathForRenderJob(renderJob.id)}&message=${encodeURIComponent("Final render started.")}`);
}

export async function reviseConceptAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const conceptId = String(formData.get("conceptId") ?? "");
  const critique = String(formData.get("critique") ?? "").trim();
  const redirectPath = `/projects/${projectId}/rooms/${roomId}/concepts`;

  if (critique.length < 8) {
    redirect(`${redirectPath}?message=${encodeURIComponent("Add a specific critique before revising.")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  const { data: concept } = await supabase
    .from("concepts")
    .select("*")
    .eq("id", conceptId)
    .eq("room_id", roomId)
    .single();

  if (!room || !concept) {
    redirect("/");
  }

  if (concept.generation_job_id) {
    const serviceSupabase = createServiceClient();
    const anchors = await catalogueGroundingAnchorsForConcept({
      serviceSupabase,
      generationJobId: concept.generation_job_id
    });

    if (anchors.length > 0) {
      redirect(
        `${redirectPath}?message=${encodeURIComponent(
          "This room direction is ready for sourcing. To make changes, adjust selected pieces after the shopping list is built."
        )}`
      );
    }
  }

  const { data: designBrief } = await supabase
    .from("design_briefs")
    .select("*")
    .eq("id", concept.design_brief_id)
    .single();

  if (!designBrief) {
    redirect(`/projects/${projectId}/rooms/${roomId}/brief`);
  }

  const { error: critiqueError } = await supabase.from("concept_critiques").insert({
    concept_id: concept.id,
    critique_text: critique,
    created_by_user_id: user.id
  });

  if (critiqueError) {
    throw new Error(critiqueError.message);
  }

  const { data: roomPhoto } = await supabase
    .from("room_assets")
    .select("*")
    .eq("room_id", roomId)
    .eq("asset_type", "room_photo")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!roomPhoto) {
    redirect(`/projects/${projectId}/rooms/${roomId}/photos`);
  }

  const { data: signedPhoto } = await supabase.storage
    .from("room-assets")
    .createSignedUrl(roomPhoto.storage_path, 60 * 30);

  const { data: photoBlob, error: downloadError } = await supabase.storage
    .from("room-assets")
    .download(roomPhoto.storage_path);

  if (!signedPhoto?.signedUrl || downloadError || !photoBlob) {
    redirect(`${redirectPath}?message=${encodeURIComponent("The original room photo could not be prepared for revision.")}`);
  }

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: answeredQuestions = [] } = await supabase
    .from("clarifying_questions")
    .select("question, answer")
    .eq("design_brief_id", designBrief.id)
    .eq("status", "answered")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const serviceSupabase = createServiceClient();
  const { data: job, error: jobError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: user.id,
      room_id: roomId,
      job_type: "concept_revision",
      status: "running",
      provider: configuredImageProvider(),
      model: `${process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini"} + ${configuredImageModel()}`,
      prompt_version: null,
      input_summary: {
        roomId,
        parentConceptId: concept.id,
        critiqueLength: critique.length
      }
    })
    .select("id")
    .single();

  if (jobError) {
    throw new Error(jobError.message);
  }

  try {
    const revisionPhotoBytes = Buffer.from(await photoBlob.arrayBuffer());
    const result = await generateConceptRevision({
      roomType: room.room_type,
      roomPhotoUrl: await visionImageDataUrl(revisionPhotoBytes, roomPhoto.mime_type),
      roomPhotoReferenceUrl: signedPhoto.signedUrl,
      roomPhotoBytes: revisionPhotoBytes,
      roomPhotoMimeType: roomPhoto.mime_type,
      styleNotes: designBrief.style_notes,
      colorNotes: designBrief.color_notes,
      budgetNotes: designBrief.budget_notes,
      functionalRequirements: designBrief.functional_requirements,
      avoidNotes: designBrief.avoid_notes,
      inspirationNotes: designBrief.inspiration_notes,
      clarifyingAnswers: (answeredQuestions ?? [])
        .filter((question) => question.answer)
        .map((question) => ({
          question: question.question,
          answer: question.answer ?? ""
        })),
      measurements: measurements
        ? {
            wallLengthCm: measurements.wall_length_cm,
            roomDepthCm: measurements.room_depth_cm,
            ceilingHeightCm: measurements.ceiling_height_cm,
            notes: measurements.notes
          }
        : null,
      previousConcept: {
        title: concept.title,
        description: concept.description
      },
      critique
    });

    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        provider: result.imageProvider,
        model: `${result.textModel} + ${result.imageModel}`,
        prompt_version: result.promptVersion,
        output_summary: {
          promptKey: result.promptKey,
          title: result.concept.title,
          parentConceptId: concept.id,
          revisedPrompt: result.revisedPrompt ?? null,
          imageProvider: result.imageProvider,
          imageModel: result.imageModel,
          imageLatencySeconds: result.imageLatencySeconds,
          imageFallbackUsed: result.imageFallbackUsed,
          imageFallbackError: result.imageFallbackError ?? null
        }
      })
      .eq("id", job.id);

    const { data: revisedConcept, error: conceptError } = await supabase
      .from("concepts")
      .insert({
        room_id: roomId,
        design_brief_id: designBrief.id,
        parent_concept_id: concept.id,
        generation_job_id: job.id,
        title: result.concept.title,
        description: [
          result.concept.rationale,
          "",
          `Uncertainty: ${result.concept.uncertaintyNote}`
        ].join("\n"),
        status: "generated"
      })
      .select("id")
      .single();

    if (conceptError) {
      throw new Error(conceptError.message);
    }

    const renderPath = `${user.id}/${roomId}/${revisedConcept.id}.png`;
    const { error: uploadError } = await serviceSupabase.storage
      .from("generated-renders")
      .upload(renderPath, Buffer.from(result.imageBase64, "base64"), {
        contentType: "image/png",
        upsert: true
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: renderAsset, error: renderAssetError } = await supabase
      .from("room_assets")
      .insert({
        room_id: roomId,
        asset_type: "concept_render",
        storage_path: renderPath,
        mime_type: "image/png",
        is_primary: true
      })
      .select("id")
      .single();

    if (renderAssetError) {
      throw new Error(renderAssetError.message);
    }

    await supabase
      .from("concepts")
      .update({ primary_image_asset_id: renderAsset.id })
      .eq("id", revisedConcept.id);

    // A revision is the room's new current direction. Clear the prior
    // selection so the concepts page surfaces this revision as the hero
    // instead of the now-superseded concept it was revised from.
    await supabase
      .from("concepts")
      .update({ status: "generated" })
      .eq("room_id", roomId)
      .eq("status", "selected");

    const revisionImageBytes = Buffer.from(result.imageBase64, "base64");
    after(async () => {
      await generateAndStoreConceptViews({
        serviceSupabase,
        userId: user.id,
        roomId,
        conceptId: revisedConcept.id,
        roomType: room.room_type,
        conceptTitle: result.concept.title,
        conceptDescription: result.concept.rationale,
        conceptGenerationPrompt: result.concept.generationPrompt,
        heroImageBytes: revisionImageBytes,
        heroImageStoragePath: renderPath
      });
      revalidatePath(redirectPath);
    });
  } catch (error) {
    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Concept revision failed."
      })
      .eq("id", job.id);

    redirect(`${redirectPath}?message=${encodeURIComponent("Concept revision failed. The critique was saved.")}`);
  }

  revalidatePath(redirectPath);
  redirect(`${redirectPath}?message=${encodeURIComponent("Revised concept generated.")}`);
}

type ProductRow = Database["public"]["Tables"]["products"]["Row"] & {
  retailer: { name: string; status?: string | null } | null;
  dimensions:
    | Array<{
        width_cm: number | null;
        depth_cm: number | null;
        height_cm: number | null;
        source_text: string | null;
      }>
    | null;
};
type DesignBriefRow = Database["public"]["Tables"]["design_briefs"]["Row"];
type AnsweredQuestionRow = {
  question: string;
  answer: string | null;
};
type CatalogueReferenceImage = {
  bytes: Buffer;
  mimeType: string;
};
type CatalogueGroundingProduct = {
  role: RoomProductRoleSpec;
  match: RankedProductMatch & {
    attributeScore: {
      total: number;
      color: number;
      material: number;
      style: number;
      silhouette: number;
      weaknessReasons: string[];
    };
  };
  referenceImage: CatalogueReferenceImage;
};
type CatalogueGroundingAnchor = {
  productId: string;
  category: string;
  roleLabel: string;
  priority: "required" | "supporting";
  selectionReason: string;
};
type CatalogueCueRequirements = {
  color: boolean;
  material: boolean;
  shape: boolean;
  style: boolean;
};

async function fetchCatalogueGroundingProductWindow({
  serviceSupabase,
  roles
}: {
  serviceSupabase: ReturnType<typeof createServiceClient>;
  roles: RoomProductRoleSpec[];
}) {
  const categories = Array.from(new Set(roles.flatMap((role) => Array.from(scopedCategoriesForProductRole(role)))));
  const productsById = new Map<string, ProductRow>();

  for (const category of categories) {
    const { data: products = [], error } = await serviceSupabase
      .from("products")
      .select(
        `
        *,
        retailer:retailers(name, status),
        dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
      `
      )
      .eq("category_normalized", category)
      .not("price_aed", "is", null)
      .not("primary_image_url", "is", null)
      .order("last_checked_at", { ascending: false, nullsFirst: false })
      .limit(CATALOGUE_GROUNDED_CONCEPT_PRODUCTS_PER_CATEGORY);

    if (error) {
      throw new Error(error.message);
    }

    for (const product of products ?? []) {
      productsById.set(product.id, product as ProductRow);
    }
  }

  return Array.from(productsById.values());
}

async function fetchProductsById({
  serviceSupabase,
  productIds
}: {
  serviceSupabase: ReturnType<typeof createServiceClient>;
  productIds: string[];
}) {
  if (productIds.length === 0) {
    return [];
  }

  const { data: products = [], error } = await serviceSupabase
    .from("products")
    .select(
      `
      *,
      retailer:retailers(name, status),
      dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
    `
    )
    .in("id", productIds);

  if (error) {
    throw new Error(error.message);
  }

  return (products ?? []) as ProductRow[];
}

async function fetchLocalSkuFidelityRoleWindowCandidates({
  serviceSupabase,
  roomType,
  roles,
  conceptText
}: {
  serviceSupabase: ReturnType<typeof createServiceClient>;
  roomType: string;
  roles: RoomProductRoleSpec[];
  conceptText: string;
}) {
  const productsById = new Map<string, ProductRow>();

  for (const role of roles) {
    const category = normalizeSourcingCategory(role.category, role.label);
    const { data: categoryProducts = [], error } = await serviceSupabase
      .from("products")
      .select(
        `
        *,
        retailer:retailers(name, status),
        dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
      `
      )
      .eq("category_normalized", category)
      .not("price_aed", "is", null)
      .not("primary_image_url", "is", null)
      .order("last_checked_at", { ascending: false, nullsFirst: false })
      .limit(250);

    if (error) {
      throw new Error(error.message);
    }

    const candidates = (categoryProducts ?? [])
      .map(productToMatchCandidate)
      .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));
    const ranked = rankMatchesForLocalSkuFidelity({
      ranked: rankProductMatches({
        roomType,
        conceptText,
        candidates
      }),
      roles: [role],
      roomType,
      conceptText,
      roomMeasurements: null
    });

    for (const match of ranked.slice(0, 60)) {
      const product = categoryProducts?.find((candidate) => candidate.id === match.id);
      if (product) {
        productsById.set(product.id, product as ProductRow);
      }
    }
  }

  return Array.from(productsById.values())
    .map(productToMatchCandidate)
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));
}

async function buildCatalogueGroundedConceptPlan({
  serviceSupabase,
  roomType,
  budgetMaxAed,
  roomMeasurements,
  designBrief,
  answeredQuestions
}: {
  serviceSupabase: ReturnType<typeof createServiceClient>;
  roomType: string;
  budgetMaxAed: number | null;
  roomMeasurements: {
    wallLengthCm: number | null;
    roomDepthCm: number | null;
  } | null;
  designBrief: DesignBriefRow;
  answeredQuestions: AnsweredQuestionRow[];
}) {
  const rawCueText = catalogueGroundingCueText({ designBrief, answeredQuestions });
  // "avoid purple and bright red" must not read as positive purple/red cues:
  // strip avoid-clauses from the scoring text and enforce them structurally.
  const { cueText, avoidColorTags } = splitAvoidColorCues(rawCueText);
  const cueRequirements = catalogueCueRequirements(cueText);
  const anchorRoles = enhancedProductRolesForRoom(roomType)
    .filter((role) => role.importance === "anchor" || role.required)
    .map((role): RoomProductRoleSpec => ({
      category: role.category,
      label: role.label,
      visualBrief: [role.visualBrief ?? role.label, cueText ? `User-selected cues: ${cueText}` : null]
        .filter(Boolean)
        .join(". "),
      quantity: role.quantity,
      priority: role.required || role.includeWhen === "always" ? "required" : "supporting"
    }));
  const products = await fetchCatalogueGroundingProductWindow({
    serviceSupabase,
    roles: anchorRoles
  });
  const candidates = products
    .map((product) => productToMatchCandidate(product))
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));

  if (candidates.length === 0) {
    return {
      products: [],
      blockers: [catalogUnavailableMessage(products)],
      summary: {
        enabled: true,
        selectedProductCount: 0,
        blockerCount: 1,
        roles: []
      }
    };
  }
  const conceptText = [cueText, designBrief.style_notes, designBrief.color_notes, designBrief.functional_requirements]
    .filter(Boolean)
    .join("\n");
  const aestheticGateEnabled = localSkuFidelityModeEnabled(roomType);
  const plan = buildProductSourcingRuntimePlan({
    engineEnabled: true,
    roomType,
    conceptText,
    roles: anchorRoles,
    candidates,
    avoidColorTags,
    budgetMaxAed,
    roomMeasurements,
    candidatesPerRole: aestheticGateEnabled ? 36 : CATALOGUE_GROUNDED_CONCEPT_CANDIDATES_PER_ROLE,
    flatCandidateLimit: aestheticGateEnabled ? 96 : CATALOGUE_GROUNDED_CONCEPT_FLAT_CANDIDATE_LIMIT
  });
  const roleScopedPools = aestheticGateEnabled
    ? plan.roleScopedPools.map((pool) => rerankRolePoolForAestheticFit(pool, roomType, conceptText))
    : plan.roleScopedPools;
  const selected: CatalogueGroundingProduct[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  // Wall-clock ceiling across all roles' reference-image fetches (see the constant).
  const imageFetchDeadline = Date.now() + CATALOGUE_GROUNDED_CONCEPT_IMAGE_FETCH_BUDGET_MS;

  for (const pool of roleScopedPools) {
    let selectedCandidate: (typeof pool.candidates)[number] | null = null;
    let selectedReferenceImage: CatalogueReferenceImage | null = null;
    let accessibleFallback:
      | {
          candidate: (typeof pool.candidates)[number];
          referenceImage: CatalogueReferenceImage;
        }
      | null = null;

    for (const candidate of pool.candidates) {
      let aestheticScoreAdjustment = 0;
      if (hasHardCatalogueGroundingContradiction(candidate.attributeScore.weaknessReasons)) {
        warnings.push(
          `${pool.role.label}: skipped ${candidate.name} on hard cue contradiction (${candidate.attributeScore.weaknessReasons.join("; ")}).`
        );
        continue;
      }

      if (aestheticGateEnabled) {
        const aestheticFit = assessAestheticFitForRole({
          candidate,
          role: pool.role,
          roomType,
          conceptText,
          companionCandidates: selected.map(({ match }) => match)
        });
        aestheticScoreAdjustment = aestheticFit.scoreAdjustment;
        if (aestheticFit.unsuitableHero) {
          warnings.push(`${pool.role.label}: skipped aesthetically unsuitable catalogue candidate (${candidate.name}).`);
          continue;
        }
      }

      if (Date.now() > imageFetchDeadline) {
        warnings.push(
          `${pool.role.label}: reference-image fetch budget exhausted; stopped evaluating further candidates.`
        );
        break;
      }

      const referenceImage = candidate.primaryImageUrl ? await fetchRemoteImage(candidate.primaryImageUrl) : null;
      if (!referenceImage) {
        warnings.push(`${pool.role.label}: skipped catalogue candidate without a fetchable reference image.`);
        continue;
      }

      if (isEntryPriceCatalogueGroundingAnchor(candidate, pool.role) && aestheticScoreAdjustment < 40) {
        accessibleFallback ??= {
          candidate,
          referenceImage
        };
        warnings.push(`${pool.role.label}: held entry-price catalogue candidate as fallback.`);
        continue;
      }

      selectedCandidate = candidate;
      selectedReferenceImage = referenceImage;
      break;
    }

    if (!selectedCandidate && accessibleFallback) {
      selectedCandidate = accessibleFallback.candidate;
      selectedReferenceImage = accessibleFallback.referenceImage;
      warnings.push(`${pool.role.label}: used entry-price catalogue candidate because stronger image-backed options were unavailable.`);
    }

    if (!selectedCandidate || !selectedReferenceImage) {
      if (pool.role.priority === "required") {
        const reason = pool.candidates.length > 0
          ? "eligible candidates had hard role or cue contradictions or lacked usable reference images"
          : "no eligible catalogue candidate";
        blockers.push(`${pool.role.label}: ${reason}.`);
      }
      continue;
    }

    const weaknessReasons = catalogueGroundingWeaknessReasons(selectedCandidate.attributeScore, cueRequirements);
    if (weaknessReasons.length > 0) {
      warnings.push(
        `${pool.role.label}: selected best available catalogue candidate with warnings (${[
          `score ${selectedCandidate.attributeScore.total}`,
          ...weaknessReasons
        ].join("; ")}).`
      );
    }

    selected.push({
      role: pool.role,
      match: selectedCandidate,
      referenceImage: selectedReferenceImage
    });
  }
  if (aestheticGateEnabled) {
    await refineSelectedCatalogueProductsForAestheticFit({
      selected,
      pools: roleScopedPools,
      roomType,
      conceptText,
      warnings
    });
  }

  const productsForConcept = selected
    .sort(
      (left, right) =>
        renderReferencePriorityForProduct(
          {
            category: left.match.categoryNormalized,
            roleLabel: left.role.label,
            selectionReason: left.match.selectionReason
          },
          roomType
        ) -
        renderReferencePriorityForProduct(
          {
            category: right.match.categoryNormalized,
            roleLabel: right.role.label,
            selectionReason: right.match.selectionReason
          },
          roomType
        )
    )
    .slice(0, CATALOGUE_GROUNDED_CONCEPT_ANCHOR_LIMIT);
  const selectedAnchorByRole = new Map(
    selected.map(({ role, match }) => [catalogueGroundingRoleKey(role.category, role.label), match])
  );

  return {
    products: productsForConcept,
    blockers,
    summary: {
      enabled: true,
      selectedProductCount: productsForConcept.length,
      blockerCount: blockers.length,
      warningCount: warnings.length,
      cueRequirements,
      warnings: warnings.slice(0, 12),
      selectedAnchors: productsForConcept.map(({ role, match }) => ({
        productId: match.id,
        category: role.category,
        roleLabel: role.label,
        priority: role.priority,
        anchorQuality:
          catalogueGroundingWeaknessReasons(match.attributeScore, cueRequirements).length > 0
            ? "best_available"
            : "strong",
        selectionReason: match.selectionReason,
        attributeScore: {
          total: match.attributeScore.total,
          color: match.attributeScore.color,
          material: match.attributeScore.material,
          style: match.attributeScore.style,
          silhouette: match.attributeScore.silhouette,
          weaknessReasons: match.attributeScore.weaknessReasons
        }
      })),
      aestheticTasteGateEnabled: aestheticGateEnabled,
      roles: roleScopedPools.map((pool) => ({
        category: pool.role.category,
        roleLabel: pool.role.label,
        candidateCount: pool.candidateCount,
        selectedProductId:
          selectedAnchorByRole.get(catalogueGroundingRoleKey(pool.role.category, pool.role.label))?.id ?? null,
        topAttributeTotal: pool.candidates[0]?.attributeScore.total ?? null
      }))
    }
  };
}

function catalogueGroundingRoleKey(category: string, label: string) {
  return `${category}::${label}`.toLowerCase();
}

function localAestheticTasteGateEnabled() {
  return process.env.RITZY_AESTHETIC_TASTE_GATE === "1";
}

function localSkuFidelityModeEnabled(roomType: string) {
  return (
    localAestheticTasteGateEnabled() &&
    process.env.NODE_ENV !== "production" &&
    roomType.toLowerCase().includes("living")
  );
}

async function previousShoppingListRefreshHistory({
  serviceSupabase,
  roomId,
  conceptId
}: {
  serviceSupabase: ReturnType<typeof createServiceClient>;
  roomId: string;
  conceptId: string;
}): Promise<ProductRefreshDiversityHistory[]> {
  const { data: existingList } = await serviceSupabase
    .from("shopping_lists")
    .select("id")
    .eq("room_id", roomId)
    .eq("concept_id", conceptId)
    .limit(1)
    .maybeSingle();

  if (!existingList?.id) {
    return [];
  }

  const { data: rows } = await serviceSupabase
    .from("shopping_list_items")
    .select("product_id, category, role_label, product:products(name, retailer:retailers(name))")
    .eq("shopping_list_id", existingList.id)
    .in("status", ["selected", "option"]);

  return (rows ?? []).map((row) => {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    const retailer = product?.retailer;
    const retailerName = Array.isArray(retailer) ? retailer[0]?.name : retailer?.name;

    return {
      productId: row.product_id,
      productName: product?.name ?? null,
      category: row.category,
      roleLabel: row.role_label,
      retailerName: retailerName ?? null
    };
  });
}

function rerankRolePoolForAestheticFit(
  pool: RoleScopedCandidatePool,
  roomType: string,
  conceptText: string,
  companionCandidates: ProductMatchCandidate[] = []
): RoleScopedCandidatePool {
  return {
    ...pool,
    candidates: [...pool.candidates]
      .map((candidate) => {
        const assessment = assessAestheticFitForRole({
          candidate,
          role: pool.role,
          roomType,
          conceptText,
          companionCandidates
        });
        return {
          ...candidate,
          score: Number((candidate.score + assessment.scoreAdjustment).toFixed(3)),
          selectionReason: [
            candidate.selectionReason,
            ...assessment.reasons.map((reason) => `aesthetic fit: ${reason}`)
          ].join("; "),
          warnings: [...candidate.warnings, ...assessment.weaknessReasons],
          attributeScore: {
            ...candidate.attributeScore,
            total: candidate.attributeScore.total + assessment.scoreAdjustment,
            reasons: [...candidate.attributeScore.reasons, ...assessment.reasons],
            weaknessReasons: Array.from(
              new Set([...candidate.attributeScore.weaknessReasons, ...assessment.weaknessReasons])
            )
          }
        };
      })
      .sort((left, right) => right.score - left.score)
  };
}

function roleScopedCandidatesForLocalSkuFidelityPlan(pools: RoleScopedCandidatePool[], limit: number) {
  const selectedIds = new Set<string>();
  const selected: RankedProductMatch[] = [];

  for (const pool of pools) {
    for (const candidate of pool.candidates) {
      if (selectedIds.has(candidate.id)) {
        continue;
      }
      selected.push(candidate);
      selectedIds.add(candidate.id);
    }
  }

  return selected.slice(0, limit);
}

function shoppingListRoleSpecFromRow(row: {
  category: string | null;
  role_label?: string | null;
  role_visual_brief?: string | null;
  role_priority?: string | null;
  role_quantity?: number | null;
}): RoomProductRoleSpec {
  const label = row.role_label || row.category || "product option";
  return {
    category: normalizeSourcingCategory(row.category ?? "", label),
    label,
    visualBrief: row.role_visual_brief ?? null,
    quantity: Math.max(1, row.role_quantity ?? 1),
    priority: row.role_priority === "required" ? "required" : "supporting"
  };
}

function roleScopedShoppingAlternates({
  roomType,
  conceptText,
  budgetMaxAed,
  roomMeasurements,
  role,
  candidates,
  excludeProductIds,
  limit
}: {
  roomType: string;
  conceptText: string;
  budgetMaxAed: number | null;
  roomMeasurements: {
    wallLengthCm: number | null;
    roomDepthCm: number | null;
  } | null;
  role: RoomProductRoleSpec;
  candidates: ProductMatchCandidate[];
  excludeProductIds: Set<string>;
  limit: number;
}): RankedProductMatch[] {
  const pool = buildRoleScopedCandidatePools({
    roomType,
    conceptText,
    roles: [role],
    candidates,
    budgetMaxAed,
    roomMeasurements,
    candidatesPerRole: Math.max(limit * 4, limit)
  }).pools[0];

  return (pool?.candidates ?? [])
    .filter((candidate) => !excludeProductIds.has(candidate.id))
    .slice(0, Math.max(1, limit));
}

function rankMatchesForLocalSkuFidelity({
  ranked,
  roles,
  roomType,
  conceptText,
  roomMeasurements
}: {
  ranked: RankedProductMatch[];
  roles: RoomProductRoleSpec[];
  roomType: string;
  conceptText: string;
  roomMeasurements: {
    wallLengthCm: number | null;
    roomDepthCm: number | null;
  } | null;
}) {
  const rolesByCategory = new Map(roles.map((role) => [normalizeSourcingCategory(role.category, role.label), role]));

  return ranked
    .map((match) => {
      const category = match.categoryNormalized ?? "uncategorized";
      const role = rolesByCategory.get(category);
      if (!role) {
        return match;
      }

      const assessment = assessAestheticFitForRole({
        candidate: match,
        role,
        roomType,
        conceptText
      });
      const localAdjustment = localSkuFidelityScoreAdjustment(match, role, conceptText, roomMeasurements);

      return {
        ...match,
        score: Number((match.score + assessment.scoreAdjustment + localAdjustment.scoreAdjustment).toFixed(3)),
        selectionReason: [
          match.selectionReason,
          ...assessment.reasons.map((reason) => `aesthetic fit: ${reason}`),
          ...localAdjustment.reasons.map((reason) => `sku fidelity: ${reason}`)
        ].join("; "),
        warnings: [...match.warnings, ...assessment.weaknessReasons, ...localAdjustment.weaknessReasons]
      };
    })
    .sort((left, right) => right.score - left.score);
}

async function refineSelectedCatalogueProductsForAestheticFit({
  selected,
  pools,
  roomType,
  conceptText,
  warnings
}: {
  selected: CatalogueGroundingProduct[];
  pools: RoleScopedCandidatePool[];
  roomType: string;
  conceptText: string;
  warnings: string[];
}) {
  const selectedRug = selected.find(({ role }) => normalizeSourcingCategory(role.category, role.label) === "rugs");
  const selectedCoffeeTableIndex = selected.findIndex(
    ({ role }) => normalizeSourcingCategory(role.category, role.label) === "coffee_tables"
  );
  if (!selectedRug || selectedCoffeeTableIndex < 0) {
    return;
  }

  const selectedCoffeeTable = selected[selectedCoffeeTableIndex];
  const currentAssessment = assessAestheticFitForRole({
    candidate: selectedCoffeeTable.match,
    role: selectedCoffeeTable.role,
    roomType,
    conceptText,
    companionCandidates: [selectedRug.match]
  });
  if (!currentAssessment.unsuitableHero) {
    return;
  }

  const coffeeTablePool = pools.find(
    (pool) => normalizeSourcingCategory(pool.role.category, pool.role.label) === "coffee_tables"
  );
  for (const alternative of coffeeTablePool?.candidates ?? []) {
    if (alternative.id === selectedCoffeeTable.match.id) {
      continue;
    }

    const alternativeAssessment = assessAestheticFitForRole({
      candidate: alternative,
      role: selectedCoffeeTable.role,
      roomType,
      conceptText,
      companionCandidates: [selectedRug.match]
    });
    if (alternativeAssessment.unsuitableHero) {
      continue;
    }

    const referenceImage = alternative.primaryImageUrl ? await fetchRemoteImage(alternative.primaryImageUrl) : null;
    if (!referenceImage) {
      continue;
    }

    selected[selectedCoffeeTableIndex] = {
      role: selectedCoffeeTable.role,
      match: {
        ...alternative,
        selectionReason: [
          alternative.selectionReason,
          "aesthetic fit: replaced noisy coffee table to harmonize with patterned rug"
        ].join("; ")
      },
      referenceImage
    };
    warnings.push(
      `${selectedCoffeeTable.role.label}: replaced noisy catalogue anchor (${selectedCoffeeTable.match.name}) with quieter option (${alternative.name}).`
    );
    return;
  }
}

function hasHardCatalogueGroundingContradiction(weaknessReasons: string[]) {
  return weaknessReasons.some((reason) => {
    const lower = reason.toLowerCase();
    // Silhouette language is a soft styling preference (often sourced from
    // style-module prose like "curved forms"); it already costs score and must
    // never veto the top palette-and-category-correct anchor. Hard vetoes are
    // reserved for genuine contradictions: wrong class, clashing color family,
    // impossible dimensions, unavailable stock.
    if (lower.includes("silhouette")) {
      return false;
    }
    return (
      lower.includes("conflicts") ||
      lower.includes("mismatch") ||
      lower.includes("does not fit") ||
      lower.includes("unavailable")
    );
  });
}

function isEntryPriceCatalogueGroundingAnchor(
  candidate: CatalogueGroundingProduct["match"],
  role: RoomProductRoleSpec
) {
  const price = candidate.salePriceAed ?? candidate.priceAed;
  if (price === null) {
    return false;
  }

  const entryPriceFloors: Record<string, number> = {
    armchairs: 900,
    coffee_tables: 800,
    lighting: 500,
    rugs: 700,
    sofas: 2500,
    storage: 900
  };
  const floor = entryPriceFloors[role.category];

  return Boolean(floor && price < floor);
}

function catalogueGroundingCueText({
  designBrief,
  answeredQuestions
}: {
  designBrief: DesignBriefRow;
  answeredQuestions: AnsweredQuestionRow[];
}) {
  return [
    visualStyleSummary(likedStyleSlugsFromStructuredBrief(designBrief.structured_json)),
    designBrief.style_notes,
    designBrief.color_notes,
    designBrief.functional_requirements,
    designBrief.inspiration_notes,
    ...answeredQuestions
      .filter((question) => question.answer)
      .map((question) => `${question.question}: ${question.answer}`)
  ]
    .filter(Boolean)
    .join("\n");
}

function catalogueCueRequirements(cueText: string): CatalogueCueRequirements {
  const tokens = catalogueCueTokens(cueText);

  return {
    color: hasAnyCatalogueCue(tokens, [
      "beige",
      "black",
      "blue",
      "brown",
      "charcoal",
      "cream",
      "ecru",
      "green",
      "grey",
      "gray",
      "ivory",
      "navy",
      "oatmeal",
      "red",
      "sand",
      "sage",
      "tan",
      "taupe",
      "terracotta",
      "white"
    ]),
    material: hasAnyCatalogueCue(tokens, [
      "boucle",
      "brass",
      "fabric",
      "glass",
      "leather",
      "linen",
      "marble",
      "metal",
      "oak",
      "plaster",
      "stone",
      "travertine",
      "velvet",
      "walnut",
      "wood"
    ]),
    shape: hasAnyCatalogueCue(tokens, [
      "curved",
      "fluted",
      "low",
      "lowline",
      "oval",
      "rectangular",
      "ribbed",
      "round",
      "sculptural",
      "slender",
      "slim",
      "square",
      "tall",
      "tufted",
      "upholstered"
    ]),
    style: hasAnyCatalogueCue(tokens, [
      "bohemian",
      "classic",
      "coastal",
      "contemporary",
      "gallery",
      "industrial",
      "mid",
      "midcentury",
      "minimal",
      "modern",
      "scandinavian",
      "traditional"
    ])
  };
}

function catalogueGroundingWeaknessReasons(
  attributeScore: CatalogueGroundingProduct["match"]["attributeScore"],
  cueRequirements: CatalogueCueRequirements
) {
  const reasons = [...attributeScore.weaknessReasons];

  if (attributeScore.total < CATALOGUE_GROUNDED_CONCEPT_MIN_ATTRIBUTE_TOTAL) {
    reasons.push("top candidate attribute score is weak");
  }
  if (cueRequirements.color && attributeScore.color <= 0) {
    reasons.push("requested colour cue lacks positive catalogue evidence");
  }
  if (cueRequirements.material && attributeScore.material <= 0) {
    reasons.push("requested material cue lacks positive catalogue evidence");
  }
  if (cueRequirements.shape && attributeScore.silhouette <= 0) {
    reasons.push("requested shape cue lacks positive catalogue evidence");
  }
  if (cueRequirements.style && attributeScore.style <= 0) {
    reasons.push("requested style cue lacks positive catalogue evidence");
  }

  return Array.from(new Set(reasons));
}

const AVOID_CUE_COLOR_TOKENS = [
  "beige", "black", "blue", "brown", "burgundy", "charcoal", "cream", "gold", "green", "grey",
  "gray", "ivory", "navy", "orange", "pink", "purple", "red", "rust", "sage", "taupe",
  "terracotta", "white", "yellow"
];

// Splits "avoid X" style clauses out of free-text cues. The named colors become
// structural avoid tags; the clauses are removed so their tokens stop scoring
// as positive matches.
function splitAvoidColorCues(text: string): { cueText: string; avoidColorTags: string[] } {
  const avoidColorTags = new Set<string>();
  const cleanedLines = text.split("\n").map((line) => {
    // Capture from each avoid-marker to the end of the clause (sentence/segment).
    return line.replace(
      /\b(?:avoid(?:ing)?|no|not|without|nothing)\b([^.;\n]*)/gi,
      (clause, tail: string) => {
        const tailTokens = tail.toLowerCase().split(/[^a-z]+/);
        const named = AVOID_CUE_COLOR_TOKENS.filter((color) => tailTokens.includes(color));
        for (const color of named) {
          avoidColorTags.add(color);
        }
        // Only strip the clause when it actually named colors; other avoid
        // notes (materials, styles) keep flowing to the model as text.
        return named.length > 0 ? "" : clause;
      }
    );
  });

  return {
    cueText: cleanedLines.join("\n").replace(/[ \t]{2,}/g, " ").trim(),
    avoidColorTags: Array.from(avoidColorTags)
  };
}

function catalogueCueTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter(Boolean)
  );
}

function hasAnyCatalogueCue(tokens: Set<string>, cues: string[]) {
  return cues.some((cue) => tokens.has(cue));
}

async function catalogueGroundingAnchorsForConcept({
  serviceSupabase,
  generationJobId
}: {
  serviceSupabase: ReturnType<typeof createServiceClient>;
  generationJobId: string | null;
}): Promise<CatalogueGroundingAnchor[]> {
  if (!generationJobId) {
    return [];
  }

  const { data: generationJob } = await serviceSupabase
    .from("ai_jobs")
    .select("output_summary")
    .eq("id", generationJobId)
    .maybeSingle();
  const outputSummary = generationJob?.output_summary;
  if (!isRecord(outputSummary)) {
    return [];
  }

  const catalogueGrounding = outputSummary.catalogueGrounding;
  if (!isRecord(catalogueGrounding) || !Array.isArray(catalogueGrounding.selectedAnchors)) {
    return [];
  }

  return catalogueGrounding.selectedAnchors.filter(isCatalogueGroundingAnchor);
}

function isCatalogueGroundingAnchor(value: unknown): value is CatalogueGroundingAnchor {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.productId === "string" &&
    typeof value.category === "string" &&
    typeof value.roleLabel === "string" &&
    (value.priority === "required" || value.priority === "supporting") &&
    typeof value.selectionReason === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function productToMatchCandidate(product: ProductRow): ProductMatchCandidate | null {
  if (!product.primary_image_url) {
    return null;
  }

  if (product.retailer?.status && product.retailer.status !== "active") {
    return null;
  }

  const availability = product.availability?.toLowerCase() ?? "";
  if (
    availability.includes("out of stock") ||
    availability.includes("sold out") ||
    availability.includes("unavailable")
  ) {
    return null;
  }

  return {
    id: product.id,
    name: product.name,
    retailerName: product.retailer?.name ?? "Retailer",
    canonicalUrl: product.canonical_url,
    description: product.description,
    categoryNormalized: product.category_normalized,
    priceAed: product.price_aed,
    salePriceAed: product.sale_price_aed,
    availability: product.availability,
    primaryImageUrl: product.primary_image_url,
    color: product.color,
    material: product.material,
    styleTags: product.style_tags,
    colorTags: product.color_tags,
    materialTags: product.material_tags,
    roomTags: product.room_tags,
    lastCheckedAt: product.last_checked_at,
    dimensions: product.dimensions?.[0]
      ? {
          widthCm: product.dimensions[0].width_cm,
          depthCm: product.dimensions[0].depth_cm,
          heightCm: product.dimensions[0].height_cm,
          sourceText: product.dimensions[0].source_text
        }
      : null
  };
}

function catalogUnavailableMessage(products: ProductRow[]) {
  if (products.length === 0) {
    return "The shopping catalog is refreshing. Please try matching products again in a minute.";
  }

  const activeRetailerProducts = products.filter((product) => product.retailer?.status === "active");
  if (activeRetailerProducts.length === 0) {
    return "The shopping catalog is waiting for an approved retailer. Please try again shortly.";
  }

  const inStockProducts = activeRetailerProducts.filter((product) => {
    const availability = product.availability?.toLowerCase() ?? "";
    return !(
      availability.includes("out of stock") ||
      availability.includes("sold out") ||
      availability.includes("unavailable")
    );
  });

  if (inStockProducts.length === 0) {
    return "The approved catalog is refreshing current availability. Please try again shortly.";
  }

  return "The shopping catalog is refreshing eligible products. Please try again shortly.";
}

function productImageCatalogRefreshMessage() {
  return "The shopping catalog is refreshing eligible products. Please try again shortly.";
}

function productSourcingFailureMessage(error: unknown) {
  const failureKind = classifyProductSourcingFailure(error);
  if (failureKind === "provider_image_download") return productImageCatalogRefreshMessage();
  if (failureKind === "timeout") return productSourcingTimeoutMessage();
  return productSourcingGenericFailureMessage();
}

function productSourcingAiPayloadSummary() {
  return {
    conceptImageDetail: PRODUCT_SOURCING_AI_CONCEPT_IMAGE_DETAIL,
    candidateImageLimit: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT,
    candidateImageDetail: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_DETAIL,
    productCandidateImagesEnabled: PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED
  };
}

function productSourcingTimeoutDiagnostics({
  attemptDurationMs,
  timedOut,
  fallbackUsed,
  fallbackReason,
  candidateCount,
  rolePoolCount,
  retryAttempted = false,
  retryAttemptDurationMs = null,
  retryTimedOut = false,
  retryFallbackUsed = false,
  retryFallbackReason = null,
  retryProviderImageDownloadFailure = false,
  retryImageGateUsable = null
}: {
  attemptDurationMs: number | null;
  timedOut: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  candidateCount: number;
  rolePoolCount: number;
  retryAttempted?: boolean;
  retryAttemptDurationMs?: number | null;
  retryTimedOut?: boolean;
  retryFallbackUsed?: boolean;
  retryFallbackReason?: string | null;
  retryProviderImageDownloadFailure?: boolean;
  retryImageGateUsable?: boolean | null;
}) {
  return buildProductSourcingTimeoutDiagnostics({
    attemptDurationMs,
    timeoutMs: PRODUCT_SOURCING_AI_TIMEOUT_MS,
    timedOut,
    fallbackUsed,
    fallbackReason,
    candidateCount,
    rolePoolCount,
    conceptImageDetail: PRODUCT_SOURCING_AI_CONCEPT_IMAGE_DETAIL,
    candidateImageLimit: PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT,
    productCandidateImagesEnabled: PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED,
    retry: {
      attempted: retryAttempted,
      attemptDurationMs: retryAttemptDurationMs,
      timedOut: retryTimedOut,
      fallbackUsed: retryFallbackUsed,
      fallbackReason: retryTimedOut ? "retry_visual_sourcing_timeout" : retryFallbackReason,
      providerImageDownloadFailure: retryProviderImageDownloadFailure,
      imageGateUsable: retryImageGateUsable
    }
  });
}

function mergeProductMatchCandidates(
  candidates: ProductMatchCandidate[],
  requiredCandidates: ProductMatchCandidate[]
) {
  const mergedById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  for (const candidate of requiredCandidates) {
    mergedById.set(candidate.id, candidate);
  }

  return Array.from(mergedById.values());
}

function bestThemeAlignedOptionForRole({
  role,
  options,
  conceptText,
  currentPick,
  localSkuFidelityMode = false
}: {
  role: RoleProductOptions;
  options: RankedProductMatch[];
  conceptText: string;
  currentPick: RankedProductMatch | undefined;
  localSkuFidelityMode?: boolean;
}) {
  if (options.length === 0 || !currentPick) {
    return null;
  }

  const preferredTokens = preferredCatalogueTokens(conceptText);
  const conflictingColors = catalogueConflictColors();

  const rankedOptions = [...options].sort((left, right) => {
    const leftScore = themeAlignedOptionScore(left, role, preferredTokens, conflictingColors, localSkuFidelityMode);
    const rightScore = themeAlignedOptionScore(right, role, preferredTokens, conflictingColors, localSkuFidelityMode);
    return rightScore - leftScore || right.score - left.score;
  });
  const bestOption = rankedOptions[0];
  const currentScore = themeAlignedOptionScore(currentPick, role, preferredTokens, conflictingColors, localSkuFidelityMode);
  const bestScore = themeAlignedOptionScore(bestOption, role, preferredTokens, conflictingColors, localSkuFidelityMode);
  const currentHasColorClash = hasThemeColorClash(currentPick, preferredTokens, conflictingColors, conceptText);
  const bestHasColorClash = hasThemeColorClash(bestOption, preferredTokens, conflictingColors, conceptText);
  const bestNonClashingOption = rankedOptions.find(
    (option) => !hasThemeColorClash(option, preferredTokens, conflictingColors, conceptText)
  );

  if (currentHasColorClash && bestNonClashingOption) {
    return bestNonClashingOption;
  }
  if (currentHasColorClash && !bestHasColorClash && bestScore >= currentScore - 20) {
    return bestOption;
  }
  return bestScore - currentScore >= 40 ? bestOption : currentPick;
}

function preferredCatalogueTokens(conceptText: string) {
  const conceptTokens = catalogueCueTokens(conceptText);
  return new Set(
    [
      "beige",
      "black",
      "blue",
      "brown",
      "cognac",
      "cream",
      "ivory",
      "grey",
      "gray",
      "gold",
      "brass",
      "bronze",
      "oak",
      "wood",
      "orange",
      "red",
      "sage",
      "green",
      "taupe",
      "travertine",
      "stone",
      "ceramic",
      "yellow"
    ].filter((token) => conceptTokens.has(token))
  );
}

function catalogueConflictColors() {
  return ["orange", "teal", "pink", "blue", "red", "purple"];
}

function themeAlignedOptionScore(
  option: RankedProductMatch,
  role: RoleProductOptions,
  preferredTokens: Set<string>,
  conflictingColors: string[],
  localSkuFidelityMode = false
) {
  const haystack = catalogueCueTokens(
    [
      option.name,
      option.color,
      option.material,
      option.description,
      option.styleTags.join(" "),
      option.colorTags.join(" "),
      option.materialTags.join(" ")
    ]
      .filter(Boolean)
      .join(" ")
  );
  let score = option.score;

  for (const token of preferredTokens) {
    if (haystack.has(token)) {
      score += 18;
    }
  }

  for (const color of conflictingColors) {
    if (haystack.has(color) && !preferredTokens.has(color)) {
      score -= 80;
    }
  }

  const roleText = `${role.category} ${role.label}`.toLowerCase();

  if (!localSkuFidelityMode) {
    if (role.category === "decor" && haystack.has("bench") && !roleText.includes("bench")) {
      score -= 45;
    }
    if (role.category === "wall_art" && (haystack.has("mirror") || haystack.has("panel"))) {
      score += 12;
    }
    if (role.category === "lighting" && option.priceAed !== null && option.priceAed < 250) {
      score -= 35;
    }
    if (option.priceAed === 0 || option.salePriceAed === 0) {
      score -= 30;
    }
    return score;
  }

  if (role.category === "decor" && haystack.has("bench") && !roleText.includes("bench")) {
    score -= 180;
  }
  if (role.category === "side_tables") {
    if (hasAnyCatalogueCue(haystack, ["bedside", "nightstand"])) {
      score -= 110;
    }
    if (hasAnyCatalogueCue(haystack, ["accent", "end", "side"])) {
      score += 36;
    }
  }
  if (role.category === "wall_art") {
    if (hasAnyCatalogueCue(haystack, ["panel", "panels", "shelf", "shelves"])) {
      score -= 95;
    }
    if (
      haystack.has("black") &&
      ["beige", "cream", "greige", "ivory", "taupe", "white"].some((token) => preferredTokens.has(token))
    ) {
      score -= 90;
    }
    if (hasAnyCatalogueCue(haystack, ["art", "artwork", "canvas", "framed", "painting", "print"])) {
      score += 28;
    }
    if (haystack.has("mirror")) {
      score -= 20;
    }
  }
  if (role.category === "lighting") {
    if (hasAnyCatalogueCue(haystack, ["spiral", "twisted", "dna", "led", "chrome", "office"])) {
      score -= 70;
    }
    if (hasAnyCatalogueCue(haystack, ["brass", "bronze", "gold", "shade", "linen"])) {
      score += 28;
    }
  }
  if (role.category === "storage") {
    if (hasAnyCatalogueCue(haystack, ["shelf", "shelves", "bookcase", "rack"])) {
      score -= 95;
    }
    if (hasAnyCatalogueCue(haystack, ["console", "credenza", "media", "sideboard", "tv"])) {
      score += 42;
    }
  }
  if (role.category === "decor") {
    if (hasAnyCatalogueCue(haystack, ["bench", "stool", "table"])) {
      score -= 90;
    }
    if (hasAnyCatalogueCue(haystack, ["bowl", "ceramic", "planter", "tray", "vase", "vessel"])) {
      score += 32;
    }
  }
  if (role.category === "lighting" && option.priceAed !== null && option.priceAed < 250) {
    score -= 35;
  }
  if (option.priceAed === 0 || option.salePriceAed === 0) {
    score -= 30;
  }

  return score;
}

function hasThemeColorClash(
  option: RankedProductMatch,
  preferredTokens: Set<string>,
  conflictingColors: string[],
  conceptText: string
) {
  const haystack = catalogueCueTokens(
    [option.name, option.color, option.description, option.colorTags.join(" ")]
      .filter(Boolean)
      .join(" ")
  );

  return conflictingColors.some(
    (color) => haystack.has(color) && !preferredTokens.has(color) && !conceptAllowsSeatingCue(conceptText, [color])
  );
}

function isCredibleAestheticDemoOption(
  option: RankedProductMatch,
  role: RoleProductOptions,
  conceptText: string,
  localSkuFidelityMode = false
) {
  const haystack = catalogueCueTokens(
    [
      option.name,
      option.color,
      option.material,
      option.description,
      option.styleTags.join(" "),
      option.colorTags.join(" "),
      option.materialTags.join(" ")
    ]
      .filter(Boolean)
      .join(" ")
  );
  const score = themeAlignedOptionScore(
    option,
    role,
    preferredCatalogueTokens(conceptText),
    catalogueConflictColors(),
    localSkuFidelityMode
  );
  const softNeutralConcept = conceptRequestsSoftNeutralUpholstery(conceptText);
  const hasUnrequestedDarkFinish =
    softNeutralConcept &&
    hasAnyCatalogueCue(haystack, ["black", "charcoal", "graphite"]) &&
    !conceptAllowsSeatingCue(conceptText, ["black", "charcoal", "graphite"]);

  if (
    localSkuFidelityMode &&
    hasUnrequestedDarkFinish &&
    ["decor", "lighting", "mirrors", "side_tables", "storage", "wall_art"].includes(role.category)
  ) {
    return false;
  }

  if (role.category === "side_tables") {
    return score >= 20 && hasAnyCatalogueCue(haystack, ["accent", "end", "side"]);
  }
  if (role.category === "sofas") {
    return (
      score >= 20 &&
      hasAnyCatalogueCue(haystack, ["chaise", "sectional", "sofa"]) &&
      !hasHardLocalSofaFidelityMismatch(option, conceptText)
    );
  }
  if (role.category === "armchairs" || role.category === "chairs") {
    const isPaletteCompatible = chairPaletteMatchesConcept(option, conceptText);
    return (
      (score >= 20 || (localSkuFidelityMode && isPaletteCompatible)) &&
      hasAnyCatalogueCue(haystack, ["accent", "armchair", "fabric", "lounge", "upholstered"]) &&
      (!localSkuFidelityMode || isPaletteCompatible) &&
      !hasAnyCatalogueCue(haystack, [
        "acapulco",
        "chipboard",
        "dining",
        "office",
        "outdoor",
        "pedestal",
        "recliner",
        "shell",
        "steel",
        "swing",
        "swivel",
        "vintage",
        "wire"
      ]) &&
      (!conceptRequestsSoftNeutralUpholstery(conceptText) ||
        !hasAnyCatalogueCue(haystack, ["cognac", "leather", "suede"]) ||
        conceptAllowsSeatingCue(conceptText, ["cognac", "leather", "suede"]))
    );
  }
  if (role.category === "coffee_tables") {
    return (
      score >= 20 &&
      hasAnyCatalogueCue(haystack, ["coffee", "table"]) &&
      !hasAnyCatalogueCue(haystack, [
        "attention",
        "bar",
        "bench",
        "black",
        "desk",
        "electra",
        "glass",
        "inlay",
        "office",
        "recamiere",
        "side",
        "steel",
        "statement",
        "striped",
        "unique"
      ])
    );
  }
  if (role.category === "rugs") {
    return score >= 20 && haystack.has("rug");
  }
  if (role.category === "lighting") {
    return (
      (score >= 20 || (localSkuFidelityMode && hasAnyCatalogueCue(haystack, ["floor", "lamp", "linen", "shade", "table"]))) &&
      !hasAnyCatalogueCue(haystack, ["dna", "kids", "moon", "night", "office", "projector", "spiral", "star", "starlight", "twisted"])
    );
  }
  if (role.category === "wall_art") {
    return (
      score >= 20 &&
      hasAnyCatalogueCue(haystack, ["art", "artwork", "canvas", "framed", "painting", "print"]) &&
      !hasAnyCatalogueCue(haystack, [
        "anime",
        "arsenal",
        "barcelona",
        "fantasy",
        "ferrari",
        "football",
        "holder",
        "hook",
        "mail",
        "messi",
        "naruto",
        "office",
        "panel",
        "panels",
        "poster",
        "rack",
        "schumacher",
        "shelf",
        "shelves",
        "sports"
      ])
    );
  }
  if (role.category === "storage") {
    return score >= 20 && hasAnyCatalogueCue(haystack, ["console", "credenza", "media", "sideboard", "tv"]);
  }
  if (role.category === "decor") {
    return (
      score >= 20 &&
      hasAnyCatalogueCue(haystack, ["bowl", "ceramic", "planter", "tray", "vase", "vessel"]) &&
      !hasAnyCatalogueCue(haystack, ["bench", "stool", "table"])
    );
  }

  return score >= 20;
}

function productFamilyTokens(option: RankedProductMatch) {
  return catalogueCueTokens(
    [
      option.name,
      option.color,
      option.material,
      option.description,
      option.styleTags.join(" "),
      option.colorTags.join(" "),
      option.materialTags.join(" ")
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function largestHorizontalDimensionCm(option: Pick<RankedProductMatch, "dimensions">) {
  const width = option.dimensions?.widthCm ?? null;
  const depth = option.dimensions?.depthCm ?? null;
  if (width === null && depth === null) {
    return null;
  }

  return Math.max(width ?? 0, depth ?? 0);
}

function explicitSectionalSofaRequested(conceptText: string) {
  const tokens = catalogueCueTokens(conceptText);
  const normalized = conceptText.toLowerCase();
  return (
    hasAnyCatalogueCue(tokens, ["chaise", "corner", "sectional", "modular"]) ||
    normalized.includes("l-shaped") ||
    normalized.includes("l shaped")
  );
}

function generousAnchorSofaRequested(conceptText: string) {
  const tokens = catalogueCueTokens(conceptText);
  return hasAnyCatalogueCue(tokens, ["family", "five", "generous", "large", "lounge", "spacious"]);
}

function hasHardLocalSofaFidelityMismatch(option: RankedProductMatch, conceptText: string) {
  const tokens = productFamilyTokens(option);
  const colorTokens = catalogueCueTokens([option.color, option.colorTags.join(" ")].filter(Boolean).join(" "));
  const largestHorizontal = largestHorizontalDimensionCm(option);
  const explicitSectional = explicitSectionalSofaRequested(conceptText);
  const generousAnchor = generousAnchorSofaRequested(conceptText);
  const softNeutralConcept = conceptRequestsSoftNeutralUpholstery(conceptText);
  const isShortSofa =
    hasAnyFamilyCue(tokens, ["1", "one", "single", "two", "2", "loveseat"]) ||
    /(?:1|2|one|two)[-\s.]*seater/i.test(option.name) ||
    (largestHorizontal !== null && largestHorizontal < (generousAnchor ? 210 : 185));
  const isSectional = hasAnyFamilyCue(tokens, ["chaise", "corner", "left", "right", "sectional", "modular"]);
  const clashesWithPalette = hasAnyFamilyCue(tokens, ["black", "blue", "orange", "red", "yellow"]);
  const requestedClashColor = ["black", "blue", "orange", "red", "yellow"].some((cue) =>
    tokens.has(cue) && conceptAllowsSeatingCue(conceptText, [cue])
  );
  const isCommercialOrUtility =
    hasAnyFamilyCue(tokens, ["bed", "office", "outdoor", "recliner"]) ||
    /sofa\s*bed|sofabed|pull[-\s]?out/i.test(option.name);
  const isHardLeatherOrDarkBrown =
    hasAnyFamilyCue(tokens, ["cognac", "leather", "suede"]) ||
    hasAnyFamilyCue(colorTokens, ["brown", "cognac"]);
  const requestedLeatherOrBrown = conceptAllowsSeatingCue(conceptText, ["brown", "cognac", "leather", "suede"]);

  return (
    !hasUsablePrice(option) ||
    (isShortSofa && generousAnchor) ||
    (isSectional && !explicitSectional) ||
    (softNeutralConcept && clashesWithPalette && !requestedClashColor) ||
    (softNeutralConcept && isHardLeatherOrDarkBrown && !requestedLeatherOrBrown) ||
    (softNeutralConcept && !hasNeutralUpholsteryCue(tokens)) ||
    isCommercialOrUtility
  );
}

function conceptRequestsSoftNeutralUpholstery(conceptText: string) {
  const tokens = catalogueCueTokens(conceptText);
  return (
    hasAnyFamilyCue(tokens, [
      "beige",
      "boucle",
      "cream",
      "ecru",
      "greige",
      "ivory",
      "linen",
      "oatmeal",
      "sand",
      "soft",
      "taupe",
      "transitional",
      "warm",
      "white"
    ]) &&
    !conceptAllowsSeatingCue(conceptText, ["black", "blue", "brown", "cognac", "leather", "orange", "red", "yellow"])
  );
}

function conceptAllowsSeatingCue(conceptText: string, cues: string[]) {
  const tokens = catalogueCueTokens(conceptText);
  if (!hasAnyFamilyCue(tokens, cues)) {
    return false;
  }

  const normalized = conceptText.toLowerCase();
  return cues.some((cue) => {
    const escapedCue = cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (
      new RegExp(`(?:${escapedCue}).{0,48}(?:armchair|chair|seat|seating|sofa|upholster)`, "i").test(normalized) ||
      new RegExp(`(?:armchair|chair|seat|seating|sofa|upholster).{0,48}(?:${escapedCue})`, "i").test(normalized)
    );
  });
}

function chairPaletteMatchesConcept(option: RankedProductMatch, conceptText: string) {
  const tokens = productFamilyTokens(option);
  const colorTokens = catalogueCueTokens([option.color, option.colorTags.join(" ")].filter(Boolean).join(" "));
  const materialTokens = catalogueCueTokens([option.material, option.materialTags.join(" ")].filter(Boolean).join(" "));
  const softNeutralConcept = conceptRequestsSoftNeutralUpholstery(conceptText);
  const neutralSeatingCues = [
    "beige",
    "cream",
    "ecru",
    "gray",
    "grey",
    "greige",
    "ivory",
    "linen",
    "oatmeal",
    "sand",
    "stone",
    "taupe",
    "white"
  ];
  const upholsteredCues = ["boucle", "chenille", "fabric", "linen", "textile", "upholstered"];

  if (softNeutralConcept) {
    return (
      hasAnyFamilyCue(colorTokens, neutralSeatingCues) &&
      (hasAnyFamilyCue(tokens, upholsteredCues) || hasAnyFamilyCue(materialTokens, upholsteredCues))
    );
  }

  const explicitColorFamilies = [
    "beige",
    "black",
    "blue",
    "brown",
    "cream",
    "cognac",
    "gray",
    "grey",
    "green",
    "greige",
    "ivory",
    "orange",
    "red",
    "sage",
    "taupe",
    "white",
    "yellow"
  ].filter((cue) => conceptAllowsSeatingCue(conceptText, [cue]));
  const explicitMaterialFamilies = ["boucle", "chenille", "fabric", "leather", "linen", "suede", "textile", "upholstered"].filter(
    (cue) => conceptAllowsSeatingCue(conceptText, [cue])
  );

  if (explicitColorFamilies.length === 0 && explicitMaterialFamilies.length === 0) {
    return !hasAnyFamilyCue(tokens, ["office", "outdoor", "pedestal", "shell", "swivel"]);
  }

  return (
    explicitColorFamilies.some((cue) => colorTokens.has(cue) || tokens.has(cue)) ||
    explicitMaterialFamilies.some((cue) => materialTokens.has(cue) || tokens.has(cue))
  );
}

function localSkuFidelityScoreAdjustment(
  option: RankedProductMatch,
  role: RoomProductRoleSpec | RoleProductOptions,
  conceptText: string,
  roomMeasurements: {
    wallLengthCm: number | null;
    roomDepthCm: number | null;
  } | null = null
) {
  const tokens = productFamilyTokens(option);
  const colorTokens = catalogueCueTokens([option.color, option.colorTags.join(" ")].filter(Boolean).join(" "));
  const reasons: string[] = [];
  const weaknessReasons: string[] = [];
  let scoreAdjustment = 0;

  if (role.category !== "sofas") {
    if (role.category === "armchairs" || role.category === "chairs") {
      const softNeutralConcept = conceptRequestsSoftNeutralUpholstery(conceptText);
      const paletteCompatible = chairPaletteMatchesConcept(option, conceptText);
      if (paletteCompatible) {
        scoreAdjustment += softNeutralConcept ? 220 : 140;
        reasons.push("chair palette and material match the approved seating family");
      }
      if (
        hasAnyFamilyCue(tokens, ["chipboard", "chrome", "shell", "swivel"]) ||
        (softNeutralConcept &&
          !conceptAllowsSeatingCue(conceptText, ["black", "blue", "brown", "cognac", "leather", "orange", "red"]) &&
          (hasAnyFamilyCue(tokens, ["black", "blue", "cognac", "leather", "orange", "red"]) ||
            hasAnyFamilyCue(colorTokens, ["brown", "black", "blue", "orange", "red"])))
      ) {
        scoreAdjustment -= 420;
        weaknessReasons.push("chair colour, material, or silhouette conflicts with the approved seating palette");
      }
      if (softNeutralConcept && !paletteCompatible) {
        scoreAdjustment -= 90;
        weaknessReasons.push("chair lacks same-family soft neutral upholstery evidence");
      }
    }
    if (role.category === "lighting") {
      if (hasAnyFamilyCue(tokens, ["kids", "moon", "multicolor", "night", "projector", "rocket", "space", "star", "starlight"])) {
        scoreAdjustment -= 420;
        weaknessReasons.push("novelty projector lighting conflicts with the refined living-room palette");
      }
      if (hasAnyFamilyCue(tokens, ["brass", "bronze", "ceramic", "floor", "gold", "linen", "shade", "table"])) {
        scoreAdjustment += 140;
        reasons.push("warm table/floor/shaded lighting supports the living-room scheme");
      }
    }
    if (role.category === "wall_art") {
      if (hasAnyFamilyCue(tokens, ["anime", "arsenal", "barcelona", "black", "fantasy", "ferrari", "football", "messi", "naruto", "navy", "office", "poster", "schumacher", "sports"])) {
        scoreAdjustment -= 420;
        weaknessReasons.push("novelty, sports, office, or fan poster wall art conflicts with the approved room direction");
      }
      if (hasAnyFamilyCue(tokens, ["abstract", "beige", "brown", "canvas", "framed", "neutral", "painting", "white"])) {
        scoreAdjustment += 90;
        reasons.push("neutral framed or canvas wall art supports the room direction");
      }
    }
    return { scoreAdjustment, reasons, weaknessReasons };
  }

  const largestHorizontal = largestHorizontalDimensionCm(option);
  const sofaLengthRange = roomMeasurements?.wallLengthCm
    ? {
        minCm: Math.max(205, Math.round(roomMeasurements.wallLengthCm * 0.42)),
        maxCm: Math.min(340, Math.round(roomMeasurements.wallLengthCm * 0.66))
      }
    : { minCm: 210, maxCm: 330 };
  const explicitSectional = explicitSectionalSofaRequested(conceptText);
  const generousAnchor = generousAnchorSofaRequested(conceptText);
  const softNeutralConcept = conceptRequestsSoftNeutralUpholstery(conceptText);
  const isSectional = hasAnyFamilyCue(tokens, ["chaise", "corner", "left", "right", "sectional", "modular"]);
  const isShortSofa =
    hasAnyFamilyCue(tokens, ["1", "one", "single", "two", "2", "loveseat"]) ||
    /(?:1|2|one|two)[-\s.]*seater/i.test(option.name) ||
    (largestHorizontal !== null && largestHorizontal < (generousAnchor ? 210 : 185));

  if (!hasUsablePrice(option)) {
    scoreAdjustment -= 500;
    weaknessReasons.push("sofa has no usable catalogue price");
  }
  if (isShortSofa && generousAnchor) {
    scoreAdjustment -= 650;
    weaknessReasons.push("short sofa cannot satisfy a generous family anchor-seating role");
  }
  if (largestHorizontal !== null && !isSectional && largestHorizontal < sofaLengthRange.minCm) {
    scoreAdjustment -= 360;
    weaknessReasons.push(`sofa length is below the spatial target range (${sofaLengthRange.minCm}-${sofaLengthRange.maxCm} cm)`);
  }
  if (largestHorizontal !== null && !isSectional && largestHorizontal > sofaLengthRange.maxCm) {
    scoreAdjustment -= 180;
    weaknessReasons.push(`sofa length is above the spatial target range (${sofaLengthRange.minCm}-${sofaLengthRange.maxCm} cm)`);
  }
  if (isSectional && !explicitSectional) {
    scoreAdjustment -= 520;
    weaknessReasons.push("sectional or corner sofa was not requested for this straight-sofa composition");
  }
  if (
    softNeutralConcept &&
    hasAnyFamilyCue(tokens, ["black", "blue", "orange", "red", "yellow"]) &&
    !["black", "blue", "orange", "red", "yellow"].some((cue) => tokens.has(cue) && conceptAllowsSeatingCue(conceptText, [cue]))
  ) {
    scoreAdjustment -= 360;
    weaknessReasons.push("sofa colour conflicts with the soft neutral palette");
  }
  if (
    softNeutralConcept &&
    (hasAnyFamilyCue(tokens, ["cognac", "leather", "suede"]) ||
      hasAnyFamilyCue(colorTokens, ["brown", "cognac"])) &&
    !conceptAllowsSeatingCue(conceptText, ["brown", "cognac", "leather", "suede"])
  ) {
    scoreAdjustment -= 420;
    weaknessReasons.push("brown or leather sofa upholstery is weak for the soft neutral fabric palette");
  }
  if (softNeutralConcept && !hasNeutralUpholsteryCue(tokens)) {
    scoreAdjustment -= 260;
    weaknessReasons.push("sofa lacks neutral upholstery evidence for this concept");
  }
  if (
    hasAnyFamilyCue(tokens, ["bed", "office", "outdoor", "recliner"]) ||
    /sofa\s*bed|sofabed|pull[-\s]?out/i.test(option.name)
  ) {
    scoreAdjustment -= 280;
    weaknessReasons.push("utility sofa language is weak for the investor-demo living-room anchor");
  }
  if (
    hasAnyFamilyCue(tokens, ["beige", "boucle", "cream", "ecru", "fabric", "greige", "ivory", "linen", "oatmeal", "sand", "taupe", "white"]) &&
    largestHorizontal !== null &&
    largestHorizontal >= sofaLengthRange.minCm &&
    largestHorizontal <= sofaLengthRange.maxCm &&
    !isSectional
  ) {
    scoreAdjustment += 320;
    reasons.push(`neutral full-size fabric sofa fits the spatial target range (${sofaLengthRange.minCm}-${sofaLengthRange.maxCm} cm)`);
  }
  if (hasAnyFamilyCue(tokens, ["3", "4", "three", "four"]) || /(?:3|4|three|four)[-\s.]*seater/i.test(option.name)) {
    scoreAdjustment += 80;
    reasons.push("multi-seat sofa scale matches the living-room anchor role");
  }

  return { scoreAdjustment, reasons, weaknessReasons };
}

function hasSharedCue(left: Set<string>, right: Set<string>, cues: string[]) {
  return cues.some((cue) => left.has(cue) && right.has(cue));
}

function hasAnyFamilyCue(tokens: Set<string>, cues: string[]) {
  return cues.some((cue) => tokens.has(cue));
}

function hasConflictFamilyCue(tokens: Set<string>) {
  return hasAnyFamilyCue(tokens, ["black", "blue", "chrome", "orange", "pink", "purple", "red", "teal"]);
}

function hasReferenceColorOrMaterialFamilyCue(tokens: Set<string>, referenceTokens: Set<string>) {
  const seatingColorCues = [
    "beige",
    "black",
    "blue",
    "brown",
    "cognac",
    "cream",
    "ecru",
    "gray",
    "grey",
    "green",
    "greige",
    "ivory",
    "oatmeal",
    "orange",
    "red",
    "sage",
    "sand",
    "taupe",
    "white",
    "yellow"
  ];
  const seatingMaterialCues = ["boucle", "chenille", "fabric", "leather", "linen", "suede", "teddy", "textile", "upholstered"];

  return (
    hasSharedCue(tokens, referenceTokens, seatingColorCues) ||
    hasSharedCue(tokens, referenceTokens, seatingMaterialCues)
  );
}

function hasNeutralUpholsteryCue(tokens: Set<string>) {
  return (
    hasAnyFamilyCue(tokens, ["beige", "boucle", "cream", "ecru", "greige", "ivory", "linen", "oatmeal", "sand", "taupe", "white"]) ||
    hasAnyFamilyCue(tokens, ["chenille", "fabric", "textile", "upholstered"])
  );
}

function hasUsablePrice(option: RankedProductMatch) {
  const price = option.salePriceAed ?? option.priceAed;
  return price !== null && price > 0;
}

function isSameRecommendationFamily({
  option,
  reference,
  role
}: {
  option: RankedProductMatch;
  reference: RankedProductMatch;
  role: RoleProductOptions;
}) {
  if (option.id === reference.id) {
    return true;
  }
  if (option.categoryNormalized !== reference.categoryNormalized) {
    return false;
  }

  const optionTokens = productFamilyTokens(option);
  const referenceTokens = productFamilyTokens(reference);
  const neutralCues = ["beige", "cream", "ecru", "greige", "ivory", "linen", "oatmeal", "sand", "taupe", "white"];
  const warmWoodCues = ["brown", "oak", "walnut", "wood"];
  const fabricCues = ["boucle", "chenille", "fabric", "linen", "teddy", "textile", "upholstered"];
  const leatherCues = ["cognac", "leather", "suede"];
  const stoneCues = ["ceramic", "marble", "stone", "travertine"];
  const blackOrChromeCues = ["black", "chrome", "silver"];

  if (
    hasAnyFamilyCue(optionTokens, catalogueConflictColors()) &&
    !hasSharedCue(optionTokens, referenceTokens, catalogueConflictColors())
  ) {
    return false;
  }

  if (role.category === "sofas" || role.category === "armchairs" || role.category === "chairs") {
    if (!hasUsablePrice(option)) {
      return false;
    }
    if (hasConflictFamilyCue(optionTokens) && !hasReferenceColorOrMaterialFamilyCue(optionTokens, referenceTokens)) {
      return false;
    }
    if (
      role.category === "sofas" &&
      hasAnyFamilyCue(optionTokens, ["left", "right", "sectional", "corner", "chaise", "modular"]) !==
        hasAnyFamilyCue(referenceTokens, ["left", "right", "sectional", "corner", "chaise", "modular"])
    ) {
      return false;
    }
    if (
      hasAnyFamilyCue(optionTokens, blackOrChromeCues) &&
      !hasSharedCue(optionTokens, referenceTokens, blackOrChromeCues) &&
      !hasReferenceColorOrMaterialFamilyCue(optionTokens, referenceTokens)
    ) {
      return false;
    }
    if (
      hasAnyFamilyCue(optionTokens, leatherCues) &&
      !hasSharedCue(optionTokens, referenceTokens, leatherCues) &&
      !hasReferenceColorOrMaterialFamilyCue(optionTokens, referenceTokens)
    ) {
      return false;
    }
    return (
      hasSharedCue(optionTokens, referenceTokens, neutralCues) ||
      hasSharedCue(optionTokens, referenceTokens, fabricCues) ||
      hasSharedCue(optionTokens, referenceTokens, warmWoodCues) ||
      hasReferenceColorOrMaterialFamilyCue(optionTokens, referenceTokens)
    );
  }

  if (role.category === "coffee_tables") {
    if (!hasUsablePrice(option)) {
      return false;
    }
    if (hasAnyCatalogueCue(optionTokens, ["desk", "office", "side", "striped", "statement"])) {
      return false;
    }
    return (
      hasSharedCue(optionTokens, referenceTokens, warmWoodCues) ||
      hasSharedCue(optionTokens, referenceTokens, stoneCues) ||
      hasSharedCue(optionTokens, referenceTokens, ["round", "oval", "low"])
    );
  }

  if (role.category === "rugs" || role.category === "curtains") {
    if (!hasUsablePrice(option)) {
      return false;
    }
    return (
      hasSharedCue(optionTokens, referenceTokens, neutralCues) ||
      hasSharedCue(optionTokens, referenceTokens, ["greige", "plain", "solid", "wool"])
    );
  }

  if (role.category === "lighting") {
    if (!hasUsablePrice(option)) {
      return false;
    }
    return (
      hasSharedCue(optionTokens, referenceTokens, ["brass", "bronze", "gold", "linen", "shade"]) ||
      hasSharedCue(optionTokens, referenceTokens, ["floor", "lamp", "table"])
    );
  }

  if (role.category === "storage" || role.category === "side_tables") {
    if (!hasUsablePrice(option)) {
      return false;
    }
    return (
      hasSharedCue(optionTokens, referenceTokens, warmWoodCues) ||
      hasSharedCue(optionTokens, referenceTokens, ["console", "media", "sideboard", "tv"])
    );
  }

  if (role.category === "wall_art" || role.category === "mirrors" || role.category === "decor") {
    return true;
  }

  return true;
}

function preserveCatalogueAnchorRoleOptions({
  roleOptions,
  ranked,
  rankedById,
  catalogueGroundingAnchors,
  optionsPerRole
}: {
  roleOptions: RoleProductOptions[];
  ranked: RankedProductMatch[];
  rankedById: Map<string, RankedProductMatch>;
  catalogueGroundingAnchors: CatalogueGroundingAnchor[];
  optionsPerRole: number;
}) {
  if (catalogueGroundingAnchors.length === 0) {
    return roleOptions;
  }

  const roleOptionsByCategory = new Map(roleOptions.map((role) => [role.category, role]));

  for (const anchor of catalogueGroundingAnchors) {
    const category = normalizeSourcingCategory(anchor.category, anchor.roleLabel);
    const anchorMatch = rankedById.get(anchor.productId);
    if (!anchorMatch) {
      continue;
    }

    const existingRole = roleOptionsByCategory.get(category);
    const role =
      existingRole ??
      ({
        category,
        label: anchor.roleLabel,
        visualBrief: anchor.selectionReason,
        quantity: 1,
        priority: anchor.priority,
        options: []
      } satisfies RoleProductOptions);

    const preservedAnchor = {
      ...anchorMatch,
      selectionReason: [anchorMatch.selectionReason, "catalogue-grounded concept anchor"].join("; ")
    };
    const optionsById = new Map(role.options.map((option) => [option.id, option]));
    optionsById.set(anchor.productId, preservedAnchor);
    const remainingOptions = role.options.filter((option) => option.id !== anchor.productId);
    roleOptionsByCategory.set(category, {
      ...role,
      options: [preservedAnchor, ...remainingOptions].slice(0, Math.max(1, optionsPerRole))
    });
  }

  const ordered = roleOptions.map((role) => roleOptionsByCategory.get(role.category) ?? role);
  const orderedCategories = new Set(ordered.map((role) => role.category));
  for (const match of ranked) {
    const anchor = catalogueGroundingAnchors.find((candidate) => candidate.productId === match.id);
    if (!anchor) {
      continue;
    }
    const category = normalizeSourcingCategory(anchor.category, anchor.roleLabel);
    const role = roleOptionsByCategory.get(category);
    if (role && !orderedCategories.has(category)) {
      ordered.push(role);
      orderedCategories.add(category);
    }
  }

  return ordered;
}

function polishRoleOptionsForAestheticDemo({
  roleOptions,
  ranked,
  rankedById,
  catalogueGroundingAnchors,
  conceptText,
  localSkuFidelityMode,
  optionsPerRole
}: {
  roleOptions: RoleProductOptions[];
  ranked: RankedProductMatch[];
  rankedById: Map<string, RankedProductMatch>;
  catalogueGroundingAnchors: CatalogueGroundingAnchor[];
  conceptText: string;
  localSkuFidelityMode: boolean;
  optionsPerRole: number;
}) {
  const preserved = preserveCatalogueAnchorRoleOptions({
    roleOptions,
    ranked,
    rankedById,
    catalogueGroundingAnchors,
    optionsPerRole
  });

  if (!localSkuFidelityMode) {
    return preserved;
  }

  const anchorIdsByCategory = new Map<string, Set<string>>();
  for (const anchor of catalogueGroundingAnchors) {
    const category = normalizeSourcingCategory(anchor.category, anchor.roleLabel);
    const anchorIds = anchorIdsByCategory.get(category) ?? new Set<string>();
    anchorIds.add(anchor.productId);
    anchorIdsByCategory.set(category, anchorIds);
  }

  return preserved
    .map((role) => {
      const anchorIds = anchorIdsByCategory.get(role.category) ?? new Set<string>();
      const sortedOptions = [...role.options].sort((left, right) => {
        const leftIsAnchor = anchorIds.has(left.id);
        const rightIsAnchor = anchorIds.has(right.id);
        if (!localSkuFidelityMode && leftIsAnchor && !rightIsAnchor) {
          return -1;
        }
        if (!localSkuFidelityMode && !leftIsAnchor && rightIsAnchor) {
          return 1;
        }
        return (
          themeAlignedOptionScore(
            right,
            role,
            preferredCatalogueTokens(conceptText),
            catalogueConflictColors(),
            localSkuFidelityMode
          ) -
            themeAlignedOptionScore(
              left,
              role,
              preferredCatalogueTokens(conceptText),
              catalogueConflictColors(),
              localSkuFidelityMode
            ) ||
          right.score - left.score
        );
      });
      const anchorOptions = localSkuFidelityMode
        ? sortedOptions.filter(
            (option) => anchorIds.has(option.id) && isCredibleAestheticDemoOption(option, role, conceptText, localSkuFidelityMode)
          )
        : sortedOptions.filter((option) => anchorIds.has(option.id));
      const referenceOption =
        (localSkuFidelityMode
          ? sortedOptions.find((option) => isCredibleAestheticDemoOption(option, role, conceptText, localSkuFidelityMode))
          : anchorOptions[0]) ??
        anchorOptions[0] ??
        sortedOptions.find((option) => isCredibleAestheticDemoOption(option, role, conceptText, localSkuFidelityMode));
      const credibleOptions = sortedOptions.filter(
        (option) => !anchorIds.has(option.id) && isCredibleAestheticDemoOption(option, role, conceptText, localSkuFidelityMode)
      );
      const familyOptions = referenceOption
        ? credibleOptions.filter((option) =>
            isSameRecommendationFamily({
              option,
              reference: referenceOption,
              role
            })
          )
        : credibleOptions;
      const polishedOptions = anchorOptions.length > 0
        ? [...anchorOptions, ...familyOptions]
        : referenceOption
          ? [referenceOption, ...familyOptions.filter((option) => option.id !== referenceOption.id)]
          : familyOptions;

      return {
        ...role,
        options: polishedOptions.slice(0, Math.max(1, optionsPerRole))
      };
    })
    .filter((role) => role.options.length > 0);
}

function ensureLocalSkuFidelitySupportOptions({
  roleOptions,
  roles,
  ranked,
  conceptText,
  localSkuFidelityMode
}: {
  roleOptions: RoleProductOptions[];
  roles: RoomProductRoleSpec[];
  ranked: RankedProductMatch[];
  conceptText: string;
  localSkuFidelityMode: boolean;
}) {
  if (!localSkuFidelityMode) {
    return roleOptions;
  }

  const roleOptionsByCategory = new Map(roleOptions.map((role) => [role.category, role]));
  for (const role of roles) {
    if (roleOptionsByCategory.has(role.category)) {
      continue;
    }

    const options = ranked
      .filter((option) => (option.categoryNormalized ?? "") === role.category)
      .filter((option) =>
        isCredibleAestheticDemoOption(
          option,
          {
            category: role.category,
            label: role.label,
            visualBrief: role.visualBrief,
            quantity: role.quantity,
            priority: role.priority,
            options: []
          },
          conceptText,
          localSkuFidelityMode
        )
      )
      .slice(0, 6);

    if (options.length > 0) {
      roleOptionsByCategory.set(role.category, {
        category: role.category,
        label: role.label,
        visualBrief: role.visualBrief,
        quantity: role.quantity,
        priority: role.priority,
        options
      });
    }
  }

  return roles
    .map((role) => roleOptionsByCategory.get(role.category))
    .filter((role): role is RoleProductOptions => Boolean(role));
}

function mergeRoomRoles(primary: RoomProductRoleSpec[], secondary: RoomProductRoleSpec[]) {
  const roles: RoomProductRoleSpec[] = [];
  const categories = new Set<string>();

  for (const role of [...primary, ...secondary]) {
    if (categories.has(role.category)) {
      continue;
    }

    roles.push(role);
    categories.add(role.category);
  }

  return roles;
}

function poolToSourcingRolePool(pool: RoleScopedCandidatePool, allowedCandidateIds: Set<string>) {
  return {
    category: pool.role.category,
    roleLabel: pool.role.label,
    visualBrief: pool.role.visualBrief,
    quantity: pool.role.quantity,
    priority: pool.role.priority,
    candidateIds: pool.candidates
      .map((candidate) => candidate.id)
      .filter((candidateId) => allowedCandidateIds.has(candidateId))
  };
}

function roleCandidateCountSummary(pools: RoleScopedCandidatePool[]) {
  return pools.map((pool) => ({
    category: pool.role.category,
    roleLabel: pool.role.label,
    priority: pool.role.priority,
    candidateCount: pool.candidateCount,
    rejectedCount: pool.rejectedCount,
    rejectionReasons: pool.rejectionReasons,
    weaknessReasons: pool.weaknessReasons
  }));
}

function roleStatusSummary(
  roleResults: Array<{
    category: string;
    roleLabel: string;
    status: string;
    productId: string | null;
    reason: string;
  }>
) {
  return roleResults.map((result) => ({
    category: normalizeSourcingCategory(result.category, result.roleLabel),
    roleLabel: result.roleLabel,
    status: result.status,
    productId: result.productId,
    reason: result.reason
  }));
}

function roleConfidenceOutputFields(
  pools: RoleScopedCandidatePool[],
  roleResults: Array<{
    category: string;
    roleLabel: string;
    status: "strong_match" | "acceptable_match" | "closest_available" | "missing_required" | "missing_supporting";
    productId: string | null;
    reason: string;
  }>,
  nowMs: number,
  roomMeasurements: {
    wallLengthCm: number | null;
    roomDepthCm: number | null;
  } | null = null,
  visualSourcingDiagnostics: ReturnType<typeof productSourcingTimeoutDiagnostics> | null = null
) {
  const roleConfidence = productMatchConfidenceOutputSummary({
    pools,
    roleResults: roleResults.map((result) => ({
      ...result,
      category: normalizeSourcingCategory(result.category, result.roleLabel)
    })),
    nowMs,
    roomMeasurements
  });
  const requiredRoles = pools
    .filter((pool) => pool.role.priority === "required")
    .map((pool) =>
      productMatchRequiredRoleDescriptor({
        category: pool.role.category,
        roleLabel: pool.role.label
      })
    );

  return {
    roleConfidence,
    roleConfidenceGate: productMatchQaStopRuleOutputSummary({ roleConfidence, requiredRoles }),
    visualSourcingEvidence: buildProductMatchVisualSourcingEvidence({
      diagnostics: visualSourcingDiagnostics,
      roleConfidence
    })
  };
}

function matchToSourcingCandidate(match: RankedProductMatch) {
  return {
    id: match.id,
    name: match.name,
    retailerName: match.retailerName,
    category: match.categoryNormalized,
    description: match.description,
    priceAed: match.priceAed,
    salePriceAed: match.salePriceAed,
    availability: match.availability,
    color: match.color,
    material: match.material,
    primaryImageUrl: match.primaryImageUrl,
    dimensions: match.dimensions?.sourceText ?? null,
    searchTags: [
      match.categoryNormalized,
      match.color,
      match.material,
      ...match.styleTags,
      ...match.colorTags,
      ...match.materialTags,
      ...match.roomTags
    ].filter((tag): tag is string => Boolean(tag))
  };
}

function normalizeSourcingCategory(category: string, roleLabel: string) {
  return normalizeProductMatchRoleResultCategory(category, roleLabel);
}

function roleLabelFromSelectionReason(selectionReason: string | null) {
  return selectionReason?.match(/room role: ([^;]+)/)?.[1]?.trim() ?? null;
}

function formatProductDimensionsForRender(
  dimensions:
    | {
        width_cm: number | null;
        depth_cm: number | null;
        height_cm: number | null;
        source_text: string | null;
      }
    | null
) {
  if (!dimensions) {
    return null;
  }

  if (dimensions.source_text) {
    return dimensions.source_text;
  }

  const parts = [
    dimensions.width_cm ? `W ${dimensions.width_cm} cm` : null,
    dimensions.depth_cm ? `D ${dimensions.depth_cm} cm` : null,
    dimensions.height_cm ? `H ${dimensions.height_cm} cm` : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" x ") : null;
}

function missingLocalSkuFidelityRenderRoles({
  roomType,
  selectedCategories
}: {
  roomType: string;
  selectedCategories: string[];
}) {
  if (!roomType.toLowerCase().includes("living")) {
    return [];
  }

  const selected = new Set(selectedCategories.map((category) => normalizeSourcingCategory(category, category)));
  const minimumVisibleSupportRoles = [
    { category: "storage", label: "TV/media console" },
    { category: "lighting", label: "lighting" },
    { category: "side_tables", label: "side/end table" },
    { category: "decor", label: "decor" }
  ];

  return minimumVisibleSupportRoles
    .filter((role) => !selected.has(role.category))
    .map((role) => role.label);
}

function formatAedValue(value: number) {
  return `AED ${value.toLocaleString("en-AE", {
    maximumFractionDigits: 0
  })}`;
}

async function fetchRemoteImage(url: string): Promise<CatalogueReferenceImage | null> {
  // Retailer CDNs rate-limit and flake; one quick retry rescues most transient
  // failures without meaningfully slowing the happy path.
  const first = await fetchRemoteImageOnce(url);
  if (first) {
    return first;
  }
  await new Promise((resolve) => setTimeout(resolve, 750));
  return fetchRemoteImageOnce(url);
}

async function fetchRemoteImageOnce(url: string): Promise<CatalogueReferenceImage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CATALOGUE_GROUNDED_CONCEPT_IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "RitzyStudioBot/0.1 (+https://ritzy-studio.local; final render references)"
      }
    });

    if (!response.ok) {
      return null;
    }

    const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      return null;
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > PRODUCT_SOURCING_MAX_IMAGE_BYTES) {
      return null;
    }

    const bytes = await readResponseBytesWithLimit(response, PRODUCT_SOURCING_MAX_IMAGE_BYTES);
    if (!bytes) {
      return null;
    }

    return {
      bytes: Buffer.from(bytes),
      mimeType
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBytesWithLimit(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) {
    return null;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return null;
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks, totalBytes);
}
