import type { CatalogAdapter, ProductDiscoveryResult, RawProductCandidate } from "../types";

const BASE_URL = "https://www.danubehome.com";
const DEFAULT_CATEGORY_URLS = [
  "https://www.danubehome.com/ae/en/c/furniture/sofas",
  "https://www.danubehome.com/ae/en/c/furniture/sofas/sofa-beds",
  "https://www.danubehome.com/ae/en/c/furniture/sofas/day-bed",
  "https://www.danubehome.com/ae/en/c/furniture/sofas/recliners",
  "https://www.danubehome.com/ae/en/c/furniture/seating/chairs-stools/chairs/accent-chair",
  "https://www.danubehome.com/ae/en/c/furniture/seating/chairs",
  "https://www.danubehome.com/ae/en/c/furniture/seating/rocking-chairs",
  "https://www.danubehome.com/ae/en/c/furniture/living-room-furniture/coffee-tables",
  "https://www.danubehome.com/ae/en/c/furniture/living-room-furniture/end-tables",
  "https://www.danubehome.com/ae/en/c/furniture/living-room-furniture/tv-media-units",
  "https://www.danubehome.com/ae/en/c/furniture/living-room-furniture/book-cases-cabinets",
  "https://www.danubehome.com/ae/en/c/furniture/dining",
  "https://www.danubehome.com/ae/en/c/furniture/dining/dining-table-set",
  "https://www.danubehome.com/ae/en/c/furniture/dining/dining-tables",
  "https://www.danubehome.com/ae/en/c/furniture/dining/dining-chairs",
  "https://www.danubehome.com/ae/en/c/furniture/dining/cabinets-sideboards",
  "https://www.danubehome.com/ae/en/c/furniture/dining/serving-trolleys",
  "https://www.danubehome.com/ae/en/c/furniture/bedroom-furniture/fabric-beds",
  "https://www.danubehome.com/ae/en/c/furniture/bedroom-furniture/beds/super-king-size-beds",
  "https://www.danubehome.com/ae/en/c/furniture/bedroom-furniture/beds/king-size-beds",
  "https://www.danubehome.com/ae/en/c/furniture/bedroom-furniture/beds/queen-size-beds",
  "https://www.danubehome.com/ae/en/c/furniture/bedroom-furniture/beds/single-beds",
  "https://www.danubehome.com/ae/en/c/furniture/bedroom-storage/bedside-tables",
  "https://www.danubehome.com/ae/en/c/furniture/bedroom-storage/chest-of-drawers",
  "https://www.danubehome.com/ae/en/c/furniture/office-furniture",
  "https://www.danubehome.com/ae/en/c/furniture/office-furniture/desks-tables",
  "https://www.danubehome.com/ae/en/c/furniture/office-furniture/office-chairs",
  "https://www.danubehome.com/ae/en/c/furniture/office-furniture/storage-cabinets",
  "https://www.danubehome.com/ae/en/c/furniture/office-furniture/office-sofas",
  "https://www.danubehome.com/ae/en/c/furnishings/floor-covering/extra-large-rugs",
  "https://www.danubehome.com/ae/en/c/furnishings/floor-covering/carpets-rugs/large",
  "https://www.danubehome.com/ae/en/c/furnishings/floor-covering/regular-rugs",
  "https://www.danubehome.com/ae/en/c/furnishings/floor-covering/carpets-rugs/small",
  "https://www.danubehome.com/ae/en/c/furnishings/floor-covering/runner-rugs",
  "https://www.danubehome.com/ae/en/c/lighting",
  "https://www.danubehome.com/ae/en/c/lighting/lighting-by-type/chandeliers",
  "https://www.danubehome.com/ae/en/c/lighting/lighting-by-type/pendants",
  "https://www.danubehome.com/ae/en/c/lighting/lighting-by-type/table-lamps",
  "https://www.danubehome.com/ae/en/c/lighting/lighting-by-type/floor-lamps",
  "https://www.danubehome.com/ae/en/c/lighting/lighting-by-type/wall-lamps",
  "https://www.danubehome.com/ae/en/c/home-decor/wall-decor/mirrors",
  "https://www.danubehome.com/ae/en/c/home-decor/wall-decor/wall-clocks",
  "https://www.danubehome.com/ae/en/c/home-decor/wall-decor/photo-frames",
  "https://www.danubehome.com/ae/en/c/home-decor/wall-decor/wall-decorations",
  "https://www.danubehome.com/ae/en/c/home-decor/home-accessories/vases",
  "https://www.danubehome.com/ae/en/c/home-decor/home-accessories/candle-holders",
  "https://www.danubehome.com/ae/en/c/home-decor/home-accessories/lanterns",
  "https://www.danubehome.com/ae/en/c/home-decor/home-accessories/accents-and-sculptures",
  "https://www.danubehome.com/ae/en/c/home-decor/home-accessories/decorative-bowls-and-tray"
];

