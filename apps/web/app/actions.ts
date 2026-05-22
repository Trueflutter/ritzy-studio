"use server";

import {
  analyzeInspirationImages,
  generateClarifyingQuestions,
  generateConceptRevision,
  generateFinalGroundedRender,
  generateInitialConcept,
  sourceProductsFromConcept
} from "@ritzy-studio/ai";
import type { Database } from "@ritzy-studio/db";
import {
  createHomeownerRoomSchema,
  createProjectSchema,
  createRoomSchema,
  designBriefSchema,
  buildProductSourcingRuntimePlan,
  buildShoppingListItemRows,
  composeRoomProductOptions,
  filterSubstitutionCandidates,
  enhancedProductRolesForRoom,
  productRolesForRoom,
  rankProductMatches,
  selectedItemsTotalAed,
  setUserModeSchema,
  sortProductsForRenderReferences,
  substitutionModeSchema,
  visualStyleOptions,
  visualStyleSummary,
  type RankedProductMatch,
  type ProductMatchCandidate,
  type RoleScopedCandidatePool,
  type RoomProductRoleSpec
} from "@ritzy-studio/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import {
  appUrl,
  DESIGNER_MONTHLY_AMOUNT_USD,
  getStripe,
  HOMEOWNER_ROOM_UNLOCK_AMOUNT_AED
} from "@/lib/billing/stripe";

const PRODUCT_SOURCING_AI_TIMEOUT_MS = 45_000;
const PRODUCT_MATCHING_CATALOG_LIMIT = 1500;

function productReferenceOrderingV2Enabled() {
  return process.env.RITZY_PRODUCT_REFERENCE_ORDERING_V2_ENABLED === "true";
}

