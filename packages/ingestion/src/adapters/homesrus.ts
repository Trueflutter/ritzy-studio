import type { CatalogAdapter, ProductDiscoveryResult, RawProductCandidate } from "../types";

const BASE_URL = "https://www.homesrus.ae";
const PRODUCT_URL_PATTERN = /^https:\/\/www\.homesrus\.ae\/en\/\d{10,}[-a-z0-9]+\/$/;
const MAX_DEFAULT_DISCOVERIES = 3;
const MAX_DISCOVERIES = 6;
const CRAWL_DELAY_MS = 10_000;
const DEFAULT_CATEGORY_URLS = [
  "https://www.homesrus.ae/en/furniture/sofas-chairs/sofa/",
  "https://www.homesrus.ae/en/furniture/dining/dining-table/",
  "https://www.homesrus.ae/en/furniture/bedroom/bedside-tables/",
  "https://www.homesrus.ae/en/household/decor-and-furnishings/floor-coverings/rugs-carpets/"
];
const ROBOTS_NOTES =
  "robots.txt is available at /robots.txt with browser-style headers; it declares Crawl-delay: 10, disallows all query/parameter URLs via *?*=*, and disallows /catalog/ plus checkout, customer, search, sendfriend, review, vendor, and SID paths. Adapter uses only clean /en/ category and product URLs.";
const TERMS_NOTES =
  "No official Homes r Us feed confirmed. Treat as controlled dry-run-only coverage using a tiny clean category seed set at Crawl-delay: 10; prefer approved feed/partner access before live writes.";

const cache = new Map<string, string>();
let lastFetchAt = 0;

export const homesRusAdapter: CatalogAdapter = {
  key: "homesrus-ae",
  dryRunOnly: true,
  retailer: {
    name: "Homes r Us",
    domain: "www.homesrus.ae",
    country: "AE",
    adapterKey: "homesrus-ae",
    status: "candidate",
    robotsNotes: ROBOTS_NOTES,
    termsNotes: TERMS_NOTES
  },
  getComplianceNotes: () => ({
    robotsNotes: ROBOTS_NOTES,
    termsNotes: TERMS_NOTES
  }),
  discoverProducts: async function* ({ limit, categories } = {}) {
    const categoryUrls = categories?.length ? categories : DEFAULT_CATEGORY_URLS;
    const discoveryLimit = Math.min(limit ?? MAX_DEFAULT_DISCOVERIES, MAX_DISCOVERIES);
    const seenUrls = new Set<string>();
    let yielded = 0;

    for (const categoryUrl of categoryUrls) {
      if (!isCleanHomesRusCategoryUrl(categoryUrl)) {
        continue;
      }

      const html = await fetchText(categoryUrl);
      for (const url of parseHomesRusProductUrls(html)) {
        if (seenUrls.has(url)) {
          continue;
        }

        seenUrls.add(url);
        yield {
          url,
          categoryHint: inferHomesRusCategory(categoryUrl),
          source: "category_page",
          sourcePayload: {
            seedCategoryUrl: categoryUrl,
            sourceFreshnessTimestamp: new Date().toISOString()
          }
        };
        yielded += 1;
        if (yielded >= discoveryLimit) return;
      }
    }
  },
  extractProduct: async (discovery) => {
    if (!isCleanHomesRusProductUrl(discovery.url)) {
      throw new Error(`Homes r Us discovery URL is not a clean product URL: ${discovery.url}`);
    }

    return parseHomesRusProductHtml(await fetchText(discovery.url), discovery.url, discovery.categoryHint, discovery.sourcePayload);
  }
};

export function parseHomesRusProductUrls(html: string) {
  return unique(Array.from(html.matchAll(/https:\/\/www\.homesrus\.ae\/en\/\d{10,}[-a-z0-9]+\/?/g), (match) => {
    const url = match[0].endsWith("/") ? match[0] : `${match[0]}/`;
    return isCleanHomesRusProductUrl(url) ? url : null;
  }));
}

