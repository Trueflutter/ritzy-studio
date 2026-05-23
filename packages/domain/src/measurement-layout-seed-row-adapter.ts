import {
  type MeasurementLayoutSeedAlias,
  type MeasurementLayoutSeedDataset,
  type MeasurementLayoutSeedLayout,
  type MeasurementLayoutSeedSourceKind,
  type MeasurementLayoutSeedSourceRightsStatus,
  type MeasurementLayoutSeedConfidence,
  type MeasurementLayoutSeedPropertyType,
  measurementLayoutSeedDatasetSchema
} from "./measurement-layout-seed";
import { normalizeLayoutAlias } from "./measurement-intelligence";

export type MeasurementSeedRowAdapterIssue = {
  code: string;
  path: string;
  message: string;
};

export type MeasurementSeedRowAdapterStatus = "draft" | "reviewed";

export type MeasurementSeedRowAdapterOptions = {
  status?: MeasurementSeedRowAdapterStatus;
};

export type FuturePropertyCommunityRow = {
  slug: string;
  name: string;
  city: string;
  country: string;
  status: MeasurementSeedRowAdapterStatus;
  metadata_json: Record<string, never>;
};

export type FuturePropertyDevelopmentRow = {
  community_slug: string;
  slug: string;
  name: string;
  developer_name: string;
  phase_name: string | null;
  status: MeasurementSeedRowAdapterStatus;
  metadata_json: Record<string, never>;
};

export type FuturePropertyLayoutRow = {
  community_slug: string;
  development_slug: string;
  slug: string;
  name: string;
  property_type: MeasurementLayoutSeedPropertyType;
  type_code: string | null;
  bedroom_count: number;
  bathroom_count: null;
  floor_count: null;
  bua_sqft: null;
  plot_sqft: null;
  mirror_of_layout_slug: null;
  layout_confidence: MeasurementLayoutSeedConfidence;
  source_rights_status: MeasurementLayoutSeedSourceRightsStatus;
  status: MeasurementSeedRowAdapterStatus;
  notes: string | null;
  disclaimer: string;
  metadata_json: Record<string, never>;
};

export type FuturePropertyLayoutAliasRow = {
  layout_slug: string | null;
  community_slug: string | null;
  development_ref: string | null;
  alias: string;
  normalized_alias: string;
  alias_kind: MeasurementLayoutSeedAlias["kind"];
  locale: "en";
};

export type FuturePropertyLayoutSourceRow = {
  layout_slug: string;
  source_slug: string;
  source_kind: MeasurementLayoutSeedSourceKind;
  rights_status: MeasurementLayoutSeedSourceRightsStatus;
  source_label: string;
  source_url: string | null;
  publisher_name: string | null;
  retrieved_at: string | null;
  reviewed_by: null;
  reviewed_at: null;
  disclaimer: string;
  raw_asset_id: null;
  metadata_json: {
    notes?: string;
  };
};

export type FuturePropertyLayoutRoomRow = {
  layout_slug: string;
  source_slug: string;
  room_slug: string;
  name: string;
  room_type: string;
  floor_label: string;
  floor_index: number | null;
  wall_length_cm: number | null;
  room_depth_cm: number | null;
  ceiling_height_cm: number | null;
  area_sqft: null;
  geometry_json: null;
  doors_json: null;
  windows_json: null;
  measurement_confidence: MeasurementLayoutSeedConfidence;
  notes: string | null;
  disclaimer: string | null;
  metadata_json: Record<string, never>;
};

export type MeasurementLayoutSeedFutureRows = {
  property_communities: FuturePropertyCommunityRow[];
  property_developments: FuturePropertyDevelopmentRow[];
  property_layouts: FuturePropertyLayoutRow[];
  property_layout_aliases: FuturePropertyLayoutAliasRow[];
  property_layout_sources: FuturePropertyLayoutSourceRow[];
  property_layout_rooms: FuturePropertyLayoutRoomRow[];
};

export type MeasurementLayoutSeedRowAdapterResult =
  | {
      success: true;
      rows: MeasurementLayoutSeedFutureRows;
      issues: [];
    }
  | {
      success: false;
      rows: null;
      issues: MeasurementSeedRowAdapterIssue[];
    };

