import type { CatalogFirstRoomType } from "@ritzy-studio/domain";

// Moved from the retired catalog-first planner family (Gate 1 disposition): the
// pipeline's internal room-type key normalization, kept next to its one consumer
// (concept generation).

export function normalizeCatalogFirstRoomType(roomType: string | CatalogFirstRoomType): CatalogFirstRoomType {
  const normalized = roomType.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (isCombinedLivingDiningRoomType(roomType)) {
    return "living_dining";
  }

  if (normalized === "living_room" || normalized === "living" || normalized === "lounge" || normalized === "family_room") {
    return "living_room";
  }

  if (normalized === "dining_room" || normalized === "dining" || normalized === "dining_area") {
    return "dining_room";
  }

  if (
    normalized === "bedroom" ||
    normalized === "bed" ||
    normalized === "primary_bedroom" ||
    normalized === "master_bedroom" ||
    normalized === "guest_bedroom"
  ) {
    return "bedroom";
  }

  if (normalized === "home_office" || normalized === "office" || normalized === "study" || normalized === "workspace") {
    return "home_office";
  }

  throw new Error(`Unsupported catalog-first room type: ${roomType}`);
}

function isCombinedLivingDiningRoomType(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[/_-]/g, " ")
    .replace(/\s+/g, " ");

  return /\bliving\b/.test(normalized) && /\bdining\b/.test(normalized);
}
