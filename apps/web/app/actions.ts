"use server";

import {
  generateClarifyingQuestions,
  generateConceptRevision,
  generateFinalGroundedRender,
  generateInitialConcept,
  sourceProductsFromConcept
} from "@ritzy-studio/ai";
import type { Database } from "@ritzy-studio/db";
import {
  createHomeownerRoomSchema,
  createProjectWithRoomSchema,
  designBriefSchema,
  composeRoomProductSet,
  filterSubstitutionCandidates,
  productRolesForRoom,
  quantityForProductCategory,
  rankProductMatches,
  setUserModeSchema,
  substitutionModeSchema,
  visualStyleOptions,
  visualStyleSummary,
  type RankedProductMatch,
  type ProductMatchCandidate
} from "@ritzy-studio/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import {
  appUrl,
  DESIGNER_MONTHLY_AMOUNT_USD,
  getStripe,
  HOMEOWNER_ROOM_UNLOCK_AMOUNT_AED
} from "@/lib/billing/stripe";

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : undefined;
}

function optionalNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (value.length === 0) {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
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
    redirect(`${redirectPath}?message=${encodeURIComponent("Unlock this room to use retailer links, product swaps, and final renders.")}`);
  }
}

async function hasActiveDesignerSubscription(userId: string) {
  const serviceSupabase = createServiceClient();
  const { data: designerAccount } = await serviceSupabase
    .from("designer_accounts")
    .select("subscription_status, current_period_end")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (!designerAccount) {
    return false;
  }

  const isActive =
    designerAccount.subscription_status === "active" ||
    designerAccount.subscription_status === "trialing";
  const periodStillValid =
    !designerAccount.current_period_end ||
    new Date(designerAccount.current_period_end).getTime() > Date.now();

  return isActive && periodStillValid;
}

async function countOwnedRooms(userId: string) {
  const serviceSupabase = createServiceClient();
  const { data: projects } = await serviceSupabase
    .from("projects")
    .select("id")
    .eq("owner_user_id", userId);
  const projectIds = (projects ?? []).map((project) => project.id);

  if (projectIds.length === 0) {
    return 0;
  }

  const { count } = await serviceSupabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .in("project_id", projectIds);

  return count ?? 0;
}

