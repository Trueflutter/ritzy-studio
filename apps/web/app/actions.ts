"use server";

import {
  analyzeInspirationImages,
  generateClarifyingQuestions,
  extractConceptImagePalette,
  sourceProductsFromConcept,
  stageTextConfig,
  sumUsdCosts
} from "@ritzy-studio/ai";
import type { Database } from "@ritzy-studio/db";
import {
  createProjectSchema,
  createRoomSchema,
  designBriefSchema,
  buildRoleScopedCandidatePools,
  buildProductSourcingRuntimePlan,
  buildShoppingListItemRows,
  buildPersistedSelectionSnapshot,
  composeRoomProductOptions,
  conceptPaletteMatchingText,
  fitSelectionToBudget,
  parseConceptImagePalette,
  enhancedProductRolesForRoom,
  productRolesForRoom,
  rankProductMatches,
  selectedItemsTotalAed,
  setUserModeSchema,
  substitutionModeSchema,
  summarizeRolePoolDiversity,
  summarizeRolePoolQuality,
  summarizePoolQaRollup,
  visualStyleOptions,
  visualStyleSummary,
  type ProductMatchCandidate,
  type RoomProductRoleSpec
} from "@ritzy-studio/domain";
import { productMatchingControlledPreviewGate, renderExecutionMode, signupAllowed,
  configuredTextModel
} from "@ritzy-studio/config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { selectShoppingItem, substituteProduct } from "@/lib/services/selection-swap";
import {
  generateInitialConceptForRoom,
  selectConcept
} from "@/lib/services/concept-generation";
import { storageImageDataUrl } from "@/lib/services/storage-images";
import { reviseConceptForRoom } from "@/lib/services/concept-revision";
import {
  CATALOGUE_GROUNDED_CONCEPT_REFERENCE_IMAGE_BLOCK_MESSAGE,
  CATALOGUE_GROUNDED_CONCEPT_USER_SAFE_BLOCK_MESSAGE,
  LOCAL_SKU_FIDELITY_CANDIDATES_PER_ROLE,
  PRODUCT_MATCHING_CATALOG_LIMIT,
  PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_DETAIL,
  PRODUCT_SOURCING_AI_CANDIDATE_IMAGE_LIMIT,
  PRODUCT_SOURCING_AI_CONCEPT_IMAGE_DETAIL,
  PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED,
  PRODUCT_SOURCING_AI_TIMEOUT_MS,
  PRODUCT_SOURCING_IMAGE_PREFLIGHT_BUDGET_MS,
  PRODUCT_SOURCING_IMAGE_PREFLIGHT_TIMEOUT_MS,
  bestThemeAlignedOptionForRole,
  catalogUnavailableMessage,
  catalogueGroundingAnchorsForConcept,
  ensureLocalSkuFidelitySupportOptions,
  fetchLocalSkuFidelityRoleWindowCandidates,
  fetchProductsById,
  formatAedValue,
  isRecord,
  matchToSourcingCandidate,
  mergeProductMatchCandidates,
  mergeRoomRoles,
  missingLocalSkuFidelityRenderRoles,
  normalizeSourcingCategory,
  polishRoleOptionsForAestheticDemo,
  poolToSourcingRolePool,
  previousShoppingListRefreshHistory,
  productImageCatalogRefreshMessage,
  productSourcingAiPayloadSummary,
  productSourcingFailureMessage,
  productSourcingTimeoutDiagnostics,
  productToMatchCandidate,
  rankMatchesForLocalSkuFidelity,
  recentlyUsedProductIdsForUser,
  rerankRolePoolForAestheticFit,
  roleCandidateCountSummary,
  roleConfidenceOutputFields,
  roleScopedCandidatesForLocalSkuFidelityPlan,
  roleScopedShoppingAlternates,
  roleStatusSummary,
  shoppingListRoleSpecFromRow,
  sourcingCandidateImageDataUrls,
  splitAvoidColorCues,
  structuredBriefJson,
  type ProductRow
} from "@/lib/services/sourcing-support";
import { createClient } from "@/lib/supabase/server";
import { FINAL_RENDER_STALE_MS } from "@/lib/render";
import { localSkuFidelityModeEnabled } from "@/lib/render-flags";
import { PRODUCT_SOURCING_MAX_IMAGE_BYTES } from "@/lib/render-images";
import { enqueueFinalRender, runFinalRender } from "@/lib/render-runner";
import {
  appUrl,
  DESIGNER_MONTHLY_AMOUNT_USD,
  getStripe,
  HOMEOWNER_ROOM_UNLOCK_AMOUNT_AED,
  HOMEOWNER_ROOM_UNLOCK_PRICE_AED
} from "@/lib/billing/stripe";
import {
  buildProductImagePreflightGate,
  preflightProductCandidateImages,
  skippedProductImagePreflight,
  type ProductImagePreflightSummary
} from "./product-image-preflight";
import {
  isProviderImageDownloadError,
  isProductSourcingTimeoutError,
  productSourcingTimeoutMessage
} from "./product-sourcing-failure";
import { buildProductSourcingTextFallbackResult } from "./product-sourcing-text-fallback";
import {
  productSourcingRetryFallbackEvidenceForStrategy,
  productSourcingVisualStrategy
} from "./product-sourcing-visual-strategy";
import {
  inspirationAnalysisContinueDecision,
  INSPIRATION_ANALYSIS_CONTINUE_FAILURE_MESSAGE
} from "./inspiration-analysis-continue";

