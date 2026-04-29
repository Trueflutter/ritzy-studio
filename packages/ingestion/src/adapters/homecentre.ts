import type {
  CatalogAdapter,
  ProductDiscoveryResult,
  RawProductCandidate
} from "../types";

const BASE_URL = "https://www.homecentre.com";
const DEFAULT_CATEGORY_URLS = [
  "https://www.homecentre.com/ae/en/c/furniture-sofaandseating-sofasandsofasets",
  "https://www.homecentre.com/ae/en/c/furniture-sofaandseating-armchairs",
  "https://www.homecentre.com/ae/en/c/furniture-livingroom-coffeetables",
  "https://www.homecentre.com/ae/en/c/furniture-livingroom-sideandendtables",
  "https://www.homecentre.com/ae/en/c/furniture-bedroom-beds",
  "https://www.homecentre.com/ae/en/c/furniture-diningroom-diningtables"
];

const cache = new Map<string, string>();
let lastFetchAt = 0;

export const homeCentreAdapter: CatalogAdapter = {
  key: "homecentre-ae",
  retailer: {
    name: "Home Centre",
    domain: "www.homecentre.com",
    country: "AE",
    adapterKey: "homecentre-ae",
    status: "candidate",
    robotsNotes:
      "robots.txt allows general crawling while disallowing search, cart, checkout, account, login, and parameterized URLs. Use category/product pages and sitemap URLs only.",
    termsNotes:
      "No official API/feed confirmed for MVP. Adapter uses public product/category pages and schema.org Product markup with light rate limiting."
  },
  getComplianceNotes: () => ({
    robotsNotes:
      "robots.txt allows / and lists UAE product/category sitemaps; disallows search, cart, checkout, account, login, and several parameterized paths.",
    termsNotes:
      "Use only light, approved-style public page reads. Prefer future affiliate/trade feed if Home Centre or Landmark Group grants access."
  }),
  discoverProducts: async function* ({ limit, categories } = {}) {
    const categoryUrls = categories?.length ? categories : DEFAULT_CATEGORY_URLS;
    let yielded = 0;

    for (const categoryUrl of categoryUrls) {
      const html = await fetchText(categoryUrl);
      const urls = parseProductUrlsFromCategoryHtml(html);

      for (const url of urls) {
        yield {
          url,
          categoryHint: categoryUrl,
          source: "category_page"
        };

        yielded += 1;
        if (limit && yielded >= limit) {
          return;
        }
      }
    }
  },
  extractProduct: async (discovery) => extractHomeCentreProduct(discovery)
};

export async function extractHomeCentreProduct(
  discovery: ProductDiscoveryResult
): Promise<RawProductCandidate> {
  const html = await fetchText(discovery.url);
  return parseHomeCentreProductHtml(html, discovery.url, discovery.categoryHint);
}

export function parseProductUrlsFromCategoryHtml(html: string): string[] {
  const urls = new Set<string>();

  for (const product of extractJsonLdProducts(html)) {
    const url = stringValue(product.url);
    if (url) {
      urls.add(toAbsoluteUrl(url));
    }
  }

  for (const match of html.matchAll(/href="([^"]*\/buy-[^"]*\/p\/[^"]+)"/g)) {
    urls.add(toAbsoluteUrl(decodeHtml(match[1] ?? "")));
  }

  return Array.from(urls);
}

