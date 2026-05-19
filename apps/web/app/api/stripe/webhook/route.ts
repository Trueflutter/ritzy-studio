import { NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  DESIGNER_MONTHLY_AMOUNT_USD,
  getStripe,
  HOMEOWNER_ROOM_UNLOCK_AMOUNT_AED,
  unixToIso
} from "@/lib/billing/stripe";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured." }, { status: 501 });
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  const body = await request.text();

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid Stripe webhook." },
      { status: 400 }
    );
  }

  try {
    const claim = await claimWebhookEvent(event);
    if (claim === "processed") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (claim === "processing") {
      return NextResponse.json({ error: "Webhook event is already processing." }, { status: 500 });
    }

    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object, event.id);
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await handleSubscriptionEvent(event.data.object, event.id);
    }

    await markWebhookEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    await markWebhookEventFailed(event.id, error instanceof Error ? error.message : "Webhook handling failed.");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook handling failed." },
      { status: 500 }
    );
  }
}

async function claimWebhookEvent(event: Stripe.Event) {
  const supabase = createServiceClient();
  const { error } = await supabase.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
    stripe_created_at: unixToIso(event.created),
    processing_started_at: new Date().toISOString(),
    processing_error: null
  });

  if (!error) {
    return "claimed";
  }

  if (error.code === "23505") {
    const { data: existingEvent, error: readError } = await supabase
      .from("stripe_webhook_events")
      .select("processed_at, processing_started_at, processing_error")
      .eq("event_id", event.id)
      .maybeSingle();

    if (readError) {
      throw new Error(readError.message);
    }

    if (existingEvent?.processed_at) {
      return "processed";
    }

    const processingStartedAt = existingEvent?.processing_started_at
      ? new Date(existingEvent.processing_started_at).getTime()
      : 0;
    const processingAgeMs = Date.now() - processingStartedAt;
    if (!existingEvent?.processing_error && processingAgeMs < 5 * 60 * 1000) {
      return "processing";
    }

    await supabase
      .from("stripe_webhook_events")
      .update({
        processing_started_at: new Date().toISOString(),
        processing_error: null
      })
      .eq("event_id", event.id);
    return "claimed";
  }

  throw new Error(error.message);
}

async function markWebhookEventProcessed(eventId: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      processing_error: null
    })
    .eq("event_id", eventId);

  if (error) {
    throw new Error(error.message);
  }
}

async function markWebhookEventFailed(eventId: string, message: string) {
  const supabase = createServiceClient();
  await supabase
    .from("stripe_webhook_events")
    .update({
      processing_error: message.slice(0, 1000)
    })
    .eq("event_id", eventId)
    .is("processed_at", null);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, stripeEventId: string) {
  if (session.metadata?.type === "room_unlock") {
    await activateRoomUnlock(session, stripeEventId);
    return;
  }

  if (session.metadata?.type === "designer_subscription") {
    await activateDesignerSubscription(session, stripeEventId);
  }
}

async function activateRoomUnlock(session: Stripe.Checkout.Session, stripeEventId: string) {
  const userId = session.metadata?.user_id;
  const roomId = session.metadata?.room_id;
  if (!userId || !roomId) {
    throw new Error("Room unlock checkout is missing metadata.");
  }

  if (
    session.mode !== "payment" ||
    session.payment_status !== "paid" ||
    session.amount_total !== HOMEOWNER_ROOM_UNLOCK_AMOUNT_AED ||
    session.currency?.toLowerCase() !== "aed"
  ) {
    throw new Error("Room unlock checkout failed validation.");
  }

  const supabase = createServiceClient();
  const { data: unlocks, error: unlockError } = await supabase
    .from("room_unlocks")
    .update({
      status: "active",
      unlocked_at: new Date().toISOString(),
      billing_payment_id: typeof session.payment_intent === "string" ? session.payment_intent : null
    })
    .eq("billing_checkout_id", session.id)
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id");

  const unlock = unlocks?.[0];
  if (unlockError || !unlock) {
    throw new Error(unlockError?.message ?? "Room unlock could not be activated from a matching pending checkout.");
  }

  await supabase.from("entitlement_events").insert({
    user_id: userId,
    room_id: roomId,
    room_unlock_id: unlock.id,
    event_type: "room_unlock_activated",
    source: "stripe_webhook",
    metadata_json: {
      checkout_session_id: session.id,
      stripe_event_id: stripeEventId,
      payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null
    }
  });
}

