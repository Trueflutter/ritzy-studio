import { z } from "zod";

import type { DesignSpecObject } from "./design-spec";
import { type SpatialIntent, spatialLayoutModeForRoomType } from "./spatial-design-rules";
import { sourcingRolesFromDesignSpec } from "./spec-sourcing";

// S4 step 1: the view planner. A final render is one hero image plus one or
// two planned views, and the set has to show every key piece of the design
// and always the room's focal element (the TV wall in a TV lounge: the Phase 0
// room's TV wall backed the hero camera and no view could show it).
//
// The planner is pure. A vision "camera read" reports facts about the hero and
// the room photographs; the rules here turn those facts into a plan a fixture
// can pin, and nothing here is a model verdict. Views are identified by a
// closed vocabulary so storage paths, labels and the presentation need no
// schema, and photographs by their asset id so a later reorder of the photo
// slots (S5) can never mislabel a persisted plan.

export const PLANNED_VIEW_KEYS = ["focal_wide", "reverse_wide", "anchor_detail"] as const;

export type PlannedViewKey = (typeof PLANNED_VIEW_KEYS)[number];

// Presentation labels (rendered as tracked uppercase captions by the page).
export const PLANNED_VIEW_LABELS: Record<PlannedViewKey, string> = {
  focal_wide: "Focal wall view",
  reverse_wide: "Reverse angle",
  anchor_detail: "Detail view"
};

// Concept-page captions (sentence style beneath a thumbnail).
export const PLANNED_VIEW_CAPTIONS: Record<PlannedViewKey, string> = {
  focal_wide: "Facing the focal wall",
  reverse_wide: "From the other end of the room",
  anchor_detail: "The anchor group, up close"
};

export function isPlannedViewKey(value: string | null | undefined): value is PlannedViewKey {
  return typeof value === "string" && (PLANNED_VIEW_KEYS as readonly string[]).includes(value);
}

export function plannedViewLabel(key: string | null | undefined): string {
  return isPlannedViewKey(key) ? PLANNED_VIEW_LABELS[key] : "Alternate angle";
}

export function plannedViewCaption(key: string | null | undefined): string {
  return isPlannedViewKey(key) ? PLANNED_VIEW_CAPTIONS[key] : "Another view";
}

export type CameraRelation = "same" | "opposite" | "left" | "right" | "unknown";
export type SameRoomAnswer = "yes" | "unsure" | "no";

// What the camera read reports. `source: "fallback"` means no model looked:
// the read timed out or failed, and every answer below is "unknown", which
// the planner treats conservatively (never as "covered").
export const roomCameraReadSchema = z.object({
  source: z.enum(["vision", "fallback"]),
  hero: z.object({
    showsFocalElement: z.boolean().nullable(),
    hiddenRoleKeys: z.array(z.string().min(1).max(80)).max(40)
  }),
  photos: z
    .array(
      z.object({
        assetId: z.string().min(1).max(80),
        sameRoom: z.enum(["yes", "unsure", "no"]),
        cameraRelativeToHero: z.enum(["same", "opposite", "left", "right", "unknown"]),
        showsFocalWall: z.boolean()
      })
    )
    .max(6)
});

export type RoomCameraRead = z.infer<typeof roomCameraReadSchema>;

