import assert from "node:assert/strict";

import {
  canAccessRoomCommerce,
  DESIGNER_MONTHLY_PLAN_KEY,
  isActiveDesignerSubscription,
  isActiveRoomUnlock
} from "./entitlements";

const now = new Date("2026-05-04T10:00:00.000Z");

assert.equal(
  isActiveRoomUnlock({
    status: "active",
    expiresAt: "2026-05-05T10:00:00.000Z"
  }, now),
  true
);

assert.equal(
  isActiveRoomUnlock({
    status: "expired",
    expiresAt: "2026-05-05T10:00:00.000Z"
  }, now),
  false
);

assert.equal(
  isActiveDesignerSubscription({
    planKey: DESIGNER_MONTHLY_PLAN_KEY,
    status: "active",
    currentPeriodEnd: "2026-06-04T10:00:00.000Z"
  }, now),
  true
);

assert.equal(
  isActiveDesignerSubscription({
    planKey: DESIGNER_MONTHLY_PLAN_KEY,
    status: "cancelled",
    currentPeriodEnd: "2026-06-04T10:00:00.000Z"
  }, now),
  false
);

assert.equal(
  canAccessRoomCommerce({
    isRoomOwner: true,
    roomUnlock: { status: "active" },
    now
  }),
  true
);

assert.equal(
  canAccessRoomCommerce({
    isRoomOwner: false,
    roomUnlock: { status: "active" },
    now
  }),
  false
);

assert.equal(
  canAccessRoomCommerce({
    isRoomOwner: false,
    isAdmin: true,
    now
  }),
  true
);

console.log("entitlement tests passed");
