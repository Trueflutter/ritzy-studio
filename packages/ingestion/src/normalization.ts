import { z } from "zod";

import type { NormalizedProductRecord, RawProductCandidate } from "./types";

const rawProductSchema = z.object({
  canonicalUrl: z.url(),
  name: z.string().min(1),
  retailerCategory: z.string().nullish(),
  description: z.string().nullish(),
  externalSku: z.string().nullish(),
  priceText: z.string().nullish(),
  salePriceText: z.string().nullish(),
  currency: z.string().nullish(),
  availability: z.string().nullish(),
  primaryImageUrl: z.url().nullish(),
  imageUrls: z.array(z.url()).optional(),
  color: z.string().nullish(),
  material: z.string().nullish(),
  dimensionsText: z.string().nullish(),
  sourcePayload: z.unknown().optional()
});

const categoryMap = new Map<string, string>([
  ["sofa", "sofas"],
  ["sofas", "sofas"],
  ["armchair", "armchairs"],
  ["chair", "chairs"],
  ["coffee table", "coffee_tables"],
  ["side table", "side_tables"],
  ["bed", "beds"],
  ["rug", "rugs"],
  ["carpet", "rugs"],
  ["dining table", "dining_tables"],
  ["console", "consoles"],
  ["lighting", "lighting"],
  ["lamp", "lighting"],
  ["mirror", "mirrors"]
]);

export function normalizeProductCandidate(input: RawProductCandidate): NormalizedProductRecord {
  const parsed = rawProductSchema.parse(input);
  const price = parseAedPrice(parsed.priceText ?? null);
  const salePrice = parseAedPrice(parsed.salePriceText ?? null);
  const dimensions = parseDimensionsCm(parsed.dimensionsText ?? null);
  const imageUrls = dedupe([
    parsed.primaryImageUrl ?? undefined,
    ...(parsed.imageUrls ?? [])
  ].filter(Boolean) as string[]);

  return {
    product: {
      canonical_url: parsed.canonicalUrl,
      name: normalizeWhitespace(parsed.name),
      description: nullableText(parsed.description),
      external_sku: nullableText(parsed.externalSku),
      category_raw: nullableText(parsed.retailerCategory),
      category_normalized: normalizeCategory(parsed.retailerCategory ?? parsed.name),
      price_aed: price,
      sale_price_aed: salePrice,
      currency: normalizeCurrency(parsed.currency, parsed.priceText, parsed.salePriceText),
      availability: nullableText(parsed.availability),
      primary_image_url: imageUrls[0] ?? null,
      color: nullableText(parsed.color),
      material: nullableText(parsed.material),
      style_tags: [],
      room_tags: [],
      data_confidence: confidenceForProduct(parsed, price, imageUrls),
      last_checked_at: new Date().toISOString()
    },
    dimensions: dimensions
      ? {
          ...dimensions,
          source_text: parsed.dimensionsText ?? null,
          confidence: "verified"
        }
      : null,
    images: imageUrls.map((imageUrl, index) => ({
      image_url: imageUrl,
      sort_order: index,
      alt_text: parsed.name,
      source: "retailer"
    }))
  };
}

export function parseAedPrice(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/,/g, "").replace(/\s+/g, " ");
  const match = normalized.match(/(\d+(?:\.\d{1,2})?)/);
  return match ? Number(match[1]) : null;
}

export function normalizeCurrency(...values: Array<string | null | undefined>) {
  const joined = values.filter(Boolean).join(" ").toUpperCase();

  if (joined.includes("AED") || joined.includes("د.إ") || joined.includes("DHS")) {
    return "AED";
  }

  return "AED";
}

export function normalizeCategory(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const lower = value.toLowerCase();
  for (const [needle, normalized] of categoryMap) {
    if (lower.includes(needle)) {
      return normalized;
    }
  }

  return null;
}

export function parseDimensionsCm(value: string | null): {
  width_cm: number | null;
  depth_cm: number | null;
  height_cm: number | null;
  diameter_cm: number | null;
} | null {
  if (!value) {
    return null;
  }

  const lower = value.toLowerCase();
  const unitMultiplier = lower.includes("mm") ? 0.1 : lower.includes("inch") || lower.includes(" in") ? 2.54 : 1;
  const labeled = {
    width_cm: matchLabeledDimension(lower, ["w", "width"]) ?? null,
    depth_cm: matchLabeledDimension(lower, ["d", "depth"]) ?? null,
    height_cm: matchLabeledDimension(lower, ["h", "height"]) ?? null,
    diameter_cm: matchLabeledDimension(lower, ["dia", "diameter"]) ?? null
  };

  if (Object.values(labeled).some((dimension) => dimension !== null)) {
    return multiplyDimensions(labeled, unitMultiplier);
  }

  const numbers = lower.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (numbers.length >= 3) {
    return multiplyDimensions(
      {
        width_cm: numbers[0],
        depth_cm: numbers[1],
        height_cm: numbers[2],
        diameter_cm: null
      },
      unitMultiplier
    );
  }

  return null;
}

function matchLabeledDimension(value: string, labels: string[]) {
  for (const label of labels) {
    const match = value.match(new RegExp(`${label}\\s*[:x-]?\\s*(\\d+(?:\\.\\d+)?)`));
    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  return undefined;
}

function multiplyDimensions(
  dimensions: {
    width_cm: number | null;
    depth_cm: number | null;
    height_cm: number | null;
    diameter_cm: number | null;
  },
  multiplier: number
) {
  return Object.fromEntries(
    Object.entries(dimensions).map(([key, value]) => [
      key,
      value === null ? null : Number((value * multiplier).toFixed(2))
    ])
  ) as typeof dimensions;
}

function confidenceForProduct(
  product: z.infer<typeof rawProductSchema>,
  price: number | null,
  images: string[]
) {
  if (price !== null && images.length > 0 && product.primaryImageUrl) {
    return "verified";
  }

  if (price !== null || images.length > 0) {
    return "estimated";
  }

  return "unknown";
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function nullableText(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}