const cache = new Map<string, string>();
let lastFetchAt = 0;
const FETCH_TIMEOUT_MS = 20_000;

export const danubeAdapter: CatalogAdapter = {
  key: "danubehome-ae",
  retailer: {
    name: "Danube Home",
    domain: "www.danubehome.com",
    country: "AE",
    adapterKey: "danubehome-ae",
    status: "candidate",
    robotsNotes:
      "robots.txt allows public category/product pages while disallowing account, cart, checkout, search, and parameter/filter URLs.",
    termsNotes:
      "No official feed confirmed for MVP. Adapter uses public category/product pages with schema.org Product markup and light rate limiting."
  },
  getComplianceNotes: () => ({
    robotsNotes:
      "robots.txt disallows cart, checkout, account, search, and parameterized filter URLs; sampled public /ae/en/c and /ae/en/p pages are reachable.",
    termsNotes:
      "Use clean category/product URLs only. Prefer approved feed or trade access for long-term retailer partnership."
  }),
  discoverProducts: async function* ({ limit, categories } = {}) {
    const categoryUrls = categories?.length ? categories : DEFAULT_CATEGORY_URLS;
    const seenUrls = new Set<string>();
    let yielded = 0;

    for (const categoryUrl of categoryUrls) {
      const html = await fetchText(categoryUrl);
      for (const url of parseDanubeProductUrls(html)) {
        if (seenUrls.has(url)) {
          continue;
        }
        seenUrls.add(url);

        yield { url, categoryHint: categoryUrl, source: "category_page" };
        yielded += 1;

        if (limit && yielded >= limit) {
          return;
        }
      }
    }
  },
  extractProduct: async (discovery) =>
    parseDanubeProductHtml(await fetchText(discovery.url), discovery.url, discovery.categoryHint)
};

export function parseDanubeProductUrls(html: string) {
  const urls = new Set<string>();

  for (const match of html.matchAll(/href="(\/ae\/en\/p\/[^"#?]+)"/g)) {
    const path = decodeHtml(match[1] ?? "");
    if (isLikelyProductPath(path)) {
      urls.add(toAbsoluteUrl(path));
    }
  }

  return Array.from(urls);
}

export function parseDanubeProductHtml(
  html: string,
  fallbackUrl: string,
  categoryHint?: string
): RawProductCandidate {
  const product = extractJsonLdProducts(html)[0] ?? {};
  const offers = isRecord(product.offers) ? product.offers : {};
  const canonicalUrl = asString(product.url) ?? metaContent(html, "twitter:url") ?? fallbackUrl;
  const images = imageValues(product.image);
  const color = asString(product.color) ?? extractAttributeValue(html, "Colour") ?? extractAttributeValue(html, "Color Family");
  const material =
    asString(product.material) ??
    extractAttributeValue(html, "Upholstery") ??
    extractAttributeValue(html, "Material") ??
    extractAttributeValue(html, "Primary Material") ??
    extractAttributeValue(html, "Frame Material");
  const length = extractAttributeValue(html, "Length (cm)");
  const width = extractAttributeValue(html, "Width (cm)");
  const height = extractAttributeValue(html, "Height (cm)");

  return {
    canonicalUrl: toAbsoluteUrl(canonicalUrl),
    name: asString(product.name) ?? metaContent(html, "twitter:title") ?? "Untitled product",
    retailerCategory: asString(product.category) ?? categoryHint ?? null,
    description: stripHtml(asString(product.description) ?? metaContent(html, "description") ?? null),
    externalSku: extractProductSku(canonicalUrl),
    priceText: asString(offers.price) ?? null,
    salePriceText: null,
    currency: asString(offers.priceCurrency) ?? "AED",
    availability: normalizeAvailability(asString(offers.availability), html) ?? null,
    primaryImageUrl: images[0] ?? metaContent(html, "twitter:image") ?? null,
    imageUrls: images,
    color: color ?? null,
    material: material ?? null,
    dimensionsText: dimensionsText({ length, width, height })
  };
}

async function fetchText(url: string) {
  if (cache.has(url)) {
    return cache.get(url) as string;
  }

  const elapsed = Date.now() - lastFetchAt;
  if (elapsed < 500) {
    await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        "user-agent": "RitzyStudioBot/0.1 (+https://ritzy-studio.local; light catalog ingestion)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Danube Home fetch timed out for ${url}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    lastFetchAt = Date.now();
  }

  if (!response.ok) {
    throw new Error(`Danube Home fetch failed ${response.status} for ${url}`);
  }

  const text = await response.text();
  cache.set(url, text);
  return text;
}

function extractJsonLdProducts(html: string): Array<Record<string, unknown>> {
  const products: Array<Record<string, unknown>> = [];

  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      collectProducts(JSON.parse(decodeHtml(match[1] ?? "").trim()), products);
    } catch {
      continue;
    }
  }

  return products;
}