export function parseHomesRusProductHtml(
  html: string,
  fallbackUrl: string,
  categoryHint?: string,
  sourcePayload?: unknown
): RawProductCandidate {
  const structuredProduct = parseStructuredProduct(html);
  const gtagItem = parseGtagItem(html);
  const canonicalCandidate = normalizeHomesRusUrl(
    matchContent(html, /<link\s+[^>]*rel="canonical"[^>]*href="([^"]+)"/i) ?? fallbackUrl
  );
  const canonicalUrl = isCleanHomesRusProductUrl(canonicalCandidate) ? canonicalCandidate : fallbackUrl;
  const name =
    structuredProduct?.name ??
    gtagItem?.item_name ??
    matchContent(html, /<h1[^>]*>\s*<span[^>]*>\s*([^<]+)\s*<\/span>/i) ??
    matchContent(html, /<title>\s*([^<|]+)(?:\||<\/title>)/i) ??
    "Untitled Homes r Us product";
  const sku = structuredProduct?.sku ?? gtagItem?.item_sku ?? skuFromUrl(fallbackUrl);
  const finalPrice =
    structuredProduct?.offers?.price?.toString() ??
    stringifyPrice(gtagItem?.price) ??
    matchContent(html, /data-price-amount="(\d+(?:\.\d+)?)"[^>]*data-price-type="finalPrice"/i);
  const regularPrice =
    stringifyPrice(gtagItem?.item_original_price) ??
    matchContent(html, /data-price-amount="(\d+(?:\.\d+)?)"[^>]*data-price-type="oldPrice"/i);
  const imageUrls = unique(
    [decodeHtml(structuredProduct?.image ?? ""), decodeEscapedUrl(gtagItem?.item_image ?? ""), matchContent(html, /<meta\s+property="og:image"\s+content="([^"]+)"/i)]
      .map(stripImageQuery)
      .filter((url) => !url.includes("/media/logo/"))
  );
  const attributes = parseHomesRusAttributes(html);

  return {
    canonicalUrl,
    name: decodeHtml(name),
    retailerCategory: categoryHint ?? gtagItem?.item_category3 ?? inferHomesRusCategory(fallbackUrl),
    description: stripHtml(structuredProduct?.description ?? matchContent(html, /<meta name="description" content="([^"]+)"/i)),
    externalSku: sku,
    priceText: regularPrice ?? finalPrice ?? null,
    salePriceText: regularPrice && finalPrice && Number(regularPrice) > Number(finalPrice) ? finalPrice : null,
    currency: "AED",
    availability: parseAvailability(structuredProduct?.offers?.availability, gtagItem?.item_in_stock),
    primaryImageUrl: imageUrls[0] ?? null,
    imageUrls,
    color: attributes.color ?? colorFromName(name),
    material: attributes.material,
    dimensionsText: attributes.dimensionsText ?? dimensionsFromText(`${name} ${fallbackUrl}`),
    sourcePayload: {
      source: "homesrus",
      sourceFreshnessTimestamp: extractSourceFreshness(sourcePayload),
      seedCategoryUrl: extractSeedCategoryUrl(sourcePayload),
      robotsNotes: ROBOTS_NOTES,
      attributes
    }
  };
}

export function isCleanHomesRusCategoryUrl(url: string) {
  return isCleanHomesRusPublicUrl(url) && !isCleanHomesRusProductUrl(url) && url.startsWith(`${BASE_URL}/en/`);
}

export function isCleanHomesRusProductUrl(url: string) {
  return isCleanHomesRusPublicUrl(url) && PRODUCT_URL_PATTERN.test(url);
}

function isCleanHomesRusPublicUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== BASE_URL || parsed.search || parsed.hash) return false;
    if (!parsed.pathname.startsWith("/en/")) return false;
    if (
      parsed.pathname.includes("/catalog/") ||
      parsed.pathname.includes("/checkout/") ||
      parsed.pathname.includes("/customer/") ||
      parsed.pathname.includes("/catalogsearch/") ||
      parsed.pathname.includes("/sendfriend/") ||
      parsed.pathname.includes("/review/") ||
      parsed.pathname.includes("/rest/") ||
      parsed.pathname.includes("/api/")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function parseStructuredProduct(html: string) {
  for (const json of Array.from(html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi), (match) =>
    safeJsonParse<StructuredProduct>(decodeHtml(match[1].trim()))
  )) {
    if (json?.["@type"] === "Product" || (Array.isArray(json?.["@type"]) && json["@type"].includes("Product"))) {
      return json;
    }
  }
  return null;
}

function parseGtagItem(html: string) {
  const match = html.match(/gEvent\('event',\s*'view_item',\s*(\{[\s\S]*?"items":\s*\[[\s\S]*?\][\s\S]*?\})\);/);
  const parsed = safeJsonParse<{ items?: GtagItem[] }>(match?.[1] ?? null);
  return parsed?.items?.[0] ?? null;
}

function parseHomesRusAttributes(html: string) {
  const text = stripHtml(
    matchContent(html, /<ul class="product-attribute-list"[^>]*>([\s\S]*?)<\/ul>/i) ??
      matchContent(html, /Product Specifications:\s*([\s\S]*?)Estimated delivery/i)
  );

  return {
    color: matchAttributeText(text, /(?:^|\s)Color:\s*([^:]+?)(?=\s+[A-Z][A-Za-z /()]+:|$)/i),
    material:
      matchAttributeText(text, /Primary material:\s*([^:]+?)(?=\s+[A-Z][A-Za-z /()]+:|$)/i) ??
      matchAttributeText(text, /Material:\s*([^:]+?)(?=\s+[A-Z][A-Za-z /()]+:|$)/i),
    fabric: matchAttributeText(text, /Fabric:\s*([^:]+?)(?=\s+[A-Z][A-Za-z /()]+:|$)/i),
    dimensionsText: dimensionsFromAttributeText(text)
  };
}

