import { z } from "zod";

export const userIntendedModeSchema = z.enum(["homeowner", "designer", "both", "unknown"]);
export const subscriptionStatusSchema = z.enum([
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "expired",
  "incomplete"
]);
export const roomUnlockStatusSchema = z.enum([
  "pending",
  "active",
  "refunded",
  "expired",
  "revoked"
]);

export const HOMEOWNER_ROOM_UNLOCK_PRICE_AED = 500;
export const DESIGNER_MONTHLY_PLAN_KEY = "designer_monthly_usd_99";
export const DESIGNER_MONTHLY_PRICE_USD = 99;

export type UserIntendedMode = z.infer<typeof userIntendedModeSchema>;
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
export type RoomUnlockStatus = z.infer<typeof roomUnlockStatusSchema>;

export type SubscriptionEntitlement = {
  planKey: string;
  status: SubscriptionStatus;
  currentPeriodEnd?: string | Date | null;
};

export type RoomUnlockEntitlement = {
  status: RoomUnlockStatus;
  expiresAt?: string | Date | null;
};

export function isActiveDesignerSubscription(
  subscription: SubscriptionEntitlement | null | undefined,
  now = new Date()
) {
  if (!subscription || subscription.planKey !== DESIGNER_MONTHLY_PLAN_KEY) {
    return false;
  }

  if (subscription.status !== "active" && subscription.status !== "trialing") {
    return false;
  }

  return isMissingOrFuture(subscription.currentPeriodEnd, now);
}

export function isActiveRoomUnlock(
  unlock: RoomUnlockEntitlement | null | undefined,
  now = new Date()
) {
  if (!unlock || unlock.status !== "active") {
    return false;
  }

  return isMissingOrFuture(unlock.expiresAt, now);
}

export function canAccessRoomCommerce({
  isRoomOwner,
  isAdmin = false,
  roomUnlock,
  designerSubscription,
  now = new Date()
}: {
  isRoomOwner: boolean;
  isAdmin?: boolean;
  roomUnlock?: RoomUnlockEntitlement | null;
  designerSubscription?: SubscriptionEntitlement | null;
  now?: Date;
}) {
  if (isAdmin) {
    return true;
  }

  if (!isRoomOwner) {
    return false;
  }

  return (
    isActiveRoomUnlock(roomUnlock, now) ||
    isActiveDesignerSubscription(designerSubscription, now)
  );
}

function isMissingOrFuture(value: string | Date | null | undefined, now: Date) {
  if (!value) {
    return true;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) && date > now;
}
