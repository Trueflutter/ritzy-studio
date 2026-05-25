import type { CatalogAdapter, ProductDiscoveryResult, RawProductCandidate } from "../types";

const BASE_URL = "https://www.ikea.com";
const MARKET_PREFIX = `${BASE_URL}/ae/en`;
const PRODUCT_URL_PATTERN = /^https:\/\/www\.ikea\.com\/ae\/en\/p\/[-a-z0-9]+-(?:s)?\d{8,}\/$/i;
const CATEGORY_URL_PATTERN = /^https:\/\/www\.ikea\.com\/ae\/en\/cat\/[-a-z0-9]+\/$/i;
const FETCH_DELAY_MS = 1_000;
const MAX_DEFAULT_DISCOVERIES = 4;
const MAX_DISCOVERIES = 8;
const DEFAULT_CATEGORY_URLS = [
  "https://www.ikea.com/ae/en/cat/sofas-fu003/",
  "https://www.ikea.com/ae/en/cat/dining-tables-21825/",
  "https://www.ikea.com/ae/en/cat/beds-bm003/",
  "https://www.ikea.com/ae/en/cat/desks-computer-desks-20649/"
];
const ROBOTS_NOTES =
  "robots.txt disallows search/filter/query/cart/account/checkout/order/favourites/profile/customer and internal paths including /catalog/, /iows/, /retail/, /m3/, /cdn-cgi/, fragments, recommendations, and navigation. Adapter uses only clean /ae/en/cat/ category URLs and /ae/en/p/ product URLs.";
const TERMS_NOTES =
  "No official IKEA feed or partner permission confirmed. Treat as controlled dry-run-only coverage using public static category/product pages at low request volume; prefer partner/feed approval before live writes or scale.";

const cache = new Map<string, string>();
let lastFetchAt = 0;

export const ikeaAdapter: CatalogAdapter = {
  key: "ikea-uae",
  dryRunOnly: true,
  retailer: {
    name: "IKEA UAE",
    domain: "www.ikea.com",
    country: "AE",
    adapterKey: "ikea-uae",
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
      if (!isCleanIkeaCategoryUrl(categoryUrl)) {
        continue;
      }

      const html = await fetchText(categoryUrl);
      for (const product of parseIkeaCategoryProducts(html)) {
        if (seenUrls.has(product.url)) {
          continue;
        }

        seenUrls.add(product.url);
        yield {
          url: product.url,
          categoryHint: product.categoryHint ?? inferIkeaCategory(categoryUrl),
          source: "category_page",
          sourcePayload: {
            source: "ikea",
            seedCategoryUrl: categoryUrl,
            sourceFreshnessTimestamp: new Date().toISOString(),
            salePriceText: product.salePriceText ?? null,
            listPriceText: product.listPriceText ?? null
          }
        };
        yielded += 1;
        if (yielded >= discoveryLimit) return;
      }
    }
  },
  extractProduct: async (discovery) => {
    if (!isCleanIkeaProductUrl(discovery.url)) {
      throw new Error(`IKEA UAE discovery URL is not a clean product URL: ${discovery.url}`);
    }

    return parseIkeaProductHtml(await fetchText(discovery.url), discovery.url, discovery.categoryHint, discovery.sourcePayload);
  }
};

export function parseIkeaProductUrls(html: string) {
  return parseIkeaCategoryProducts(html).map((product) => product.url);
}

export function parseIkeaCategoryProducts(html: string) {
  const products = new Map<
    string,
    {
      url: string;
      categoryHint: string | null;
      salePriceText: string | null;
      listPriceText: string | null;
    }
  >();
  const categoryHint = categoryFromCollectionPage(html);

  for (const product of extractJsonLdProducts(html)) {
    const url = normalizeIkeaUrl(asString(product.url) ?? asString(product["@id"]) ?? "");
    if (!isCleanIkeaProductUrl(url)) {
      continue;
    }

    const prices = pricesFromOffers(product.offers);
    products.set(url, {
      url,
      categoryHint: asString(product.category) ?? categoryHint,
      salePriceText: prices.salePriceText,
      listPriceText: prices.listPriceText
    });
  }

  for (const match of html.matchAll(/href="([^"]*\/ae\/en\/p\/[^"#?]+\/?)"/gi)) {
    const url = normalizeIkeaUrl(match[1] ?? "");
    if (isCleanIkeaProductUrl(url) && !products.has(url)) {
      products.set(url, {
        url,
        categoryHint,
        salePriceText: null,
        listPriceText: null
      });
    }
  }

  return [...products.values()];
}