export function parseRoomCameraRead(value: unknown): RoomCameraRead | null {
  const parsed = roomCameraReadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function fallbackCameraRead(photos: ReadonlyArray<{ assetId: string }>): RoomCameraRead {
  return {
    source: "fallback",
    hero: { showsFocalElement: null, hiddenRoleKeys: [] },
    photos: photos.slice(0, 6).map((photo) => ({
      assetId: photo.assetId,
      sameRoom: "unsure",
      cameraRelativeToHero: "unknown",
      showsFocalWall: false
    }))
  };
}

// A selected shopping-list row available as a reference photograph for the
// render, in render priority order (anchors first).
export type ViewPlanProductRef = {
  itemId: string;
  specKey: string | null;
  category: string;
  label: string;
};

export type ViewPlanInput = {
  roomType: string;
  focalPoint: string | null | undefined;
  spec: { objects: DesignSpecObject[] } | null;
  heroPhotoAssetId: string | null;
  photos: ReadonlyArray<{ assetId: string }>;
  cameraRead: RoomCameraRead | null;
  products: ReadonlyArray<ViewPlanProductRef>;
  heroReferenceCap?: number;
};

// mustShowLabels entries are capped by the persisted plan's schema; a label
// the planner emits must always parse back, or the views phase would read
// the plan as legacy and quietly drop the focal view.
export const VIEW_LABEL_MAX_CHARS = 160;
export const DESIGN_LABEL_MAX_ENTRIES = 40;

export const plannedViewSchema = z.object({
  key: z.enum(PLANNED_VIEW_KEYS),
  label: z.string().min(1).max(60),
  purpose: z.string().min(1).max(300),
  sourcePhotoAssetId: z.string().min(1).max(80).nullable(),
  mustShow: z.array(z.string().min(1).max(80)).max(40),
  mustShowLabels: z.array(z.string().min(1).max(160)).max(40),
  referenceItemIds: z.array(z.string().min(1).max(80)).max(8),
  photoNotes: z.array(z.string().min(1).max(200)).max(8)
});

export type PlannedView = z.infer<typeof plannedViewSchema>;

export const viewPlanSchema = z.object({
  version: z.literal(1),
  heroPhotoAssetId: z.string().min(1).max(80).nullable(),
  heroReferenceItemIds: z.array(z.string().min(1).max(80)).max(12),
  views: z.array(plannedViewSchema).max(2),
  // Every piece of the confirmed design, sourceable or not, so the
  // consistency judge can tell a design piece the hero does not show from an
  // invention. Absent on plans persisted before it existed: an empty list,
  // never a legacy plan.
  designLabels: z.array(z.string().min(1).max(VIEW_LABEL_MAX_CHARS)).max(DESIGN_LABEL_MAX_ENTRIES).default([]),
  coverage: z.object({
    focalToken: z.string().min(1).max(60).nullable(),
    focalCoveredBy: z.enum(["hero", ...PLANNED_VIEW_KEYS]).nullable(),
    keyRoleKeys: z.array(z.string().min(1).max(80)).max(40),
    heroCovers: z.array(z.string().min(1).max(80)).max(40),
    uncovered: z.array(z.string().min(1).max(80)).max(40)
  })
});

export type ViewPlan = z.infer<typeof viewPlanSchema>;

export function parseViewPlan(value: unknown): ViewPlan | null {
  const parsed = viewPlanSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const HERO_REFERENCE_CAP = 8;
export const VIEW_REFERENCE_CAP = 6;

// Focal vocabulary, matched on RAW spec roles so an unsourceable object (a TV
// has no catalogue category) still counts as the focal element.
const FOCAL_ROLE_TOKENS: Record<string, readonly string[]> = {
  tv_media_wall: ["tv", "television", "media", "media_console", "media_unit", "media_wall", "tv_console", "tv_unit"],
  bed_wall: ["bed", "headboard", "bed_frame"],
  workstation: ["desk", "workstation", "writing_desk"],
  fireplace: ["fireplace", "mantel", "mantelpiece", "hearth"],
  art_display_wall: ["wall_art", "artwork", "art", "gallery_wall", "painting", "display_wall"],
  view_window: ["window", "window_treatments", "curtains", "drapery"]
};

const FOCAL_LABELS: Record<string, string> = {
  tv_media_wall: "the TV and media wall",
  bed_wall: "the bed wall and headboard",
  workstation: "the desk and workstation",
  fireplace: "the fireplace wall",
  art_display_wall: "the art or display wall",
  view_window: "the window wall and its view"
};

function normalizeRole(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function focalRoleKeysFor(focalPoint: string | null | undefined): readonly string[] {
  return focalPoint ? (FOCAL_ROLE_TOKENS[focalPoint] ?? []) : [];
}

export function focalElementLabel(focalPoint: string | null | undefined): string | null {
  return focalPoint ? (FOCAL_LABELS[focalPoint] ?? null) : null;
}

export function specRoleMatchesFocal(specRole: string, focalPoint: string | null | undefined): boolean {
  const tokens = focalRoleKeysFor(focalPoint);
  if (tokens.length === 0) {
    return false;
  }
  const normalized = normalizeRole(specRole);
  const segments = normalized.split("_").filter(Boolean);
  return tokens.some((token) => normalized === token || segments.includes(token));
}

// A focal point the planner can name a wall for. "conversation" is a seating
// arrangement, not a wall, and "unknown" is nothing to guarantee.
function focalTokenFor(focalPoint: string | null | undefined): string | null {
  return focalPoint && FOCAL_ROLE_TOKENS[focalPoint] ? `focal:${focalPoint}` : null;
}

// Scale classes decide which planned view carries a hidden role: wides carry
// the furniture, the detail view carries what reads at touching distance.
const SMALL_SCALE_CATEGORIES = new Set(["side_tables", "lighting", "decor", "curtains", "bedding", "towels", "stools"]);

const PRIMARY_CATEGORY_BY_LAYOUT: Record<string, readonly string[]> = {
  living_only: ["sofas"],
  living_plus_dining: ["sofas"],
  dining_only: ["dining_tables"],
  bedroom: ["beds"],
  home_office: ["desks"],
  unknown: ["sofas", "beds", "dining_tables", "desks"]
};

type KeyRole = { key: string; label: string; category: string; specRole: string };

function isDiningRole(role: KeyRole): boolean {
  return (
    role.category === "dining_tables" ||
    role.category === "chairs" ||
    /dining/.test(normalizeRole(role.specRole)) ||
    /dining/.test(role.label.toLowerCase())
  );
}

function keyRolesFor(input: ViewPlanInput): { keyRoles: KeyRole[]; focalCarrierLabels: string[]; designLabels: string[] } {
  if (input.spec) {
    const { roles, unsourceable } = sourcingRolesFromDesignSpec(input.spec, input.roomType);
    const keyRoles = roles.map((role) => ({
      key: role.specKey,
      label: role.specLabel,
      category: role.category,
      specRole: role.specRole
    }));
    const designLabels = unique([...roles.map((role) => role.specLabel), ...unsourceable.map((entry) => entry.label)].map(boundedLabel)).slice(
      0,
      DESIGN_LABEL_MAX_ENTRIES
    );
    const focalCarrierLabels = [
      ...roles.filter((role) => specRoleMatchesFocal(role.specRole, input.focalPoint)).map((role) => role.specLabel),
      ...unsourceable
        // The spec key is "<index>:<role>", the role text with spaces as underscores.
        .filter((entry) => specRoleMatchesFocal(entry.specKey.split(":").slice(1).join(":") || entry.specKey, input.focalPoint))
        .map((entry) => entry.label)
    ];
    return { keyRoles, focalCarrierLabels, designLabels };
  }
  // No spec (a legacy room): the selected products are the key roles.
  return {
    keyRoles: input.products.map((product) => ({
      key: product.specKey ?? product.itemId,
      label: product.label,
      category: product.category,
      specRole: product.specKey?.split(":")[1] ?? product.category
    })),
    focalCarrierLabels: [],
    designLabels: unique(input.products.map((product) => boundedLabel(product.label))).slice(0, DESIGN_LABEL_MAX_ENTRIES)
  };
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values));
}


function boundedLabel(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length <= VIEW_LABEL_MAX_CHARS ? collapsed : `${collapsed.slice(0, VIEW_LABEL_MAX_CHARS - 1)}…`;
}

// The focal point the planner and the placement review work from. A focal
// point the shopper chose is used as given. When the brief left it unknown,
// the layout rules already assume the TV wall anchors a living room's seating
// (parseSpatialIntent records that assumption), and the planner follows the
// same assumption only when the confirmed design actually carries a TV or a
// media wall; a lounge designed without one gets no focal view. Nothing here
// says whether the hero SHOWS the focal element: that stays the camera read's.
export function planningFocalPoint(
  intent: Pick<SpatialIntent, "layoutMode" | "focalPoint">,
  spec: { objects: DesignSpecObject[] } | null
): string | null {
  if (intent.focalPoint && intent.focalPoint !== "unknown") {
    return intent.focalPoint;
  }
  const livingLike = intent.layoutMode === "living_only" || intent.layoutMode === "living_plus_dining";
  if (!livingLike || !spec) {
    return null;
  }
  return spec.objects.some((object) => specRoleMatchesFocal(object.role, "tv_media_wall")) ? "tv_media_wall" : null;
}

function composeFocalLabel(focalLabel: string, carrierLabels: readonly string[]): string {
  const carriers = unique(carrierLabels);
  return carriers.length > 0 ? `${focalLabel} (${carriers.join(", ")})` : focalLabel;
}

export function planViews(input: ViewPlanInput): ViewPlan {
  const heroCap = input.heroReferenceCap ?? HERO_REFERENCE_CAP;
  const layoutMode = spatialLayoutModeForRoomType(input.roomType);
  const read = input.cameraRead ?? fallbackCameraRead(input.photos);
  const { keyRoles, focalCarrierLabels, designLabels } = keyRolesFor(input);
  const keyRoleKeys = keyRoles.map((role) => role.key);
  const roleByKey = new Map(keyRoles.map((role) => [role.key, role]));

  // Only a vision read can hide a role; a fallback read hides nothing and,
  // below, covers nothing focal either.
  const hiddenKeys = read.source === "vision" ? unique(read.hero.hiddenRoleKeys.filter((key) => roleByKey.has(key))) : [];
  const hiddenSet = new Set(hiddenKeys);
  const heroCovers = keyRoleKeys.filter((key) => !hiddenSet.has(key));

  const focalToken = focalTokenFor(input.focalPoint);
  const focalLabel = focalElementLabel(input.focalPoint);
  // Never inferred from the spec's role list: a TV in the spec does not put
  // the TV wall in front of the camera.
  const focalCoveredByHero = focalToken === null || read.hero.showsFocalElement === true;

  // Only the room's own photographs can anchor: a read that echoes an id the
  // job does not own would otherwise send the views phase after an asset row
  // that does not exist.
  const ownedIds = new Set(input.photos.map((photo) => photo.assetId));
  const knownPhotos = read.photos.filter((photo) => ownedIds.has(photo.assetId));
  const foreignPhotos = read.photos.filter((photo) => !ownedIds.has(photo.assetId));
  const eligiblePhotos = knownPhotos.filter(
    (photo) => photo.assetId !== input.heroPhotoAssetId && photo.sameRoom === "yes"
  );
  const photoNoteFor = (photo: RoomCameraRead["photos"][number], reason: string) => `${photo.assetId}: ${reason}`;
  const nonHeroPhotos = knownPhotos.filter((photo) => photo.assetId !== input.heroPhotoAssetId);
  const unreadPhotos = input.photos.filter(
    (photo) => photo.assetId !== input.heroPhotoAssetId && !read.photos.some((entry) => entry.assetId === photo.assetId)
  );

  // The wide view: focal when the hero does not carry the focal element,
  // reverse otherwise. Anchored to an eligible photograph when one fits.
  const wideKey: PlannedViewKey = focalCoveredByHero ? "reverse_wide" : "focal_wide";

  // In a combined hall the dining roles ride the REVERSE wide, whose camera
  // stands in the dining zone. A focal wide faces the living zone's focal
  // wall and cannot promise the dining zone; hidden dining roles are then
  // reported as uncovered rather than demanded of a view that cannot show
  // them (the harness's coverage check reports the gap).
  const isCombinedDining = (role: KeyRole) => layoutMode === "living_plus_dining" && isDiningRole(role);
  const hiddenDiningOffFocal = hiddenKeys.filter((key) => wideKey === "focal_wide" && isCombinedDining(roleByKey.get(key)!));
  const hiddenLarge = hiddenKeys.filter((key) => {
    const role = roleByKey.get(key)!;
    if (hiddenDiningOffFocal.includes(key)) {
      return false;
    }
    return !SMALL_SCALE_CATEGORIES.has(role.category) || isCombinedDining(role);
  });
  const hiddenSmall = hiddenKeys.filter((key) => !hiddenLarge.includes(key) && !hiddenDiningOffFocal.includes(key));
  let anchor: RoomCameraRead["photos"][number] | null = null;
  const notes: string[] = [];
  if (wideKey === "focal_wide") {
    const facing = eligiblePhotos.filter((photo) => photo.showsFocalWall);
    anchor = facing.find((photo) => photo.cameraRelativeToHero === "opposite") ?? facing[0] ?? null;
  } else {
    anchor = eligiblePhotos.find((photo) => photo.cameraRelativeToHero === "opposite") ?? null;
  }
  for (const photo of nonHeroPhotos) {
    if (anchor && photo.assetId === anchor.assetId) {
      continue;
    }
    if (photo.sameRoom === "no") {
      notes.push(photoNoteFor(photo, "not the same room as the hero; never an anchor"));
    } else if (photo.sameRoom === "unsure") {
      notes.push(photoNoteFor(photo, "same room uncertain; not used as an anchor"));
    } else if (wideKey === "focal_wide" && !photo.showsFocalWall) {
      notes.push(photoNoteFor(photo, "does not face the focal wall"));
    } else if (wideKey === "reverse_wide" && photo.cameraRelativeToHero !== "opposite") {
      notes.push(photoNoteFor(photo, `camera is ${photo.cameraRelativeToHero} of the hero, not opposite`));
    } else {
      notes.push(photoNoteFor(photo, "another photograph was a better fit"));
    }
  }
  for (const photo of unreadPhotos) {
    notes.push(`${photo.assetId}: not covered by the camera read`);
  }
  for (const photo of foreignPhotos) {
    notes.push(photoNoteFor(photo, "not one of the room's photographs; ignored"));
  }

  const wideMustShow = [...(wideKey === "focal_wide" && focalToken ? [focalToken] : []), ...hiddenLarge];
  const wideMustShowLabels = [
    ...(wideKey === "focal_wide" && focalLabel ? [boundedLabel(composeFocalLabel(focalLabel, focalCarrierLabels))] : []),
    ...hiddenLarge.map((key) => boundedLabel(roleByKey.get(key)!.label))
  ];

  // The focal view exists to show the focal wall, so the products the shopper
  // selected for the focal roles (the media console, the bed) ride with it as
  // references even when the read did not list them as hidden. They stay out
  // of mustShow so every role is still owned by exactly one view.
  const focalCarrierKeys =
    wideKey === "focal_wide"
      ? keyRoles.filter((role) => specRoleMatchesFocal(role.specRole, input.focalPoint)).map((role) => role.key)
      : [];
  const primaryCategories = PRIMARY_CATEGORY_BY_LAYOUT[layoutMode] ?? PRIMARY_CATEGORY_BY_LAYOUT.unknown;
  const primary = input.products.find((product) => primaryCategories.includes(product.category)) ?? null;
  const wideReferences = unique([
    ...input.products.filter((product) => product.specKey && wideMustShow.includes(product.specKey)).map((p) => p.itemId),
    ...input.products.filter((product) => product.specKey && focalCarrierKeys.includes(product.specKey)).map((p) => p.itemId),
    ...(primary ? [primary.itemId] : [])
  ]).slice(0, VIEW_REFERENCE_CAP);

  const wide: PlannedView = {
    key: wideKey,
    label: PLANNED_VIEW_LABELS[wideKey],
    purpose:
      wideKey === "focal_wide"
        ? `A wide view facing ${focalLabel ?? "the focal wall"}, so the design's focal element and everything that faces it is shown.`
        : "A wide view from the far side of the room looking back toward the first camera, showing the side the hero cannot.",
    sourcePhotoAssetId: anchor?.assetId ?? null,
    mustShow: wideMustShow,
    mustShowLabels: wideMustShowLabels,
    referenceItemIds: wideReferences,
    photoNotes: notes.slice(0, 8)
  };

  // The detail view earns its place when the design has pieces that read at
  // touching distance, or when the hero cannot carry every selected product.
  const smallKeyRoles = keyRoles.filter((role) => SMALL_SCALE_CATEGORIES.has(role.category));
  const includeDetail = smallKeyRoles.length > 0 || input.products.length > heroCap;
  const views: PlannedView[] = [wide];
  if (includeDetail) {
    const detailFromRoles = input.products
      .filter((product) => product.specKey && hiddenSmall.includes(product.specKey))
      .map((product) => product.itemId);
    const detailFromCategories = input.products
      .filter((product) => SMALL_SCALE_CATEGORIES.has(product.category))
      .map((product) => product.itemId);
    views.push({
      key: "anchor_detail",
      label: PLANNED_VIEW_LABELS.anchor_detail,
      purpose: "A close detail of the main furniture group's materials, texture and styling.",
      sourcePhotoAssetId: null,
      mustShow: hiddenSmall,
      mustShowLabels: hiddenSmall.map((key) => boundedLabel(roleByKey.get(key)!.label)),
      referenceItemIds: unique([...detailFromRoles, ...detailFromCategories]).slice(0, VIEW_REFERENCE_CAP),
      photoNotes: []
    });
  }

  const assigned = new Set(views.flatMap((view) => view.mustShow));
  const uncovered = hiddenKeys.filter((key) => !assigned.has(key));

  return {
    version: 1,
    heroPhotoAssetId: input.heroPhotoAssetId,
    heroReferenceItemIds: input.products.slice(0, heroCap).map((product) => product.itemId),
    views,
    designLabels,
    coverage: {
      focalToken,
      focalCoveredBy: focalToken === null ? null : focalCoveredByHero ? "hero" : wideKey,
      keyRoleKeys,
      heroCovers,
      uncovered
    }
  };
}