export function mapMeasurementLayoutSeedToFutureRows(
  value: unknown,
  options: MeasurementSeedRowAdapterOptions = {}
): MeasurementLayoutSeedRowAdapterResult {
  const parsed = measurementLayoutSeedDatasetSchema.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      rows: null,
      issues: parsed.error.issues
        .map((issue) => ({
          code: "seed_schema_invalid",
          path: issue.path.length === 0 ? "(root)" : issue.path.map((part) => String(part)).join("."),
          message: issue.message
        }))
        .sort(compareIssues)
    };
  }

  const dataset = parsed.data;
  const issues = validateAdapterInput(dataset);
  if (issues.length > 0) {
    return {
      success: false,
      rows: null,
      issues
    };
  }

  return {
    success: true,
    rows: buildFutureRows(dataset, options.status ?? "draft"),
    issues: []
  };
}

function buildFutureRows(dataset: MeasurementLayoutSeedDataset, status: MeasurementSeedRowAdapterStatus) {
  const communities = new Map<string, FuturePropertyCommunityRow>();
  const developments = new Map<string, FuturePropertyDevelopmentRow>();
  const rows: MeasurementLayoutSeedFutureRows = {
    property_communities: [],
    property_developments: [],
    property_layouts: [],
    property_layout_aliases: [],
    property_layout_sources: [],
    property_layout_rooms: []
  };

  for (const layout of sortedLayouts(dataset.layouts)) {
    if (!communities.has(layout.community.slug)) {
      communities.set(layout.community.slug, {
        slug: layout.community.slug,
        name: layout.community.name,
        city: layout.community.city,
        country: layout.community.country,
        status,
        metadata_json: {}
      });
    }

    const developmentKey = developmentReference(layout);
    if (!developments.has(developmentKey)) {
      developments.set(developmentKey, {
        community_slug: layout.community.slug,
        slug: layout.development.slug,
        name: layout.development.name,
        developer_name: layout.development.developer,
        phase_name: layout.development.phaseName ?? null,
        status,
        metadata_json: {}
      });
    }

    rows.property_layouts.push(mapLayoutRow(layout, status));
    rows.property_layout_aliases.push(...mapAliasRows(layout));
    rows.property_layout_sources.push(...mapSourceRows(layout));
    rows.property_layout_rooms.push(...mapRoomRows(layout));
  }

  rows.property_communities = [...communities.values()].sort(compareBySlug);
  rows.property_developments = [...developments.values()].sort(compareDevelopmentRows);
  rows.property_layouts.sort(compareBySlug);
  rows.property_layout_aliases.sort(compareAliasRows);
  rows.property_layout_sources.sort(compareSourceRows);
  rows.property_layout_rooms.sort(compareRoomRows);

  return rows;
}