export function parseIkeaProductHtml(
  html: string,
  fallbackUrl: string,
  categoryHint?: string,
  sourcePayload?: unknown
): RawProductCandidate {
  const product = extractJsonLdProducts(html)[0] ?? {};
  const canonicalUrl = normalizeIkeaUrl(
    asString(product.url) ??
      matchContent(html, /<link\s+[^>]*rel="canonical"[^>]*href="([^"]+)"/i) ??
      matchContent(html, /<meta\s+property="og:url"\s+content="([^"]+)"/i) ??
      fallbackUrl
  );
  const prices = pricesFromOffers(product.offers);
  const sourcePrices = sourcePayloadPrices(sourcePayload);
  const images = imageValues(product.image);
  const name =
    asString(product.name) ??
    matchContent(html, /<meta\s+property="og:title"\s+content="([^"]+)"/i) ??
    "Untitled IKEA product";
  const dimensions = dimensionsText({
    width: asString(product.width),
    depth: asString(product.depth),
    height: asString(product.height)
  });
  const salePriceText = sourcePrices.salePriceText ?? prices.salePriceText;
  const listPriceText = sourcePrices.listPriceText ?? prices.listPriceText ?? salePriceText;

  return {
    canonicalUrl: isCleanIkeaProductUrl(canonicalUrl) ? canonicalUrl : fallbackUrl,
    name: decodeHtml(name),
    retailerCategory: asString(product.category) ?? categoryHint ?? inferIkeaCategory(fallbackUrl),
    description: stripHtml(asString(product.description) ?? matchContent(html, /<meta\s+name="description"\s+content="([^"]+)"/i)),
    externalSku: asString(product.sku) ?? asString(product.mpn) ?? skuFromUrl(fallbackUrl),
    priceText: listPriceText,
    salePriceText:
      salePriceText && listPriceText && salePriceText !== listPriceText
        ? salePriceText
        : null,
    currency: prices.currency ?? "AED",
    availability: normalizeAvailability(asString(recordValue(product.offers, "availability"))),
    primaryImageUrl: images[0] ?? matchContent(html, /<meta\s+property="og:image"\s+content="([^"]+)"/i),
    imageUrls: images,
    color: asString(product.color) ?? colorFromName(name),
    material: asString(product.material) ?? null,
    dimensionsText: dimensions,
    sourcePayload: {
      source: "ikea",
      sourceFreshnessTimestamp: sourceFreshness(sourcePayload),
      robotsNotes: ROBOTS_NOTES
    }
  };
}

export function isCleanIkeaCategoryUrl(url: string) {
  return isCleanIkeaPublicUrl(url) && CATEGORY_URL_PATTERN.test(normalizeIkeaUrl(url));
}

export function isCleanIkeaProductUrl(url: string) {
  return isCleanIkeaPublicUrl(url) && PRODUCT_URL_PATTERN.test(normalizeIkeaUrl(url));
}

function isCleanIkeaPublicUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== BASE_URL || parsed.search || parsed.hash) return false;
    if (!parsed.pathname.startsWith("/ae/en/")) return false;
    if (
      parsed.pathname.includes("/search/") ||
      parsed.pathname.includes("/cart/") ||
      parsed.pathname.includes("/shoppingcart/") ||
      parsed.pathname.includes("/checkout/") ||
      parsed.pathname.includes("/order/") ||
      parsed.pathname.includes("/profile/") ||
      parsed.pathname.includes("/customer/") ||
      parsed.pathname.includes("/favourites/") ||
      parsed.pathname.includes("/catalog/") ||
      parsed.pathname.includes("/iows/") ||
      parsed.pathname.includes("/retail/") ||
      parsed.pathname.includes("/m3/") ||
      parsed.pathname.includes("/cdn-cgi/") ||
      parsed.pathname.includes("/fragments/") ||
      parsed.pathname.includes("/navigation/") ||
      parsed.pathname.includes("/recommendations/")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function fetchText(url: string) {
  if (cache.has(url)) return cache.get(url) as string;

  const elapsed = Date.now() - lastFetchAt;
  if (elapsed < FETCH_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, FETCH_DELAY_MS - elapsed));
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "RitzyStudioBot/0.1 (+https://ritzy-studio.local; dry-run catalog ingestion)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-AE,en;q=0.9"
    },
    signal: AbortSignal.timeout(25_000)
  });
  lastFetchAt = Date.now();

  if (!response.ok) throw new Error(`IKEA UAE fetch failed ${response.status} for ${url}`);
  const text = await response.text();
  cache.set(url, text);
  return text;
}

function extractJsonLdProducts(html: string) {
  const products: Array<Record<string, unknown>> = [];
  for (const match of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = decodeHtml(match[1] ?? "").trim();
    const parsed = safeJsonParse(raw);
    collectProducts(parsed, products);
  }
  return products;
}

