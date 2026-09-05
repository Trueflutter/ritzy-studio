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
  ["armchair", "armchairs"],
  ["armchairs", "armchairs"],
  ["recliner", "armchairs"],
  ["recliners", "armchairs"],
  ["sofa & seating > armchairs", "armchairs"],
  ["living chair", "armchairs"],
  ["coffee table", "coffee_tables"],
  ["coffeetable", "coffee_tables"],
  ["side & end", "side_tables"],
  ["side and end", "side_tables"],
  ["side table", "side_tables"],
  ["lamp table", "side_tables"],
  ["end table", "side_tables"],
  ["night stand", "side_tables"],
  ["nightstand", "side_tables"],
  ["sideandendtable", "side_tables"],
  ["table and desk lamp", "lighting"],
  ["table & desk lamp", "lighting"],
  ["desk lamp", "lighting"],
  ["chandelier", "lighting"],
  ["pendant", "lighting"],
  ["lighting", "lighting"],
  ["lamp", "lighting"],
  ["lamps", "lighting"],
  ["office chair", "office_chairs"],
  ["task chair", "office_chairs"],
  ["desk chair", "office_chairs"],
  ["office desk", "desks"],
  ["smart desk", "desks"],
  ["desk", "desks"],
  ["chair", "chairs"],
  ["chairs", "chairs"],
  ["chairs and benches", "chairs"],
  ["dining seating", "chairs"],
  ["dining chair", "chairs"],
  ["sofa", "sofas"],
  ["sofas", "sofas"],
  ["ottoman", "decor"],
  ["pouf", "decor"],
  ["rug", "rugs"],
  ["rugs", "rugs"],
  ["carpet", "rugs"],
  ["dining table", "dining_tables"],
  ["tv and media", "storage"],
  ["tv unit", "storage"],
  ["media unit", "storage"],
  ["bookcase", "storage"],
  ["bookcases", "storage"],
  ["shelving unit", "storage"],
  ["dresser", "storage"],
  ["storage", "storage"],
  ["cabinet", "storage"],
  ["sideboard", "storage"],
  ["credenza", "storage"],
  ["buffet", "storage"],
  ["console", "storage"],
  ["> mirrors", "mirrors"],
  ["floor mirror", "mirrors"],
  ["wall mirror", "mirrors"],
  ["leaner mirror", "mirrors"],
  ["wall art", "wall_art"],
  ["wallart", "wall_art"],
  ["wall decor", "wall_art"],
  ["wall décor", "wall_art"],
  ["wall accent", "wall_art"],
  ["photo frame", "wall_art"],
  ["mirror", "mirrors"],
  ["decorative cushion", "decor"],
  ["cushion", "decor"],
  ["vase", "decor"],
  ["decor", "decor"],
  ["décor", "decor"],

  // Danube Home's accessory and lighting tree, 2026-09-05. 433 usable products
  // sat uncategorised because these labels had no needle, and they are exactly
  // the styling stock a finished room needs: decor was the thinnest category in
  // the catalogue at 111 products while 233 candle holders, figurines, bowls,
  // trays, clocks and lanterns were invisible to every role query.
  //
  // Appended deliberately. Matching is first-needle-wins over insertion order,
  // so a "Candle Chandelier" still resolves to lighting on the earlier
  // "chandelier" needle rather than to decor on "candle" here.
  // "wall light" leads the block on purpose: a candle-styled sconce is a light,
  // and first-needle-wins means the SPECIFIC needle has to precede the general
  // one it would otherwise lose to. The comment below used to reason correctly
  // about "Candle Chandeliers" (chandelier sits earlier in the map, so lighting
  // wins) and then this very block reintroduced the same bug one line down, by
  // appending "wall light" after "candle" and "lantern". Codex caught it on
  // PR #336. The ordering is pinned by test.
  ["wall light", "lighting"],
  ["candle", "decor"],
  ["lantern", "decor"],
  ["figurine", "decor"],
  ["clock", "decor"],
  ["bowls and tray", "decor"],
  ["chest of drawer", "storage"],
  ["shoe rack", "storage"],
  ["serving trolley", "storage"],

  // "bed" goes LAST, because it is three letters that appear inside bedroom,
  // bedside, bedding and sofa bed, and first-needle-wins made it beat every
  // more specific needle placed after it. That is not hypothetical: 52
  // chandeliers and table lamps under "Bedroom Chandeliers" and 28 dressers
  // under "Bedroom > Dressers" were all filed as beds, so a bed-role query
  // answered with lighting and storage. It only wins now when nothing more
  // specific does, which is the job a needle this general should have.
  ["bed", "beds"]

  // NOT mapped, on purpose:
  //   Dining sets (59). A "6-Seater Dining Set" is a table and its chairs sold
  //   as one line. The dining blueprint carries a dining_tables role AND a
  //   chairs role, so mapping sets to either fills one role and leaves the
  //   other to buy the same chairs again. Sourcing has no concept of a product
  //   satisfying two roles at once; until it does, a visible double-buy is
  //   worse than 59 invisible products.
  //   Down/panel/spot/fan lights (7) and garden lights (1). Architectural and
  //   outdoor fixtures, not furnishing. Mapping them to lighting would let a
  //   recessed downlight fill a "floor or table lighting" role, which is the
  //   chandelier-for-a-floor-lamp failure the sourcing contracts exist to stop.
  //   Kitchen trolleys (4), bathmats (1), kids accessories (1).
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
      // The retailer's own category first, then the NAME as a fallback. Danube
      // files some stock under a collection path ("Furniture > Modular >
      // Modular Living > Brayden") that names the range rather than the object,
      // and `retailerCategory ?? name` never consulted the name when a category
      // was present, so seven "Brayden Tall Bookcase" rows stayed uncategorised
      // while the word bookcase sat in every one of their names.
      category_normalized: categoryFor(parsed.retailerCategory, parsed.name),
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
          confidence: "estimated"
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