export function parseHomeCentreProductHtml(
  html: string,
  fallbackUrl: string,
  categoryHint?: string
): RawProductCandidate {
  const product = extractJsonLdProducts(html)[0] ?? {};
  const offers = isRecord(product.offers) ? product.offers : {};
  const meta = extractMetaProperties(html);
  const canonicalUrl =
    stringValue(offers.url) ??
    stringValue(product.url) ??
    meta["product:link"] ??
    meta["og:url"] ??
    fallbackUrl;
  const images = imageValues(product.image);
  const additionalImages = (meta["product:additional_image_link"] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    canonicalUrl: toAbsoluteUrl(canonicalUrl),
    name: stringValue(product.name) ?? meta["product:title"] ?? meta["og:title"] ?? "Untitled product",
    retailerCategory:
      meta["product:product_type"] ?? stringValue(product.category) ?? categoryHint ?? null,
    description:
      stringValue(product.description) ??
      meta["product:description"] ??
      meta["og:description"] ??
      null,
    externalSku: meta["product:retailer_item_id"] ?? meta["product:id"] ?? extractProductId(canonicalUrl),
    priceText: stringValue(offers.price) ?? meta["product:price:amount"] ?? null,
    salePriceText: meta["product:price:sale_price"] ?? null,
    currency: stringValue(offers.priceCurrency) ?? meta["product:price:currency"] ?? "AED",
    availability:
      normalizeAvailability(stringValue(offers.availability) ?? meta["product:availability"]) ?? null,
    primaryImageUrl:
      images[0] ?? meta["product:image"] ?? meta["og:image"] ?? meta["twitter:image:src"] ?? null,
    imageUrls: [...images, ...additionalImages],
    color: stringValue(product.color) ?? meta["product:color"] ?? null,
    material: null,
    dimensionsText: [stringValue(product.name), canonicalUrl].filter(Boolean).join(" ")
  };
}

export async function fetchHomeCentreRobots() {
  return fetchText(`${BASE_URL}/robots.txt`);
}

async function fetchText(url: string) {
  if (cache.has(url)) {
    return cache.get(url) as string;
  }

  const elapsed = Date.now() - lastFetchAt;
  if (elapsed < 500) {
    await new Promise((resolve) => setTimeout(resolve, 500 - elapsed));
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "RitzyStudioBot/0.1 (+https://ritzy-studio.local; light catalog ingestion)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  lastFetchAt = Date.now();

  if (!response.ok) {
    throw new Error(`Home Centre fetch failed ${response.status} for ${url}`);
  }

  const text = await response.text();
  cache.set(url, text);
  return text;
}

function extractJsonLdProducts(html: string): Array<Record<string, unknown>> {
  const products: Array<Record<string, unknown>> = [];

  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const raw = decodeHtml(match[1] ?? "").trim();
    try {
      const parsed = JSON.parse(raw);
      collectProducts(parsed, products);
    } catch {
      continue;
    }
  }

  return products;
}

function collectProducts(value: unknown, products: Array<Record<string, unknown>>) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectProducts(item, products);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (value["@type"] === "Product") {
    products.push(value);
  }

  const itemList = value.itemListElement;
  if (Array.isArray(itemList)) {
    for (const item of itemList) {
      if (isRecord(item)) {
        collectProducts(item.item ?? item, products);
      }
    }
  }
}

function extractMetaProperties(html: string) {
  const meta: Record<string, string> = {};
  const pattern = /<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/g;

  for (const match of html.matchAll(pattern)) {
    const key = match[1];
    const value = match[2];
    if (key && value !== undefined) {
      meta[key] = decodeHtml(value);
    }
  }

  return meta;
}

function imageValues(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(stringValue).filter(Boolean) as string[];
  }

  const single = stringValue(value);
  return single ? [single] : [];
}

function stringValue(value: unknown) {
  if (typeof value === "number") {
    return String(value);
  }

  return typeof value === "string" && value.trim() ? decodeHtml(value.trim()) : undefined;
}

function normalizeAvailability(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  if (value.toLowerCase().includes("instock") || value.toLowerCase().includes("in stock")) {
    return "in stock";
  }

  if (value.toLowerCase().includes("outofstock") || value.toLowerCase().includes("out of stock")) {
    return "out of stock";
  }

  return value;
}

function extractProductId(url: string) {
  return url.match(/\/p\/([^/?#]+)/)?.[1] ?? null;
}

function toAbsoluteUrl(url: string) {
  if (url.startsWith("http")) {
    return url;
  }

  return new URL(url, BASE_URL).toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
