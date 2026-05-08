import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe, unixToIso } from "@/lib/billing/stripe";
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
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object);
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await handleSubscriptionEvent(event.data.object);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook handling failed." },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.metadata?.type === "room_unlock") {
    await activateRoomUnlock(session);
    return;
  }

  if (session.metadata?.type === "designer_subscription") {
    await activateDesignerSubscription(session);
  }
}

async function activateRoomUnlock(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const roomId = session.metadata?.room_id;
  if (!userId || !roomId) {
    throw new Error("Room unlock checkout is missing metadata.");
  }

  const supabase = createServiceClient();
  const { data: unlock, error: unlockError } = await supabase
    .from("room_unlocks")
    .update({
      status: "active",
      unlocked_at: new Date().toISOString(),
      billing_payment_id: typeof session.payment_intent === "string" ? session.payment_intent : null
    })
    .eq("billing_checkout_id", session.id)
    .select("id")
    .single();

  if (unlockError || !unlock) {
    throw new Error(unlockError?.message ?? "Room unlock could not be activated.");
  }

  await supabase.from("entitlement_events").insert({
    user_id: userId,
    room_id: roomId,
    room_unlock_id: unlock.id,
    event_type: "room_unlock_activated",
    source: "stripe_webhook",
    metadata_json: {
      checkout_session_id: session.id,
      payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null
    }
  });
}

async function activateDesignerSubscription(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const designerAccountId = session.metadata?.designer_account_id;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  if (!userId || !designerAccountId || !subscriptionId) {
    throw new Error("Designer subscription checkout is missing metadata.");
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await upsertSubscription({
    subscription,
    userId,
    designerAccountId
  });
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.user_id;
  const designerAccountId = subscription.metadata.designer_account_id;
  if (!userId || !designerAccountId) {
    return;
  }

  await upsertSubscription({
    subscription,
    userId,
    designerAccountId
  });
}

async function upsertSubscription({
  subscription,
  userId,
  designerAccountId
}: {
  subscription: Stripe.Subscription;
  userId: string;
  designerAccountId: string;
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
    .eq("id", designerAccountId);

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