// Labels we RECOGNISE and deliberately decline to map. This is not the same as
// a category we simply do not know, and the difference decides whether the name
// fallback runs: that fallback exists for an UNINFORMATIVE retailer category (a
// collection path like "Furniture > Modular > Modular Living > Brayden"), never
// to overturn an exclusion made on purpose.
//
// Without this, the fallback quietly undid the dining-set decision. "Bavaria
// 1+2 High Dining Table Set" resolved to dining_tables on the words "dining
// table" in its name, and "Derin 1+8-Seater Dining Set with Swivel Chair"
// resolved to chairs on the word "chair" — a table-and-eight-chairs set filed
// as a chairs row, which is the double-buy the exclusion exists to prevent.
const deliberatelyUnmapped = [
  "dining set",
  // "Bavaria 1+2 High Dining Table Set" does not contain "dining set". Naming a
  // set is not consistent enough to catch with one needle, and the exclusion is
  // only worth having if it holds for the names it will actually meet.
  // Deliberately NOT a bare "table set": "Dott Sintered Stone Top Coffee Table
  // - Set of 2" is a nest of tables, one purchase filling one role, and
  // excluding that would lose real stock for no reason.
  "dining table set",
  "down light",
  "panel light",
  "spot light",
  "fan light",
  "garden light",
  "kitchen trolley",
  "bathmat",
  "kids accessor"
];

export function isDeliberatelyUnmappedCategory(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const lower = value.toLowerCase().replace(/&/g, "and").replace(/[-_]/g, " ").replace(/\s+/g, " ");
  return deliberatelyUnmapped.some((needle) => lower.includes(needle));
}

// The category a product should carry, from the best text available: the
// retailer's own category when it resolves, otherwise the product name, unless
// the retailer's category is one we recognise and decline to map.
export function categoryFor(retailerCategory: string | null | undefined, name: string): string | null {
  const fromCategory = normalizeCategory(retailerCategory);
  if (fromCategory) {
    return fromCategory;
  }

  // The exclusion has to hold however we reach the name. Guarding only the
  // retailer category left the whole rule bypassable by a product that HAS no
  // retailer category: `categoryFor(null, "Derin 1+8-Seater Dining Set with
  // Swivel Chair")` returned `chairs`, which is the double-buy the exclusion
  // exists to prevent, arrived at by a different road. Codex caught it on
  // PR #336.
  if (isDeliberatelyUnmappedCategory(retailerCategory) || isDeliberatelyUnmappedCategory(name)) {
    return null;
  }
  return normalizeCategory(name);
}

export function normalizeCategory(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const lower = value.toLowerCase().replace(/&/g, "and").replace(/[-_]/g, " ").replace(/\s+/g, " ");
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

  const hasDimensionSignal =
    /\b(cm|mm|inch|in)\b/.test(lower) || /\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?/.test(lower);

  if (!hasDimensionSignal) {
    return null;
  }

  const numbers = lower.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const hasExplicitJoiner = /\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?/.test(lower);

  if (hasExplicitJoiner && numbers.length >= 2) {
    return multiplyDimensions(
      {
        width_cm: numbers[0],
        depth_cm: numbers[1],
        height_cm: numbers[2] ?? null,
        diameter_cm: null
      },
      unitMultiplier
    );
  }

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
