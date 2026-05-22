export type CatalogFirstRoomType = "living_room" | "dining_room" | "bedroom" | "home_office";

export type ProductBundleTier = "budget" | "premium";

export type CatalogFirstRoleImportance = "anchor" | "supporting" | "styling";

export type CatalogFirstRoleInclusion = "always" | "space_allows" | "catalog_supports";

export type RoomBundleRole = {
  id: string;
  roomType: CatalogFirstRoomType;
  label: string;
  category: string;
  acceptedCategories: readonly string[];
  quantity: number;
  required: boolean;
  importance: CatalogFirstRoleImportance;
  includeWhen: CatalogFirstRoleInclusion;
};

export type ProductBundleItem = {
  roleId: string;
  productId: string;
  category: string;
  name: string;
  quantity: number;
  unitPriceAed: number | null;
  tier: ProductBundleTier;
  matchScore: number | null;
};

export type ProductBundle = {
  roomType: CatalogFirstRoomType;
  tier: ProductBundleTier;
  items: readonly ProductBundleItem[];
  totalAed: number | null;
  score: BundleScore | null;
};

export type BundleScore = {
  total: number;
  roleCoverage: number;
  budgetFit: number;
  catalogConfidence: number;
  visualCohesion: number;
  notes: readonly string[];
};

export type BundleAssemblyInput = {
  roomType: CatalogFirstRoomType;
  tier: ProductBundleTier;
  roles: readonly RoomBundleRole[];
  candidateItemsByRoleId: Readonly<Record<string, readonly ProductBundleItem[]>>;
  budgetMaxAed?: number | null;
};

export type BundleAssemblyOutput = {
  roomType: CatalogFirstRoomType;
  tier: ProductBundleTier;
  roles: readonly RoomBundleRole[];
  bundle: ProductBundle | null;
  missingRequiredRoleIds: readonly string[];
  score: BundleScore | null;
};

export const catalogFirstRoomBundleBlueprints = {
  living_room: [
    role("living_room", "sofa", "sofa", "sofas", 1, true, "anchor", "always"),
    role("living_room", "rug", "rug", "rugs", 1, true, "anchor", "always"),
    role("living_room", "coffee_table", "coffee table", "coffee_tables", 1, true, "anchor", "always"),
    role("living_room", "tv_media_console", "TV/media console", "storage", 1, false, "supporting", "catalog_supports", [
      "storage",
      "media_units",
      "tv_units"
    ]),
    role("living_room", "lighting", "lighting", "lighting", 2, false, "supporting", "catalog_supports"),
    role("living_room", "cushions", "cushions", "decor", 4, false, "styling", "catalog_supports")
  ],
  dining_room: [
    role("dining_room", "dining_table", "dining table", "dining_tables", 1, true, "anchor", "always"),
    role("dining_room", "dining_chairs", "dining chairs", "chairs", 6, true, "anchor", "always"),
    role("dining_room", "lighting", "lighting", "lighting", 1, false, "supporting", "catalog_supports"),
    role("dining_room", "sideboard_console", "sideboard/console", "storage", 1, false, "supporting", "catalog_supports", [
      "storage",
      "sideboards",
      "consoles"
    ])
  ],
  bedroom: [
    role("bedroom", "bed", "bed", "beds", 1, true, "anchor", "always"),
    role("bedroom", "bedside_tables", "bedside tables", "side_tables", 2, true, "anchor", "always"),
    role("bedroom", "lighting", "lighting", "lighting", 2, false, "supporting", "catalog_supports"),
    role("bedroom", "rug_textile_layer", "rug/textile layer", "rugs", 1, false, "supporting", "space_allows", [
      "rugs",
      "bedding",
      "curtains"
    ])
  ],
  home_office: [
    role("home_office", "desk", "desk", "desks", 1, true, "anchor", "always"),
    role("home_office", "office_chair", "office chair", "office_chairs", 1, true, "anchor", "always"),
    role("home_office", "task_lighting", "task lighting", "lighting", 1, false, "supporting", "catalog_supports"),
    role("home_office", "storage_shelving", "storage/shelving", "storage", 1, false, "supporting", "catalog_supports", [
      "storage",
      "bookcases",
      "shelving"
    ])
  ]
} as const satisfies Record<CatalogFirstRoomType, readonly RoomBundleRole[]>;

export function catalogFirstRolesForRoom(roomType: CatalogFirstRoomType): readonly RoomBundleRole[] {
  return catalogFirstRoomBundleBlueprints[roomType];
}

function role(
  roomType: CatalogFirstRoomType,
  id: string,
  label: string,
  category: string,
  quantity: number,
  required: boolean,
  importance: CatalogFirstRoleImportance,
  includeWhen: CatalogFirstRoleInclusion,
  acceptedCategories: readonly string[] = [category]
): RoomBundleRole {
  return {
    id,
    roomType,
    label,
    category,
    acceptedCategories,
    quantity,
    required,
    importance,
    includeWhen
  };
}
