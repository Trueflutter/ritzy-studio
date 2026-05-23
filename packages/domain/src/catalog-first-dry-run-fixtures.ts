import type {
  CatalogFirstOrchestrationPlanInput
} from "./catalog-first-orchestration-planner";
import {
  normalizeCatalogFirstRoomType,
  type CatalogFirstRoomType,
  type ProductBundleItem
} from "./catalog-first-room-generation";

export type CatalogFirstDryRunFixtureScenario = {
  id: string;
  label: string;
  input: CatalogFirstOrchestrationPlanInput;
  budgetMaxAed: number | null;
};

export const catalogFirstDryRunFixtureScenarioList = [
  scenario("living-room-complete", "Living room complete bundle", "living_room", "premium", 18000, [
    candidate("living_sofa", "sofas", 6200, 92),
    candidate("living_rug", "rugs", 2400, 88),
    candidate("living_coffee_table", "coffee_tables", 2600, 86),
    candidate("living_media_console", "media_units", 3400, 84),
    candidate("living_lamp", "lighting", 850, 82),
    candidate("living_cushion", "decor", 175, 80)
  ]),
  scenario("dining-room-complete", "Dining room quantity-aware bundle", "dining_room", "budget", 14000, [
    candidate("dining_table", "dining_tables", 4300, 88),
    candidate("dining_chair", "chairs", 650, 86),
    candidate("dining_pendant", "lighting", 1200, 80),
    candidate("dining_sideboard", "sideboards", 3100, 78)
  ]),
  scenario("bedroom-complete", "Bedroom quantity-aware bundle", "bedroom", "premium", 16000, [
    candidate("bedroom_bed", "beds", 7200, 90),
    candidate("bedroom_bedside_table", "side_tables", 1200, 88),
    candidate("bedroom_lamp", "lighting", 800, 86),
    candidate("bedroom_rug", "rugs", 1900, 84)
  ]),
  scenario("home-office-complete", "Home office complete bundle", "home_office", "budget", 9000, [
    candidate("office_desk", "desks", 2800, 88),
    candidate("office_chair", "office_chairs", 1900, 86),
    candidate("office_task_lamp", "lighting", 550, 82),
    candidate("office_shelving", "shelving", 1700, 78)
  ])
] as const satisfies readonly CatalogFirstDryRunFixtureScenario[];

export function catalogFirstDryRunFixtureScenarios(): readonly CatalogFirstDryRunFixtureScenario[] {
  return catalogFirstDryRunFixtureScenarioList;
}

export function catalogFirstDryRunFixtureByRoom(
  roomType: string | CatalogFirstRoomType
): CatalogFirstDryRunFixtureScenario | null {
  const normalizedRoomType = normalizeCatalogFirstRoomType(roomType);

  return catalogFirstDryRunFixtureScenarioList.find((scenario) => scenario.input.roomType === normalizedRoomType) ?? null;
}

function scenario(
  id: string,
  label: string,
  roomType: CatalogFirstRoomType,
  budgetTier: CatalogFirstOrchestrationPlanInput["budgetTier"],
  budgetMaxAed: number,
  candidates: readonly ProductBundleItem[]
): CatalogFirstDryRunFixtureScenario {
  return {
    id,
    label,
    budgetMaxAed,
    input: {
      roomType,
      budgetTier,
      candidates
    }
  };
}

function candidate(
  productId: string,
  category: string,
  unitPriceAed: number,
  matchScore: number
): ProductBundleItem {
  return {
    roleId: "fixture_candidate",
    productId,
    category,
    name: productId.replace(/_/g, " "),
    quantity: 1,
    unitPriceAed,
    tier: "premium",
    matchScore
  };
}
