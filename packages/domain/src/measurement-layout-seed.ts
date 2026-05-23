import { z } from "zod";

import { normalizeLayoutAlias } from "./measurement-intelligence";

export const measurementLayoutSeedPropertyTypeSchema = z.enum([
  "villa",
  "townhouse",
  "apartment",
  "penthouse",
  "duplex",
  "other"
]);

export const measurementLayoutSeedConfidenceSchema = z.enum([
  "unknown",
  "estimated",
  "assumed",
  "prefill",
  "user_confirmed",
  "verified",
  "designer_verified"
]);

export const measurementLayoutSeedSourceRightsStatusSchema = z.enum([
  "unknown",
  "public_reference_only",
  "structured_facts_only",
  "user_uploaded_private",
  "rights_cleared_internal",
  "partner_licensed",
  "do_not_use"
]);

export const measurementLayoutSeedSourceKindSchema = z.enum([
  "developer_brochure",
  "broker_floor_plan",
  "public_listing",
  "user_upload",
  "designer_upload",
  "internal_research",
  "synthetic_example",
  "partner_feed"
]);

export const measurementLayoutSeedRoomTypeSchema = z.enum([
  "living_room",
  "dining_room",
  "bedroom",
  "home_office",
  "majlis",
  "family_room",
  "kitchen",
  "bathroom",
  "other"
]);

export const measurementLayoutSeedFloorLevelSchema = z.enum([
  "basement",
  "ground",
  "first",
  "second",
  "third",
  "roof",
  "other"
]);

export const measurementLayoutSeedAliasSchema = z
  .object({
    value: z.string().min(1),
    kind: z.enum(["community", "development", "layout_code", "marketing_name", "legacy_name", "user_phrase"])
  })
  .strict();

export const measurementLayoutSeedCommunitySchema = z
  .object({
    slug: slugSchema(),
    name: z.string().min(1),
    city: z.string().min(1).default("Dubai"),
    country: z.string().length(2).default("AE"),
    aliases: z.array(measurementLayoutSeedAliasSchema).default([])
  })
  .strict();

export const measurementLayoutSeedDevelopmentSchema = z
  .object({
    slug: slugSchema(),
    name: z.string().min(1),
    phaseName: z.string().min(1).optional(),
    developer: z.string().min(1),
    aliases: z.array(measurementLayoutSeedAliasSchema).default([])
  })
  .strict();

export const measurementLayoutSeedSourceSchema = z
  .object({
    id: slugSchema(),
    kind: measurementLayoutSeedSourceKindSchema,
    rightsStatus: measurementLayoutSeedSourceRightsStatusSchema,
    label: z.string().min(1),
    url: z.string().url().optional(),
    publisherName: z.string().min(1).optional(),
    retrievedAt: z.string().datetime({ offset: true }).optional(),
    disclaimer: z.string().min(1),
    notes: z.string().min(1).optional()
  })
  .strict();

export const measurementLayoutSeedRoomSchema = z
  .object({
    id: slugSchema(),
    name: z.string().min(1),
    normalizedRoomType: measurementLayoutSeedRoomTypeSchema,
    floorLevel: measurementLayoutSeedFloorLevelSchema,
    sourceId: slugSchema(),
    measurementConfidence: measurementLayoutSeedConfidenceSchema,
    lengthCm: positiveMeasurementSchema().optional(),
    widthCm: positiveMeasurementSchema().optional(),
    ceilingHeightCm: positiveMeasurementSchema().optional(),
    notes: z.string().min(1).optional(),
    disclaimer: z.string().min(1).optional()
  })
  .strict();

export const measurementLayoutSeedLayoutSchema = z
  .object({
    id: slugSchema(),
    community: measurementLayoutSeedCommunitySchema,
    development: measurementLayoutSeedDevelopmentSchema,
    propertyType: measurementLayoutSeedPropertyTypeSchema,
    bedroomCount: z.number().int().nonnegative(),
    unitTypeCode: z.string().min(1).nullable(),
    aliases: z.array(measurementLayoutSeedAliasSchema).default([]),
    layoutConfidence: measurementLayoutSeedConfidenceSchema,
    sourceRightsStatus: measurementLayoutSeedSourceRightsStatusSchema,
    sources: z.array(measurementLayoutSeedSourceSchema).min(1),
    rooms: z.array(measurementLayoutSeedRoomSchema).min(1),
    notes: z.string().min(1).optional(),
    disclaimer: z.string().min(1)
  })
  .strict()
  .superRefine((layout, ctx) => {
    const sourceIds = new Set(layout.sources.map((source) => source.id));
    if (layout.sourceRightsStatus === "unknown") {
      ctx.addIssue({
        code: "custom",
        path: ["sourceRightsStatus"],
        message: "Layout seed records must use an explicit source rights status."
      });
    }

    for (const [sourceIndex, source] of layout.sources.entries()) {
      if (source.rightsStatus === "unknown") {
        ctx.addIssue({
          code: "custom",
          path: ["sources", sourceIndex, "rightsStatus"],
          message: "Seed sources must use an explicit source rights status."
        });
      }
    }

    for (const [roomIndex, room] of layout.rooms.entries()) {
      if (!sourceIds.has(room.sourceId)) {
        ctx.addIssue({
          code: "custom",
          path: ["rooms", roomIndex, "sourceId"],
          message: "Room sourceId must reference a source in the same layout seed record."
        });
      }

      if (isTrustedSeedConfidence(room.measurementConfidence) && !room.sourceId) {
        ctx.addIssue({
          code: "custom",
          path: ["rooms", roomIndex, "sourceId"],
          message: "Trusted room measurements require source provenance."
        });
      }
    }

    if (isTrustedSeedConfidence(layout.layoutConfidence) && layout.sources.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["sources"],
        message: "Trusted layout records require source provenance."
      });
    }
  });