const INTERNAL_PILOT_SIGNUP_MESSAGE =
  "Internal pilot. Only ritzyinteriors.com email domains currently permitted";


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

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ServiceSupabaseClient = ReturnType<typeof createServiceClient>;
type InspirationAnalysisAsset = { storage_path: string };



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
  // The dashboard routes unknown-mode users to onboarding itself; sending every
  // returning sign-in to /onboarding re-asked the already-answered mode question
  // on every login (I-4: observed on production, reproduced on any environment).
  redirect("/");
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = optionalString(formData, "name");

  if (!signupAllowed(email)) {
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
          price_aed: HOMEOWNER_ROOM_UNLOCK_PRICE_AED,
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
        price_aed: HOMEOWNER_ROOM_UNLOCK_PRICE_AED,
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
      model: stageTextConfig("clarifying_questions", configuredTextModel()).model,
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
        cost_estimate_usd: result.textCostUsd ?? null,
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
      model: stageTextConfig("inspiration_analysis", configuredTextModel()).model,
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
        cost_estimate_usd: result.textCostUsd ?? null,
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

  const serviceSupabase = createServiceClient();

  const result = await generateInitialConceptForRoom(
    { supabase, serviceSupabase },
    { userId: user.id, projectId, roomId },
    {
      ensureEntitled: () => requireDesignerFreeRoomAccess(user.id, roomId, redirectPath),
      defer: (task) =>
        after(async () => {
          await task();
          revalidatePath(redirectPath);
        })
    }
  );

  switch (result.status) {
    case "room_not_found":
      redirect("/");
    case "missing_brief":
      redirect(`/projects/${projectId}/rooms/${roomId}/brief`);
    case "already_generated":
      redirect(`${redirectPath}?message=${encodeURIComponent("Initial concept already generated.")}`);
    case "missing_photo":
      redirect(`/projects/${projectId}/rooms/${roomId}/photos`);
    case "already_running":
      redirect(`${redirectPath}?message=${encodeURIComponent("Concept generation is already running.")}`);
    case "photo_unprepared":
      redirect(`${redirectPath}?message=${encodeURIComponent("The room photo could not be prepared for generation.")}`);
    case "grounding_blocked":
      redirect(`${redirectPath}?message=${encodeURIComponent(CATALOGUE_GROUNDED_CONCEPT_USER_SAFE_BLOCK_MESSAGE)}`);
    case "reference_images_missing":
      redirect(`${redirectPath}?message=${encodeURIComponent(CATALOGUE_GROUNDED_CONCEPT_REFERENCE_IMAGE_BLOCK_MESSAGE)}`);
    case "generation_failed":
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

  await selectConcept(supabase, { roomId, conceptId });

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

  // The user's explicit avoid-colour instruction (brief avoid_notes, e.g. "avoid bright red") must
  // reach product matching. The concept-image palette's avoidColors is an inferred signal and can
  // miss what the user asked for, so union the two before the sourcing avoid-colour filter runs.
  const { data: sourcingDesignBrief } = await supabase
    .from("design_briefs")
    .select("avoid_notes")
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
  let paletteTextCostUsd: number | null = null;
  let initialSourcingTextCostUsd: number | null = null;
  if (!conceptPalette) {
    try {
      const paletteResult = await extractConceptImagePalette({
        imageUrl: conceptSignedImage.signedUrl
      });
      paletteTextCostUsd = paletteResult.textCostUsd ?? null;
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
  const briefAvoidColorTags = splitAvoidColorCues(sourcingDesignBrief?.avoid_notes ?? "").avoidColorTags;
  const conceptAvoidColorTags = Array.from(
    new Set([...(conceptPalette?.avoidColors ?? []), ...briefAvoidColorTags])
  );

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
  // Only fetch when the AI actually consumes product images; otherwise the gate and sanitized
  // candidates are discarded, so a slow CDN would add up to the whole preflight budget for nothing.
  const initialImagePreflight = PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED
    ? await preflightProductCandidateImages(sourcingCandidates, {
        timeoutMs: PRODUCT_SOURCING_IMAGE_PREFLIGHT_TIMEOUT_MS,
        budgetMs: PRODUCT_SOURCING_IMAGE_PREFLIGHT_BUDGET_MS,
        maxBytes: PRODUCT_SOURCING_MAX_IMAGE_BYTES
      })
    : skippedProductImagePreflight(sourcingCandidates);
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
      model: stageTextConfig("product_sourcing", configuredTextModel()).model,
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
        model: configuredTextModel()
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
        cost_estimate_usd: sumUsdCosts(sourcingResult.textCostUsd, paletteTextCostUsd),
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
        model: configuredTextModel()
      });

      if (sourcingResult.needs.length > 0 && sourcingResult.selectedProducts.length > 0) {
        await serviceSupabase
          .from("ai_jobs")
          .update({
            status: "succeeded",
            completed_at: new Date().toISOString(),
            model: sourcingResult.model,
            prompt_version: sourcingResult.promptVersion,
            cost_estimate_usd: sumUsdCosts(sourcingResult.textCostUsd, paletteTextCostUsd),
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
    const retryImagePreflight = PRODUCT_SOURCING_AI_PRODUCT_IMAGES_ENABLED
      ? await preflightProductCandidateImages(retryCandidates, {
          timeoutMs: PRODUCT_SOURCING_IMAGE_PREFLIGHT_TIMEOUT_MS,
          budgetMs: PRODUCT_SOURCING_IMAGE_PREFLIGHT_BUDGET_MS,
          maxBytes: PRODUCT_SOURCING_MAX_IMAGE_BYTES
        })
      : skippedProductImagePreflight(retryCandidates);
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
        model: configuredTextModel()
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
      // The first attempt's spend is real even though its result is being replaced.
      initialSourcingTextCostUsd = sourcingResult?.textCostUsd ?? initialSourcingTextCostUsd;
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
          cost_estimate_usd: sumUsdCosts(initialSourcingTextCostUsd, sourcingResult.textCostUsd, paletteTextCostUsd),
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

  // Aggregate budget adherence: per-role selection above has no view of the running total, so the
  // qty-aware line-total sum can exceed the stated budget (a role at qty 2 doubles its line). Fit
  // the selection to budget by downgrading roles to cheaper in-pool alternates before persisting.
  const budgetFit = fitSelectionToBudget({
    roleOptions,
    selectedProductIdByRole,
    budgetMaxAed: project.budget_max_aed ?? null
  });
  const budgetAdjustedSelection = budgetFit.selectedProductIdByRole;

  const selectedFirstRoleOptions = roleOptions.map((role) => {
    const selectedId = budgetAdjustedSelection.get(role.category);
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
    selectedProductIdByRole: budgetAdjustedSelection,
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

  const result = await substituteProduct(
    { supabase, serviceSupabase },
    { projectId, roomId, shoppingListId, itemId, mode }
  );

  if (result.status === "not_found") {
    redirect("/");
  }

  if (result.status === "not_substitutable") {
    redirect(`${redirectPath}?message=${encodeURIComponent("The current product cannot be substituted yet.")}`);
  }

  if (result.status === "no_replacement") {
    redirect(`${redirectPath}?message=${encodeURIComponent("No suitable replacement found for that line yet.")}`);
  }

  const impactText =
    result.priceImpactAed === 0
      ? "no price change"
      : `${result.priceImpactAed > 0 ? "+" : "-"}${formatAedValue(Math.abs(result.priceImpactAed))}`;

  revalidatePath(redirectPath);
  redirect(`${redirectPath}?message=${encodeURIComponent(`Product swapped. Price impact: ${impactText}.`)}`);
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

  const result = await selectShoppingItem(supabase, { shoppingListId, itemId });

  if (result.status === "not_found") {
    return;
  }

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
    const { data: failedRows, error: reclaimError } = await supabase
      .from("render_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "Final render timed out before completion. Please retry."
      })
      .eq("id", matchingRenderJob.id)
      .in("status", ["running", "queued"])
      .select("id");

    // Distinguish a DB error from a genuine CAS miss: an error must NOT be read as "another
    // process won" (that would leave the stale job running and silently drop the retry).
    if (reclaimError) {
      throw new Error(reclaimError.message);
    }
    if (failedRows.length === 0) {
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
  const executionMode = renderExecutionMode();
  const renderJobInputSummary = {
    selectionKey,
    selectedShoppingItemIds,
    productCount: selectedProducts.length,
    conceptTitle: concept.title,
    // The durable runner re-derives everything else from the job row; these two save it a
    // lookup and survive even if the room/project rows change later.
    userId: user.id,
    revealPath,
    executionPath: executionMode
  };
  const { data: renderJob, error: renderJobError } = await supabase
    .from("render_jobs")
    .insert({
      room_id: roomId,
      concept_id: conceptId,
      shopping_list_id: shoppingListId,
      status: "queued",
      input_asset_ids: [roomPhoto.id],
      product_ids: productIds,
      input_summary: renderJobInputSummary
    })
    .select("id")
    .single();

  if (renderJobError) {
    if (renderJobError.code === "23505") {
      redirect(`${revealPath}?message=${encodeURIComponent("Final render is already running.")}`);
    }

    throw new Error(renderJobError.message);
  }

  // Durable path: hand the job id to the Vercel Queues consumer and return. The render then
  // survives this request being torn down, and failed attempts are redelivered. Locally (and if
  // enqueueing itself fails) fall back to the in-request after() task through the same runner.
  let scheduleInline = executionMode === "inline";
  if (executionMode === "queue") {
    try {
      await enqueueFinalRender(renderJob.id);
    } catch (error) {
      console.error(
        `Final render enqueue failed for job ${renderJob.id}; falling back to in-request execution.`,
        error
      );
      scheduleInline = true;
      await serviceSupabase
        .from("render_jobs")
        .update({ input_summary: { ...renderJobInputSummary, executionPath: "inline-fallback" } })
        .eq("id", renderJob.id)
        .eq("status", "queued");
    }
  }
  if (scheduleInline) {
    after(() =>
      runFinalRender({ renderJobId: renderJob.id, attempt: { mode: "inline" } }).catch((error) => {
        console.error(`Inline final render execution failed for job ${renderJob.id}.`, error);
      })
    );
  }

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

  const serviceSupabase = createServiceClient();

  const result = await reviseConceptForRoom(
    { supabase, serviceSupabase },
    { userId: user.id, projectId, roomId, conceptId, critique },
    {
      defer: (task) =>
        after(async () => {
          await task();
          revalidatePath(redirectPath);
        })
    }
  );

  switch (result.status) {
    case "not_found":
      redirect("/");
    case "anchored":
      redirect(
        `${redirectPath}?message=${encodeURIComponent(
          "This room direction is ready for sourcing. To make changes, adjust selected pieces after the shopping list is built."
        )}`
      );
    case "missing_brief":
      redirect(`/projects/${projectId}/rooms/${roomId}/brief`);
    case "missing_photo":
      redirect(`/projects/${projectId}/rooms/${roomId}/photos`);
    case "photo_unprepared":
      redirect(`${redirectPath}?message=${encodeURIComponent("The original room photo could not be prepared for revision.")}`);
    case "revision_failed":
      redirect(`${redirectPath}?message=${encodeURIComponent("Concept revision failed. The critique was saved.")}`);
  }

  revalidatePath(redirectPath);
  redirect(`${redirectPath}?message=${encodeURIComponent("Revised concept generated.")}`);
}