function productMatchingEngineV1Enabled() {
  return process.env.RITZY_PRODUCT_MATCHING_ENGINE_V1_ENABLED === "true";
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
};

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
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name
      }
    }
  });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
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
  const parsed = createRoomSchema.parse({
    projectId: String(formData.get("projectId") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    roomType: String(formData.get("roomType") ?? "").trim()
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
      name: parsed.name,
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
      (inspirationAssets ?? []).map(async (asset) => {
        const { data } = await supabase.storage
          .from("room-assets")
          .createSignedUrl(asset.storage_path, 60 * 30);

        return data?.signedUrl ?? null;
      })
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

  const { data: inspirationAssets = [] } = await supabase
    .from("room_assets")
    .select("storage_path")
    .eq("room_id", roomId)
    .eq("asset_type", "inspiration_image")
    .order("created_at", { ascending: true })
    .limit(6);

  const signedUrls = (
    await Promise.all(
      (inspirationAssets ?? []).map(async (asset) => {
        const { data } = await supabase.storage
          .from("room-assets")
          .createSignedUrl(asset.storage_path, 60 * 30);

        return data?.signedUrl ?? null;
      })
    )
  ).filter((url): url is string => Boolean(url));

  if (signedUrls.length === 0) {
    return;
  }

  const serviceSupabase = createServiceClient();
  const { data: job, error: jobError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: user.id,
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
      (inspirationAssets ?? []).map(async (asset) => {
        const { data } = await supabase.storage
          .from("room-assets")
          .createSignedUrl(asset.storage_path, 60 * 30);

        return data?.signedUrl ?? null;
      })
    )
  ).filter((url): url is string => Boolean(url));

  const { data: photoBlob, error: downloadError } = await supabase.storage
    .from("room-assets")
    .download(roomPhoto.storage_path);

  if (!signedPhoto?.signedUrl || downloadError || !photoBlob) {
    redirect(`${redirectPath}?message=${encodeURIComponent("The room photo could not be prepared for generation.")}`);
  }

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!measurements || !hasRequiredRoomSize(measurements)) {
    redirect(
      `/projects/${projectId}/rooms/${roomId}/brief/details?message=${encodeURIComponent(
        "Add the room measurements before generating a design. This keeps furniture sizing honest."
      )}`
    );
  }

  const { data: answeredQuestions = [] } = await supabase
    .from("clarifying_questions")
    .select("question, answer")
    .eq("design_brief_id", designBrief.id)
    .eq("status", "answered")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const { data: job, error: jobError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: user.id,
      room_id: roomId,
      job_type: "initial_concept_generation",
      status: "running",
      provider: process.env.RITZY_IMAGE_PROVIDER ?? "openai",
      model: `${process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini"} + ${
        (process.env.RITZY_IMAGE_PROVIDER ?? "openai") === "gemini"
          ? (process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image-preview")
          : (process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2")
      }`,
      prompt_version: null,
      input_summary: {
        roomId,
        designBriefId: designBrief.id,
        roomPhotoAssetId: roomPhoto.id,
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
      roomPhotoUrl: signedPhoto.signedUrl,
      roomPhotoBytes: photoBytes,
      roomPhotoMimeType: roomPhoto.mime_type,
      inspirationImageUrls: signedInspirationUrls,
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
          `Uncertainty: ${result.concept.uncertaintyNote}`
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
    .select("id, title, description, status, primary_image_asset:room_assets(*)")
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

  if (candidates.length === 0) {
    const message = catalogUnavailableMessage(products ?? []);
    redirect(`${redirectPath}?message=${encodeURIComponent(message)}`);
  }

  const baseConceptText = `${concept.title}\n${concept.description ?? ""}`;
  const conceptImageAsset = Array.isArray(concept.primary_image_asset)
    ? concept.primary_image_asset[0]
    : concept.primary_image_asset;
  const { data: conceptSignedImage } = conceptImageAsset?.storage_path
    ? await serviceSupabase.storage
        .from("generated-renders")
        .createSignedUrl(conceptImageAsset.storage_path, 60 * 30)
    : { data: null };
  const blueprintRoles: RoomProductRoleSpec[] = enhancedProductRolesForRoom(room.room_type).map((role) => ({
    category: role.category,
    label: role.label,
    visualBrief: role.visualBrief ?? null,
    quantity: role.quantity,
    priority: role.required ? "required" : "supporting"
  }));
  if (!conceptSignedImage?.signedUrl) {
    redirect(
      `${redirectPath}?message=${encodeURIComponent(
        "Product sourcing needs the concept image before it can match catalog pieces."
      )}`
    );
  }

  const productMatchingEngineEnabled = productMatchingEngineV1Enabled();
  const sourcingPlan = buildProductSourcingRuntimePlan({
    engineEnabled: productMatchingEngineEnabled,
    roomType: room.room_type,
    conceptText: baseConceptText,
    roles: blueprintRoles,
    candidates,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? {
          wallLengthCm: measurements.wall_length_cm,
          roomDepthCm: measurements.room_depth_cm
        }
      : null,
    candidatesPerRole: 6,
    flatCandidateLimit: 36
  });
  const sourcingPools = sourcingPlan.roleScopedPools;
  const sourcingCandidates = sourcingPlan.candidates;
  const sourcingCandidateIds = new Set(sourcingCandidates.map((candidate) => candidate.id));
  const sourcingCandidatePools = sourcingPools.map((pool) => poolToSourcingRolePool(pool, sourcingCandidateIds));
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
        candidateCount: sourcingCandidates.length,
        blueprintRoleCount: blueprintRoles.length,
        roleCandidateCounts: productMatchingEngineEnabled ? roleCandidateCountSummary(sourcingPools) : undefined
      }
    })
    .select("id")
    .single();

  if (sourcingJobError) {
    throw new Error(sourcingJobError.message);
  }

  let sourcingResult: Awaited<ReturnType<typeof sourceProductsFromConcept>>;
  try {
    sourcingResult = await withTimeout(
      sourceProductsFromConcept({
        roomType: room.room_type,
        conceptTitle: concept.title,
        conceptDescription: concept.description,
        conceptImageUrl: conceptSignedImage.signedUrl,
        candidates: sourcingCandidates.map(matchToSourcingCandidate),
        roleCandidatePools: productMatchingEngineEnabled ? sourcingCandidatePools : undefined
      }),
      PRODUCT_SOURCING_AI_TIMEOUT_MS,
      "Product visual sourcing timed out."
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
          roleCandidateCounts: productMatchingEngineEnabled ? roleCandidateCountSummary(sourcingPools) : undefined,
          roleStatuses: productMatchingEngineEnabled ? roleStatusSummary(sourcingResult.roleResults) : undefined
        }
      })
      .eq("id", sourcingJob.id);
  } catch (error) {
    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Product visual sourcing failed."
      })
      .eq("id", sourcingJob.id);

    redirect(
      `${redirectPath}?message=${encodeURIComponent(
        "Product sourcing could not read the concept image clearly enough. Please try sourcing again."
      )}`
    );
  }

  if (sourcingResult.needs.length === 0 || sourcingResult.selectedProducts.length === 0) {
    redirect(
      `${redirectPath}?message=${encodeURIComponent(
        "Product sourcing could not find enough visually relevant catalog pieces. Please try sourcing again."
      )}`
    );
  }
  const visualConceptText = [
    baseConceptText,
    ...(sourcingResult?.needs.map(
      (need) => `${need.roleLabel}: ${need.visualBrief}`
    ) ?? [])
  ].join("\n");
  const visualRanked = rankProductMatches({
    roomType: room.room_type,
    conceptText: visualConceptText,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? {
          wallLengthCm: measurements.wall_length_cm,
          roomDepthCm: measurements.room_depth_cm
        }
      : null,
    candidates
  });
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

  let visualMissingRoleCategories = new Set(
    sourcingResult.missingRoles.map((role) => normalizeSourcingCategory(role, role))
  );
  let missingRequiredVisualRoles = staticRoles.filter(
    (role) => role.priority === "required" && visualMissingRoleCategories.has(role.category)
  );

  if (missingRequiredVisualRoles.length > 0) {
    const retryRoles = mergeRoomRoles(missingRequiredVisualRoles, staticRoles);
    const retryPlan = buildProductSourcingRuntimePlan({
      engineEnabled: productMatchingEngineEnabled,
      roomType: room.room_type,
      conceptText: visualConceptText,
      roles: retryRoles,
      candidates,
      budgetMaxAed: project.budget_max_aed,
      roomMeasurements: measurements
        ? {
            wallLengthCm: measurements.wall_length_cm,
            roomDepthCm: measurements.room_depth_cm
          }
        : null,
      candidatesPerRole: 8,
      flatCandidateLimit: 36
    });
    const retryPools = retryPlan.roleScopedPools;
    const retryCandidates = retryPlan.candidates;
    const retryCandidateIds = new Set(retryCandidates.map((candidate) => candidate.id));
    const retryResult = await withTimeout(
      sourceProductsFromConcept({
        roomType: room.room_type,
        conceptTitle: concept.title,
        conceptDescription: concept.description,
        conceptImageUrl: conceptSignedImage.signedUrl,
        candidates: retryCandidates.map(matchToSourcingCandidate),
        roleCandidatePools: productMatchingEngineEnabled
          ? retryPools.map((pool) => poolToSourcingRolePool(pool, retryCandidateIds))
          : undefined
      }),
      PRODUCT_SOURCING_AI_TIMEOUT_MS,
      "Product visual sourcing retry timed out."
    ).catch(() => null);

    if (retryResult?.needs.length && retryResult.selectedProducts.length) {
      sourcingResult = retryResult;
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
            roleCandidateCounts: productMatchingEngineEnabled ? roleCandidateCountSummary(retryPools) : undefined,
            roleStatuses: productMatchingEngineEnabled ? roleStatusSummary(sourcingResult.roleResults) : undefined,
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
          roleStatuses: productMatchingEngineEnabled ? roleStatusSummary(sourcingResult.roleResults) : undefined,
          usable: false
        }
      })
      .eq("id", sourcingJob.id);

    redirect(
      `${redirectPath}?message=${encodeURIComponent(
        `Product grounding needs better catalog matches before it is usable. Missing: ${missingLabels.join(", ")}.`
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

  const roleOptions = composeRoomProductOptions({
    ranked: visualRanked,
    roles,
    // Store a reserve beyond the three shown, so rejecting an option reveals a
    // replacement instantly with no catalog round-trip.
    optionsPerRole: 6
  });

  const coveredCategories = new Set(roleOptions.map((role) => role.category));
  const missingRequiredRoles = roles
    .filter((role) => role.priority === "required" && !coveredCategories.has(role.category))
    .map((role) => role.label);

  if (missingRequiredRoles.length > 0) {
    redirect(
      `${redirectPath}?message=${encodeURIComponent(
        `Product grounding needs more catalog coverage before it is usable. Missing: ${missingRequiredRoles.join(", ")}.`
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
    const roleResult = sourceRoleResultsByCategory.get(role.category);
    if (roleResult?.productId && role.options.some((option) => option.id === roleResult.productId)) {
      selectedProductIdByRole.set(role.category, roleResult.productId);
      continue;
    }

    const aiPick = sourcingResult.selectedProducts.find(
      (selection) =>
        normalizeSourcingCategory(selection.category, selection.roleLabel) === role.category &&
        role.options.some((option) => option.id === selection.productId)
    );
    if (aiPick) {
      selectedProductIdByRole.set(role.category, aiPick.productId);
    } else if (role.options[0]) {
      selectedProductIdByRole.set(role.category, role.options[0].id);
    }
  }

  const itemRows = buildShoppingListItemRows({
    roleOptions,
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

  const ranked = rankProductMatches({
    roomType: room.room_type,
    conceptText: `${concept.title}\n${concept.description ?? ""}`,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? {
          wallLengthCm: measurements.wall_length_cm,
          roomDepthCm: measurements.room_depth_cm
        }
      : null,
    candidates: alternatives
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

  const ranked = rankProductMatches({
    roomType: room.room_type,
    conceptText: `${concept.title}\n${concept.description ?? ""}`,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? { wallLengthCm: measurements.wall_length_cm, roomDepthCm: measurements.room_depth_cm }
      : null,
    candidates
  });

  const fresh = ranked
    .filter((match) => match.categoryNormalized === category && !usedProductIds.has(match.id))
    .slice(0, 2);

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

  const ranked = rankProductMatches({
    roomType: room.room_type,
    conceptText: `${concept.title}\n${concept.description ?? ""}`,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? { wallLengthCm: measurements.wall_length_cm, roomDepthCm: measurements.room_depth_cm }
      : null,
    candidates
  });

  const fresh = ranked
    .filter((match) => match.categoryNormalized === category && !usedProductIds.has(match.id))
    .slice(0, 3);

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
    .select("id, title, description, status, primary_image_asset:room_assets(*)")
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
    const staleAfterMs = 15 * 60 * 1000;
    const isStale = Number.isFinite(startedAt) && Date.now() - startedAt > staleAfterMs;

    if (!isStale) {
      redirect(
        `${revealPathForRenderJob(matchingRenderJob.id)}&message=${encodeURIComponent(
          "Final render is already running."
        )}`
      );
    }

    await supabase
      .from("render_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: "Final render timed out before completion. Please retry."
      })
      .eq("id", matchingRenderJob.id);
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
      const productsForRender = await Promise.all(
        productReferencesForRender.slice(0, 8).map(async (item) => {
          const product = item.product!;
          const image = product.primary_image_url
            ? await fetchRemoteImage(product.primary_image_url)
            : null;
          const dimensions = product.dimensions?.[0]?.source_text ?? null;

          return {
            name: product.name,
            retailerName: product.retailer?.name ?? "Retailer",
            category: item.category,
            roleLabel: roleLabelFromSelectionReason(item.selection_reason) ?? item.category,
            visualMatchReason: item.selection_reason,
            priceAed: item.unit_price_aed,
            dimensions,
            imageBytes: image?.bytes ?? null,
            imageMimeType: image?.mimeType ?? null
          };
        })
      );
      const result = await generateFinalGroundedRender({
        roomType: room.room_type,
        roomPhotoBytes: Buffer.from(await roomBlob.arrayBuffer()),
        roomPhotoMimeType: roomPhoto.mime_type,
        conceptImageBytes: conceptBlob ? Buffer.from(await conceptBlob.arrayBuffer()) : null,
        conceptImageMimeType: conceptImageAsset?.mime_type ?? null,
        conceptTitle: concept.title,
        conceptDescription: concept.description,
        products: productsForRender
      });
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

      await serviceSupabase
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
            imageFallbackError: result.imageFallbackError ?? null
          }
        })
        .eq("id", renderJob.id);
      await serviceSupabase.from("rooms").update({ status: "rendering" }).eq("id", roomId);
      revalidatePath(revealPath);
    } catch (error) {
      await serviceSupabase
        .from("render_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : "Final render generation failed."
        })
        .eq("id", renderJob.id);
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
      provider: process.env.RITZY_IMAGE_PROVIDER ?? "openai",
      model: `${process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini"} + ${
        (process.env.RITZY_IMAGE_PROVIDER ?? "openai") === "gemini"
          ? (process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image-preview")
          : (process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2")
      }`,
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
    const result = await generateConceptRevision({
      roomType: room.room_type,
      roomPhotoUrl: signedPhoto.signedUrl,
      roomPhotoBytes: Buffer.from(await photoBlob.arrayBuffer()),
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

function matchToSourcingCandidate(match: RankedProductMatch) {
  return {
    id: match.id,
    name: match.name,
    retailerName: match.retailerName,
    category: match.categoryNormalized,
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
  const text = `${category} ${roleLabel}`.toLowerCase();

  if (text.includes("dining") && text.includes("chair")) {
    return "chairs";
  }

  if (text.includes("bed") || text.includes("headboard")) {
    return text.includes("headboard") ? "headboards" : "beds";
  }

  if (text.includes("dining") && text.includes("table")) {
    return "dining_tables";
  }

  if (text.includes("desk")) {
    return "desks";
  }

  if (text.includes("office") && text.includes("chair")) {
    return "office_chairs";
  }

  if (text.includes("armchair") || text.includes("chair") || text.includes("lounge")) {
    return "armchairs";
  }

  if (text.includes("sofa") || text.includes("sectional") || text.includes("seating")) {
    return "sofas";
  }

  if (text.includes("coffee")) {
    return "coffee_tables";
  }

  if (text.includes("side") || text.includes("occasional")) {
    return "side_tables";
  }

  if (text.includes("rug") || text.includes("flatweave")) {
    return "rugs";
  }

  if (text.includes("wall") || text.includes("art") || text.includes("canvas")) {
    return "wall_art";
  }

  if (text.includes("lamp") || text.includes("light") || text.includes("pendant")) {
    return "lighting";
  }

  if (text.includes("mirror")) {
    return "mirrors";
  }

  if (text.includes("decor") || text.includes("vase") || text.includes("cushion")) {
    return "decor";
  }

  if (text.includes("console") || text.includes("storage") || text.includes("media")) {
    return "storage";
  }

  return category.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function roleLabelFromSelectionReason(selectionReason: string | null) {
  return selectionReason?.match(/room role: ([^;]+)/)?.[1]?.trim() ?? null;
}

function formatAedValue(value: number) {
  return `AED ${value.toLocaleString("en-AE", {
    maximumFractionDigits: 0
  })}`;
}

async function fetchRemoteImage(url: string) {
  try {
    const response = await fetch(url, {
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

    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      mimeType
    };
  } catch {
    return null;
  }
}