async function fetchText(url: string) {
  if (cache.has(url)) return cache.get(url) as string;

  const elapsed = Date.now() - lastFetchAt;
  if (elapsed < CRAWL_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, CRAWL_DELAY_MS - elapsed));
  }

  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9"
    },
    signal: AbortSignal.timeout(25000)
  });
  lastFetchAt = Date.now();

  if (!response.ok) throw new Error(`Homes r Us fetch failed ${response.status} for ${url}`);
  const text = await response.text();
  cache.set(url, text);
  return text;
}

function inferHomesRusCategory(url: string) {
  const path = new URL(url).pathname;
  if (/sofa|armchair|living|coffee-side-table|entertainment-unit/.test(path)) return "living room";
  if (/dining|buffet|hutch/.test(path)) return "dining";
  if (/bedroom|beds|bedside|dresser|wardrobe|chest-of-drawers/.test(path)) return "bedroom";
  if (/home-office|desk|bookcase/.test(path)) return "home office";
  if (/rug|carpet|floor-covering/.test(path)) return "rugs/floor covering";
  if (/lighting|lamp|chandelier/.test(path)) return "lighting";
  if (/mirror|wall-decor|framed-artwork/.test(path)) return "mirrors/wall decor";
  if (/curtain|cushion|throws/.test(path)) return "soft furnishing";
  if (/storage|decor|vase|basket/.test(path)) return "storage/decor";
  return "Homes r Us category";
}

function parseAvailability(schemaAvailability?: string, itemInStock?: boolean) {
  if (schemaAvailability?.includes("InStock") || itemInStock === true) return "in stock";
  if (schemaAvailability?.includes("OutOfStock") || itemInStock === false) return "out of stock";
  return null;
}

function dimensionsFromAttributeText(text: string | null) {
  if (!text) return null;
  const length = matchAttributeText(text, /Item Length:\s*([^:]+?)(?=\s+[A-Z][A-Za-z /()]+:|$)/i);
  const depth = matchAttributeText(text, /Item Width\/Depth:\s*([^:]+?)(?=\s+[A-Z][A-Za-z /()]+:|$)/i);
  const height = matchAttributeText(text, /Item Height:\s*([^:]+?)(?=\s+[A-Z][A-Za-z /()]+:|$)/i);
  if (length || depth || height) {
    return [length, depth, height].filter(Boolean).join(" x ");
  }
  return dimensionsFromText(text);
}

function dimensionsFromText(text: string) {
  const match = text.match(/(?:^|[-\s])(\d{1,3})\s*x\s*(\d{1,3})(?:\s*x\s*(\d{1,3}))?\s*(?:cm|cms)?(?:[-/\s]|$)/i);
  return match ? [match[1], match[2], match[3]].filter(Boolean).join(" x ") + " cm" : null;
}

function colorFromName(name: string) {
  const match = name.match(/,\s*([A-Za-z &/-]+)$/);
  return match ? titleCase(match[1].replace(/\s+/g, " ").trim()) : null;
}

function skuFromUrl(url: string) {
  return new URL(url).pathname.match(/\/en\/(\d{10,})-/)?.[1] ?? null;
}

function normalizeHomesRusUrl(url: string) {
  const parsed = new URL(decodeEscapedUrl(url));
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function extractSourceFreshness(value: unknown) {
  return typeof value === "object" && value && "sourceFreshnessTimestamp" in value
    ? String(value.sourceFreshnessTimestamp)
    : null;
}

function extractSeedCategoryUrl(value: unknown) {
  return typeof value === "object" && value && "seedCategoryUrl" in value ? String(value.seedCategoryUrl) : null;
}

function matchAttributeText(text: string | null, regex: RegExp) {
  return text?.match(regex)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
}

function matchContent(value: string, regex: RegExp) {
  return value.match(regex)?.[1] ?? null;
}

function stringifyPrice(value: unknown) {
  if (typeof value === "number") return value.toString();
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function stripImageQuery(url: string | null | undefined) {
  if (!url) return "";
  const parsed = new URL(url);
  parsed.search = "";
  return parsed.toString();
}

function decodeEscapedUrl(value: string) {
  return decodeHtml(value.replace(/\\\//g, "/"));
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function stripHtml(value: string | null | undefined) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

type StructuredProduct = {
  "@type"?: string | string[];
  name?: string;
  image?: string;
  description?: string;
  sku?: string;
  offers?: {
    price?: number | string;
    priceCurrency?: string;
    availability?: string;
  };
};

type GtagItem = {
  item_name?: string;
  item_sku?: string;
  item_image?: string;
  item_original_price?: string | number;
  item_in_stock?: boolean;
  item_category3?: string;
  price?: number;
};
