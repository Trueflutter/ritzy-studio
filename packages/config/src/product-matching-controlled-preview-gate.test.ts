import assert from "node:assert/strict";

import { productMatchingControlledPreviewGate } from "./index";

const env = {
  RITZY_PRODUCT_MATCHING_ENGINE_V1_CONTROLLED_PREVIEW_ENABLED: "true",
  RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_PROJECT_IDS: "project-1, project-2",
  RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_ROOM_IDS: "room-1",
  RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_USER_IDS: "user-1",
  RITZY_PRODUCT_MATCHING_ENGINE_V1_PREVIEW_USER_EMAILS: "sam@example.com"
};

assert.deepEqual(
  productMatchingControlledPreviewGate({
    env,
    projectId: "project-1",
    roomId: "room-x",
    userId: "user-x",
    userEmail: "other@example.com"
  }),
  {
    configured: true,
    enabled: true,
    allowed: true,
    matchedScopes: ["project"]
  }
);

assert.deepEqual(
  productMatchingControlledPreviewGate({
    env,
    projectId: "project-x",
    roomId: "room-1",
    userId: "user-1",
    userEmail: "SAM@example.com"
  }),
  {
    configured: true,
    enabled: true,
    allowed: true,
    matchedScopes: ["room", "user", "email"]
  }
);

assert.deepEqual(
  productMatchingControlledPreviewGate({
    env,
    projectId: "project-x",
    roomId: "room-x",
    userId: "user-x",
    userEmail: "other@example.com"
  }),
  {
    configured: true,
    enabled: true,
    allowed: false,
    matchedScopes: []
  }
);

assert.deepEqual(
  productMatchingControlledPreviewGate({
    env: {
      ...env,
      RITZY_PRODUCT_MATCHING_ENGINE_V1_CONTROLLED_PREVIEW_ENABLED: "false"
    },
    projectId: "project-1",
    roomId: "room-1",
    userId: "user-1",
    userEmail: "sam@example.com"
  }),
  {
    configured: true,
    enabled: false,
    allowed: false,
    matchedScopes: ["project", "room", "user", "email"]
  }
);

assert.deepEqual(
  productMatchingControlledPreviewGate({
    env: {},
    projectId: "project-1",
    roomId: "room-1",
    userId: "user-1",
    userEmail: "sam@example.com"
  }),
  {
    configured: false,
    enabled: false,
    allowed: false,
    matchedScopes: []
  }
);