async function requireDesignerFreeRoomAccess(userId: string, roomId: string, redirectPath: string) {
  const serviceSupabase = createServiceClient();
  const { data: profile } = await serviceSupabase
    .from("user_profiles")
    .select("intended_mode")
    .eq("user_id", userId)
    .maybeSingle();
  const isDesignerMode = profile?.intended_mode === "designer" || profile?.intended_mode === "both";

  if (!isDesignerMode || (await hasActiveDesignerSubscription(userId))) {
    return;
  }

  const { data: projects } = await serviceSupabase
    .from("projects")
    .select("id")
    .eq("owner_user_id", userId);
  const projectIds = (projects ?? []).map((project) => project.id);

  if (projectIds.length === 0) {
    return;
  }

  const { data: roomsResult } = await serviceSupabase
    .from("rooms")
    .select("id")
    .in("project_id", projectIds)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
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
  const redirectPath = `/projects/${projectId}/rooms/${roomId}/shopping-list`;
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
            name: `Ritzy Studio room unlock — ${room.name}`,
            description: "Unlock retailer links, eligible partner discounts, and final room plan."
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
    success_url: `${baseUrl}${redirectPath}?message=${encodeURIComponent("Room unlock payment complete.")}`,
    cancel_url: `${baseUrl}${redirectPath}?message=${encodeURIComponent("Room unlock payment cancelled.")}`
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
          price_aed: 100,
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
        price_aed: 100,
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

export async function createProjectWithRoomAction(formData: FormData) {
  const parsed = createProjectWithRoomSchema.parse({
    name: String(formData.get("name") ?? "").trim(),
    clientName: optionalString(formData, "clientName"),
    location: optionalString(formData, "location"),
    budgetMinAed: optionalNumber(formData, "budgetMinAed"),
    budgetMaxAed: optionalNumber(formData, "budgetMaxAed"),
    roomName: String(formData.get("roomName") ?? "").trim(),
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

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("intended_mode")
    .eq("user_id", user.id)
    .maybeSingle();
  const isDesignerMode = profile?.intended_mode === "designer" || profile?.intended_mode === "both";
  const designerIsSubscribed = isDesignerMode ? await hasActiveDesignerSubscription(user.id) : false;
  const existingRoomCount = isDesignerMode ? await countOwnedRooms(user.id) : 0;

  if (isDesignerMode && !designerIsSubscribed && existingRoomCount >= 1) {
    redirect(
      `/projects/new?message=${encodeURIComponent(
        "Your free designer room is already in progress. Start the designer plan to create another room."
      )}`
    );
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

  if (roomError) {
    throw new Error(roomError.message);
  }

  revalidatePath("/");
  redirect(`/projects/${project.id}/rooms/${room.id}/photos`);
}

export async function saveDesignBriefAction(formData: FormData) {
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

  const redirectPath = `/projects/${parsed.projectId}/rooms/${parsed.roomId}/brief`;
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

  const structuredJson = {
    visualPreferences: {
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
    },
    measurements: hasMeasurements
      ? {
          wallLengthCm: parsed.wallLengthCm ?? null,
          roomDepthCm: parsed.roomDepthCm ?? null,
          ceilingHeightCm: parsed.ceilingHeightCm ?? null,
          notes: parsed.measurementNotes ?? null,
          source: "manual",
          confidence: "verified"
        }
      : null
  };

  const { data: existingBrief } = await supabase
    .from("design_briefs")
    .select("id")
    .eq("room_id", parsed.roomId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const briefPayload = {
    room_id: parsed.roomId,
    style_notes: resolvedStyleNotes || null,
    color_notes: parsed.colorNotes ?? null,
    budget_notes: parsed.budgetNotes ?? null,
    functional_requirements: parsed.functionalRequirements ?? null,
    avoid_notes: parsed.avoidNotes ?? null,
    inspiration_notes: parsed.inspirationNotes ?? null,
    structured_json: structuredJson
  };

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

  const serviceSupabase = createServiceClient();
  const inputSummary = {
    roomType: parsed.roomType,
    styleNotes: resolvedStyleNotes || null,
    colorNotes: parsed.colorNotes ?? null,
    budgetNotes: parsed.budgetNotes ?? null,
    hasMeasurements
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

  try {
    const result = await generateClarifyingQuestions({
      roomType: parsed.roomType,
      styleNotes: resolvedStyleNotes || undefined,
      colorNotes: parsed.colorNotes,
      budgetNotes: parsed.budgetNotes,
      functionalRequirements: parsed.functionalRequirements,
      avoidNotes: parsed.avoidNotes,
      inspirationNotes: parsed.inspirationNotes,
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
      const { error: questionsError } = await supabase.from("clarifying_questions").insert(
        result.questions.map((question) => ({
          design_brief_id: designBriefId,
          question: question.question,
          status: "open" as const
        }))
      );

      if (questionsError) {
        throw new Error(questionsError.message);
      }
    }
  } catch (error) {
    await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Clarifying question generation failed."
      })
      .eq("id", job.id);

    redirect(`${redirectPath}?message=${encodeURIComponent("Brief saved. Clarifying questions could not be generated yet.")}`);
  }

  revalidatePath(redirectPath);
  redirect(`${redirectPath}?message=${encodeURIComponent("Brief saved. Review any clarifying questions before concepts.")}`);
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
    redirect(`${redirectPath}?message=${encodeURIComponent("The room photo could not be prepared for generation.")}`);
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
    .order("created_at", { ascending: true });

  const serviceSupabase = createServiceClient();
  const { data: job, error: jobError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: user.id,
      room_id: roomId,
      job_type: "initial_concept_generation",
      status: "running",
      provider: "openai",
      model: `${process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini"} + ${process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2"}`,
      prompt_version: null,
      input_summary: {
        roomId,
        designBriefId: designBrief.id,
        roomPhotoAssetId: roomPhoto.id,
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
        model: `${result.textModel} + ${result.imageModel}`,
        prompt_version: result.promptVersion,
        output_summary: {
          promptKey: result.promptKey,
          title: result.concept.title,
          uncertaintyNotes: result.analysis.uncertaintyNotes,
          revisedPrompt: result.revisedPrompt ?? null
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

  const redirectPath = `/projects/${projectId}/rooms/${roomId}/concepts`;
  revalidatePath(redirectPath);
  redirect(`${redirectPath}?message=${encodeURIComponent("Concept selected for sourcing.")}`);
}

export async function groundProductsAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const conceptId = String(formData.get("conceptId") ?? "");
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
    .limit(250);

  if (productsError) {
    throw new Error(productsError.message);
  }

  const candidates = (products ?? [])
    .map(productToMatchCandidate)
    .filter((candidate): candidate is ProductMatchCandidate => Boolean(candidate));

  if (candidates.length === 0) {
    redirect(`${redirectPath}?message=${encodeURIComponent("No catalog products are available yet. Run ingestion first.")}`);
  }

  const baseConceptText = `${concept.title}\n${concept.description ?? ""}`;
  const ranked = rankProductMatches({
    roomType: room.room_type,
    conceptText: baseConceptText,
    budgetMaxAed: project.budget_max_aed,
    roomMeasurements: measurements
      ? {
          wallLengthCm: measurements.wall_length_cm,
          roomDepthCm: measurements.room_depth_cm
        }
      : null,
    candidates
  });
  const conceptImageAsset = Array.isArray(concept.primary_image_asset)
    ? concept.primary_image_asset[0]
    : concept.primary_image_asset;
  const { data: conceptSignedImage } = conceptImageAsset?.storage_path
    ? await serviceSupabase.storage
        .from("generated-renders")
        .createSignedUrl(conceptImageAsset.storage_path, 60 * 30)
    : { data: null };
  const sourcingResult = conceptSignedImage?.signedUrl
    ? await sourceProductsFromConcept({
        roomType: room.room_type,
        conceptTitle: concept.title,
        conceptDescription: concept.description,
        conceptImageUrl: conceptSignedImage.signedUrl,
        candidates: shortlistSourcingCandidates(ranked).slice(0, 16).map(matchToSourcingCandidate)
      }).catch(() => null)
    : null;
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
  const visualRankedById = new Map(visualRanked.map((match) => [match.id, match]));
  const sourceSelectionsById = new Map(
    (sourcingResult?.selectedProducts ?? []).map((selection) => [selection.productId, selection])
  );
  const visuallySelected = (sourcingResult?.selectedProducts ?? [])
    .map((selection) => visualRankedById.get(selection.productId))
    .filter((match): match is RankedProductMatch => Boolean(match));
  const composedSet = composeRoomProductSet({
    ranked: visualRanked,
    roomType: room.room_type,
    desiredRoles: sourcingResult?.needs.map((need) => ({
      category: normalizeSourcingCategory(need.category, need.roleLabel),
      label: need.roleLabel,
      quantity: need.quantity,
      required: need.priority === "required",
      visualBrief: need.visualBrief
    })),
    limit: 12
  });
  const roomProductSet = dedupeMatches([...visuallySelected, ...composedSet]).slice(0, 12);
  const selectedCategories = new Set(roomProductSet.map((match) => match.categoryNormalized).filter(Boolean));
  const missingRequiredRoles = productRolesForRoom(room.room_type)
    .filter((role) => role.required && !selectedCategories.has(role.category))
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

  const items = roomProductSet.map((match, index) => {
    const unitPrice = match.salePriceAed ?? match.priceAed ?? 0;
    const sourceSelection = sourceSelectionsById.get(match.id);
    const quantity =
      sourceSelection?.quantity ?? quantityForProductCategory(room.room_type, match.categoryNormalized);
    return {
      shopping_list_id: shoppingListId,
      product_id: match.id,
      category: match.categoryNormalized ?? "uncategorized",
      quantity,
      unit_price_aed: unitPrice,
      line_total_aed: unitPrice * quantity,
      selection_reason: [
        sourceSelection?.visualMatchReason ? `visual match: ${sourceSelection.visualMatchReason}` : null,
        sourceSelection?.mismatchNote ? `mismatch: ${sourceSelection.mismatchNote}` : null,
        match.selectionReason,
        ...match.warnings.filter((warning) => warning !== match.dimensionFitNote)
      ]
        .filter(Boolean)
        .join(" "),
      dimension_fit_note: match.dimensionFitNote,
      sort_order: index
    };
  });

  const { error: itemError } = await supabase.from("shopping_list_items").insert(items);

  if (itemError) {
    throw new Error(itemError.message);
  }

  const estimatedTotal = items.reduce((sum, item) => sum + Number(item.line_total_aed ?? 0), 0);
  await supabase
    .from("shopping_lists")
    .update({
      estimated_total_aed: estimatedTotal,
      updated_at: new Date().toISOString()
    })
    .eq("id", shoppingListId);
  await supabase.from("rooms").update({ status: "sourcing" }).eq("id", roomId);

  revalidatePath(redirectPath);
  redirect(`${redirectPath}?message=${encodeURIComponent("Catalog products matched to the selected concept.")}`);
}

export async function substituteProductAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const shoppingListId = String(formData.get("shoppingListId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const mode = substitutionModeSchema.parse(String(formData.get("mode") ?? "cheaper"));
  const redirectPath = `/projects/${projectId}/rooms/${roomId}/concepts`;
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
    .limit(250);

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
  const priceImpact = unitPrice - previousPrice;

  const { error: updateError } = await supabase
    .from("shopping_list_items")
    .update({
      product_id: replacement.id,
      category: replacement.categoryNormalized ?? item.category,
      unit_price_aed: unitPrice,
      line_total_aed: unitPrice,
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

  const { data: updatedItems = [] } = await supabase
    .from("shopping_list_items")
    .select("line_total_aed")
    .eq("shopping_list_id", shoppingListId);
  const estimatedTotal = (updatedItems ?? []).reduce(
    (sum, updatedItem) => sum + Number(updatedItem.line_total_aed ?? 0),
    0
  );

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

export async function generateFinalRenderAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const conceptId = String(formData.get("conceptId") ?? "");
  const shoppingListId = String(formData.get("shoppingListId") ?? "");
  const redirectPath = `/projects/${projectId}/rooms/${roomId}/concepts`;
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

  const { data: items = [] } = await serviceSupabase
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
    .order("sort_order", { ascending: true });

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
        productCount: selectedProducts.length,
        conceptTitle: concept.title
      }
    })
    .select("id")
    .single();

  if (renderJobError) {
    throw new Error(renderJobError.message);
  }

  try {
    const productsForRender = await Promise.all(
      selectedProducts.slice(0, 8).map(async (item) => {
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

    const { data: renderAsset, error: renderAssetError } = await supabase
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

    await supabase
      .from("render_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        prompt_key: result.promptKey,
        prompt_version: result.promptVersion,
        model: result.imageModel,
        output_asset_ids: [renderAsset.id],
        input_summary: {
          productCount: selectedProducts.length,
          productImageReferencesUsed: productsForRender.filter((product) => product.imageBytes).length,
          revisedPrompt: result.revisedPrompt ?? null
        }
      })
      .eq("id", renderJob.id);
    await supabase.from("rooms").update({ status: "rendering" }).eq("id", roomId);
  } catch (error) {
    await supabase
      .from("render_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Final render generation failed."
      })
      .eq("id", renderJob.id);

    redirect(`${redirectPath}?message=${encodeURIComponent("Final render failed. You can retry after checking product images.")}`);
  }

  revalidatePath(redirectPath);
  redirect(`${redirectPath}?message=${encodeURIComponent("Final grounded render generated.")}`);
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
    .order("created_at", { ascending: true });

  const serviceSupabase = createServiceClient();
  const { data: job, error: jobError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: user.id,
      room_id: roomId,
      job_type: "concept_revision",
      status: "running",
      provider: "openai",
      model: `${process.env.OPENAI_TEXT_MODEL ?? "gpt-5-mini"} + ${process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2"}`,
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
        model: `${result.textModel} + ${result.imageModel}`,
        prompt_version: result.promptVersion,
        output_summary: {
          promptKey: result.promptKey,
          title: result.concept.title,
          parentConceptId: concept.id,
          revisedPrompt: result.revisedPrompt ?? null
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

function shortlistSourcingCandidates(ranked: RankedProductMatch[]) {
  const byCategory = new Map<string, RankedProductMatch[]>();

  for (const match of ranked) {
    const category = match.categoryNormalized ?? "uncategorized";
    const categoryMatches = byCategory.get(category) ?? [];
    if (categoryMatches.length < 4) {
      categoryMatches.push(match);
      byCategory.set(category, categoryMatches);
    }
  }

  return Array.from(byCategory.values())
    .flat()
    .sort((left, right) => right.score - left.score)
    .slice(0, 36);
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

function dedupeMatches(matches: RankedProductMatch[]) {
  const seen = new Set<string>();
  const deduped: RankedProductMatch[] = [];

  for (const match of matches) {
    if (seen.has(match.id)) {
      continue;
    }

    seen.add(match.id);
    deduped.push(match);
  }

  return deduped;
}

function normalizeSourcingCategory(category: string, roleLabel: string) {
  const text = `${category} ${roleLabel}`.toLowerCase();

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

  if (text.includes("console") || text.includes("storage")) {
    return "consoles";
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