function collectProducts(value: unknown, products: Array<Record<string, unknown>>) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectProducts(item, products));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (value["@type"] === "Product") {
    products.push(value);
  }

  collectProducts(value.mainEntity, products);
  collectProducts(value["@graph"], products);
  const itemList = value.itemListElement;
  if (Array.isArray(itemList)) {
    itemList.forEach((item) => collectProducts(isRecord(item) ? item.item ?? item : item, products));
  }
}

function imageValues(value: unknown) {
  return Array.isArray(value)
    ? (value.map(asString).filter(Boolean) as string[])
    : asString(value)
      ? [asString(value) as string]
      : [];
}

function extractAttributeValue(html: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const pattern = new RegExp(
    `<label>${escapedLabel}<\\/label>[\\s\\S]{0,180}?ProductInfo_informationDetailsList__[A-Za-z0-9_]+\\">([^<]+)<\\/div>`,
    "i"
  );
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1]).trim() : null;
}

function metaContent(html: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    html.match(new RegExp(`<meta\\s+name="${escapedName}"\\s+content="([^"]*)"`, "i"))?.[1] ??
    html.match(new RegExp(`<meta\\s+property="${escapedName}"\\s+content="([^"]*)"`, "i"))?.[1] ??
    null
  );
}

function normalizeAvailability(value: string | undefined, html: string) {
  if (html.includes("ProductActionStyle_outOfStock") || html.includes(">Out Of Stock<")) {
    return "out of stock";
  }

  if (!value) {
    return undefined;
  }

  const lower = value.toLowerCase();
  if (lower.includes("instock") || lower.includes("in stock")) {
    return "in stock";
  }
  if (lower.includes("outofstock") || lower.includes("out of stock")) {
    return "out of stock";
  }

  return value;
}

function dimensionsText({
  length,
  width,
  height
}: {
  length: string | null;
  width: string | null;
  height: string | null;
}) {
  if (!length && !width && !height) {
    return null;
  }

  return [
    length ? `W ${length}` : null,
    width ? `D ${width}` : null,
    height ? `H ${height}` : null
  ]
    .filter(Boolean)
    .join(" x ")
    .concat(" cm");
}

function extractProductSku(url: string) {
  return url.match(/-(\d{8,})(?:$|[/?#])/)?.[1] ?? null;
}

function isLikelyProductPath(path: string) {
  return path.startsWith("/ae/en/p/") && !path.includes("gift-card") && /-\d{8,}$/.test(path);
}

function toAbsoluteUrl(url: string) {
  if (url.startsWith("http")) {
    return url;
  }

  return new URL(url, BASE_URL).toString();
}

function stripHtml(value: string | null) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || null;
}

function asString(value: unknown) {
  if (typeof value === "number") {
    return String(value);
  }

  return typeof value === "string" && value.trim() ? decodeHtml(value.trim()) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