function collectProducts(value: unknown, products: Array<Record<string, unknown>>) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectProducts(item, products));
    return;
  }
  if (!isRecord(value)) return;

  const type = value["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) {
    products.push(value);
  }

  collectProducts(value["@graph"], products);
  collectProducts(value.mainEntity, products);
  const itemList = value.itemListElement;
  if (Array.isArray(itemList)) {
    itemList.forEach((item) => collectProducts(isRecord(item) ? item.item ?? item : item, products));
  }
}

function categoryFromCollectionPage(html: string) {
  for (const match of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    const parsed = safeJsonParse(decodeHtml(match[1] ?? "").trim());
    const name = findCollectionName(parsed);
    if (name) return name;
  }
  return null;
}

function findCollectionName(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const name = findCollectionName(item);
      if (name) return name;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  if (value["@type"] === "CollectionPage") return asString(value.name) ?? null;
  return findCollectionName(value["@graph"]) ?? findCollectionName(value.mainEntity);
}

function pricesFromOffers(offers: unknown) {
  const offer = Array.isArray(offers) ? offers[0] : offers;
  if (!isRecord(offer)) {
    return { salePriceText: null, listPriceText: null, currency: null };
  }

  const price = asString(offer.price);
  const currency = asString(offer.priceCurrency);
  const specs = Array.isArray(offer.priceSpecification) ? offer.priceSpecification : [];
  let salePriceText: string | null = price ?? null;
  let listPriceText: string | null = price ?? null;
  let specCurrency = currency ?? null;

  for (const spec of specs) {
    if (!isRecord(spec)) continue;
    const specPrice = asString(spec.price);
    if (!specPrice) continue;
    specCurrency = asString(spec.priceCurrency) ?? specCurrency;
    if (asString(spec.priceType)?.includes("StrikethroughPrice")) {
      listPriceText = specPrice;
    } else {
      salePriceText = specPrice;
      listPriceText ??= specPrice;
    }
  }

  return {
    salePriceText,
    listPriceText,
    currency: specCurrency
  };
}

function sourcePayloadPrices(value: unknown) {
  if (!isRecord(value)) return { salePriceText: null, listPriceText: null };
  return {
    salePriceText: asString(value.salePriceText) ?? null,
    listPriceText: asString(value.listPriceText) ?? null
  };
}

function imageValues(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (isRecord(item) ? asString(item.contentUrl) ?? asString(item.url) : asString(item)))
      .filter(Boolean) as string[];
  }

  if (isRecord(value)) {
    const imageUrl = asString(value.contentUrl) ?? asString(value.url);
    return imageUrl ? [imageUrl] : [];
  }

  const imageUrl = asString(value);
  return imageUrl ? [imageUrl] : [];
}

function normalizeIkeaUrl(value: string) {
  if (!value) return "";
  const decoded = decodeHtml(value).replace(/\\\//g, "/").trim();
  const absolute = decoded.startsWith("/") ? `${BASE_URL}${decoded}` : decoded;
  try {
    const parsed = new URL(absolute);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return absolute;
  }
}

function inferIkeaCategory(url: string) {
  const path = new URL(normalizeIkeaUrl(url)).pathname;
  if (/sofa|armchair|living/.test(path)) return "sofas";
  if (/dining/.test(path)) return "dining tables";
  if (/bed|mattress/.test(path)) return "beds";
  if (/desk|office/.test(path)) return "desks";
  if (/rug|carpet/.test(path)) return "rugs";
  if (/lamp|lighting/.test(path)) return "lighting";
  if (/mirror/.test(path)) return "mirrors";
  if (/storage|cabinet|shelving/.test(path)) return "storage";
  return "home furnishings";
}

function skuFromUrl(url: string) {
  return new URL(normalizeIkeaUrl(url)).pathname.match(/-((?:s)?\d{8,})\/$/i)?.[1]?.replace(/^s/i, "") ?? null;
}

function colorFromName(name: string) {
  return name.split(/,\s*/).at(-1)?.trim() ?? null;
}

function dimensionsText(dimensions: { width?: string; depth?: string; height?: string }) {
  return [
    dimensions.width ? `width ${dimensions.width}` : null,
    dimensions.depth ? `depth ${dimensions.depth}` : null,
    dimensions.height ? `height ${dimensions.height}` : null
  ]
    .filter(Boolean)
    .join(" x ") || null;
}

function normalizeAvailability(value?: string) {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes("instock")) return "in stock";
  if (lower.includes("outofstock")) return "out of stock";
  return value;
}

function sourceFreshness(value: unknown) {
  return isRecord(value) ? asString(value.sourceFreshnessTimestamp) ?? null : null;
}

function recordValue(value: unknown, key: string) {
  return isRecord(value) ? value[key] : undefined;
}

function matchContent(html: string, regex: RegExp) {
  return html.match(regex)?.[1] ?? null;
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

function asString(value: unknown) {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