function validateAdapterInput(dataset: MeasurementLayoutSeedDataset) {
  const issues: MeasurementSeedRowAdapterIssue[] = [];

  for (const [layoutIndex, layout] of dataset.layouts.entries()) {
    if (!layout.id) {
      issues.push(issue("missing_layout_slug", `layouts.${layoutIndex}.id`, "Layout id is required for future row mapping."));
    }

    if (!layout.unitTypeCode) {
      issues.push(
        issue(
          "missing_unit_type_code",
          `layouts.${layoutIndex}.unitTypeCode`,
          "Unit type code is required so the future layout row has a deterministic display name/type_code."
        )
      );
    }

    if (!layout.layoutConfidence) {
      issues.push(
        issue(
          "missing_layout_confidence",
          `layouts.${layoutIndex}.layoutConfidence`,
          "Layout confidence is required for future property_layouts.layout_confidence."
        )
      );
    }

    if (!layout.sourceRightsStatus || layout.sourceRightsStatus === "unknown") {
      issues.push(
        issue(
          "missing_source_rights_status",
          `layouts.${layoutIndex}.sourceRightsStatus`,
          "Explicit source rights status is required for future property_layouts.source_rights_status."
        )
      );
    }

    for (const [aliasIndex, alias] of allAliases(layout).entries()) {
      if (normalizeLayoutAlias(alias.value).length === 0) {
        issues.push(
          issue(
            "empty_normalized_alias",
            `layouts.${layoutIndex}.aliases.${aliasIndex}.value`,
            "Alias must contain searchable characters after normalization."
          )
        );
      }
    }

    const sourceIds = new Set(layout.sources.map((source) => source.id));
    for (const [sourceIndex, source] of layout.sources.entries()) {
      if (!source.id) {
        issues.push(issue("missing_source_id", `layouts.${layoutIndex}.sources.${sourceIndex}.id`, "Source id is required."));
      }
      if (!source.kind) {
        issues.push(
          issue("missing_source_kind", `layouts.${layoutIndex}.sources.${sourceIndex}.kind`, "Source kind is required.")
        );
      }
      if (!source.rightsStatus || source.rightsStatus === "unknown") {
        issues.push(
          issue(
            "missing_source_rights_status",
            `layouts.${layoutIndex}.sources.${sourceIndex}.rightsStatus`,
            "Explicit source rights status is required for each source."
          )
        );
      }
      if (!source.disclaimer) {
        issues.push(
          issue(
            "missing_source_disclaimer",
            `layouts.${layoutIndex}.sources.${sourceIndex}.disclaimer`,
            "Source disclaimer is required for future property_layout_sources.disclaimer."
          )
        );
      }
    }

    for (const [roomIndex, room] of layout.rooms.entries()) {
      if (!room.id) {
        issues.push(issue("missing_room_id", `layouts.${layoutIndex}.rooms.${roomIndex}.id`, "Room id is required."));
      }
      if (!sourceIds.has(room.sourceId)) {
        issues.push(
          issue(
            "missing_room_source",
            `layouts.${layoutIndex}.rooms.${roomIndex}.sourceId`,
            "Room sourceId must reference a source in the same layout."
          )
        );
      }
      if (!room.measurementConfidence) {
        issues.push(
          issue(
            "missing_room_confidence",
            `layouts.${layoutIndex}.rooms.${roomIndex}.measurementConfidence`,
            "Room measurement confidence is required for future property_layout_rooms.measurement_confidence."
          )
        );
      }
      if (room.lengthCm !== undefined && room.lengthCm <= 0) {
        issues.push(
          issue(
            "invalid_room_length_cm",
            `layouts.${layoutIndex}.rooms.${roomIndex}.lengthCm`,
            "Room lengthCm must be positive when provided."
          )
        );
      }
      if (room.widthCm !== undefined && room.widthCm <= 0) {
        issues.push(
          issue(
            "invalid_room_width_cm",
            `layouts.${layoutIndex}.rooms.${roomIndex}.widthCm`,
            "Room widthCm must be positive when provided."
          )
        );
      }
      if (room.ceilingHeightCm !== undefined && room.ceilingHeightCm <= 0) {
        issues.push(
          issue(
            "invalid_room_ceiling_height_cm",
            `layouts.${layoutIndex}.rooms.${roomIndex}.ceilingHeightCm`,
            "Room ceilingHeightCm must be positive when provided."
          )
        );
      }
    }
  }

  return issues.sort(compareIssues);
}

function mapLayoutRow(layout: MeasurementLayoutSeedLayout, status: MeasurementSeedRowAdapterStatus): FuturePropertyLayoutRow {
  return {
    community_slug: layout.community.slug,
    development_slug: layout.development.slug,
    slug: layout.id,
    name: layout.unitTypeCode ?? layout.id,
    property_type: layout.propertyType,
    type_code: layout.unitTypeCode,
    bedroom_count: layout.bedroomCount,
    bathroom_count: null,
    floor_count: null,
    bua_sqft: null,
    plot_sqft: null,
    mirror_of_layout_slug: null,
    layout_confidence: layout.layoutConfidence,
    source_rights_status: layout.sourceRightsStatus,
    status,
    notes: layout.notes ?? null,
    disclaimer: layout.disclaimer,
    metadata_json: {}
  };
}

function mapAliasRows(layout: MeasurementLayoutSeedLayout): FuturePropertyLayoutAliasRow[] {
  return [
    ...layout.community.aliases.map((alias) => aliasRow(alias, null, layout.community.slug, null)),
    ...layout.development.aliases.map((alias) => aliasRow(alias, null, null, developmentReference(layout))),
    ...layout.aliases.map((alias) => aliasRow(alias, layout.id, null, null)),
    ...(layout.unitTypeCode ? [aliasRow({ value: layout.unitTypeCode, kind: "layout_code" }, layout.id, null, null)] : [])
  ];
}

