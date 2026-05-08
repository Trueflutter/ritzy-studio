import Stripe from "stripe";

export const HOMEOWNER_ROOM_UNLOCK_AMOUNT_AED = 10000;
export const DESIGNER_MONTHLY_AMOUNT_USD = 9900;

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required for billing actions.");
  }

  stripeClient ??= new Stripe(secretKey, {
    apiVersion: "2026-04-22.dahlia"
  });

  return stripeClient;
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function unixToIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}