export const measurementLayoutSeedDatasetSchema = z
  .object({
    version: z.literal(1),
    generatedAt: z.string().datetime({ offset: true }).optional(),
    description: z.string().min(1),
    layouts: z.array(measurementLayoutSeedLayoutSchema).min(1)
  })
  .strict()
  .superRefine((dataset, ctx) => {
    const ids = new Set<string>();
    for (const [layoutIndex, layout] of dataset.layouts.entries()) {
      if (ids.has(layout.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["layouts", layoutIndex, "id"],
          message: "Layout ids must be unique within a seed dataset."
        });
      }
      ids.add(layout.id);
    }
  });

export type MeasurementLayoutSeedPropertyType = z.infer<typeof measurementLayoutSeedPropertyTypeSchema>;
export type MeasurementLayoutSeedConfidence = z.infer<typeof measurementLayoutSeedConfidenceSchema>;
export type MeasurementLayoutSeedSourceRightsStatus = z.infer<typeof measurementLayoutSeedSourceRightsStatusSchema>;
export type MeasurementLayoutSeedSourceKind = z.infer<typeof measurementLayoutSeedSourceKindSchema>;
export type MeasurementLayoutSeedRoomType = z.infer<typeof measurementLayoutSeedRoomTypeSchema>;
export type MeasurementLayoutSeedFloorLevel = z.infer<typeof measurementLayoutSeedFloorLevelSchema>;
export type MeasurementLayoutSeedAlias = z.infer<typeof measurementLayoutSeedAliasSchema>;
export type MeasurementLayoutSeedLayout = z.infer<typeof measurementLayoutSeedLayoutSchema>;
export type MeasurementLayoutSeedDataset = z.infer<typeof measurementLayoutSeedDatasetSchema>;

export const syntheticMeasurementLayoutSeedExample: MeasurementLayoutSeedDataset = measurementLayoutSeedDatasetSchema.parse({
  version: 1,
  generatedAt: "2026-05-23T00:00:00.000+04:00",
  description: "Synthetic Measurement Intelligence seed example. Not sourced from a real floor plan.",
  layouts: [
    {
      id: "synthetic-dubai-garden-townhouse-4br-end",
      community: {
        slug: "synthetic-dubai-garden-district",
        name: "Synthetic Dubai Garden District",
        city: "Dubai",
        country: "AE",
        aliases: [
          {
            value: "Example Garden District",
            kind: "community"
          }
        ]
      },
      development: {
        slug: "synthetic-garden-townhouses",
        name: "Synthetic Garden Townhouses",
        phaseName: "Phase 1",
        developer: "Internal Synthetic Developer",
        aliases: [
          {
            value: "Garden Townhouses Phase 1",
            kind: "development"
          }
        ]
      },
      propertyType: "townhouse",
      bedroomCount: 4,
      unitTypeCode: "SYN-TH-4E",
      aliases: [
        {
          value: "SYN TH 4E",
          kind: "layout_code"
        },
        {
          value: "4 bedroom synthetic end unit",
          kind: "user_phrase"
        }
      ],
      layoutConfidence: "prefill",
      sourceRightsStatus: "rights_cleared_internal",
      sources: [
        {
          id: "internal-synthetic-example",
          kind: "synthetic_example",
          rightsStatus: "rights_cleared_internal",
          label: "Internal synthetic seed shape example",
          disclaimer: "Synthetic data for schema validation only. Not a real property or floor plan."
        }
      ],
      rooms: [
        {
          id: "ground-living-dining",
          name: "Living / Dining",
          normalizedRoomType: "living_room",
          floorLevel: "ground",
          sourceId: "internal-synthetic-example",
          measurementConfidence: "prefill",
          lengthCm: 620,
          widthCm: 430,
          ceilingHeightCm: 300,
          disclaimer: "Synthetic dimensions for seed-format validation only."
        },
        {
          id: "first-primary-bedroom",
          name: "Primary Bedroom",
          normalizedRoomType: "bedroom",
          floorLevel: "first",
          sourceId: "internal-synthetic-example",
          measurementConfidence: "prefill",
          lengthCm: 420,
          widthCm: 390,
          disclaimer: "Synthetic dimensions for seed-format validation only."
        }
      ],
      notes: "Safe synthetic townhouse-style layout for proving repo-managed seed shape.",
      disclaimer: "This layout is synthetic and should never be presented as a real Dubai developer plan."
    }
  ]
});

export function parseMeasurementLayoutSeedDataset(value: unknown) {
  return measurementLayoutSeedDatasetSchema.parse(value);
}

export function normalizedMeasurementLayoutSeedAliases(layout: MeasurementLayoutSeedLayout) {
  return [
    ...layout.community.aliases,
    ...layout.development.aliases,
    ...layout.aliases,
    layout.unitTypeCode ? { value: layout.unitTypeCode, kind: "layout_code" as const } : null
  ]
    .filter((alias): alias is MeasurementLayoutSeedAlias => Boolean(alias))
    .map((alias) => ({
      ...alias,
      normalized: normalizeLayoutAlias(alias.value)
    }));
}

export function isTrustedSeedConfidence(confidence: MeasurementLayoutSeedConfidence) {
  return confidence === "user_confirmed" || confidence === "verified" || confidence === "designer_verified";
}

function slugSchema() {
  return z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase kebab-case slug.");
}

function positiveMeasurementSchema() {
  return z.number().positive();
}
