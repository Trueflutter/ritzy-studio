import type { CatalogAdapter, ProductDiscoveryResult, RawProductCandidate } from "../types";

const BASE_URL = "https://www.chattelsandmore.com";
const DEFAULT_CATEGORY_URLS = [
  "https://www.chattelsandmore.com/en/category/living-room/sofas",
  "https://www.chattelsandmore.com/en/category/living-room/armchairs",
  "https://www.chattelsandmore.com/en/category/living-room/coffee-side-tables",
  "https://www.chattelsandmore.com/en/category/bedroom/beds",
  "https://www.chattelsandmore.com/en/category/dining-room/dining-tables"
];

const cache = new Map<string, string>();
let lastFetchAt = 0;

export const chattelsAdapter: CatalogAdapter = {
  key: "chattels-and-more-ae",
  retailer: {
    name: "Chattels & More",
    domain: "www.chattelsandmore.com",
    country: "AE",
    adapterKey: "chattels-and-more-ae",
    status: "candidate",
    robotsNotes:
      "robots.txt disallows search, checkout, cart, customer/auth, API/admin, and parameterized filters; public category/product pages are not disallowed.",
    termsNotes:
      "No official feed confirmed for MVP. Adapter uses public category/product schema.org markup with light rate limiting."
  },
  getComplianceNotes: () => ({
    robotsNotes:
      "robots.txt allows public category/product paths and disallows search, checkout, cart, customer/auth, API/admin, and filter parameters.",
    termsNotes:
      "Use low-volume public page reads for MVP; prefer approved feed or trade access long term."
  }),
  discoverProducts: async function* ({ limit, categories } = {}) {
    const categoryUrls = categories?.length ? categories : DEFAULT_CATEGORY_URLS;
    let yielded = 0;

    for (const categoryUrl of categoryUrls) {
      const html = await fetchText(categoryUrl);
      for (const url of parseChattelsProductUrls(html)) {
        yield { url, categoryHint: categoryUrl, source: "category_page" };
        yielded += 1;
        if (limit && yielded >= limit) {
          return;
        }
      }
    }
  },
  extractProduct: async (discovery) =>
    parseChattelsProductHtml(await fetchText(discovery.url), discovery.url, discovery.categoryHint)
};

export function parseChattelsProductUrls(html: string) {
  const urls = new Set<string>();
  for (const product of extractJsonLdProducts(html)) {
    const url = asString(product.url);
    if (url?.startsWith(`${BASE_URL}/en/`)) {
      urls.add(url);
    }
  }
  return Array.from(urls);
}

export function parseChattelsProductHtml(
  html: string,
  fallbackUrl: string,
  categoryHint?: string
): RawProductCandidate {
  const product = extractJsonLdProducts(html)[0] ?? {};
  const offers = isRecord(product.offers) ? product.offers : {};
  const images = imageValues(product.image);
  const dimensionsText = [
    dimensionText("W", product.width),
    dimensionText("D", product.depth),
    dimensionText("H", product.height)
  ]
    .filter(Boolean)
    .join(" x ");

  return {
    canonicalUrl: asString(offers.url) ?? asString(product.url) ?? fallbackUrl,
    name: asString(product.name) ?? "Untitled product",
    retailerCategory: asString(product.category) ?? categoryHint ?? null,
    description: stripHtml(asString(product.description) ?? null),
    externalSku: asString(product.sku) ?? asString(product.mpn) ?? null,
    priceText: asString(offers.price) ?? null,
    salePriceText: null,
    currency: asString(offers.priceCurrency) ?? "AED",
    availability: normalizeAvailability(asString(offers.availability)) ?? null,
    primaryImageUrl: images[0] ?? null,
    imageUrls: images,
    color: asString(product.color) ?? null,
    material: asString(product.material) ?? null,
    dimensionsText: dimensionsText || asString(product.name) || null
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

  const response = await fetch(url, {
    headers: {
      "user-agent": "RitzyStudioBot/0.1 (+https://ritzy-studio.local; light catalog ingestion)"
    }
  });
  lastFetchAt = Date.now();

  if (!response.ok) {
    throw new Error(`Chattels & More fetch failed ${response.status} for ${url}`);
  }

  const text = await response.text();
  cache.set(url, text);
  return text;
}

function extractJsonLdProducts(html: string): Array<Record<string, unknown>> {
  const products: Array<Record<string, unknown>> = [];
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      collectProducts(JSON.parse(match[1] ?? ""), products);
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

function dimensionText(label: string, value: unknown) {
  if (isRecord(value)) {
    const number = asString(value.value);
    const unit = asString(value.unitCode) ?? asString(value.unitText) ?? "cm";
    return number ? `${label} ${number} ${unit}` : null;
  }
  return null;
}

function imageValues(value: unknown) {
  return Array.isArray(value)
    ? (value.map(asString).filter(Boolean) as string[])
    : asString(value)
      ? [asString(value) as string]
      : [];
}

function normalizeAvailability(value?: string) {
  if (!value) return undefined;
  if (value.toLowerCase().includes("instock")) return "in stock";
  if (value.toLowerCase().includes("outofstock")) return "out of stock";
  return value;
}

function stripHtml(value: string | null) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || null;
}

function asString(value: unknown) {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