function mapSourceRows(layout: MeasurementLayoutSeedLayout): FuturePropertyLayoutSourceRow[] {
  return layout.sources.map((source) => ({
    layout_slug: layout.id,
    source_slug: source.id,
    source_kind: source.kind,
    rights_status: source.rightsStatus,
    source_label: source.label,
    source_url: source.url ?? null,
    publisher_name: source.publisherName ?? null,
    retrieved_at: source.retrievedAt ?? null,
    reviewed_by: null,
    reviewed_at: null,
    disclaimer: source.disclaimer,
    raw_asset_id: null,
    metadata_json: source.notes ? { notes: source.notes } : {}
  }));
}

function mapRoomRows(layout: MeasurementLayoutSeedLayout): FuturePropertyLayoutRoomRow[] {
  return layout.rooms.map((room) => ({
    layout_slug: layout.id,
    source_slug: room.sourceId,
    room_slug: room.id,
    name: room.name,
    room_type: room.normalizedRoomType,
    floor_label: room.floorLevel,
    floor_index: floorIndex(room.floorLevel),
    wall_length_cm: room.lengthCm ?? null,
    room_depth_cm: room.widthCm ?? null,
    ceiling_height_cm: room.ceilingHeightCm ?? null,
    area_sqft: null,
    geometry_json: null,
    doors_json: null,
    windows_json: null,
    measurement_confidence: room.measurementConfidence,
    notes: room.notes ?? null,
    disclaimer: room.disclaimer ?? null,
    metadata_json: {}
  }));
}

function aliasRow(
  alias: MeasurementLayoutSeedAlias,
  layoutSlug: string | null,
  communitySlug: string | null,
  developmentRef: string | null
): FuturePropertyLayoutAliasRow {
  return {
    layout_slug: layoutSlug,
    community_slug: communitySlug,
    development_ref: developmentRef,
    alias: alias.value,
    normalized_alias: normalizeLayoutAlias(alias.value),
    alias_kind: alias.kind,
    locale: "en"
  };
}

function allAliases(layout: MeasurementLayoutSeedLayout) {
  return [
    ...layout.community.aliases,
    ...layout.development.aliases,
    ...layout.aliases,
    ...(layout.unitTypeCode ? [{ value: layout.unitTypeCode, kind: "layout_code" as const }] : [])
  ];
}

function developmentReference(layout: MeasurementLayoutSeedLayout) {
  return `${layout.community.slug}/${layout.development.slug}`;
}

function floorIndex(floorLevel: string) {
  switch (floorLevel) {
    case "basement":
      return -1;
    case "ground":
      return 0;
    case "first":
      return 1;
    case "second":
      return 2;
    case "third":
      return 3;
    case "roof":
    case "other":
      return null;
    default:
      return null;
  }
}

function sortedLayouts(layouts: MeasurementLayoutSeedLayout[]) {
  return [...layouts].sort((left, right) => left.id.localeCompare(right.id));
}

function issue(code: string, path: string, message: string): MeasurementSeedRowAdapterIssue {
  return { code, path, message };
}

function compareIssues(left: MeasurementSeedRowAdapterIssue, right: MeasurementSeedRowAdapterIssue) {
  return left.path.localeCompare(right.path) || left.code.localeCompare(right.code);
}

function compareBySlug<T extends { slug: string }>(left: T, right: T) {
  return left.slug.localeCompare(right.slug);
}

function compareDevelopmentRows(left: FuturePropertyDevelopmentRow, right: FuturePropertyDevelopmentRow) {
  return left.community_slug.localeCompare(right.community_slug) || left.slug.localeCompare(right.slug);
}

function compareAliasRows(left: FuturePropertyLayoutAliasRow, right: FuturePropertyLayoutAliasRow) {
  return (
    (left.layout_slug ?? "").localeCompare(right.layout_slug ?? "") ||
    (left.community_slug ?? "").localeCompare(right.community_slug ?? "") ||
    (left.development_ref ?? "").localeCompare(right.development_ref ?? "") ||
    left.normalized_alias.localeCompare(right.normalized_alias) ||
    left.alias_kind.localeCompare(right.alias_kind)
  );
}

function compareSourceRows(left: FuturePropertyLayoutSourceRow, right: FuturePropertyLayoutSourceRow) {
  return left.layout_slug.localeCompare(right.layout_slug) || left.source_slug.localeCompare(right.source_slug);
}

function compareRoomRows(left: FuturePropertyLayoutRoomRow, right: FuturePropertyLayoutRoomRow) {
  return left.layout_slug.localeCompare(right.layout_slug) || left.room_slug.localeCompare(right.room_slug);
}