async function activateDesignerSubscription(session: Stripe.Checkout.Session, stripeEventId: string) {
  const userId = session.metadata?.user_id;
  const designerAccountId = session.metadata?.designer_account_id;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  if (!userId || !designerAccountId || !subscriptionId) {
    throw new Error("Designer subscription checkout is missing metadata.");
  }

  if (
    session.mode !== "subscription" ||
    (session.payment_status !== "paid" && session.payment_status !== "no_payment_required")
  ) {
    throw new Error("Designer subscription checkout failed validation.");
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await upsertSubscription({
    subscription,
    userId,
    designerAccountId,
    stripeEventId
  });
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription, stripeEventId: string) {
  const userId = subscription.metadata.user_id;
  const designerAccountId = subscription.metadata.designer_account_id;
  if (!userId || !designerAccountId) {
    return;
  }

  await upsertSubscription({
    subscription,
    userId,
    designerAccountId,
    stripeEventId
  });
}

async function upsertSubscription({
  subscription,
  userId,
  designerAccountId,
  stripeEventId
}: {
  subscription: Stripe.Subscription;
  userId: string;
  designerAccountId: string;
  stripeEventId: string;
}) {
  const supabase = createServiceClient();
  const status = normalizeSubscriptionStatus(subscription.status);
  const subscriptionWithPeriod = subscription as Stripe.Subscription & {
    current_period_start?: number | null;
    current_period_end?: number | null;
  };
  const currentPeriodStart = unixToIso(subscriptionWithPeriod.current_period_start);
  const currentPeriodEnd = unixToIso(subscriptionWithPeriod.current_period_end);
  const cancelAt = unixToIso(subscription.cancel_at);
  const monthlyAmountCents = subscription.items.data[0]?.price.unit_amount ?? DESIGNER_MONTHLY_AMOUNT_USD;
  const monthlyCurrency = subscription.items.data[0]?.price.currency ?? "usd";

  if (monthlyAmountCents !== DESIGNER_MONTHLY_AMOUNT_USD || monthlyCurrency.toLowerCase() !== "usd") {
    throw new Error("Designer subscription amount failed validation.");
  }

  const { data: subscriptionRow, error: subscriptionError } = await supabase
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        designer_account_id: designerAccountId,
        provider: "stripe",
        provider_customer_id:
          typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
        provider_subscription_id: subscription.id,
        plan_key: "designer_monthly_usd_99",
        status,
        amount_usd: 99,
        billing_interval: "month",
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd
      },
      { onConflict: "provider,provider_subscription_id" }
    )
    .select("id")
    .single();

  if (subscriptionError || !subscriptionRow) {
    throw new Error(subscriptionError?.message ?? "Subscription could not be stored.");
  }

  const { error: designerError } = await supabase
    .from("designer_accounts")
    .update({
      billing_customer_id:
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      subscription_status: status,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at: cancelAt
    })
    .eq("id", designerAccountId)
    .eq("owner_user_id", userId);

  if (designerError) {
    throw new Error(designerError.message);
  }

  await supabase.from("entitlement_events").insert({
    user_id: userId,
    subscription_id: subscriptionRow.id,
    event_type:
      status === "active" || status === "trialing"
        ? "subscription_activated"
        : status === "cancelled"
          ? "subscription_cancelled"
          : "subscription_expired",
    source: "stripe_webhook",
    metadata_json: {
      stripe_subscription_id: subscription.id,
      stripe_event_id: stripeEventId,
      stripe_status: subscription.status
    }
  });
}

function normalizeSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "active" || status === "trialing" || status === "past_due" || status === "incomplete") {
    return status;
  }

  if (status === "canceled") {
    return "cancelled";
  }

  return "expired";
}
